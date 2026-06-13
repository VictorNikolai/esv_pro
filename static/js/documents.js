/* ─── Documentos ─────────────────────────────────────────── */
function bindDocs() {
  $('#btnConstancia').addEventListener('click', () => openDoc('constancia'));
  $('#btnQuote').addEventListener('click',      () => openDoc('cotizacion'));
  $('#btnPdfConstancia')?.addEventListener('click', () => downloadPDF('constancia'));
  $('#btnPdfCotizacion')?.addEventListener('click', () => downloadPDF('cotizacion'));
  $('#docClose').addEventListener('click', () => $('#docModal').classList.remove('open'));
  $('#docPrint').addEventListener('click', () => window.print());
  $$('#docTabs button').forEach(b => b.addEventListener('click', () => {
    const tab = b.dataset.tab;
    if (tab === 'cotizacion' && !(ROLES[state.role]||ROLES.usuario).canQuote) {
      toast('Tu rol no puede visualizar cotizaciones'); return;
    }
    renderSheet(tab);
    $$('#docTabs button').forEach(x => x.classList.toggle('active', x === b));
  }));
  $('#docModal').addEventListener('click', e => {
    if (e.target.id === 'docModal') $('#docModal').classList.remove('open');
  });
}

async function openDoc(which) {
  if (state.order.length === 0) { toast('Agrega instrumentos a la orden primero'); return; }
  await saveAllPending();
  // Log to API silently
  if (state.orderId) apiGet(`/api/orders/${state.orderId}/document/${which}`).catch(() => {});
  $('#docModal').classList.add('open');
  $$('#docTabs button').forEach(x => x.classList.toggle('active', x.dataset.tab === which));
  const canQuote = (ROLES[state.role]||ROLES.usuario).canQuote;
  const cotBtn = $('#docTabs button[data-tab="cotizacion"]');
  if (cotBtn) cotBtn.style.display = canQuote ? '' : 'none';
  renderSheet(which);
}

/* ─── Documento ESV — Cotización y Constancia de Ingreso ──────
   Genera HTML que replica el formato real del laboratorio ESV.
   Soporta renderizado en modal y descarga como HTML autónomo.
   ──────────────────────────────────────────────────────────── */

/* ── Estilos del documento (usados tanto en modal como en descarga) ── */
function getDocCSS(forPrint = false) {
  return `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: ${forPrint ? '#fff' : 'transparent'}; }

/* ── Página del documento ─────────────────────────────────── */
.doc-page {
  font-family: 'Calibri', Arial, sans-serif;
  font-size: 9.5pt;
  color: #111;
  background: #fff;
  padding: ${forPrint ? '10mm 12mm' : '20px 24px'};
  max-width: ${forPrint ? '190mm' : '100%'};
  margin: 0 auto;
  line-height: 1.35;
}

/* ── Cabecera ─────────────────────────────────────────────── */
.doc-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 0;
}
.doc-top-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.doc-logo-addr {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 5px;
  width: 100%;
  justify-content: center;
}
.doc-logo {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  flex: none;
  border: 1px solid #ddd;
}
.doc-addr-block {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.doc-addr {
  color: #cc0000;
  font-weight: 700;
  font-size: 11pt;
  text-align: center;
  margin-bottom: 4px;
}
.doc-tagline {
  border: 1.5px solid #cc0000;
  padding: 4px 12px;
  text-align: center;
  font-style: italic;
  font-weight: 600;
  font-size: 9pt;
  color: #333;
  width: 100%;
}

/* ── Badge RUC ────────────────────────────────────────────── */
.doc-ruc-box {
  min-width: 130px;
  border: 1.5px solid #1a3060;
  font-size: 8.5pt;
  text-align: center;
  flex: none;
}
.doc-ruc-line {
  padding: 4px 8px;
  font-weight: 700;
  color: #1a3060;
  font-size: 9pt;
  border-bottom: 1px solid #1a3060;
  background: #fff;
}
.doc-ruc-badge {
  background: #2a6e47;
  color: #fff;
  padding: 3px 8px;
}
.doc-ruc-type { font-size: 9pt; font-weight: 600; }
.doc-ruc-num  { font-size: 12pt; font-weight: 800; letter-spacing: .05em; }

/* ── Datos del cliente ────────────────────────────────────── */
.doc-client-section {
  border: 1px solid #bbb;
  padding: 6px 10px;
  margin: 8px 0 4px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 20px;
}
.doc-df {
  display: grid;
  grid-template-columns: 100px 8px 1fr;
  gap: 0 2px;
  font-size: 9pt;
  padding: 1.5px 0;
  align-items: baseline;
}
.doc-df .lbl { font-weight: 700; color: #111; }
.doc-df .val { color: #222; }
.doc-sep { font-weight: 400; color: #555; }

.doc-blank { height: 5px; }

.doc-estimado {
  font-size: 9pt;
  margin: 5px 0 1px;
}
.doc-estimado b { font-weight: 600; margin-left: 8px; }
.doc-intro {
  font-size: 8.5pt;
  color: #555;
  font-style: italic;
  margin-bottom: 8px;
}

/* ── Tabla de ítems ───────────────────────────────────────── */
.doc-items {
  width: 100%;
  border-collapse: collapse;
  font-size: 8.5pt;
  margin-bottom: 8px;
}
.doc-items thead tr {
  background: #1a3060;
  color: #fff;
}
.doc-items th {
  padding: 5px 4px;
  text-align: center;
  font-size: 7.5pt;
  font-weight: 700;
  border: 1px solid #1a3060;
  line-height: 1.3;
  vertical-align: middle;
}
.doc-items td {
  padding: 4px 4px;
  border: 1px solid #ccc;
  vertical-align: top;
  font-size: 8.5pt;
  color: #111;
}
.doc-items tbody tr:nth-child(odd)  td { background: #fff; }
.doc-items tbody tr:nth-child(even) td { background: #edf1f8; }

/* Column widths */
.col-n    { width: 24px;  text-align: center; font-weight: 700; }
.col-desc { width: 17%; }
.col-proc { width: 23%; }
.col-pts  { width: 8%;   text-align: center; }
.col-lug  { width: 8%;   text-align: center; }
.col-tipo { width: 8%;   text-align: center; }
.col-dsc  { width: 7%;   text-align: right; }
.col-val  { width: 8%;   text-align: right; }
.col-cant { width: 5%;   text-align: center; }
.col-imp  { width: 9%;   text-align: right; font-weight: 700; }

/* Description cell formatting */
.i-name   { display: block; font-weight: 700; font-size: 8.5pt; margin-bottom: 2px; }
.i-meta   { display: block; font-size: 7.5pt; color: #444; line-height: 1.5; }
.i-obs    { display: block; font-size: 7pt;   color: #777; font-style: italic; }
.proc-code { font-weight: 700; color: #1a3060; }

/* ── Pie de página ────────────────────────────────────────── */
.doc-footer {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 8.5pt;
  margin-top: 4px;
}
.doc-footer-notes {
  flex: 1;
  line-height: 1.6;
}
.doc-footer-notes p { margin-bottom: 3px; }
.doc-footer-notes .italic { font-style: italic; color: #555; font-size: 8pt; }

.doc-totales {
  min-width: 220px;
  border: 1px solid #bbb;
  font-size: 9pt;
}
.doc-tot-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 8px;
  border-bottom: 1px solid #e0e0e0;
  gap: 8px;
}
.doc-tot-row:last-child { border-bottom: none; }
.doc-tot-lbl { color: #333; font-weight: 500; }
.doc-tot-val { font-weight: 600; text-align: right; }
.doc-tot-grand {
  background: #1a3060 !important;
}
.doc-tot-grand .doc-tot-lbl,
.doc-tot-grand .doc-tot-val { color: #fff; font-weight: 700; font-size: 10pt; }

/* ── Monto en letras ──────────────────────────────────────── */
.doc-monto {
  font-size: 8pt;
  font-style: italic;
  text-align: center;
  margin-top: 6px;
  border-top: 1px solid #ccc;
  padding-top: 4px;
  color: #444;
}
.doc-monto b { font-weight: 700; color: #111; }

/* ── Firmas (constancia) ──────────────────────────────────── */
.doc-firmas {
  display: flex;
  gap: 40px;
  margin-top: 30px;
}
.doc-firma {
  flex: 1;
  text-align: center;
  font-size: 8.5pt;
  color: #555;
}
.doc-firma-line {
  height: 1px;
  background: #888;
  margin-bottom: 4px;
}

/* ── Print ────────────────────────────────────────────────── */
@media print {
  body { background: #fff; }
  .doc-page { padding: 0; }
  @page { size: A4; margin: 10mm 12mm; }
}
`;
}

