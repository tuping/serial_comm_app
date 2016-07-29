(function(window, undefined) {
  "use strict";

  var chooseDeviceWindow = new function() {
    this.width = 550;
    this.height = 300;
    this.w = (this.width > screen.width) ? screen.with : this.width;
    this.h = (this.height > screen.widh) ? screen.with : this.height;
    this.show = function() {

      var win = chrome.app.window.get("chooseDeviceId");
      if (win == null) {
        chrome.app.window.create(
          "/html/choose_device.html", {
            id: "chooseDeviceId",
            hidden: true,
            alwaysOnTop: true,
            outerBounds: {
              width: this.w,
              height: this.h,
              minWidth: this.w,
              minHeight: this.h,
              maxWidth: this.w,
              maxHeight: this.h
            }
          },
          function(win) {
            win.contentWindow.serialCommPorts = function() {
              return serialComm.availablePorts;
            };
            win.contentWindow.serialCommBitrates = function() {
              return {bitrates: serialComm.bitrates, defaultBitrate: serialComm.defaultBitrate};
            };
            win.contentWindow.serialCommDevices = function() {
              return serialComm.devices;
            };
            win.contentWindow.setDevice = function(deviceId, devicePath, bitrate) {
              serialComm.deviceSet(deviceId, devicePath, bitrate);
            };
            win.outerBounds.setPosition(
              Math.round((screen.availWidth - win.outerBounds.width)/2), // left
              Math.round((screen.availHeight - win.outerBounds.height)/2) // top
            );
            win.show();
          }
        );
      }
      else {
        win.show();
      }
    }
  }
  window.chooseDeviceWindow = chooseDeviceWindow;
})(window);