var mix = require('mixture').mix("balanced")
    , bouncy = require('bouncy');

var config = require('./config.js')
    , log = require('./logger.js').getLogger("system");

var count = require('os').cpus().length
    , port = config.socket.port
    , portmap = [];

mix.debug(log.info);

// socket.io instances
var socketio = mix.task('socket.io', { filename: 'app.js' })
//var socketio = mix.task('socket.io', { filename: 'app_cached.js' })

//进程总数
var workerTatol = config.service.workerTatol || (config.service.isProxy == true ? count - 1 : count);

for (var i = 0; i < workerTatol; i++) {
    port++;
    portmap.push(port)
    var worker = socketio.fork({ args: [port, "node_" + createNodeId()] })
}

if (config.service.isAnew == true) {
    //如果线程死亡，尝试重启
    mix.on("death", function (worker, task) {
        setTimeout(function () {
            task.fork({args: worker.args});
        }, config.service.anewTime)
    });
}

if (config.service.isProxy == true) {
    //代理请求
    bouncy(function (req, bounce) {
        bounce(portmap[Math.random() * portmap.length | 0])
    }).listen(config.socket.port)
}

function createNodeId() {
    // by default, we generate a random id 
    return Math.abs(Math.random() * Math.random() * Date.now() | 0);
};
