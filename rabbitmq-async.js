var _tag = "[rabbitmq]-[async]-",
    amqp = require('amqp'),
    _ = require("node-helper").lodash,
    Q = require("q"),
    config = require("../config/config"),
    rabbitmq = config.rabbitmq;

function Rabbit() {

}

var _proto_ = Rabbit.prototype;

_proto_.connection = undefined;

_proto_.connectAsync = function () {
    var tag = _tag + "[connect_async]",
        self = this,
        defer = Q.defer();

    var connection = amqp.createConnection({
        host: rabbitmq.host,
        port: rabbitmq.port,
        login: rabbitmq.login,
        password: rabbitmq.password,
        vhost: '/',
        connectionTimeout: 100,
        noDelay: true
    }, {
        reconnect: true,
        applicationName: "QYC-NODE-SOCKET",
        defaultExchangeName: 'amq.topic'
    });

    connection.on('error', function (error) {
        //如果有异常尝试连接其它机器
        log.error(tag, 'Rabbit Connection error' + error + ';host:' + connection.options.host);
//        connection.setOptions(getConnOption(connection.options.host));
        connection.reconnect();
        log.info('Rabbit Attempts to reconnect');
        defer.reject(new Error(error));
    });
    connection.on('close', function () {
        log.info(tag, 'Rabbit Connection close');
    });
    connection.on('connect', function () {
        log.info(tag, 'Rabbit Connection connect Success');
    });
    connection.on("ready", function () {
        self.connection = connection;
        defer.resolve(connection);
    });
    return defer.promise;
}

_proto_.getExchangeAsync = function (name) {

}

_proto_.exchangePublishAsync = function (message) {
    var defer = Q.defer();

    this.connection.publish('yufei-test', JSON.stringify(message), {}, function (flag) {
        log.debug("publish message: ", flag);
        flag ? defer.reject(new Error("publish fail")) : defer.resolve(true);
    });
    return defer.promise;
}

_proto_.getQueueAsync = function (queueName) {
    var defer = Q.defer();

    try {
        var q = rabbitConnection.queue(queueName, {
            'durable': true,
            'autoDelete': false,
            'arguments': {'x-message-ttl': 600000}
        }, function (queue) {
            defer.resolve(queue);
        });
    } catch (e) {
        defer.reject(e);
    }
    return defer.promise;
}

_proto_.subscribeQueue = function (queue, isAck, callback) {
    var tag = _tag + "[queue_subscribe]";
    if (_.isFunction(isAck)) {
        callback = isAck;
        isAck = false;
    }

    queue.subscribe({
        ack: isAck || false,
        prefetchCount: 3
    }, function (json, headers, deliveryInfo, ack) {
        /**********该处还缺少对消息的流量控制***************/
        try {
            log.debug(tag, "[queue]:", queue.name, ", json: ", json);
//            log.debug(tag, "headers: ", headers);
//            log.debug(tag, "deliveryInfo: ", deliveryInfo);
            ack.acknowledge(true);
            callback && callback(null, json);
        } catch (e) {
            log.error(tag, e.stack);
            callback(e.message);
        }
    });
    return queue;
}

module.exports = new Rabbit();