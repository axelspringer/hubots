import { Message } from '@axelspringer/hubots'

export class ReactionMessage extends Message {

  constructor(public type, public user, public reaction, public item_user, public item, public event_ts) {
    super(user)
    this.type = this.type.replace('reaction_', '')
  }
}
