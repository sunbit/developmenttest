'use strict';

var expect = require('expect');
var testutils = require('./utils.js');
var rabbitUtils = require('../lib');

var TEST_RABBITMQ_URL = 'amqp://guest:guest@localhost/tests';

describe('RabbitMQ Utils', function () {
  it('provides a client object', function () {
    expect(rabbitUtils.RabbitClient).toExist();
  });

  describe('RabbitClient object', function () {
    var client = new rabbitUtils.RabbitClient(TEST_RABBITMQ_URL);

    it('should have a rpc method', function () {
      expect(client.rpc).toExist();
    });
    it('should have a subscribe method', function () {
      expect(client.subscribe).toExist();
    });
    it('should have a publish method', function () {
      expect(client.publish).toExist();
    });
  });

  describe('RabbitClient instance', function () {
    var client = new rabbitUtils.RabbitClient(TEST_RABBITMQ_URL);

    before(function (done) {
      testutils.createTestExchanges(TEST_RABBITMQ_URL).then(function () {
        done();
      });
    });

    beforeEach(function (done) {
      client = new rabbitUtils.RabbitClient(TEST_RABBITMQ_URL);
      client.connect();
      client.opened.then(function () {
        done();
      });
    });

    afterEach(function (done) {
      client.disconnect();
      done();
    });

    it('should create a channel once connected', function () {
      expect(client.status).toEqual('connected');
      expect(client.connection).toExist();
      expect(client.channel).toExist();
    });
    it('should transform payload into formatted message', function () {
      var message = client.prepareMessage({field1: 'value'});
      expect(message).toBeA(Buffer);
      var parsed = JSON.parse(message.toString());
      expect(parsed.date).toExist();
      expect(parsed.source).toEqual(rabbitUtils.Settings.CLIENT_ID);
      expect(parsed.content.field1).toEqual('value');
    });
    it('should publish messages', function (done) {
      function publishMessage() {
        client.publish('test', 'Hello world');
      }
      testutils.consumeAll(TEST_RABBITMQ_URL, 'test', publishMessage).then(function (messages) {
        expect(messages.length).toEqual(1);
        done();
      });
    });
    it('should get published messages', function (done) {
      function handleMessage(raw, parsed) {
        expect(parsed.content).toEqual('Hello world');
        done();
      }
      client.subscribe('test', handleMessage).then(function () {
        client.publish('test', 'Hello world');
      });
    });
    it('should get only "test.routing" messages', function (done) {
      function handleMessage(raw, parsed) {
        expect(parsed.date).toExist();
        expect(parsed.content).toEqual('Routed message');
        done();
      }
      client.subscribe('test', handleMessage, {routingKey: 'test.routing'}).then(function () {
        client.publish('test', 'Hello world');
        client.publish('test', 'Routed message', {routingKey: 'test.routing'});
      });
    });
    it('should get a response from a rpc', function (done) {
      function sendRPCRequest() {
        var response = client.rpc('my.rpc.endpoint', 'RPC Request');
        response.then(function (value) {
          expect(value.status).toEqual('SUCCESS');
          expect(value.result.status).toEqual('OK');
          expect(value.task_id).toExist('task_id');
          done();
        });
      }
      testutils.dummyRPCServer(
        TEST_RABBITMQ_URL,
        rabbitUtils.Settings.RPC_EXCHANGE,
        rabbitUtils.Settings.RPC_RESULTS,
        'my.rpc.endpoint',
        sendRPCRequest);
    });
  });
});
