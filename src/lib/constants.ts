import path = require('path')
import os = require('os')
import chalk = require('chalk')
import { JSTools } from './js-tools'

// types
export type Dictionary = { [key:string] : any }

//cli names
export const cli_name = "cjr"

// job labels
export const name_label = 'name'
export const stack_path_label = 'stack-path'
export const file_volume_label = 'filevolume'
export const project_root_label = 'project-root'
export const container_root_label = 'container-root'
export const stash_label = 'stash'
export const download_include_label = 'rsync-include'
export const download_exclude_label = 'rsync-exclude'

// flag message
// export const invalid_stack_flag_error = "specify stack flag --stack=stack or set environment variable STACK"
export const missingFlagError = (flags: Array<string>) => chalk`The following flags could not be set automatically and must be specified manually:\n{italic ${flags.map((f:string, i:number) => `${i+1}. ${f}`).join("\n")}}`

// name of files and directories in cli settings directory
export const cli_settings_yml_name = "settings"
// name of folders in data directory
export const cli_bundle_dir_name  = "bundle"  // temporarily stores data between container transfer
export const build_dirname = "build"
export const job_copy_dirname = 'job-copy'

// name of optional project settings file that is loaded relative to project project_root
export const project_settings_folder = `.${cli_name}`
export const project_settings_file   = "project-settings.yml"
export const projectSettingsDirPath  = (project_root: string) => path.join(project_root, project_settings_folder)
export const projectSettingsYMLPath  = (project_root: string) => path.join(project_root, project_settings_folder, project_settings_file)

// name of optional id file in settings folder
export const project_idfile = "project-id.json"
export const projectIDPath  = (hostRoot: string) => path.join(hostRoot, project_settings_folder, project_idfile)

// default cli options that are stored in cli settings json file
export const defaultCLISettings = (settings_dir:string) =>
{
  let driver
  let socket
  switch(os.platform())
  {
    case "darwin":
    case "win32":
      driver = "docker-cli"
      socket = "/var/run/docker.sock"
      break
    default:
      driver = "podman-cli"
      socket = "$XDG_RUNTIME_DIR/podman/podman.sock"
  }

  return {
      // cli-props
      "auto-project-root": true,
      "interactive": true,
      "stacks-dir": path.join(settings_dir, "stacks"),
      "alway-print-job-id": false,
      "autocopy-sync-job": true,
      "job-default-run-mode": "sync",
      "run-shortcuts-file": "",
      "build-driver": driver,
      "run-driver": driver,
      "image-tag": cli_name,
      "socket-path": socket,
      "job-ls-fields": 'id, stackName, command, status',
      // container props
      "container-default-shell": "bash",
      "selinux": false,
      "jupyter-command": "jupyter lab",
      "webapp": "",
  }
}

// volume rsync options
export const rsync_constants = {
  source_dir: "/rsync/source/", // note trailing slash so that contents of source are copied into dest, not folder source
  dest_dir:   "/rsync/dest",
  config_dir: "/rsync/config",
  manual_working_dir: "/rsync/",
  image: "buvoli/alpine-rsync:cjr",
  include_file_name: 'includes',
  exclude_file_name: 'excludes'
}

// relative paths of rsync config files used for stackBundle() - paths are relative to bundle root folder
export const stack_bundle_rsync_file_paths = {
  upload: {
    exclude: "upload-exclude",
    include: "upload-include"
  },
  download: {
    exclude: "download-exclude",
    include: "download-include"
  }
}

// stack run options
export const DefaultContainerRoot = "/"

// Jupyter options
export const JUPYTER_JOB_NAME = (identifier: {"job-id"?: string,"project-root"?: string}) => {
  const prefix = "JUPYTER"
  if(identifier['project-root']) return `${prefix}-${JSTools.md5(identifier['project-root'])}`
  if(identifier['job-id']) return `${prefix}-${JSTools.md5(identifier['job-id'])}`
  return `${prefix}[NONE]`;
}

// Theia options
export const THEIA_JOB_NAME = (identifier: {"project-root"?: string}) => {
  const prefix = "THEIA"
  if(identifier['project-root']) return `${prefix}-${JSTools.md5(identifier['project-root'])}`
  return `${prefix}[NONE]`;
}

// X11 options
export const X11_POSIX_BIND = "/tmp/.X11-unix"
