#!/usr/bin/env python
from pcaspy import SimpleServer, Driver
"""
Hosts EPICS channels for testing the epics node.js module.
Requires the pcaspy package available at:
https://code.google.com/p/pcaspy/
"""

prefix = 'NODE_EPICS_TEST:'
pvdb = {
    'CONNECTION': {
        'type': 'int',
        'value': 2
    },
    'STRING' : {
        'type': 'string',
        'value': 'a sufficiently long string'
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
    },
    'INT_WAVEFORM' : {
        'type': 'int',
        'count': 5,
        'value': [5, 4, 3, 2, 1]
    },
    'FLOAT_WAVEFORM' : {
        'type': 'float',
        'count': 3,
        'value': [5.1, 4.2, 3.3]
    },
    'STRING_WAVEFORM' : {
        'type': 'string',
        'count': 3,
        'value': ['A39CharacterLongStringWhichIsTheMaximum',
                  'another string',
                  '& 1 more']
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

