/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { SlackBot } from './bot'
import * as process from 'process'

function use(robot) {
  const options = { token: process.env.HUBOT_SLACK_TOKEN };
  try {
    options.rtm = JSON.parse(process.env.HUBOT_SLACK_RTM_CLIENT_OPTS);
  } catch (error) { }
  try {
    options.rtmStart = JSON.parse(process.env.HUBOT_SLACK_RTM_START_OPTS);
  } catch (error1) { }
  return new SlackBot(robot, options);
}

export {
  use
}
