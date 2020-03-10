import * as fs from 'fs-extra'
import * as path from 'path'
import * as yaml from 'js-yaml'
import * as chalk from 'chalk'
import {BuildDriver} from '../abstract/build-driver'
import {ValidatedOutput} from '../../validated-output'
import {JSTools} from '../../js-tools'
import {DockerStackConfiguration} from '../../config/stacks/docker/docker-stack-configuration'
import {FileTools} from '../../fileio/file-tools'
import {YMLFile} from '../../fileio/yml-file'

// - types ---------------------------------------------------------------------
type Dictionary = {[key: string]: any}

export class DockerBuildDriver extends BuildDriver
{
    protected base_command = 'docker'
    protected configuration_constructor = DockerStackConfiguration // pointer to configuration class constructor
    protected json_output_format = "line_json"
    protected default_config_name = "config.yml"

    protected ERRORSTRINGS = {
      "MISSING_DOCKERFILE_OR_IMAGE": (dir: string) => chalk`{bold Stack is Missing a Dockerfile or image.tar.gz file.}\n  {italic path:} ${dir}`,
      "MISSING_STACKDIR": (dir: string) => chalk`{bold Nonexistant Stack Directory or Image.}\n  {italic path:} ${dir}`,
      "YML_ERROR": (path: string, error: string) => chalk`{bold Unable to Parse YML.}\n  {italic  path:} ${path}\n  {italic error:} ${error}`,
      "INVALID_NAME": (path: string) => chalk`{bold Invalid Stack Name} - stack names may contain only lowercase and uppercase letters, digits, underscores, periods and dashes.\n  {italic  path:} ${path}`,
      "FAILED_TO_EXTRACT_IMAGE_NAME": chalk`{bold Failed to load tar} - could not extract image name`
    }

    protected WARNINGSTRINGS = {
      IMAGE_NONEXISTANT: (name: string) => chalk`There is no image named ${name}.`
    }

    validate(stack_path: string, overloaded_config_paths: Array<string> = [])
    {
      var result = new ValidatedOutput(true);
      var stack_type
      // -- check that folder name is valid ------------------------------------
      if(FileTools.existsDir(stack_path)) // -- assume local stack -------------
      {
        const name_re = new RegExp(/^[a-zA-z0-9-_.]+$/)
        if(!name_re.test(this.stackName(stack_path)))
          result.pushError(this.ERRORSTRINGS["INVALID_NAME"](stack_path))

        if(FileTools.existsFile(path.join(stack_path, 'Dockerfile')))
          stack_type = 'local-dockerfile'
        else if(FileTools.existsFile(path.join(stack_path, 'image.tar.gz')))
          stack_type = 'local-tar'
        else
          result.pushError(this.ERRORSTRINGS["MISSING_DOCKERFILE_OR_IMAGE"](stack_path));
      }
      else // -- assume remote image -------------------------------------------
      {
        stack_type = 'remote'
        if(!this.isBuilt(stack_path)) {
          const pull_result = this.shell.exec(`${this.base_command} pull`, {}, [stack_path])
          if(!pull_result.success) result.pushError(this.ERRORSTRINGS["MISSING_STACKDIR"](stack_path));
        }
      }
      if(!result.success) return result
      result = this.loadConfiguration(stack_path, overloaded_config_paths);
      return (result.success) ? new ValidatedOutput(true, {stack_type: stack_type, configuration: result.data}) : result
    }

    isBuilt(stack_path: string)
    {
      const command = `${this.base_command} images`;
      const args:Array<string> = []
      const flags:Dictionary = {
        filter: `reference=${this.imageName(stack_path)}`
      }
      this.addJSONFormatFlag(flags);
      var result = this.shell.output(command, flags, args, {}, this.json_output_format)
      return (result.success && !JSTools.isEmpty(result.data)) ? true : false
    }

