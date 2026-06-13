/* ─── 2. Override addInstrument — abre modal de configuración ─ */
// El catálogo llama a addInstrument(mid). Ahora abre el modal
// de selección de puntos antes de agregar a la orden.
{
  // Guardamos la función original para reutilizar su lógica
  const _addCore = async (mid, prePoints) => {
    const m = methodById(mid);
    if (!m) return;
    const item = {
      uid: uid(), mid: m.id, apiId: null,
      serie:'', marca:'', modelo:'', alcance:'', division:'', exactitud:'',
      identificacion:'', indicaciones:'',
      points: new Set(prePoints || []),
    };
    state.order.push(item);
    renderOrder(); applyRole(); updateTotals();
    requestAnimationFrame(() =>
      $('#orderScroll').scrollTo({ top: $('#orderScroll').scrollHeight, behavior: 'smooth' })
    );
    const ptsTxt = prePoints?.length ? ` (${prePoints.length} pt${prePoints.length !== 1 ? 's' : ''})` : '';
    toast(`${m.name} agregado a la orden${ptsTxt}`);
    try {
      const oid = await ensureOrder();
      const res = await apiPost(`/api/orders/${oid}/instruments`, {
        method_id: m.id, points: prePoints || [], ...itemFlat(item)
      });
      item.apiId = res.id;
    } catch (err) { toast('Error guardando instrumento: ' + err.message, 'warn'); }
  };

  // Nueva definición (sobreescribe la del bloque anterior)
  window.addInstrument = function(mid, prePoints = null) {
    if (prePoints !== null) {
      _addCore(mid, prePoints);   // llamado desde el modal con puntos ya elegidos
    } else {
      openAddInstrModal(mid);     // abre modal de configuración
    }
  };
}

/* ─── 3. Modal de agregar instrumento ────────────────────────── */
let _aiMid = null;

function openAddInstrModal(mid) {
  const m = methodById(mid);
  if (!m) return;
  _aiMid = mid;

  const seePrices = (ROLES[state.role] || ROLES.usuario).seePrices;
  $('#aiArea').textContent  = m.area || '';
  $('#aiName').textContent  = m.name;
  $('#aiIco').innerHTML     = methodIcon(m.icon);

  if (seePrices) {
    $('#aiTariff').textContent    = `${soles(m.tariff)} por punto de calibración`;
    $('#aiTariff').style.display  = '';
    $('#aiCostWrap').style.display = '';
  } else {
    $('#aiTariff').style.display  = 'none';
    $('#aiCostWrap').style.display = 'none';
  }

  // Renderizar puntos
  $('#aiPoints').innerHTML = (m.points || []).map(p => `
    <label class="ai-pt-item">
      <input type="checkbox" value="${esc(p)}" data-ai-pt>
      ${esc(p)}
    </label>
  `).join('');

  _updateAiFooter();
  $('#addInstrModal').classList.add('open');
}

function _updateAiFooter() {
  const checked = $$('[data-ai-pt]:checked');
  const n       = checked.length;
  const m       = methodById(_aiMid);
  const seePrices = (ROLES[state.role] || ROLES.usuario).seePrices;

  $('#aiPtsLabel').textContent = n > 0 ? `— ${n} punto${n !== 1 ? 's' : ''}` : '';
  $('#aiConfirm').disabled     = false;  // allow 0 points (can add later)

  if (seePrices && m) {
    $('#aiCostValue').textContent = soles(m.tariff * n);
  }
}

function bindAddInstrModal() {
  $('#aiSelectAll').addEventListener('click', () => {
    $$('[data-ai-pt]').forEach(cb => cb.checked = true);
    _updateAiFooter();
  });
  $('#aiClearAll').addEventListener('click', () => {
    $$('[data-ai-pt]').forEach(cb => cb.checked = false);
    _updateAiFooter();
  });
  $('#aiPoints').addEventListener('change', e => {
    if (e.target.matches('[data-ai-pt]')) _updateAiFooter();
  });
  const closeAi = () => $('#addInstrModal').classList.remove('open');
  $('#aiClose').addEventListener('click',  closeAi);
  $('#aiCancel').addEventListener('click', closeAi);
  $('#addInstrModal').addEventListener('click', e => { if (e.target.id === 'addInstrModal') closeAi(); });

  $('#aiConfirm').addEventListener('click', () => {
    const selected = $$('[data-ai-pt]:checked').map(cb => cb.value);
    closeAi();
    addInstrument(_aiMid, selected);
  });
}

/* ─── 4. Override removeInstrument — con confirmación ─────────── */
{
  const _origRemove = removeInstrument;
  window.removeInstrument = async function(u) {
    const it = state.order.find(o => o.uid === u);
    const m  = methodById(it?.mid);
    const ok = await ESVConfirm.show({
      title:   'Quitar instrumento',
      message: `¿Quitar "${m?.name || 'instrumento'}" de la orden?\nSe perderán los datos de la ficha técnica.`,
      type:    'warning',
      okText:  'Sí, quitar',
    });
    if (!ok) return;
    _origRemove(u);
  };
}

