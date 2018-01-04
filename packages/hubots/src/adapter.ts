import { EventEmitter } from 'events'
import { Message, Envelope } from './message'
import { Robot } from './robot'

/**
 * An adapter is a specific interface to a chat source for robots.
 */
export abstract class Adapter extends EventEmitter {
  /**
   * Initializes a new instance of the <<Adapter>> class.
   * @param robot A robot instance
   */
  constructor(protected robot: Robot) {
    super()
  }

  /**
   * Raw method for sending data back to the chat source.
   * @param envelope An object with message, room, and user details
   * @param strings One or more strings for each message to send
   */
  public abstract send(envelope: Envelope, ...strings: string[]): void

  /**
   * Raw method for building a reply and sending it back to the chat source.
   * @param envelope An object with message, room, and user details
   * @param strings One or more strings for each message to send
   */
  public abstract reply(envelope: Envelope, ...strings: string[]): void

  /**
   * Raw method for invoking bot to run.
   */
  public abstract run(): void

  /**
   * Raw method for shutting the bot down.
   */
  public abstract close(): void

  /**
   * Raw method for setting a topic on the chat source.
   * @param envelope An object with message, room, and user details
   * @param strings One or more strings for each message to send
   */
  public topic(envelope: Envelope, ...strings: string[]): void {
    console.log(envelope, strings)
  }

  /**
   * Raw method for playing a sound in the chat source.
   * @param envelope An object with message, room, and user details
   * @param strings One or more strings for each message to send
   */
  public play(envelope: Envelope, ...strings: string[]): void {
    console.log(envelope, strings)
  }

  /**
   * Raw method for sending emote data back to the chat source. Defaults as an alias for send
   * @param envelope A object with message, room, and user details
   * @param strings One or more strings for each message to send
   */
  public emote(envelope: Envelope, ...strings: string[]): void {
    this.send(envelope, ...strings)
  }

  /**
   * Dispatch a received message to the robot.
   */
  public receive(message: Message): Promise<void> {
    return this.robot.receive(message)
  }
}
