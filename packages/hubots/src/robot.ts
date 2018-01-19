import * as fs from 'fs-extra'
import * as path from 'path'
import * as log from 'loglevel'
import * as scoped from 'scoped-http-client'
import * as cors from '@koa/cors'
// import * as koaRouter from 'koa-router'
import * as koaBody from 'koa-bodyparser'
import * as koa from 'koa'
import { EventEmitter } from 'events'
import { Adapter } from './adapter'
import Brain from './brain'
import Middleware, { Context, MiddlewareFunc } from './middleware'
import { Response, ResponseContext } from './response'
import { TextListener, Listener, Matcher, ListenerCallback, ListenerContext } from './listener'
import { Envelope, Message, EnterMessage, LeaveMessage, TopicMessage, CatchAllMessage } from './message'

let DOCUMENTATION_SECTIONS = [
  'description',
  'dependencies',
  'configuration',
  'commands',
  'notes',
  'author',
  'authors',
  'examples',
  'tags',
  'urls'
]

export interface RobotMiddleware {
  listener: Middleware<ListenerContext>
  response: Middleware<ResponseContext>
  receive: Middleware<Context>
}

/**
 * Robots receive message from a chat source and dispatch them to
 * matching listeners
 */
export class Robot extends EventEmitter {
  /**
   * Robot brain instance
   */
  public brain: Brain

  /**
   * Adapter instance
   */
  public adapter: Adapter

  /**
   * Robot middlewares
   */
  public middleware: RobotMiddleware

  /**
   * Logger instance
   */
  public logger: any

  /**
   * HTTP Router
   */
  public router: koa

  /**
   * Global scoped http client options
   */
  public globalHttpOptions: scoped.Options

  /**
   * List of commands
   */
  private _commands: string[]

  /**
   * Robot listeners
   */
  private _listeners: Listener[]

  /**
   * Error handlers
   */
  private _errorHandlers: Function[]

  /**
   * Uncaught exception handler
   */
  // private _onUncaughtException: Function

  /**
   * Initializes a new instance of the <<Robot>> class.
   * @param adapterPath  Path to the adapter script
   * @param adapterName   Name of the adapter to use
   * @param httpd         Flag for enabling the HTTP server
   * @param name          Name of this robot instance
   * @param alias         Alias for this robot instance
   */
  constructor(
    private adapterPath: string,
    public adapterName: string,
    httpd: boolean,
    public name: string = 'hubot',
    public alias: string = null) {
    super()

    this.logger = log
    let logLevel: string = process.env.HUBOTS_LOG_LEVEL || 'info'
    this.logger.setLevel(logLevel)

    this.brain = new Brain(this)
    this.adapter = null
    this.globalHttpOptions = {}
    this.middleware = {
      listener: new Middleware(this),
      response: new Middleware(this),
      receive: new Middleware(this)
    }
    this.adapterPath = this.adapterPath ? this.adapterPath : path.join(__dirname, 'adapters')
    this._listeners = []
    this._commands = []
    this._errorHandlers = []

    if (httpd) {
      this.setupHttpd()
    }

    if (!httpd) {
      this.setupNullRouter()
    }

    this._loadAdapter(this.adapterName)

    this.on('error', this._invokeErrorHandlers.bind(this))
    // this._onUncaughtException = (err: any) => this.emit('error', err)
    // process.on('uncaughtException', this._onUncaughtException)
  }

  /**
   * Adds a custom listener with the provided matcher, options and callback
   * @param matcher A function that determines whether to call the callback.
   *  Expected to return a truthy value if the callback should be executed.
   * @param options An object of additional parameters keyed on extension name
   *  (optional)
   * @param callback A function that is called with a <<Response>> object if the
   *  matcher function returns true.
   */
  public listen(matcher: Matcher, callback: ListenerCallback): void
  public listen(matcher: Matcher, options: any, callback: ListenerCallback): void
  public listen(matcher: Matcher, options: any, callback?: ListenerCallback): void {
    this._listeners.push(new Listener(this, matcher, options, callback))
  }

  /**
   * Adds a <<Listener>> that attempts to match incoming messages based on a
   * Regex.
   * @param matcher A function that determines whether to call the callback.
   *  Expected to return a truthy value if the callback should be executed.
   * @param options An object of additional parameters keyed on extension name
   *  (optional)
   * @param callback A function that is called with a <<Response>> object if the
   *  matcher function returns true.
   */
  public hear(regex: RegExp, callback: ListenerCallback): void
  public hear(regex: RegExp, options: any, callback: ListenerCallback): void
  public hear(regex: RegExp, options: any, callback?: ListenerCallback): void {
    this._listeners.push(new TextListener(this, regex, options, callback))
  }

