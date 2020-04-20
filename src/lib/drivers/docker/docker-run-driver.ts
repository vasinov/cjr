// ===========================================================================
// Docker-Run-Driver: Controls Docker For Running containers
// ===========================================================================

import * as path from 'path'
import * as chalk from 'chalk'
import {cli_name} from '../../constants'
import {ValidatedOutput} from '../../validated-output'
import {PathTools} from '../../fileio/path-tools'
import {RunDriver, Dictionary} from '../abstract/run-driver'
import {ShellCommand} from "../../shell-command"
import {dr_vo_validator} from './schema/docker-run-schema'
import {de_vo_validator} from './schema/docker-exec-schema'
import {DockerStackConfiguration} from '../../config/stacks/docker/docker-stack-configuration'

export class DockerRunDriver extends RunDriver
{
  protected base_command = 'docker'
  protected json_output_format = "line_json"
  protected selinux: boolean = false
  protected run_schema_validator = dr_vo_validator
  protected exec_schema_validator = de_vo_validator

  protected ERRORSTRINGS = {
    INVALID_JOB : chalk`{bold job_options object did not pass validation.}`,
    EMPTY_CREATE_ID: chalk`{bold Unable to create container.}`,
    FAILED_CREATE_VOLUME: chalk`{bold Unable to create volume.}`
  }

  protected STATUSSTRING = {
    COPY : (container_id: string, container_path: string, host_path: string) =>
      chalk` copy {green ${container_id}:${container_path}}\n   to {green ${host_path}}`
  }

  constructor(shell: ShellCommand, options: {tag: string, selinux: boolean})
  {
    super(shell, options.tag)
    this.selinux = options.selinux || false
  }

  emptyConfiguration()
  {
    return new DockerStackConfiguration()
  }

  jobStart(stack_path: string, configuration: DockerStackConfiguration, callbacks:Dictionary={})
  {
    const job_options = configuration.runObject()
    // add mandatory labels
    const mandatory_labels = {runner: cli_name}
    job_options["labels"] = { ...(job_options["labels"] || {}), ...mandatory_labels}
    var result = this.run_schema_validator(job_options)
    if(!result.success) return result.pushError(this.ERRORSTRINGS.INVALID_JOB)
    // -- create container -----------------------------------------------------
    result = this.create(
      this.imageName(stack_path, configuration.buildHash()),
      configuration.getCommand(),
      job_options
    )
    if(!result.success) return result
    const container_id = result.data;
    if(callbacks?.postCreate) callbacks.postCreate(container_id)
    // -- run container --------------------------------------------------------
    const command = `${this.base_command} start`;
    const args: Array<string> = [container_id]
    const flags = (!job_options.detached) ? {attach: {}, interactive: {}} : {}
    const shell_options = (!job_options.detached) ? {stdio: "inherit"} : {stdio: "pipe"}
    result = this.shell.exec(command, flags, args, shell_options)
    if(!result.success) return result
    if(callbacks?.postExec) callbacks.postExec(result)
    return result
  }

  protected create(image_name: string, command_string: string, run_options={})
  {
    const command = `${this.base_command} create`;
    const args  = [image_name, command_string]
    const flags = this.runFlags(run_options)
    var result = this.shell.output(command, flags, args, {}, "trim")
    if(result.data === "") return new ValidatedOutput(false, [], [this.ERRORSTRINGS.EMPTY_CREATE_ID])
    return result
  }

  jobLog(id: string, lines: string="all")
  {
    var command = `${this.base_command} logs`;
    var args = [id]
    const lines_int = parseInt(lines)
    const flags = (isNaN(lines_int)) ? {} : {tail: `${lines_int}`}
    return new ValidatedOutput(true, this.shell.exec(command, flags, args))
  }

  jobAttach(id: string)
  {
    var command = `${this.base_command} attach`;
    var args = [id]
    var flags = {}
    return new ValidatedOutput(true, this.shell.exec(command, flags, args))
  }

