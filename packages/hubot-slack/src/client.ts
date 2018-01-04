/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { RtmClient, WebClient } = require('@slack/client');
const SlackFormatter = require('./formatter');
const _ = require('lodash');

export class SlackClient {
  static initClass() {
    this.PAGE_SIZE = 100;
  }

  constructor(options, robot) {

    this.robot = robot;

    // RTM is the default communication client
    this.robot.logger.debug(`slack rtm client options: ${JSON.stringify(options.rtm)}`);
    this.rtm = new RtmClient(options.token, options.rtm);
    this.rtmStartOpts = options.rtmStart || {};

    // Web is the fallback for complex messages
    this.web = new WebClient(options.token);

    // Message formatter
    this.format = new SlackFormatter(this.rtm.dataStore);

    // Message handler
    this.rtm.on('message', this.messageWrapper, this);
    this.messageHandler = undefined;

    this.returnRawText = !options.noRawText;
  }

  /*
  Open connection to the Slack RTM API
  */
  connect() {
    this.robot.logger.debug(`slack rtm start with options: ${JSON.stringify(this.rtmStartOpts)}`);
    return this.rtm.start(this.rtmStartOpts);
  }

  /*
  Slack RTM message events wrapper
  */
  messageWrapper(message) {
    if (this.messageHandler) {
      const { user, channel, bot_id } = message;

      message.rawText = message.text;
      message.returnRawText = this.returnRawText;
      message.text = this.format.incoming(message);

      // messages sent from human users, apps with a bot user and using the xoxb token, and
      // slackbot have the user property
      if (user) { message.user = this.rtm.dataStore.getUserById(user); }

      // bot_id exists on all messages with subtype bot_message
      // these messages only have a user property if sent from a bot user (xoxb token). therefore
      // the above assignment will not happen for all custom integrations or apps without a bot user
      if (bot_id) { message.bot = this.rtm.dataStore.getBotById(bot_id); }

      if (channel) { message.channel = this.rtm.dataStore.getChannelGroupOrDMById(channel); }
      return this.messageHandler(message);
    }
  }


  /*
  Set message handler
  */
  onMessage(callback) {
    if (this.messageHandler !== callback) { return this.messageHandler = callback; }
  }

  /*
  Attach event handlers to the RTM stream
  Deprecated: This API is being removed without a replacement in the next major version.
  */
  on(type, callback) {
    this.robot.logger.warning('SlackClient#on() is a deprecated method and will be removed in the next major version ' +
      'of hubot-slack. See documentaiton for a migration guide to find alternatives.'
    );
    return this.rtm.on(type, callback);
  }

  /*
  Disconnect from the Slack RTM API
  */
  disconnect() {
    this.rtm.disconnect();
    // NOTE: removal of event listeners possibly does not belong in disconnect, because they are not added in connect.
    return this.rtm.removeAllListeners();
  }


  /*
  Set a channel's topic
  */
  setTopic(id, topic) {
    const channel = this.rtm.dataStore.getChannelGroupOrDMById(id);
    this.robot.logger.debug(topic);

    const type = channel.getType();
    switch (type) {
      case "channel": return this.web.channels.setTopic(id, topic);
      // some groups are private channels which have a topic
      // some groups are MPIMs which do not
      case "group":
        return this.web.groups.setTopic(id, topic, (err, res) => {
          if (err || !res.ok) { return this.robot.logger.debug("Cannot set topic in MPIM"); }
        });
      default: return this.robot.logger.debug(`Cannot set topic in ${type}`);
    }
  }


  /*
  Send a message to Slack using the best client for the message type
  */
  send(envelope, message) {
    let room;
    if (envelope.room) {
      ({ room } = envelope);
    } else if (envelope.id) { //Maybe we were sent a user object or channel object. Use the id, in that case.
      room = envelope.id;
    }

    this.robot.logger.debug(`Sending to ${room}: ${message}`);

    const options = { as_user: true, link_names: 1, thread_ts: (envelope.message != null ? envelope.message.thread_ts : undefined) };

    if (typeof message !== 'string') {
      return this.web.chat.postMessage(room, message.text, _.defaults(message, options));
    } else {
      return this.web.chat.postMessage(room, message, options);
    }
  }

  loadUsers(callback) {
    // paginated call to users.list
    // some properties of the real results are left out because they are not used
    const combinedResults = { members: [] };
    var pageLoaded = (error, results) => {
      if (error) { return callback(error); }
      // merge results into combined results
      for (let member of Array.from(results.members)) { combinedResults.members.push(member); }
      if (__guard__(results != null ? results.response_metadata : undefined, x => x.next_cursor)) {
        // fetch next page
        return this.web.users.list({
          limit: SlackClient.PAGE_SIZE,
          cursor: results.response_metadata.next_cursor
        }, pageLoaded);
      } else {
        // pagination complete, run callback with results
        return callback(null, combinedResults);
      }
    };
    return this.web.users.list({ limit: SlackClient.PAGE_SIZE }, pageLoaded);
  }
}
SlackClient.initClass();
