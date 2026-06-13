/* ── Binding mensajería ───────────────────────────────────────── */
function admBindMessaging() {
  $('#admBroadcastBtn')?.addEventListener('click', ()=>{
    ADM.convUid=null;
    $$('.adm-msg-user-row').forEach(r=>r.classList.remove('active'));
    $('#admMsgEmpty')?.classList.add('hidden');
    const conv=$('#admConv'); conv?.classList.remove('hidden');
    if($('#admConvHeader'))$('#admConvHeader').innerHTML=`<div class="adm-uavatar" style="background:#1a3060">★</div><div><div class="adm-conv-hname">Mensaje a todos los usuarios</div><div class="adm-conv-hsub">Llegará a todos los usuarios registrados</div></div>`;
    if($('#admConvBody'))$('#admConvBody').innerHTML='';
  });
  const fi=$('#admFileInput');
  $('#admAttachBtn')?.addEventListener('click',()=>fi?.click());
  fi?.addEventListener('change',()=>{ if(fi.files[0]) admPrepAttach(fi.files[0]); });
  $('#admSendBtn')?.addEventListener('click', admSend);
  $('#admComposeText')?.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();admSend();} });
  $('#admComposeText')?.addEventListener('input',function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px';});
}

function admPrepAttach(f) {
  if(f.size>6*1024*1024){toast('El archivo supera 6 MB',true);return;}
  ADM.attachFile = f;
  const prev=$('#admAttachPreview'); if(prev){prev.classList.remove('hidden'); $('#admAttachName').textContent=f.name;}
  toast(`Adjunto listo: ${f.name}`);
}

function admClearAttach(){
  ADM.attachFile=null;
  $('#admAttachPreview')?.classList.add('hidden');
  const fi=$('#admFileInput');if(fi)fi.value='';
}

