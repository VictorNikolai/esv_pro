/* ─── Poblar departamentos al abrir el modal ────────────────── */
function initUbigeoSelects() {
  const selDep = $('#rg_departamento');
  if (!selDep || selDep.options.length > 1) return;
  PERU_UBIGEO.departamentos.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.c; opt.textContent = d.n;
    selDep.appendChild(opt);
  });
}

function bindUbigeo() {
  const selDep  = $('#rg_departamento');
  const selProv = $('#rg_provincia');
  const selDis  = $('#rg_distrito');
  if (!selDep) return;

  selDep.addEventListener('change', () => {
    const dep = selDep.value;
    selProv.innerHTML = '<option value="">— Seleccionar provincia —</option>';
    selDis.innerHTML  = '<option value="">— Seleccionar distrito —</option>';
    selProv.disabled = true; selDis.disabled = true;
    if (!dep) return;
    const provs = PERU_UBIGEO.provincias[dep] || [];
    provs.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.c; opt.textContent = p.n;
      selProv.appendChild(opt);
    });
    selProv.disabled = false;
  });

  selProv.addEventListener('change', () => {
    const prov = selProv.value;
    selDis.innerHTML = '<option value="">— Seleccionar distrito —</option>';
    selDis.disabled  = true;
    if (!prov) return;
    const distritos = getDistritos(prov);
    distritos.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.n; opt.textContent = d.n;
      selDis.appendChild(opt);
    });
    selDis.disabled = false;
  });
}

/* ─── Override openRegisterModal para inicializar ubigeo ─────── */
const _origOpenRegister = openRegisterModal;
window.openRegisterModal = function() {
  _origOpenRegister();
  initUbigeoSelects();
  bindUbigeo();
  // Clear new fields
  ['rg_empresa','rg_departamento'].forEach(id => {
    const el = $('#' + id);
    if (el) { if (el.tagName === 'SELECT') el.selectedIndex = 0; else el.value = ''; }
  });
  ['rg_provincia','rg_distrito'].forEach(id => {
    const el = $('#' + id);
    if (el) { el.innerHTML = '<option value="">—</option>'; el.disabled = true; }
  });
};

/* ─── Override submitRegistration — añadir nuevos campos ────── */
const _origSubmitReg = submitRegistration;
window.submitRegistration = async function() {
  const btn = $('#rgSubmit');
  btn.disabled = true; btn.textContent = 'Creando cuenta…';
  $('#rgError').textContent = '';

  const body = {
    nombre_completo:  $('#rg_nombre')?.value?.trim(),
    username:         $('#rg_username')?.value?.trim().toLowerCase(),
    email:            $('#rg_email')?.value?.trim().toLowerCase(),
    dni:              $('#rg_dni')?.value?.trim(),
    empresa:          $('#rg_empresa')?.value?.trim(),
    cargo:            $('#rg_cargo')?.value?.trim(),
    telefono:         $('#rg_telefono')?.value?.trim(),
    departamento:     $('#rg_departamento')?.options[$('#rg_departamento')?.selectedIndex]?.text || '',
    provincia:        $('#rg_provincia')?.options[$('#rg_provincia')?.selectedIndex]?.text || '',
    distrito:         $('#rg_distrito')?.value || '',
    password:         $('#rg_pass')?.value,
    confirm_password: $('#rg_pass2')?.value,
  };

  try {
    const res = await apiPost('/api/register', body);
    $('#registerModal').classList.remove('open');
    toast('✓ Cuenta creada. Iniciando sesión…');

    // Auto-login after registration
    setTimeout(async () => {
      try {
        const u = await apiPost('/api/login', {
          username: body.username,
          password: body.password
        });
        setUser(u);
        await loadCatalog();
        renderOrder();
        applyRole();
        startNotifPolling();
        toast(`Bienvenido, ${u.nombre}!`);
      } catch (_) {
        // Manual login fallback
        const err = $('#loginError');
        if (err) {
          err.textContent = '✓ Cuenta creada. Inicia sesión con tus datos.';
          err.style.color = 'var(--ok)';
        }
      }
    }, 600);

  } catch (err) {
    const data = err.data || {};
    if (data.fields) {
      Object.entries(data.fields).forEach(([field, msg]) => {
        const el = $(`#rg_${field}_msg`);
        if (el) { el.textContent = msg; el.className = 'field-msg err'; }
      });
      $('#rgError').textContent = 'Revisa los campos marcados.';
    } else if (data.field) {
      const el = $(`#rg_${data.field}_msg`);
      if (el) { el.textContent = data.error; el.className = 'field-msg err'; }
      const av = $(`#rg_${data.field}_avail`);
      if (av) { av.textContent = '✗'; av.className = 'avail-indicator err'; }
      $('#rgError').textContent = data.error || 'Error de registro.';
    } else {
      $('#rgError').textContent = data.error || err.message || 'Error al crear la cuenta.';
    }
  } finally {
    btn.disabled = false; btn.textContent = 'Crear mi cuenta';
  }
};

/* ================================================================
   PERFIL DE CLIENTE — Modal de edición
   ================================================================ */

let PROF = { loading: false };

