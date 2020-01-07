import {flags} from '@oclif/command'
import {JobCommand} from '../../lib/commands/job-command'
import {ShellCMD} from '../../lib/shellcmd'
import {matchingResultIds} from '../../lib/functions/run-functions'

export default class Copy extends JobCommand {
  static description = 'Copy job results back into the host directories.'
  static args = [{name: 'id', required: true}]
  static flags = {
    stack: flags.string({env: 'STACK', default: false}),
    explicit: flags.boolean({default: false}),
    all: flags.boolean({default: false}),
  }
  static strict = true;

  async run()
  {
    const {argv, flags} = this.parse(Copy)
    const runner  = this.newRunner(
      this.settings.get("run_cmd"),
      new ShellCMD(flags['explicit'], false),
      this.settings.get("image_tag"))
    // get id and stack_path
    var id = argv[0]
    var stack_path = (flags.stack) ? this.fullStackPath(flags.stack) : ""
    // match with existing container ids
    var result = matchingResultIds(runner, stack_path, id, flags['all'])
    if(result.success)
    {
      const id = result.data[0] // only process single result
      result = this.job_json.read(id)
      if(result.success)
      {
        const job_object = result.data
        result = runner.resultCopy(id, job_object, flags["all"])
      }
    }
    this.handleErrors(result.error);
  }

}
