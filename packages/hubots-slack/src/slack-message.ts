import { TextMessage } from '@axelspringer/hubots'

export class SlackTextMessage extends TextMessage {

  constructor(public user, public text, public rawText, public rawMessage) {
    super(user, text, rawMessage.ts)
  }

}
