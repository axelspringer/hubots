/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { TextMessage } from '@axelspringer/hubots'

export class SlackTextMessage extends TextMessage {
  // Represents a TextMessage created from the Slack adapter
  //
  // user       - The User object
  // text       - The parsed message text
  // rawText    - The unparsed message text
  // rawMessage - The Slack Message object
  constructor(user, text, rawText, rawMessage) {
    {
      // Hack: trick Babel/TypeScript into allowing this before super.
      if (false) { super() }
      let thisFn = (() => { this }).toString()
      let thisName = thisFn.slice(thisFn.indexOf('{') + 1, thisFn.indexOf('')).trim()
      eval(`${thisName} = this`)
    }
    this.user = user
    this.text = text
    this.rawText = rawText
    this.rawMessage = rawMessage
    super(this.user, this.text, this.rawMessage.ts)
  }
}
