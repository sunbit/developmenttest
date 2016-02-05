'use strict';

var amqplib = require('amqplib');
var when = require('when');
var uuid = require('node-uuid');
var extend = require('extend');
var defer = when.defer;
var settings = require('./settings');

/**
 * Represents a client wrapping common features
 *
 * @constructor
 * @param {string} url - A amqp url with some or all params needed to connect
                         i.e. ampq://username:password@host:port/vhost
 */
var RabbitClient = function (url) {
  var self = this;
  self.url = url;
  self.status = 'disconnected';
};

/**
 * Opens a connection and a channel with the broker.
 * Refereces to the connection and the channel will be stored on
 * the client instance so they can be used after connection
 *
 * @param {string} title - The title of the book.
 * @param {string} author - The author of the book.
 */
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

/**
 * Terminates the connection with the broker
 */
RabbitClient.prototype.disconnect = function () {
  var self = this;
  self.closed = self.connection.close();
  self.closed.then(function () {
    self.status = 'disconnected';
  });
};

/**
 * Constructs a JSON message ready to be published. The message
 * will be composed by all the common fields defined in this method.
 * Common fields are: the date of generatio, and a string identifying this
 * library.
 *
 * @param {*} data - What will end up in the contenf field of the message
 * @returns {Buffer} - A buffer containing the JSON message.
 */
RabbitClient.prototype.prepareMessage = function (data) {
  var message = {
    source: settings.CLIENT_ID,
    date: (new Date()).getTime(),
    content: data
  };
  return new Buffer(JSON.stringify(message));
};

/**
 * Sends a task to a RPC endpoint, and retrieves the result
 *
 * @param {*} content - The payload of the task we're sending
 * @param {string} routingKey - To which endpoint do we target the call
 * @returns {Promise} - A promise object which value will the task result
 */
RabbitClient.prototype.rpc = function (routingKey, content) {
  var result = defer();
  var self = this;
  var correlationId = uuid.v4();
  var taskId = correlationId.replace(/-/g, '');

  function handleRPCResponse(raw, parsed) {
    result.resolve(parsed);
    self.channel.close();
  }

  self.subscribe(settings.RPC_RESULTS, handleRPCResponse, {queueName: taskId, routingKey: taskId}).then(function () {
    self.publish(settings.RPC_EXCHANGE, content, {
      correlationId: taskId,
      routingKey: routingKey
    });
  });
  return result.promise;
};

/**
 * Publish message. Sends a message to an exchange
 *
 * @param {String} exchange - Name of an existing exchange on the broker
 * @param {*} content - The payload of the message we want to send
 * @param {Object=} options - Optional object containing extra options. Default options
          are the ones defined in settings.DEFAULT_PUBLISH_OPTIONS.
          Except routingKey, all options will be passed as amqp message properties.
 */
RabbitClient.prototype.publish = function (exchange, content) {
  var self = this;
  var options = {};
  var argumentOptions = arguments.length > 2 ? arguments[2] : {};
  extend(options, settings.DEFAULT_PUBLISH_OPTIONS, argumentOptions);

  var routingKey = options.routingKey;
  delete options.routingKey;

  return self.channel.publish(exchange, routingKey, self.prepareMessage(content), options);
};

/**
 * Starts a consumer on a exchange. This method creates a temporary queue
 * binded to the specified exchange, and starts consuming messages. if not specified
 * on options, an auto-generated queue name is used, and all exchange messages (#) will
 * be routed.
 *
 * @param {String} exchange - The payload of the task we're sending
 * @param {String} callback - Function that will be executed for every message consumed.
          The signature for this function must be:

          function (raw {Object}, msg {String} )

          Where raw is the object received by the consumerma and ms the parsed content
          of the message. Use the first one if you need to access AMQP message properties.

 * @param {Object=} options - Optional object containing extra options. Default options
          are the ones defined in settings.DEFAULT_PUBLISH_OPTIONS.
          Except routingKey, all options will be passed as amqp message properties.
 * @returns {Promise} - A promise object which value will the task result
 */
RabbitClient.prototype.subscribe = function (exchange, callback) {
  var self = this;

  var options = {};
  var argumentOptions = arguments.length > 2 ? arguments[2] : {};
  extend(options, settings.DEFAULT_SUBSCRIBE_OPTIONS, argumentOptions);

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

module.exports = RabbitClient;