/* ── Construye el contenido HTML del documento ─────────────── */
function buildDocHTML(which, opts = {}) {
  const logoSrc   = opts.logoSrc || '/static/logo.jpg';
  const c         = state.client;
  const { total } = orderTotals();
  const igv       = total * 0.18;
  const totalFinal = total + igv;

  /* Número de documento */
  const baseNo = state.orderNo || ('ESV-OT-' + new Date().getFullYear() + '-XXXX');
  const docNo  = which === 'cotizacion'
    ? baseNo.replace('-OT-', '-COT-')
    : baseNo.replace('-OT-', '-CI-');
  const docLabel = which === 'cotizacion' ? 'Cotización' : 'Constancia de Ingreso';
  const fecha    = fmtFecha(state.fecha);
  const seePrices = which === 'cotizacion' && (ROLES[state.role]||ROLES.usuario).seePrices;

  /* Helper: fila de datos del cliente */
  const df = (lbl, val) => `
    <div class="doc-df">
      <span class="lbl">${lbl}</span>
      <span class="doc-sep">:</span>
      <span class="val">${esc(val||'')}</span>
    </div>`;

  /* ── Cabecera ─────────────────────────────────────────── */
  const header = `
<div class="doc-top">
  <div class="doc-top-left">
    <div class="doc-logo-addr">
      <img src="${logoSrc}" class="doc-logo" alt="ESV">
      <div class="doc-addr-block">
        <div class="doc-addr">Calle Las Codornices 223A &ndash; Surquillo &ndash; Lima &ndash; Per&uacute;</div>
      </div>
    </div>
    <div class="doc-tagline">
      Mantenimiento &ndash; Fabricaci&oacute;n &ndash; Verificaci&oacute;n &ndash; Calibraci&oacute;n &ndash; Venta de equipos e instrumentos de medici&oacute;n
    </div>
  </div>
  <div class="doc-ruc-box">
    <div class="doc-ruc-line">RUC : 20554508112</div>
    <div class="doc-ruc-badge">
      <div class="doc-ruc-type">${docLabel}</div>
      <div class="doc-ruc-num"># ${esc(docNo)}</div>
    </div>
  </div>
</div>`;

  /* ── Datos del cliente ────────────────────────────────── */
  const clientBlock = `
<div class="doc-client-section">
  <div>
    ${df('Cliente',       c.empresa  || '—')}
    ${df('RUC',           c.ruc      || '—')}
    ${df('Direcci\u00f3n', c.direccion|| '—')}
    ${df('Contacto',      c.contacto || '—')}
    ${df('Tel\u00e9fono', c.telefono || '—')}
    ${df('Correo',        c.email    || '—')}
    ${df('Observaciones', '')}
  </div>
  <div>
    ${df('Asesor Comercial', 'Ing. Januusz Ruiz Del Aguila')}
    ${df('Condici\u00f3n Pago', '100 % Adelantado')}
    <div class="doc-blank"></div>
    ${df('Validez Oferta', '15 d\u00edas')}
    ${df('Moneda', 'Soles')}
    ${df('Fecha Emisi\u00f3n', fecha)}
    ${df('Alcance Acreditado', 'INACAL')}
  </div>
</div>
<div class="doc-estimado">
  <span>Estimado(a):</span><b>${esc(c.contacto||'—')}</b>
</div>
<div class="doc-intro">
  Agradecemos su requerimiento y procedemos a ${which === 'cotizacion' ? 'cotizar' : 'confirmar el ingreso de'}, sujeto a confirmaci&oacute;n final, lo siguiente:
</div>`;

  /* ── Filas de instrumentos ────────────────────────────── */
  const rows = state.order.map((it, i) => {
    const m   = methodById(it.mid);
    if (!m) return '';
    const pts = it.points.size;
    const sub = m.tariff * pts;
    const dsc = parseFloat(it.descuento || 0);
    const imp = sub - dsc;

    /* Descripción en formato ESV */
    const alcance = it.alcance ? ' ' + it.alcance : '';
    const descName = ('CALIBRACI\u00d3N DE ' + m.name + alcance).toUpperCase();
    const marcaLine = 'MARCA: '  + (it.marca || 'NO INDICA');
    const serieLine = 'SERIE: '  + (it.serie || 'NO INDICA');
    const codeLine  = 'C\u00d3DIGO: ' + (it.identificacion || 'NO INDICA');
    const modelLine = it.modelo ? 'MODELO: ' + it.modelo : '';

    const descHTML = `<span class="i-name">${descName}</span>
      <span class="i-meta">${marcaLine}<br>${serieLine}<br>${codeLine}${modelLine ? '<br>' + modelLine : ''}</span>
      ${it.indicaciones ? `<span class="i-obs">${esc(it.indicaciones)}</span>` : ''}`;

    /* Puntos de calibración */
    let ptsText;
    if (pts === 0)                       ptsText = '—';
    else if (m.is_nominal && pts === 1)  ptsText = 'Valor Nominal';
    else                                 ptsText = String(pts).padStart(2,'0') + ' punto' + (pts!==1?'s':'');

    /* Procedimiento */
    const procCode = m.procedure_code || '';
    const procDesc = m.procedure_description || m.procedure_code || '—';
    const procHTML = procCode
      ? `<span class="proc-code">${esc(procCode)}</span> ${esc(procDesc.replace(procCode,'').trim())}`
      : esc(procDesc);

    const lugar = it.lugar_atencion || 'LABORATORIO';
    const tipo  = it.tipo_servicio  || 'ACREDITADO';

    if (which === 'constancia') {
      const ptsList = [...it.points].join(' &middot; ') || '—';
      return `<tr>
        <td class="col-n">${i+1}</td>
        <td class="col-desc">${descHTML}</td>
        <td class="col-proc">${procHTML}</td>
        <td class="col-pts">${ptsList}</td>
        <td class="col-lug">${esc(lugar)}</td>
        <td class="col-tipo">${esc(tipo)}</td>
      </tr>`;
    }

    return `<tr>
      <td class="col-n">${i+1}</td>
      <td class="col-desc">${descHTML}</td>
      <td class="col-proc">${procHTML}</td>
      <td class="col-pts">${ptsText}</td>
      <td class="col-lug">${esc(lugar)}</td>
      <td class="col-tipo">${esc(tipo)}</td>
      ${seePrices ? `
        <td class="col-dsc">S/ ${dsc.toFixed(2)}</td>
        <td class="col-val">S/. ${sub.toLocaleString('es-PE',{minimumFractionDigits:2})}</td>
        <td class="col-cant">1</td>
        <td class="col-imp">S/. ${imp.toLocaleString('es-PE',{minimumFractionDigits:2})}</td>
      ` : `<td colspan="4" class="col-dsc"></td>`}
    </tr>`;
  }).join('');

  /* ── Cabecera de tabla ────────────────────────────────── */
  let thead;
  if (which === 'constancia') {
    thead = `<thead><tr>
      <th class="col-n">&Iacute;tem</th>
      <th class="col-desc">Descripci&oacute;n</th>
      <th class="col-proc">Procedimiento</th>
      <th class="col-pts">Puntos de Calibraci&oacute;n / Prueba</th>
      <th class="col-lug">Lugar de atenci&oacute;n</th>
      <th class="col-tipo">Tipo de servicio</th>
    </tr></thead>`;
  } else {
    thead = `<thead><tr>
      <th class="col-n">&Iacute;tem</th>
      <th class="col-desc">Descripci&oacute;n</th>
      <th class="col-proc">Procedimiento</th>
      <th class="col-pts">Puntos de<br>Calibraci&oacute;n/<br>Prueba</th>
      <th class="col-lug">Lugar de<br>atenci&oacute;n</th>
      <th class="col-tipo">Tipo de<br>servicio</th>
      ${seePrices ? `
        <th class="col-dsc">Descuen-<br>to S/.</th>
        <th class="col-val">Valor<br>Unitario<br>S/.</th>
        <th class="col-cant">Cant.</th>
        <th class="col-imp">Importe<br>Total S/.</th>
      ` : ''}
    </tr></thead>`;
  }

  const itemsTable = `
<table class="doc-items">
  ${thead}
  <tbody>
    ${rows || '<tr><td colspan="10" style="text-align:center;padding:16px;color:#aaa">Sin instrumentos</td></tr>'}
  </tbody>
</table>`;

  /* ── Pie ──────────────────────────────────────────────── */
  const nota    = c.notas    || 'Ninguno';
  const detalle = 'El servicio de calibraci\u00f3n se realizar\u00e1 utilizando procedimientos de Nacionales - INACAL, internacionales CEM-ESPA\u00d1A y procedimientos de calibraci\u00f3n propios de EX SCIENTIA VERITAS.';

  let footer = '';
  if (which === 'cotizacion' && seePrices) {
    const fmtS = n => 'S/. ' + n.toLocaleString('es-PE',{minimumFractionDigits:2});
    footer = `
<div class="doc-footer">
  <div class="doc-footer-notes">
    <p><b>Nota:</b> ${esc(nota)}</p>
    <p><b>Detalles del servicio:</b></p>
    <p class="italic">${detalle}</p>
  </div>
  <div class="doc-totales">
    <div class="doc-tot-row">
      <span class="doc-tot-lbl">Descuento</span>
      <span class="doc-tot-val" id="docTotDsc">S/. —</span>
    </div>
    <div class="doc-tot-row">
      <span class="doc-tot-lbl">Sub total:</span>
      <span class="doc-tot-val">${fmtS(total)}</span>
    </div>
    <div class="doc-tot-row">
      <span class="doc-tot-lbl">IGV (18%):</span>
      <span class="doc-tot-val">${fmtS(igv)}</span>
    </div>
    <div class="doc-tot-row doc-tot-grand">
      <span class="doc-tot-lbl">Total:</span>
      <span class="doc-tot-val">${fmtS(totalFinal)}</span>
    </div>
  </div>
</div>
<div class="doc-monto">
  Son: <b>${montoEnLetras(totalFinal)}</b>
</div>`;
  } else if (which === 'constancia') {
    footer = `
<div class="doc-footer" style="margin-top:6px">
  <div class="doc-footer-notes">
    <p><b>Nota:</b> ${esc(nota)}</p>
    <p class="italic" style="margin-top:4px">${detalle}</p>
  </div>
</div>
<div class="doc-firmas">
  <div class="doc-firma">
    <div class="doc-firma-line"></div>
    <span>Recibido por &mdash; ${esc(c.contacto||'Cliente')}</span>
  </div>
  <div class="doc-firma">
    <div class="doc-firma-line"></div>
    <span>Responsable de Laboratorio &mdash; EX SCIENTIA VERITAS</span>
  </div>
</div>`;
  }

  return header + clientBlock + itemsTable + footer;
}

