var express = require('express')
    , app = express()
    , sio = require('socket.io')
    , http = require('http').createServer(app)
    , io = sio.listen(http)
    , amqp = require('amqp')
    , fs = require('fs')
    , RedisStore = sio.RedisStore;

require('date-utils');

var config = require('./config.js'),
    rabbitConnectionFactory = require('./rabbitConnectionFactory.js'),
    redisConnectionFactory = require('./redisConnectionFactory.js'),
    log = require('./logger.js').getLogger("system"),
    SocketManage = require('./socketMemoryManage.js').SocketManage,
    socketManage = new SocketManage(),
    cookieUtil = require('./cookieUtil.js');

var port = process.argv[2] || config.socket.port
    , appId = process.argv[3] || 0;
global.appId = appId;

io.configure(function () {
    //使用redis存储会话
    io.set('store', new RedisStore({
            redisPub: config.redis,
            redisSub: config.redis,
            redisClient: config.redis
        }
    ));
});

//定义web共享环境
app.configure(function () {
    //设置静态文件目录
    app.use(express.static(__dirname + '/client'));
});

//创建webscoket监听服务器
http.listen(port);

//set log level
io.set("log level", config.socket.logLevel);

var msgSubClient = redisConnectionFactory.getConnectionToDB(config.redis.socketDB);

var msgKey = "amsg:";

io.sockets.on('connection', function (socket) {
    log.debug(socket.id + ":connection " + appId);
    //注册
    socket.on('register', function (data) {
        log.debug(socket.id + " register " + appId + ",socketId:" + data.socketId + " groupFlag:" + data.groupFlag);
        if (data.socketId) {
            //如果客户端有指定socketId就建立于sokcet.io内部id的map
            socketManage.addIdMap(data.socketId, socket.id);
            socket.set("socketId", data.socketId);
            //订阅消息
            msgSubClient.subscribe(msgKey + data.socketId);
        }
        if (data.groupFlag) {
            var flagArray = [];
            if (typeof data.groupFlag == 'string') {
                flagArray.push(data.groupFlag);
            }
            if (data.groupFlag instanceof Array) {
                flagArray = data.groupFlag;
            }
            for (var i = 0; i < flagArray.length; i++) {
                socket.join(flagArray[i]);
            }
        }
    });
    //关闭时清除连接的注册信息
    socket.on('disconnect', function () {
        log.debug(socket.id + ":disconnect " + appId);
        socketManage.removeIdMap(socket.id);
        socket.get("socketId", function (err, socketId) {
            if (!err) {
                //取消消息订阅
                msgSubClient.unsubscribe(msgKey + socketId);
            }
        })
    });
});

//redis 消息
msgSubClient.on("message", function (channel, message) {
    var socketId = channel.substring(msgKey.length, channel.length);
    var oldId = socketManage.getOldId(socketId);
    var socket = io.sockets.sockets[oldId];
    if (socket) {
        message = JSON.parse(message);
        var isVolatile = message.isVolatile || true;
        emitMessageToClietn(socket, message, isVolatile);
        //log.debug(appId+" emit "+oldId+" msg:"+message);
    }
});

//加工消息
function processMessage(msg) {
    if (msg.data) {
        if (typeof msg.data == "string") {
            msg.data = JSON.parse(msg.data);
        }
    }
    return msg;
}
//推送到客户端消息
function emitMessageToClietn(socket, msg, isVolatile) {
    msg = processMessage(msg);
    //消息是否瞬时
    if (isVolatile) {
        //true不保证消息发送到客户端效率高
        socket.volatile.emit('message', msg);
    } else {
        //false保证发送效率不高
        socket.emit('message', msg);
    }
}
//推送消息给组
function emitMessageToGroup(groupFlag, msg, isVolatile) {
    msg = processMessage(msg);
    if (isVolatile) {
        io.sockets.volatile.in(groupFlag).emit("message", msg);
    } else {
        io.sockets.in(groupFlag).emit("message", msg);
    }
}

var msgPubClient = redisConnectionFactory.getConnectionToDB(config.redis.socketDB);

var rabbitConnection = rabbitConnectionFactory.getConnection();

rabbitConnection.on('ready', function () {
    var q = rabbitConnection.queue(config.rabbit.receiveQueueName, {
        'durable': true,
        'autoDelete': false,
        'arguments': {'x-message-ttl': 600000}
    });

    q.subscribe({
        ack: true,
        prefetchCount: 1
    }, function (json, headers, deliveryInfo, m) {
        /**********该处还缺少对消息的流量控制***************/
        try {
            var socketSessionId = json.socketSessionId;
            var groupFlag = json.socketGroupFlag;
            var isVolatile = json.isVolatile || true;
            //如有group 就按组推送
            if (groupFlag && groupFlag != "") {
                emitMessageToGroup(groupFlag, json, isVolatile);
            }
            //如有socketSessionId 就按单客户推送
            if (socketSessionId && socketSessionId != "") {
                var oldId = socketManage.getOldId(socketSessionId);
                var socket = io.sockets.sockets[oldId];
                if (socket) {
                    //推送到客户端消息
                    emitMessageToClietn(socket, json, isVolatile);
                } else {
                    //推送到队列
                    msgPubClient.publish(msgKey + socketSessionId, JSON.stringify(json));
                }
            }
        } catch (e) {
            log.error(e);
        }
        try {
            m.acknowledge(true);
        } catch (e) {
            log.error("ack msg error:", e);
        }
    });
});