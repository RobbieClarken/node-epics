# Information

EPICS Channel Access in node.js.

# Usage

<pre>
  var epics = require('../main');

  var pv = new epics.Channel('SR11BCM01:CURRENT_MONITOR');
  pv.on('value',function(data) {
    console.log('Current:',data);
  });
  pv.connect(function() {
    pv.monitor();
  });
</pre>
