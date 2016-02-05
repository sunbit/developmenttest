'use strict';
var amqplib = require('amqplib');
var when = require('when');
var defer = when.defer;

var CONSUME_QUEUE = 'test_queue';

function consumeAll(url, exchange, callback) {
  var messages = [];
  var consumed = defer();
  amqplib.connect(url).then(function (conn) {
    var ok = conn.createChannel();
    ok.then(function (ch) {

      function handleMessage(msg) {
        messages.push(msg);
        ch.checkQueue(CONSUME_QUEUE).then(function (queue) {
          if (queue.messageCount === 0) {
            ch.close();
            consumed.resolve(messages);
          }
        });
      }
      when.all([
        ch.assertQueue(CONSUME_QUEUE, {autoDelete: true}),
        ch.assertExchange(exchange, 'topic'),
        ch.bindQueue(CONSUME_QUEUE, exchange, '#').then(function () {
          callback();
          ch.consume(CONSUME_QUEUE, handleMessage, {noAck: true});
        })
      ]);
    });
  });
  return consumed.promise;
}

function dummyRPCServer(url, exchange, routingKey, callback) {
  amqplib.connect(url).then(function (conn) {
    var ok = conn.createChannel();
    ok.then(function (ch) {

      function respondRPC(msg) {
          var answer = {
            status: "SUCCESS",
            result: {
                status: "OK"
            },
            task_id: msg.properties.correlationId
          };

          ch.publish('results', msg.properties.correlationId, new Buffer(JSON.stringify(answer)));
          ch.close();
      }
      when.all([
        ch.assertQueue(CONSUME_QUEUE, {autoDelete: true}),
        ch.assertExchange(exchange, 'topic'),
        ch.bindQueue(CONSUME_QUEUE, exchange, routingKey).then(function () {
          callback();
          ch.consume(CONSUME_QUEUE, respondRPC, {noAck: true});
        })
      ]);
    });
  });
}

module.exports = {
  consumeAll: consumeAll,
  dummyRPCServer: dummyRPCServer
};