  /**
   * Adds a <<Listener>> that attempts to match incoming messages directed
   * at the robot based on a Regex. All regexes treat patterns like they begin
   * with a '^'.
   * @param matcher A function that determines whether to call the callback.
   *  Expected to return a truthy value if the callback should be executed.
   * @param options An object of additional parameters keyed on extension name
   *  (optional)
   * @param callback A function that is called with a <<Response>> object if the
   *  matcher function returns true.
   */
  public respond(regex: RegExp, callback: ListenerCallback): void
  public respond(regex: RegExp, options: any, callback: ListenerCallback): void
  public respond(regex: RegExp, options: any, callback?: ListenerCallback): void {
    this.hear(this._respondPattern(regex), options, callback)
  }

  /**
   * Adds a <<Listener>> that triggers when anyone enters the room.
   * @param options An object of additional parameters keyed on extension name
   *  (optional)
   * @param callback A function that is called with a Response object.
   */
  public enter(callback: ListenerCallback): void
  public enter(options: any, callback: ListenerCallback): void
  public enter(options: any, callback?: ListenerCallback): void {
    this.listen((msg) => msg instanceof EnterMessage, options, callback)
  }

  /**
   * Adds a <<Listener>> that triggers when anyone leaves the room.
   * @param options An object of additional parameters keyed on extension name
   *  (optional)
   * @param callback A function that is called with a Response object.
   */
  public leave(callback: ListenerCallback): void
  public leave(options: any, callback: ListenerCallback): void
  public leave(options: any, callback?: ListenerCallback): void {
    this.listen((msg) => msg instanceof LeaveMessage, options, callback)
  }

  /**
   * Adds a <<Listener>> that triggers when anyone changes the topic.
   * @param options An object of additional parameters keyed on extension name
   *  (optional)
   * @param callback A function that is called with a Response object.
   */
  public topic(callback: ListenerCallback): void
  public topic(options: any, callback: ListenerCallback): void
  public topic(options: any, callback?: ListenerCallback): void {
    this.listen((msg) => msg instanceof TopicMessage, options, callback)
  }

  /**
   * Adds a <<Listener>> that triggers when no other text matchers match.
   * @param options An object of additional parameters keyed on extension name
   *  (optional)
   * @param callback A function that is called with a Response object.
   */
  public catchAll(callback: ListenerCallback): void
  public catchAll(options: any, callback: ListenerCallback): void
  public catchAll(options: any, callback?: ListenerCallback): void {
    if (!callback) {
      callback = options
      options = {}
    }

    this.listen(
      (msg) => msg instanceof CatchAllMessage,
      options,
      (msg) => {
        msg.message = (<CatchAllMessage>msg.message).message
        callback(msg)
      }
    )
  }

  /**
   * Adds an error handler when an uncaught exception or user emitted
   * error event occurs.
   * @params callback A function that is called with the error object.
   */
  public error(callback: Function): void {
    this._errorHandlers.push(callback)
  }

  /**
   * Registers new middleware for execution after matching but before
   * Listener callbacks
   * @param middleware A generic pipeline component function that can either
   *  continue the pipeline or interuppt it. The function is called with
   *  (context, next, done), the middleware should call the 'next' function
   *  with 'done' as an optional argument. If not, the middleware should call
   *  the 'done' function with no arguments. Middleware may wrap the 'done' function
   *  in order to execute logic after the final callback has been executed.
   */
  public listenerMiddleware(middleware: MiddlewareFunc<ListenerContext>): void {
    this.middleware.listener.register(middleware)
  }

  /**
   * Registers new middleware for execution as a response to any message is being
   * sent.
   * @param middleware A generic pipeline component function that can either
   *  continue the pipeline or interuppt it. The function is called with
   *  (context, next, done), the middleware should call the 'next' function
   *  with 'done' as an optional argument. If not, the middleware should call
   *  the 'done' function with no arguments. Middleware may wrap the 'done' function
   *  in order to execute logic after the final callback has been executed.
   */
  public responseMiddleware(middleware: MiddlewareFunc<ResponseContext>): void {
    this.middleware.response.register(middleware)
  }

  /**
   * Registers new middleware for execution before matching
   * @param middleware A generic pipeline component function that can either
   *  continue the pipeline or interuppt it. The function is called with
   *  (context, next, done), the middleware should call the 'next' function
   *  with 'done' as an optional argument. If not, the middleware should call
   *  the 'done' function with no arguments. Middleware may wrap the 'done' function
   *  in order to execute logic after the final callback has been executed.
   */
  public receiveMiddleware(middleware: MiddlewareFunc<Context>): void {
    this.middleware.receive.register(middleware)
  }

