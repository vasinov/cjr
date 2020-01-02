// =============================================================================
// ShellCMD: A class for launching sync and async commands
// Description: All class functions have identical calling sequence
//  command: string       - base commands
//  args: array<string>   - strings of arguments
//  flags: object         - keys are flag names and entries must have structure
//                            {value: string or [], shorthand: boolean, santitize ? boolean}
//                          if shorthand = true flag coorespond to
//                              -key=value or -key=value[1] -key=value[3]
//                          if shorhand = false then
//                              --key=value or -key=value[0] -key=value[1] ...
// =============================================================================

import {spawn, spawnSync} from 'child_process'
import {quote} from 'shell-quote'
import {ValidatedOutput} from './validated-output'

export class ShellCMD
{
    _explicit: boolean; // if true then
    _silent: boolean; // if true then no output will be shown and std_out will not be attached

    constructor(explicit: boolean, silent: boolean)
    {
      this._explicit = explicit;
      this._silent = silent;
    }

    // Launches a syncronous command. Defaults to in a shell, which either stdio inherit or ignore

    sync(command: string, flags: object, args: array<string>, options:object = {})
    {
      var default_options = {stdio : 'inherit', shell: true}
      options = {... default_options, ...options};
      if(this._silent) options.stdio = 'ignore';
      this.printCMD(command, flags, args, true, options);
      return spawnSync(this.cmdString(command, flags, args), [], options)
    }

    // Launches a syncronous command in a shell and returns output string

    output(command: string, flags: object, args: array<string>, options:object = {}, format="")
    {
      var default_options = {stdio : 'pipe', shell: true, encoding: 'buffer'}
      options = {... default_options, ...options};
      this.printCMD(command, flags, args, true, options);
      var child_process = spawnSync(this.cmdString(command, flags, args), [], options)
      var result = new ValidatedOutput();
      result.success = child_process.status == 0;
      result.data = child_process?.stdout?.toString('ascii')
      if(result.success && format === "json")
      {
        try
        {
          result.data = JSON.parse(result.data);
        }
        catch(e)
        {
          result.success = false;
          result.data = [];
        }
      }
      else if(result.success && format === "line_json")
      {
        try
        {
          result.data = result.data.split("\n").filter(e => e !== "").map(e => JSON.parse(e));
        }
        catch(e)
        {
          result.success = false;
          result.data = [];
        }
      }


      return result;
    }

    async(command: string, flags: object, args: array<string>, options:object = {})
    {
      var default_options = {stdio : 'ignore'}
      options = {... default_options, ...options};
      if(this._silent) options.stdio = 'ignore';
      this.printCMD(command, flags, args, false, options);
    }

    private cmdString(command: string, flags: object, args: array<string>)
    {
      const arrayWrap = (x) => (x instanceof Array) ? x : [x]
      const flagString = function(value, flag, shorthand, sanitize_flag) // produces string for command flag with value
      {
        const v_str = (value !== undefined) ? `=${(sanitize_flag) ? quote([value]) : value}` : ""
        return (shorthand) ? ` -${flag}${v_str}` : ` --${flag}${v_str}`;
      }

      var cmdstr = command
      for(let key in flags) {
        let props = flags[key]
        let str_arr = arrayWrap(props.value).map(
          v => flagString(v, key, props?.shorthand, ('sanitize' in props) ? props.sanitize : true))
        cmdstr += str_arr.join(" ")
      }
      return cmdstr + " " + args.join(" ");
    }

    private printCMD(command: string, flags: object, args: array<string>, sync: boolean, options: object)
    {
      if(this._explicit && !this._silent)
      {
        var header = (sync) ?
        "=".repeat(38) + " SYNC " + "=".repeat(38) :
        "=".repeat(37) + " A-SYNC " + "=".repeat(37);

        console.log(header)
        console.log("command:\n\t" + command)
        console.log("flags:")
        for (let key in flags) {
          var value = ('value' in flags[key]) ? "=" + flags[key].value : "";
          console.log("\t" + key + value)
        }
        console.log("args:")
        args.forEach(a => console.log("\t" + a))
        console.log("command string:")
        console.log("\t" + this.cmdString(command, flags, args))
        console.log("options:", options)
        console.log("=".repeat(36) + " Output " + "=".repeat(36))
      }
    }
}
