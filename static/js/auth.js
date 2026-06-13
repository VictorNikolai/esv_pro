/* ─── Sesión ─────────────────────────────────────────────── */
function setUser(u) {
  state.user = u;
  state.role = u.role;
  $('#roleLabel').textContent  = ROLES[u.role]?.short || u.role;
  $('#roleAvatar').textContent = (u.nombre || u.username).slice(0, 2).toUpperCase();
  $('#userNombre').textContent = u.nombre || u.username;
  $('#roleNoteText').innerHTML = `<b>${ROLES[u.role]?.label || u.role}.</b> ${ROLES[u.role]?.note || ''}`;
  
  // Iniciar WebSockets
  if (typeof initWebSocket === 'function') {
    initWebSocket(u);
  }

  const isAdminUser = u.role === 'admin';
  document.body.classList.toggle('is-admin', isAdminUser);
  // Hide login overlay
  $('#login').classList.add('hidden');
  // Show the correct dashboard (direct call, no event race condition)
  if (isAdminUser) {
    setTimeout(showAdminDashboard, 50);
  } else {
    $('#adminDashboard')?.classList.add('hidden');
    document.body.classList.remove('is-admin');
    updateMsgBadge();
  }
}

function showLogin() {
  $('#login').classList.remove('hidden');
  $('#loginError').textContent = '';
  setTimeout(() => $('#loginUsername')?.focus(), 80);
}

function bindLogin() {
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const username = ($('#loginUsername').value || '').trim();
    const password = $('#loginPassword').value || '';
    const btn = e.target.querySelector('button[type=submit]');
    if (!username || !password) {
      $('#loginError').textContent = 'Ingresa usuario y contraseña';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Verificando…';
    $('#loginError').textContent = '';
    try {
      const u = await apiPost('/api/login', { username, password });
      setUser(u);
      await loadCatalog();
      renderOrder();
      applyRole();
      startNotifPolling();
    } catch (err) {
      $('#loginError').textContent = err.data?.error || 'Usuario o contraseña incorrectos';
      $('#loginPassword').value = '';
      $('#loginPassword').focus();
    } finally {
      btn.disabled = false;
      btn.textContent = 'Ingresar al sistema';
    }
  });

  $('#btnLogout').addEventListener('click', doLogout);
}

async function doLogout(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  await apiPost('/api/logout', {}).catch(() => {});
  clearInterval(notifPollTimer);
  cancelAllSaves();
  Object.assign(state, { user: null, role: 'usuario', orderId: null, orderNo: null,
    order: [], client: { empresa:'', ruc:'', contacto:'', email:'', telefono:'' }, fecha: new Date() });
  $('#loginUsername').value = '';
  $('#loginPassword').value = '';
  
  if (typeof socket !== 'undefined' && socket) {
      socket.disconnect();
  }

  hideAdminDashboard(); // Ensure admin dashboard hides
  showLogin();
}

/* ─── Tema ───────────────────────────────────────────────── */
function bindTheme() {
  $$('.theme-switch button').forEach(b => {
    b.addEventListener('click', () => {
      state.theme = b.dataset.theme;
      document.documentElement.setAttribute('data-theme', state.theme);
      localStorage.setItem('esv.theme', state.theme);
      $$('.theme-switch button').forEach(x => x.classList.toggle('active', x === b));
    });
  });
  $$('.theme-switch button').forEach(x => x.classList.toggle('active', x.dataset.theme === state.theme));
}

/* ─── Rol ─────────────────────────────────────────────────── */
function applyRole() {
  const r = ROLES[state.role] || ROLES.usuario;
  document.body.classList.toggle('hide-prices', !r.seePrices);
  $$('.method').forEach(el => el.classList.toggle('pricehide', !r.seePrices));
  $$('.instr-head .subtotal').forEach(el => el.classList.toggle('pricehide', !r.seePrices));
  $('#totalCard')?.classList.toggle('pricehide', !r.seePrices);
  $('#btnQuote').disabled     = !r.canQuote || state.order.length === 0;
  $('#btnConstancia').disabled = state.order.length === 0;
  document.body.classList.toggle('is-admin', r.canAdmin);
  updateTotals();
}
function applyRoleActionsOnly() {
  const r = ROLES[state.role] || ROLES.usuario;
  $('#btnQuote').disabled      = !r.canQuote || state.order.length === 0;
  $('#btnConstancia').disabled  = state.order.length === 0;
}

