"use strict";

var buttonCloseWin;
var devices;
var ports;
var bitrates;
var defaultBitrate;
var inputDevice;
var inputPort;
var inputBitrate;
var buttonOk;
var buttonSave;
var buttonOtherPortSave;
var buttonRefreshPorts;
var dataSet;
var table;
var fixedRow = {
  "0": "",
  "1": "",
  "2": "",
  "DT_RowId": "addDevice"
};

window.onload = function() {
  reloadDataSet();
  setUpDataTable();
  loadPorts();
  bitrates = serialCommBitrates().bitrates;
  defaultBitrate = serialCommBitrates().defaultBitrate;
  inputDevice = document.getElementById("device");
  inputBitrate = document.getElementById("bitrate");
  optionsForSelect(inputDevice, devices, {textField: "deviceName"});
  optionsForSelect(inputBitrate, bitrates, {default: defaultBitrate});
  buttonOk = document.getElementById("ok");
  buttonOk.onclick = configDevice;
  buttonSave = document.getElementById("save");
  buttonSave.onclick = saveConfig;
  buttonOtherPortSave = document.getElementById("otherPortSave");
  buttonOtherPortSave.onclick = informOtherPort;
  buttonRefreshPorts = document.getElementById("refreshPorts");
  buttonRefreshPorts.onclick = refreshPorts;
  buttonCloseWin = document.getElementById("btnCloseWin")
  buttonCloseWin.onclick = closeWindow;
  i18n.translate();
  blursLinkButtons();
  showCurrentDevices();
}

function blursLinkButtons() {
  var e = document.querySelectorAll(".btn-link");
  for (var i = 0; i < e.length; ++i) {
    e[i].addEventListener("click", function(e) {
      this.blur();
    });
  }
}

function refreshPorts() {
  //buttonRefreshPorts.blur();
  getDevices(loadPorts);
}

function loadPorts() {
  inputPort = document.getElementById("port");
  ports = serialCommPorts();
  optionsForSelect(inputPort, ports, {textField: "path", valueField: "path"});
}

function configDevice() {
  var deviceId = inputDevice.options[inputDevice.selectedIndex].value;
  var devicePath = inputPort.options[inputPort.selectedIndex].value;
  var deviceBitrate = inputBitrate.options[inputBitrate.selectedIndex].value;
  setDevice(deviceId, devicePath, deviceBitrate);
  showCurrentDevices();
}

function saveConfig() {
  saveDevices();
  window.close();
}

function closeWindow() {
  window.close();
}

function showCurrentDevices() {
  reloadDataSet();
  table.clear().rows.add(dataSet).draw();
  table.row.add(fixedRow);
}

function reloadDataSet() {
  devices = serialCommDevices();
  dataSet = $.map(devices, function(value, index) {
    if(value.devicePath) {
      return [{
        "0": value.deviceName ? value.deviceName : index,
        "1": value.devicePath,
        "2": value.bitrate,
        "DT_RowId": index
      }];
    }
  });
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

function setUpDataTable() {
  $("#dtDevices").DataTable({
    data: dataSet,
    columns: [
      { title: chrome.i18n.getMessage("device"), defaultContent: "" },
      { title: chrome.i18n.getMessage("port"), defaultContent: "" },
      { title: chrome.i18n.getMessage("bitrate"), defaultContent: "" },
      { title: ""}
    ],
    "scrollY": "200px",
    "scrollCollapse": true,
    "paging": false,
    "searching": false,
    "info": false,
    language: {
      "emptyTable": chrome.i18n.getMessage("emptyTable"),
      "zeroRecords": chrome.i18n.getMessage("emptyTable")
    }
  });
  table = $("#dtDevices").DataTable();

  //click table
  $("#dtDevices tbody").on("click", "td", function () {
    var data = table.cell(this).data();  //td element data
    var column = table.cell(this).index().column; //column index
    var row = table.row(this).index(); // Row index
    var rowid = $(this).closest("tr").attr("id"); //Get Row Id
    var columnvisible = table.cell( this ).index().columnVisible //visble column index
    console.log(data);
    console.log(row);
  });

  //click on delete
  $("#dtDevices tbody").on("click", "img.icon-delete", function () {
    table
    .row( $(this).parents('tr') )
    .remove()
    .draw();
  });
}
