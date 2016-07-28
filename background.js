"use strict";
chrome.runtime.onMessageExternal.addListener(
  function(request, sender, sendResponse) {
    var ret = {error: "(background.js) " + chrome.i18n.getMessage("errorNotValidRequest")};
    if (request.ping) {
      ret = "pong";
    }
    sendResponse(ret);
  }
);

chrome.runtime.onConnectExternal.addListener(
  function(port) {
    serialComm.addListeners(port);
  }
);
