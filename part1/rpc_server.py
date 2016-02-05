# -*- coding: utf-8 -*-
import pika
import json

MODEL = "6‐diesel_generator_schema"
INSTANCE_NAME = "test_dg"
HOST = "localhost"
USERNAME = "{model}/{instance_name}".format(
    model=MODEL,
    instance_name=INSTANCE_NAME)

PASSWORD = "anypass"
DEVICE_ID = "56090580e7e466125aa1c0a5"
INSTRUMENT = "generator"
WRITER = "power"
TYPE = "boolean"
connection = pika.BlockingConnection(
    pika.ConnectionParameters(
        host=HOST,
        credentials=pika.PlainCredentials('guest', 'guest')))

channel = connection.channel()
result = channel.queue_declare()
queue_name = result.method.queue
binding_key = ("miimetiq.ds.writer.{TYPE}.{MODEL}.{DEVICE_ID}."
               "{INSTRUMENT}.{WRITER}").format(**locals())

channel.queue_bind(exchange='miimetiq',
                   queue=queue_name,
                   routing_key=binding_key)

print '[*] Waiting for messages. To exit press CTRL+C'


def callback(ch, method, properties, body):
    print" [x] %r:%r" % (method.routing_key, body,)
    task_id = properties.correlation_id
    answer_msg = json.dumps({
        "status": "SUCCESS",
        "result": {
            "status": "OK"
        },
        "task_id": task_id
    })

    channel.queue_declare(queue=task_id.replace('-', ''),
                          auto_delete=True,
                          durable=True,
                          arguments={"x‐expires": 60 * 1000})

    channel.queue_bind(exchange='celeryresults',
                       queue=task_id.replace('-', ''),
                       routing_key=task_id.replace('-', ''))

    channel.basic_publish(exchange='celeryresults',
                          routing_key=task_id.replace('-', ''),
                          body=answer_msg,
                          properties=pika.BasicProperties(
                              content_type='application/json'))

channel.basic_consume(callback,
                      queue=queue_name,
                      no_ack=True)

channel.start_consuming()