  jobExec(id: string, exec_command: Array<string>, exec_options:Dictionary={}, mode:"print"|"output"|"json")
  {
    var command = `${this.base_command} exec`;
    var args = [id].concat(exec_command)
    const flags = this.execFlags(exec_options)
    if(mode == "print")
      return new ValidatedOutput(true, this.shell.exec(command, flags, args))
    else if(mode == "json")
      return this.shell.output(command, flags, args, {}, 'json')
    else
      return this.shell.output(command, flags, args)
  }

  jobDelete(ids: Array<string>)
  {
    return new ValidatedOutput(true, [this.stop(ids), this.remove(ids)])
  }

  jobStop(ids: Array<string>)
  {
    return new ValidatedOutput(true, this.stop(ids))
  }

  volumeDelete(ids: Array<string>)
  {
    const command = `${this.base_command} volume rm`
    return this.shell.exec(command, {}, ids, {stdio: "pipe"})
  }

  // protected helpers

  protected stop(ids: Array<string>)
  {
    if(ids.length == 0) return;
    const command = `${this.base_command} stop`;
    const args = ids
    const flags = {}
    return this.shell.exec(command, flags, args, {stdio: "pipe"})
  }

  protected remove(ids: Array<string>)
  {
    if(ids.length == 0) return;
    const command = `${this.base_command} rm`;
    const args = ids
    const flags = {}
    return this.shell.exec(command, flags, args, {stdio: "pipe"})
  }

  //JOBINFO returns information about running jobs that match a given stack_path AND running state.
  // PARAMETERS
  // stack_paths: Array<string> - any jobs with this stack will be returned. if stack_paths=[] or stack_paths=[""]
  //                              then jobs with any stack will be returned.
  // job_states: Array<string> - the state of returned jobs will match with any of the values specified in this array. If
  //                             job_states=[] or job_states=[""] then jobs with any state will be returned.
  jobInfo(stack_paths: Array<string>, job_states: Array<string> = [])
  {
    const info:Array<Dictionary> = []
    if(stack_paths.length == 0) stack_paths = [""]
    if(job_states.length == 0) job_states = [""]
    stack_paths.map((stack_path:string) => // loop through stacks
    {
      job_states.map((job_state: string) =>  // loop through states
      {
        const command = `${this.base_command} ps`;
        const args: Array<string> = []
        const flags: Dictionary = {
          "a" : {},
          "no-trunc": {},
          "filter": [`label=runner=${cli_name}`]
        };
        if(stack_path) flags["filter"].push(`label=stack=${stack_path}`)
        if(job_state) flags["filter"].push(`status=${job_state}`)
        this.addFormatFlags(flags, {format: "json"})
        const result = this.shell.output(command, flags, args, {}, this.json_output_format)
        if(result.success) info.push( ...this.extractJobInfo(result.data))
      })
    })
    return info

  }

  protected extractJobInfo(raw_ps_data: Array<Dictionary>)
  {
    // NOTE: docker ps does not correctly format labels with --format {{json .}}
    // This Function calls docker inspect to extract properly formatted labels
    const ids = raw_ps_data.map((x:Dictionary) => x.ID)
    const result = this.shell.output(
      `${this.base_command} inspect`,
      {format: '{{"{\\\"ID\\\":"}}{{json .Id}},{{"\\\"PortBindings\\\":"}}{{json .HostConfig.PortBindings}},{{"\\\"Labels\\\":"}}{{json .Config.Labels}}{{"}"}}'}, // JSON format {ID: XXX, Labels: YYY, PortBindings: ZZZ}
      ids,
      {},
      'line_json'
    )
    if(!result.success) return []
    // -- function for extracting port information for inspect
    const extractBoundPorts = (d:Dictionary) => {
      const bound_ports:Array<number> = []
      Object.keys(d).map((k:string) => {
        const host_port = d[k]?.pop()?.HostPort; // assumes form {"PORTKEY": [{hostPort: "NUMBER"}], "PORTKEY": [{hostPort: "NUMBER"}]}
        if(host_port && !isNaN(parseInt(host_port))) bound_ports.push(parseInt(host_port))
      })
      return bound_ports
    }
    // -- extract label & port data -----------------------------------------------
    const inspect_data:Dictionary = {}
    result.data.map((info:Dictionary) => {
      if(info.ID)
        inspect_data[info.ID] = {
          'Labels': info?.['Labels'] || {},
          'PortBindings': extractBoundPorts(info?.['PortBindings'] || {})
        }
    });

    // converts statusMessage to one of three states
    const state = (x: String) => {
      if(x.match(/^Exited/)) return "exited"
      if(x.match(/^Created/)) return "created"
      if(x.match(/^Up/)) return "running"
      return "unknown"
    }

    return raw_ps_data.map((x:Dictionary) => {
      return {
        id: x.ID,
        names: x.Names,
        command: x.Command,
        state: state(x.Status),
        stack: inspect_data?.[x.ID]?.Labels.stack || "",
        labels: inspect_data?.[x.ID]?.Labels || {},
        hostPortBindings: inspect_data?.[x.ID]?.PortBindings || [],
        status: x.Status
      }
    })
  }