/* ── Abrir perfil ─────────────────────────────────────────────── */
async function openProfile() {
  const modal = $('#profileModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  profShowTab('datos');
  await profLoadData();
}

function closeProfile() {
  $('#profileModal')?.classList.add('hidden');
  /* Limpiar mensajes de resultado */
  ['profDatosMsg','profEmpresaMsg','profPwMsg'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.classList.add('hidden');
  });
}

/* ── Cargar datos actuales ────────────────────────────────────── */
async function profLoadData() {
  try {
    const me = await apiFetch('/api/users/me');

    /* Header */
    const name = me.nombre || me.username || 'Cliente';
    const el = $('#profBigAv'); if (el) el.textContent = name.slice(0,2).toUpperCase();
    const nm = $('#profHeaderName'); if (nm) nm.textContent = name;

    /* Tab datos */
    const set = (id, val) => { const e = $(`#${id}`); if(e) e.value = val || ''; };
    set('pf_nombre',   me.nombre);
    set('pf_email',    me.email);
    set('pf_telefono', me.telefono);
    set('pf_dni',      me.dni);

    /* Tab empresa */
    set('pf_empresa',  me.empresa);
    set('pf_cargo',    me.cargo);

    /* Ubigeo */
    profFillUbigeo(me.departamento, me.provincia, me.distrito);
  } catch(e) {
    console.warn('profLoadData:', e.message);
  }
}

/* ── Poblar selects de ubigeo ─────────────────────────────────── */
function profFillUbigeo(dept, prov, dist) {
  const deptSel = $('#pf_departamento'); if (!deptSel) return;
  /* Poblar departamentos */
  if (typeof PERU_UBIGEO !== 'undefined') {
    deptSel.innerHTML = '<option value="">— Seleccionar —</option>' +
      PERU_UBIGEO.departamentos.map(d => `<option value="${esc(d.c)}" ${d.c===dept?'selected':''}>${esc(d.n)}</option>`).join('');
  }
  /* Trigger para cargar provincias */
  if (dept) {
    profLoadProvincias(dept, prov, dist);
  }
  deptSel.addEventListener('change', () => {
    profLoadProvincias(deptSel.value, '', '');
  });
}

function profLoadProvincias(deptCode, selProv, selDist) {
  const provSel = $('#pf_provincia'); if (!provSel) return;
  const provincias = (typeof PERU_UBIGEO !== 'undefined' && PERU_UBIGEO.provincias[deptCode]) ? PERU_UBIGEO.provincias[deptCode] : [];
  provSel.innerHTML = '<option value="">— Seleccionar —</option>' +
    provincias.map(p => `<option value="${esc(p.c)}" ${p.c===selProv?'selected':''}>${esc(p.n)}</option>`).join('');
  if (selProv) profLoadDistritos(selProv, selDist);
  provSel.onchange = () => profLoadDistritos(provSel.value, '');
}

function profLoadDistritos(provCode, selDist) {
  const distSel = $('#pf_distrito'); if (!distSel) return;
  const distritos = typeof getDistritos === 'function' ? getDistritos(provCode) : [];
  distSel.innerHTML = '<option value="">— Seleccionar —</option>' +
    distritos.map(d => `<option value="${esc(d.n)}" ${d.n===selDist?'selected':''}>${esc(d.n)}</option>`).join('');
}

/* ── Tabs ─────────────────────────────────────────────────────── */
function profShowTab(tabId) {
  $$('.prof-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.ptab === tabId);
    t.setAttribute('aria-selected', String(t.dataset.ptab === tabId));
  });
  $$('.prof-pane').forEach(p => p.classList.remove('active'));
  $(`#ptab-${tabId}`)?.classList.add('active');
}

