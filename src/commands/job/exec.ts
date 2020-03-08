import {flags} from '@oclif/command'
import {StackCommand, Dictionary} from '../../lib/commands/stack-command'
import {jobExec, promptUserForJobId, ContainerRuntime, JobOptions, OutputOptions} from '../../lib/functions/run-functions'
import {RunShortcuts} from "../../lib/config/run-shortcuts/run-shortcuts"
import {printResultState} from '../../lib/functions/misc-functions'

export default class Shell extends StackCommand {
  static description = 'Start an interactive shell to view the files created or modified by a job'
  static args = [{name: 'id', required: true}, {name: 'command', required: true}]
  static flags = {
    stack: flags.string({env: 'STACK'}),
    "config-files": flags.string({default: [], multiple: true, description: "additional configuration file to override stack configuration"}),
    port: flags.string({default: [], multiple: true}),
    x11: flags.boolean({default: false}),
    explicit: flags.boolean({default: false})
  }
  static strict = false;

  async run()
  {
    const {args, argv, flags} = this.parseWithLoad(Shell, {stack:false, "config-files": false})
    const stack_path = this.fullStackPath(flags.stack)
    const run_shortcut = new RunShortcuts()
    // -- set container runtime options ----------------------------------------
    const runtime_options:ContainerRuntime = {
      builder: this.newBuilder(flags.explicit),
      runner:  this.newRunner(flags.explicit)
    }
    // -- get job id -----------------------------------------------------------
    const id_str = argv[0]
    const command = run_shortcut.apply(argv.splice(1)).join(" ")
    // -- set job options ------------------------------------------------------
    var job_options:JobOptions = {
      "stack-path":   stack_path,
      "config-files": flags["config-files"],
      "build-mode":   "no-rebuild",
      "command":      command,
      "cwd":          process.cwd(),
      "file-access":  "volume",
      "synchronous":  true,
      "x11":          flags.x11,
      "ports":        this.parsePortFlag(flags.port),
      "remove":       false
    }
    // -- set output options ---------------------------------------------------
    const output_options:OutputOptions = {
      verbose:  false,
      silent:   false,
      explicit: flags.explicit
    }
    printResultState(jobExec(runtime_options, id_str, job_options, output_options))
  }
}
