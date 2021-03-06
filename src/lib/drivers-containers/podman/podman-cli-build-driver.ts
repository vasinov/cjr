import { DockerCliBuildDriver } from '../docker/docker-cli-build-driver'
import { parseJSON } from '../../functions/misc-functions'
import { DockerStackConfiguration } from '../../config/stacks/docker/docker-stack-configuration'
import { Dictionary } from '../../constants'

export class PodmanCliBuildDriver extends DockerCliBuildDriver
{
    protected base_command = 'podman'
    protected outputParser = parseJSON

    isBuilt(configuration:DockerStackConfiguration) : boolean
    {
      const image_name = configuration.getImage()
      const command = `${this.base_command} images`;
      const args:Array<string> = []
      const flags:Dictionary = {
        filter: `reference=${image_name}`
      }
      this.addJSONFormatFlag(flags);
      var result = this.outputParser(this.shell.output(command, flags, args, {}))
      if(!result.success) return false
      // extra logic since podman images --reference=name:tag is equivalent to docker images --reference=*name:tag
      if(image_name.indexOf("/") !== -1 && result.value?.length > 0)
        return true // if image name contains / assume full name was found
      else
        return result.value?.some((image_data:Dictionary) =>
          image_data?.names?.some((name: string) =>
            (new RegExp(`/${image_name}$`))?.test(name))) || false
    }

    protected addJSONFormatFlag(flags: Dictionary)
    {
      flags["format"] = {shorthand: false, value: 'json'}
      return flags
    }

}
