"use strict";
class Howdy {
    constructor() {
        this.register = (robot) => {
            robot.respond(/hello/i, (msg) => {
                msg.reply('Howdy!');
            });
            robot.hear(/howdy/i, (msg) => {
                msg.send('Hola!');
            });
        };
    }
}
module.exports = new Howdy().register;
//# sourceMappingURL=main.js.map