  /**
   * Passes the given message to any interested Listeners after running
   * receive middleware
   * @param message A message instance. Listeners can flag this message as 'done'
   *  to prevent further execution
   * @returns Promise which resolves when processing is complete.
   */
  public async receive(message: Message): Promise<void> {
    let context = await this.middleware.receive.execute({
      response: new Response(this, message)
    })
    return this._processListeners(context)
  }

  /**
   * Loads a file in path.
   * @param filePath A string path on the filesystem.
   * @param fileName A string filename in path on the filesystem.
   */
  public async loadFile(filePath: string, fileName: string): Promise<void> {
    let ext = path.extname(fileName)
    let full = path.join(filePath, path.basename(fileName, ext))
    if (require.extensions[ext]) {
      try {
        let script = require(full)
        if (typeof script === 'function') {
          script(this)
          await this._parseHelp(path.join(filePath, fileName))
        } else {
          this.logger.warn(`Expected ${full} to assign a function to module.exports, got ${typeof script}`)
        }
      } catch (e) {
        this.logger.error(`Unable to load ${full}: ${e.stack}`)
        process.exit(1)
      }
    }
  }

  /**
   * Loads every script in the given path.
   * @param filePath A string path on the filesystem.
   */
  public async load(filePath: string): Promise<void> {
    this.logger.debug(`Loading scripts from ${filePath}`)
    if (await fs.pathExists(filePath)) {
      let files = await fs.readdir(filePath)
      for (let file of files.sort()) {
        await this.loadFile(filePath, file)
      }
    }
  }

  /**
   * Load scripts from packages specified in the `external-scripts.json` file.
   * @param packages An array of packages containing hubot scripts to load.
   */
  public loadExternalScripts(packages: string[] | Object): Promise<void> {
    this.logger.debug('Loading external-scripts from npm packages')
    try {
      if (packages instanceof Array) {
        for (let pkg of packages) {
          require(pkg)(this)
        }
      } else {
        Object.keys(packages).map((k) => {
          return { name: k, scripts: packages[k] }
        }).forEach((pkg) => require(pkg.name)(this, pkg.scripts))
      }
      return Promise.resolve()
    } catch (e) {
      this.logger.error(`Error loading scripts from npm package - ${e.stack}`)
      return Promise.reject(e)
    }
  }

  /**
   * A helper send function which delegates to the adapter's send
   * function.
   * @param envelope A object with message, room, and user details
   * @param strings One or more strings for each message to send.
   */
  public send(envelope: Envelope, ...strings: string[]): void {
    this.adapter.send(envelope, ...strings)
  }

  /**
   * A helper reply function which delegates to the adapter's reply
   * function.
   * @param envelope A object with message, room, and user details
   * @param strings One or more strings for each message to send.
   */
  public reply(envelope: Envelope, ...strings: string[]): void {
    this.adapter.reply(envelope, ...strings)
  }

  /**
   * A helper send function to message a romm that the robot is in.
   * function.
   * @param room String designating the room to message.
   * @param strings One or more strings for each message to send.
   */
  public messageRoom(room: string, ...strings: string[]): void {
    this.adapter.send({ room: room }, ...strings)
  }

  /**
   * Kick off the event loop for the adapter.
   */
  public run(): void {
    this.emit('running')
    this.adapter.run()
  }

  /**
   * Gracefully shutdown the robot process.
   */
  public shutdown(): void {
    // process.removeListener('uncaughtException', this._onUncaughtException)
    this.adapter.close()
    this.brain.close()
  }

  /**
   * Help commands for running scripts.
   * @returns An Array of help commands for running scripts.
   */
  public helpCommands(): string[] {
    return this._commands.sort()
  }

  /**
   * Creates a scoped http client with chainable methods for
   * modifying the request. This doesn't actually make a request
   * though. Once your request is assembled, you can call `get()`/`post()`
   * etc to send the request.
   * @param url String URL to access
   * @param options Optional options to pass on to the client
   * @returns a <<ScopedClient>> instance.
   */
  public http(url: string, options?: scoped.Options): scoped.ScopedClient {
    return scoped.create(url, Object.assign({}, this.globalHttpOptions, options))
      .header('User-Agent', `tsbot`)
  }

  /**
   * Setup the Express server's defaults
   */
  private setupHttpd(): void {
    let port = process.env.PORT || 8080

    // setup koa
    const app = new koa()
    app.use((ctx: koa.Context, next) => {
      ctx.res.setHeader('X-Powered-By', `hubots/${this.name}`)
      next()
    })
    // if (user && pass) {
    //   app.use(basicAuth(user, pass))
    // }
    // if (stat) {
    //   app.use(express.static)
    // }
    app.use(cors({ origin: '*' }))
    app.use(koaBody())

    // app.use(bodyParser.json())
    // app.use(bodyParser.urlencoded({ extended: true }))
    // app.use(multer({
    //   limits: {
    //     fileSize: 100 * 1024 * 1024
    //   }
    // }).any())

    try {
      app.listen(port)
      this.router = app
    } catch (e) {
      this.logger.error(`Error trying to start HTTP server: ${e}\n${e.stack}`)
      process.exit(1)
    }
  }

