#!/usr/bin/env python
from pcaspy import SimpleServer, Driver
"""
Hosts EPICS channels for testing the epics node.js module.
Requires the pcaspy package available at:
https://code.google.com/p/pcaspy/
"""

prefix = 'NODE_EPICS_TEST:'
pvdb = {
    'STRING' : {
        'type': 'string',
        'value': 'all good'
    },
    'INT' : {
        'type': 'int',
        'value': 7
    },
    'FLOAT' : {
        'type': 'float',
        'value': 5.13
    },
    'ENUM' : {
        'type': 'enum',
        'enums': ['Option 1', 'Option 2', 'Option 3'],
        'value': 1
    },
    'CHAR' : {
        'type': 'char',
        'value': 73
    }
}

class testDriver(Driver):
    def __init__(self):
        super(testDriver, self).__init__()

server = SimpleServer()
server.createPV(prefix, pvdb)

driver = testDriver()

while True:
    server.process(.1)

