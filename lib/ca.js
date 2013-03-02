var ffi = require('ffi')
  , ref = require('ref')
  , EventEmitter = require('events').EventEmitter
  , dbr = require('./codes').dbr
  , mask = require('./codes').mask
  , state = require('./codes').state
  , nativeType = require('./codes').nativeType
  , StructType = require('ref-struct')
  , path = require('path');

module.exports = ca = {};
ca.Channel = Channel;

var LIBCA_PATH = process.env.NODE_EPICS_LIBCA;
if(!LIBCA_PATH) {
  LIBCA_PATH = path.join(process.env.EPICS_BASE, 'lib', process.env.EPICS_HOST_ARCH, 'libca');
}

var chanId = ref.types.long;

var libca = ffi.Library(LIBCA_PATH,{
  ca_message: ['string',['int']],
  ca_context_create: ['int',['int']],
  ca_current_context: ['int',[]],
  ca_pend_event: ['int',['float']],
  ca_pend_io: ['int',['float']],
  ca_test_io: ['int',[]],
  ca_create_channel: ['int',['string','pointer','pointer','int','pointer']],
  ca_host_name: ['string',['long']],
  ca_field_type: ['short',['long']],
  ca_state: ['short',[ 'long' ]],
  ca_element_count: ['int',[ 'long' ]],
  ca_name: ['string',[ 'long' ]],
  ca_array_get: ['int',['int','ulong',chanId,'pointer']],
  ca_array_get_callback: ['int',['int','ulong',chanId,'pointer','pointer']],
  ca_create_subscription: ['int',['int','ulong',chanId,'long','pointer','pointer','pointer']]
});

ca.context = function(){
  if(!_context) {
    _context = libca.ca_context_create(1);
  }
  return _context;
};

var _context = ca.context();

function message(code) {
  return libca.ca_message(code);
};

function pend() {
  libca.ca_pend_event(pendDelay);
  libca.ca_pend_io(pendDelay);
}

function coerceBufferToNativeType(buffer, dbrType) {
    if(dbrType === dbr.STRING) {
      return buffer.toString();
    } else {
      var cType = ref.types[nativeType[dbrType]];
      var dbrPtr = buffer.ref().readPointer(0,cType.size);
      dbrPtr.type = cType;
      return dbrPtr.deref();
    }
}

var pendDelay = 1.e-5;
var size_tPtr = ref.refType(ref.types.size_t);
var dblPtr = ref.refType(ref.types.double);

var evargs_t = StructType({
  usr: size_tPtr,
  chid: chanId,
  type: ref.types.long,
  count: ref.types.long,
  dbr: size_tPtr,
  status: ref.types.int
});

function Channel(pvName) {
  var self = this;
  EventEmitter.call(self);
  var caFieldType = 0;
  var count = 0;

  self.pvName = pvName;
  self.state = function() {
    return libca.ca_state(self.chid);
  };
  self.connect = function(callback) {
    var chidPtr = new Buffer(chanId.size);
    chidPtr.writeInt64LE(0, 0)
    chidPtr.type = chanId;

    // Not implementing this yet
    var userDataPtr = null;
    var priority = 0;
    var initialCallbackDone = false;
    
    var connectionStateChangePtr = new ffi.Callback('int',['pointer','long'],function(chid,ev) {
      caFieldType = libca.ca_field_type(self.chid);
      count = libca.ca_element_count(self.chid);
      self.emit('connection',ev);
      if (!initialCallbackDone) {
        initialCallbackDone = true;
        var err = 0;
        if(self.state() !== state.CS_CONN) {
          err = new Error('Connection not established.');
        }
        callback(err);
      }
      return 0;
    });
    var err = libca.ca_create_channel(self.pvName,connectionStateChangePtr,userDataPtr,priority,chidPtr);
    pend();
    var chid = self.chid = chidPtr.deref();
    if(err !== state.ECA_NORMAL) {
      initialCallbackDone = true;
      callback(new Error(message(err)));
    }
    return self;
  };
  self.get = function(options,callback) {
    if('function' === typeof options) {
      callback = options;
      options = {};
    }
    var valuePtr = new Buffer(ref.sizeof.size_t);
    valuePtr.type = ffi.types['size_t'];
    var getCallbackPtr = new ffi.Callback('void',[evargs_t],function(args) {
      if(state.ECA_NORMAL !== args.status) {
        callback(new Error(message(args.status)));
      }
      var value = coerceBufferToNativeType(args.dbr, args.type);
      callback(0, value);
    });
    process.on('exit', function() {
      // Hold on to a reference to the callback pointer
      getCallbackPtr;
    });
    var err = libca.ca_array_get_callback(caFieldType,count,self.chid,getCallbackPtr,valuePtr);
    pend();
    return self;
  };
  self.monitor = function() {
    var monitorCallbackPtr = new ffi.Callback('void',[evargs_t],function(args) {
      var value = coerceBufferToNativeType(args.dbr, args.type);
      self.emit('value',value);
    });
    process.on('exit', function() {
      // Hold on to a reference to the callback pointer
      monitorCallbackPtr;
    });
    var err = libca.ca_create_subscription(caFieldType,count,self.chid,mask.DBE_VALUE,monitorCallbackPtr,null,null);
    pend();
    return self;
  };
}

Channel.super_ = EventEmitter;
Channel.prototype = Object.create(EventEmitter.prototype, {
  constructor: {
    value: Channel,
    enumerable: false
  }
});
