/* ─── 8. Módulo de SOLICITUDES (Gerencia) ────────────────────── */

/* ── Mostrar admin dashboard ──────────────────────────────────── */
function showAdminDashboard() {
  const dash = $('#adminDashboard');
  if (!dash) { console.error('ESV: #adminDashboard not found in DOM'); return; }
  dash.classList.remove('hidden');
  document.body.classList.add('is-admin');
  /* Populate identity */
  const name = state.user?.nombre || state.user?.username || 'Admin';
  const el = $('#admAdminName'); if (el) el.textContent = name;
  const av = $('#admAvatar'); if (av) av.textContent = admAvatar(name);
  const dt = $('#admDate'); if (dt) dt.textContent = new Date().toLocaleDateString('es-PE',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  /* Hide strict-admin tabs for supervisors */
  const isAdminStrict = state.user?.role === 'admin';
  const uBtn = $('[data-section="usuarios"]');
  const cBtn = $('[data-section="catalogo"]');
  if (uBtn) uBtn.style.display = isAdminStrict ? '' : 'none';
  if (cBtn) cBtn.style.display = isAdminStrict ? '' : 'none';
  
  const roledesc = $('#admAdminRoleDesc');
  if(roledesc) roledesc.textContent = isAdminStrict ? 'Administrador del sistema' : 'Supervisor de órdenes';

  admBindNav();
  admActivate('dashboard');
  admLoadDashboard();
  /* Poll message count every 30s */
  clearInterval(ADM.pollTimer);
  ADM.pollTimer = setInterval(admPollMsgCount, 30000);
}

function hideAdminDashboard() {
  $('#adminDashboard')?.classList.add('hidden');
  document.body.classList.remove('is-admin');
  clearInterval(ADM.pollTimer);
}

/* ── Dashboard stats ──────────────────────────────────────────── */
async function admLoadDashboard() {
  const statsEl = $('#admStatsRow');
  if (statsEl) statsEl.innerHTML = '<div class="adm-stat-skeleton">Cargando métricas…</div>';
  try {
    const [stats, users] = await Promise.all([
      apiFetch('/api/admin/stats'),
      apiFetch('/api/messages/users').catch(()=>[]),
    ]);
    /* Build stat cards */
    const tot = stats.totals||{};
    const bsMap = {}; (stats.by_status||[]).forEach(r=>bsMap[r.status]=r);
    const totalOrds = parseInt(tot.total||0);
    const cards = [
      {lbl:'Total órdenes',   val:totalOrds,                                                          sub:'en el sistema',      color:'#df2830'},
      {lbl:'Monto acumulado', val:`S/ ${parseFloat(tot.monto||0).toLocaleString('es-PE',{maximumFractionDigits:0})}`, sub:'estimado total', color:'#185FA5'},
      {lbl:'Usuarios registrados', val:users.length,                                                  sub:'activos',            color:'#3B6D11'},
      {lbl:'Docs este mes',   val:stats.docs_mes||0,                                                  sub:'CI y COT generadas', color:'#534AB7'},
      ...Object.keys(ADM_EST).map(k=>({
        lbl:ADM_EST[k].label, val:parseInt(bsMap[k]?.total||0),
        sub:admSoles(bsMap[k]?.monto), color:ADM_EST[k].color,
        pct:totalOrds>0?(parseInt(bsMap[k]?.total||0)/totalOrds*100).toFixed(0):0,
      })),
    ];
    if (statsEl) statsEl.innerHTML = cards.map(c=>`
      <div class="adm-stat" style="border-left-color:${c.color}">
        <div class="adm-stat-lbl">${c.lbl}</div>
        <div class="adm-stat-val" style="color:${c.color}">${c.val}</div>
        <div class="adm-stat-sub">${c.sub}</div>
      </div>`).join('');
    /* Recent orders */
    const ob = $('#admRecentOrders');
    if(ob) ob.innerHTML = (stats.recent||[]).slice(0,8).map(o=>`
      <tr>
        <td><code style="font-size:11px;color:#df2830">${esc(o.order_no||'')}</code></td>
        <td style="font-weight:500;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.empresa||'—')}</td>
        <td>${admBadge(o.status)}</td>
        <td style="font-size:12px">${admSoles(o.total_estimated)}</td>
        <td style="font-size:11px;color:#888">${admFecha(o.created_at)}</td>
        <td><div class="adm-actions" style="margin-top: 8px;">
          <button class="adm-btn-xs navy" onclick="requestAsyncPDF(${o.id}, 'constancia')">CI PDF</button>
          <button class="adm-btn-xs" onclick="requestAsyncPDF(${o.id}, 'cotizacion')">COT</button>
          <button class="adm-btn-xs" onclick="loadOrderFromApi(${o.id})">Editar</button>
        </div></td>
      </tr>`).join('') || '<tr><td colspan="6" class="adm-empty">Sin órdenes</td></tr>';
    /* Recent users */
    const ub = $('#admRecentUsers');
    if(ub) ub.innerHTML = users.slice(0,5).map(u=>`
      <div class="adm-user-mini-row">
        <div class="adm-uavatar">${admAvatar(u.nombre)}</div>
        <div style="flex:1;min-width:0">
          <div class="adm-uname">${esc(u.nombre||u.username)}</div>
          <div class="adm-uemail">${esc(u.empresa||u.email||'')}</div>
        </div>
        <button class="adm-btn-xs navy" onclick="admGoMsg(${u.id})">Mensaje</button>
      </div>`).join('') || '<div class="adm-empty">Sin usuarios aún</div>';
    /* Update sidebar badge */
    const nb = $('#navBadgeUsers'); if(nb) nb.textContent = users.length;
  } catch(e) {
    if(statsEl) statsEl.innerHTML = `<div class="adm-stat-skeleton">Error: ${esc(e.message)}</div>`;
    console.error('admLoadDashboard:', e);
  }
}

/* ── Usuarios ─────────────────────────────────────────────────── */
async function admLoadUsers() {
  $('#admUsersList').innerHTML = '<tr><td colspan="8" class="adm-empty">Cargando…</td></tr>';
  try {
    const rows = await apiFetch('/api/admin/users');
    ADM.users = rows;
    const nb = $('#navBadgeUsers'); if(nb) nb.textContent = rows.length;
    if(!rows.length) { $('#admUsersList').innerHTML = '<tr><td colspan="8" class="adm-empty">Sin usuarios registrados aún</td></tr>'; return; }
    $('#admUsersList').innerHTML = rows.map(u=>`
      <tr>
        <td><code style="font-size:11px">${esc(u.username)}</code></td>
        <td style="font-weight:500">${esc(u.nombre||'—')}</td>
        <td style="font-size:12px">${esc(u.empresa||'—')}</td>
        <td><a href="mailto:${esc(u.email||'')}" style="color:#df2830;font-size:12px">${esc(u.email||'—')}</a></td>
        <td style="font-size:12px">${esc(u.cargo||'—')}</td>
        <td style="font-size:11px;color:#888">${admFecha(u.created_at)}</td>
        <td>
          <select class="adm-input" style="padding:4px;font-size:12px;width:110px" onchange="admChangeUserRole(${u.id}, this.value)" ${u.id===state.user?.id?'disabled':''}>
            <option value="usuario" ${u.role==='usuario'?'selected':''}>Cliente</option>
            <option value="supervisor" ${u.role==='supervisor'?'selected':''}>Supervisor</option>
            <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
          </select>
        </td>
        <td><div class="adm-actions"><button class="adm-btn-xs navy" onclick="admGoMsg(${u.id})">💬 Mensaje</button></div></td>
      </tr>`).join('');
  } catch(e) { $('#admUsersList').innerHTML = `<tr><td colspan="8" class="adm-empty">Error: ${esc(e.message)}</td></tr>`; }
}

async function admChangeUserRole(uid, newRole) {
  try {
    const res = await apiFetch('/api/admin/users/'+uid, { method: 'PATCH', body: JSON.stringify({role: newRole}) });
    if(res.ok) toast('Rol de usuario actualizado ✓');
  } catch(e) {
    toast('Error al cambiar rol: '+e.message, true);
    admLoadUsers(); // rollback visually
  }
}

function admExportUsers() {
  if(!ADM.users.length) return;
  const h = 'username,nombre,empresa,email,cargo,registro\n';
  const b = ADM.users.map(u=>[u.username,u.nombre,u.empresa,u.email,u.cargo,u.created_at].map(v=>`"${(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(h+b); a.download='usuarios_esv.csv'; a.click();
}

/* ── Órdenes admin ────────────────────────────────────────────── */
async function admLoadOrders(filter='') {
  $('#admOrdersList').innerHTML = '<tr><td colspan="8" class="adm-empty">Cargando…</td></tr>';
  try {
    const url = filter ? `/api/admin/orders?status=${filter}` : '/api/admin/orders';
    const res = await apiFetch(url);
    const rows = Array.isArray(res) ? res : (res.data || []);
    ADM.orders = rows;
    if(!rows.length) { $('#admOrdersList').innerHTML = '<tr><td colspan="8" class="adm-empty">Sin órdenes</td></tr>'; return; }
    $('#admOrdersList').innerHTML = rows.map(o=>`
      <tr>
        <td><code style="font-size:11px;color:#df2830">${esc(o.order_no||'')}</code></td>
        <td><div style="font-weight:500;font-size:13px">${esc(o.empresa||'—')}</div><div style="font-size:11px;color:#888">${esc(o.ruc||'')}</div></td>
        <td>
          <select class="adm-status-select" data-oid="${o.id}" onchange="admChangeStatus(this)">
            ${Object.keys(ADM_EST).map(s=>`<option value="${s}" ${s===o.status?'selected':''}>${ADM_EST[s].label}</option>`).join('')}
          </select>
        </td>
        <td style="text-align:center">${o.n_items||0}</td>
        <td style="font-size:12.5px;font-weight:500">${admSoles(o.total_estimated)}</td>
        <td style="font-size:12px">${esc(o.creator||'—')}</td>
        <td style="font-size:11px;color:#888">${admFecha(o.created_at)}</td>
        <td><div class="adm-actions">
          <button class="adm-btn-xs navy" onclick="requestAsyncPDF(${o.id}, 'constancia')">CI PDF</button>
          <button class="adm-btn-xs" onclick="requestAsyncPDF(${o.id}, 'cotizacion')">COT</button>
        </div></td>
      </tr>`).join('');
  } catch(e) { $('#admOrdersList').innerHTML = `<tr><td colspan="8" class="adm-empty">Error: ${esc(e.message)}</td></tr>`; }
}

async function admChangeStatus(sel) {
  try {
    await apiFetch(`/api/admin/orders/${sel.dataset.oid}/status`,{method:'PATCH',body:JSON.stringify({status:sel.value})});
    toast(`Estado → ${ADM_EST[sel.value]?.label||sel.value}`);
  } catch(e) { toast(`Error: ${e.message}`,true); }
}

/* ── Catálogo — CRUD completo ─────────────────────────────────── */
let _catalogData = [];

async function admLoadCatalog(searchQuery = '', forceFetch = false) {
  if (!_catalogData.length || forceFetch) {
    $('#admCatalogList').innerHTML = '<tr><td colspan="7" class="adm-empty">Cargando…</td></tr>';
  }
  try {
    if (!searchQuery && (!_catalogData.length || forceFetch)) {
      const rows = await apiFetch('/api/catalog?all=1');
      _catalogData = rows;
    }
    const query = searchQuery || ($('#admCatalogSearch')?.value || '').toLowerCase();
    const rows  = query
      ? _catalogData.filter(m =>
          (m.name||'').toLowerCase().includes(query) ||
          (m.code||'').toLowerCase().includes(query) ||
          (m.procedure_code||'').toLowerCase().includes(query) ||
          (m.area||'').toLowerCase().includes(query))
      : _catalogData;
    const cnt = $('#admCatalogCount');
    if(cnt) cnt.textContent = `${_catalogData.length} métodos · ${rows.length} mostrados`;
    if(!rows.length) {
      $('#admCatalogList').innerHTML = `<tr><td colspan="7" class="adm-empty">Sin resultados para "${esc(query)}"</td></tr>`;
      return;
    }
    $('#admCatalogList').innerHTML = rows.map(m => `
      <tr style="${m.active ? '' : 'opacity:0.6;background:#fafafa'}">
        <td><code style="font-size:10px;color:#534AB7;white-space:nowrap">${esc(m.procedure_code||m.code||'')}</code></td>
        <td style="font-weight:500;font-size:13px">${esc(m.name)}</td>
        <td style="font-size:12px;color:#555">${esc(m.area||'')}</td>
        <td style="font-weight:500;white-space:nowrap">S/ ${parseFloat(m.tariff||0).toFixed(2)}</td>
        <td style="text-align:center">${(m.points||[]).length}</td>
        <td><span style="font-size:10.5px;padding:2px 8px;border-radius:8px;
          background:${m.is_nominal?'rgba(59,109,17,.1)':'rgba(83,74,183,.1)'};
          color:${m.is_nominal?'#3B6D11':'#534AB7'}">${m.is_nominal?'Nominal':'Puntos'}</span></td>
        <td>
          <div class="adm-actions">
            <button class="adm-btn-xs navy" onclick="admCatalogEdit(${m.id})" title="Editar método">Editar</button>
            <button class="adm-btn-xs" onclick="admCatalogToggle(${m.id},${m.active?0:1})"
              style="${m.active?'':'background:#eee;color:#777;border:1px solid #ccc'}" title="${m.active?'Desactivar':'Activar'}">
              ${m.active?'Activo':'Inactivo'}
            </button>
          </div>
        </td>
      </tr>`).join('');
  } catch(e) {
    $('#admCatalogList').innerHTML = `<tr><td colspan="7" class="adm-empty">Error: ${esc(e.message)}</td></tr>`;
  }
}

function admCatalogEdit(mid) {
  const m = _catalogData.find(x => x.id === mid);
  if (!m) return;
  if (typeof openMethodModal !== 'function') {
    toast('Modal de edición no disponible', true); return;
  }
  /* Elevar z-index del methodModal por encima del admin panel (9999) */
  const modal = document.getElementById('methodModal');
  if (modal) modal.style.zIndex = '10100';
  openMethodModal(m.id);
}

async function admCatalogToggle(mid, newActive) {
  try {
    await apiFetch(`/api/catalog/${mid}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: newActive })
    });
    const label = newActive ? 'activado' : 'desactivado';
    toast(`Método ${label} · Notificación enviada a clientes ✓`);
    
    // Actualizar estado localmente para no perder scroll
    const m = _catalogData.find(x => x.id === mid);
    if (m) m.active = newActive;
    
    // Repintar usando la búsqueda actual sin borrar los datos
    admLoadCatalog($('#admCatalogSearch')?.value || '');
  } catch(e) { toast(`Error: ${e.message}`, true); }
}

