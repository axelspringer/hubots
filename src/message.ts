import { User } from './user'

/**
 * Represents a general Message to transport
 */
export class Envelope {
  /**
   * Initializes a new instance of the <<Envelop>> class.
   * @param room A room from which a message is received
   * @param user A <<User>> instance that sent the message
   * @param message A <<Message>> instance that represents the message
   */
  constructor(public room?: string, public user?: User, public message?: Message) { }
}

/**
 * Represents an incoming message from a chat.
 */
export class Message {
  /**
   * Room where the user message came from
   */
  public room: string

  /**
   * Initializes a new instance of the <<Message>> class.
   * @param user A <<User>> instance that sent the message
   * @param done Flag for whether this message is fully processed
   */
  constructor(public user: User, public done: boolean = false) {
    this.room = user['room']
  }

  /**
   * Indicates that no other Listener should be called on this object
   * @return void
   */
  public finish() {
    this.done = true
  }

  /**
   * Place this message in an envelope
   * @returns An <<Envelope>> containing this message.
   */
  public toEnvelope(): Envelope {
    return new Envelope(this.room, this.user, this)
  }
}

/**
 * Represents an incoming message from the chat.
 */
export class TextMessage extends Message {

  /**
   * Initializes a new instance of the <<TextMessage>> class.
   * @param user A <<User>> instance that sent the message
   * @param text A String message.
   * @param id A String of the message ID.
   */
  constructor(user: User, public text: string, public id: string) {
    super(user)
  }

  /**
   * Determines if the message matches the given regex.
   *
   * @param regex A Regex to check.
   * @return A match object or null
   */
  public match(regex: string | RegExp): RegExpMatchArray {
    return this.text.match(regex)
  }

  /**
   * String representation of a TextMessage
   *
   * @return string Returns the message text
   */
  public toString(): string {
    return this.text
  }
}

/**
 * Represents an incoming user entrance notification.
 */
export class EnterMessage extends Message { }

/**
 * Represents an incoming user exit notification.
 */
export class LeaveMessage extends Message { }

/**
 * Represents an incoming topic change notification.
 */
export class TopicMessage extends TextMessage { }

/**
 * Represents a message that no matchers matched.
 */
export class CatchAllMessage extends Message {

  /**
   * Initializes a new instance of the <<CatchAllMessage>> class.
   * @param message The original <<Message>>
   */
  constructor(public message: Message) {
    super(message.user)
  }

}

