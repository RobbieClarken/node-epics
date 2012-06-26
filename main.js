var ca = require('./lib/ca');

//var pvName = 'SR11BCM01:CURRENT_MONITOR';
//var pvName = 'CR01OPI06:BOX_UP_TIME_MONITOR';
var pvName = 'CR01:GENERAL_ANALOG_05_MONITOR';
var pv = new ca.Channel(pvName);

pv.on('connection',function(data){
  console.log('connection:',data);
});

pv.on('value',function(data) {
  console.log('value:',data);
});

pv.connect(function(err){
  if(err) {
    console.log(err);
    return;
  }
  pv.monitor();
  /*
  pv.getPV({},function(err,data) {
    console.log('Get:',data);
  });
 */
});

var loop = function() {
  console.log('.');
  setTimeout(loop,5000);
};
loop();
