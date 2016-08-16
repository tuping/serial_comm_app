(function(window, undefined) {
  "use strict";
  const ENQ = 0x05;
  const ESC = 0x1B;
  const STX = 0x02;
  const ETX = 0x03;
  const allowedBitrates = [110, 300, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, 115200];
  const logOn = false; // show logs messagens
  const storageKey = "serial-comm-devices";

  var serialComm = {
    myMessagesPort: undefined,
    clientWantsLine: {},
    devices: {},
    availablePorts: [],
    additionalPorts: [],
    bitrates: allowedBitrates,
    defaultBitrate: 9600,
    connections: {},
    onGetDevicesReturn: new chrome.Event(),

    saveDevices: function() {
      var stringfiedDevices = JSON.stringify(serialComm.devices);
      var obj = {};
      obj[storageKey] = stringfiedDevices;
      chrome.storage.local.clear();
      chrome.storage.local.set(obj);
    },

    log: function(deviceId, msg, error) {
      if (logOn) {
        console.log(deviceId + " - " + msg);
        console.log(error.stack);
      };
    },

    sendString: function(deviceId, request) {
      serialComm.clientWantsLine[deviceId] = true;
      serialComm.connections[deviceId].sendString(request);
    },

    sendByte: function(deviceId, request) {
      var buf = new Uint8Array(1);
      buf[0] = request;
      serialComm.clientWantsLine[deviceId] = true;
      serialComm.connections[deviceId].sendArrayBuffer(buf.buffer);
    },

    addListeners: function(messagesPort) {
      serialComm.myMessagesPort = messagesPort;
      serialComm.myMessagesPort.onMessage.addListener(
        function(request) {
          if (request.initialize) {
            serialComm.initialize(request.devices, request.additionalPorts);
          }
          else if (request.start) {
            serialComm.start(request.deviceId, request.deviceType, request.devicePath, request.deviceName, request.bitrate, request.reconnectOnError);
          }
          else if (request.configDevices) {
            serialComm.configDevices();
          }
          else if (request.restartDevices) {
            serialComm.restartDevices();
          }
          else if (request.getWeight) {
            serialComm.getWeight(request.deviceId);
          }
          else if (request.message) {
            serialComm.sendString(request.deviceId, request.message);
          }
        }
      );
    },

    restartDevices: function() {
      serialComm.startDevices();
    },

    configDevices: function() {
      for(var cwl in serialComm.clientWantsLine) {
        serialComm.clientWantsLine[cwl] = false;
      }
      chrome.serial.getDevices(serialComm.onGetDevices);
    },

    getDevices: function(callback) {
      if(!serialComm.onGetDevicesReturn.hasListener(callback)) {
        serialComm.onGetDevicesReturn.addListener(callback);
      }
      chrome.serial.getDevices(serialComm.onGetDevicesWithCallback);
    },

    initialize: function(devices, additionalPorts) {
      serialComm.devices = devices;
      if (additionalPorts) {
        try {
          var addPorts = JSON.parse("[" + additionalPorts + "]");
          serialComm.additionalPorts = addPorts.map(function(value, index) {
            return {displayName: value, path: value};
          });
        }
        catch(e) {
          serialComm.additionalPorts = [];
        }
      }
      chrome.storage.local.get(storageKey,
        function(item) {
          var stringfiedDevices = item[storageKey];
          if (stringfiedDevices) {
            serialComm.devices = serialComm.mergeDeviceConfig(serialComm.devices, JSON.parse(stringfiedDevices));
          }
          serialComm.startDevices();
        }
      );
    },

    mergeDeviceConfig: function(devices, devicesConfig) {
      var merged = {}
      for (var d in devices) {
        merged[d] = devices[d];
        if(devicesConfig[d]) {
          merged[d].devicePath = devicesConfig[d].devicePath || devices[d].devicePath;
          merged[d].bitrate = devicesConfig[d].bitrate || devices[d].bitrate;
        }
      }
      return merged;
    },

    startDevices: function() {
      for (var deviceId in serialComm.devices) {
        var d = serialComm.devices[deviceId];
        if (d.devicePath) {
          serialComm.start(deviceId, d.deviceType, d.devicePath, d.deviceName, d.bitrate, d.reconnectOnError);
        }
      }
    },

    handleOnConnect: function(deviceId, devicePath, message) {
      if (message.success) {
        serialComm.log(deviceId, chrome.i18n.getMessage("connectedTo") + devicePath, new Error);
      }
      else {
        serialComm.log(deviceId, chrome.i18n.getMessage("errorOnConnect") + devicePath, new Error);
      }
      serialComm.myMessagesPort.postMessage({start: true, message: message, deviceId: deviceId});
    },

    handleOnReadLine: function(deviceId, line) {
      serialComm.log(deviceId, chrome.i18n.getMessage("readLine") + line, new Error);
      if (serialComm.clientWantsLine[deviceId]) {
        serialComm.myMessagesPort.postMessage({deviceId: deviceId, readLine: true, message: line});
      }
    },

    handleOnError: function(deviceId, error) {
      serialComm.log(deviceId, chrome.i18n.getMessage("error") + error, new Error);
      serialComm.myMessagesPort.postMessage({deviceId: deviceId, error: true, message: error});
    },

    stop: function(deviceId) {
      var c = serialComm.connections[deviceId];
      serialComm.clientWantsLine[deviceId] = false;
      if (c.onConnect.hasListener(serialComm.handleOnConnect)) {
        c.onConnect.removeListener(serialComm.handleOnConnect);
      }
      if (c.onReadLine.hasListener(serialComm.handleOnReadLine)) {
        c.onReadLine.removeListener(serialComm.handleOnReadLine);
      }
      if (c.onError.hasListener(serialComm.handleOnError)) {
        c.onError.removeListener(serialComm.handleOnError);
      }

      try {
        c.disconnect();
      }
      catch(e) {}
    },

    start: function(deviceId, deviceType, devicePath, deviceName, bitrate, reconnectOnError) {
      serialComm.devices[deviceId] = {
        deviceType: deviceType,
        devicePath: devicePath,
        deviceName: deviceName,
        bitrate: bitrate,
        reconnectOnError: reconnectOnError
      };

      // free any previous connections for this device and removes listeners
      if (serialComm.connections[deviceId]) {
        serialComm.stop(deviceId);
        serialComm.connections[deviceId] = undefined;
      }

      // new connection for this device
      var lineTerminator;
      switch (deviceType) {
        case "arduino":
          lineTerminator = "\n";
          break;
        case "scale":
          lineTerminator = ETX;
          break;
        default:
          lineTerminator = "\n";
      }
      serialComm.connections[deviceId] = new SerialConnection(deviceId, lineTerminator, reconnectOnError);
      serialComm.clientWantsLine[deviceId] = false;

      var c = serialComm.connections[deviceId];
      c.onConnect.addListener(serialComm.handleOnConnect);
      c.onReadLine.addListener(serialComm.handleOnReadLine);
      c.onError.addListener(serialComm.handleOnError);

      if (devicePath) {
        try {
          serialComm.connections[deviceId].connect(devicePath, {bitrate: parseInt(bitrate)});
        }
        catch(e) {
          throw e;
        }
      }
    },

    onGetDevices: function(devicePorts) {
      serialComm.availablePorts = devicePorts.concat(serialComm.additionalPorts);
      configDevicesWindow.show();
    },

    onGetDevicesWithCallback: function(devicePorts) {
      serialComm.availablePorts = devicePorts.concat(serialComm.additionalPorts);
      serialComm.onGetDevicesReturn.dispatch();
    },

    setDevice: function(deviceId, devicePath, bitrate) {
      var obj = serialComm.devices[deviceId];
      obj = {deviceType: obj.deviceType, devicePath: devicePath, deviceName: obj.deviceName, bitrate: bitrate};
      serialComm.devices[deviceId] = obj;
      serialComm.myMessagesPort.postMessage({
        deviceId: deviceId,
        deviceSet: true,
        deviceType: obj.deviceType,
        devicePath: devicePath,
        bitrate: bitrate
      });
    },

    getWeight: function(deviceId) {
      serialComm.sendByte(deviceId, ENQ);
    }

  }
  window.serialComm = serialComm;
})(window);