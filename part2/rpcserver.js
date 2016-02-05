/*jshint multistr: true */
/* globals console */
/* globals Buffer */
"use strict";

var amqplib = require('amqplib/callback_api');
var format = require('string-format');
format.extend(String.prototype);

var SETTINGS = {
    MODEL: "6‐diesel_generator_schema",
    INSTANCE_NAME: "test_dg",
    HOST: "localhost",
    PASSWORD: "anypass",
    DEVICE_ID: "56090580e7e466125aa1c0a5",
    INSTRUMENT: "generator",
    WRITER: "power",
    TYPE: "boolean"
};

SETTINGS.USERNAME = "{MODEL}%2F{INSTANCE_NAME}".format(SETTINGS);

var binding_key = "miimetiq.ds.writer.{TYPE}.{MODEL}.{DEVICE_ID}.{INSTRUMENT}.{WRITER}".format(SETTINGS);


var amqp_url = 'amqp://{USERNAME}:{PASSWORD}@{HOST}'.format(SETTINGS);

amqplib.connect(amqp_url, function(err, conn) {
    conn.createChannel(function(err, ch) {
        ch.assertQueue('', {}, function(err, ok) {
            var queue_name = ok.queue;
            ch.bindQueue(queue_name, 'miimetiq', binding_key, {}, function(err, ok) {
                ch.consume(queue_name, function(msg) {
                    console.log(" [x] {}:{}".format(msg.fields.routingKey, msg.properties.correlationId));

                    var answer_msg = JSON.stringify({
                        status: "SUCCESS",
                        result: {
                            status: "OK"
                        },
                        task_id: msg.properties.correlationId
                    });
                    var task_id = msg.properties.correlationId.replace(/-/g, '');
                    ch.assertQueue(task_id, {}, function(err, ok) {
                        ch.bindQueue(task_id, 'celeryresults', task_id, {}, function(err, ok) {
                            ch.publish(
                                'celeryresults',
                                task_id,
                                new Buffer(answer_msg),
                                {contentType: 'application/json'}
                            );
                        });
                    });
                });
                console.log('[*] Waiting for messages. To exit press CTRL+C');
            });
        });
    });
});



