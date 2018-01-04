import { loadBot } from './bot'
import { parseArgs } from './args'

import { loadScripts } from './helpers'

// options & bot
const options = parseArgs()
const hubot = loadBot(undefined, options.adapter, !options.disableHttpd, options.name, options.alias)

// connect the adapters to a hubot
hubot.adapter.once('connected', () => loadScripts(options, hubot))
hubot.run()
