var _tag = tag = "[amqp]-[server]-",
    Q = require("q"),
    Rabbit = require("../helper/RabbitAsync"),
    config = require("../config/config"),
    logger = require("../helper/logger");

global.log = logger.initLogger(true, config.logDir, "rabbitmq.log");

Rabbit.connectAsync().then(function () {
    log.debug(tag, "rabbitmq connect OK!");
    return [
        Rabbit.getQueueAsync("queue.oatos.62246"),
        Rabbit.getQueueAsync("queue.oatos.43073"),
        Rabbit.getExchangeAsync("exchange.oatos.default", "topic"),
        Rabbit.getExchangeAsync("exchange.oatos.43072", "fanout")
    ];
}).spread(function (queue, queue2, defaultExchange, entExchange) {
    log.debug(tag, "GET queue: ", queue.name);
    log.debug(tag, "GET queue: ", queue2.name);
    log.debug(tag, "GET defaultExchange: ", defaultExchange.name);
    log.debug(tag, "GET entExchange: ", entExchange.name);

    queue.bind(entExchange, "");
    queue2.bind(entExchange, "");

    queue.bind(defaultExchange, queue.name);
    queue2.bind(defaultExchange, queue2.name);

    Rabbit.subscribeQueue(queue, function (err, message) {
    });
    Rabbit.subscribeQueue(queue2, function (err, json) {
    });
});

