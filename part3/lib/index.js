'use strict';
/* global console */

var amqplib = require('amqplib');
var when = require('when');
var uuid = require('node-uuid');
var extend = require('extend');
var defer = when.defer;

var DEFAULT_SUBSCRIBE_OPTIONS = {
    routingKey: '#',
    queueName: '',
    queueOptions: {}
};

var DEFAULT_PUBLISH_OPTIONS = {
    routingKey: ''
};

var RPC_EXCHANGE = 'miimetiq';
var RPC_RESULTS = 'celeryresults';

var RabbitClient = function (url) {
  var self = this;
  self.url = url;
  self.status = 'disconnected';
};

RabbitClient.prototype.connect = function () {
  var self = this;
  self.opened = amqplib.connect(self.url);
  self.opened = self.opened.then(function (conn) {
    self.connection = conn;
    var ok = conn.createChannel();
    return ok;
  });
  self.opened.then(function (ch) {
    self.channel = ch;
    self.status = 'connected';
  });
};

RabbitClient.prototype.disconnect = function () {
  var self = this;
  self.closed = self.connection.close();
  self.closed.then(function () {
    self.status = 'disconnected';
  });
};

RabbitClient.prototype.rpc = function (content, routingKey) {
  var result = defer();
  var self = this;
  var correlationId = uuid.v4();
  var task_id = correlationId.replace(/-/g, '');

  function handleRPCResponse(raw, parsed) {
    result.resolve(parsed);
    self.channel.close();
  }

  self.subscribe(RPC_RESULTS, handleRPCResponse, {queueName:task_id, routingKey:task_id}).then(function() {
    self.publish(RPC_EXCHANGE, content, {
      correlationId: task_id,
      routingKey: routingKey
    });
  });
  return result.promise;
};

RabbitClient.prototype.prepareMessage = function (data) {
  var message = {
    date: (new Date()).getTime(),
    content: data
  };
  return new Buffer(JSON.stringify(message));
};

RabbitClient.prototype.publish = function (exchange, content) {
  var self = this;

  var options = {};
  var argument_options = arguments.length > 2 ? arguments[2] : {};
  extend(options, DEFAULT_PUBLISH_OPTIONS, argument_options);

  var routingKey = options.routingKey;
  delete options.routingKey;

  self.channel.publish(exchange, routingKey, self.prepareMessage(content), options);
};

RabbitClient.prototype.subscribe = function (exchange, callback) {
  var self = this;

  var options = {};
  var argument_options = arguments.length > 2 ? arguments[2] : {};
  extend(options, DEFAULT_SUBSCRIBE_OPTIONS, argument_options);

  function handleFirst(msg) {
    return callback(msg, JSON.parse(msg.content.toString()));
  }
  return when.all([
    self.channel.assertQueue(options.queueName, options.queueOptions),
    self.channel.assertExchange(exchange, 'topic'),
    self.channel.bindQueue(options.queueName, exchange, options.routingKey).then(function () {
      self.channel.consume(options.queueName, handleFirst, {noAck: true}).then(
      );
    })
  ]);
};

module.exports = {
  RabbitClient: RabbitClient,
  Settings: {
    "RPC_EXCHANGE": RPC_EXCHANGE,
    "RPC_RESULTS": RPC_RESULTS
  }
};