    build(stack_path: string, overloaded_config_paths: Array<string> = [], nocache?:boolean)
    {
      var result = this.validate(stack_path, overloaded_config_paths)
      if(!result.success) return result
      const {stack_type, configuration} = result.data

      if(stack_type === 'local-dockerfile') // build local stack -------------------------
      {
          const build_object:Dictionary = configuration.buildObject()
          const command = `${this.base_command} build`;
          const args = [build_object?.context || '.']
          let   flags:Dictionary = {
            "t": this.imageName(stack_path),
            "f": path.join(build_object.dockerfile || 'Dockerfile')
          }
          if(build_object["no_cache"] || nocache) flags["no-cache"] = {}
          this.argFlags(flags, build_object)
          result.data = this.shell.exec(command, flags, args, {cwd: stack_path})
      }
      else if(stack_type === 'local-tar') // build local stack -------------------------
      {
          // -- load tar file --------------------------------------------------
          const command = `${this.base_command} load`;
          const flags = {input: 'image.tar.gz', q: {}}
          const load_result = this.shell.output(command,flags, [], {cwd: stack_path})
          if(!load_result.success) return load_result
          // -- extract name and retag -----------------------------------------
          const image_name = load_result.data?.split(/:(.+)/)?.[1]?.trim() // split on first ":"
          if(!image_name) return new ValidatedOutput(false, [], [this.ERRORSTRINGS.FAILED_TO_EXTRACT_IMAGE_NAME])
          result.data = this.shell.exec(`${this.base_command} image tag`, {}, [image_name, this.imageName(stack_path)])
      }
      else if(stack_type === 'remote') // retag remote stack -----------------------
      {
        result.data = this.shell.exec(`${this.base_command} image tag`, {}, [stack_path, this.imageName(stack_path)])
      }
      return result;
    }

    protected argFlags(flags:Dictionary, build_object:Dictionary)
    {
      const args = build_object?.args
      if(args) flags["build-arg"] = {
        escape: false, // allow shell commands $()
        value: Object.keys(args).map(k => `${k}\\=${args[k]}`)
      }
    }

    removeImage(stack_path: string)
    {
      if(this.isBuilt(stack_path))
      {
          const command = `${this.base_command} rmi`;
          const args = [this.imageName(stack_path)]
          const flags = {}
          return this.shell.exec(command, flags, args)
      }
      return new ValidatedOutput(true, [], [], [this.WARNINGSTRINGS.IMAGE_NONEXISTANT(this.imageName(stack_path))])
    }

    // Load stack_path/config.yml and any additional config files. The settings in the last file in the array has highest priorty
    // silently ignores files if they are not present

    loadConfiguration(stack_path: string, overloaded_config_paths: Array<string> = [])
    {
      overloaded_config_paths = [path.join(stack_path, this.default_config_name)].concat(overloaded_config_paths) // always add stack config file first. Note create new array to prevent modifying overloaded_config_paths for calling function
      var configuration = this.emptyConfiguration()
      var result = overloaded_config_paths.reduce(
        (result: ValidatedOutput, path: string) => {
          const sub_configuration = this.emptyConfiguration()
          const load_result = sub_configuration.loadFromFile(path)
          if(load_result) configuration.merge(sub_configuration)
          return result
        },
        new ValidatedOutput(true)
      )

      return (result.success) ? new ValidatedOutput(true, configuration) : result
    }

    copy(stack_path: string, new_stack_path: string, configuration?: DockerStackConfiguration)
    {
      try
      {
        fs.copySync(stack_path, new_stack_path)
        if(configuration !== undefined)
          return configuration.writeToFile(path.join(new_stack_path,this.default_config_name))
      }
      catch(e)
      {
        return new ValidatedOutput(false, e, [e?.message])
      }
      return new ValidatedOutput(true)
    }

    // Special function for reducing code repetition in Podman Driver Class

    protected addJSONFormatFlag(flags: Dictionary)
    {
      flags["format"] = '{{json .}}'
    }

    // Overloaded Methods

    imageName(stack_path: string) // Docker only accepts lowercase image names
    {
      return super.imageName(stack_path).toLowerCase()
    }

    emptyConfiguration()
    {
      return new DockerStackConfiguration()
    }

}
