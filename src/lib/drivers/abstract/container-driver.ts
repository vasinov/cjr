import * as path from 'path'
import {ShellCommand} from "../../shell-command"
import {StackConfiguration} from "../../config/stacks/abstract/stack-configuration"

export abstract class ContainerDriver
{

  protected shell: ShellCommand
  protected tag: string

  constructor(shell: ShellCommand, tag: string)
  {
    this.shell = shell;
    this.tag = tag;
  }

  stackName(stack_path: string)
  {
    return path.basename(stack_path)
  }

  imageName(stack_path: string)
  {
    return `${this.stackName(stack_path)}:${this.tag}`
  }

  abstract emptyConfiguration(): StackConfiguration

}
