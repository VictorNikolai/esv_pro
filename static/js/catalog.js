/* ─── Catálogo ───────────────────────────────────────────── */
let searchTerm = '';

async function loadCatalog() {
  $('#catalogList').innerHTML = `<div class="empty"><div class="big">Cargando catálogo…</div></div>`;
  const data = await apiGet('/api/catalog');
  CATALOG = data;
  renderCatalog();
}

function bindSearch() {
  $('#search').addEventListener('input', e => {
    searchTerm = e.target.value.toLowerCase();
    renderCatalog();
  });
}

function renderCatalog() {
  const r = ROLES[state.role] || ROLES.usuario;
  const list = CATALOG.filter(m =>
    !searchTerm ||
    m.name.toLowerCase().includes(searchTerm) ||
    (m.area||'').toLowerCase().includes(searchTerm) ||
    (m.magnitude||'').toLowerCase().includes(searchTerm)
  );
  // Update both count elements (topbar + catalog header)
  $$('#catalogCount').forEach(el => el.textContent = `${CATALOG.length}/${TOTAL_ACREDITADOS}`);
  $('#catalogList').innerHTML = list.map(m => `
    <div class="method ${r.seePrices ? '' : 'pricehide'}" data-id="${m.id}" draggable="true">
      <div class="m-ico">${methodIcon(m.icon)}</div>
      <div class="m-info">
        <b><span style="color:var(--accent,#534AB7);font-family:monospace;font-size:11px;margin-right:8px">${esc(m.procedure_code||m.code||'')}</span>${esc(m.name)}</b>
        <div class="m-meta">
          <span class="m-sub">${esc(m.area||'')} · ${m.points.length} pts · <span style="background:var(--surface-2);padding:1px 4px;border-radius:4px">${m.is_nominal?'Nominal':'Puntos'}</span></span>
          <span class="m-pt">${soles(m.tariff)}${m.is_nominal ? ' fijo' : '/pt'}</span>
        </div>
        ${m.note ? `<span class="m-note" title="${esc(m.note)}">✎ ${esc(m.note)}</span>` : ''}
      </div>
      <div class="m-actions">
        <button class="edit-btn" data-edit="${m.id}" title="Editar método">${I.pencil}</button>
        <button class="add-btn"  data-add="${m.id}"  title="Agregar a la orden">+</button>
      </div>
    </div>
  `).join('') || `<div class="empty"><div class="big">Sin coincidencias</div></div>`;
}

function bindCatalogActions() {
  $('#catalogList').addEventListener('click', e => {
    const add  = e.target.closest('[data-add]');  if (add)  return addInstrument(add.dataset.add);
    const edit = e.target.closest('[data-edit]'); if (edit) return openMethodModal(edit.dataset.edit);
  });
  $('#btnAddMethod').addEventListener('click', () => openMethodModal(null));
}

/* ─── Nueva Orden ────────────────────────────────────────── */
function bindNewOrder() {
  $('#btnNewOrder').addEventListener('click', () => {
    if (state.order.length > 0 &&
        !confirm('¿Iniciar nueva orden? Los datos de la orden actual se mantendrán en el historial.')) return;
    clearOrder();
  });
}
function clearOrder() {
  cancelAllSaves();
  state.orderId = null; state.orderNo = null;
  state.order = [];
  state.client = { empresa:'', ruc:'', contacto:'', email:'', telefono:'' };
  state.fecha = new Date();
  populateClientForm();
  $('#ordNoLabel').textContent = 'Nueva Orden';
  renderOrder(); updateTotals(); applyRole();
  toast('Nueva orden iniciada');
}

/* ─── Cliente ────────────────────────────────────────────── */
function bindClient() {
  ['empresa','ruc','contacto','email','telefono','direccion'].forEach(k => {
    const el = $('#cli_' + k);
    if (!el) return;
    el.addEventListener('input', () => { state.client[k] = el.value; });
  });
}
function populateClientForm() {
  ['empresa','ruc','contacto','email','telefono','direccion'].forEach(k => {
    const el = $('#cli_' + k);
    if (el) el.value = state.client[k] || '';
  });
}

/* ─── Creación lazy de orden en DB ───────────────────────── */
async function ensureOrder() {
  if (state.orderId) return state.orderId;
  // Read current form state
  ['empresa','ruc','contacto','email','telefono','direccion'].forEach(k => {
    const el = $('#cli_' + k);
    if (el) state.client[k] = el.value;
  });
  const res = await apiPost('/api/orders', {
    empresa:  state.client.empresa  || 'Por definir',
    ruc:      state.client.ruc      || '',
    contacto: state.client.contacto || '',
    email:    state.client.email    || '',
    telefono: state.client.telefono || '',
    direccion: state.client.direccion || '',
    notes: ''
  });
  state.orderId = res.id;
  state.orderNo = res.order_no;
  $('#ordNoLabel').textContent = res.order_no;
  return res.id;
}

