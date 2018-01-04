/**
 * Represents a participating user in the chat.
 */
export class User {
  /**
   * The user's name
   */
  public name: string

  /**
   * Initializes a new instance of the <<User>> class.
   * @param id A unique ID for the user.
   * @param options An optional Hash of key, value pairs for this user.
   */
  constructor(public id: any, options: { [key: string]: string } = {}) {
    for (let key in options) {
      this[key] = options[key]
    }
    this.name = this.name || this.id.toString()
  }
}
