// =============================================================================
// Curl: A class for executing sync curl requests
//  -- Functions ---------------------------------------------------------------
//  curl - generic wrapper for curl (supports only limited flags)
//  post - simplified making POST request
//  get - simplified making GET request
//  -- Example -----------------------------------------------------------------
//  curl.get({
//    url: "example/endpoint"
//    data: {a: 1, b: 2}
//  })
//  curl.post({
//    url: "example/endpoint"
//    encoding: "json"
//    data: {a: 1, b: 2}
//  })
// =============================================================================

import * as url from 'url'
import * as querystring from 'querystring'
import { ShellCommand } from './shell-command'
import { ValidatedOutput } from './validated-output'

// -- types --------------------------------------------------------------------
type Dictionary = {[key: string]: any}
export type method_types = "GET"|"POST"|"DELETE"|"PUT"|"PATCH"
export type CurlOptions = {
  "url": string,
  "unix-socket"?: string,
  "output-response-header"?: boolean,
  "method"?: method_types,
  "header"?: string,
  "body"?: string|Array<string>
  "file"?: string
}
export type RequestOptions = {
  "url": string,
  "param-encoding"?: "json"|"url",
  "encoding"?: "json"|"url"|"tar"|"gzip",
  "unix-socket"?: string,
  "params"?: any,
  "body"?: any
  "file"?: string
}
export type RequestOutput = {
  "header": {
    "code": number,
    "type": string
  },
  "body": any
}

export class Curl
{
  private shell:ShellCommand              // executes curl shell command
  private base_url: string                // base url that will be prepended to url provide
  private unix_socket: string             // unix socket that should be used for get and post requests

  private ERRORSTRINGS = {
    INVALID_JSON: "Curl response contained invalid json."
  }

  constructor(shell:ShellCommand, options?: {'base-url'?:string, 'unix-socket'?:string})
  {
    this.shell = shell;
    this.base_url = options?.['base-url'] || ""
    this.unix_socket = options?.['unix-socket'] || ""
  }

  // Generic function that wraps curl
  curl(options: CurlOptions):ValidatedOutput<string>
  {
    const command = 'curl'
    const args = [options['url']]
    const flags:Dictionary = {}

    if(options['unix-socket'])
      flags['unix-socket'] = {value: options['unix-socket'], noequals: true}
    if(options['header'])
      flags['H'] = {value: options['header'], noequals: true}
    if(options['body'])
      flags['d'] = {value: options['body'], noequals: true}
    if(options['method'])
      flags['X'] = {value: options['method'], noequals: true}
    if(options['file'])
      flags['data-binary'] = {value: `@${options['file']}`, noequals: true}
    if(options['output-response-header'])
      flags['i'] = {}

      return this.shell.output(command, flags, args, {})
  }

  // Shorthand for GET request with url or JSON data
  get(options: RequestOptions):ValidatedOutput<RequestOutput>
  {
    const result = this.curl(
      {
        "url": `${url.resolve(this.base_url, options['url'])}${this.paramsString(options)}`,
        "unix-socket": options?.["unix-socket"] || this['unix_socket'] || "",
        "output-response-header": true,
        "header": 'Content-Type: application/x-www-form-urlencoded',
        "method": 'GET'
      },
    )
    return this.processCurlOutput(result)
  }

  // Shorthand for POST request with url or JSON data
  delete(options: RequestOptions):ValidatedOutput<RequestOutput>
  {
    const result = this.curl(
      {
        "url": `${url.resolve(this.base_url, options['url'])}${this.paramsString(options)}`,
        "unix-socket": options?.["unix-socket"] || this['unix_socket'] || "",
        "output-response-header": true,
        "header": 'Content-Type: application/x-www-form-urlencoded',
        "method": 'DELETE'
      },
    )
    return this.processCurlOutput(result)
  }