/* ── Renderizar en el modal ─────────────────────────────────── */
function renderSheet(which) {
  const css  = `<style>${getDocCSS(false)}</style>`;
  const body = buildDocHTML(which, { logoSrc: '/static/logo.jpg' });
  $('#sheet').innerHTML = `${css}<div class="doc-page">${body}</div>`;
}

/* ── Número a letras (soles peruanos) ───────────────────────── */
function montoEnLetras(n) {
  const entero = Math.floor(n);
  const cents  = Math.round((n - entero) * 100);
  return `${entero.toLocaleString('es-PE')} con ${String(cents).padStart(2,'0')}/100 SOLES INCLUIDO EL IGV`;
}

/* ── Descargar como HTML autónomo ───────────────────────────── */
async function downloadDocument(which) {
  if (!state.orderId) {
    toast('Guarda la orden primero (debe estar creada en el sistema)', 'warn');
    return;
  }
  const label = which === 'cotizacion' ? 'Cotización' : 'Constancia';
  toast(`Descargando ${label} PDF...`);
  window.open(`/api/orders/${state.orderId}/pdf/${which}`, '_blank');

  toast(`${docLabel} "${orderNo}" descargada`);
}



/* ─── Descarga PDF desde el servidor (WeasyPrint) ───────────── */
async function downloadPDF(which) {
  if (!state.orderId) {
    toast('Guarda la orden primero (debe estar creada en el sistema)', 'warn');
    return;
  }
  const label = which === 'cotizacion' ? 'Cotización' : 'Constancia';
  toast(`Generando ${label} PDF...`);
  try {
    window.requestAsyncPDF(state.orderId, which);
  } catch (err) {
    toast('Error: ' + err.message, 'warn');
  }
}