function admBindCatalogSection() {
  $('#admCatalogNewBtn')?.addEventListener('click', () => {
    if (typeof openMethodModal === 'function') {
      const modal = document.getElementById('methodModal');
      if (modal) modal.style.zIndex = '10100';
      openMethodModal(null);
    } else {
      toast('Funcionalidad disponible desde el workspace', true);
    }
  });
  const searchEl = $('#admCatalogSearch');
  if (searchEl) {
    let debounce;
    searchEl.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => admLoadCatalog(_catalogData.length ? searchEl.value.toLowerCase() : ''), 250);
    });
  }
}

/* ── Documentos ───────────────────────────────────────────────── */
async function admLoadDocs() {
  $('#admDocsList').innerHTML = '<tr><td colspan="7" class="adm-empty">Cargando…</td></tr>';
  try {
    const rows = await apiFetch('/api/admin/documents');
    if(!rows.length){$('#admDocsList').innerHTML='<tr><td colspan="7" class="adm-empty">Sin documentos generados</td></tr>';return;}
    $('#admDocsList').innerHTML = rows.map(d=>`
      <tr>
        <td><span style="font-size:11px;padding:2px 8px;border-radius:8px;background:${d.doc_type==='constancia'?'rgba(24,95,165,.1)':'rgba(83,74,183,.1)'};color:${d.doc_type==='constancia'?'#185FA5':'#534AB7'}">${d.doc_type==='constancia'?'CI Constancia':'COT Cotización'}</span></td>
        <td><code style="font-size:11px">${esc(d.doc_number||'')}</code></td>
        <td style="font-size:12px">${esc(d.order_no||'')}</td>
        <td style="font-weight:500">${esc(d.empresa||'—')}</td>
        <td style="font-size:12px">${esc(d.generated_by_name||'—')}</td>
        <td style="font-size:11px;color:#888">${admFecha(d.generated_at)}</td>
        <td><button class="adm-btn-xs navy" onclick="requestAsyncPDF(${d.order_id}, '${d.doc_type}')">PDF</button></td>
      </tr>`).join('');
  } catch(e) { $('#admDocsList').innerHTML = `<tr><td colspan="7" class="adm-empty">Error: ${esc(e.message)}</td></tr>`; }
}

