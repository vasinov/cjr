import { flags} from '@oclif/command'
import { StackCommand } from '../../lib/commands/stack-command'
import { printResultState } from '../../lib/functions/misc-functions'

export default class Copy extends StackCommand {
  static description = 'Copy job files back into the host directories; works on both running and completed jobs.'
  static args = [{name: 'id', required: false}]
  static flags = {
    "copy-path": flags.string({description: "overides job default copy path"}),
    "mode": flags.string({default: "update", options: ["update", "overwrite", "mirror"], description: 'specify copy mode. "update" copies only newer files, "merge" copies all files, "mirror" copies all files and removes any extranious files'}),
    "manual": flags.boolean({default: false, description: "opens an interactive bash shell which allows the user can manually copy individual files"}),
    "stacks-dir": flags.string({default: "", description: "override default stack directory"}),
    "visible-stacks": flags.string({multiple: true, description: "if specified only these stacks will be affected by this command"}),
    "no-autoload": flags.boolean({default: false, description: "prevents cli from automatically loading flags using project settings files"}),
    "explicit": flags.boolean({default: false}),
    "verbose": flags.boolean({default: false, char: 'v', description: 'shows output from rsync', exclusive: ['quiet']}),
    "quiet":flags.boolean({default: false, char: 'q'}),
  }
  static strict = true;

  async run()
  {
    const {argv, flags} = this.parse(Copy)
    this.augmentFlagsWithProjectSettings(flags, {
      "visible-stacks":false,
      "stacks-dir": false
    })
    // -- get job ids ----------------------------------------------------------
    const ids = await this.getJobIds(argv, flags)
    if(ids === false) return // exit if user selects empty id or exits interactive dialog
    // -- copy job data --------------------------------------------------------
    const { job_manager } = this.initContainerSDK(flags["verbose"], flags["quiet"], flags["explicit"])
    const result = job_manager.copy({
      "host-path": flags["copy-path"],
      "ids": ids,
      "mode": (flags.mode as "update"|"overwrite"|"mirror"),
      "stack-paths": this.extractVisibleStacks(flags),
      "manual": flags["manual"]
    })
    // -- copy jobs ------------------------------------------------------------
    printResultState(result)
  }

}
