import * as readline from 'readline'
import * as process from 'process'
import chalk from 'chalk'
import * as fs from 'fs-extra'
import * as cline from 'cline'
import { Robot } from '../robot'
import { Adapter } from '../adapter'
import { Envelope, TextMessage } from '../message'

const historySize = process.env.HUBOT_SHELL_HISTSIZE != null ? parseInt(process.env.HUBOT_SHELL_HISTSIZE) : 1024
const historyPath = '.hubot_history'

class Shell extends Adapter {
  private cli: any

  public send(_: Envelope, ...strings: string[]): void {
    strings.forEach(str => console.log(chalk.bold(`${str}`)))
  }

  public emote(envelope: Envelope, ...strings: string[]): void {
    strings.map(str => this.send(envelope, str))
  }

  public reply(envelope: Envelope, ...strings: string[]): void {
    strings = strings.map((s) => `${envelope.user.name}: ${s}`)
    this.send(envelope, ...strings)
  }

  public run(): void {
    this.buildCli()
    loadHistory((error, history) => {
      if (error) {
        console.log(error.message)
      }

      this.cli.history(history)
      this.cli.interact(`${this.robot.name}> `)
      return this.emit('connected')
    })
  }

  public close(): void { }

  public shutdown(): void {
    this.robot.shutdown()
    process.exit(0)
  }

  private buildCli(): void {
    this.cli = cline()

    this.cli.command('*', input => {
      let userId = process.env.HUBOT_SHELL_USER_ID || '1'

      const userName = process.env.HUBOT_SHELL_USER_NAME || 'Shell'
      const user = this.robot.brain.userForId(userId, { name: userName, room: 'Shell' })
      this.receive(new TextMessage(user, input, 'messageId'))
    })

    this.cli.command('history', () => {
      Array.from(this.cli.history()).map(item => console.log(item))
    })

    this.cli.on('history', item => {
      if (item.length > 0 && item !== 'exit' && item !== 'history') {
        fs.appendFile(historyPath, `${item}\n`, error => {
          if (error) {
            this.robot.emit('error', error)
          }
        })
      }
    })

    this.cli.on('close', () => {
      let fileOpts, history, i, item, len, outstream, startIndex

      history = this.cli.history()

      if (history.length <= historySize) {
        return this.shutdown()
      }

      startIndex = history.length - historySize
      history = history.reverse().splice(startIndex, historySize)
      fileOpts = {
        mode: 0x180
      }

      outstream = fs.createWriteStream(historyPath, fileOpts)
      outstream.on('finish', this.shutdown)

      for (i = 0, len = history.length; i < len; i++) {
        item = history[i]
        outstream.write(item + '\n')
      }

      outstream.end(this.shutdown)
    })
  }
}

async function loadHistory(cb) {
  if (await fs.pathExists(historyPath) === false) {
    return cb(new Error('No history available'))
  }

  const input = fs.createReadStream(historyPath)

  const items = []

  readline.createInterface({ input, terminal: false })
    .on('line', function (line) {
      line = line.trim()
      if (line.length > 0) {
        items.push(line)
      }
    })
    .on('close', () => cb(null, items))
    .on('error', cb)
}

export function use(robot: Robot): Adapter {
  return new Shell(robot)
}
