/* ============================================================
   Trade Journal — Trade Log / List
   Sortable, filterable, expandable trade table
   ============================================================ */

const TradeList = (() => {

  let expandedId = null;
  let sortCol = 'date';
  let sortDir = 'desc';
  let filters = {};

  async function render(container) {
    const settings = await Store.getSettings();

    container.innerHTML = `
      <div class="page-container page-enter">
        <div class="page-header">
          <div class="page-header-left">
            <h1 class="page-title">Trade Log</h1>
            <p class="page-subtitle">All your recorded trades</p>
          </div>
          <div class="page-header-actions">
            <button class="btn btn-primary" onclick="window.location.hash='#/new-trade'">+ New Trade</button>
          </div>
        </div>

        <div class="filter-bar mb-4" id="tl-filters">
          <span class="filter-label">Filters:</span>
          <input type="date" class="form-input" id="tl-start" style="max-width:140px" placeholder="Start">
          <input type="date" class="form-input" id="tl-end" style="max-width:140px" placeholder="End">
          <select class="form-select" id="tl-instrument">
            <option value="">All Instruments</option>
            ${settings.instruments.map(i => `<option value="${i}">${i}</option>`).join('')}
          </select>
          <select class="form-select" id="tl-session">
            <option value="">All Sessions</option>
            ${settings.sessions.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
          <select class="form-select" id="tl-direction">
            <option value="">All Directions</option>
            <option value="Long">Long</option>
            <option value="Short">Short</option>
          </select>
          <select class="form-select" id="tl-result">
            <option value="">All Results</option>
            <option value="win">Winners</option>
            <option value="loss">Losers</option>
            <option value="breakeven">Breakeven</option>
          </select>
          <button class="btn btn-ghost btn-sm" id="tl-clear-filters">Clear</button>
        </div>

        <div id="tl-count" class="trade-count mb-3"></div>
        <div id="tl-table-wrap"></div>
      </div>
    `;

    // Bind filter events
    ['tl-start', 'tl-end', 'tl-instrument', 'tl-session', 'tl-direction', 'tl-result'].forEach(id => {
      container.querySelector('#' + id).addEventListener('change', () => {
        readFilters(container);
        renderTable(container);
      });
    });

    container.querySelector('#tl-clear-filters').addEventListener('click', () => {
      ['tl-start', 'tl-end', 'tl-instrument', 'tl-session', 'tl-direction', 'tl-result'].forEach(id => {
        container.querySelector('#' + id).value = '';
      });
      filters = {};
      renderTable(container);
    });

    renderTable(container);
  }

  function readFilters(container) {
    filters = {
      startDate: container.querySelector('#tl-start').value || undefined,
      endDate: container.querySelector('#tl-end').value || undefined,
      instrument: container.querySelector('#tl-instrument').value || undefined,
      session: container.querySelector('#tl-session').value || undefined,
      direction: container.querySelector('#tl-direction').value || undefined,
      result: container.querySelector('#tl-result').value || undefined,
    };
  }

  async function renderTable(container) {
    let trades = await Store.filterTrades(filters);

    // Sort
    trades.sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (sortCol === 'resultMoney' || sortCol === 'resultR' || sortCol === 'entryPrice' || sortCol === 'exitPrice') {
        va = parseFloat(va) || 0;
        vb = parseFloat(vb) || 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    container.querySelector('#tl-count').innerHTML = `Showing <span>${trades.length}</span> trade${trades.length !== 1 ? 's' : ''}`;

    if (trades.length === 0) {
      container.querySelector('#tl-table-wrap').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">No trades yet</div>
          <div class="empty-state-desc">Start logging your trades to build your journal and track performance.</div>
          <button class="btn btn-primary" onclick="window.location.hash='#/new-trade'">+ Log Your First Trade</button>
        </div>
      `;
      return;
    }

    const cols = [
      { key: 'date', label: 'Date', sortable: true },
      { key: 'session', label: 'Session', sortable: true },
      { key: 'instrument', label: 'Instrument', sortable: true },
      { key: 'direction', label: 'Dir', sortable: true },
      { key: 'setupName', label: 'Setup', sortable: true },
      { key: 'entryPrice', label: 'Entry', sortable: true },
      { key: 'exitPrice', label: 'Exit', sortable: true },
      { key: 'resultMoney', label: 'P&L ($)', sortable: true },
      { key: 'resultR', label: 'P&L (R)', sortable: true },
      { key: 'ruleFollowed', label: 'Rule?', sortable: true },
      { key: 'actions', label: '', sortable: false },
    ];

    let html = `<div class="table-container"><table class="data-table"><thead><tr>`;
    cols.forEach(col => {
      const sorted = sortCol === col.key;
      const icon = sorted ? (sortDir === 'asc' ? '▲' : '▼') : '⇅';
      html += `<th class="${col.sortable ? 'sortable' : ''} ${sorted ? 'sorted' : ''}" data-col="${col.key}">
        ${col.label} ${col.sortable ? `<span class="sort-icon">${icon}</span>` : ''}
      </th>`;
    });
    html += `</tr></thead><tbody>`;

    trades.forEach(t => {
      const pnl = parseFloat(t.resultMoney) || 0;
      const rowClass = pnl > 0 ? 'row-win' : pnl < 0 ? 'row-loss' : '';
      const isExpanded = expandedId === t.id;
      const mistakeHtml = (t.mistakeTags || []).slice(0, 2).map(m => `<span class="tag tag-warning" style="font-size:0.625rem">${m}</span>`).join(' ');

      html += `<tr class="${rowClass}" data-id="${t.id}" style="cursor:pointer">
        <td class="cell-mono">${Utils.formatDate(t.date, 'short')}</td>
        <td>${t.session || '—'}</td>
        <td><span class="tag tag-accent">${t.instrument}</span></td>
        <td><span class="tag ${t.direction === 'Long' ? 'tag-profit' : 'tag-loss'}">${t.direction === 'Long' ? '▲' : '▼'} ${t.direction}</span></td>
        <td class="truncate" style="max-width:150px">${t.setupName || '—'}</td>
        <td class="cell-mono">${t.entryPrice || '—'}</td>
        <td class="cell-mono">${t.exitPrice || '—'}</td>
        <td class="cell-pnl ${Utils.pnlClass(pnl)}">${Utils.formatCurrency(pnl)}</td>
        <td class="cell-pnl ${Utils.pnlClass(t.resultR)}">${Utils.formatR(parseFloat(t.resultR) || 0)}</td>
        <td>${t.ruleFollowed ? '<span class="text-profit">✓</span>' : '<span class="text-loss">✗</span>'}</td>
        <td class="trade-actions-cell">
          <button class="btn btn-ghost btn-icon btn-sm edit-trade-btn" data-id="${t.id}" title="Edit">✏️</button>
          <button class="btn btn-ghost btn-icon btn-sm delete-trade-btn" data-id="${t.id}" title="Delete">🗑️</button>
        </td>
      </tr>`;

      if (isExpanded) {
        html += `<tr><td colspan="${cols.length}" style="padding:0">${renderExpanded(t)}</td></tr>`;
      }
    });

    html += `</tbody></table></div>`;
    container.querySelector('#tl-table-wrap').innerHTML = html;

    // Bind table events
    container.querySelector('.data-table thead').addEventListener('click', e => {
      const th = e.target.closest('th.sortable');
      if (!th) return;
      const col = th.dataset.col;
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = col;
        sortDir = col === 'date' ? 'desc' : 'asc';
      }
      renderTable(container);
    });

    container.querySelector('.data-table tbody').addEventListener('click', async e => {
      // Edit
      const editBtn = e.target.closest('.edit-trade-btn');
      if (editBtn) {
        e.stopPropagation();
        window.location.hash = '#/edit-trade/' + editBtn.dataset.id;
        return;
      }

      // Delete
      const deleteBtn = e.target.closest('.delete-trade-btn');
      if (deleteBtn) {
        e.stopPropagation();
        if (confirm('Delete this trade? This cannot be undone.')) {
          await Store.deleteTrade(deleteBtn.dataset.id);
          App.toast('Trade deleted', 'info');
          renderTable(container);
        }
        return;
      }

      // Expand row
      const row = e.target.closest('tr[data-id]');
      if (row) {
        expandedId = expandedId === row.dataset.id ? null : row.dataset.id;
        renderTable(container);
      }
    });
  }

  function renderExpanded(t) {
    const details = [
      { label: 'Date', value: Utils.formatDate(t.date, 'long') },
      { label: 'Session', value: t.session || '—' },
      { label: 'Instrument', value: t.instrument },
      { label: 'Direction', value: t.direction },
      { label: 'Timeframe', value: t.timeframe || '—' },
      { label: 'Setup', value: t.setupName || '—' },
      { label: 'Entry', value: t.entryPrice },
      { label: 'Stop', value: t.stopPrice },
      { label: 'Target', value: t.targetPrice },
      { label: 'Exit', value: t.exitPrice },
      { label: 'Quantity', value: t.quantity },
      { label: 'Risk ($)', value: Utils.formatCurrencyNoSign(t.riskMoney) },
      { label: 'Planned R:R', value: t.plannedRR ? '1:' + parseFloat(t.plannedRR).toFixed(1) : '—' },
      { label: 'Fees', value: Utils.formatCurrencyNoSign(t.fees) },
      { label: 'Result ($)', value: Utils.formatCurrency(t.resultMoney) },
      { label: 'Result (R)', value: Utils.formatR(parseFloat(t.resultR) || 0) },
      { label: 'Rule Followed', value: t.ruleFollowed ? '✓ Yes' : '✗ No' },
      { label: 'Emotion Before', value: t.emotionBefore || '—' },
      { label: 'Emotion During', value: t.emotionDuring || '—' },
      { label: 'Emotion After', value: t.emotionAfter || '—' },
    ];

    let html = `<div class="trade-expanded animate-fade-in">
      <div class="trade-expanded-grid">
        ${details.map(d => `
          <div class="trade-detail-item">
            <span class="trade-detail-label">${d.label}</span>
            <span class="trade-detail-value">${d.value}</span>
          </div>
        `).join('')}
      </div>`;

    // Mistake tags
    if (t.mistakeTags && t.mistakeTags.length > 0) {
      html += `<div class="mb-3">
        <span class="trade-detail-label" style="display:block;margin-bottom:var(--space-2)">Mistakes</span>
        <div class="flex gap-2 flex-wrap">${t.mistakeTags.map(m => `<span class="tag tag-warning">${m}</span>`).join('')}</div>
      </div>`;
    }

    // Screenshots
    if (t.screenshotBefore || t.screenshotAfter) {
      html += `<div class="trade-screenshots">`;
      if (t.screenshotBefore) {
        html += `<div class="trade-screenshot-wrap">
          <img src="${t.screenshotBefore}" alt="Before" loading="lazy">
          <div class="trade-screenshot-label">Before</div>
        </div>`;
      }
      if (t.screenshotAfter) {
        html += `<div class="trade-screenshot-wrap">
          <img src="${t.screenshotAfter}" alt="After" loading="lazy">
          <div class="trade-screenshot-label">After</div>
        </div>`;
      }
      html += `</div>`;
    }

    // Review note
    if (t.reviewNote) {
      html += `<div class="trade-review-note">
        <div class="trade-review-note-label">Review Note</div>
        <div class="trade-review-note-text">${Utils.escapeHTML(t.reviewNote)}</div>
      </div>`;
    }

    html += `</div>`;
    return html;
  }

  function destroy() {
    expandedId = null;
    filters = {};
  }

  return { render, destroy };
})();
