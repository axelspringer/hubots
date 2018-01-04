/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { Adapter, TextMessage, EnterMessage, LeaveMessage, TopicMessage, CatchAllMessage, Robot } from '@axelspringer/hubots'

import { SlackClient } from './client'
import { ReactionMessage } from './reaction-message'
import { SlackTextMessage } from './slack-message'
import { Options } from './options'

// Public: Adds a Listener for ReactionMessages with the provided matcher,
// options, and callback
//
// matcher  - A Function that determines whether to call the callback.
//            Expected to return a truthy value if the callback should be
//            executed (optional).
// options  - An Object of additional parameters keyed on extension name
//            (optional).
// callback - A Function that is called with a Response object if the
//            matcher function returns true.
//
// Returns nothing.
Robot.prototype.react = function (matcher, options, callback) {
  let matchReaction = msg => msg instanceof ReactionMessage

  if (arguments.length === 1) {
    return this.listen(matchReaction, matcher)

  } else if (matcher instanceof Function) {
    matchReaction = msg => msg instanceof ReactionMessage && matcher(msg)

  } else {
    callback = options
    options = matcher
  }

  return this.listen(matchReaction, options, callback)
}

export class SlackBot extends Adapter {

  public client: SlackClient
  public isLoaded = false
  public self: any

  constructor(public robot, public options: Options) {
    super(robot)
    this.client = new SlackClient(robot, options)
  }

  /*
  Slackbot loads full user list on the first brain load
  QUESTION: why do brain adapters trigger a brain 'loaded' event each time a key
  is set?
  */
  public setIsLoaded(isLoaded) {
    this.isLoaded = isLoaded
  }

  /*
  Slackbot initialization
  */
  public run() {


    // let needle
    // if (!this.options.token) { return this.robot.logger.error("No service token provided to Hubot") }
    // if ((needle = this.options.token.substring(0, 5), !['xoxb-', 'xoxp-'].includes(needle))) { return this.robot.logger.error("Invalid service token provided, please follow the upgrade instructions") }

    // Setup client event handlers
    this.client.rtm.on('open', this.open.bind(this))
    this.client.rtm.on('close', this.close.bind(this))
    this.client.rtm.on('error', this.error.bind(this))
    this.client.rtm.on('reaction_added', this.reaction.bind(this))
    this.client.rtm.on('reaction_removed', this.reaction.bind(this))
    this.client.rtm.on('authenticated', this.authenticated.bind(this))
    this.client.rtm.on('user_change', this.userChange.bind(this))

    this.client.loadUsers(this.loadUsers.bind(this))
    this.client.onMessage(this.message.bind(this))

    this.robot.brain.on('loaded', () => {
      if (!this.isLoaded) {
        this.client.loadUsers(this.loadUsers)
        return this.setIsLoaded(true)
      }
    })


    // Start logging in
    return this.client.connect()
  }


  /*
  Slack client has opened the connection
  */
  public open(): void {
    this.robot.logger.info('Slack client now connected')

    // Tell Hubot we're connected so it can load scripts
    return this['emit']('connected')
  }


  /*
  Slack client has authenticated
  */
  public authenticated(identity) {
    const { self, team } = identity

    // console.log(identity)
    // let team
    // ({ self: this.self, team } = identity)

    // // Find out bot_id
    // for (let user of Array.from(identity.users)) {
    //   if (user['id'] === this.self.id) {
    //     this.self.bot_id = user['profile'].bot_id
    //     break
    //   }
    // }

    // Provide our name to Hubot
    this.robot.name = self.name
    this.self = self

    return this.robot.logger.info(`Logged in as ${this.robot.name} of ${team.name}`)
  }


  /*
  Slack client has closed the connection
  */
  public close() {
    // NOTE: not confident that @options.autoReconnect has intended effect as currently implemented
    if (this.options.autoReconnect) {
      return this.robot.logger.info('Slack client closed, waiting for reconnect')
    } else {
      this.robot.logger.info('Slack client connection was closed, exiting hubot process')
      this.client.disconnect()
      return process.exit(1)
    }
  }


  /*
  Slack client received an error
  */
  public error(error) {
    if (error.code === -1) {
      return this.robot.logger.warning(`Received rate limiting error ${JSON.stringify(error)}`)
    }

    return this.robot.emit('error', error)
  }


  /*
  Hubot is sending a message to Slack
  */
  public send(envelope, ...messages) {
    const sent_messages = []
    for (let message of Array.from(messages)) {
      if (message !== '') {
        sent_messages.push(this.client.send(envelope, message))
      }
    }
    return sent_messages
  }