/* ─── 7. Módulo de REGISTRO ──────────────────────────────────── */
const checkTimers = {};

function bindRegistrationModal() {
  $('#btnOpenRegister').addEventListener('click', openRegisterModal);
  const close = () => $('#registerModal').classList.remove('open');
  $('#rgClose').addEventListener('click',  close);
  $('#rgCancel').addEventListener('click', close);
  $('#registerModal').addEventListener('click', e => { if (e.target.id === 'registerModal') close(); });
  $('#rgSubmit').addEventListener('click', submitRegistration);

  // Real-time availability checks
  const debounceCheck = (field, inputId) => {
    clearTimeout(checkTimers[field]);
    checkTimers[field] = setTimeout(() => checkAvailability(field, inputId), 600);
  };
  $('#rg_username').addEventListener('input', () => debounceCheck('username', 'rg_username'));
  $('#rg_email').addEventListener('input',    () => debounceCheck('email',    'rg_email'));

  // Password strength
  $('#rg_pass').addEventListener('input',  updatePassStrength);
  $('#rg_pass2').addEventListener('input', checkPassMatch);

  // Auto-suggest username from nombre
  $('#rg_nombre').addEventListener('blur', () => {
    const username = $('#rg_username');
    if (username.value) return;   // already set
    const words = $('#rg_nombre').value.trim().split(/\s+/);
    if (words.length >= 2) {
      const suggest = (words[0][0] + '.' + words[words.length - 1]).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // remove accents
        .replace(/[^a-z0-9._-]/g, '');
      username.value = suggest.slice(0, 30);
      checkAvailability('username', 'rg_username');
    }
  });
}

function openRegisterModal() {
  ['rg_nombre','rg_username','rg_dni','rg_email','rg_telefono',
   'rg_cargo','rg_motivo'].forEach(id => { const el = $('#'+id); if (el) el.value = ''; });
  // rg_area y rg_rol ya no existen — null-safe
  ['rg_area','rg_rol','rg_departamento'].forEach(id => {
    const el = $('#'+id); if (el && el.tagName==='SELECT') el.selectedIndex = 0;
  });
  $('#rg_pass').value = ''; $('#rg_pass2').value = '';
  $('#rgError').textContent = '';
  $('#passStrengthFill').className = '';
  ['rg_username_avail','rg_email_avail'].forEach(id => {
    const el = $('#'+id); if (el) { el.textContent=''; el.className='avail-indicator'; }
  });
  ['rg_username_msg','rg_email_msg','rg_pass_msg','rg_pass2_msg',
   'rg_nombre_msg','rg_cargo_msg','rg_dni_msg'].forEach(id => {
    const el = $('#'+id); if (el) { el.textContent=''; el.className='field-msg'; }
  });
  $('#registerModal').classList.add('open');
  setTimeout(() => $('#rg_nombre')?.focus(), 80);
}

async function checkAvailability(field, inputId) {
  const input     = $('#' + inputId);
  const indicator = $('#' + inputId + '_avail');
  const msg       = $('#' + inputId + '_msg');
  const value     = input?.value?.trim();
  if (!value || !indicator) return;

  indicator.textContent = '↻';
  indicator.className   = 'avail-indicator spin';

  try {
    const res = await apiGet(`/api/register/check?field=${field}&value=${encodeURIComponent(value)}`);
    if (res.available) {
      indicator.textContent = '✓';
      indicator.className   = 'avail-indicator ok';
      if (msg) { msg.textContent = 'Disponible'; msg.className = 'field-msg ok'; }
    } else {
      indicator.textContent = '✗';
      indicator.className   = 'avail-indicator err';
      if (msg) { msg.textContent = res.reason || 'No disponible'; msg.className = 'field-msg err'; }
    }
  } catch (_) {
    indicator.textContent = '';
    indicator.className   = 'avail-indicator';
  }
}

