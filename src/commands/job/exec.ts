import {flags} from '@oclif/command'
import {StackCommand} from '../../lib/stack-command'
import {ShellCMD} from '../../lib/shellcmd'
import {matchingJobIds} from '../../lib/drivers/run/functions'

export default class Exec extends StackCommand {
  static description = 'attach back to the shell that is running a job.'
  static args = [{name: 'id', required: true}, {name: 'command', required: true}]
  static flags = {
    stack: flags.string({env: 'STACK', default: false}),
    explicit: flags.boolean({default: false}),
    async: flags.boolean({default: false})
  }
  static strict = false;

  async run()
  {
    const {argv, flags} = this.parse(Exec)
    const runner  = this.newRunner(flags.explicit)
    // get id and stack_path
    var id = argv[0]
    var stack_path = (flags.stack) ? this.fullStackPath(flags.stack) : ""
    // match with existing container ids
    var result = matchingJobIds(runner, stack_path, id, false)
    if(result.success)
    {
        const command = argv.slice(1, argv.length).join(" ")
        const exec_object = {
          detached: flags.async,
          interactive: true // enable interactive for bash command
        }
        runner.jobExec(result.data[0], command, exec_object)
    }
    this.handleErrors(result.error);
  }

}
