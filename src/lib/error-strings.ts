import * as chalk from 'chalk'

export const ErrorStrings = {
  CONFIG:{
    NON_EXISTANT_BIND_HOSTPATH : (stackPath, hostPath) => chalk`{bold Invalid Stack Configuration} - bind mount contains nonexistant host path.\n     {italic stack}: ${stackPath}\n  {italic hostPath}: ${hostPath}`
  },
  CLI_SETTINGS:{
    INVALID_FIELD: (field) => chalk`{bold ${field} is not a valid property.}`
  },
  JOBS:{
    INVALID_ID: chalk`{bold Invalid ID} - ID string must be at least 1 character long.`,
    NO_MATCHING_ID: chalk`{bold No Matching Job ID}`
  },
  BUILD:{
    FAILED_AUTOBUILD: chalk`{bold Failed to Build Stack Image.}`
  },
  YML:{
    INVALID: (yml_error_str) => chalk`{bold Yml failed validation} - validator error shown below.\n${yml_error_str}`
  }
}

export const WarningStrings = {
  PROJECTSETTINGS:{
    INVALID_YML : (yml_path) => chalk`{bold Invalid YML} - the configuration file listed below was ignored.\n  {italic filePath}: ${yml_path}`,
    MISSING_CONFIG_FILE: (yml_path, config_path) => chalk`{bold Missing Configuration File} - a configuration file referenced in project settings yml does not exist.\n {italic yml:       } ${yml_path}\n {italic configFile}: ${config_path}`
  },
  X11:{
    FLAGUNAVALIABLE: chalk`{bold X11 flag ignored} - the X11 flag is not supported on your operating system.`,
    MISSINGDIR: (dir_path) => chalk`{bold missing X11 directory} - the directory "${dir_path}" is not present. Is X running?`,
    MACMISSINGSOCKET: (dir_path) => chalk`{bold missing X11 socket} - no socket found in directory "${dir_path}". Is XQuartz running?`,
  },
  BUNDLE:{
    INVALIDBINDPATH: (dir_path) => chalk`{bold A bind mount was removed from bundle} - to ensure the stack is repoducible on other systems, bundle only keeps bind paths that point to locations inside the stack folder.\n  {italic bind path: } ${dir_path}`,
    VOLUMEDATA: (vol_name) => chalk`{bold Volume present in configuration} - note that volume data is not preserved in bundle.\n  {italic volume}: ${vol_name}`
  }
}
