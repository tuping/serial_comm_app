"use strict";

// ID of the extension we want to talk to.
var appId;
// = "jcepndooaohiadigbdbcblpgbndkdkhh";
//appId = "naotem";

var messages = {
  notFoundPleaseInstall: "Por favor instale o aplicativo Serial Comm para Google Chrome.",
  deviceNotFound: "Dispositivo serial não foi encontrado.",
  chromeApiNotAvaialable: "API do Chrome indisponível. Favor utilizar o navegador Google Chrome.",
  disconnectedMessagePort: "Erro na comunicação com a extensão. Recarregue a página." //"Error: Attempting to use a disconnected port object"
}

var detected = false;
var is_on = false;
var myMessagesPort;
var myDevices = {}; // hash with deviceId => {devicePath, deviceName}

var collectDataFromDom = function() {
  //get app id
  appId = document.querySelector("#serial-comm-app-id").value;
  // set up hash with devices ids, disable all commands
  var e = document.querySelectorAll("[data-serial-comm-id]");
  for(var i = 0; i < e.length; ++i) {
    myDevices[e[i].dataset.serialCommId]={
      devicePath: e[i].dataset.serialCommPath || (myDevices[e[i].dataset.serialCommId] && myDevices[e[i].dataset.serialCommId].devicePath),
      deviceName: e[i].dataset.serialCommName || (myDevices[e[i].dataset.serialCommId] && myDevices[e[i].dataset.serialCommId].deviceName)
    }
    e[i].disabled = true;
  }

  // add DOM event listeners
  e = document.querySelectorAll("[data-serial-comm]");
  for(var i = 0; i < e.length; ++i) {
    switch(e[i].dataset.serialComm) {
      case "commandTest":
        e[i].addEventListener("click", function(event) {
          is_on = !is_on;
          myMessagesPort.postMessage({deviceId: event.target.dataset.serialCommId, message: (is_on ? "y" : "n")});
        });
        break;
      case "commandWeight":
        e[i].addEventListener("click", function(event) {
          myMessagesPort.postMessage({deviceId: event.target.dataset.serialCommId, getWeight: true});
        });
        break;
      case "changeDevice":
        e[i].addEventListener("click", function(event) {
          getDevices();
        });
        break;
    }
  }
}

var initialize = function() {
  myMessagesPort.postMessage({
    initialize: true
  });
}

var disableSerialInterface = function(deviceId) {
  var e = document.querySelectorAll("[data-serial-comm-id=" + deviceId + "]");
  for(var i = 0; i < e.length; ++i) {
    e[i].disabled = true;
  }
}

var enableSerialInterface = function(deviceId) {
  var e = document.querySelectorAll("[data-serial-comm-id=" + deviceId + "]");
  for(var i = 0; i < e.length; ++i) {
    e[i].disabled = false;
  }
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
      myDevices[request.deviceId] = obj;
      startDevice(request.deviceId);
    }
    else {
      cancelApp(messages.deviceNotFound);
    }
  }
  else if (request.readLine) {
    showDeviceMessage(request.deviceId, request.message);
  }
}

var showDeviceMessage = function(deviceId, message) {
  var e = document.querySelectorAll("[data-serial-comm=result][data-serial-comm-id=" + deviceId + "]");
  for(var i = 0; i < e.length; ++i) {
    e[i].innerHTML = message;
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
          startApp();
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

var startDevice = function(deviceId) {
  myMessagesPort.postMessage({
    start: true,
    deviceId: deviceId,
    devicePath: myDevices[deviceId].devicePath,
    deviceName: myDevices[deviceId].deviceName
  });
}

var startApp = function() {
  initialize();
  for (var d in myDevices) {
    startDevice(d)
  }
}

var getDevices = function() {
  try {
    myMessagesPort.postMessage({getDevices: true});
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