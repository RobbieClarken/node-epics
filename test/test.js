var epics = require('../main');

var pv = new epics.Channel('SR11BCM01:CURRENT_MONITOR');
pv.on('value',function(data) {
  console.log('Current:',data);
});
pv.connect(function() {
  pv.monitor();
});

var loop = function() {
  setTimeout(loop,5000);
};
loop();