/* ─── Instrumentos ───────────────────────────────────────── */
async function addInstrument(mid) {
  const m = methodById(mid);
  if (!m) return;
  const item = {
    uid: uid(), mid: m.id, apiId: null,
    serie:'', marca:'', modelo:'', alcance:'', division:'', exactitud:'',
    identificacion:'', indicaciones:'',
    points: new Set(),
  };
  state.order.push(item);
  renderOrder(); applyRole(); updateTotals();
  requestAnimationFrame(() => {
    const scroll = $('#orderScroll');
    scroll.scrollTo({ top: scroll.scrollHeight, behavior: 'smooth' });
  });
  toast(`${m.name} agregado a la orden`);
  // Persist
  try {
    const oid = await ensureOrder();
    const res = await apiPost(`/api/orders/${oid}/instruments`, {
      method_id: m.id, points: [], ...itemFlat(item)
    });
    item.apiId = res.id;
  } catch (err) {
    toast('Error guardando instrumento: ' + err.message, 'warn');
  }
}

function itemFlat(it) {
  return {
    serie: it.serie, marca: it.marca, modelo: it.modelo,
    alcance: it.alcance, division: it.division, exactitud: it.exactitud,
    identificacion: it.identificacion, indicaciones: it.indicaciones
  };
}

function renderOrder() {
  const wrap = $('#instruments');
  if (!wrap) return;
  if (state.order.length === 0) {
    wrap.innerHTML = `<div class="empty">
      <div class="big">Orden de trabajo vacía</div>
      <div class="arrow">Agrega instrumentos desde el catálogo &larr;</div>
    </div>`;
    $('#orderItemsCount').textContent = '0';
    return;
  }
  $('#orderItemsCount').textContent = state.order.length;
  const r = ROLES[state.role] || ROLES.usuario;
  wrap.innerHTML = state.order.map((it, idx) => {
    const m = methodById(it.mid);
    if (!m) return '';
    const sub = m.is_nominal ? m.tariff : m.tariff * it.points.size;
    return `
    <div class="instr" data-uid="${it.uid}">
      <div class="instr-head">
        <div class="m-ico">${methodIcon(m.icon)}</div>
        <div class="it">
          <b>${esc(m.name)}</b>
          <span>Ítem ${String(idx+1).padStart(2,'0')} · ${esc(m.magnitude||m.area||'')}</span>
        </div>
        <div class="subtotal ${r.seePrices ? '' : 'pricehide'}">
          <b data-sub>${soles(sub)}</b>
          <span>${m.is_nominal ? 'Tarifa nominal' : `${it.points.size} × ${soles(m.tariff)}`}</span>
        </div>
        <button class="del" data-del="${it.uid}" title="Quitar">${I.trash}</button>
      </div>
      <div class="instr-body">
        <div class="ficha">
          ${fichaField(it.uid,'identificacion','Código Interno','Ej. BAL-001')}
          ${fichaField(it.uid,'serie','N.º de Serie','Ej. SN-48291')}
          ${fichaField(it.uid,'marca','Marca','Ej. Mettler Toledo')}
          ${fichaField(it.uid,'modelo','Modelo','Ej. ML204')}
          ${fichaField(it.uid,'alcance','Alcance','Ej. 0–220 g')}
          ${fichaField(it.uid,'division','División de escala','Ej. 0.1 mg')}
          ${fichaField(it.uid,'exactitud','Exactitud / Clase','Ej. Clase I')}
        </div>
        <div class="field full instr-note">
          <label>Indicaciones / observaciones</label>
          <textarea data-fiche="${it.uid}|indicaciones" rows="2"
            placeholder="Notas para esta calibración (aparecen en la Constancia)…">${esc(it.indicaciones||'')}</textarea>
        </div>
        <div class="points-block">
          <div class="pb-head">
            <h4>Puntos de calibración</h4>
            <span class="badge">${I.shield} acreditados INACAL</span>
          </div>
          <div class="points" data-points="${it.uid}">
            ${m.points.map(p => `
              <span class="point ${it.points.has(p)?'on':''}" data-point="${esc(p)}">
                <span class="tick">${I.check}</span>${esc(p)}
              </span>`).join('')}
          </div>
          <div class="lock-msg" data-lock="${it.uid}">
            ${I.alert}<span>Punto fuera del alcance acreditado. Sólo se admiten los puntos del catálogo INACAL.</span>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function fichaField(u, key, label, ph) {
  const it = state.order.find(o => o.uid === u);
  return `<div class="field">
    <label>${label}</label>
    <input type="text" placeholder="${ph}" value="${esc(it[key]||'')}" data-fiche="${u}|${key}">
  </div>`;
}

function bindOrderActions() {
  bindClient();
  const wrap = $('#instruments');

  wrap.addEventListener('click', e => {
    const del = e.target.closest('[data-del]');
    if (del) return removeInstrument(del.dataset.del);
    const pt = e.target.closest('[data-point]');
    if (pt) return togglePoint(pt);
  });

  wrap.addEventListener('input', e => {
    const f = e.target.closest('[data-fiche]');
    if (f) {
      const [u, key] = f.dataset.fiche.split('|');
      const it = state.order.find(o => o.uid === u);
      if (it) { it[key] = e.target.value; scheduleSave(u); }
    }
  });
}

/* ─── Toggle punto (con debounce save) ───────────────────── */
function togglePoint(node) {
  const u = node.closest('[data-points]').dataset.points;
  const p = node.dataset.point;
  const it = state.order.find(o => o.uid === u);
  if (!it) return;
  if (it.points.has(p)) { it.points.delete(p); node.classList.remove('on'); }
  else                   { it.points.add(p);    node.classList.add('on');    }
  updateSubtotal(u);
  updateTotals();
  applyRoleActionsOnly();
  scheduleSave(u);
}

/* ─── Persistencia debounced ─────────────────────────────── */
const saveTimers = {};

function scheduleSave(u) {
  clearTimeout(saveTimers[u]);
  saveTimers[u] = setTimeout(() => saveInstrument(u), 850);
}
function cancelAllSaves() {
  Object.keys(saveTimers).forEach(u => { clearTimeout(saveTimers[u]); delete saveTimers[u]; });
}
async function saveAllPending() {
  const ids = Object.keys(saveTimers).filter(u => saveTimers[u]);
  cancelAllSaves();
  await Promise.allSettled(ids.map(u => saveInstrument(u)));
}
async function saveInstrument(u) {
  const it = state.order.find(o => o.uid === u);
  if (!it || !it.apiId || !state.orderId) return;
  try {
    await apiPut(`/api/orders/${state.orderId}/instruments/${it.apiId}`, {
      method_id: it.mid,
      points:    [...it.points],
      ...itemFlat(it)
    });
  } catch (err) {
    console.warn('saveInstrument error:', err.message);
  }
}

/* ─── Quitar instrumento ─────────────────────────────────── */
async function removeInstrument(u) {
  const node = $(`[data-uid="${u}"]`);
  if (node) node.classList.add('removing');
  const it = state.order.find(o => o.uid === u);
  if (it?.apiId && state.orderId)
    apiDel(`/api/orders/${state.orderId}/instruments/${it.apiId}`).catch(() => {});
  setTimeout(() => {
    state.order = state.order.filter(o => o.uid !== u);
    renderOrder(); applyRole(); updateTotals();
  }, 240);
}

function updateSubtotal(u) {
  const it = state.order.find(o => o.uid === u);
  const m  = methodById(it?.mid);
  if (!m) return;
  const node = $(`[data-uid="${u}"] [data-sub]`);
  if (node) {
    const sub = m.is_nominal ? m.tariff : m.tariff * it.points.size;
    node.textContent = soles(sub);
    node.animate([{ transform:'scale(1.12)' },{ transform:'scale(1)' }],{ duration:220, easing:'ease-out' });
    const sp = node.parentElement.querySelector('span');
    if (sp) sp.textContent = m.is_nominal ? 'Tarifa nominal' : `${it.points.size} × ${soles(m.tariff)}`;
  }
}

/* ─── Totales ────────────────────────────────────────────── */
function orderTotals() {
  let total = 0, points = 0;
  state.order.forEach(it => {
    const m = methodById(it.mid);
    if (m) { total += m.is_nominal ? m.tariff : m.tariff * it.points.size; points += it.points.size; }
  });
  return { total, points, items: state.order.length };
}
let lastTotal = 0;
function updateTotals() {
  const { total, points, items } = orderTotals();
  $('#metaItems').textContent      = String(items).padStart(2,'0');
  $('#metaPoints').textContent     = String(points).padStart(2,'0');
  const mags = new Set(state.order.map(o => methodById(o.mid)?.magnitude||'').filter(Boolean));
  $('#metaMagnitudes').textContent = mags.size;
  animateValue($('#totalValue'), lastTotal, total, 520);
  lastTotal = total;
}
function animateValue(el, from, to, dur) {
  if (!el) return;
  const fmt = n => n.toLocaleString('es-PE', { minimumFractionDigits:2, maximumFractionDigits:2 });
  el.innerHTML = `<span class="cur">S/</span>${fmt(to)}`;
  const t0 = performance.now();
  (function step(now) {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.innerHTML = `<span class="cur">S/</span>${fmt(from + (to - from) * e)}`;
    if (k < 1) requestAnimationFrame(step);
  })(performance.now());
}

