import * as fs from 'fs'
import * as path from 'path'
import {RunDriver} from '../drivers/abstract/run-driver'
import {PathTools} from '../fileio/path-tools'
import {ValidatedOutput} from '../validated-output'
import {DefaultContainerRoot} from '../constants'
import {buildIfNonExistant} from '../functions/build-functions'
import {ErrorStrings} from '../error-strings'


function matchingIds(job_ids: array<string>, stack_path: string, id: string, all:boolean = false)
{
  if(!all && id.length < 1) return new ValidatedOutput(false, [], [ErrorStrings.JOBS.INVALID_ID])
  // find current jobs matching at least part of ID
  const re = new RegExp(`^${id}`)
  const matching_ids = (all) ? job_ids : job_ids.filter(id => re.test(id))
  return (matching_ids.length > 0) ?
    new ValidatedOutput(true, matching_ids) :
    new ValidatedOutput(false, [], [ErrorStrings.JOBS.NO_MATCHING_ID])
}

export function matchingJobIds(runner: RunDriver, stack_path: string, id: string, all:boolean = false)
{
  const image_name = (stack_path.length > 0) ? runner.imageName(stack_path) : ""
  return matchingIds(runner.jobInfo(image_name).map(x => x.id), stack_path, id, all)
}

export function matchingResultIds(runner: RunDriver, stack_path: string, id: string, all:boolean = false)
{
  const image_name = (stack_path.length > 0) ? runner.imageName(stack_path) : ""
  return matchingIds(runner.resultInfo(image_name).map(x => x.id), stack_path, id, all)
}

// determines if job with given name exists. Refactor with resultNameId
export function jobNametoID(runner: RunDriver, stack_path: string, name: string)
{
  const image_name = (stack_path.length > 0) ? runner.imageName(stack_path) : ""
  const job_info   = runner.jobInfo(image_name)
  const index      = job_info.map(x => x.names).indexOf(name)
  return (index == -1) ? false : job_info[index].id
}

// determines if result with given name exists
export function resultNametoID(runner: RunDriver, stack_path: string, name: string)
{
  const image_name = (stack_path.length > 0) ? runner.imageName(stack_path) : ""
  const result_info   = runner.resultInfo(image_name)
  const index      = result_info.map(x => x.names).indexOf(name)
  return (index == -1) ? false : result_info[index].id
}

// Get Working for container given CLI Path, hostRoot and Container ROot
export function containerWorkingDir(cli_cwd:string, hroot: string, croot: string)
{
  const hroot_arr = PathTools.split(hroot)
  const rel_path = PathTools.relativePathFromParent(
    hroot_arr,
    PathTools.split(cli_cwd))
  return (rel_path === false) ? false : [croot.replace(/\/$/, "")].concat(hroot_arr.pop(), rel_path).join("/")
}

// -----------------------------------------------------------------------------
// IFBUILDANDLOADED Calls function onSuccess if stack is build and successuffly
//  loaded. The following arguments are passed to onSuccess
//    1. configuration (Configuration) - the stack Configuration
//    2. containerRoot - the container project root folder
//    3. hostRoot (String | false) - the project hostRoot or false if non existsSync
// -- Parameters ---------------------------------------------------------------
// builder  - (BuildDriver) Object that inherits from abstract class Configuration
// flags    - (Object) command flags. The only optional propertes will affect this function are:
//              1. containerRoot
//              2. hostRoot
// stack_path - absolute path to stack folder
// overloaded_config_paths - absolute paths to any overloading configuration files
// -----------------------------------------------------------------------------
export function IfBuiltAndLoaded(builder: BuildDriver, flags: object, stack_path: string, overloaded_config_paths: array<string>, onSuccess: (configuration: Configuration, containerRoot: string, hostRoot: string) => void)
{
  var result = buildIfNonExistant(builder, stack_path, overloaded_config_paths)
  if(result.success) // -- check that image was built
  {
    result = builder.loadConfiguration(stack_path, overloaded_config_paths)
    if(result.success) // -- check that configuration passed builder requirments
    {
      var configuration = result.data
      var containerRoot = [flags?.containerRoot, configuration.getContainerRoot()]
        .concat(DefaultContainerRoot)
        .reduce((x,y) => x || y)
      var hostRoot = [flags?.hostRoot, configuration.getHostRoot()]
        .concat(false)
        .reduce((x,y) => x || y)
      var output = onSuccess(configuration, containerRoot, hostRoot)
      if(output instanceof ValidatedOutput) result = output
    }
  }
  return result
}