  jobToImage(id: string, image_name: string)
  {
    const command = `${this.base_command} commit`
    const args  = [id, image_name]
    const flags = {}
    return this.shell.output(command, flags, args)
  }

  // options accepts following properties {lables?: Array<string>, driver?: string, name?:string}
  volumeCreate(options:Dictionary = {})
  {
    const command = `${this.base_command} volume create`
    var flags:Dictionary = {}
    if(options?.labels?.length > 0) flags.labels = options?.labels
    if(options?.driver) flags.driver = options?.driver
    const args = (options.name) ? [options.name] : []
    return this.shell.output(command, flags, args, {}, "trim")
  }

  imageName(stack_path: string, prefix: string="")
  {
    return super.imageName(stack_path, prefix).toLowerCase() // Docker only accepts lowercase image names
  }

  protected runFlags(run_object: Dictionary) // TODO: CONSOLIDATE ALL FUNCTIONS THAT DID NOT REQUIRE OVERLOADING
  {
    var flags = {};
    if(this.run_schema_validator(run_object).success) //verify docker-run schema
    {
      this.addEntrypointFlags(flags, run_object)
      this.addFormatFlags(flags, run_object)
      this.addRemovalFlags(flags, run_object)
      this.addInteractiveFlags(flags, run_object)
      this.addWorkingDirFlags(flags, run_object)
      this.addNameFlags(flags, run_object)
      this.addPortFlags(flags, run_object)
      this.addENVFlags(flags, run_object)
      this.addMountFlags(flags, run_object)
      this.addResourceFlags(flags, run_object)
      this.addLabelFlags(flags, run_object)
      this.addSpecialFlags(flags, run_object)
    }
    return flags
  }

  protected execFlags(exec_object: Dictionary)
  {
    var flags = {};
    if(this.exec_schema_validator(exec_object).success) //verify docker-run schema
    {
      this.addInteractiveFlags(flags, exec_object)
      this.addWorkingDirFlags(flags, exec_object)
      this.addDetachedFlags(flags, exec_object)
    }
    return flags
  }

  // === START protected Helper Functions for flag generation ====================

  protected addFormatFlags(flags: Dictionary, run_object: Dictionary)
  {
    if(run_object?.format === "json") {
      flags["format"] = '{{json .}}'
    }
  }

  protected addRemovalFlags(flags: Dictionary, run_object: Dictionary)
  {
    if(run_object?.remove) {
      flags["rm"] = {}
    }
  }

  protected addInteractiveFlags(flags: Dictionary, run_object: Dictionary)
  {
    if(run_object?.interactive == true)
    {
        flags["i"] = {}
        flags["t"] = {}
    }
  }

  protected addWorkingDirFlags(flags:Dictionary, run_object: Dictionary)
  {
    if(run_object?.wd)
    {
      flags["w"] = run_object.wd
    }
  }

  protected addNameFlags(flags:Dictionary, run_object: Dictionary)
  {
    if(run_object?.name)
    {
      flags["name"] = run_object.name
    }
  }

  protected addDetachedFlags(flags:Dictionary, run_object: Dictionary)
  {
    if(run_object?.detached)
    {
      flags["d"] = {}
    }
  }

