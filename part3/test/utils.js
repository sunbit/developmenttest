'use strict';
var amqplib = require('amqplib');
var when = require('when');
var defer = when.defer;
var pipeline = require('when/pipeline');

var CONSUME_QUEUE = 'test_queue';

function createChannel(conn) {
  return conn.createChannel();
}

function createExchanges(channel) {
  return when.all([
    channel.assertExchange('miimetiq', 'topic'),
    channel.assertExchange('test', 'topic'),
    channel.assertExchange('celeryresults', 'topic')
  ]);
}

function consumeAll(url, exchange, callback) {
  var messages = [];
  var consumed = defer();
  var channel;

  function createAndBindQueue(ch) {
    channel = ch;
    return when.all([
      channel.assertQueue(CONSUME_QUEUE, {autoDelete: true}),
      channel.bindQueue(CONSUME_QUEUE, exchange, '#')
    ]);
  }

  function consume() {
    callback();
    return channel.consume(CONSUME_QUEUE, handleMessage, {noAck: true});
  }

  function handleMessage(msg) {
    messages.push(msg);
    channel.checkQueue(CONSUME_QUEUE).then(function (queue) {
      if (queue.messageCount === 0) {
        channel.close();
        consumed.resolve(messages);
      }
    });
  }

  pipeline([
    amqplib.connect,
    createChannel,
    createAndBindQueue,
    consume
  ], url);

  return consumed.promise;
}

function dummyRPCServer(url, exchange, results, routingKey, callback) {
  var channel;

  function createAndBindQueue(ch) {
    channel = ch;
    return when.all([
      channel.assertQueue(CONSUME_QUEUE, {autoDelete: true}),
      channel.bindQueue(CONSUME_QUEUE, exchange, routingKey)
    ]);
  }

  function respondRPC(msg) {
    var answer = {
      status: 'SUCCESS',
      result: {
        status: 'OK'
      },
      task_id: msg.properties.correlationId
    };
    channel.publish(results, msg.properties.correlationId, new Buffer(JSON.stringify(answer)));
    channel.close();
  }

  function consume() {
    callback();
    return channel.consume(CONSUME_QUEUE, respondRPC, {noAck: true});
  }

  pipeline([
    amqplib.connect,
    createChannel,
    createAndBindQueue,
    consume
  ], url);
}

function createTestExchanges(url) {
  return pipeline([
    amqplib.connect,
    createChannel,
    createExchanges
  ], url);
}

module.exports = {
  consumeAll: consumeAll,
  dummyRPCServer: dummyRPCServer,
  createTestExchanges: createTestExchanges
};
