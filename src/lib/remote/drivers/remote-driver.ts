import { ValidatedOutput } from "../../validated-output"
import { Resource } from "../../remote/config/resource-configuration"
import { OutputOptions, CopyOptions, JobOptions } from '../compatibility'
import { ContainerDrivers, Configurations } from '../../job-managers/job-manager'
type Dictionary = {[key: string]: any}

// NOTE: DEFINE ALL REMOTE TYPES BELOW
export type RemoteDeleteOptions = {
  "ids": Array<string>,
  "delete-images": boolean,
  "delete-files": boolean
}

export type RemoteExecOptions = {
  "id": string,                   // id of job that user wants to shell/exec into
  "host-project-root": string,         // current project root (used only for setting cwd in remote container)
  "mode": "job:exec"|"job:shell"|"job:jupyter"
  "stack-upload-mode": "cached"|"uncached",
  "connect-options"?: Dictionary // any options that should be passed when starting multiplex connection
}

export type RemoteJupyterOptions = {
  "id": string,                   // id of job that user wants to shell/exec into
  "host-project-root": string,         // current project root (used only for setting cwd in remote container)
  "stack-upload-mode": "cached"|"uncached"
  "tunnel": boolean
}

export type RemoteStartOptions = {
  "auto-copy": boolean,
  "file-upload-mode": "cached"|"uncached"
  "stack-upload-mode": "cached"|"uncached"
}

export abstract class RemoteDriver
{
  protected storage_directory: string // path that can be used for tmp files
  protected output_options: OutputOptions

  constructor(output_options: OutputOptions, storage_directory: string)
  {
    this.storage_directory = storage_directory
    this.output_options = output_options
  }

  abstract jobAttach(resource: Dictionary, flags: Dictionary, args: Dictionary, argv: Array<string>): ValidatedOutput<any>;

  abstract jobCopy(resource: Dictionary, copy_options:CopyOptions): ValidatedOutput<any>;
  abstract jobDelete(resource: Dictionary, delete_options:RemoteDeleteOptions): ValidatedOutput<any>;

  abstract jobList(resource: Dictionary, flags: Dictionary, args: Dictionary, argv: Array<string>): ValidatedOutput<any>;
  abstract jobLog(resource: Dictionary, flags: Dictionary, args: Dictionary, argv: Array<string>): ValidatedOutput<any>;

  abstract jobExec(resource: Resource, local_drivers:ContainerDrivers, configurations: Configurations, job_options: JobOptions, exec_options: RemoteExecOptions): ValidatedOutput<any>;
  abstract jobStart(resource: Resource, local_drivers:ContainerDrivers, configurations: Configurations, job_options: JobOptions, remote_options:RemoteStartOptions): ValidatedOutput<any>;

  abstract jobState(resource: Dictionary, flags: Dictionary, args: Dictionary, argv: Array<string>): ValidatedOutput<any>;
  abstract jobStop(resource: Dictionary, flags: Dictionary, args: Dictionary, argv: Array<string>): ValidatedOutput<any>;

  abstract jobJupyterStart(resource: Resource, local_drivers:ContainerDrivers, configurations: Configurations, job_options: JobOptions, rjup_options: RemoteJupyterOptions):ValidatedOutput<any>
  abstract jobJupyterStop(resource: Dictionary, id: string):ValidatedOutput<any>
  abstract jobJupyterList(resource: Dictionary, id: string):ValidatedOutput<any>
  abstract jobJupyterUrl(resource: Dictionary, id: string, options: Dictionary):ValidatedOutput<any>

  abstract connect(resource: Dictionary): ValidatedOutput<any>
  abstract disconnect(resource: Dictionary): ValidatedOutput<any>
  abstract jobInfo(resource: Dictionary, state: string): ValidatedOutput<any>;
  abstract async promptUserForJobId(resource: Dictionary, interactive: boolean): Promise<string>

}
