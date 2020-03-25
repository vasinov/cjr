import * as fs from 'fs-extra'
import * as os from 'os'
import * as path from 'path'
import {ValidatedOutput} from '../validated-output'
import {ShellCommand} from '../shell-command'
import {JSTools} from '../js-tools'

export class FileTools
{

  static existsDir(path_str: string) // determines if directory exists
  {
    if(!path_str) return false
    return fs.existsSync(path_str) && fs.lstatSync(path_str).isDirectory()
  }

  static existsFile(path_str: string) // determines if file exists
  {
    if(!path_str) return false
    return fs.existsSync(path_str) && fs.lstatSync(path_str).isFile()
  }

  static addTrailingSeparator(path_str: string, type?:"posix"|"win32")
  {
    if(type !== undefined)
      return (path_str.endsWith(path[type].sep)) ? path_str : `${path_str}${path[type].sep}`
    else
      return (path_str.endsWith(path.sep)) ? path_str : `${path_str}${path.sep}`
  }

  static removeTrailingSeparator(path_str: string, type?:"posix"|"win32")
  {
    if(type !== undefined)
      return (path_str.length > 1 && path_str.endsWith(path[type].sep)) ? path_str.slice(0, -1) : path_str
    else
      return (path_str.length > 1 && path_str.endsWith(path.sep)) ? path_str.slice(0, -1) : path_str
  }

  // creates a temporary directory inside parent_abs_path
  static mktempDir(parent_abs_path: string, shell:ShellCommand = new ShellCommand(false, false))
  {
    fs.ensureDirSync(parent_abs_path)
    switch(os.platform())
    {
      case "darwin":
        return shell.output('mktemp', {d: {}}, [path.join(parent_abs_path, "tmp.XXXXXXXXXX")], {}, "trim")
      case "linux":
        const flags = {
          tmpdir: parent_abs_path,
          directory: {}
        }
        return shell.output('mktemp', flags, [], {}, "trim")
      default: // not thread safe
        const tmp_file_path = fs.mkdtempSync(FileTools.addTrailingSeparator(parent_abs_path)) // ensure trailing separator on path
        return new ValidatedOutput(true, tmp_file_path)
    }
  }

}