/* ─── Historial de órdenes ───────────────────────────────── */
function bindOrdersModal() {
  $('#btnMyOrders').addEventListener('click', openOrdersModal);
  $('#ordersModalClose').addEventListener('click', () => $('#ordersModal').classList.remove('open'));
  $('#ordersModal').addEventListener('click', e => {
    if (e.target.id === 'ordersModal') $('#ordersModal').classList.remove('open');
  });
  $('#ordersModalList').addEventListener('click', async e => {
    const btn = e.target.closest('[data-load-order]');
    if (btn) {
      await loadOrderFromApi(+btn.dataset.loadOrder);
      $('#ordersModal').classList.remove('open');
    }
  });
}

async function openOrdersModal() {
  $('#ordersModal').classList.add('open');
  const list = $('#ordersModalList');
  list.innerHTML = `<div class="om-loading">${I.spin} Cargando órdenes…</div>`;
  try {
    const res = await apiGet('/api/orders');
    const orders = Array.isArray(res) ? res : (res.data || []);
    if (!orders.length) {
      list.innerHTML = `<div class="om-empty">Sin órdenes registradas en el sistema.</div>`;
      return;
    }
    const seePrices = (ROLES[state.role]||ROLES.usuario).seePrices;
    const statusLbl = { borrador:'Borrador', ingresado:'Ingresado', cotizado:'Cotizado',
      aprobado:'Aprobado', en_proceso:'En proceso', finalizado:'Finalizado' };
    list.innerHTML = orders.map(o => `
      <div class="om-row">
        <div class="om-info">
          <div class="om-top">
            <span class="om-no">${esc(o.order_no)}</span>
            <span class="status-badge ${o.status}">${statusLbl[o.status]||o.status}</span>
          </div>
          <div class="om-empresa">${esc(o.empresa||'Cliente sin especificar')}</div>
          <div class="om-meta">
            ${o.n_items} ítem(s) · ${fmtFecha(o.created_at)}
            ${seePrices && o.total_estimated > 0 ? ' · ' + soles(o.total_estimated) : ''}
            ${o.creator ? ' · ' + esc(o.creator) : ''}
          </div>
        </div>
        <button class="btn ghost sm" data-load-order="${o.id}">Abrir</button>
      </div>`).join('');
  } catch (err) {
    list.innerHTML = `<div class="om-error">Error cargando órdenes: ${esc(err.message)}</div>`;
  }
}

