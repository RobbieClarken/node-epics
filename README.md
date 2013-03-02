# Information

EPICS Channel Access in node.js.

# Installation

```bash
npm install epics
```

Ensure either `EPICS_BASE` and `EPICS_HOST_ARCH` are set or
```bash
export NODE_EPICS_LIBCA=/path/to/libca
```

# Usage

```javascript
var epics = require('epics');

var pv = new epics.Channel('SR11BCM01:CURRENT_MONITOR');
pv.on('value',function(data) {
  console.log('Current:',data);
});
pv.connect(function() {
  pv.monitor();
});
```

# Tests

Tests can be run against an included IOC written in python and using the [pcaspy](https://code.google.com/p/pcaspy/) package.

To run the tests, install pcaspy and then run:

```bash
npm test
```
