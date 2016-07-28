(function(window, undefined) {
  "use strict";

  var i18n = {
    translate: function() {
      var e = document.querySelectorAll("[data-i18n]");
      for (var i = 0; i < e.length; ++i) {
        e[i].innerText =
          (e[i].dataset.i18nPrefix || "") +
          chrome.i18n.getMessage(e[i].dataset.i18n) +
          (e[i].dataset.i18nSufix || "");
      }
    }
  }

  window.i18n = i18n;

})(window);