  /**
   * Setup an empty router object
   */
  private setupNullRouter(): void {
    let msg = `A script has tried registering an HTTP route while the HTTP server is disabled with -d.`
    this.router = <any>{
      get: () => this.logger.warn(msg),
      post: () => this.logger.warn(msg),
      put: () => this.logger.warn(msg),
      delete: () => this.logger.warn(msg)
    }
  }

  /**
   * Load the adapter tsbot is going to use.
   * @param adapterName A string of the adapter name to use.
   */
  private _loadAdapter(adapterName: string): void {
    this.logger.debug(`Loading adapter ${adapterName}`)
    try {
      let path: string
      if (adapterName === 'shell') {
        path = `${this.adapterPath}/${adapterName}`
      } else {
        path = `${adapterName}`
      }

      this.adapter = require(path).use(this)
    } catch (e) {
      this.logger.error(`Cannot load adapter ${adapterName} - ${e}`)
      process.exit(1)
    }
  }

  /**
   * Load help info from a loaded script.
   * @param filePath A string path to the file on disk.
   */
  private async _parseHelp(filePath: string): Promise<void> {
    this.logger.debug(`Parsing help for ${filePath}`)
    let lines = (await fs.readFile(filePath, 'utf-8')).split('\n')
    let firstNonComment = lines
      .findIndex((line) => line[0] !== '#' && line.substr(0, 2) !== '//')
    let docComments = lines
      .slice(0, firstNonComment)
      .map((line) => line.replace(/^(#|\/\/)/, '').trim())
      .filter((line) => line.length > 0 && line.toLowerCase() !== 'none')

    let scriptDoc = {}
    let currentSection: string = null
    for (let doc of docComments) {
      let nextSection = doc.toLowerCase().replace(':', '')
      if (DOCUMENTATION_SECTIONS.indexOf(nextSection) !== -1) {
        currentSection = nextSection
        scriptDoc[currentSection] = []
      } else if (currentSection !== null) {
        scriptDoc[currentSection].push(doc)
        if (currentSection === 'commands') {
          this._commands.push(doc)
        }
      }
    }
  }

  /**
   * Passes the given message to any interested Listeners.
   * @param context Context for receive middleware
   * @returns Promise which resolves when processing is complete.
   */
  private async _processListeners(context: Context): Promise<void> {
    let handled: boolean = false
    for (let listener of this._listeners) {
      let matched = await listener.call(context.response.message, this.middleware.listener)
      handled = handled || matched
      if (context.response.message.done) {
        break
      }
    }

    if (!(context.response.message instanceof CatchAllMessage) && !handled) {
      this.logger.debug('No listeners executed falling back to catch-all')
      await this.receive(new CatchAllMessage(context.response.message))
    }
  }

  /**
   * Calls and passes any registered error handlers for unhandled exceptions or
   * user emitted error events.
   * @param err An Error object
   * @param res An optional <<Response>> object that generated the error
   */
  private _invokeErrorHandlers(err: Error, res: Response) {
    this.logger.error(err.stack)
    for (let handler of this._errorHandlers) {
      try {
        handler(err, res)
      } catch (e) {
        this.logger.error(`while invoking error handler: ${e}\n${e.stack}`)
      }
    }
  }

  /**
   * Build a regular expression that matches messages addressed
   * directly to the robot
   * @param regex A RegExp for the message part that follows the robot's name/alias
   * @returns RegExp
   */
  private _respondPattern(regex: RegExp): RegExp {
    let re = regex.toString().split('/')
    re.shift()
    let modifiers = re.pop()

    if (re[0] && re[0][0] === '^') {
      this.logger.warn(`Anchors don't work well with respond, perhaps you want to use 'hear'`)
      this.logger.warn(`The regex in question was ${regex.toString()}`)
    }

    let pattern = re.join('/')
    let name = this.name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
    let newRegex: RegExp
    if (this.alias) {
      let alias = this.alias.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
      let [a, b] = name.length > alias.length ? [name, alias] : [alias, name]
      newRegex = new RegExp(
        `^\\s*[@]?(?:${a}[:,]?|${b}[:,]?)\\s*(?:${pattern})`,
        modifiers
      )
    } else {
      newRegex = new RegExp(
        `^\\s*[@]?${name}[:,]?\\s*(?:${pattern})`,
        modifiers
      )
    }
    return newRegex
  }
}
