# rabbit-utils [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-image]][daviddm-url]
> A set of utilities over RabbitMQ

## Installation

```sh
$ npm install --save rabbit-utils
```

## Usage

Before anything you must create an instance of the client, and connect to a broker
```js
var rabbitUtils = require('rabbit-utils');
var client = new rabbitUtils.RabbitClient('amqp://localhost');
client.connect()
```

A promise is stored on the client that tells us when the connection is already opened, and by using it you can start using the client, for example to publish a message.

```js
client.opened.then(function() {
    client.publish('myExchange', 'message payload')
})
```
you can subscribe to all the messages of a particular exchange. To do this, you have to write a mininum handler to receive the messages:

```js
var handleMessage(raw, msg) {
    // Do something with the message
}
client.subscribe('myExchange', handleMessage)
```

you can also specify a routing key to filter which messages you get:
```js
client.subscribe('myExchange', handleMessage, {routingKey: 'some.routing.key'})
```

And you can call available RPC services, providing the routing key that identifies the RPC. The result of the message will be available as the promise's value once its retrieved.

```js
var result = client.rpc('a.fancy.rpc.endpoint', {foo: 'bar'})
result.then(function(value) {
    //Do something with the value
})
```
## License

MIT © [Carles Bruguera]()


[npm-image]: https://badge.fury.io/js/rabbit-utils.svg
[npm-url]: https://npmjs.org/package/rabbit-utils
[travis-image]: https://travis-ci.org/sunbit/rabbit-utils.svg?branch=master
[travis-url]: https://travis-ci.org/sunbit/rabbit-utils
[daviddm-image]: https://david-dm.org/sunbit/rabbit-utils.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/sunbit/rabbit-utils