/* ── Guardar datos personales ─────────────────────────────────── */
async function pfSaveDatosHandler() {
  const btn = $('#pfSaveDatos'); if (btn) btn.disabled = true;
  const msgEl = $('#profDatosMsg');

  const payload = {
    nombre:   $('#pf_nombre')?.value.trim(),
    telefono: $('#pf_telefono')?.value.trim(),
    dni:      $('#pf_dni')?.value.trim(),
  };

  if (!payload.nombre) {
    showProfMsg(msgEl, 'El nombre no puede estar vacío.', 'err');
    if(btn) btn.disabled = false; return;
  }

  try {
    await apiFetch('/api/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    /* Actualizar topbar */
    const nombre = $('#userNombre'); if(nombre) nombre.textContent = payload.nombre;
    const av = $('#roleAvatar'); if(av) av.textContent = payload.nombre.slice(0,2).toUpperCase();
    const bigAv = $('#profBigAv'); if(bigAv) bigAv.textContent = payload.nombre.slice(0,2).toUpperCase();
    const headerNm = $('#profHeaderName'); if(headerNm) headerNm.textContent = payload.nombre;
    showProfMsg(msgEl, '✓ Datos personales guardados correctamente.', 'ok');
    toast('Perfil actualizado ✓');
  } catch(e) {
    showProfMsg(msgEl, `Error: ${e.message}`, 'err');
  } finally {
    if(btn) btn.disabled = false;
  }
}

/* ── Guardar empresa ──────────────────────────────────────────── */
async function pfSaveEmpresaHandler() {
  const btn = $('#pfSaveEmpresa'); if (btn) btn.disabled = true;
  const msgEl = $('#profEmpresaMsg');

  const payload = {
    empresa:      $('#pf_empresa')?.value.trim(),
    cargo:        $('#pf_cargo')?.value.trim(),
    departamento: $('#pf_departamento')?.value,
    provincia:    $('#pf_provincia')?.value,
    distrito:     $('#pf_distrito')?.value,
  };

  if (!payload.empresa) {
    showProfMsg(msgEl, 'El nombre de la empresa no puede estar vacío.', 'err');
    if(btn) btn.disabled = false; return;
  }

  try {
    await apiFetch('/api/users/profile', { method:'PATCH', body: JSON.stringify(payload) });
    showProfMsg(msgEl, '✓ Datos de empresa guardados correctamente.', 'ok');
    toast('Empresa actualizada ✓');
  } catch(e) {
    showProfMsg(msgEl, `Error: ${e.message}`, 'err');
  } finally {
    if(btn) btn.disabled = false;
  }
}

/* ── Cambiar contraseña ───────────────────────────────────────── */
async function pfSavePwHandler() {
  const btn = $('#pfSavePw'); if (btn) btn.disabled = true;
  const msgEl = $('#profPwMsg');

  const actual  = $('#pf_pw_actual')?.value || '';
  const nueva   = $('#pf_pw_nueva')?.value  || '';
  const confirm = $('#pf_pw_confirm')?.value || '';

  if (!actual) { showProfMsg(msgEl,'Ingresa tu contraseña actual.','err'); if(btn)btn.disabled=false; return; }
  if (nueva.length < 8) { showProfMsg(msgEl,'La nueva contraseña debe tener al menos 8 caracteres.','err'); if(btn)btn.disabled=false; return; }
  if (nueva !== confirm) { showProfMsg(msgEl,'Las contraseñas no coinciden.','err'); if(btn)btn.disabled=false; return; }

  try {
    await apiFetch('/api/users/password', {
      method: 'PATCH',
      body: JSON.stringify({ current_password: actual, new_password: nueva })
    });
    /* Limpiar campos */
    ['pf_pw_actual','pf_pw_nueva','pf_pw_confirm'].forEach(id => {
      const e = $(`#${id}`); if(e) e.value = '';
    });
    const bar = $('#profPwBar'); if(bar) { bar.style.width='0%'; }
    const str = $('#profPwStrength'); if(str) str.textContent = '';
    showProfMsg(msgEl, '✓ Contraseña cambiada exitosamente.', 'ok');
    toast('Contraseña actualizada ✓');
  } catch(e) {
    showProfMsg(msgEl, e.message, 'err');
  } finally {
    if(btn) btn.disabled = false;
  }
}

/* ── Helper mostrar mensaje ───────────────────────────────────── */
function showProfMsg(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className   = `prof-result ${type}`;
  el.classList.remove('hidden');
  if (type === 'ok') setTimeout(() => el.classList.add('hidden'), 4000);
}

/* ── Fortaleza de contraseña ──────────────────────────────────── */
function profPwStrength(pw) {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['','Muy débil','Débil','Aceptable','Fuerte','Muy fuerte'];
  const colors = ['','#E24B4A','#EF9F27','#EF9F27','#3B6D11','#3B6D11'];
  const bar = $('#profPwBar');
  const str = $('#profPwStrength');
  if (bar) { bar.style.width = `${score * 20}%`; bar.style.background = colors[score]; }
  if (str) { str.textContent = labels[score]; str.style.color = colors[score]; }
}

/* ── Visibilidad contraseña ───────────────────────────────────── */
function bindPwEyes() {
  $$('.prof-pw-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = $(`#${btn.dataset.target}`);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.querySelector('svg')?.setAttribute('opacity', input.type === 'text' ? '.5' : '1');
    });
  });
}

/* ── Init ─────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  /* Abrir perfil al hacer clic en la pastilla del usuario */
  $('#rolePillBtn')?.addEventListener('click', openProfile);
  $('#rolePillBtn')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProfile(); }
  });

  /* Cerrar */
  $('#profileClose')?.addEventListener('click', closeProfile);
  $('#profileModal')?.addEventListener('click', e => {
    if (e.target.id === 'profileModal') closeProfile();
  });

  /* Tabs */
  $$('.prof-tab').forEach(btn => {
    btn.addEventListener('click', () => profShowTab(btn.dataset.ptab));
  });

  /* Guardar */
  $('#pfSaveDatos')?.addEventListener('click', pfSaveDatosHandler);
  $('#pfSaveEmpresa')?.addEventListener('click', pfSaveEmpresaHandler);
  $('#pfSavePw')?.addEventListener('click', pfSavePwHandler);

  /* Fortaleza */
  $('#pf_pw_nueva')?.addEventListener('input', function() { profPwStrength(this.value); });

  /* Eyes */
  bindPwEyes();

  /* Escape */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#profileModal')?.classList.contains('hidden')) closeProfile();
  });
});
