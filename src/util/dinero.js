const { Decimal128 } = require('mongodb');

// El modelo guarda los importes como Decimal128 para evitar errores de redondeo de los números binarios.
// En JavaScript se operan como centavos enteros y se vuelven a Decimal128 al guardar.

function aDecimal(valor) {
  if (valor instanceof Decimal128) return valor;
  const centavos = Math.round(Number(valor) * 100);
  const signo = centavos < 0 ? '-' : '';
  const abs = Math.abs(centavos);
  return Decimal128.fromString(`${signo}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`);
}

function aNumero(valor) {
  if (valor === null || valor === undefined) return 0;
  if (valor instanceof Decimal128) return Number(valor.toString());
  if (typeof valor === 'object' && valor.$numberDecimal) return Number(valor.$numberDecimal);
  return Number(valor);
}

/** Suma importes sin errores de punto flotante (trabaja en centavos). */
function sumar(...valores) {
  return valores.reduce((total, v) => total + Math.round(aNumero(v) * 100), 0) / 100;
}

function multiplicar(valor, cantidad) {
  return (Math.round(aNumero(valor) * 100) * cantidad) / 100;
}

const formateador = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** Formato de los bocetos: "$ 18.500". */
function formatearPrecio(valor) {
  return `$ ${formateador.format(aNumero(valor))}`;
}

module.exports = { aDecimal, aNumero, sumar, multiplicar, formatearPrecio };
