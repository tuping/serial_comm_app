//(function(window, undefined) {
  "use strict";
  const serial = chrome.serial;

  function SerialConnection(deviceId, lineTerminator = "\n") {
    this.deviceId = deviceId;
    this.connectionId = -1;
    this.lineBuffer = "";
    this.boundOnReceive = this.onReceive.bind(this);
    this.boundOnReceiveError = this.onReceiveError.bind(this);
    this.onConnect = new chrome.Event();
    this.onReadLine = new chrome.Event();
    this.onError = new chrome.Event();
    this.lineTerminator = lineTerminator;
  };

  /* Interprets an ArrayBuffer as UTF-8 encoded string data. */
  SerialConnection.prototype.ab2str = function(buf, lineTerminator = undefined) {
    var bufView = new Uint8Array(buf);
    // transforms lineTerminator byte into "\n" byte
    if (lineTerminator) {
      bufView.forEach(function(item,i) { if (item == lineTerminator) bufView[i]="\n".charCodeAt()});
    }
    var encodedString = String.fromCharCode.apply(null, bufView);
    return decodeURIComponent(escape(encodedString));
  };

  /* Converts a string to UTF-8 encoding in a Uint8Array; returns the array buffer. */
  SerialConnection.prototype.str2ab = function(str) {
    var encodedString = unescape(encodeURIComponent(str));
    var bytes = new Uint8Array(encodedString.length);
    for (var i = 0; i < encodedString.length; ++i) {
      bytes[i] = encodedString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  SerialConnection.prototype.onConnectComplete = function(connectionInfo) {
    var ret = {success: true};
    if(chrome.runtime.lastError || !connectionInfo) {
      console.log("Connection failed.");
      console.log(chrome.runtime.lastError);
      ret = {error: true};
    }
    else {
      this.connectionId = connectionInfo.connectionId;
      serial.onReceive.addListener(this.boundOnReceive);
      serial.onReceiveError.addListener(this.boundOnReceiveError);
    }
    this.onConnect.dispatch(ret);
  };

  SerialConnection.prototype.onReceive = function(receiveInfo) {
    if (receiveInfo.connectionId !== this.connectionId) {
      return;
    }

    this.lineBuffer += this.ab2str(receiveInfo.data, this.lineTerminator);

    var index;
    while ((index = this.lineBuffer.indexOf("\n")) >= 0) {
      var line = this.lineBuffer.substr(0, index + 1);
      this.onReadLine.dispatch(line);
      this.lineBuffer = this.lineBuffer.substr(index + 1);
    }
  };

  SerialConnection.prototype.onReceiveError = function(errorInfo) {
    if (errorInfo.connectionId === this.connectionId) {
      this.onError.dispatch(errorInfo.error);
    }
  };

  SerialConnection.prototype.connect = function(path, options = {}) {
    serial.connect(path, options, this.onConnectComplete.bind(this));
  };

  SerialConnection.prototype.sendString = function(msg) {
    if (this.connectionId < 0) {
      throw "Invalid connection";
    }
    serial.send(this.connectionId, this.str2ab(msg), function() {});
  };

  SerialConnection.prototype.sendByte = function(msg) {
    if (this.connectionId < 0) {
      throw "Invalid connection";
    }
    serial.send(this.connectionId, msg, function() {});
  };

  SerialConnection.prototype.disconnect = function() {
    if (this.connectionId < 0) {
      throw "Invalid connection";
    }
    serial.disconnect(this.connectionId, function() {});
  };

//})(window);
