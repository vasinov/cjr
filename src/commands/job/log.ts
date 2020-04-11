import {flags} from '@oclif/command'
import {StackCommand} from '../../lib/commands/stack-command'
import {matchingJobIds, promptUserForJobId} from '../../lib/functions/run-functions'
import {printResultState} from '../../lib/functions/misc-functions'

export default class Log extends StackCommand {
  static description = 'Print any output generated by a job.'
  static args = [{name: 'id'}]
  static flags = {
    lines: flags.string({default: "100"}),
    "stacks-dir": flags.string({default: "", description: "override default stack directory"}),
    "visible-stacks": flags.string({default: [""], multiple: true, description: "if specified only these stacks will be affected by this command"}),
    "no-autoload": flags.boolean({default: false, description: "prevents cli from automatically loading flags using project settings files"}),
    explicit: flags.boolean({default: false})
  }
  static strict = true;

  async run()
  {
    const {argv, flags} = this.parse(Log)
    this.augmentFlagsWithProjectSettings(flags, {"visible-stacks":false, "stacks-dir": false})
    const runner = this.newRunner(flags.explicit)
    // get id and stack_path
    var stack_paths = flags['visible-stacks'].map((stack:string) => this.fullStackPath(stack, flags["stacks-dir"]))
    var id = argv[0] || await promptUserForJobId(runner, stack_paths, [], !this.settings.get('interactive')) || ""
    if(id === "") return // exit if user selects empty
    // match with existing container ids
    var result = matchingJobIds(runner, [id], stack_paths)
    if(result.success)runner.jobLog(result.data[0], flags.lines)
    printResultState(result)
  }

}