async function admSend() {
  const input=$('#admComposeText');
  const body=(input?.value||'').trim();
  if(!body&&!ADM.attachFile)return;
  
  const sendBtn = $('#admSendBtn');
  if(sendBtn) sendBtn.disabled = true;

  try{
    const fd = new FormData();
    if(ADM.convUid) fd.append('recipient_id', ADM.convUid);
    fd.append('body', body);
    fd.append('subject', '');
    if(ADM.attachFile) fd.append('attachment', ADM.attachFile);

    const res = await fetch('/api/messages', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if(!res.ok) throw new Error(data.error || 'Error HTTP ' + res.status);

    if(input){input.value='';input.style.height='auto';}
    admClearAttach();
    if(ADM.convUid) admFetchConv(ADM.convUid);
    else toast('Mensaje enviado a todos ✓');
  }catch(e){toast(`Error: ${e.message}`,true);}
  finally {
    if(sendBtn) sendBtn.disabled = false;
  }
}


/* ═══════════════════════════════════════════════════════════
   MENSAJERÍA USUARIO
   ═══════════════════════════════════════════════════════════ */
let USR_MSG = { attachData:null, attachName:null, attachType:null };

/* ================================================================
   MENSAJERÍA USUARIO — Conversación bidireccional completa
   ================================================================ */

let MSG = {
  adminId:     null,
  adminName:   'Administrador ESV',
  convLoaded:  false,
  pollTimer:   null,
  lastMsgId:   0,
  attachData:  null,
  attachName:  null,
  attachType:  null,
};

/* ── Abrir panel ──────────────────────────────────────────────── */
async function openMsgPanel() {
  const panel = $('#msgUserPanel');
  if (!panel) return;
  panel.classList.remove('hidden');

  /* Cargar info del admin si no la tenemos */
  if (!MSG.adminId) {
    try {
      const info = await apiFetch('/api/messages/admin-info');
      MSG.adminId   = info.id;
      MSG.adminName = info.nombre || 'Administrador ESV';
      const av = $('#msgAdminAv');
      if (av) av.textContent = (info.nombre||'AD').slice(0,2).toUpperCase();
      const nm = $('#msgAdminName');
      if (nm) nm.textContent = info.nombre || 'Administrador ESV';
    } catch(e) {
      console.warn('No se pudo obtener info del admin:', e.message);
      MSG.adminId = 0;
    }
  }

  await loadUserConv();

  /* Polling cada 15 segundos mientras el panel está abierto */
  clearInterval(MSG.pollTimer);
  MSG.pollTimer = setInterval(() => loadUserConv(true), 15000);
}

/* ── Cerrar panel ─────────────────────────────────────────────── */
function closeMsgPanel() {
  $('#msgUserPanel')?.classList.add('hidden');
  clearInterval(MSG.pollTimer);
}

/* ── Cargar conversación ──────────────────────────────────────── */
async function loadUserConv(silent = false) {
  const el = $('#msgConvBody');
  if (!el) return;
  if (!silent) el.innerHTML = '<div class="adm-empty" style="padding:32px">Cargando…</div>';

  try {
    const msgs = await apiFetch(
      MSG.adminId ? `/api/messages/conversation/${MSG.adminId}` : '/api/messages'
    );
    if (!msgs.length) {
      el.innerHTML = `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:32px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="width:40px;height:40px;stroke:#ddd"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <div style="font-size:13px;color:#bbb">Aún no hay mensajes.</div>
          <div style="font-size:12px;color:#ccc">El administrador puede enviarte documentos, fotos y avisos.</div>
        </div>`;
      return;
    }

    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    renderUserConv(msgs);
    if (atBottom || !silent) el.scrollTop = el.scrollHeight;
    updateMsgBadge();
  } catch(e) {
    if (!silent) el.innerHTML = `<div class="adm-empty">Error: ${esc(e.message)}</div>`;
  }
}

/* ── Renderizar burbujas de conversación ─────────────────────── */
function renderUserConv(msgs) {
  const el = $('#msgConvBody'); if (!el) return;
  const meId = state.user?.id;

  let html = '';
  let lastDate = '';

  msgs.forEach(m => {
    const sent = m.sender_id === meId;
    const dt   = m.created_at ? new Date(m.created_at) : null;
    const dateStr = dt ? dt.toLocaleDateString('es-PE', {day:'2-digit',month:'long',year:'numeric'}) : '';
    const timeStr = dt ? dt.toLocaleTimeString('es-PE', {hour:'2-digit',minute:'2-digit'}) : '';

    /* Separador de fecha */
    if (dateStr && dateStr !== lastDate) {
      html += `<div class="msg-date-sep">${dateStr}</div>`;
      lastDate = dateStr;
    }

    /* Adjunto */
    let attHtml = '';
    if (m.attachment_name && m.attachment_type) {
      if (m.attachment_type.startsWith('image/')) {
        attHtml = `<img class="msg-batt-img" src="" alt="${esc(m.attachment_name)}" data-mid="${m.id}" onclick="usrLoadImg(this,${m.id})">`;
      } else {
        const icon = m.attachment_type === 'application/pdf'
          ? 'ti-file-type-pdf' : 'ti-file-text';
        attHtml = `<span class="msg-batt-file" onclick="usrDLAttach(${m.id},'${esc(m.attachment_name)}')">
          <i class="ti ${icon}" style="font-size:15px" aria-hidden="true"></i>
          <span style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.attachment_name)}</span>
        </span>`;
      }
    }

    const sender = !sent ? `<div class="msg-bsender">${esc(m.sender_name || MSG.adminName)}</div>` : '';
    const bodyHtml = m.body ? esc(m.body).replace(/\n/g,'<br>') : '';

    html += `
      <div class="msg-bw ${sent?'sent':'recv'}">
        ${sender}
        <div class="msg-b ${sent?'sent':'recv'}">
          ${bodyHtml}${attHtml}
        </div>
        <div class="msg-btime">${timeStr}${sent?' · Enviado':''}</div>
      </div>`;
  });

  el.innerHTML = html;

  /* Lazy-load images */
  el.querySelectorAll('img[data-mid]').forEach(img => {
    if (!img.dataset.loaded) usrLoadImg(img, parseInt(img.dataset.mid));
  });
}

/* ── Cargar imagen de adjunto ─────────────────────────────────── */
function usrLoadImg(imgEl, mid) {
  if (imgEl.dataset.loaded) return;
  imgEl.dataset.loaded = '1';
  
  const url = `/api/messages/${mid}/attachment`;
  imgEl.src = url;
  imgEl.onclick = () => {
    const lb = document.createElement('div');
    lb.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;cursor:zoom-out';
    const img = document.createElement('img');
    img.src = url;
    img.style.cssText = 'max-width:90vw;max-height:90vh;border-radius:8px';
    lb.appendChild(img);
    document.body.appendChild(lb);
    lb.onclick = () => lb.remove();
  };
}

/* ── Descargar adjunto ────────────────────────────────────────── */
function usrDLAttach(mid, name) {
  window.open(`/api/messages/${mid}/attachment`, '_blank');
}

/* ── Preparar adjunto antes de enviar ────────────────────────── */
function msgPrepAttach(file) {
  if (file.size > 6 * 1024 * 1024) { toast('El archivo supera 6 MB', true); return; }
  MSG.attachFile = file;
  const prev = $('#msgAttachPrev');
  if (prev) {
    prev.style.display = 'flex';
    const nm = $('#msgAttachPrevName');
    if (nm) nm.textContent = file.name;
  }
  toast(`Adjunto listo: ${file.name}`);
}

function msgClearAttach() {
  MSG.attachFile = null;
  const prev = $('#msgAttachPrev');
  if (prev) prev.style.display = 'none';
  const fi = $('#msgUserFile');
  if (fi) fi.value = '';
}

/* ── Enviar mensaje al admin ─────────────────────────────────── */
async function sendUserMsg() {
  const input = $('#msgUserText');
  const body  = (input?.value || '').trim();
  if (!body && !MSG.attachFile) return;

  /* Deshabilitar botón mientras envía */
  const sendBtn = $('#msgUserSendBtn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const fd = new FormData();
    if(MSG.adminId) fd.append('recipient_id', MSG.adminId);
    fd.append('body', body);
    fd.append('subject', '');
    if(MSG.attachFile) fd.append('attachment', MSG.attachFile);

    const res = await fetch('/api/messages', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if(!res.ok) throw new Error(data.error || 'Error HTTP ' + res.status);

    if (input) { input.value = ''; input.style.height = 'auto'; }
    msgClearAttach();
    await loadUserConv();
    const el = $('#msgConvBody');
    if (el) el.scrollTop = el.scrollHeight;
  } catch(e) {
    toast(`Error al enviar: ${e.message}`, true);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

/* ── Badge de mensajes no leídos ──────────────────────────────── */
async function updateMsgBadge() {
  try {
    const d = await apiFetch('/api/messages/unread');
    const n = d.unread || 0;
    const b = $('#msgTopbarBadge');
    if (b) { b.textContent = n; b.classList.toggle('hidden', n === 0); }
  } catch(_) {}
}

/* ── Notificación flotante de nuevo mensaje ───────────────────── */
function showNewMsgNotif(senderName) {
  const existing = document.querySelector('.msg-new-notif');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'msg-new-notif';
  el.innerHTML = `
    <div class="msg-new-notif-dot"></div>
    <span>Nuevo mensaje de ${esc(senderName || 'Administrador')}</span>
    <span style="font-size:11px;opacity:.7">· Abrir</span>`;
  el.onclick = () => { el.remove(); openMsgPanel(); };
  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 6000);
}

/* ── Abrir chat desde notificación ───────────────────────────── */
function handleNotifClick(tipo, referencia) {
  if (tipo === 'mensaje') {
    openMsgPanel();
  }
}

/* ── Admin: actualizar contador de mensajes no leídos ──────────── */
async function admPollMsgCount() {
  try {
    const users = await apiFetch('/api/messages/users');
    const totalUnread = users.reduce((sum, u) => sum + (u.unread_count || 0), 0);
    const badge = $('#navBadgeMsgs');
    if (badge) {
      if (totalUnread > 0) {
        badge.textContent = totalUnread;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
    /* Actualizar badge en lista de usuarios si está visible */
    $$('.adm-msg-user-row').forEach(row => {
      const uid = parseInt(row.dataset.uid);
      const user = users.find(u => u.id === uid);
      const dot = row.querySelector('.adm-msg-unread-dot');
      if (user && user.unread_count > 0) {
        if (!dot) {
          const d = document.createElement('div');
          d.className = 'adm-msg-unread-dot';
          row.appendChild(d);
        }
      } else {
        dot?.remove();
      }
    });
  } catch(_) {}
}

/* ── Botón de mensajes en topbar del usuario ──────────────────── */
function buildMsgTopbarBtn() {
  const btn = $('#btnMsgs'); if (!btn) return;
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    <span class="msg-topbar-badge hidden" id="msgTopbarBadge">0</span>`;
}

/* ── Init ─────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  buildMsgTopbarBtn();

  /* Botón de mensajes en topbar */
  $('#btnMsgs')?.addEventListener('click', () => {
    if (typeof isAdmin === 'function' && isAdmin()) {
      /* Admin: ir a sección mensajería del panel admin */
      admActivate?.('mensajeria');
      admLoadMsgUsers?.();
    } else {
      openMsgPanel();
    }
  });

  /* Cerrar panel usuario */
  $('#msgPanelClose')?.addEventListener('click', closeMsgPanel);
  $('#msgUserPanel')?.addEventListener('click', e => {
    if (e.target.id === 'msgUserPanel') closeMsgPanel();
  });

  /* Enviar */
  $('#msgUserSendBtn')?.addEventListener('click', sendUserMsg);
  $('#msgUserText')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendUserMsg(); }
  });
  /* Auto-resize textarea */
  $('#msgUserText')?.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
  });

  /* Adjuntos */
  const uf = $('#msgUserFile');
  $('#msgUserAttachBtn')?.addEventListener('click', () => uf?.click());
  uf?.addEventListener('change', () => {
    const f = uf.files[0]; if (f) msgPrepAttach(f);
  });
  /* Drag & drop en el panel */
  $('#msgUserPanel')?.addEventListener('dragover', e => e.preventDefault());
  $('#msgUserPanel')?.addEventListener('drop', e => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) msgPrepAttach(f);
  });

  /* Polling de mensajes no leídos para usuarios — cada 30s */
  setInterval(() => {
    if (state.user && typeof isUser === 'function' && isUser()) {
      updateMsgBadge();
    }
  }, 30000);

  /* Polling de admin — cada 20s */
  setInterval(() => {
    if (state.user && typeof isAdmin === 'function' && isAdmin()) {
      admPollMsgCount();
    }
  }, 20000);
});

/* ================================================================ */