  protected addPortFlags(flags: Dictionary, run_object: Dictionary)
  {
    if(run_object?.ports?.length > 0)
    {
      flags["p"] = {
        escape: false,
        value: run_object.ports.map((po:Dictionary) => `${po.hostPort}:${po.containerPort}`)
      }
    }
  }

  protected addENVFlags(flags: Dictionary, run_object: Dictionary)
  {
    if(run_object?.environment)
    {
      const keys = Object.keys(run_object.environment)
      flags["env"] = {
        escape: false,
        value: keys.map(key => `${key}=${run_object.environment[key]}`)
      }
    }
  }

  protected addResourceFlags(flags: Dictionary, run_object: Dictionary)
  {
    const valid_keys = ["cpus", "gpu", "memory", "swap-memory"]
    const keys = Object.keys(run_object?.resources || {})
    keys?.map((key:string) => {
      if(valid_keys.includes(key)) flags[key] = run_object?.resources[key]
    })
  }

  protected addEntrypointFlags(flags: Dictionary, run_object: Dictionary)
  {
    if(run_object?.entrypoint)
    {
      flags["entrypoint"] = run_object['entrypoint']
    }
  }

  protected addSpecialFlags(flags: Dictionary, run_object: Dictionary)
  {
    if(run_object?.flags?.network) { // used for sharing DISPLAY variable
      flags["network"] = run_object.flags.network
    }
    if(run_object?.flags?.['mac-address'])
    {
      flags["mac-address"] = run_object?.flags?.['mac-address']
    }
  }

  protected addMountFlags(flags: Dictionary, run_object: Dictionary)
  {
    if(run_object?.mounts?.length > 0)
    {
      // -- standard mounts use --mount flag -----------------------------------
      const standard_mounts = (this.selinux) ?
        run_object.mounts.filter( (mount:Dictionary) => ((mount.type != "bind") || (mount.type == "bind" && mount?.selinux === false)) ) :
        run_object.mounts.filter( (mount:Dictionary) => ((mount.type != "bind") || (mount.type == "bind" && mount?.selinux !== true)) ) ;
      if (standard_mounts.length > 0)
        flags["mount"] = {
          escape: false,
          value: standard_mounts.map(this.mountObjectToFlagStr)
        }
      // -- selinux mounts require --volume flag -------------------------------
      const selinux_mounts  = (this.selinux) ?
        run_object.mounts.filter( (mount:Dictionary) => (mount.type == "bind" && mount?.selinux !== false) ) :
        run_object.mounts.filter( (mount:Dictionary) => (mount.type == "bind" && mount?.selinux === true)  ) ;
      if(selinux_mounts.length > 0)
        flags["volume"] = {
          escape: false,
          value: selinux_mounts.map(this.selinuxBindMountObjectToFlagStr)
        }
    }
  }

  protected mountObjectToFlagStr(mo: Dictionary)
  {
    switch(mo.type)
    {
      case "bind":
        return `type=${mo.type},source=${ShellCommand.bashEscape(mo.hostPath)},destination=${ShellCommand.bashEscape(mo.containerPath)}${(mo.readonly) ? ",readonly" : ""},consistency=${mo.consistency || "consistent"}`
      case "volume":
        return `type=${mo.type},source=${ShellCommand.bashEscape(mo.volumeName)},destination=${ShellCommand.bashEscape(mo.containerPath)}${(mo.readonly) ? ",readonly" : ""}`
      case "tmpfs":
        return `type=${mo.type},destination=${ShellCommand.bashEscape(mo.containerPath)}`
    }
  }

  protected selinuxBindMountObjectToFlagStr(mo: Dictionary)
  {
    if(mo.type !== "bind") return []
    const selinux_str = 'z' // allow sharing with all containers
    return `${ShellCommand.bashEscape(mo.hostPath)}:${ShellCommand.bashEscape(mo.containerPath)}:${selinux_str}${(mo.readonly) ? ",readonly" : ""},consistency=${mo.consistency || "consistent"}`
  }

  protected addLabelFlags(flags: Dictionary, run_object: Dictionary)
  {
    if(run_object?.labels) {
      const keys = Object.keys(run_object.labels)
      flags["label"] = keys.map(k => `${k}=${run_object.labels[k]}`)
    }
  }

}
