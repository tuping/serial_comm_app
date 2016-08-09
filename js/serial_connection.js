//(function(window, undefined) {
  "use strict";
  const serial = chrome.serial;
  const MAX_SEND_TRIES = 3;

  function SerialConnection(deviceId, lineTerminator = "\n", reconnectOnError = false) {
    this.deviceId = deviceId;
    this.connectionId = -1;
    this.lineBuffer = "";
    this.boundOnReceive = this.onReceive.bind(this);
    this.boundOnReceiveError = this.onReceiveError.bind(this);
    this.boundOnSend = this.onSend.bind(this);
    this.onConnect = new chrome.Event();
    this.onReadLine = new chrome.Event();
    this.onError = new chrome.Event();
    this.lineTerminator = lineTerminator;
    this.reconnectOnError = reconnectOnError;
    this.sendTries = 0;
    this.lastMessage = undefined;
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
  SerialConnection.prototype.strUtf2ab = function(str) {
    var encodedString = unescape(encodeURIComponent(str));
    var bytes = new Uint8Array(encodedString.length);
    for (var i = 0; i < encodedString.length; ++i) {
      bytes[i] = encodedString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  /* Copy a string to a Uint8Array; returns the array buffer. */
  SerialConnection.prototype.strRaw2ab = function(str) {
    var bytes = new Uint8Array(str.length);
    for (var i = 0; i < str.length; ++i) {
      bytes[i] = str.charCodeAt(i);
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
      // resend if it there was an error before
      if (this.reconnectOnError && this.lastMessage) {
        this.sendArrayBuffer(this.lastMessage);
      }
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
    this.path = path;
    this.options = options;
    serial.connect(path, options, this.onConnectComplete.bind(this));
  };

  SerialConnection.prototype.onSend = function(sendInfo) {
    console.log("Send info for connectionId=" + this.connectionId.toString() + ":");
    console.log(sendInfo);
    if (this.reconnectOnError && sendInfo.bytesSent != this.lastMessage.byteLength) {
      // failure
      this.lastMessage.slice(sendInfo.bytesSent);
      this.resend();
    } else {
      // success
      this.sendTries = 0;
      this.lastMessage = undefined;
    }
  };

  SerialConnection.prototype.resend = function() {
    if(this.sendTries < MAX_SEND_TRIES) {
      this.sendTries++;
      this.connect(this.path, this.options);
    }
    else {
      throw "Resend: max send tries exceeded."
    }
  };

  SerialConnection.prototype.sendString = function(msg) {
    try {
      this.sendArrayBuffer(this.strRaw2ab(msg));
    }
    catch(e) {
      throw(e);
    }
  };

  SerialConnection.prototype.sendArrayBuffer = function(msg) {
    if (this.connectionId < 0) {
      throw "Invalid connection";
    }
    if (this.reconnectOnError) {
      this.lastMessage = msg;
    }
    serial.send(this.connectionId, msg, this.boundOnSend);
  };

  SerialConnection.prototype.disconnect = function() {
    if (this.connectionId < 0) {
      throw "Invalid connection";
    }
    serial.disconnect(this.connectionId, function() {});
  };

//})(window);
