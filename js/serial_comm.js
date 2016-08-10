(function(window, undefined) {
  "use strict";
  const ENQ = 0x05;
  const ESC = 0x1B;
  const STX = 0x02;
  const ETX = 0x03;
  const allowedBitrates = [110, 300, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, 115200];
  const logOn = true;
  const storageKey = "serial-comm-devices"

  var serialComm = {
    myMessagesPort: undefined,
    clientWantsLine: {},
    devices: {},
    availablePorts: [],
    additionalPorts: [],
    bitrates: allowedBitrates,
    defaultBitrate: 9600,
    connections: {},
    onConfigDevicesReturn: new chrome.Event(),

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

    configDevices: function(callback) {
      for(var cwl in serialComm.clientWantsLine) {
        serialComm.clientWantsLine[cwl] = false;
      }
      if(callback) {
        if(!serialComm.onConfigDevicesReturn.hasListener(callback)) {
          serialComm.onConfigDevicesReturn.addListener(callback);
        }
        chrome.serial.getDevices(serialComm.onConfigDevicesWithCallback);
      }
      else {
        chrome.serial.getDevices(serialComm.onConfigDevices);
      }
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

    start: function(deviceId, deviceType, devicePath, deviceName, bitrate, reconnectOnError) {
      serialComm.devices[deviceId] = {
        deviceType: deviceType,
        devicePath: devicePath,
        deviceName: deviceName,
        bitrate: bitrate,
        reconnectOnError: reconnectOnError
      };

      // free any previous connections for this device
      if (serialComm.connections[deviceId]) {
        try {
          serialComm.connections[deviceId].disconnect();
        }
        catch(e) {}
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

      serialComm.connections[deviceId].onConnect.addListener(function(message) {
        if (message.success) {
          serialComm.log(deviceId, chrome.i18n.getMessage("connectedTo") + devicePath, new Error);
        }
        else {
          serialComm.log(deviceId, chrome.i18n.getMessage("errorOnConnect") + devicePath, new Error);
        }
        serialComm.myMessagesPort.postMessage({start: true, message: message, deviceId: deviceId});
      });

      serialComm.connections[deviceId].onReadLine.addListener(function(line) {
        serialComm.log(deviceId, chrome.i18n.getMessage("readLine") + line, new Error);
        if (serialComm.clientWantsLine[deviceId]) {
          serialComm.myMessagesPort.postMessage({deviceId: deviceId, readLine: true, message: line});
        }
      });

      serialComm.connections[deviceId].onError.addListener(function(error) {
        serialComm.log(deviceId, chrome.i18n.getMessage("error") + error, new Error);
        serialComm.myMessagesPort.postMessage({deviceId: deviceId, error: true, message: error});
      });

      if (devicePath) {
        try {
          serialComm.connections[deviceId].connect(devicePath, {bitrate: parseInt(bitrate)});
        }
        catch(e) {
          throw e;
        }
      }
    },

    onConfigDevices: function(devicePorts) {
      serialComm.availablePorts = devicePorts.concat(serialComm.additionalPorts);
      chooseDeviceWindow.show();
    },

    onConfigDevicesWithCallback: function(devicePorts) {
      serialComm.availablePorts = devicePorts.concat(serialComm.additionalPorts);
      serialComm.onConfigDevicesReturn.dispatch();
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