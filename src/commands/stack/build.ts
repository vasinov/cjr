import {flags} from '@oclif/command'
import {StackCommand} from '../../lib/commands/stack-command'
import {JSTools} from '../../lib/js-tools'
import {buildAndLoad} from '../../lib/functions/build-functions'
import {printResultState} from '../../lib/functions/misc-functions'

export default class Build extends StackCommand {
  static description = 'Manually build images for one or more stacks.'
  static args = [{name: 'stack'}]
  static flags = {
    stack: flags.string({env: 'STACK', multiple: true}),
    "config-files": flags.string({default: [], multiple: true, description: "additional configuration file to override stack configuration"}),
    explicit: flags.boolean({default: false}),
    silent: flags.boolean({default: false}),
    "no-cache": flags.boolean({default: false}),
    "pull": flags.boolean({default: false}),
    "stacks-dir": flags.string({default: "", description: "override default stack directory"})
  }
  static strict = false;

  async run()
  {
    const {argv, flags} = this.parse(Build)
    this.augmentFlagsWithProjectSettings(flags, {stack:false, "config-files": false, "stacks-dir": true})
    const stack_list = (argv.length > 0) ? argv : (JSTools.arrayWrap(flags.stack) || []) // add arrayWrap since parseWithLoad will return scalar
    const builder = this.newBuilder(flags.explicit, flags.silent)
    stack_list.map((stack_name:string) => {
      printResultState(
        buildAndLoad(
          builder,
          {"no-cache": flags['no-cache'], "pull": flags['pull']},
          this.fullStackPath(stack_name, flags["stacks-dir"]),
          flags['config-files']
        )
      )
    });
  }

}