function updatePassStrength() {
  const pwd  = $('#rg_pass').value || '';
  const fill = $('#passStrengthFill');
  if (!fill) return;
  let score = 0;
  if (pwd.length >= 8)                      score++;
  if (/[A-Z]/.test(pwd))                    score++;
  if (/[0-9]/.test(pwd))                    score++;
  if (/[^a-zA-Z0-9]/.test(pwd))            score++;
  fill.className = score > 0 ? `s${score}` : '';
  const msgs = ['', 'Débil', 'Moderada', 'Fuerte', 'Muy fuerte'];
  const msg  = $('#rg_pass_msg');
  if (msg) {
    msg.textContent = pwd.length > 0 ? msgs[score] : '';
    msg.className   = score >= 3 ? 'field-msg ok' : (score > 0 ? 'field-msg err' : 'field-msg');
  }
  checkPassMatch();
}

function checkPassMatch() {
  const p1  = $('#rg_pass')?.value || '';
  const p2  = $('#rg_pass2')?.value || '';
  const msg = $('#rg_pass2_msg');
  if (!msg || !p2) return;
  if (p1 === p2) {
    msg.textContent = 'Las contraseñas coinciden ✓';
    msg.className   = 'field-msg ok';
  } else {
    msg.textContent = 'No coinciden';
    msg.className   = 'field-msg err';
  }
}

async function submitRegistration() {
  const btn = $('#rgSubmit');
  btn.disabled = true; btn.textContent = 'Enviando…';
  $('#rgError').textContent = '';

  const body = {
    nombre_completo:  $('#rg_nombre')?.value?.trim(),
    username:         $('#rg_username')?.value?.trim().toLowerCase(),
    email:            $('#rg_email')?.value?.trim().toLowerCase(),
    telefono:         $('#rg_telefono')?.value?.trim(),
    dni:              $('#rg_dni')?.value?.trim(),
    cargo:            $('#rg_cargo')?.value?.trim(),
    /* area_trabajo y rol_solicitado eliminados del formulario */
    password:         $('#rg_pass')?.value,
    confirm_password: $('#rg_pass2')?.value,
    /* motivo eliminado del formulario */
  };

  try {
    const res = await apiPost('/api/register', body);
    $('#registerModal').classList.remove('open');
    toast(res.message || 'Registro enviado. El administrador activará tu cuenta.');
    // Show success message in login area
    const err = $('#loginError');
    if (err) {
      err.textContent = '✓ Registro enviado. El administrador revisará y activará tu cuenta.';
      err.style.color = 'var(--ok)';
      setTimeout(() => { err.textContent = ''; err.style.color = ''; }, 8000);
    }
  } catch (err) {
    const data = err.data || {};
    if (data.fields) {
      // Field-level errors
      Object.entries(data.fields).forEach(([field, msg]) => {
        const el = $(`#rg_${field}_msg`);
        if (el) { el.textContent = msg; el.className = 'field-msg err'; }
      });
      $('#rgError').textContent = 'Revisa los campos marcados en rojo.';
    } else if (data.field) {
      const el = $(`#rg_${data.field}_msg`);
      if (el) { el.textContent = data.error || data.message; el.className = 'field-msg err'; }
      const av = $(`#rg_${data.field}_avail`);
      if (av) { av.textContent = '✗'; av.className = 'avail-indicator err'; }
      $('#rgError').textContent = data.error || data.message || 'Error de validación.';
    } else {
      $('#rgError').textContent = data.error || err.message || 'Error al enviar la solicitud.';
    }
  } finally {
    btn.disabled = false; btn.textContent = 'Enviar solicitud de acceso';
  }
}

