import * as argv from 'yargs'

export function parseArgs() {
  return argv
    .usage('Usage: $0 [options]')
    .option('adapter', {
      string: true,
      alias: 'a',
      default: process.env.HUBOT_ADAPTER || process.env.TSBOT_ADAPTER || 'shell',
      desc: 'The Adapter to use'
    })
    .options('disable-httpd', {
      boolean: true,
      alias: 'd',
      default: process.env.HUBOT_HTTPD || process.env.TSBOT_HTTPD || false,
      desc: 'Disable the HTTP server'
    })
    .options('alias', {
      string: true,
      alias: 'l',
      default: process.env.HUBOT_ALIAS || process.env.TSBOT_ALIAS || false,
      desc: `Enable replacing the robot's name with alias`
    })
    .options('name', {
      string: true,
      alias: 'n',
      default: process.env.HUBOT_NAME || process.env.TSBOT_NAME || 'tsbot',
      desc: 'The name of the robot in chat'
    })
    .options('require', {
      type: 'array',
      alias: 'r',
      default: process.env.HUBOT_SCRIPTS || process.env.TSBOT_SCRIPTS || [],
      desc: 'Alternative scripts path'
    })
    .options('config-check', {
      boolean: true,
      alias: 't',
      default: false,
      desc: `Test tsbot's config to make sure it won't fail at startup`
    })
    .version(require('../package.json').version)
    .alias('version', 'v')
    .help('help')
    .alias('help', 'h')
    .argv
}
