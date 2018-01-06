export interface Options {
  token: string
  noRawText: boolean
  autoReconnect: boolean
  rtm: {}
  rtmStart: {}
}

export class Options {
  public rtm = {}
  public rtmStart = {}
  public noRawText = false
  public autoReconnect = false

  constructor(public token: string) { }
}
