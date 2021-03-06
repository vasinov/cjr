import {flags} from '@oclif/command'
import {RemoteCommand} from '../../lib/remote/commands/remote-command'
import {printResultState} from '../../lib/functions/misc-functions'

export default class List extends RemoteCommand {
  static description = 'List all running and completed remote jobs.'
  static args = []
  static flags = {
    "remote-name": flags.string({env: 'REMOTENAME'}), // new remote flag
    hostRoot: flags.string({env: 'HOSTROOT'}),
    explicit: flags.boolean({default: false}),
    verbose: flags.boolean({default: false, char: 'v', description: "shows all job properties."}),
    json: flags.boolean({default: false}),
    all: flags.boolean({default: false}) //if true shows jobs from all cjr stacks, regardless of whether stack is set
  }
  static strict = true;

  async run()
  {
    const {flags, args, argv} = this.parse(List)
    this.augmentFlagsWithProjectSettings(flags, {"remote-name": true})
    this.remoteCommand("jobList", flags, args, argv)
  }

}