/* ─── 5. Override clearOrder — con confirmación ──────────────── */
{
  const _origClear = clearOrder;
  window.clearOrder = async function() {
    if (state.order.length === 0) { _origClear(); return; }
    const ok = await ESVConfirm.show({
      title:   'Nueva orden de trabajo',
      message: 'La orden actual quedará guardada en el historial. ¿Iniciar una nueva orden?',
      type:    'warning',
      okText:  'Sí, nueva orden',
    });
    if (!ok) return;
    _origClear();
  };
}

/* ─── Estado del drag ────────────────────────────────────────── */
let _dragMid     = null;   // method_id que se está arrastrando
let _dragCard    = null;   // elemento DOM de la tarjeta

/* ─── Notificación flotante de drop zone ─────────────────────── */
function _getDropBanner() {
  let el = $('#dropBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dropBanner';
    el.className = 'drop-banner';
    el.innerHTML = `
      <div class="db-inner">
        <div class="db-ico">${svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>')}</div>
        <div class="db-text">
          <b>Suelta aquí para agregar</b>
          <span id="dropBannerName">el instrumento a la orden</span>
        </div>
      </div>`;
    document.body.appendChild(el);
  }
  return el;
}

function _showDropBanner(mid, visible) {
  const banner = _getDropBanner();
  if (visible) {
    const m = methodById(mid);
    const nameEl = banner.querySelector('#dropBannerName');
    if (nameEl && m) nameEl.textContent = m.name;
    banner.classList.add('visible');
  } else {
    banner.classList.remove('visible');
  }
}

/* ─── Bind: drag desde el catálogo ───────────────────────────── */
function bindDragDrop() {
  const catalog = $('#catalogList');
  const orderCol = $('.col.order');

  /* Inicio del arrastre */
  catalog.addEventListener('dragstart', e => {
    const card = e.target.closest('[data-id]');
    if (!card) return;
    _dragMid  = card.dataset.id;
    _dragCard = card;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', _dragMid);

    // Estilo de arrastre
    setTimeout(() => card.classList.add('dragging'), 0);

    // Mostrar banner flotante
    _showDropBanner(_dragMid, true);

    // Highlight zona de destino
    $('#instruments')?.classList.add('drop-target-idle');
    orderCol?.classList.add('drag-active');
  });

  /* Fin del arrastre */
  catalog.addEventListener('dragend', () => {
    _dragCard?.classList.remove('dragging');
    _showDropBanner(null, false);
    $('#instruments')?.classList.remove('drop-target-idle','drop-target-hover');
    orderCol?.classList.remove('drag-active');
    _dragMid = null; _dragCard = null;
  });

  /* ─ Zona de destino: columna de la orden ─ */
  if (orderCol) {
    orderCol.addEventListener('dragover', e => {
      if (!_dragMid) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      $('#instruments')?.classList.add('drop-target-hover');
      $('#instruments')?.classList.remove('drop-target-idle');
    });

    orderCol.addEventListener('dragleave', e => {
      if (!orderCol.contains(e.relatedTarget)) {
        $('#instruments')?.classList.remove('drop-target-hover');
        $('#instruments')?.classList.add('drop-target-idle');
      }
    });

    orderCol.addEventListener('drop', e => {
      e.preventDefault();
      const mid = e.dataTransfer.getData('text/plain') || _dragMid;
      if (!mid) return;
      _showDropBanner(null, false);
      $('#instruments')?.classList.remove('drop-target-idle','drop-target-hover');
      orderCol?.classList.remove('drag-active');

      // Pequeño delay para efecto visual antes de abrir modal
      setTimeout(() => {
        addInstrument(mid);    // abre el modal de configuración de puntos
      }, 80);

      // Toast informativo
      const m = methodById(mid);
      if (m) toast(`${m.name} — selecciona los puntos de calibración`);
    });
  }

  /* También aceptar drop directamente en #instruments */
  const instDiv = $('#instruments');
  if (instDiv) {
    instDiv.addEventListener('dragover', e => {
      if (!_dragMid) return;
      e.preventDefault();
      e.stopPropagation();
      instDiv.classList.add('drop-target-hover');
    });
    instDiv.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      const mid = e.dataTransfer.getData('text/plain') || _dragMid;
      if (!mid) return;
      instDiv.classList.remove('drop-target-hover','drop-target-idle');
      orderCol?.classList.remove('drag-active');
      _showDropBanner(null, false);
      setTimeout(() => addInstrument(mid), 80);
    });
  }
}

