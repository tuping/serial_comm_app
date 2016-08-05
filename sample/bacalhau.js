"use strict";


var txtArea = document.querySelector("#printerdata");
var buttonPrint = document.querySelector("#bacalhau");
var codigo = "10081234567890";

function novoBacalhau() {
  var texto = txtArea.value;
  var n = texto.search(codigo);
  var n_codigo = (parseInt(codigo)+1).toString();
  texto = texto.substr(0,n) + n_codigo + texto.substr(n+codigo.length);
  codigo = n_codigo;
  txtArea.value = texto;
}

buttonPrint.addEventListener("click", novoBacalhau);