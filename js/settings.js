/* ============================================================
   Trade Journal — Settings
   Manage instruments, sessions, setups, import/export
   ============================================================ */

const Settings = (() => {

  async function render(container) {
    const settings = await Store.getSettings();
    const trades = await Store.getTrades();
    const journalEntries = await Store.getJournalEntries();
    const tradeCount = trades.length;
    const journalCount = journalEntries.length;

    container.innerHTML = `
      <div class="page-container page-enter" style="max-width:800px">
        <div class="page-header">
          <div class="page-header-left">
            <h1 class="page-title">Settings</h1>
            <p class="page-subtitle">Customize your journal and manage data</p>
          </div>
        </div>

        <!-- Account & Risk Defaults -->
        <div class="settings-section">
          <h3 class="settings-section-title">Account & Risk Defaults</h3>
          <p class="settings-section-desc">Set your account balance and default risk for the position calculator.</p>
          <div class="form-row form-row-3 mb-3">
            <div class="form-group">
              <label class="form-label">Account Balance ($)</label>
              <div style="display:flex;gap:10px">
                <input type="number" inputmode="decimal" step="any" class="form-input" id="set-account-balance" value="${settings.accountBalance || 10000}">
                <button class="btn btn-secondary btn-sm" id="set-save-balance">Save</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Default Risk (%)</label>
              <div style="display:flex;gap:10px">
                <input type="number" inputmode="decimal" step="any" class="form-input" id="set-default-risk" value="${settings.defaultRisk || 1}">
                <button class="btn btn-secondary btn-sm" id="set-save-risk">Save</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Default Fee ($)</label>
              <div style="display:flex;gap:10px">
                <input type="number" inputmode="decimal" step="any" class="form-input" id="set-default-fee" value="${settings.defaultFee || 0}">
                <button class="btn btn-secondary btn-sm" id="set-save-fee">Save</button>
              </div>
              <button class="btn btn-secondary btn-sm mt-2" id="set-bulk-apply-fee" style="width:100%; font-size:11px;">Apply to Past Trades</button>
            </div>
          </div>
        </div>

        <!-- Instruments -->
        <div class="settings-section">
          <h3 class="settings-section-title">Instruments</h3>
          <p class="settings-section-desc">Manage the instruments you trade. These appear in dropdowns when logging trades.</p>
          <div class="settings-list-manage" id="set-instruments">
            ${settings.instruments.map(i => `
              <span class="tag tag-accent tag-removable">
                ${i} <span class="tag-remove" data-list="instruments" data-val="${i}">&times;</span>
              </span>
            `).join('')}
          </div>
          <div class="settings-add-row">
            <input type="text" class="form-input" id="set-add-instrument" placeholder="e.g. GBPUSD">
            <button class="btn btn-secondary btn-sm" id="set-add-instrument-btn">Add</button>
          </div>
        </div>

        <!-- Sessions -->
        <div class="settings-section">
          <h3 class="settings-section-title">Sessions</h3>
          <p class="settings-section-desc">Trading sessions you want to track.</p>
          <div class="settings-list-manage" id="set-sessions">
            ${settings.sessions.map(s => `
              <span class="tag tag-purple tag-removable">
                ${s} <span class="tag-remove" data-list="sessions" data-val="${s}">&times;</span>
              </span>
            `).join('')}
          </div>
          <div class="settings-add-row">
            <input type="text" class="form-input" id="set-add-session" placeholder="e.g. Asian">
            <button class="btn btn-secondary btn-sm" id="set-add-session-btn">Add</button>
          </div>
        </div>

        <!-- Setup Names -->
        <div class="settings-section">
          <h3 class="settings-section-title">Setup Names</h3>
          <p class="settings-section-desc">Your trading setups and strategies.</p>
          <div class="settings-list-manage" id="set-setups">
            ${settings.setupNames.map(s => `
              <span class="tag tag-removable">
                ${s} <span class="tag-remove" data-list="setupNames" data-val="${s}">&times;</span>
              </span>
            `).join('')}
          </div>
          <div class="settings-add-row">
            <input type="text" class="form-input" id="set-add-setup" placeholder="e.g. ICT Silver Bullet">
            <button class="btn btn-secondary btn-sm" id="set-add-setup-btn">Add</button>
          </div>
        </div>

        <!-- Emotions -->
        <div class="settings-section">
          <h3 class="settings-section-title">Emotion Labels</h3>
          <p class="settings-section-desc">Emotions you track before, during, and after trades.</p>
          <div class="settings-list-manage" id="set-emotions">
            ${settings.emotions.map(e => `
              <span class="tag tag-removable">
                ${e} <span class="tag-remove" data-list="emotions" data-val="${e}">&times;</span>
              </span>
            `).join('')}
          </div>
          <div class="settings-add-row">
            <input type="text" class="form-input" id="set-add-emotion" placeholder="e.g. Disciplined">
            <button class="btn btn-secondary btn-sm" id="set-add-emotion-btn">Add</button>
          </div>
        </div>

        <!-- Mistake Tags -->
        <div class="settings-section">
          <h3 class="settings-section-title">Mistake Tags</h3>
          <p class="settings-section-desc">Common mistakes to tag on trades for review.</p>
          <div class="settings-list-manage" id="set-mistakes">
            ${settings.mistakeTags.map(m => `
              <span class="tag tag-warning tag-removable">
                ${m} <span class="tag-remove" data-list="mistakeTags" data-val="${m}">&times;</span>
              </span>
            `).join('')}
          </div>
          <div class="settings-add-row">
            <input type="text" class="form-input" id="set-add-mistake" placeholder="e.g. Scaled Out Too Early">
            <button class="btn btn-secondary btn-sm" id="set-add-mistake-btn">Add</button>
          </div>
        </div>

        <!-- Data Management -->
        <div class="settings-section">
          <h3 class="settings-section-title">Data Management</h3>
          <p class="settings-section-desc">Export, import, or manage your trading data. Currently storing <strong>${tradeCount}</strong> trades and <strong>${journalCount}</strong> journal entries.</p>
          <div class="flex gap-3 flex-wrap mb-4">
            <button class="btn btn-primary" id="set-import-csv">
              <span class="btn-icon">📥</span> Import Trades (CSV)
            </button>
            <input type="file" id="csv-file-input" accept=".csv" class="hidden">
            <button class="btn btn-secondary" id="set-export">📦 Export Data (JSON)</button>
            <button class="btn btn-secondary" id="set-import-json">📥 Import Data (JSON)</button>
          </div>
          <p class="settings-section-desc" style="margin-top: -10px;">Supports Tradovate and MetaTrader CSV exports.</p>
        </div>

        <!-- Danger Zone -->
        <div class="settings-section settings-danger-zone">
          <h3 class="settings-section-title">⚠️ Danger Zone</h3>
          <p class="settings-section-desc">These actions are irreversible. Make sure to export a backup first.</p>
          <div class="flex flex-wrap gap-3">
            <button class="btn btn-danger" id="set-clear-trades">Delete All Trades</button>
            <button class="btn btn-danger" id="set-clear-all">Delete Everything & Logout</button>
          </div>
        </div>
      </div>
    `;

    bindEvents(container);
  }

  function bindEvents(container) {
    // Remove from lists
    container.addEventListener('click', async e => {
      const removeBtn = e.target.closest('.tag-remove');
      if (removeBtn) {
        const listName = removeBtn.dataset.list;
        const val = removeBtn.dataset.val;
        const s = await Store.getSettings();
        if (s[listName]) {
          s[listName] = s[listName].filter(v => v !== val);
          await Store.updateSettings(s);
          await render(container);
        }
      }
    });

    // Add to lists
    const addHandlers = [
      { input: 'set-add-instrument', btn: 'set-add-instrument-btn', list: 'instruments' },
      { input: 'set-add-session', btn: 'set-add-session-btn', list: 'sessions' },
      { input: 'set-add-setup', btn: 'set-add-setup-btn', list: 'setupNames' },
      { input: 'set-add-emotion', btn: 'set-add-emotion-btn', list: 'emotions' },
      { input: 'set-add-mistake', btn: 'set-add-mistake-btn', list: 'mistakeTags' },
    ];

    addHandlers.forEach(({ input, btn, list }) => {
      const inputEl = container.querySelector('#' + input);
      const btnEl = container.querySelector('#' + btn);

      const doAdd = async () => {
        const val = inputEl.value.trim();
        if (val) {
          const s = await Store.getSettings();
          if (s[list] && !s[list].includes(val)) {
            s[list].push(val);
            await Store.updateSettings(s);
            inputEl.value = '';
            await render(container);
            App.toast(`Added "${val}"`, 'success');
          }
        }
      };

      btnEl.addEventListener('click', doAdd);
      inputEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); doAdd(); }
      });
    });

    // Save Account Balance
    const saveBalance = async () => {
      const val = parseFloat(container.querySelector('#set-account-balance').value);
      if (!isNaN(val)) {
        const s = await Store.getSettings();
        if (s.accountBalance !== val) {
          s.accountBalance = val;
          await Store.updateSettings(s);
          App.toast('Account balance updated', 'success');
        }
      }
    };
    container.querySelector('#set-save-balance').addEventListener('click', saveBalance);
    container.querySelector('#set-account-balance').addEventListener('blur', saveBalance);

    // Save Default Risk
    const saveRisk = async () => {
      const val = parseFloat(container.querySelector('#set-default-risk').value);
      if (!isNaN(val)) {
        const s = await Store.getSettings();
        if (s.defaultRisk !== val) {
          s.defaultRisk = val;
          await Store.updateSettings(s);
          App.toast('Default risk updated', 'success');
        }
      }
    };
    container.querySelector('#set-save-risk').addEventListener('click', saveRisk);
    container.querySelector('#set-default-risk').addEventListener('blur', saveRisk);

    // Save Default Fee
    const saveFee = async () => {
      const val = parseFloat(container.querySelector('#set-default-fee').value);
      if (!isNaN(val)) {
        const s = await Store.getSettings();
        if (s.defaultFee !== val) {
          s.defaultFee = val;
          await Store.updateSettings(s);
          App.toast('Default fee updated', 'success');
        }
      }
    };
    container.querySelector('#set-save-fee').addEventListener('click', saveFee);
    container.querySelector('#set-default-fee').addEventListener('blur', saveFee);

    // Bulk Apply Fee
    container.querySelector('#set-bulk-apply-fee').addEventListener('click', async () => {
      const s = await Store.getSettings();
      const fee = s.defaultFee || 0;
      if (confirm(`Apply $${fee} commission fee to ALL past trades?`)) {
        const trades = await Store.getTrades();
        let updated = 0;
        for (const t of trades) {
          t.fees = fee;
          await Store.saveTrade(t);
          updated++;
        }
        if (updated > 0) {
          App.toast(`Applied $${fee} fee to ${updated} trades`, 'success');
          await render(container);
        }
      }
    });

    // Export/Import
    container.querySelector('#set-export').addEventListener('click', () => {
      Store.exportAll();
    });
    container.querySelector('#set-import-json').addEventListener('click', () => {
      Store.importJSON();
    });

    // Clear trades
    container.querySelector('#set-clear-trades').addEventListener('click', async () => {
      if (confirm('Delete ALL trades? This cannot be undone. Export a backup first!')) {
        const trades = await Store.getTrades();
        for (const t of trades) {
          await Store.deleteTrade(t.id);
        }
        App.toast('All trades deleted', 'info');
        await render(container);
      }
    });

    // Clear everything
    container.querySelector('#set-clear-all').addEventListener('click', async () => {
      if (confirm('Delete EVERYTHING? All trades, journal entries, and settings will be lost. This cannot be undone!')) {
        if (confirm('Are you really sure? This is permanent.')) {
          Store.clearAll();
          App.toast('All data cleared', 'info');
          // Reload page to re-trigger auth
          window.location.reload();
        }
      }
    });

    // CSV Import
    const csvInput = container.querySelector('#csv-file-input');
    const importBtn = container.querySelector('#set-import-csv');
    if (importBtn && csvInput) {
      importBtn.addEventListener('click', () => csvInput.click());
      csvInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
          const count = await ImportCSV.handleImport(file);
          App.toast(`Successfully imported ${count} trades!`, 'success');
          // Update counts
          const newTrades = await Store.getTrades();
          container.querySelector('.settings-section-desc strong').textContent = newTrades.length;
        } catch (err) {
          App.toast(`Import failed: ${err.message}`, 'error');
        }
        csvInput.value = ''; // reset
      });
    }
  }

  function destroy() {}

  return { render, destroy };
})();
