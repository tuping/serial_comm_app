(function(window, undefined) {
  "use strict";
  const serial = chrome.serial;
  const ENQ = 0x05;
  const ESC = 0x1B;
  const STX = 0x02;
  const ETX = 0x03;
  const allowedBitrates = [110, 300, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, 115200];
  const logOn = true;

  var serialComm = {
    myMessagesPort: undefined,
    clientWantsLine: {},
    devices: {},
    availablePorts: [],
    bitrates: allowedBitrates,
    defaultBitrate: 9600,
    connections: {},

    saveDevices: function() {
      var stringfiedDevices = JSON.stringify(serialComm.devices);
      window.localStorage.setItem('devices', stringfiedDevices);
    },

    loadDevices: function() {
      var stringfiedDevices = window.localStorage.getItem('devices');
      serialComm.devices = JSON.parse(stringfiedDevices);
    },

    log: function(deviceId, msg) {
      if (logOn) {console.log(deviceId + " - " + msg)};
    },

    sendString: function(deviceId, request) {
      serialComm.clientWantsLine[deviceId] = true;
      serialComm.connections[deviceId].sendString(request);
    },

    sendByte: function(deviceId, request) {
      var buf = new Uint8Array(1);
      buf[0] = request;
      serialComm.clientWantsLine[deviceId] = true;
      serialComm.connections[deviceId].sendByte(buf.buffer);
    },

    addListeners: function(messagesPort) {
      serialComm.myMessagesPort = messagesPort;
      serialComm.myMessagesPort.onMessage.addListener(
        function(request) {
          if (request.initialize) {
            serialComm.initialize();
          }
          else if (request.start) {
            serialComm.start(request.deviceId, request.devicePath, request.deviceName);
          }
          else if (request.getDevices) {
            serialComm.getDevices();
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

    getDevices: function(deviceId) {
      for(var cwl in serialComm.clientWantsLine) {
        serialComm.clientWantsLine[cwl] = false;
      }
      serial.getDevices(serialComm.onGetDevices);
    },

    initialize: function() {
      serialComm.devices = {};
    },

    start: function(deviceId, devicePath, deviceName, bitrate = serialComm.defaultBitrate) {
      serialComm.devices[deviceId] = {devicePath: devicePath, deviceName: deviceName, bitrate: bitrate};

      //if (serialComm.connections[deviceId] == undefined) {
        var lineTerminator;
        switch (deviceId) {
          case "arduino":
            lineTerminator = "\n";
            break;
          case "scale":
            lineTerminator = ETX;
            break;
          default:
            lineTerminator = "\n";
        }
        serialComm.connections[deviceId] = new SerialConnection(deviceId, lineTerminator);
      //}
      serialComm.clientWantsLine[deviceId] = false;

      serialComm.connections[deviceId].onConnect.addListener(function(message) {
        if (message.success) {
          serialComm.log(deviceId, chrome.i18n.getMessage("connectedTo") + devicePath);
        }
        else {
          serialComm.log(deviceId, chrome.i18n.getMessage("errorOnConnect") + devicePath);
        }
        serialComm.myMessagesPort.postMessage({start: true, message: message, deviceId: deviceId});
      });

      serialComm.connections[deviceId].onReadLine.addListener(function(line) {
        serialComm.log(deviceId, chrome.i18n.getMessage("readLine") + line);
        if (serialComm.clientWantsLine[deviceId]) {
          serialComm.myMessagesPort.postMessage({deviceId: deviceId, readLine: true, message: line});
        }
      });

      if (devicePath) {
        try {
          serialComm.connections[deviceId].connect(devicePath, {bitrate: bitrate});
        }
        catch(e) {
          throw e;
        }
      }
    },

    onGetDevices: function(devicePorts) {
      serialComm.availablePorts = devicePorts
      chooseDeviceWindow.show();
    },

    setDevice: function(deviceId, devicePath, bitrate) {
      var obj = serialComm.devices[deviceId];
      obj = {devicePath: devicePath, deviceName: obj.deviceName, bitrate: bitrate};
      serialComm.devices[deviceId] = obj;
      serialComm.myMessagesPort.postMessage(
        {deviceId: deviceId, deviceSet: true, devicePath: devicePath, bitrate: bitrate}
      );
    },

    getWeight: function(deviceId) {
      serialComm.sendByte(deviceId, ENQ);
    }

  }
  window.serialComm = serialComm;
})(window);