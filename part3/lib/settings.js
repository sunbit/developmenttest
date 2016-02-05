'use strict';

/**
 * Default settings that will be used when creatint and binding a queue
   to an exchange, in the contex of a consumer
 */
var DEFAULT_SUBSCRIBE_OPTIONS = {
  routingKey: '#',
  queueName: '',
  queueOptions: {autoDelete: true}
};

/**
 * Default settings that will be used on a message to be published.
 */
var DEFAULT_PUBLISH_OPTIONS = {
  routingKey: ''
};

// Exchange from where receive RPC calls
var RPC_EXCHANGE = 'miimetiq';
 // Exchange to send task results
var RPC_RESULTS = 'celeryresults';
 // Identifier of this library
var CLIENT_ID = 'rabbit-client';

module.exports = {
  DEFAULT_PUBLISH_OPTIONS: DEFAULT_PUBLISH_OPTIONS,
  DEFAULT_SUBSCRIBE_OPTIONS: DEFAULT_SUBSCRIBE_OPTIONS,
  RPC_EXCHANGE: RPC_EXCHANGE,
  RPC_RESULTS: RPC_RESULTS,
  CLIENT_ID: CLIENT_ID
};
