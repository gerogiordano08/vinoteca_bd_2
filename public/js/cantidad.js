// Botones − y + del selector de cantidad del detalle de producto.
document.querySelectorAll('[data-cantidad]').forEach((caja) => {
  const input = caja.querySelector('input');
  const limitar = (n) => Math.min(Number(input.max) || 24, Math.max(Number(input.min) || 1, n));
  caja.querySelector('[data-restar]').addEventListener('click', () => { input.value = limitar(Number(input.value) - 1); });
  caja.querySelector('[data-sumar]').addEventListener('click', () => { input.value = limitar(Number(input.value) + 1); });
});
