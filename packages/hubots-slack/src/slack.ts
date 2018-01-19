import { SlackBot } from './bot'
import { Options } from './options'
import * as process from 'process'
import { Robot, Adapter } from '@axelspringer/hubots'

export function use(robot: Robot): Adapter {
  let options = new Options(process.env.HUBOTS_SLACK_TOKEN)

  try {
    options.rtm = JSON.parse(process.env.HUBOTS_SLACK_RTM_CLIENT_OPTS || JSON.stringify({}))
    options.rtmStart = JSON.parse(process.env.HUBOTS_SLACK_RTM_START_OPTS || JSON.stringify({}))
  } catch (error) {
    console.error(error)
  }

  return new SlackBot(robot, options)
}
