import { EventEmitter } from 'events';
import { User } from './user';
import { Robot } from './robot';

interface BrainData {
  users: { [name: string]: User };
  _private: { [k: string]: any };
}

/**
 * Represents somewhat persistent storage for the robot.
 */
export default class Brain extends EventEmitter {
  /**
   * The brain's data
   */
  private _data: BrainData;

  /**
   * Autosave setting
   */
  private _autoSave: boolean;

  /**
   * Autosave interval handle
   */
  private _saveInterval: NodeJS.Timer;

  /**
   * Initializes a new instance of the <<Brain>> class.
   * @param robot The <<Robot>> instance.
   */
  constructor(robot: Robot) {
    super();
    this._data = { users: {}, _private: {} };
    this._autoSave = true;
    robot.on('running', () => this.resetSaveInterval(5));
  }

  /**
   * Store key-value pair under the private namespace and extend
   * existing this._data before emitting the 'loaded' event.
   * @param key String key to store
   * @param value Value to store
   * @returns This instance for chaining
   */
  public set(key: Object): this;
  public set(key: string, value: any): this;
  public set(key: any, value?: any): this {
    let pair: Object;
    if (typeof key === typeof Object) {
      pair = key;
    } else {
      pair = {};
      pair[key] = value;
    }

    Object.assign(this._data._private, pair);
    this.emit('loaded', this._data);
    return this;
  }

  /**
   * Get value by key from the private namespace in this._data
   * or return null if not found.
   * @returns The value.
   */
  public get(key: string): any {
    return this._data._private[key] || null;
  }

  /**
   * Remove value by key from the private namespace in this._data
   * if it exists
   * @returns This instance for chaining.
   */
  public remove(key: string): this {
    if (this._data._private[key]) {
      delete this._data._private[key];
    }
    return this;
  }

  /**
   * Emits the 'save' event so that 'brain' scripts can handle
   * persisting.
   */
  public save(): void {
    this.emit('save', this._data);
  }

  /**
   * Emits the 'close' event so that 'brain' scripts can handle closing
   */
  public close(): void {
    clearInterval(this._saveInterval);
    this.save();
    this.emit('close');
  }

  /**
   * Enable or disable the automatic saving
   * @param enabled A boolean whether to autosave or not
   */
  public setAutoSave(enabled: boolean): void {
    this._autoSave = enabled;
  }

  /**
   * Reset the interval between save function calls.
   * @param seconds An integer of seconds between saves.
   */
  public resetSaveInterval(seconds: number): void {
    if (this._saveInterval) {
      clearInterval(this._saveInterval);
    }
    this._saveInterval = setInterval(() => {
      if (this._autoSave) {
        this.save();
      }
    }, seconds * 1000);
  }

  /**
   * Merge keys loaded from a DB against the in memory representation.
   * Caveats: Deeply nested structures don't merge well.
   */
  public mergeData(data: Object = {}): void {
    Object.assign(this._data, data);
    this.emit('loaded', this._data);
  }

  /**
   * Get an array of <<User>> objects stored in the brain.
   * @returns An array of <<User>> objects.
   */
  public users(): { [name: string]: User } {
    return this._data.users;
  }

  /**
   * Get a <<User>> object given a unique identifier.
   * @returns A <<User>> instance of the specified user.
   */
  public userForId(id: string, options?: { [k: string]: string }): User {
    let user = this._data.users[id];
    if (!user ||
      (options && options['room'] &&
        (!user['room'] || user['room'] !== options['room']))) {
      user = new User(id, options);
      this._data.users[id] = user;
    }

    return user;
  }

  /**
   * Get a <<User>> object given a name.
   * @returns A <<User>> instance for the user with the specified name.
   */
  public userForName(name: string): User {
    return Object
      .keys(this._data.users)
      .map((k) => this._data.users[k])
      .find((u) => u.name.toLowerCase().startsWith(name.toLowerCase()));
  }

  /**
   * Get all users whose names match fuzzyName. Currently, match
   * means 'startsWith'
   * @returns An array of <<User>> instance matching the fuzzy name.
   */
  public usersForRawFuzzyName(fuzzyName: string): User[] {
    return Object
      .keys(this._data.users)
      .map((k) => this._data.users[k])
      .filter((u) => u.name.toLowerCase().startsWith(fuzzyName.toLowerCase()));
  }

  /**
   * If fuzzyName is an exact match for a user, returns an array with
   * just that user. Otherwise, returns an array of all users for which
   * fuzzyName is a raw fuzzy match (see usersForRawFuzzyName)
   * @returns An array of <<User>> instances matching the fuzzy name.
   */
  public usersForFuzzyName(fuzzyName: string): User[] {
    let matchedUsers = this.usersForRawFuzzyName(fuzzyName);
    let perfectMatch = matchedUsers.find((u) => u.name.toLowerCase() === fuzzyName.toLowerCase());
    if (perfectMatch) {
      return [perfectMatch];
    } else {
      return matchedUsers;
    }
  }
}
