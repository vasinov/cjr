import {flags} from '@oclif/command'
import {RemoteCommand} from '../../lib/remote/commands/remote-command'
import {printResultState} from '../../lib/functions/misc-functions'

export default class Log extends RemoteCommand {
  static description = 'Print any output generated by a job.'
  static args = [{name: 'id'}]
  static flags = {
    remoteName: flags.string({env: 'REMOTENAME'}), // new remote flag
    //stack: flags.string({env: 'STACK'}),
    explicit: flags.boolean({default: false}),
    lines: flags.string({default: "100"})
  }
  static strict = true;

  async run()
  {
    const {flags, args, argv} = this.parseWithLoad(Log, {remoteName: true})
    this.remoteCommand("jobLog", flags, args, argv)
  }

}