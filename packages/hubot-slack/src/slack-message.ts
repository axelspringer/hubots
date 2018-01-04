/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { TextMessage } from '@axelspringer/hubots'

export class SlackTextMessage extends TextMessage {

  constructor(public user, public text, public rawText, public rawMessage) {
    super(user, text, rawMessage.ts)
  }

}