async function loadOrderFromApi(oid) {
  showLoading(true);
  try {
    const data = await apiGet(`/api/orders/${oid}`);
    cancelAllSaves();
    state.orderId = data.id;
    state.orderNo = data.order_no;
    state.fecha   = new Date(data.created_at);
    state.client  = {
      empresa:  data.empresa  || '',
      ruc:      data.ruc      || '',
      contacto: data.contacto || '',
      email:    data.email    || '',
      telefono: data.telefono || '',
    };
    state.order = (data.instruments || []).map(instr => ({
      uid:           uid(),
      apiId:         instr.id,
      mid:           instr.method_id,
      serie:         instr.serie         || '',
      marca:         instr.marca         || '',
      modelo:        instr.modelo        || '',
      alcance:       instr.alcance       || '',
      division:      instr.division_escala || '',
      exactitud:     instr.exactitud     || '',
      identificacion:instr.identificacion|| '',
      indicaciones:  instr.indicaciones  || '',
      points:        new Set(instr.selected_points || []),
    }));
    populateClientForm();
    $('#ordNoLabel').textContent = data.order_no;
    renderOrder(); updateTotals(); applyRole();
    toast(`Orden ${data.order_no} cargada (${state.order.length} instrumento(s))`);
  } catch (err) {
    toast('Error cargando la orden: ' + err.message, 'warn');
  } finally {
    showLoading(false);
  }
}

/* ─── Loading overlay ────────────────────────────────────── */
function showLoading(on) {
  let ov = $('#loadingOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'loadingOverlay';
    ov.className = 'loading-overlay';
    ov.innerHTML = `<div class="spinner">${I.spin}</div>`;
    document.body.appendChild(ov);
  }
  ov.classList.toggle('active', on);
}

/* ─── Modal CRUD de método ───────────────────────────────── */
let mmState = { editId: null, points: [], icon: 'gauge' };

function bindMethodModal() {
  $('#mm_iconpicker').innerHTML = Object.keys(ICONS).map(k =>
    `<button type="button" class="ic-opt" data-icon="${k}" title="${k}">${methodIcon(k)}</button>`
  ).join('');
  $('#mm_iconpicker').addEventListener('click', e => {
    const b = e.target.closest('[data-icon]');
    if (!b) return;
    mmState.icon = b.dataset.icon;
    $$('#mm_iconpicker .ic-opt').forEach(x => x.classList.toggle('on', x.dataset.icon === mmState.icon));
  });
  const pin = $('#mm_pointinput');
  pin.addEventListener('keydown', e => {
    if (e.key==='Enter'||e.key===',') { e.preventDefault(); addChip(pin.value); pin.value=''; }
    else if (e.key==='Backspace' && !pin.value && mmState.points.length) { mmState.points.pop(); renderChips(); }
  });
  $('#mm_chipwrap').addEventListener('click', e => {
    const x = e.target.closest('[data-rmchip]');
    if (x) { mmState.points.splice(+x.dataset.rmchip, 1); renderChips(); }
    else pin.focus();
  });
  $('#mm_tariff').addEventListener('input', updatePreview);
  $('#mmClose').addEventListener('click', closeMethodModal);
  $('#mmCancel').addEventListener('click', closeMethodModal);
  $('#mmDelete').addEventListener('click', deleteMethod);
  $('#methodForm').addEventListener('submit', saveMethod);
  $('#methodModal').addEventListener('click', e => { if (e.target.id==='methodModal') closeMethodModal(); });
}

function addChip(val) {
  const v = (val||'').trim();
  if (!v) return;
  if (!mmState.points.some(p => p.toLowerCase()===v.toLowerCase())) mmState.points.push(v);
  renderChips();
}
function renderChips() {
  $('#mm_chiplist').innerHTML = mmState.points.map((p, i) =>
    `<span class="chip mono">${esc(p)}<button type="button" data-rmchip="${i}" title="Quitar">×</button></span>`
  ).join('');
  updatePreview();
}
function updatePreview() {
  const t = parseFloat($('#mm_tariff').value)||0;
  $('#mm_preview').textContent = soles(t*mmState.points.length) +
    (mmState.points.length ? ` · ${mmState.points.length} pts` : '');
}

