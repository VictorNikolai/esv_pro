/* ─── Estado global ──────────────────────────────────────── */
const state = {
  theme:   localStorage.getItem('esv.theme') || 'clean',
  role:    'usuario',
  user:    null,
  orderId: null,
  orderNo: null,
  order:   [],
  client:  { empresa: '', ruc: '', contacto: '', email: '', telefono: '' },
  fecha:   new Date(),
};

