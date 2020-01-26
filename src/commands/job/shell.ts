import * as path from 'path'
import * as fs from 'fs-extra'
import {flags} from '@oclif/command'
import {JobCommand} from '../../lib/commands/job-command'
import {matchingResultIds} from '../../lib/functions/run-functions'
import {cli_storage_dir_name} from '../../lib/constants'
import {JSTools} from '../../lib/js-tools'
import {ErrorStrings} from '../../lib/error-strings'
import {IfBuiltAndLoaded, promptUserForJobId, matchingJobInfo, writeJSONJobFile} from '../../lib/functions/run-functions'
import {printResultState} from '../../lib/functions/misc-functions'

export default class Shell extends JobCommand {
  static description = 'Start a shell inside a result. After exiting the changes will be stored as a new result'
  static args = [{name: 'id', required: false}]
  static flags = {
    stack: flags.string({env: 'STACK'}),
    hostRoot: flags.string({env: 'HOSTROOT'}),
    explicit: flags.boolean({default: false}),
    discard: flags.boolean({default: false})
  }
  static strict = true;

  // The result:shell function is currently implemented by the CLI as follows:
  // 1. load original job parameters (original_job)
  // 2. choose a temporary location to store results (tmp_directory)
  // 3. copy all results from job into temporary directory
  // 4. spawn a new job that overloads the following parameters
  //     hostRoot:  tmp_directory
  //     command: bash
  //     synchronous: false
  //     remove: flags.discard
  // 5. start the bash job detached. Then empty the temporary tmp_directory
  // 6. attach to new job.
  // REMARK: an alternative approach is to add a resultShell command to abstract
  // runDriver. For Docker/Podman one can commit the container to an image, then
  // start a new job from this image. There are three drawbacks to this:
  //    - commit seems to work very slowly (1-2min) for large images (10GB)
  //    - podman does not reconize the new image as an ancestor of the original
  //      therefore it does not show up with podman ps --filter ancestor=
  //    - runDriver currently does not create or delete job files. This is
  //      currently done within the cli commands. this logic should be moved
  //      into the rundriver. if this alternative approach is implemented.

  async run()
  {
    const {argv, flags} = this.parse(Shell)
    const builder  = this.newBuilder(flags.explicit)
    const runner  = this.newRunner(flags.explicit)
    var id_str = argv[0] || await promptUserForJobId(runner, "", "", !this.settings.get('interactive')) || ""
    // -- determine if there is a job with a matching id -----------------------
    var result = matchingJobInfo(runner, id_str, "")
    if(!result.success) return printResultState(result) // exit if no matching job
    const job_info = result.data[0] // process only first result
    const job_id   = job_info.id;

    if(job_info.status == "running") // == RUNNING JOB =========================
    {
      const exec_object = {
        detached: false,
        interactive: true
      }
      runner.jobExec(job_id, this.settings.get("default_shell"), exec_object)
    }
    else if(job_info.status == "exited" || job_info.status == "created") // == EXITED JOB ======================
    {
      // -- select stack (you can shell into result with new stack) ------------
      let stack_path
      if(flags.stack)
        stack_path =  this.fullStackPath(flags.stack)
      else if(job_info?.stack)
        stack_path =  this.fullStackPath(job_info.stack)
      else
      {
        result.pushError(ErrorString.JOBSHELL.NOSTACK)
        return printResultState(result)
      }
      // 0. read job json ------------------------------------------------------
      result = this.job_json.read(job_id)
      if(!result.success) return printResultState(result)
      // 1. load original job parameters ---------------------------------------
      const old_job_object = result.data
      // 2. choose temporary location for result files -------------------------
      const tmp_storage_path = path.join(this.config.dataDir, cli_storage_dir_name, job_id) || "/UP8YSP9NHP/CADJCZ5UAQ/FNF7QB6P31/NXXAMCNI3H" // extra protection to prevent entry from ever being blank.
      var   tmp_host_root = ""
      // 3. copy result data to temporary location -----------------------------
      if(old_job_object.hostRoot) {
        tmp_host_root = path.join(tmp_storage_path, path.basename(old_job_object.hostRoot))
        const temp_job_object = JSTools.rMerge(JSTools.rCopy(old_job_object), {
          hostRoot: tmp_host_root
        })
        fs.ensureDirSync(temp_job_object.hostRoot)
        result = runner.resultCopy(job_id, temp_job_object, true)
      }
      // 4. start new job ------------------------------------------------------
      var new_job_id = false
      if(result.success)
      {
        const new_job_object = JSTools.rMerge(JSTools.rCopy(old_job_object), {
          command: this.settings.get("default_shell"),
          synchronous: false,
          remove: flags.discard
        })
        if(old_job_object.hostRoot) new_job_object.hostRoot = tmp_host_root
        var result = IfBuiltAndLoaded(builder, flags, stack_path, this.project_settings.configFiles,
          (configuration) => {
            var result = runner.jobStart(stack_path, new_job_object, configuration.runObject())
            writeJSONJobFile(this.job_json, result, new_job_object)
            if(result.success) new_job_id = result.data
          })
      }
      // 5. remove temp dir --------------------------------------------------
      if(old_job_object.hostRoot && tmp_storage_path != "/") {
          fs.removeSync(tmp_storage_path)
      }
      // 6. attach to job ----------------------------------------------------
      if(new_job_id) runner.jobAttach(new_job_id)

    }
    printResultState(result)
  }

}