function openMethodModal(id) {
  const r = ROLES[state.role]||ROLES.usuario;
  if (!r.canAdmin) { toast('Solo el administrador puede modificar el catálogo'); return; }
  const editing = !!id;
  mmState = { editId: editing ? +id : null, points: [], icon: 'gauge' };
  if (editing) {
    const m = (typeof _catalogData !== 'undefined' ? _catalogData.find(x => x.id == id) : null) || methodById(id);
    if (!m) { toast('Error: Método no encontrado', true); return; }
    $('#mmTitle').textContent = 'Editar método';
    $('#mm_code').value  = m.procedure_code || m.code || '';
    $('#mm_type').value  = m.is_nominal ? '1' : '0';
    $('#mm_name').value  = m.name;
    $('#mm_area').value  = m.area;
    $('#mm_tariff').value = m.tariff;
    $('#mm_note').value  = m.note||'';
    $('#mm_procedure_desc').value = m.procedure_description || '';
    $('#mm_image').value = '';
    mmState.points = [...m.points];
    mmState.icon   = m.icon;
    mmState.image_base64 = m.image_base64 || '';
    $('#mmDelete').style.display = '';
  } else {
    $('#mmTitle').textContent = 'Nuevo método';
    ['mm_code','mm_name','mm_area','mm_tariff','mm_note', 'mm_procedure_desc'].forEach(id => { $('#'+id).value = ''; });
    $('#mm_image').value = '';
    $('#mm_type').value = '0';
    mmState.image_base64 = '';
    $('#mmDelete').style.display = 'none';
  }
  $$('#mm_iconpicker .ic-opt').forEach(x => x.classList.toggle('on', x.dataset.icon===mmState.icon));
  renderChips();
  $('#methodModal').classList.add('open');
  setTimeout(() => $('#mm_name').focus(), 50);
}
function closeMethodModal() {
  const modal = $('#methodModal');
  modal.classList.remove('open');
  modal.style.zIndex = '';
}

async function saveMethod(e) {
  e.preventDefault();
  const procedure_code = $('#mm_code').value.trim();
  const procedure_description = $('#mm_procedure_desc').value.trim();
  const is_nominal = parseInt($('#mm_type').value) || 0;
  const name   = $('#mm_name').value.trim();
  const area   = $('#mm_area').value.trim()||'General';
  const tariff = parseFloat($('#mm_tariff').value)||0;
  const note   = $('#mm_note').value.trim();
  if (!name)               { toast('Indica el nombre del método'); return; }
  if (!mmState.points.length) { toast('Agrega al menos un punto de calibración'); return; }
  if (tariff <= 0)          { toast('Indica la tarifa por punto'); return; }

  let image_base64 = mmState.image_base64 || '';
  const fileInput = $('#mm_image');
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    image_base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  const payload = {
    procedure_code, procedure_description, is_nominal,
    name, area, magnitude: area, icon: mmState.icon, tariff, note, image_base64,
    points: mmState.points.map(p => ({ label: p, uncertainty: '' }))
  };
  try {
    if (mmState.editId) {
      await apiPut(`/api/catalog/${mmState.editId}`, payload);
      const m = methodById(mmState.editId);
      if (m) Object.assign(m, { procedure_code, procedure_description, is_nominal: !!is_nominal, name, area, magnitude: area, tariff, note, image_base64,
        points: [...mmState.points], icon: mmState.icon });
      toast(`Método "${name}" actualizado`);
    } else {
      const res = await apiPost('/api/catalog', payload);
      CATALOG.push({ id: res.id, code: res.code, procedure_code, procedure_description, is_nominal: !!is_nominal, name, area, magnitude: area,
        icon: mmState.icon, tariff, note, image_base64, points: [...mmState.points] });
      toast(`Método "${name}" agregado al catálogo`);
    }
    renderCatalog(); renderOrder(); updateTotals(); applyRole();
    closeMethodModal();
  } catch (err) {
    toast('Error: ' + (err.data?.error || err.message), 'warn');
  }
}

async function deleteMethod() {
  if (!mmState.editId) return;
  const m = methodById(mmState.editId);
  if (!m || !confirm(`¿Eliminar "${m.name}"? Esta acción no se puede deshacer.`)) return;
  try {
    await apiDel(`/api/catalog/${mmState.editId}`);
    const used = state.order.filter(o => o.mid == mmState.editId).length;
    CATALOG = CATALOG.filter(x => x.id != mmState.editId);
    if (used) state.order = state.order.filter(o => o.mid != mmState.editId);
    renderCatalog(); renderOrder(); updateTotals(); applyRole();
    closeMethodModal();
    toast(`"${m.name}" eliminado${used ? ` y ${used} ítem(s) quitados de la orden` : ''}`);
  } catch (err) {
    toast('Error eliminando: ' + (err.data?.error || err.message), 'warn');
  }
}

