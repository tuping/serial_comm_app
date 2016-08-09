"use strict";

$(function() {

  //var txtArea = document.querySelector("#printerdata");
  var buttonPrint = $("button[data-serial-comm=commandPrint]");
  var codigo = "10081234567890";

  function novoBacalhau(event) {
    var txtAreaId = event.target.dataset.serialCommDatafieldId;
    var txtArea = $("#"+txtAreaId);
    var texto = txtArea.val();
    var n = texto.search(codigo);
    if (n) {
      var n_codigo = (parseInt(codigo)+1).toString();
      texto = texto.substr(0,n) + n_codigo + texto.substr(n+codigo.length);
      codigo = n_codigo;
      txtArea.val(texto);
    }
  }

  buttonPrint.click(novoBacalhau);
});