# Information

EPICS Channel Access in node.js.

# Installation

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
