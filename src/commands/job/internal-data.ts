import {flags} from '@oclif/command'
import * as chalk from 'chalk'
import {JobCommand} from '../../lib/commands/job-command'
import {matchingJobIds, promptUserForJobId} from '../../lib/functions/run-functions'
import {printResultState} from '../../lib/functions/misc-functions'

export default class InternalData extends JobCommand {
  static description = 'Retrieve internal cli data for a job.'
  static args = [{name: 'id'}]
  static flags = {
    stack: flags.string({env: 'STACK'}),
    explicit: flags.boolean({default: false}),
    json: flags.boolean({default: false})
  }
  static strict = true;

  async run()
  {
    const {argv, flags} = this.parse(InternalData)
    const runner  = this.newRunner(flags.explicit)
    // get id and stack_path
    var stack_path = (flags.stack) ? this.fullStackPath(flags.stack) : ""
    var id = argv[0] || await promptUserForJobId(runner, stack_path, "", !this.settings.get('interactive')) || ""
    // match with existing container ids
    var result = matchingJobIds(runner, id, stack_path)
    if(result.success) result = this.job_json.read(result.data[0])
    if(result.success && flags.json) console.log(JSON.stringify(result.data))
    else if(result.success) Object.keys(result.data).map((k:string) => console.log(chalk`{italic ${k}:} ${result.data[k]}`))
    printResultState(result)
  }

}