/* ─── Toast ──────────────────────────────────────────────── */
let toastTimer;
function toast(msg, type = 'ok') {
  const t = $('#toast');
  t.querySelector('span').textContent = msg;
  t.className = type === 'warn' ? 'warn show' : 'show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ─── Íconos estáticos ───────────────────────────────────── */
function buildIcons() {
  // Helper null-safe: no falla si el elemento no existe
  const si  = (id, html)  => { const el = $('#'+id); if (el) el.innerHTML = html; };
  const ins = (id, html)  => { const el = $('#'+id); if (el) el.insertAdjacentHTML('afterbegin', html); };

  // Íconos en topbar/app (las imágenes del logo se cargan vía <img> en el HTML)
  si ('searchIco',          I.search);
  si ('docPrint',           I.print);
  si ('docClose',           I.close);
  si ('docDownload',        svg('<path d="M12 3v12M8 11l4 4 4-4M3 17v3h18v-3"/>'));
  si ('loginLock',          I.lock);
  si ('toastIco',           I.check);
  si ('mmClose',            I.close);
  si ('ordersModalClose',   I.close);
  si ('requestsModalClose', I.close);
  si ('btnLogout',          I.logout);
  ins('btnConstancia', I.receipt);
  ins('btnQuote',      I.doc);
  ins('btnMyOrders',   I.list);
  ins('btnNewOrder',   I.plus);
}

window.requestAsyncPDF = async function(orderId, docType) {
  try {
    toast(`Enviando solicitud para ${docType}...`);
    const res = await fetch(`/api/orders/${orderId}/pdf/${docType}?async=1`, { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.ok) {
      toast(data.msg);
    } else {
      toast(data.error || 'Error al solicitar el PDF', 'warn');
    }
  } catch (e) {
    toast('Error de conexión al solicitar PDF', 'warn');
  }
};



/* ============================================================
   MÓDULO DE NOTIFICACIONES — campana + polling cada 30s
   ============================================================ */

const NOTIF_ICONS = {
  orden:     '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h4"/>',
  estado:    '<path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17.5v.5"/>',
  documento: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 14h6M10 17h6"/>',
  catalogo:  '<path d="M3 6h18M3 12h18M3 18h18"/>',
  usuario:   '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>',
  sistema:   '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>',
};

let notifPollTimer = null;

function bindNotifications() {
  const wrap = $('#notifWrap');
  if (!wrap) return;

  // Toggle panel
  $('#btnNotif').addEventListener('click', e => {
    e.stopPropagation();
    wrap.classList.toggle('open');
    if (wrap.classList.contains('open')) fetchNotifications();
  });

  // Mark all read
  $('#btnReadAll').addEventListener('click', async () => {
    await apiPost('/api/notifications/read', {}).catch(() => {});
    fetchNotifications();
  });

  // Click on item → mark read
  $('#notifList').addEventListener('click', async e => {
    const item = e.target.closest('.np-item[data-nid]');
    if (item && item.classList.contains('unread')) {
      await apiPut(`/api/notifications/${item.dataset.nid}/read`, {}).catch(() => {});
      item.classList.remove('unread');
      item.querySelector('.np-dot')?.style && (item.querySelector('.np-dot').style.background = '');
      updateBadge();
    }
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) wrap.classList.remove('open');
  });
}

async function fetchNotifications() {
  try {
    const data = await apiGet('/api/notifications');
    renderNotifications(data.notifications || [], data.unread || 0);
  } catch (_) {/* usuario no autenticado aún — silenciar */ }
}

function renderNotifications(notifs, unread) {
  // Badge
  const badge = $('#notifBadge');
  if (badge) {
    badge.textContent = unread > 9 ? '9+' : String(unread);
    badge.style.display = unread > 0 ? '' : 'none';
  }

  // Lista
  const list = $('#notifList');
  if (!list) return;
  if (!notifs.length) {
    list.innerHTML = '<div class="np-empty">Sin notificaciones recientes</div>';
    return;
  }
  list.innerHTML = notifs.map(n => {
    const rel = timeAgo(n.created_at);
    const iconPath = NOTIF_ICONS[n.tipo] || NOTIF_ICONS.sistema;
    const icSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>`;
    const extraClick = n.tipo === 'mensaje'
      ? `onclick="openMsgPanel();document.getElementById('notifPanel')?.classList.remove('open')" style="cursor:pointer"`
      : '';
    return `<div class="np-item ${n.leida ? '' : 'unread'}" data-nid="${n.id}" ${extraClick}>
      <div class="np-dot"></div>
      <div class="np-tipo-icon ${n.tipo}">${icSvg}</div>
      <div class="np-body">
        <div class="np-titulo">${esc(n.titulo)}</div>
        ${n.mensaje ? `<div class="np-msg">${esc(n.mensaje)}</div>` : ''}
        <div class="np-time">${rel}${n.tipo === 'mensaje' ? ' · <b style="color:#185FA5">Abrir chat</b>' : ''}</div>
      </div>
    </div>`;
  }).join('');
}

function updateBadge() {
  const unread = $$('.np-item.unread').length;
  const badge  = $('#notifBadge');
  if (badge) {
    badge.textContent = unread > 9 ? '9+' : String(unread);
    badge.style.display = unread > 0 ? '' : 'none';
  }
}

function timeAgo(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Ahora mismo';
  if (m < 60) return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h} h`;
  return `Hace ${Math.floor(h / 24)} días`;
}

function startNotifPolling() {
  clearInterval(notifPollTimer);
  fetchNotifications();                          // fetch inmediato
  notifPollTimer = setInterval(fetchNotifications, 30000); // luego cada 30 s
}

/* ─── Ícono de campana en topbar ─── */
function buildNotifIcon() {
  const btn = $('#btnNotif');
  if (!btn) return;
  const bellSVG = svg('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>');
  btn.insertAdjacentHTML('afterbegin', bellSVG);
}

/* ─── 6. Override openDoc — con confirmación ──────────────────── */
{
  const _origOpenDoc = openDoc;
  window.openDoc = async function(which) {
    if (state.order.length === 0) { toast('Agrega instrumentos a la orden primero', 'warn'); return; }

    const reqFields = ['empresa', 'ruc', 'contacto', 'email', 'telefono', 'direccion'];
    for (let k of reqFields) {
      if (!state.client[k] || !state.client[k].trim()) {
        toast('Completa todos los datos del cliente (Empresa, RUC, Contacto, Correo, Teléfono, Dirección) para generar el documento.', 'warn');
        return;
      }
    }

    if (state.orderId) {
      try {
        await apiPut(`/api/orders/${state.orderId}`, {
          empresa: state.client.empresa,
          ruc: state.client.ruc,
          contacto: state.client.contacto,
          email: state.client.email,
          telefono: state.client.telefono,
          direccion: state.client.direccion
        });
      } catch(e) {
        console.warn('Error guardando cliente:', e.message);
      }
    }

    const label  = which === 'cotizacion' ? 'Cotización' : 'Constancia de ingreso';
    const empresa = state.client.empresa || 'el cliente';
    const ok = await ESVConfirm.show({
      title:   `Generar ${label}`,
      message: `¿Generar ${label} para ${empresa}?\nEsta acción quedará registrada en el sistema.`,
      type:    'info',
      okText:  `Generar ${label}`,
    });
    if (!ok) return;
    _origOpenDoc(which);
  };
}

/* ─── Descargar e imprimir documento ─────────────────────────── */
function bindDocDownload() {
  const dlBtn = $('#docDownload');
  if (dlBtn) {
    dlBtn.addEventListener('click', () => {
      const activeTab = $('#docTabs .active');
      const which = activeTab?.dataset?.tab || 'cotizacion';
      downloadDocument(which);
    });
  }
}

/* ─── Ícono de descarga ──────────────────────────────────────── */
function buildDownloadIcon() {
  const btn = $('#docDownload');
  if (btn) btn.innerHTML = svg('<path d="M12 3v12M8 11l4 4 4-4M3 17v3h18v-3"/>');
}

document.addEventListener('DOMContentLoaded', () => {
  bindDocDownload();
  buildDownloadIcon();
});

/* ============================================================
   DRAG & DROP — Catálogo → Orden de trabajo
   Arrastra una tarjeta del catálogo y suéltala en la sección
   de instrumentos para agregarla a la orden.
   ============================================================ */

/* ── Ajustes y Plantillas ─────────────────────────────────────── */
async function admLoadSettings() {
  try {
    const res = await apiFetch('/api/settings');
    $('#set_company_name').value = res.company_name || '';
    $('#set_company_ruc').value = res.company_ruc || '';
    $('#set_company_address').value = res.company_address || '';
    $('#set_pdf_footer').value = res.pdf_footer || '';
    if ($('#set_quote_template_html')) {
      const val = res.quote_template_html || '';
      if (typeof tinymce !== 'undefined') {
        if (tinymce.get('set_quote_template_html')) {
          tinymce.get('set_quote_template_html').setContent(val);
        } else {
          $('#set_quote_template_html').value = val;
          tinymce.init({
            selector: '#set_quote_template_html',
            height: 600,
            menubar: false,
            plugins: 'lists link table code',
            toolbar: 'undo redo | blocks | bold italic | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | table code | removeformat',
            content_style: pdfStyles,
            branding: false,
            promotion: false
          });
        }
      } else {
        $('#set_quote_template_html').value = val;
      }
    }
  } catch (e) {
    console.error('Error cargando ajustes:', e);
  }
}

const pdfStyles = `
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10px; padding: 15px; margin: 0; color: #333; background: #fff; }
  h2 { font-size: 14px; margin-top: 0; margin-bottom: 10px; color: #800000; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h4 { font-size: 11px; margin: 0 0 6px 0; color: #1a3060; }
  .cond-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .cond-card { background: #f9fafc; border: 1px solid #e1e4e8; border-radius: 6px; padding: 10px; }
  .cond-card.full { grid-column: 1 / -1; }
  .cond-card p, .cond-card ul { margin: 0; padding: 0 0 0 16px; color: #444; line-height: 1.4; }
  .cond-mini-table { width: 100%; border-collapse: collapse; font-size: 9px; }
  .cond-mini-table td { padding: 3px 0; border-bottom: 1px solid #eee; color: #444; }
  .cond-mini-table tr:last-child td { border-bottom: none; }
  .cond-mini-table td:first-child { font-weight: bold; width: 45%; color: #222; }
  .bank-section { background: #fff; border: 1px solid #e1e4e8; border-radius: 6px; padding: 12px; margin-bottom: 10px; border-left: 4px solid #800000; }
  .bank-table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9.5px; }
  .bank-table th, .bank-table td { padding: 6px; text-align: left; border-bottom: 1px solid #eee; }
  .bank-table th { background: #f4f6f8; font-weight: bold; color: #333; text-transform: uppercase; font-size: 8.5px; }
  .bank-table tbody tr:last-child td { border-bottom: none; }
`;

$('#settingsForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#btnSaveSettings');
  const ogText = btn.textContent;
  btn.textContent = 'Guardando...';
  btn.disabled = true;
  
  const payload = {
    company_name: $('#set_company_name').value,
    company_ruc: $('#set_company_ruc').value,
    company_address: $('#set_company_address').value,
    pdf_footer: $('#set_pdf_footer').value,
    quote_template_html: typeof tinymce !== 'undefined' && tinymce.get('set_quote_template_html')
                         ? tinymce.get('set_quote_template_html').getContent()
                         : $('#set_quote_template_html').value
  };
  
  try {
    const res = await apiFetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.ok) toast('Ajustes guardados correctamente');
    else toast('Error al guardar ajustes', 'err');
  } catch (err) {
    toast('Error de red', 'err');
  }
  
  btn.textContent = ogText;
  btn.disabled = false;
});

