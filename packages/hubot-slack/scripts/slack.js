"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const bot_1 = require("./bot");
const process = require("process");
function use(robot) {
    const options = { token: process.env.HUBOT_SLACK_TOKEN };
    try {
        options.rtm = JSON.parse(process.env.HUBOT_SLACK_RTM_CLIENT_OPTS);
    }
    catch (error) { }
    try {
        options.rtmStart = JSON.parse(process.env.HUBOT_SLACK_RTM_START_OPTS);
    }
    catch (error1) { }
    return new bot_1.SlackBot(robot, options);
}
exports.use = use;
//# sourceMappingURL=slack.js.map