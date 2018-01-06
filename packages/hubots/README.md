# :space_invader: Hubots

### A TypeScript flavor version of GitHubs famous Hubot

<br/>

[![Taylor Swift](https://img.shields.io/badge/secured%20by-taylor%20swift-brightgreen.svg)](https://twitter.com/SwiftOnSecurity)
[![Volkswagen](https://auchenberg.github.io/volkswagen/volkswargen_ci.svg?v=1)](https://github.com/auchenberg/volkswagen)
[![TypeScript](https://badges.frapsoft.com/typescript/awesome/typescript.png?v=101)](https://github.com/ellerbrock/typescript-badges/)
[![MIT license](http://img.shields.io/badge/license-MIT-brightgreen.svg)](http://opensource.org/licenses/MIT)

## Getting Started

> requires a `node` version >= 6 and an `npm` version >= 3.x.x

> we use [Koa](https://github.com/koajs/koa) as middleware

```bash
# Installs hubots as global package
npm i @axelspringer/hubots -g

# Start hubot
hubots
```

## Environment Variables

### `HUBOT_SHELL_HISTSIZE`

Sets the size of the `.hubot_history` and defaults to `1024`.

### `HUBOT_LOG_LEVEL`

Sets the log level of Hubot and defaults to `info`.

### `HUBOT_SHELL_USER_NAME`

Sets the shell username and defaults to `Shell`.

### `HUBOT_SHELL_USER_ID`

Sets the shell user id and defaults to `1`.

### `PORT`

Sets the port of the middleware and defaults to `8080`

## Development

> all commands can be seen via `npm run help`

```bash
# Clone the repository
git clone https://github.com/axelspringer/hubots

# Start the local dev server
npm start

# You can also local link it to use `hubot`
npm link
```

## Docker

You can also run Hubot in a Container. The middleware is exposed on `8080`.

```bash
# Build the container
npm run build/docker
```

Have fun!

## License
[MIT](/LICENSE)
