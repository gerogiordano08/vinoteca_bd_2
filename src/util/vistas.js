// Ayudas para las plantillas EJS (disponibles como `v` en todas las vistas).
const { formatearPrecio, aNumero } = require('./dinero');
const { aObjectId } = require('./ids');

const TIPOS = { vino: 'Vino', espumante: 'Espumante', accesorio: 'Accesorio' };

/** Etiqueta superior de las tarjetas: "VINO · MENDOZA" o "ACCESORIO". */
function etiqueta(p) {
  const tipo = p.categoria && p.categoria.slug === 'accesorios' ? 'Accesorio' : 'Vino';
  const origen = p.detalleVino && p.detalleVino.origenProvincia;
  return origen ? `${tipo} · ${origen}` : tipo;
}

/** Línea secundaria de las tarjetas: "Vino tinto · 750 ml", "Espumante · 750 ml", "Accesorio · Unidad". */
function subtitulo(p, { conOrigen = false } = {}) {
  if (p.detalleVino) {
    const esEspumante = p.categoria && p.categoria.slug === 'espumantes';
    const base = esEspumante ? 'Espumante' : `Vino ${String(p.detalleVino.color || '').toLowerCase()}`.trim();
    const extra = conOrigen && !esEspumante ? p.detalleVino.origenProvincia : p.detalleVino.contenidoMl ? `${p.detalleVino.contenidoMl} ml` : '';
    return extra ? `${base} · ${extra}` : base;
  }
  if (p.detalleAccesorio) {
    const unidad = String(p.detalleAccesorio.unidadVenta || '');
    const detalle = conOrigen ? p.detalleAccesorio.material : /^1 unidad$/i.test(unidad) ? 'Unidad' : unidad;
    return detalle ? `Accesorio · ${detalle}` : 'Accesorio';
  }
  return '';
}

function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

const fechaLarga = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

module.exports = {
  precio: formatearPrecio,
  numero: aNumero,
  etiqueta,
  subtitulo,
  plural,
  tipo: (t) => TIPOS[t] || t,
  fecha: (f) => (f ? fechaLarga.format(new Date(f)) : ''),
  aId: aObjectId,
};
