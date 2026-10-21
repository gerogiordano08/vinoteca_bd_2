// Ayuda y contacto: arma un correo para la tienda con los datos del formulario.
document.querySelectorAll('[data-contacto]').forEach((formulario) => {
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (!formulario.reportValidity()) return;
    const datos = new FormData(formulario);
    const asunto = `Consulta de ${datos.get('nombre')}`;
    const cuerpo = `${datos.get('consulta')}\n\n${datos.get('nombre')} · ${datos.get('email')}`;
    window.location.href = `mailto:${formulario.dataset.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  });
});
