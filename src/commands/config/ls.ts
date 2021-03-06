import chalk = require('chalk');
import { flags } from '@oclif/command'
import { StackCommand } from '../../lib/commands/stack-command'

export default class List extends StackCommand {
  static description = 'List all cli parameters and data directories.'
  static flags = {
    "json": flags.boolean({default: false}),
  }
  static strict = true;


  async run() {
    const {flags} = this.parse(List)
    const raw_data = this.settings.getRawData()
    if(flags.json) // -- json output -------------------------------------------
    {
      console.log(JSON.stringify(raw_data))
    }
    else // -- standard output -------------------------------------------------
    {
      this.log(chalk`\n-- {bold CLI Settings} -----------------------------\n`)
      Object.keys(raw_data).sort().map((key:string) => {
          console.log(chalk`   {italic ${key}}: {green ${raw_data[key]}}`)
      })
      this.log(chalk`\n-- {bold CLI Data Path:} contains temporary data ----\n\n   ${this.config.dataDir}`)
      this.log(chalk`\n-- {bold CLI Config Path:} contains settings files -----\n\n   ${this.config.configDir}`, '\n')
    }
  }
}