/* ═══════════════════════════════════════════════════════════
   MENSAJERÍA ADMIN
   ═══════════════════════════════════════════════════════════ */
async function admLoadMsgUsers() {
  $('#admMsgUserList').innerHTML = '<div class="adm-empty">Cargando…</div>';
  try {
    const rows = await apiFetch('/api/messages/users');
    ADM.msgUsers = rows;
    admRenderMsgList(rows);
  } catch(e) { $('#admMsgUserList').innerHTML = `<div class="adm-empty">Error: ${esc(e.message)}</div>`; }
}

function admRenderMsgList(rows) {
  const el = $('#admMsgUserList'); if(!el) return;
  if(!rows.length) { el.innerHTML = '<div class="adm-empty">Sin usuarios registrados</div>'; return; }
  el.innerHTML = rows.map(u=>`
    <div class="adm-msg-user-row ${ADM.convUid===u.id?'active':''}" onclick="admOpenConv(${u.id})" data-uid="${u.id}">
      <div class="adm-uavatar" style="width:32px;height:32px;font-size:12px">${admAvatar(u.nombre)}</div>
      <div style="flex:1;min-width:0">
        <div class="adm-msg-user-name">${esc(u.nombre||u.username)}</div>
        <div class="adm-msg-user-sub">${esc(u.empresa||u.email||'')}</div>
      </div>
      ${u.unread_count>0?'<div class="adm-msg-unread-dot"></div>':''}
    </div>`).join('');
  /* Search filter */
  const srch = $('#admMsgSearch');
  if(srch) srch.oninput = () => admRenderMsgList(rows.filter(u=>(u.nombre+u.empresa+u.email||'').toLowerCase().includes(srch.value.toLowerCase())));
}

