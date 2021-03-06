import { flags } from '@oclif/command'
import { StackCommand } from '../../lib/commands/stack-command'
import { Dictionary } from '../../lib/constants'
import { printResultState } from '../../lib/functions/misc-functions'

export default class Delete extends StackCommand {
  static description = 'Delete a job and its associated data; works on both running and completed jobs.'
  static args = [{name: 'id'}]
  static flags = {
    "all": flags.boolean({default: false}),
    "all-completed": flags.boolean({default: false, exclusive: ['all', 'all-running']}),
    "all-running": flags.boolean({default: false, exclusive: ['all', 'all-complete']}),
    "stacks-dir": flags.string({default: "", description: "override default stack directory"}),
    "visible-stacks": flags.string({multiple: true, description: "if specified only these stacks will be affected by this command"}),
    "no-autoload": flags.boolean({default: false, description: "prevents cli from automatically loading flags using project settings files"}),
    "verbose": flags.boolean({default: false, char: 'v', exclusive: ['quiet']}),
    "explicit": flags.boolean({default: false}),
    "quiet":flags.boolean({default: false, char: 'q'})
  }
  static strict = false;

  async run()
  {
    const { argv, flags } = this.parse(Delete)
    this.augmentFlagsWithProjectSettings(flags, {
      "visible-stacks":false,
      "stacks-dir": false
    })

    // -- get job id -----------------------------------------------------------
    const ids = await this.getJobIds(argv, flags)
    if(ids === false) return // exit if user selects empty id or exits interactive dialog

    // -- delete job -----------------------------------------------------------
    const { job_manager } = this.initContainerSDK(flags['verbose'], flags['quiet'], flags['explicit'])
    printResultState(
      job_manager.delete({
        "ids": ids,
        "selecter": this.parseSelector(flags),
        "stack-paths": this.extractVisibleStacks(flags)
      })
    )
  }

  parseSelector(flags: Dictionary) : undefined|"all"|"all-exited"|"all-running"
  {
    if(flags['all']) return "all"
    if(flags["all-exited"]) return "all-exited"
    if(flags["all-running"]) return "all-running"
    return undefined
  }

}