// -----------------------------------------------------------------------------
// ADDPORTS adds ports to a configuration as specified by a cli flag.
// This function is used by the shell and $ commands.
// -- Parameters ---------------------------------------------------------------
// configuration  - Object that inherits from abstract class Configuration
// ports          - cli flag value whith specification:
//                  flags.string({default: [], multiple: true})
// -----------------------------------------------------------------------------
export function addPorts(configuration: Configuration, ports: array<string>)
{
  var regex_a = RegExp(/^\d+:\d+$/) // flag format: --port=hostPort:containerPort
  var regex_b = RegExp(/^\d+$/)     // flag format: --port=port
  ports?.map(port_string => {
    if(regex_a.test(port_string)) {
      let p = port_string.split(':').map(e => parseInt(e))
      configuration.addPort(p[0], p[1])
    }
    else if(regex_b.test(port_string)) {
      let p = parseInt(port_string)
      configuration.addPort(p, p)
    }
  })
}

// -----------------------------------------------------------------------------
// SETRELATIVEWORKDIR alters the working dir of a configuration iff hostDir is a
// child of hostRoot. Let hostPath be a child of hostRoot, and let X be the
// relative path from hostRoot to hostDir. This functions sets these working dir
// of the container to path.join(containerRoot, X)
// -- Parameters ---------------------------------------------------------------
// configuration - Object that inherits from abstract class Configuration
// hostRoot      - Project root folder
// containerRoot - Container root folder
// hostDir       - user directory (defaults to process.cwd())
// -----------------------------------------------------------------------------
export function setRelativeWorkDir(configuration: Configuration, containerRoot: string, hostRoot: string, hostDir: string = process.cwd())
{
  if(hostRoot) {
    const ced = containerWorkingDir(process.cwd(), hostRoot, containerRoot)
    if(ced) configuration.setWorkingDir(ced)
  }
}

// -----------------------------------------------------------------------------
// BINDHOSTROOT adds a mount with type bind to a configuration that maps
// hostRoot (on host) to containerRoot (on container)
// -- Parameters ---------------------------------------------------------------
// configuration - Object that inherits from abstract class Configuration
// hostRoot      - Project root folder
// containerRoot - Container root folder
// -----------------------------------------------------------------------------
export function bindHostRoot(configuration: Configuration, containerRoot: string, hostRoot: string)
{
  if(hostRoot) {
    const hostRoot_basename = path.basename(hostRoot)
    configuration.addBind(hostRoot, path.posix.join(containerRoot, hostRoot_basename))
  }
}

// -----------------------------------------------------------------------------
// WRITEJSONJobFIle write a JSON file that contains job information (job_object)
// -- Parameters ---------------------------------------------------------------
// writer       (JSONFile) - JSONFILE object for writing to disk
// result       (ValidatedOutput) - result from runner.createJob that contains ID
// job_object   (Object) - job data
// -----------------------------------------------------------------------------
export function writeJSONJobFile(file_writer: JSONFile, result: ValidatedOutput, job_object: object)
{
  if(result.success) {
    const job_id = result.data
    file_writer.write(job_id, job_object)
  }
}

// -----------------------------------------------------------------------------
// JOBTOIMAGE creates an image from a running or completed job. If image_name is
// blank it will overwrite stack image
// -- Parameters ---------------------------------------------------------------
// runner       (RunDriver) - JSONFILE object for writing to disk
// result       (ValidatedOutput) - result from runner.createJob that contains ID
// image_name   (string) - name of new imageName
// stack_path   (string) - name of container stack
// remove_job   (boolean) - if true job is removed on exit
// -----------------------------------------------------------------------------
export function jobToImage(runner: RunDriver, result: ValidatedOutput, image_name: string, stack_path: string, remove_job: boolean = false)
{
  if(result.success) {
    const job_id = result.data
    runner.toImage(job_id, image_name, stack_path)
    if(remove_job) runner.resultDelete([job_id])
  }
}
