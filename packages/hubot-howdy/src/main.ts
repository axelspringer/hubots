class Pitti {
  constructor() { }

  register = (robot: any) => {
    robot.respond(/hello/i, (msg: any) => {
      msg.reply('Howdy!')
    })

    robot.hear(/howdy/i, (msg: any) => {
      msg.send('Hola!')
    })
  }
}

export = new Pitti().register
