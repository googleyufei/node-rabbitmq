var _tag = tag = "[amqp]-[server]-",
    Q = require("q"),
    rabbitmq = require("./rabbitmq-async"),
    config = require("../config/config"),
    logger = require("../helper/logger");

global.log = logger.initLogger(true, config.logDir, "rabbitmq.log");

var rabbitConn = null,
    defaultQueue = null;

rabbitmq.connect_async().then(function (connection) {
    log.debug(tag, "rabbitmq connect OK!");
    rabbitConn = connection;
    return [
        rabbitmq.queue_async(rabbitConn, "yufei-test"),
        rabbitmq.queue_async(rabbitConn, "yufei-test2")
    ];
}).spread(function (queue, queue2) {
    log.debug(tag, "connect queue: ", queue.name);
    log.debug(tag, "connect queue: ", queue2.name);
    rabbitConn.exchange("enterprise.exchange", { type: 'fanout'}, function (exchange) {
        log.debug(tag, "create enterprise.exchange");
        queue.bind(exchange, "");
        queue2.bind(exchange, "");
        rabbitmq.queue_subscribe(queue, function (err, message) {
        });
        rabbitmq.queue_subscribe(queue2, function (err, json) {
        });
    })
});

