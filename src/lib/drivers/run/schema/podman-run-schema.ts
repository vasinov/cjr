// Special Schema for podman RUN command that adds specific options for podman

import * as Ajv from 'ajv'
import {docker_configuration_schema} from '../../config/docker-configuration-schema'

export const podman_run_schema = {
  "$id": "docker-run.json",
  "title": "Docker Run Configuration",
  "description": "Used internally by DockerRunDriver in run command",
  "type": "object",
  "properties": {
    "mounts": {"$ref": "docker-configuration-schema.json#/definitions/mounts"},
    "ports": {"$ref": "docker-configuration-schema.json#/definitions/ports"},
    "wd": {"type": "string"},
    "detached": {"type": "boolean"},
    "interactive": {"type": "boolean"},
    "remove": {"type": "boolean"},
    "name": {"type": "string"},
    "podman": {"$ref": "#/definitions/podman"}
  },
  "definitions": {
      "podman" : {
        "type": "object",
        "properties": {
          "userns" : {
            "type": "string",
            "pattern": "^(host)|(keep-id)$"
          }
        }
      }
  }
}

// create new Ajv validator for docker_run_schema
var ajv = new Ajv({schemas: [podman_run_schema, docker_configuration_schema]})
export const pr_ajv_validator = ajv.getSchema(podman_run_schema["$id"])
