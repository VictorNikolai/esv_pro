/* ─── Arranque ───────────────────────────────────────────── */
document.documentElement.setAttribute('data-theme', state.theme);

async function init() {
  buildIcons();
  bindTheme();
  bindLogin();
  bindSearch();
  bindCatalogActions();
  bindOrderActions();
  bindDocs();
  bindMethodModal();
  bindOrdersModal();
  bindNewOrder();
  // Attempt to restore existing session
  buildNotifIcon();
  bindNotifications();
  try {
    const me = await apiGet('/api/me');
    setUser(me);
    await loadCatalog();
    renderOrder();
    applyRole();
    startNotifPolling();
  } catch (_) {
    showLogin();
  }
}

/* ─── Arranque del módulo de notificaciones ─── */
// buildNotifIcon() y bindNotifications() se llaman desde buildIcons() y init() del módulo principal.
// El polling lo inicia setUser() en el app.js principal tras autenticación exitosa.
// Nada adicional necesario aquí — todo se conecta en init().

/* ============================================================
   MÓDULOS NUEVOS: Confirmación · Agregar instrumento ·
                   Registro de usuarios · Solicitudes
   ============================================================ */

/* ─── 1. ESVConfirm — modal de confirmación reutilizable ─── */
const ESVConfirm = {
  _resolve: null,

  show({ title, message, type = 'info', okText = 'Confirmar', cancelText = 'Cancelar' }) {
    return new Promise(resolve => {
      this._resolve = resolve;
      const card = $('#confirmCard');
      card.className = `confirm-card ${type}`;
      $('#confirmTitle').textContent  = title;
      $('#confirmMsg').textContent    = message;
      $('#confirmOk').textContent     = okText;
      $('#confirmCancel').textContent = cancelText;

      const icoMap = {
        info:    I.shield,
        warning: I.alert,
        danger:  I.trash,
      };
      $('#confirmIco').innerHTML = icoMap[type] || icoMap.info;
      $('#confirmModal').classList.add('open');
    });
  },

  _close(result) {
    $('#confirmModal').classList.remove('open');
    if (this._resolve) { this._resolve(result); this._resolve = null; }
  }
};

function bindConfirmModal() {
  $('#confirmOk').addEventListener('click',     () => ESVConfirm._close(true));
  $('#confirmCancel').addEventListener('click', () => ESVConfirm._close(false));
  $('#confirmModal').addEventListener('click', e => {
    if (e.target.id === 'confirmModal') ESVConfirm._close(false);
  });
}

/* ─── 10. Arranque de los módulos nuevos ─────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  bindConfirmModal();
  bindAddInstrModal();
  bindRegistrationModal();
});

/* ============================================================
   REGISTRO — Ubigeo Perú + campos nuevos + auto-login
   ============================================================ */

/* ─── Inicializar al cargar el DOM ───────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  bindDragDrop();
});

/* ── Helper de roles (usado por messages.js) ─────────────────── */
function isAdmin() { return state.role === 'admin' || state.role === 'supervisor'; }
function isUser()  { return state.role === 'usuario'; }

/* ================================================================
   ADMIN DASHBOARD v14 — Completo y funcional
   ================================================================ */

const ADM_SECTIONS = {
  dashboard:  { title:'Dashboard',              crumb:'Vista general del sistema ESV' },
  usuarios:   { title:'Gestión de usuarios',    crumb:'Usuarios registrados en el sistema' },
  mensajeria: { title:'Mensajería directa',     crumb:'Chat directo con cada usuario' },
  ordenes:    { title:'Órdenes de trabajo',     crumb:'Todas las órdenes del sistema' },
  catalogo:   { title:'Catálogo acreditado',    crumb:'50 métodos de calibración INACAL' },
  documentos: { title:'Documentos generados',   crumb:'Constancias de ingreso y cotizaciones' },
  ajustes:    { title:'Ajustes y Plantillas',   crumb:'Configuración global y textos' },
  auditoria:  { title:'Auditoría',              crumb:'Registro de acciones y trazabilidad (ISO/IEC 17025)' },
};

const ADM_EST = {
  borrador:   { label:'Borrador',   color:'#888780' },
  ingresado:  { label:'Ingresado',  color:'#185FA5' },
  cotizado:   { label:'Cotizado',   color:'#534AB7' },
  aprobado:   { label:'Aprobado',   color:'#3B6D11' },
  en_proceso: { label:'En proceso', color:'#854F0B' },
  finalizado: { label:'Finalizado', color:'#0F6E56' },
};

let ADM = {
  section: 'dashboard',
  users: [], orders: [], convUid: null,
  attachData: null, attachName: null, attachType: null,
  pollTimer: null, msgUsers: [],
};

/* ── Nav ──────────────────────────────────────────────────────── */
function admBindNav() {
  $$('#adminDashboard .adm-nav-item[data-section]').forEach(btn => {
    btn.onclick = () => admActivate(btn.dataset.section);
  });
  const logoutBtn = $('#admLogoutBtn');
  if (logoutBtn) logoutBtn.onclick = doLogout;
  const refBtn = $('#admRefreshBtn');
  if (refBtn) refBtn.onclick = () => admActivate(ADM.section);
  /* Order filters */
  $$('#admOrderFilters .adm-filter-btn').forEach(btn => {
    btn.onclick = () => {
      $$('#admOrderFilters .adm-filter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      admLoadOrders(btn.dataset.status||'');
    };
  });
  $('#admExportBtn')?.addEventListener('click', admExportUsers);
  admBindMessaging();
  admBindCatalogSection();
}

function admActivate(sec) {
  ADM.section = sec;
  $$('#adminDashboard .adm-nav-item[data-section]').forEach(b => b.classList.toggle('active', b.dataset.section===sec));
  $$('#adminDashboard .adm-section').forEach(s => s.classList.remove('adm-section-active'));
  const panel = $(`#admSec-${sec}`);
  if (panel) panel.classList.add('adm-section-active');
  const info = ADM_SECTIONS[sec]||{};
  const tt = $('#admPageTitle'); if(tt) tt.textContent = info.title||sec;
  const cr = $('#admPageCrumb'); if(cr) cr.textContent = info.crumb||'';
  /* Lazy-load sections */
  if (sec==='dashboard')  admLoadDashboard();
  if (sec==='usuarios')   admLoadUsers();
  if (sec==='mensajeria') { admLoadMsgUsers(); admPollMsgCount(); }
  if (sec==='ordenes')    admLoadOrders('');
  if (sec==='catalogo')   admLoadCatalog();
  if (sec==='documentos') admLoadDocs();
  if (sec==='ajustes')    admLoadSettings();
  if (sec==='auditoria')  admLoadAudit();
}




document.addEventListener('DOMContentLoaded', init);
