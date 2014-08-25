var tag = _tag = "[test]-[rabbit]",
    fs = require("fs"),
    Q = require("q"),
    constants = require("../../helper/constants"),
    _ = require("node-helper").lodash,
    Rabbit = require("./../../helper/RabbitAsync"),
    config = require("../../config/config"),
    logger = require("../../helper/logger");

global.log = logger.initLogger(true, config.logDir, "test-rabbit.log");


describe("[test]-[rabbit]", function () {
    this.timeout(15000);

    it.only("#test-publish-message", test_publish_msg_async);

    it("#publishMsgToTopic", publish_msg_to_exchange_async);
});

function publish_msg_to_exchange_async(done) {
    Rabbit.connectAsync().then(function (connection) {
        log.debug(tag, "rabbitmq connect OK!");
        return Rabbit.getExchangeAsync("exchange.oatos.1", 'fanout');
    }).then(function (exchange) {
        console.log("create exchange:", exchange.name);
        var count = 1;
        setInterval(function () {
            var test_message = 'TEST exchange:' + count;
            console.log('about to publish:', count);
            exchange.publish('', {
                title: "test message",
                content: test_message
            }, {
                'contentType': 'application/json',
                'contentEncoding': 'UTF-8',
                'deliveryMode': 2
            }, function (succ) {
                console.log("publish succ: ", succ);
            });
            count += 1;
            if (count > 5)
                done();
        }, 2000);
    });
}

function test_publish_msg_async(done) {
    Rabbit.connectAsync()
        .then(function getExchangAsync() {
            log.debug(tag, "rabbitmq connect OK!");
            return [
                Rabbit.getExchangeAsync("exchange.oatos.default", "topic"),
                Rabbit.getQueueAsync("yufei")
            ];
        })
        .spread(function (exchange, queue) {
            log.debug("create exchange:", exchange.name, ", type: ", exchange.options);
            log.debug("GET queue: ", queue.name);

            var count = 1;
            setInterval(function () {
                var test_message = 'TEST ' + count;
                console.log('about to publish:', count);
                exchange.publish('yufei2', {
                    title: "test message",
                    content: test_message
                }, {
                    'contentType': 'application/json',
                    'contentEncoding': 'UTF-8',
                    'deliveryMode': 2
                })
                count += 1;
                if (count > 5)
                    done();
            }, 2000);
        });
}