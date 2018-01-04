import { Robot } from './robot'
import { Response } from './response'

export type MiddlewareFunc<T extends Context> = (context: T, next: (done: Function) => void, done: Function) => void

export interface Context {
  response: Response
}

/**
 * Middleware handler
 */
export default class Middleware<T extends Context> {
  /**
   * Middleware stack
   */
  private stack: MiddlewareFunc<T>[] = []

  /**
   * Initializes a new instance of the <<Middleware>> class.
   * @params _robot A <<robot>> instance.
   */
  constructor(private robot: Robot) {
  }

  /**
   * Execute all middleware in order and call 'next' with the latest
   * 'done' callback if last middleware calls through. If all middleware is
   * compliant, 'done' should be called with no arguments when the entire
   * round trip is complete.
   *
   * @param context context object that is passed through the middleware stack.
   *  When handling errors, this is assumed to have a 'response' property.
   */
  public async execute(context: T): Promise<T> {
    let done: Function = () => { }
    try {
      for (let mw of this.stack) {
        done = await this._middlewareExecAsync(mw, context, done)
        if (!done) {
          break
        }
      }

      return Promise.resolve(context)
    } catch (e) {
      return Promise.reject<T>(e)
    } finally {
      done()
    }
  }

  /**
   * Registers a new middleware
   * @param middleware A generic pipeline component function that can either
   *  continue the pipeline or interupt it. The function is called with
   *  (context, next, done), the middleware should call the 'next' function
   *  with 'done' as an optional argument. If not, the middleware should call
   *  the 'done' function with no arguments. Middleware may wrap the 'done' function
   *  in order to execute logic after the final callback has been executed.
   */
  public register(middleware: MiddlewareFunc<T>): void {
    if (middleware.length !== 3) {
      throw new Error(
        `Incorrect number of arguments for middleware callback (expected 3, got ${middleware.length})`)
    }
    this.stack.push(middleware)
  }

  /**
   * Turn a middleware function into a promise.
   */
  private _middlewareExecAsync(
    middleware: MiddlewareFunc<T>,
    context: T,
    done: Function): Promise<Function> {
    return new Promise<Function>((resolve, reject) => {
      try {
        middleware.call(undefined, context,
          (newDoneFunc: Function = done) => {
            resolve(newDoneFunc)
          },
          () => {
            resolve(null)
            done()
          }
        )
      } catch (e) {
        // Maintaining the existing error interface (Response object)
        this.robot.emit('error', e, context.response)
        reject(e)
      }
    })
  }
}
