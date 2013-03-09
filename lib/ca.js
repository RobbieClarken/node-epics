var ffi = require('ffi')
  , ref = require('ref')
  , EventEmitter = require('events').EventEmitter
  , dbr = require('./codes').dbr
  , mask = require('./codes').mask
  , state = require('./codes').state
  , nativeType = require('./codes').nativeType
  , StructType = require('ref-struct')
  , ArrayType = require('ref-array')
  , path = require('path');

module.exports = ca = {};
ca.Channel = Channel;

var LIBCA_PATH = process.env.NODE_EPICS_LIBCA;
if(!LIBCA_PATH) {
  LIBCA_PATH = path.join(process.env.EPICS_BASE, 'lib', process.env.EPICS_HOST_ARCH, 'libca');
}
var MAX_STRING_SIZE = 40;

var chanId = ref.types.long
  , evid = ref.types.long
  , chtype = ref.types.long;

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
  ca_state: ['short',[ chanId ]],
  ca_element_count: ['int',[ 'long' ]],
  ca_name: ['string',[ 'long' ]],
  ca_array_get: ['int',['int','ulong',chanId,'pointer']],
  ca_array_get_callback: ['int',['int','ulong',chanId,'pointer','pointer']],
  ca_array_put_callback: ['int', [chtype, 'ulong', chanId, 'pointer',
                                  'pointer', 'pointer']],
  ca_create_subscription: ['int',['int','ulong',chanId,'long','pointer','pointer','pointer']],
  ca_clear_subscription: ['int', [evid]],
  ca_clear_channel: ['int', [chanId]]
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

function stringArrayToBuffer(array) {
  var count = array.length;
  var buf = new Buffer(count * MAX_STRING_SIZE);
  for(var i = 0; i < count; i += 1) {
    ref.writeCString(buf, i * MAX_STRING_SIZE, array[i]);
  }
  return buf;
}

function coerceBufferToNativeType(buf, dbrType, count) {
  var array = [];
  if(dbrType === dbr.STRING) {
    var bufRef = ref.reinterpret(buf, count * MAX_STRING_SIZE);
    for(var i = 0; i < count; i++) {
      array.push(bufRef.readCString(i * MAX_STRING_SIZE));
    }
  } else {
    var GetArrayType = ArrayType(ref.types[nativeType[dbrType]]);
    var array = new GetArrayType(buf);
    array.length = count;
    array = array.toArray();
  }
  if (count === 1) {
    return array[0];
  } else {
    return array;
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
  var monitorCallbackPtr = null; 
  var monitorEventIdPtr = null;
  var getCallbackPtrs = [];

  var connectionStateChangePtr = null;

  self.pvName = pvName;
  self.state = function() {
    if (!self.chid) {
      return state.CS_CLOSED;
    }
    return libca.ca_state(self.chid);
  };
  self.connected = function() {
    return self.state() === state.CS_CONN;
  };
  self.connect = function(options, callback) {
    if (typeof options === 'undefined') {
      callback = null;
      options = {};
    } else if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    var timeout = options.timeout || 2000;

    var chidPtr = new Buffer(chanId.size);
    chidPtr.writeInt64LE(0, 0)
    chidPtr.type = chanId;

    // Not implementing this yet
    var userDataPtr = null;
    var priority = 0;
    var initialCallbackDone = false;
    
    connectionStateChangePtr = new ffi.Callback('int',['pointer','long'],function(chid,ev) {
      caFieldType = libca.ca_field_type(self.chid);
      count = libca.ca_element_count(self.chid);
      self.emit('connection',ev);
      if (!initialCallbackDone) {
        initialCallbackDone = true;
        var err = null;
        if(self.state() !== state.CS_CONN) {
          err = new Error('Connection not established.');
        }
        if(callback) {
          callback(err);
        }
      }
      return 0;
    });
    var err = libca.ca_create_channel(self.pvName,connectionStateChangePtr,userDataPtr,priority,chidPtr);
    pend();
    self.chid = chidPtr.deref();
    if(err !== state.ECA_NORMAL) {
      initialCallbackDone = true;
      if(callback) {
        callback(new Error(message(err)));
      }
    }
    setTimeout(function() {
      if(self.state() === state.CS_NEVER_CONN) {
        initialCallbackDone = true;
        if(callback) {
          callback(new Error('Never connected.'));
        }
      }
    }, timeout);
    return self;
  };
  self.disconnect = function(callback) {
    var err = null;
    if (monitorEventIdPtr) {
      var errCode = libca.ca_clear_subscription(monitorEventIdPtr.deref());
      pend();
      if (errCode !== state.ECA_NORMAL) {
        err = new Error(message(errCode));
      }
    }
    if (self.chid) {
      var errCode = libca.ca_clear_channel(self.chid);
      if (!err && errCode !== state.ECA_NORMAL) {
        err = new Error(message(clearErr));
      }
    }
    pend();
    self.chid = null;
    if (callback) {
      callback(err);
    }
  };
  self.get = function(options,callback) {
    if('function' === typeof options) {
      callback = options;
      options = {};
    }
    var getCallbackPtr = new ffi.Callback('void',[evargs_t],function(args) {
      if(state.ECA_NORMAL !== args.status) {
        callback(new Error(message(args.status)));
      }
      var value = coerceBufferToNativeType(args.dbr, args.type, count);
      callback(null, value);
      getCallbackPtrs.splice(getCallbackPtrs.indexOf(getCallbackPtr), 1);
    });
    getCallbackPtrs.push(getCallbackPtr);
    var usrArg = null;
    var err = libca.ca_array_get_callback(caFieldType,count,self.chid,getCallbackPtr,usrArg);
    pend();
    return self;
  };
  self.monitor = function() {
    monitorEventIdPtr = ref.alloc(ref.types.size_t);
    monitorCallbackPtr = new ffi.Callback('void',[evargs_t],function(args) {
      var value = coerceBufferToNativeType(args.dbr, args.type, count);
      self.emit('value',value);
    });
    var usrArg = null;
    var err = libca.ca_create_subscription(caFieldType,count,self.chid,mask.DBE_VALUE,monitorCallbackPtr,usrArg,monitorEventIdPtr);
    pend();
    return self;
  };
  self.put = function(value, callback) {
    var putCallbackPtr = new ffi.Callback('void', [evargs_t], function(args) {
      var err = null;
      if (args.status !== state.ECA_NORMAL) {
        err = new Error('Error putting value.');
      }
      if(callback) {
        callback(err);
      }
    });
    var usrArg = null;
    if (!Array.isArray(value)) {
      value = [ value ];
    }
    var count = value.length;
    var buf;
    if (caFieldType === dbr.STRING) {
      buf = stringArrayToBuffer(value);
    } else {
      var PutArrayType = ArrayType(ref.types[nativeType[caFieldType]]);
      var array = new PutArrayType(value);
      buf = array.buffer;
    }
    var errCode = libca.ca_array_put_callback(caFieldType, count,
                                          self.chid, buf, putCallbackPtr,
                                          usrArg);
    pend();
    if (errCode !== state.ECA_NORMAL) {
      callback(new Error(message(errCode)));
    }
  };
}

Channel.super_ = EventEmitter;
Channel.prototype = Object.create(EventEmitter.prototype, {
  constructor: {
    value: Channel,
    enumerable: false
  }
});
