/* ============================================================
   Ex Scientia Veritas — Constantes de la aplicación
   CATALOG se llena desde GET /api/catalog  (50 métodos INACAL)
   ============================================================ */

let CATALOG = [];                // poblado por loadCatalog() en app.js
const TOTAL_ACREDITADOS = 50;   // alcances acreditados ante INACAL

/* Roles del sistema: definen visibilidad y permisos. */
const ROLES = {
  usuario: {
    label: 'Cliente',
    short: 'Cliente',
    seePrices: false,
    canQuote: false,
    canAdmin: false,
    isAdmin: false,
    note: 'Acceso al workspace de calibraciones. No visualiza información financiera.'
  },
  admin: {
    label: 'Administrador',
    short: 'Admin',
    seePrices: true,
    canQuote: true,
    canAdmin: true,
    isAdmin: true,
    canReview: true,
    note: 'Acceso total al sistema. Gestión de usuarios, catálogo y documentos.'
  },
  supervisor: {
    label: 'Supervisor',
    short: 'Sup',
    seePrices: true,
    canQuote: true,
    canAdmin: false,
    isAdmin: false,
    canReview: true,
    note: 'Acceso a la revisión general de órdenes de todos los clientes. Sin acceso a ajustes del sistema.'
  }
};



/* Íconos SVG por magnitud — trazos geométricos institucionales */
const ICONS = {
  flask:   '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>',
  scale:   '<path d="M12 3v16M5 19h14M12 6l-7 5h14z"/><circle cx="12" cy="4" r="1"/>',
  weight:  '<path d="M7 8h10l2 12H5z"/><circle cx="12" cy="6" r="2.5"/>',
  clock:   '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 3h6"/>',
  thermo:  '<path d="M12 4a2 2 0 0 1 2 2v8a4 4 0 1 1-4 0V6a2 2 0 0 1 2-2z"/><circle cx="12" cy="17" r="1.6"/>',
  drop:    '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
  press:   '<path d="M4 4h16M6 4v6h12V4M9 10v4M15 10v4M5 18h14l-2 3H7z"/>',
  ruler:   '<path d="M3 8h18v8H3z"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>',
  gauge:   '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l5-6"/><circle cx="12" cy="18" r="1.4"/>',
  wave:    '<path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>',
  light:   '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  flow:    '<path d="M4 12h16M12 4l8 8-8 8"/><circle cx="4" cy="12" r="2"/>',
  bubble:  '<path d="M3 9a6 6 0 1 1 12 0c0 5-6 9-6 9s-6-4-6-9z"/><circle cx="17" cy="7" r="4"/>',
  pipette: '<path d="M9 3l6 6-5 5-7 3 3-7z"/><path d="M17 7l2-2"/><path d="M13 13l3 3"/>',
};