  /*
  Hubot is replying to a Slack message
  */
  public reply(envelope, ...messages) {
    const sent_messages = []
    for (let message of Array.from(messages)) {
      if (message !== '') {
        if (envelope.room[0] !== 'D') { message = `<@${envelope.user.id}>: ${message}` }
        this.robot.logger.debug(`Sending to ${envelope.room}: ${message}`)
        sent_messages.push(this.client.send(envelope, message))
      }
    }
    return sent_messages
  }


  /*
  Hubot is setting the Slack channel topic
  */
  public setTopic(envelope, ...strings) {
    if (envelope.room[0] === 'D') { return } // ignore DMs

    return this.client.setTopic(envelope.room, strings.join("\n"))
  }


  /*
  Message received from Slack
  */
  public message(message) {
    let textMessage
    let { text, rawText, returnRawText, user, channel, subtype, topic, bot } = message

    if (user && (user.id === this.self.id)) { return } // Ignore anything we sent, or anything from an unknown user
    if (bot && (bot.id === this.self.bot_id)) { return } // Ignore anything we sent, or anything from an unknown bot

    subtype = subtype || 'message'

    // Hubot expects this format for TextMessage Listener
    if (!user) { user = bot }
    if (!user) { user = {} }
    user.room = channel.id

    // Direct messages
    if (channel.id[0] === 'D') {
      text = `${this.robot.name} ${text}`     // If this is a DM, pretend it was addressed to us
      if (channel.name == null) { channel.name = channel._modelName }  // give the channel a name
    }

    // Send to Hubot based on message type
    switch (subtype) {

      case 'message':
      case 'bot_message':
        this.robot.logger.debug(`Received message: '${text}' in channel: ${channel.name}, from: ${user.name}`)
        if (returnRawText) {
          textMessage = new SlackTextMessage(user, text, rawText, message)
        } else {
          textMessage = new TextMessage(user, text, message.ts)
        }
        textMessage.thread_ts = message.thread_ts
        return this.robot.receive(textMessage)

      case 'channel_join':
      case 'group_join':
        this.robot.logger.debug(`${user.name} has joined ${channel.name}`)
        return this.robot.receive(new EnterMessage(user))

      case 'channel_leave':
      case 'group_leave':
        this.robot.logger.debug(`${user.name} has left ${channel.name}`)
        return this.robot.receive(new LeaveMessage(user))

      case 'channel_topic':
      case 'group_topic':
        this.robot.logger.debug(`${user.name} set the topic in ${channel.name} to ${topic}`)
        return this.robot.receive(new TopicMessage(user, message.topic, message.ts))

      default:
        this.robot.logger.debug(`Received message: '${text}' in channel: ${channel.name}, subtype: ${subtype}`)
        message.user = user
        return this.robot.receive(new CatchAllMessage(message))
    }
  }

  /*
  Reaction added/removed event received from Slack
  */
  public reaction(message) {
    let { type, user, reaction, item_user, item, event_ts } = message
    if ((user === this.self.id) || (user === this.self.bot_id)) { return } //Ignore anything we sent

    user = this.client.rtm.dataStore.getUserById(user)
    item_user = this.client.rtm.dataStore.getUserById(item_user)
    if (!user || !item_user) { return }

    user.room = item.channel
    return this.robot.receive(new ReactionMessage(type, user, reaction, item_user, item, event_ts))
  }

  public loadUsers(err, res) {
    if (err || !res.ok) {
      this.robot.logger.error("Can't fetch users")
      return
    }

    return Array.from(res.members).map((member) => this.userChange(member))
  }

  // when invoked as an event handler, this method takes an event. but when invoked from loadUsers,
  // this method takes a user
  public userChange(event_or_user) {
    let value
    if (!event_or_user) { return }
    const user = event_or_user.type === 'user_change' ? event_or_user.user : event_or_user
    const newUser = {
      id: user.id,
      name: user.name,
      real_name: user.real_name,
      slack: {}
    }
    if (user.profile && user.profile.email) { newUser['email_address'] = user.profile.email }
    for (var key in user) {
      // don't store the SlackClient, because it'd cause a circular reference
      // (it contains users and channels), and because it has sensitive information like the token
      value = user[key]
      if (value instanceof SlackClient) { continue }
      newUser.slack[key] = value
    }

    if (user.id in this.robot.brain.data.users) {
      for (key in this.robot.brain.data.users[user.id]) {
        value = this.robot.brain.data.users[user.id][key]
        if (!(key in newUser)) {
          newUser[key] = value
        }
      }
    }
    delete this.robot.brain.data.users[user.id]
    return this.robot.brain.userForId(user.id, newUser)
  }
}
