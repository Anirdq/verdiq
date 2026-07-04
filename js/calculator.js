/* ============================================================
   Verdiq — Position & Risk Calculator
   Calculates position sizes for Forex and Futures
   ============================================================ */

const Calculator = (() => {

  // Common multipliers for Futures and Forex (per standard lot)
  const multipliers = {
    'ES': 50,    // E-mini S&P 500: $50 per point
    'NQ': 20,    // E-mini Nasdaq: $20 per point
    'YM': 5,     // E-mini Dow: $5 per point
    'RTY': 50,   // E-mini Russell: $50 per point
    'CL': 1000,  // Crude Oil: $1000 per point ($10 per tick)
    'GC': 100,   // Gold: $100 per point
    // Forex (assuming standard lot 100,000 units, base currency USD)
    'EURUSD': 100000, // Pip value depends on decimal places. Usually we use position size = Risk / (Stop Loss diff * 100000) for standard lots?
    // Actually, for Forex, a standard lot is 100,000 units. 
    // For XXX/USD pairs, 1 pip (0.0001) is $10. So Risk = Size(Lots) * (StopDiff * 10000) * 10 
    // It's easier to just ask for Pip Value or Point Value. Let's do a simplified approach.
  };

  async function render(container) {
    const settings = await Store.getSettings();
    let bal = settings.accountBalance || 10000;
    let riskPct = settings.defaultRisk || 1;
    let riskAmt = (bal * (riskPct / 100)).toFixed(2);
    let asset = 'Futures';
    let mult = 50;
    let entry = '';
    let stop = '';
    let target = '';

    // Restore from draft
    try {
      const draft = JSON.parse(sessionStorage.getItem('tj_calc_draft'));
      if (draft) {
        if (draft.bal) bal = draft.bal;
        if (draft.riskPct) riskPct = draft.riskPct;
        if (draft.riskAmt) riskAmt = draft.riskAmt;
        if (draft.asset) asset = draft.asset;
        if (draft.mult) mult = draft.mult;
        if (draft.entry) entry = draft.entry;
        if (draft.stop) stop = draft.stop;
        if (draft.target) target = draft.target;
      }
    } catch(e) {}

    container.innerHTML = `
      <div class="page-container page-enter" style="max-width:800px">
        <div class="page-header">
          <div class="page-header-left">
            <h1 class="page-title">Position Calculator</h1>
            <p class="page-subtitle">Calculate exactly how much to trade before you enter</p>
          </div>
        </div>

        <div class="card p-4">
          <div class="form-row form-row-3 mb-4">
            <div class="form-group">
              <label class="form-label">Account Balance ($)</label>
              <input type="number" inputmode="decimal" step="any" class="form-input mono calc-input" id="calc-bal" value="${bal}">
            </div>
            <div class="form-group">
              <label class="form-label">Risk (%)</label>
              <input type="number" inputmode="decimal" step="any" class="form-input mono calc-input" id="calc-risk-pct" value="${riskPct}">
            </div>
            <div class="form-group">
              <label class="form-label">Risk Amount ($)</label>
              <input type="number" inputmode="decimal" step="any" class="form-input mono calc-input" id="calc-risk-amt" value="${riskAmt}">
            </div>
          </div>

          <div class="form-row form-row-2 mb-4">
            <div class="form-group">
              <label class="form-label">Asset Class</label>
              <select class="form-select calc-input" id="calc-asset">
                <option value="Futures" ${asset === 'Futures' ? 'selected' : ''}>Futures (Points)</option>
                <option value="Forex" ${asset === 'Forex' ? 'selected' : ''}>Forex (Pips / Exchange Rate)</option>
                <option value="Crypto" ${asset === 'Crypto' ? 'selected' : ''}>Crypto / Stocks (Direct)</option>
              </select>
            </div>
            <div class="form-group" id="calc-multiplier-group" style="${asset === 'Crypto' ? 'display:none' : 'display:block'}">
              <label class="form-label">Point/Pip Value Multiplier</label>
              <div style="display:flex; gap:10px;">
                <select class="form-select calc-input" id="calc-presets" style="flex:1; max-width: 140px;">
                  <option value="custom">Custom</option>
                  <optgroup label="Indices (CME)">
                    <option value="50">ES ($50)</option>
                    <option value="5">MES ($5)</option>
                    <option value="20">NQ ($20)</option>
                    <option value="2">MNQ ($2)</option>
                    <option value="5">YM ($5)</option>
                    <option value="0.5">MYM ($0.50)</option>
                  </optgroup>
                  <optgroup label="Commodities">
                    <option value="1000">CL ($1000)</option>
                    <option value="100">GC ($100)</option>
                  </optgroup>
                </select>
                <input type="number" inputmode="decimal" step="any" class="form-input mono calc-input" id="calc-multiplier" value="${mult}" style="flex:1">
              </div>
              <div class="form-help">Select an index or type the multiplier (e.g. NQ = 20)</div>
            </div>
          </div>

          <div class="form-row form-row-3 mb-4">
            <div class="form-group">
              <label class="form-label">Entry Price</label>
              <input type="number" inputmode="decimal" step="any" class="form-input mono calc-input" id="calc-entry" value="${entry}" placeholder="e.g. 4000.25">
            </div>
            <div class="form-group">
              <label class="form-label">Stop Loss</label>
              <input type="number" inputmode="decimal" step="any" class="form-input mono calc-input" id="calc-stop" value="${stop}" placeholder="e.g. 3995.00">
            </div>
            <div class="form-group">
              <label class="form-label">Target (Optional)</label>
              <input type="number" inputmode="decimal" step="any" class="form-input mono calc-input" id="calc-target" value="${target}" placeholder="e.g. 4010.50">
            </div>
          </div>

          <div class="calc-results p-4 mb-4" style="background:var(--bg-lighter);border-radius:var(--radius-md);border:1px solid var(--border-light);text-align:center">
            <div style="font-size:14px;color:var(--text-muted);margin-bottom:0.5rem">Recommended Position Size</div>
            <div id="calc-output-size" style="font-size:36px;font-weight:bold;color:var(--color-primary);font-family:var(--font-mono)">0.00</div>
            <div id="calc-output-desc" style="font-size:14px;color:var(--text-muted);margin-top:0.5rem">Enter Entry and Stop Loss to calculate</div>
            
            <div id="calc-profit-wrap" style="display:none; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-light)">
              <div style="font-size:14px;color:var(--text-muted);margin-bottom:0.5rem">Potential Profit</div>
              <div id="calc-output-profit" style="font-size:24px;font-weight:bold;color:var(--color-success);font-family:var(--font-mono)">$0.00</div>
              <div id="calc-output-rr" style="font-size:14px;color:var(--text-muted);margin-top:0.5rem">R:R</div>
            </div>
          </div>

          <button class="btn btn-primary w-full" id="calc-log-trade" disabled>Log This Trade ➔</button>
        </div>
      </div>
    `;

    bindEvents(container);
    // Initial calculate if fields are pre-filled
    if (entry && stop) {
      setTimeout(() => container.querySelector('#calc-entry').dispatchEvent(new Event('input')), 0);
    }
  }

  function cacheCalc(container) {
    const draft = {
      bal: container.querySelector('#calc-bal').value,
      riskPct: container.querySelector('#calc-risk-pct').value,
      riskAmt: container.querySelector('#calc-risk-amt').value,
      asset: container.querySelector('#calc-asset').value,
      mult: container.querySelector('#calc-multiplier').value,
      entry: container.querySelector('#calc-entry').value,
      stop: container.querySelector('#calc-stop').value,
      target: container.querySelector('#calc-target').value
    };
    sessionStorage.setItem('tj_calc_draft', JSON.stringify(draft));
  }

  function bindEvents(container) {
    const balEl = container.querySelector('#calc-bal');
    const riskPctEl = container.querySelector('#calc-risk-pct');
    const riskAmtEl = container.querySelector('#calc-risk-amt');
    
    const assetEl = container.querySelector('#calc-asset');
    const multEl = container.querySelector('#calc-multiplier');
    const presetsEl = container.querySelector('#calc-presets');
    const multGroup = container.querySelector('#calc-multiplier-group');

    const entryEl = container.querySelector('#calc-entry');
    const stopEl = container.querySelector('#calc-stop');
    const targetEl = container.querySelector('#calc-target');

    const outSize = container.querySelector('#calc-output-size');
    const outDesc = container.querySelector('#calc-output-desc');
    const profitWrap = container.querySelector('#calc-profit-wrap');
    const outProfit = container.querySelector('#calc-output-profit');
    const outRR = container.querySelector('#calc-output-rr');
    const logBtn = container.querySelector('#calc-log-trade');

    // Preset changes multiplier
    presetsEl.addEventListener('change', () => {
      if (presetsEl.value !== 'custom') {
        multEl.value = presetsEl.value;
        calculate();
        cacheCalc(container);
      }
    });

    // Sync % and $ risk
    balEl.addEventListener('input', () => {
      const b = parseFloat(balEl.value) || 0;
      const p = parseFloat(riskPctEl.value) || 0;
      riskAmtEl.value = (b * (p / 100)).toFixed(2);
      calculate();
    });

    riskPctEl.addEventListener('input', () => {
      const b = parseFloat(balEl.value) || 0;
      const p = parseFloat(riskPctEl.value) || 0;
      riskAmtEl.value = (b * (p / 100)).toFixed(2);
      calculate();
    });

    riskAmtEl.addEventListener('input', () => {
      const b = parseFloat(balEl.value) || 0;
      const a = parseFloat(riskAmtEl.value) || 0;
      if (b > 0) riskPctEl.value = ((a / b) * 100).toFixed(2);
      calculate();
    });

    // Asset change
    assetEl.addEventListener('change', () => {
      if (assetEl.value === 'Crypto') {
        multEl.value = 1;
        multGroup.style.display = 'none';
      } else if (assetEl.value === 'Forex') {
        multGroup.style.display = 'block';
        multEl.value = 100000; // Standard lot multiplier
        multGroup.querySelector('.form-help').textContent = 'Units per lot (100000 = Standard)';
      } else {
        multGroup.style.display = 'block';
        multEl.value = 50; // Default ES
        multGroup.querySelector('.form-help').textContent = 'Value of 1.0 movement in price (e.g. ES = 50)';
      }
      calculate();
    });

    // Re-calc on any input
    const inputs = container.querySelectorAll('.calc-input');
    inputs.forEach(i => i.addEventListener('input', () => {
      calculate();
      cacheCalc(container);
    }));

    function calculate() {
      const risk = parseFloat(riskAmtEl.value) || 0;
      const entry = parseFloat(entryEl.value) || 0;
      const stop = parseFloat(stopEl.value) || 0;
      const target = parseFloat(targetEl.value) || 0;
      const mult = parseFloat(multEl.value) || 1;

      if (risk <= 0 || entry <= 0 || stop <= 0 || entry === stop) {
        outSize.textContent = '0.00';
        outDesc.textContent = 'Enter valid Entry and Stop Loss to calculate';
        profitWrap.style.display = 'none';
        logBtn.disabled = true;
        return;
      }

      const diff = Math.abs(entry - stop);
      let size = 0;
      
      // Risk = Size * Diff * Multiplier
      // Size = Risk / (Diff * Multiplier)
      size = risk / (diff * mult);

      let unitLabel = 'Contracts / Units';
      if (assetEl.value === 'Forex') unitLabel = 'Lots';
      if (assetEl.value === 'Crypto') unitLabel = 'Coins / Shares';

      // Formatting
      if (assetEl.value === 'Forex') {
        outSize.textContent = size.toFixed(2);
      } else if (assetEl.value === 'Futures') {
        outSize.textContent = Math.floor(size); 
        if (size < 1) outSize.textContent = size.toFixed(2) + " (Micro/Nano needed)";
        else outSize.textContent = size.toFixed(2);
      } else {
        outSize.textContent = size.toFixed(4);
      }

      outDesc.textContent = `Risking $${risk.toFixed(2)} for a stop of ${diff.toFixed(4)} pts/pips`;

      // Profit Calculation
      if (target > 0) {
        const targetDiff = Math.abs(target - entry);
        const profit = size * targetDiff * mult;
        const rr = targetDiff / diff;
        outProfit.textContent = '$' + profit.toFixed(2);
        outRR.textContent = rr.toFixed(2) + ' R:R';
        profitWrap.style.display = 'block';
      } else {
        profitWrap.style.display = 'none';
      }

      logBtn.disabled = false;
    }

    // Log Trade Hand-off
    logBtn.addEventListener('click', () => {
      const risk = riskAmtEl.value;
      const entry = entryEl.value;
      const stop = stopEl.value;
      const target = targetEl.value;
      const size = parseFloat(outSize.textContent) || 0;
      
      // We pass via hash query params to prefill the New Trade form
      window.location.hash = `#/new-trade?entry=${entry}&stop=${stop}&target=${target}&risk=${risk}&qty=${size}`;
    });
  }

  function destroy() {}

  return { render, destroy };
})();
