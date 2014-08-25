var express = require('express')
    , app = express()
    , sio = require('socket.io')
    , http = require('http').createServer(app)
    , io = sio.listen(http)
    , amqp = require('amqp')
    , fs = require('fs')
    , RedisStore = sio.RedisStore;

require('date-utils');

var config = require('./../config.js'),
    rabbitConnectionFactory = require('./../rabbitConnectionFactory.js'),
    redisConnectionFactory = require('./../redisConnectionFactory.js'),
    log = require('./../logger.js').getLogger("system"),
    socketManage = require('./../socketCachedManage.js'),
    cookieUtil = require('./../cookieUtil.js');

var port = process.argv[2] || config.socket.port
    , appId = process.argv[3] || 0;


var redisPub = redisConnectionFactory.getConnectionToDB(config.redis.socketDB);
var redisSub = redisConnectionFactory.getConnectionToDB(config.redis.socketDB);
var redisClient = redisConnectionFactory.getConnectionToDB(config.redis.socketDB);
io.configure(function () {
    //使用redis存储会话
    io.set('store', new RedisStore({
            redisPub: redisPub,
            redisSub: redisSub,
            redisClient: redisClient
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

var msgClient = redisConnectionFactory.getConnectionToDB(config.redis.socketDB);

var msgKey = "amsg:";

io.sockets.on('connection', function (socket) {
    log.debug(socket.id + ":connection " + appId);
    //注册
    socket.on('register', function (data) {
        log.debug(socket.id + " register " + appId + ",sessionId:" + data.sessionId + " groupFlag:" + data.groupFlag);
        if (data.sessionId) {
            socketManage.addIdMap(data.sessionId, socket.id);
        }
        if (data.groupFlag) {
            if (!socket.groupFlag) {
                socket.groupFlag = [];
            }
            socket.groupFlag.push(data.groupFlag);
            socketManage.addGroupItem(data.groupFlag, socket.id);
        }
        //订阅消息
        msgClient.subscribe(msgKey + socket.id);
    });
    //关闭时清除连接的注册信息
    socket.on('disconnect', function () {
        log.debug(socket.id + ":disconnect " + appId);
        if (socket.groupFlag) {
            for (var i = 0; i < socket.groupFlag.length; i++) {
                socketManage.removeGroupItem(socket.groupFlag[i], socket.id);
            }
        }
        socketManage.removeIdMap(socket.id);
        //取消消息订阅
        msgClient.unsubscribe(msgKey + socket.id);
    });
});

//redis 消息
msgClient.on("message", function (channel, message) {
    var oldId = channel.substring(msgKey.length, channel.length);
    var socket = io.sockets.sockets[oldId];
    if (socket) {
        emitMessageToClietn(socket, JSON.parse(message));
        log.debug(appId + " emit " + oldId + " msg:" + message);
    }
});


var msgPubClient = redisConnectionFactory.getConnectionToDB(config.redis.socketDB);
//推送到客户端消息
function emitMessageToClietn(socket, json) {
    if (json.data) {
        if (typeof json.data == "string") {
            json.data = JSON.parse(json.data);
        }
    }
    if (socket) {
        socket.emit('message', json);
    }
}
//推送消息
function emitMessage(oldId, json) {
    var socket = io.sockets.sockets[oldId];
    if (socket) {
        //推送到客户端消息
        emitMessageToClietn(socket, json);
    } else {
        //推送到队列
        msgPubClient.publish(msgKey + oldId, JSON.stringify(json));
    }
}

var rabbitConnection = rabbitConnectionFactory.getConnection();

rabbitConnection.on('ready', function () {

    var q = rabbitConnection.queue(config.rabbit.receiveQueueName,
        {durable: true, autoDelete: false, 'arguments': {'x-message-ttl': 600000}});
    // Receive messages
    q.subscribe({ ack: true, prefetchCount: 1 }, function (json, headers, deliveryInfo, m) {
        try {
            var socketSessionId = json.socketSessionId;
            var groupFlag = json.socketGroupFlag;
            //如有group 就按组推送
            if (groupFlag && groupFlag != "") {
                socketManage.getGroupItme(groupFlag, function (group) {
                    if (group) {
                        for (var i = 0; i < group.length; i++) {
                            emitMessage(group[i], json);
                        }
                    }
                });
            }
            if (socketSessionId && socketSessionId != "") {
                var oldId = socketManage.getOldId(socketSessionId);
                if (oldId) {
                    emitMessage(oldId, json);
                }
            }
            //m.acknowledge();
            //q.basicAck(deliveryInfo.deliveryTag,true);
            log.debug(appId + " subscribe msg");
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