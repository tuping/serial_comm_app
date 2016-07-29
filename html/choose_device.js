"use strict";

var devices;
var ports;
var bitrates;
var defaultBitrate;
var inputDevice;
var inputPort;
var inputBitrate;
var buttonOk;
var buttonOtherPortSave;

window.onload = function() {
  devices = serialCommDevices();
  ports = serialCommPorts();
  bitrates = serialCommBitrates().bitrates;
  defaultBitrate = serialCommBitrates().defaultBitrate;
  inputDevice = document.getElementById("device");
  inputPort = document.getElementById("port");
  inputBitrate = document.getElementById("bitrate");
  optionsForSelect(inputDevice, devices, {textField: "deviceName"});
  optionsForSelect(inputPort, ports, {textField: "path", valueField: "path"});
  optionsForSelect(inputBitrate, bitrates, {default: defaultBitrate});
  buttonOk = document.getElementById("ok");
  buttonOk.onclick = chooseDevice;
  buttonOtherPortSave = document.getElementById("otherPortSave");
  buttonOtherPortSave.onclick = informOtherPort;
  i18n.translate();
}

function chooseDevice() {
  var deviceId = inputDevice.options[inputDevice.selectedIndex].value;
  var devicePath = inputPort.options[inputPort.selectedIndex].value;
  var deviceBitrate = inputBitrate.options[inputBitrate.selectedIndex].value;
  setDevice(deviceId, devicePath, deviceBitrate);
  window.close();
}

function informOtherPort() {
  var newPort = document.getElementById("otherPortPath").value.trim();
  if (newPort && newPort != "") {
    optionsForSelect(inputPort, [newPort]);
  } else {
    optionsForSelect(inputPort, ports, {textField: "path", valueField: "path"});
  }
  $("#otherPortModal").modal("hide");
}

function optionsForSelect(select, values, options = {}) {
  select.innerHTML = "";
  if (values.length > 0) {
    for (var i=0; i<values.length; i++) {
      var opt = document.createElement('option');
      opt.value = values[i][options.valueField] || values[i]
      opt.innerHTML = values[i][options.textField] || values[i]
      if (options.default && (opt.value == options.default)) {
        opt.selected = true;
      }
      select.appendChild(opt);
    }
  }
  else {
    for (var key in values) {
      var opt = document.createElement('option');
      opt.value = values[key][options.valueField] || key
      opt.innerHTML = values[key][options.textField] || key;
      select.appendChild(opt);
    }
  }
  if (select.innerHTML == "") {
    var opt = document.createElement('option');
    opt.value = "";
    opt.innerHTML = chrome.i18n.getMessage("notAvaialable");
    select.appendChild(opt);
  }
}
