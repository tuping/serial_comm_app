"use strict";

// ID of the extension we want to talk to.
var appId;
// = "jcepndooaohiadigbdbcblpgbndkdkhh";
//appId = "naotem";

var messages = {
  notFoundPleaseInstall: "Por favor instale o aplicativo Serial Comm para Google Chrome.",
  deviceNotFound: "Dispositivo serial não foi encontrado.",
  chromeApiNotAvaialable: "API do Chrome indisponível. Favor utilizar o navegador Google Chrome.",
  disconnectedMessagePort: "Erro na comunicação com a extensão. Recarregue a página.", //"Error: Attempting to use a disconnected port object"
  disableSerialInterfaceError: "Erro no dispositivo: "
}

var detected = false;
var is_on = false;
var myMessagesPort;
var myDevices = {}; // hash with deviceId => {deviceType, devicePath, deviceName}
var myAdditionalPorts;

var collectDataFromDom = function() {
  //get app id
  try {
    appId = document.querySelector("[data-serial-comm-app-id]").dataset.serialCommAppId;
  } catch(e) {
    appId = undefined;
  }
  if (appId) {
    //get additional ports
    try {
      myAdditionalPorts = document.querySelector("[data-serial-comm-additional-ports]").dataset.serialCommAdditionalPorts;
    } catch(e) {
      myAdditionalPorts = [];
    }

    // set up hash with devices ids, disable all commands
    var e = document.querySelectorAll("[data-serial-comm-id]");
    for(var i = 0; i < e.length; ++i) {
      myDevices[e[i].dataset.serialCommId]={
        deviceType: e[i].dataset.serialCommType || (myDevices[e[i].dataset.serialCommId] && myDevices[e[i].dataset.serialCommId].deviceType),
        devicePath: e[i].dataset.serialCommPath || (myDevices[e[i].dataset.serialCommId] && myDevices[e[i].dataset.serialCommId].devicePath),
        deviceName: e[i].dataset.serialCommName || (myDevices[e[i].dataset.serialCommId] && myDevices[e[i].dataset.serialCommId].deviceName),
        reconnectOnError: e[i].dataset.serialCommReconnectOnError || (myDevices[e[i].dataset.serialCommId] && myDevices[e[i].dataset.serialCommId].reconnectOnError)
      }
      e[i].disabled = true;
    }

    // add DOM event listeners
    e = document.querySelectorAll("[data-serial-comm]");
    for(var i = 0; i < e.length; ++i) {
      switch(e[i].dataset.serialComm) {
        case "commandTest":
          e[i].addEventListener("click", function(event) {
            showDeviceMessage(event.target.dataset.serialCommId,"");
            is_on = !is_on;
            myMessagesPort.postMessage({deviceId: event.target.dataset.serialCommId, message: (is_on ? "y" : "n")});
          });
        break;
        case "commandWeight":
          e[i].addEventListener("click", function(event) {
            showDeviceMessage(event.target.dataset.serialCommId,"");
            myMessagesPort.postMessage({deviceId: event.target.dataset.serialCommId, getWeight: true});
          });
        break;
        case "commandPrint":
          e[i].addEventListener("click", function(event) {
            myMessagesPort.postMessage({deviceId: event.target.dataset.serialCommId, message: document.getElementById(event.target.dataset.serialCommDatafieldId).value});
          });
          break;
        case "configDevices":
          e[i].addEventListener("click", function(event) {
            configDevices();
          });
        break;
        case "restartDevices":
          e[i].addEventListener("click", function(event) {
            restartDevices();
          });
        break;
      }
    }
  }
}

var initialize = function() {
  myMessagesPort.postMessage({
    initialize: true,
    devices: myDevices,
    additionalPorts: myAdditionalPorts
  });
}

var disableSerialInterface = function(deviceId) {
  var e = document.querySelectorAll("[data-serial-comm-id=" + deviceId + "]");
  for(var i = 0; i < e.length; ++i) {
    //check for disable on error
    if(e[i].dataset.serialCommDisableOnError) {
      e[i].disabled = true;
    }
    //check for display error
    if(e[i].dataset.serialCommDisplayError) {
      try {
        e[i].value = messages.disableSerialInterfaceError + deviceId;
      }
      catch(error) {
        e[i].innerHTML = messages.disableSerialInterfaceError + deviceId;
      }
    }
  }
}

var enableSerialInterface = function(deviceId) {
  var e = document.querySelectorAll("[data-serial-comm-id=" + deviceId + "]");
  for(var i = 0; i < e.length; ++i) {
    e[i].disabled = false;
  }
  showDeviceMessage(deviceId,"");
}

var addListeners = function() {
  myMessagesPort.onMessage.addListener(processMessages);
}

var processMessages = function(request) {
  console.log(request);
  if (request.start) {
    if(request.message.success) {
      enableSerialInterface(request.deviceId);
    }
    else if (request.message.error) {
      disableSerialInterface(request.deviceId);
    }
  }
  else if (request.deviceSet) {
    if (request.devicePath) {
      var obj = myDevices[request.deviceId];
      obj.devicePath = request.devicePath;
      obj.bitrate = request.bitrate;
      myDevices[request.deviceId] = obj;
      startDevice(request.deviceId);
    }
    else {
      cancelApp(messages.deviceNotFound);
    }
  }
  else if (request.readLine) {
    enableSerialInterface(request.deviceId);
    showDeviceMessage(request.deviceId, request.message);
  }
  else if (request.error) {
    disableSerialInterface(request.deviceId);
  }
}

var showDeviceMessage = function(deviceId, message) {
  var e = document.querySelectorAll("[data-serial-comm=result][data-serial-comm-id=" + deviceId + "]");
  for(var i = 0; i < e.length; ++i) {
    try {
      e[i].value = message;
    }
    catch(error) {
      e[i].innerHTML = message;
    }
  }
}

var cancelApp = function(reason) {
  alert(reason);
}

var log = function(msg) {
  var buffer = document.querySelector("#buffer");
  buffer.innerHTML += msg + "<br/>";
}

var detect = function() {
  collectDataFromDom();
  if (appId) {
    var message = {ping: true}
    try {
      myMessagesPort = chrome.runtime.connect(appId);
      chrome.runtime.sendMessage(
        appId,
        message,
        function(response) {
          if (response) {
            console.log(response);
            detected = true;
            addListeners();
            initialize();
          }
          else {
            alert(messages.notFoundPleaseInstall);
          }
        }
      );
      return true;
    } catch(err) {
      alert(messages.chromeApiNotAvaialable);
      return false;
    }
  }
}

var startDevice = function(deviceId) {
  myMessagesPort.postMessage({
    start: true,
    deviceId: deviceId,
    deviceType: myDevices[deviceId].deviceType,
    devicePath: myDevices[deviceId].devicePath,
    deviceName: myDevices[deviceId].deviceName,
    bitrate: myDevices[deviceId].bitrate,
    reconnectOnError: myDevices[deviceId].reconnectOnError
  });
}

var restartDevices = function() {
  try {
    myMessagesPort.postMessage({restartDevices: true});
  }
  catch (e) {
    detect(appId);
  }
}

var configDevices = function() {
  try {
    myMessagesPort.postMessage({configDevices: true});
  }
  catch (e) {
    detect(appId);
  }
}

var setDevice = function() {
  myMessagesPort.postMessage({setDevice: true});
}

// Start-up
detect();