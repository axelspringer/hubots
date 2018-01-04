"use strict";
class Pitti {
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
module.exports = new Pitti().register;
//# sourceMappingURL=main.js.map