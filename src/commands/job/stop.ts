import { flags } from '@oclif/command'
import { StackCommand } from '../../lib/commands/stack-command'
import { Dictionary } from '../../lib/constants'
import { printResultState } from '../../lib/functions/misc-functions'

export default class Stop extends StackCommand {
  static description = 'Stop a running job. This command has no effect on completed jobs.'
  static args = [{name: 'id'}]
  static flags = {
    "all": flags.boolean({default: false, description: "stop all running jobs"}),
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
    const { argv, flags } = this.parse(Stop)
    this.augmentFlagsWithProjectSettings(flags, {
      "visible-stacks":false,
      "stacks-dir": false
    })

    // -- get job id -----------------------------------------------------------
    const ids = await this.getJobIds(argv, flags, ['running'])
    if(ids === false) return // exit if user selects empty id or exits interactive dialog

    // -- stop job -------------------------------------------------------------
    const { job_manager } = this.initContainerSDK(flags['verbose'], flags['quiet'], flags['explicit'])
    printResultState(
        job_manager.stop({
        "ids": ids,
        "selecter": this.parseSelector(flags),
        "stack-paths": this.extractVisibleStacks(flags)
      })
    )
  }

  parseSelector(flags: Dictionary) : undefined|"all-running"
  {
    if(flags['all']) return "all-running"
    return undefined
  }

}