async function admOpenConv(uid) {
  ADM.convUid = uid;
  $$('.adm-msg-user-row').forEach(r=>r.classList.toggle('active',parseInt(r.dataset.uid)===uid));
  const user = ADM.msgUsers.find(u=>u.id===uid)||{nombre:'Usuario',id:uid};
  $('#admMsgEmpty')?.classList.add('hidden');
  const conv = $('#admConv'); conv?.classList.remove('hidden');
  if($('#admConvHeader')) {
    $('#admConvHeader').innerHTML = `
      <div class="adm-uavatar">${admAvatar(user.nombre)}</div>
      <div><div class="adm-conv-hname">${esc(user.nombre||user.username)}</div><div class="adm-conv-hsub">${esc(user.empresa||user.email||'')}</div></div>`;
  }
  await admFetchConv(uid);
  clearInterval(ADM.pollTimer);
  ADM.pollTimer = setInterval(()=>admFetchConv(uid,true), 12000);
}

async function admFetchConv(uid, silent=false) {
  try {
    const msgs = await apiFetch(`/api/messages/conversation/${uid}`);
    admRenderConv(msgs);
  } catch(e) { if(!silent) toast(`Error: ${e.message}`,true); }
}

function admRenderConv(msgs) {
  const el = $('#admConvBody'); if(!el) return;
  const meId = state.user?.id;
  el.innerHTML = msgs.map(m=>{
    const sent = m.sender_id===meId;
    const t = m.created_at ? new Date(m.created_at).toLocaleString('es-PE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '';
    let att = '';
    if(m.attachment_name&&m.attachment_type){
      if(m.attachment_type.startsWith('image/')){
        att=`<img class="bubble-attach-img" src="" alt="${esc(m.attachment_name)}" data-mid="${m.id}" onclick="admLoadImg(this,${m.id})">`;
      } else {
        att=`<a class="bubble-attach-file" onclick="admDLAttach(${m.id},'${esc(m.attachment_name)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg><span>${esc(m.attachment_name)}</span></a>`;
      }
    }
    return `<div class="bubble-wrap ${sent?'sent':'recv'}">
      ${!sent?`<div class="bubble-sender">${esc(m.sender_name||'')}</div>`:''}
      <div class="bubble ${sent?'sent':'recv'}">${m.body?esc(m.body).replace(/\n/g,'<br>'):''}${att}</div>
      <div class="bubble-time">${t}</div>
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}
function admLoadImg(img, mid) {
  if(img.dataset.loaded) return;
  img.dataset.loaded='1';
  const url = `/api/messages/${mid}/attachment`;
  img.src = url;
  img.onclick = ()=>{ const lb=document.createElement('div');lb.id='imgLightbox';lb.className='open';lb.style='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;cursor:zoom-out';const i=document.createElement('img');i.src=url;i.style='max-width:90vw;max-height:90vh;border-radius:8px';lb.appendChild(i);document.body.appendChild(lb);lb.onclick=()=>lb.remove(); };
}

function admDLAttach(mid, name) {
  window.open(`/api/messages/${mid}/attachment`, '_blank');
}

function admGoMsg(uid) {
  admActivate('mensajeria');
  admLoadMsgUsers().then(()=>{ admOpenConv(uid); });
}

/* ═══════════════════════════════════════════════════════════
   AUDITORÍA (TRAZABILIDAD)
   ═══════════════════════════════════════════════════════════ */
async function admLoadAudit(page=1) {
  const tb = $('#admAuditList');
  if(!tb) return;
  tb.innerHTML = '<tr><td colspan="6" class="adm-empty">Cargando bitácora de auditoría...</td></tr>';
  try {
    const res = await apiFetch(`/api/admin/audit?page=${page}&limit=50`);
    if(!res.data || res.data.length === 0) {
      tb.innerHTML = '<tr><td colspan="6" class="adm-empty">No hay registros de auditoría.</td></tr>';
      return;
    }
    
    tb.innerHTML = res.data.map(log => {
      const date = new Date(log.created_at).toLocaleString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      const user = log.user_name ? `${esc(log.user_name)} <br><small style="color:var(--muted)">${esc(log.user_role)}</small>` : 'Sistema';
      
      let actionColor = 'var(--text-color)';
      if(log.action.includes('UPDATE') || log.action.includes('CHANGE')) actionColor = '#185FA5';
      if(log.action.includes('CREATE') || log.action.includes('GENERATE')) actionColor = '#3B6D11';
      if(log.action.includes('DELETE')) actionColor = '#b3261e';
      
      const actionHtml = `<span style="color:${actionColor};font-weight:600;font-size:12px;">${esc(log.action)}</span>`;
      
      let detailsText = '';
      if(log.details) {
        detailsText = `<pre style="margin:0;font-size:11px;color:var(--muted);background:var(--surface-2);padding:4px;border-radius:4px;max-width:300px;overflow-x:auto;">${esc(JSON.stringify(log.details, null, 2))}</pre>`;
      }
      
      return `<tr>
        <td style="white-space:nowrap;font-size:12px">${date}</td>
        <td>${user}</td>
        <td>${actionHtml}</td>
        <td><span class="adm-chip" style="background:#eee;color:#555">${esc(log.entity_type)}</span></td>
        <td class="mono">${esc(log.entity_id)}</td>
        <td>${detailsText}</td>
      </tr>`;
    }).join('');
    
  } catch(e) {
    tb.innerHTML = `<tr><td colspan="6" class="adm-empty" style="color:red">Error: ${e.message}</td></tr>`;
  }
}
