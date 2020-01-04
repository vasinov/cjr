import {flags} from '@oclif/command'
import {StackCommand} from '../../lib/stack-command'

export default class Build extends StackCommand {
  static description = 'build an image'
  static args = []
  static flags = {
    stack:    flags.string({env: 'STACK', default: false}),
    explicit: flags.boolean({default: false}),
    silent:   flags.boolean({default: false}),
    nocache:  flags.boolean({default: false})
  }
  static strict = true;

  async run()
  {
    const {argv, flags} = this.parse(Build, true)
    const builder = this.newBuilder(flags.explicit, flags.silent)
    const stack_path = this.fullStackPath(flags.stack)
    const result = builder.build(stack_path, this.project_settings.configFiles, flags['nocache'])
    if(!result.success) this.handleErrors(result.error)
  }

}