  // Shorthand for url or JSON get
  post(options: RequestOptions):ValidatedOutput<RequestOutput>
  {
    let c_result: ValidatedOutput<string>
    if(options.encoding == "json") // -- json request --------------------------
      c_result = this.curl(
        this.postCurlOptions(options, 'Content-Type: application/json', JSON.stringify)
      )
    else if(options.encoding == "tar") // -- stream tar file -------------------
      c_result = this.curl(
        this.postCurlOptions(options, 'Content-Type: application/x-tar', () => "")
      )
    else if(options.encoding == "gzip") // -- stream tar file -------------------
      c_result = this.curl(
        this.postCurlOptions(options, 'Content-Type: application/x-gzip', () => "")
      )
    else // -- url request ------------------------------------------------------
      c_result = this.curl(
        this.postCurlOptions(options, 'Content-Type: application/x-www-form-urlencoded', querystring.stringify)
      )
    return this.processCurlOutput(c_result)
  }

  private paramsString(options: RequestOptions)
  {
    const has_params  = options?.['params'] != undefined;
    const dataToStr = (has_params && options['param-encoding'] == "json") ?
      (s:string) => querystring.stringify({json: JSON.stringify(s)}) :
      querystring.stringify;
    return (has_params) ? `?${dataToStr(options['params'])}` : ""
  }

  private postCurlOptions(options: RequestOptions, header: string, dataToStr:(data: any) => string):CurlOptions
  {
    return {
        "url": `${url.resolve(this.base_url, options['url'])}${this.paramsString(options)}`,
        "unix-socket": options?.["unix-socket"] || this['unix_socket'] || "",
        "header": header,
        "method": 'POST',
        "output-response-header": true,
        "body": dataToStr(options['body']),
        "file": options["file"]
      }
  }

  private processCurlOutput(result:ValidatedOutput<string>) : ValidatedOutput<RequestOutput>
  {
    const blank_output = new ValidatedOutput(false, {header: {code: NaN, type: ""}, body: ""})

    if(!result.success) return blank_output
    const raw_output:string = result.value

    // -- look for any headers: assumes headers have no blank lines ------------
    const headers_matches = [ ... raw_output.matchAll(/^HTTP\/\d.\d[\S\s]*?(?=\r\n\r\n)/gm) ] // looks for HTTP\d.d ... \r\n\r\n ; Note /m for multiline mode, and *? for non-greedy matching
    // -- only look at final header --------------------------------------------
    const index = headers_matches.length - 1 // only process last header
    const header = headers_matches?.[index]?.[0] || ""
    // -- extract remaining response as body -----------------------------------
    const header_length = header.length + (headers_matches?.[index]?.index || 0)
    const body:string = raw_output.slice(header_length)
    // -- extract response code and content type -------------------------------
    const response_code:number = parseInt(/(?<=^HTTP\/\d.\d )\d+/.exec(header)?.pop() || "") // matches X in ^HTTP\d.d X
    const content_type:string = /(?<=Content-Type:\s)\S+/.exec(header)?.pop() || "" // matches X in \nContent-Type: X
    const transfer_encoding:string = /(?<=Transfer-Encoding:\s)\S+/.exec(header)?.pop() || "" // matches X in \nTransfer-Encoding: X

    const output:RequestOutput = {
      "header": {
        "code": response_code,
        "type": content_type
      },
      "body": ""
    }

    if(content_type == 'application/json' && transfer_encoding == 'chunked')
    {
      const rows = body.split(/(?:\r\n)+/).filter((s:string) => !/^\s*$/.test(s))
      try { output.body = rows.map((s:string) => JSON.parse(s)) }
      catch(e) { return blank_output.pushError(this.ERRORSTRINGS.INVALID_JSON) }
    }
    else if(content_type == 'application/json')
    {
      try { output.body = JSON.parse(body) }
      catch(e) { return blank_output.pushError(this.ERRORSTRINGS.INVALID_JSON) }
    }
    else
      output.body = body

    return new ValidatedOutput(true, output)
  }

}
