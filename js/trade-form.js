/* ============================================================
   Trade Journal — Trade Entry Form
   Full trade logging with psychology tracking
   ============================================================ */

const TradeForm = (() => {

  let editingId = null;

  async function render(container, tradeId = null) {
    editingId = tradeId;
    const settings = await Store.getSettings();
    const trade = tradeId ? await Store.getTradeById(tradeId) : null;
    const isEdit = !!trade;

    const t = trade || {
      date: Utils.todayISO(),
      session: '',
      instrument: '',
      direction: 'Long',
      timeframe: '',
      setupName: '',
      entryPrice: '',
      stopPrice: '',
      targetPrice: '',
      exitPrice: '',
      quantity: '',
      riskMoney: '',
      plannedRR: '',
      resultMoney: '',
      resultR: '',
      fees: settings.defaultFee || '',
      screenshotBefore: '',
      screenshotAfter: '',
      ruleFollowed: true,
      emotionBefore: '',
      emotionDuring: '',
      emotionAfter: '',
      mistakeTags: [],
      reviewNote: '',
    };

    // Restore draft if creating a new trade
    if (!isEdit) {
      try {
        const draft = JSON.parse(sessionStorage.getItem('tj_trade_draft'));
        if (draft) {
          Object.assign(t, draft);
        }
      } catch (e) {}
    }

    // Override with query params if coming from Calculator
    const hash = window.location.hash;
    if (hash.includes('?')) {
      const qs = hash.split('?')[1];
      const params = new URLSearchParams(qs);
      if (params.has('entry')) t.entryPrice = params.get('entry');
      if (params.has('stop')) t.stopPrice = params.get('stop');
      if (params.has('target')) t.targetPrice = params.get('target');
      if (params.has('risk')) t.riskMoney = params.get('risk');
      if (params.has('qty')) t.quantity = params.get('qty');
      
      // Auto-set direction based on Entry/Stop relationship
      if (parseFloat(t.entryPrice) > 0 && parseFloat(t.stopPrice) > 0) {
        t.direction = parseFloat(t.entryPrice) > parseFloat(t.stopPrice) ? 'Long' : 'Short';
      }
    }

    container.innerHTML = `
      <div class="page-container page-enter">
        <div class="page-header">
          <div class="page-header-left">
            <h1 class="page-title">${isEdit ? 'Edit Trade' : 'Log New Trade'}</h1>
            <p class="page-subtitle">${isEdit ? 'Update trade details' : 'Record your trade with full details'}</p>
          </div>
        </div>

        <form id="trade-form" class="trade-form" autocomplete="off">

          <!-- Trade Details -->
          <div class="trade-form-section">
            <div class="trade-form-section-title">
              <span class="section-icon">📊</span> Trade Details
            </div>

            <div class="form-row form-row-4 mb-4">
              <div class="form-group">
                <label class="form-label">Date</label>
                <input type="date" class="form-input" id="tf-date" value="${t.date.slice(0, 10)}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Session</label>
                <select class="form-select" id="tf-session">
                  <option value="">Select...</option>
                  ${settings.sessions.map(s => `<option value="${s}" ${t.session === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Instrument</label>
                <select class="form-select" id="tf-instrument" required>
                  <option value="">Select...</option>
                  ${settings.instruments.map(i => `<option value="${i}" ${t.instrument === i ? 'selected' : ''}>${i}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Direction</label>
                <div class="toggle-group w-full" id="tf-direction">
                  <button type="button" class="toggle-btn long ${t.direction === 'Long' ? 'active' : ''}" data-dir="Long" style="flex:1">▲ Long</button>
                  <button type="button" class="toggle-btn short ${t.direction === 'Short' ? 'active' : ''}" data-dir="Short" style="flex:1">▼ Short</button>
                </div>
              </div>
            </div>

            <div class="form-row form-row-3 mb-4">
              <div class="form-group">
                <label class="form-label">Timeframe</label>
                <select class="form-select" id="tf-timeframe">
                  <option value="">Select...</option>
                  ${settings.timeframes.map(tf => `<option value="${tf}" ${t.timeframe === tf ? 'selected' : ''}>${tf}</option>`).join('')}
                </select>
              </div>
              <div class="form-group" style="grid-column: span 2">
                <label class="form-label">Setup Name</label>
                <select class="form-select" id="tf-setup">
                  <option value="">Select setup...</option>
                  ${settings.setupNames.map(s => `<option value="${s}" ${t.setupName === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>

          <!-- Price & Risk -->
          <div class="trade-form-section">
            <div class="trade-form-section-title">
              <span class="section-icon">💰</span> Price & Risk
            </div>

            <div class="form-row form-row-4 mb-4">
              <div class="form-group">
                <label class="form-label">Entry Price</label>
                <input type="number" inputmode="decimal" step="any" class="form-input mono" id="tf-entry" value="${t.entryPrice}" placeholder="0.00">
              </div>
              <div class="form-group">
                <label class="form-label">Stop Loss</label>
                <input type="number" inputmode="decimal" step="any" class="form-input mono" id="tf-stop" value="${t.stopPrice}" placeholder="0.00">
              </div>
              <div class="form-group">
                <label class="form-label">Target</label>
                <input type="number" inputmode="decimal" step="any" class="form-input mono" id="tf-target" value="${t.targetPrice}" placeholder="0.00">
              </div>
              <div class="form-group">
                <label class="form-label">Exit Price</label>
                <input type="number" inputmode="decimal" step="any" class="form-input mono" id="tf-exit" value="${t.exitPrice}" placeholder="0.00">
              </div>
            </div>

            <div class="form-row form-row-4 mb-4">
              <div class="form-group">
                <label class="form-label">Quantity / Contracts</label>
                <input type="number" inputmode="decimal" step="any" class="form-input mono" id="tf-qty" value="${t.quantity}" placeholder="1">
              </div>
              <div class="form-group auto-calc">
                <label class="form-label">Risk ($)</label>
                <input type="number" inputmode="decimal" step="any" class="form-input mono" id="tf-risk" value="${t.riskMoney}" placeholder="Auto">
                <span class="auto-calc-badge">AUTO</span>
              </div>
              <div class="form-group auto-calc">
                <label class="form-label">Planned R:R</label>
                <input type="number" inputmode="decimal" step="any" class="form-input mono" id="tf-plannedrr" value="${t.plannedRR}" placeholder="Auto" readonly>
                <span class="auto-calc-badge">AUTO</span>
              </div>
              <div class="form-group">
                <label class="form-label">Fees / Commission</label>
                <input type="number" inputmode="decimal" step="any" class="form-input mono" id="tf-fees" value="${t.fees}" placeholder="0.00">
              </div>
            </div>

            <div class="form-row form-row-2">
              <div class="form-group auto-calc">
                <label class="form-label">Result ($)</label>
                <input type="number" inputmode="decimal" step="any" class="form-input mono" id="tf-result" value="${t.resultMoney}" placeholder="Auto">
                <span class="auto-calc-badge">AUTO</span>
              </div>
              <div class="form-group auto-calc">
                <label class="form-label">Result (R)</label>
                <input type="number" inputmode="decimal" step="any" class="form-input mono" id="tf-resultr" value="${t.resultR}" placeholder="Auto" readonly>
                <span class="auto-calc-badge">AUTO</span>
              </div>
            </div>
          </div>

          <!-- Screenshots -->
          <div class="trade-form-section">
            <div class="trade-form-section-title">
              <span class="section-icon">📸</span> Screenshots
            </div>
            <div class="screenshot-grid">
              <div class="form-group">
                <label class="form-label">Before Trade</label>
                <div class="image-upload ${t.screenshotBefore ? 'has-image' : ''}" id="upload-before" data-field="before">
                  ${t.screenshotBefore
                    ? `<img src="${t.screenshotBefore}" class="image-upload-preview" alt="Before">
                       <button type="button" class="image-upload-remove" data-field="before">&times;</button>`
                    : `<div class="image-upload-icon">📷</div>
                       <div class="image-upload-text">Click or drag to upload</div>`
                  }
                  <input type="file" accept="image/*" class="hidden" id="file-before">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">After Trade</label>
                <div class="image-upload ${t.screenshotAfter ? 'has-image' : ''}" id="upload-after" data-field="after">
                  ${t.screenshotAfter
                    ? `<img src="${t.screenshotAfter}" class="image-upload-preview" alt="After">
                       <button type="button" class="image-upload-remove" data-field="after">&times;</button>`
                    : `<div class="image-upload-icon">📷</div>
                       <div class="image-upload-text">Click or drag to upload</div>`
                  }
                  <input type="file" accept="image/*" class="hidden" id="file-after">
                </div>
              </div>
            </div>
          </div>

          <!-- Psychology -->
          <div class="trade-form-section">
            <div class="trade-form-section-title">
              <span class="section-icon">🧠</span> Psychology & Review
            </div>

            <div class="form-group mb-4">
              <label class="form-label">Rule Followed?</label>
              <div class="toggle-group" id="tf-rule">
                <button type="button" class="toggle-btn ${t.ruleFollowed !== false ? 'active' : ''}" data-val="yes" style="min-width:80px">✓ Yes</button>
                <button type="button" class="toggle-btn ${t.ruleFollowed === false ? 'active' : ''}" data-val="no" style="min-width:80px">✗ No</button>
              </div>
            </div>

            <div class="form-row form-row-3 mb-4">
              <div class="form-group">
                <label class="form-label">Emotion Before</label>
                <select class="form-select" id="tf-emotion-before">
                  <option value="">Select...</option>
                  ${settings.emotions.map(e => `<option value="${e}" ${t.emotionBefore === e ? 'selected' : ''}>${e}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Emotion During</label>
                <select class="form-select" id="tf-emotion-during">
                  <option value="">Select...</option>
                  ${settings.emotions.map(e => `<option value="${e}" ${t.emotionDuring === e ? 'selected' : ''}>${e}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Emotion After</label>
                <select class="form-select" id="tf-emotion-after">
                  <option value="">Select...</option>
                  ${settings.emotions.map(e => `<option value="${e}" ${t.emotionAfter === e ? 'selected' : ''}>${e}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-group mb-4">
              <label class="form-label">Mistake Tags</label>
              <div class="chip-select" id="tf-mistakes">
                ${settings.mistakeTags.map(tag =>
                  `<span class="chip mistake ${(t.mistakeTags || []).includes(tag) ? 'selected' : ''}" data-tag="${tag}">${tag}</span>`
                ).join('')}
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Review Note</label>
              <textarea class="form-textarea" id="tf-review" rows="4" placeholder="What worked? What failed? What to repeat next time?">${t.reviewNote || ''}</textarea>
            </div>
          </div>

          <!-- Actions -->
          <div class="trade-form-actions">
            <button type="button" class="btn btn-secondary" id="tf-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary btn-lg" id="tf-submit">
              ${isEdit ? '💾 Update Trade' : '✓ Save Trade'}
            </button>
          </div>
        </form>
      </div>
    `;

    bindEvents(container);
  }

  function bindEvents(container) {
    const form = container.querySelector('#trade-form');
    
    // Save draft on any input, but make sure we are actually on the trade form
    form.addEventListener('input', () => cacheForm(container));
    form.addEventListener('change', () => cacheForm(container));

    // Calculate auto fields
    const calcFields = ['tf-entry', 'tf-stop', 'tf-target', 'tf-exit', 'tf-qty', 'tf-fees'];
    calcFields.forEach(id => {
      container.querySelector('#' + id).addEventListener('input', () => {
        recalc(container);
      });
    });

    // Direction Toggle
    const dirBtns = container.querySelectorAll('#tf-direction .toggle-btn');
    dirBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        dirBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        recalc(container);
        cacheForm(container);
      });
    });

    // Rule Toggle
    const ruleBtns = container.querySelectorAll('#tf-rule .toggle-btn');
    ruleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        ruleBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        cacheForm(container);
      });
    });

    // Mistake Chips
    const mistakeChips = container.querySelectorAll('#tf-mistakes .chip');
    mistakeChips.forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('selected');
        cacheForm(container);
      });
    });

    // Screenshot uploads
    setupImageUpload(container, 'before');
    setupImageUpload(container, 'after');

    // Cancel
    container.querySelector('#tf-cancel').addEventListener('click', () => {
      window.location.hash = '#/trades';
    });

    // Submit
    form.addEventListener('submit', e => {
      e.preventDefault();
      saveTrade(container);
    });
  }

  function recalc(container) {
    const entry = parseFloat(container.querySelector('#tf-entry').value);
    const stop = parseFloat(container.querySelector('#tf-stop').value);
    const target = parseFloat(container.querySelector('#tf-target').value);
    const exit = parseFloat(container.querySelector('#tf-exit').value);
    const qty = parseFloat(container.querySelector('#tf-qty').value) || 1;
    const fees = parseFloat(container.querySelector('#tf-fees').value) || 0;

    const dirBtn = container.querySelector('#tf-direction .toggle-btn.active');
    const direction = dirBtn ? dirBtn.dataset.dir : 'Long';

    // Planned R:R
    const rr = Utils.calcRR(entry, stop, target);
    if (rr != null) {
      container.querySelector('#tf-plannedrr').value = rr.toFixed(2);
    }

    // Risk money
    const risk = Utils.calcRiskMoney(entry, stop, qty);
    if (risk != null && !container.querySelector('#tf-risk').dataset.manual) {
      container.querySelector('#tf-risk').value = risk.toFixed(2);
    }

    // Result P&L
    if (exit) {
      const pnl = Utils.calcPnL(entry, exit, qty, direction, fees);
      if (pnl != null) {
        container.querySelector('#tf-result').value = pnl.toFixed(2);
      }

      const actualR = Utils.calcActualR(entry, exit, stop, direction);
      if (actualR != null) {
        container.querySelector('#tf-resultr').value = actualR.toFixed(2);
      }
    }
  }

  function setupImageUpload(container, field) {
    const uploadEl = container.querySelector(`#upload-${field}`);
    const fileInput = container.querySelector(`#file-${field}`);

    uploadEl.addEventListener('click', e => {
      if (e.target.closest('.image-upload-remove')) {
        e.stopPropagation();
        clearImage(container, field);
        return;
      }
      fileInput.click();
    });

    fileInput.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const dataUrl = await Utils.resizeImage(file, 800);
      showImage(container, field, dataUrl);
      cacheForm(container);
    });

    // Drag and drop
    uploadEl.addEventListener('dragover', e => {
      e.preventDefault();
      uploadEl.style.borderColor = 'var(--color-accent)';
    });
    uploadEl.addEventListener('dragleave', () => {
      uploadEl.style.borderColor = '';
    });
    uploadEl.addEventListener('drop', async e => {
      e.preventDefault();
      uploadEl.style.borderColor = '';
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        const dataUrl = await Utils.resizeImage(file, 800);
        showImage(container, field, dataUrl);
        cacheForm(container);
      }
    });
  }

  function showImage(container, field, dataUrl) {
    const uploadEl = container.querySelector(`#upload-${field}`);
    uploadEl.classList.add('has-image');
    uploadEl.innerHTML = `
      <img src="${dataUrl}" class="image-upload-preview" alt="${field}">
      <button type="button" class="image-upload-remove" data-field="${field}">&times;</button>
      <input type="file" accept="image/*" class="hidden" id="file-${field}">
    `;
    uploadEl.dataset.value = dataUrl;
    // Re-bind events
    setupImageUpload(container, field);
  }

  function clearImage(container, field) {
    const uploadEl = container.querySelector(`#upload-${field}`);
    uploadEl.classList.remove('has-image');
    uploadEl.dataset.value = '';
    uploadEl.innerHTML = `
      <div class="image-upload-icon">📷</div>
      <div class="image-upload-text">Click or drag to upload</div>
      <input type="file" accept="image/*" class="hidden" id="file-${field}">
    `;
    setupImageUpload(container, field);
    cacheForm(container);
  }

  function cacheForm(container) {
    if (editingId) return; // Don't draft if editing
    
    const dateEl = container.querySelector('#tf-date');
    if (!dateEl) return; // We are no longer on the trade form page!
    
    const dirBtn = container.querySelector('#tf-direction .toggle-btn.active');
    const ruleBtn = container.querySelector('#tf-rule .toggle-btn.active');
    const selectedMistakes = Array.from(container.querySelectorAll('#tf-mistakes .chip.selected')).map(c => c.dataset.tag);

    const draft = {
      date: container.querySelector('#tf-date').value,
      session: container.querySelector('#tf-session').value,
      instrument: container.querySelector('#tf-instrument').value,
      direction: dirBtn ? dirBtn.dataset.dir : 'Long',
      timeframe: container.querySelector('#tf-timeframe').value,
      setupName: container.querySelector('#tf-setup').value,
      entryPrice: container.querySelector('#tf-entry').value,
      stopPrice: container.querySelector('#tf-stop').value,
      targetPrice: container.querySelector('#tf-target').value,
      exitPrice: container.querySelector('#tf-exit').value,
      quantity: container.querySelector('#tf-qty').value,
      riskMoney: container.querySelector('#tf-risk').value,
      plannedRR: container.querySelector('#tf-plannedrr').value,
      resultMoney: container.querySelector('#tf-result').value,
      resultR: container.querySelector('#tf-resultr').value,
      fees: container.querySelector('#tf-fees').value,
      screenshotBefore: container.querySelector('#upload-before').dataset.value || '',
      screenshotAfter: container.querySelector('#upload-after').dataset.value || '',
      ruleFollowed: ruleBtn ? ruleBtn.dataset.val === 'yes' : true,
      emotionBefore: container.querySelector('#tf-emotion-before').value,
      emotionDuring: container.querySelector('#tf-emotion-during').value,
      emotionAfter: container.querySelector('#tf-emotion-after').value,
      mistakeTags: selectedMistakes,
      reviewNote: container.querySelector('#tf-review').value,
    };
    sessionStorage.setItem('tj_trade_draft', JSON.stringify(draft));
  }

  async function saveTrade(container) {
    const dirBtn = container.querySelector('#tf-direction .toggle-btn.active');
    const ruleBtn = container.querySelector('#tf-rule .toggle-btn.active');
    const selectedMistakes = Array.from(container.querySelectorAll('#tf-mistakes .chip.selected')).map(c => c.dataset.tag);

    const trade = {
      date: container.querySelector('#tf-date').value,
      session: container.querySelector('#tf-session').value,
      instrument: container.querySelector('#tf-instrument').value,
      direction: dirBtn ? dirBtn.dataset.dir : 'Long',
      timeframe: container.querySelector('#tf-timeframe').value,
      setupName: container.querySelector('#tf-setup').value,
      entryPrice: parseFloat(container.querySelector('#tf-entry').value) || 0,
      stopPrice: parseFloat(container.querySelector('#tf-stop').value) || 0,
      targetPrice: parseFloat(container.querySelector('#tf-target').value) || 0,
      exitPrice: parseFloat(container.querySelector('#tf-exit').value) || 0,
      quantity: parseFloat(container.querySelector('#tf-qty').value) || 1,
      riskMoney: parseFloat(container.querySelector('#tf-risk').value) || 0,
      plannedRR: parseFloat(container.querySelector('#tf-plannedrr').value) || 0,
      resultMoney: parseFloat(container.querySelector('#tf-result').value) || 0,
      resultR: parseFloat(container.querySelector('#tf-resultr').value) || 0,
      fees: parseFloat(container.querySelector('#tf-fees').value) || 0,
      screenshotBefore: container.querySelector('#upload-before').dataset.value || '',
      screenshotAfter: container.querySelector('#upload-after').dataset.value || '',
      ruleFollowed: ruleBtn ? ruleBtn.dataset.val === 'yes' : true,
      emotionBefore: container.querySelector('#tf-emotion-before').value,
      emotionDuring: container.querySelector('#tf-emotion-during').value,
      emotionAfter: container.querySelector('#tf-emotion-after').value,
      mistakeTags: selectedMistakes,
      reviewNote: container.querySelector('#tf-review').value,
    };

    if (!trade.instrument) {
      App.toast('Please select an instrument', 'error');
      return;
    }

    if (editingId) {
      await Store.updateTrade(editingId, trade);
      App.toast('Trade updated ✓', 'success');
    } else {
      await Store.addTrade(trade);
      sessionStorage.removeItem('tj_trade_draft'); // Clear draft on successful save
      App.toast('Trade saved ✓', 'success');
    }

    window.location.hash = '#/trades';
  }

  function destroy() {
    editingId = null;
  }

  return { render, destroy };
})();
