/* ============================================================
   Ex Scientia Veritas — Sistema de Calibraciones
   Frontend API-connected (Flask/MySQL backend, puerto 5000)
   ============================================================ */

/* ─── Utilidades ─────────────────────────────────────────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid  = () => Math.random().toString(36).slice(2, 9);
const soles = n => 'S/ ' + (+n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const methodById = id => CATALOG.find(m => m.id == id);   // loose: handles int vs string
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtFecha = d => new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
const methodIcon = icon => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[icon] || ICONS.gauge}</svg>`;
const iconSVG = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.gauge}</svg>`;

function svg(path, vb = '0 0 24 24') {
  return `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

const I = {
  search:  svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  trash:   svg('<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>'),
  check:   svg('<path d="M5 12l4 4L19 7"/>'),
  shield:  svg('<path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  alert:   svg('<path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17.5v.5"/>'),
  lock:    svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  doc:     svg('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 14h6M10 17h6"/>'),
  receipt: svg('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
  print:   svg('<path d="M7 8V3h10v5M7 18H4v-6h16v6h-3M7 14h10v6H7z"/>'),
  pencil:  svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>'),
  close:   svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  flask:   svg('<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>'),
  list:    svg('<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1"/>'),
  plus:    svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
  logout:  svg('<path d="M17 16l4-4m0 0l-4-4m4 4H7M13 12v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-4z"/>'),
  spin:    svg('<path d="M21 12a9 9 0 11-6.219-8.56"/>'),
};

/* ── Helpers ──────────────────────────────────────────────────── */
const admFecha = d => d ? new Date(d).toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const admFechaShort = d => { if(!d) return ''; const dt=new Date(d),now=new Date(); return dt.toDateString()===now.toDateString() ? dt.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}) : dt.toLocaleDateString('es-PE',{day:'2-digit',month:'short'}); };
const admSoles = n => parseFloat(n||0)>0 ? `S/ ${parseFloat(n).toLocaleString('es-PE',{minimumFractionDigits:2})}` : '—';
const admBadge = s => `<span class="adm-st st-${s}">${ADM_EST[s]?.label||s}</span>`;
const admAvatar = name => (name||'?').slice(0,2).toUpperCase();

