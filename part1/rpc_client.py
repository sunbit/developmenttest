# -*- coding: utf-8 -*-
import pika
import json
import uuid

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

binding_key = ("miimetiq.ds.writer.{TYPE}.{MODEL}.{DEVICE_ID}."
               "{INSTRUMENT}.{WRITER}").format(**locals())


class M2MRPCCLient(object):
    def __init__(self):
        self.connection = pika.BlockingConnection(
            pika.ConnectionParameters(
                host=HOST,
                credentials=pika.PlainCredentials(USERNAME, PASSWORD)))

        self.channel = self.connection.channel()

        result = self.channel.queue_declare(exclusive=True)
        self.callback_queue = result.method.queue

        self.channel.basic_consume(self.on_response, no_ack=True,
                                   queue=self.callback_queue)

    def on_response(self, ch, method, props, body):
        if self.corr_id == json.loads(body)['task_id']:
            self.response = body

    def call(self):
        self.response = None
        self.corr_id = str(uuid.uuid4())
        self.channel.basic_publish(exchange='miimetiq',
                                   routing_key=binding_key,
                                   properties=pika.BasicProperties(
                                       correlation_id=self.corr_id,
                                       content_type='text/plain'
                                   ),
                                   body='Prova missatge rpc client')

        while self.response is None:
            self.connection.process_data_events()
        return self.response

m2m_rpc = M2MRPCCLient()

print(" [x] Requesting rpc")
response = m2m_rpc.call()
print(" [.] Got %r" % response)
