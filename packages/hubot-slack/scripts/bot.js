"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const hubots_1 = require("@axelspringer/hubots");
const client_1 = require("./client");
const reaction_message_1 = require("./reaction-message");
const slack_message_1 = require("./slack-message");
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
hubots_1.Robot.prototype.react = function (matcher, options, callback) {
    let matchReaction = msg => msg instanceof reaction_message_1.ReactionMessage;
    if (arguments.length === 1) {
        return this.listen(matchReaction, matcher);
    }
    else if (matcher instanceof Function) {
        matchReaction = msg => msg instanceof reaction_message_1.ReactionMessage && matcher(msg);
    }
    else {
        callback = options;
        options = matcher;
    }
    return this.listen(matchReaction, options, callback);
};
class SlackBot extends hubots_1.Adapter {
    constructor(robot, options) {
        {
            // Hack: trick Babel/TypeScript into allowing this before super.
            if (false) {
                super();
            }
            let thisFn = (() => { this; }).toString();
            let thisName = thisFn.slice(thisFn.indexOf('{') + 1, thisFn.indexOf(';')).trim();
            eval(`${thisName} = this;`);
        }
        this.open = this.open.bind(this);
        this.authenticated = this.authenticated.bind(this);
        this.close = this.close.bind(this);
        this.error = this.error.bind(this);
        this.message = this.message.bind(this);
        this.reaction = this.reaction.bind(this);
        this.loadUsers = this.loadUsers.bind(this);
        this.userChange = this.userChange.bind(this);
        this.robot = robot;
        this.options = options;
        this.client = new client_1.SlackClient(this.options, this.robot);
    }
    /*
    Slackbot loads full user list on the first brain load
    QUESTION: why do brain adapters trigger a brain 'loaded' event each time a key
    is set?
    */
    setIsLoaded(isLoaded) {
        this.isLoaded = isLoaded;
    }
    /*
    Slackbot initialization
    */
    run() {
        let needle;
        if (!this.options.token) {
            return this.robot.logger.error("No service token provided to Hubot");
        }
        if ((needle = this.options.token.substring(0, 5), !['xoxb-', 'xoxp-'].includes(needle))) {
            return this.robot.logger.error("Invalid service token provided, please follow the upgrade instructions");
        }
        // Setup client event handlers
        this.client.rtm.on('open', this.open);
        this.client.rtm.on('close', this.close);
        this.client.rtm.on('error', this.error);
        this.client.rtm.on('reaction_added', this.reaction);
        this.client.rtm.on('reaction_removed', this.reaction);
        this.client.rtm.on('authenticated', this.authenticated);
        this.client.rtm.on('user_change', this.userChange);
        this.client.loadUsers(this.loadUsers);
        this.client.onMessage(this.message);
        this.robot.brain.on('loaded', () => {
            if (!this.isLoaded) {
                this.client.loadUsers(this.loadUsers);
                return this.setIsLoaded(true);
            }
        });
        // Start logging in
        return this.client.connect();
    }
    /*
    Slack client has opened the connection
    */
    open() {
        this.robot.logger.info('Slack client now connected');
        // Tell Hubot we're connected so it can load scripts
        return this.emit("connected");
    }
    /*
    Slack client has authenticated
    */
    authenticated(identity) {
        let team;
        ({ self: this.self, team } = identity);
        // Find out bot_id
        for (let user of Array.from(identity.users)) {
            if (user.id === this.self.id) {
                this.self.bot_id = user.profile.bot_id;
                break;
            }
        }
        // Provide our name to Hubot
        this.robot.name = this.self.name;
        return this.robot.logger.info(`Logged in as ${this.robot.name} of ${team.name}`);
    }
    /*
    Slack client has closed the connection
    */
    close() {
        // NOTE: not confident that @options.autoReconnect has intended effect as currently implemented
        if (this.options.autoReconnect) {
            return this.robot.logger.info('Slack client closed, waiting for reconnect');
        }
        else {
            this.robot.logger.info('Slack client connection was closed, exiting hubot process');
            this.client.disconnect();
            return process.exit(1);
        }
    }
    /*
    Slack client received an error
    */
    error(error) {
        if (error.code === -1) {
            return this.robot.logger.warning(`Received rate limiting error ${JSON.stringify(error)}`);
        }
        return this.robot.emit('error', error);
    }
    /*
    Hubot is sending a message to Slack
    */
    send(envelope, ...messages) {
        const sent_messages = [];
        for (let message of Array.from(messages)) {
            if (message !== '') {
                sent_messages.push(this.client.send(envelope, message));
            }
        }
        return sent_messages;
    }
    /*
    Hubot is replying to a Slack message
    */
    reply(envelope, ...messages) {
        const sent_messages = [];
        for (let message of Array.from(messages)) {
            if (message !== '') {
                if (envelope.room[0] !== 'D') {
                    message = `<@${envelope.user.id}>: ${message}`;
                }
                this.robot.logger.debug(`Sending to ${envelope.room}: ${message}`);
                sent_messages.push(this.client.send(envelope, message));
            }
        }
        return sent_messages;
    }
    /*
    Hubot is setting the Slack channel topic
    */
    setTopic(envelope, ...strings) {
        if (envelope.room[0] === 'D') {
            return;
        } // ignore DMs
        return this.client.setTopic(envelope.room, strings.join("\n"));
    }
    /*
    Message received from Slack
    */
    message(message) {
        let textMessage;
        let { text, rawText, returnRawText, user, channel, subtype, topic, bot } = message;
        if (user && (user.id === this.self.id)) {
            return;
        } // Ignore anything we sent, or anything from an unknown user
        if (bot && (bot.id === this.self.bot_id)) {
            return;
        } // Ignore anything we sent, or anything from an unknown bot
        subtype = subtype || 'message';
        // Hubot expects this format for TextMessage Listener
        if (!user) {
            user = bot;
        }
        if (!user) {
            user = {};
        }
        user.room = channel.id;
        // Direct messages
        if (channel.id[0] === 'D') {
            text = `${this.robot.name} ${text}`; // If this is a DM, pretend it was addressed to us
            if (channel.name == null) {
                channel.name = channel._modelName;
            } // give the channel a name
        }
        // Send to Hubot based on message type
        switch (subtype) {
            case 'message':
            case 'bot_message':
                this.robot.logger.debug(`Received message: '${text}' in channel: ${channel.name}, from: ${user.name}`);
                if (returnRawText) {
                    textMessage = new slack_message_1.SlackTextMessage(user, text, rawText, message);
                }
                else {
                    textMessage = new hubots_1.TextMessage(user, text, message.ts);
                }
                textMessage.thread_ts = message.thread_ts;
                return this.receive(textMessage);
            case 'channel_join':
            case 'group_join':
                this.robot.logger.debug(`${user.name} has joined ${channel.name}`);
                return this.receive(new hubots_1.EnterMessage(user));
            case 'channel_leave':
            case 'group_leave':
                this.robot.logger.debug(`${user.name} has left ${channel.name}`);
                return this.receive(new hubots_1.LeaveMessage(user));
            case 'channel_topic':
            case 'group_topic':
                this.robot.logger.debug(`${user.name} set the topic in ${channel.name} to ${topic}`);
                return this.receive(new hubots_1.TopicMessage(user, message.topic, message.ts));
            default:
                this.robot.logger.debug(`Received message: '${text}' in channel: ${channel.name}, subtype: ${subtype}`);
                message.user = user;
                return this.receive(new hubots_1.CatchAllMessage(message));
        }
    }
    /*
    Reaction added/removed event received from Slack
    */
    reaction(message) {
        let { type, user, reaction, item_user, item, event_ts } = message;
        if ((user === this.self.id) || (user === this.self.bot_id)) {
            return;
        } //Ignore anything we sent
        user = this.client.rtm.dataStore.getUserById(user);
        item_user = this.client.rtm.dataStore.getUserById(item_user);
        if (!user || !item_user) {
            return;
        }
        user.room = item.channel;
        return this.receive(new reaction_message_1.ReactionMessage(type, user, reaction, item_user, item, event_ts));
    }
    loadUsers(err, res) {
        if (err || !res.ok) {
            this.robot.logger.error("Can't fetch users");
            return;
        }
        return Array.from(res.members).map((member) => this.userChange(member));
    }
    // when invoked as an event handler, this method takes an event. but when invoked from loadUsers,
    // this method takes a user
    userChange(event_or_user) {
        let value;
        if (!event_or_user) {
            return;
        }
        const user = event_or_user.type === 'user_change' ? event_or_user.user : event_or_user;
        const newUser = {
            id: user.id,
            name: user.name,
            real_name: user.real_name,
            slack: {}
        };
        if (user.profile && user.profile.email) {
            newUser.email_address = user.profile.email;
        }
        for (var key in user) {
            // don't store the SlackClient, because it'd cause a circular reference
            // (it contains users and channels), and because it has sensitive information like the token
            value = user[key];
            if (value instanceof client_1.SlackClient) {
                continue;
            }
            newUser.slack[key] = value;
        }
        if (user.id in this.robot.brain.data.users) {
            for (key in this.robot.brain.data.users[user.id]) {
                value = this.robot.brain.data.users[user.id][key];
                if (!(key in newUser)) {
                    newUser[key] = value;
                }
            }
        }
        delete this.robot.brain.data.users[user.id];
        return this.robot.brain.userForId(user.id, newUser);
    }
}
exports.SlackBot = SlackBot;
//# sourceMappingURL=bot.js.map