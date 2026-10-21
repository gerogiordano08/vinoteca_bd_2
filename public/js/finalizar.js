// Finalizar pedido: muestra la dirección solo para envío y actualiza el total del resumen.
(() => {
  const fila = document.querySelector('[data-fila-entrega]');
  const envio = document.querySelector('[data-envio]');
  if (!fila) return;
  const costo = Number(fila.dataset.costo) || 0;
  const subtotal = Number(fila.dataset.subtotal) || 0;
  const formato = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
  const precio = (n) => `$ ${formato.format(n)}`;
  const nueva = document.querySelector('[data-nueva-direccion]');
  const selector = document.getElementById('direccionGuardada');

  function actualizar() {
    const esEnvio = document.querySelector('input[name="entrega"]:checked')?.value === 'envio';
    if (envio) envio.hidden = !esEnvio;
    fila.querySelector('[data-texto-entrega]').textContent = esEnvio ? 'Envío a domicilio' : 'Retiro en tienda';
    fila.querySelector('[data-costo-entrega]').textContent = esEnvio ? precio(costo) : 'Sin cargo';
    document.querySelector('[data-total]').textContent = precio(esEnvio ? subtotal + costo : subtotal);
    if (nueva) nueva.hidden = Boolean(selector) && selector.value !== 'nueva';
  }
  document.querySelectorAll('input[name="entrega"]').forEach((r) => r.addEventListener('change', actualizar));
  if (selector) selector.addEventListener('change', actualizar);
  actualizar();
})();
