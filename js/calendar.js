/* ============================================================
   Trade Journal — Calendar View
   Monthly calendar with P&L heatmap
   ============================================================ */

const Calendar = (() => {

  let currentYear, currentMonth;
  let selectedDate = null;

  async function render(container) {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();

    container.innerHTML = `
      <div class="page-container page-enter">
        <div class="page-header">
          <div class="page-header-left">
            <h1 class="page-title">Calendar</h1>
            <p class="page-subtitle">Visual overview of your trading days</p>
          </div>
        </div>
        <div id="cal-container"></div>
        <div id="cal-detail"></div>
      </div>
    `;

    await renderCalendar(container);
  }

  async function renderCalendar(container) {
    const calEl = container.querySelector('#cal-container');
    const trades = await Store.getTrades();
    const byDate = Utils.groupByDate(trades);

    const daysInMonth = Utils.getDaysInMonth(currentYear, currentMonth);
    const firstDay = Utils.getFirstDayOfMonth(currentYear, currentMonth);
    // Adjust so Monday = 0
    const startOffset = (firstDay === 0 ? 6 : firstDay - 1);

    const monthName = new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Calculate month stats
    const monthTrades = trades.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });
    const monthStats = Utils.calcStats(monthTrades);

    let html = `
      <div class="calendar-container">
        <div class="calendar-header">
          <button class="btn btn-ghost btn-icon" id="cal-prev">◀</button>
          <h2 class="calendar-month-title">${monthName}</h2>
          <button class="btn btn-ghost btn-icon" id="cal-next">▶</button>
        </div>
        <div class="calendar-weekdays">
          ${weekdays.map(d => `<div class="calendar-weekday">${d}</div>`).join('')}
        </div>
        <div class="calendar-days">
    `;

    // Previous month padding
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevDays = Utils.getDaysInMonth(prevYear, prevMonth);
    for (let i = startOffset - 1; i >= 0; i--) {
      const day = prevDays - i;
      html += `<div class="calendar-day other-month"><span class="calendar-day-number">${day}</span></div>`;
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTrades = byDate[dateStr] || [];
      const dayPnL = dayTrades.reduce((s, t) => s + (parseFloat(t.resultMoney) || 0), 0);
      const isToday = Utils.isToday(dateStr);
      const isSelected = selectedDate === dateStr;

      let dayClass = 'calendar-day';
      if (isToday) dayClass += ' today';
      if (isSelected) dayClass += ' selected';
      if (dayTrades.length > 0) {
        dayClass += dayPnL > 0 ? ' day-profit' : dayPnL < 0 ? ' day-loss' : '';
      }

      html += `<div class="${dayClass}" data-date="${dateStr}">
        <span class="calendar-day-number">${d}</span>
        ${dayTrades.length > 0 ? `
          <div class="calendar-day-pnl">${Utils.formatCurrency(dayPnL)}</div>
          <div class="calendar-day-trades">${dayTrades.length} trade${dayTrades.length > 1 ? 's' : ''}</div>
        ` : ''}
      </div>`;
    }

    // Next month padding
    const totalCells = startOffset + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      html += `<div class="calendar-day other-month"><span class="calendar-day-number">${i}</span></div>`;
    }

    html += `</div>`;

    // Month summary
    html += `
      <div class="calendar-summary">
        <div class="calendar-summary-item">
          <div class="calendar-summary-label">Trades</div>
          <div class="calendar-summary-value">${monthStats.totalTrades}</div>
        </div>
        <div class="calendar-summary-item">
          <div class="calendar-summary-label">Win Rate</div>
          <div class="calendar-summary-value ${monthStats.winRate >= 50 ? 'text-profit' : monthStats.totalTrades > 0 ? 'text-loss' : ''}">${Utils.formatPercent(monthStats.winRate)}</div>
        </div>
        <div class="calendar-summary-item">
          <div class="calendar-summary-label">Net P&L</div>
          <div class="calendar-summary-value ${Utils.pnlClass(monthStats.netPnL)}">${Utils.formatCurrency(monthStats.netPnL)}</div>
        </div>
        <div class="calendar-summary-item">
          <div class="calendar-summary-label">Avg R</div>
          <div class="calendar-summary-value ${Utils.pnlClass(monthStats.avgR)}">${Utils.formatR(monthStats.avgR)}</div>
        </div>
        <div class="calendar-summary-item">
          <div class="calendar-summary-label">Profit Factor</div>
          <div class="calendar-summary-value">${monthStats.profitFactor === Infinity ? '∞' : monthStats.profitFactor.toFixed(2)}</div>
        </div>
        <div class="calendar-summary-item">
          <div class="calendar-summary-label">Trading Days</div>
          <div class="calendar-summary-value">${Object.keys(byDate).filter(d => {
            const dd = new Date(d);
            return dd.getFullYear() === currentYear && dd.getMonth() === currentMonth;
          }).length}</div>
        </div>
      </div>
    </div>`;

    calEl.innerHTML = html;

    // Bind events
    calEl.querySelector('#cal-prev').addEventListener('click', async () => {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      selectedDate = null;
      await renderCalendar(container);
    });

    calEl.querySelector('#cal-next').addEventListener('click', async () => {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      selectedDate = null;
      await renderCalendar(container);
    });

    calEl.querySelector('.calendar-days').addEventListener('click', async e => {
      const dayEl = e.target.closest('.calendar-day:not(.other-month)');
      if (!dayEl) return;
      selectedDate = dayEl.dataset.date;
      await renderCalendar(container);
      await renderDetail(container, selectedDate);
    });

    // Show detail if selected
    if (selectedDate) {
      await renderDetail(container, selectedDate);
    } else {
      container.querySelector('#cal-detail').innerHTML = '';
    }
  }

  async function renderDetail(container, dateStr) {
    const detailEl = container.querySelector('#cal-detail');
    const allTrades = await Store.getTrades();
    const trades = allTrades.filter(t => t.date.slice(0, 10) === dateStr);
    const journal = await Store.getJournalByDate(dateStr);

    if (trades.length === 0 && !journal) {
      detailEl.innerHTML = `
        <div class="calendar-detail animate-fade-in-up">
          <div class="calendar-detail-header">
            <h3 class="calendar-detail-date">${Utils.formatDate(dateStr, 'long')}</h3>
            <button class="btn btn-ghost btn-sm" id="cal-close-detail">✕</button>
          </div>
          <div class="empty-state" style="padding:var(--space-8)">
            <div class="empty-state-desc">No trades or journal entries for this day.</div>
            <div class="flex gap-3">
              <button class="btn btn-primary btn-sm" onclick="window.location.hash='#/new-trade'">+ Log Trade</button>
              <button class="btn btn-secondary btn-sm" onclick="window.location.hash='#/journal?date=${dateStr}'">📝 Journal</button>
            </div>
          </div>
        </div>
      `;
      detailEl.querySelector('#cal-close-detail').addEventListener('click', () => {
        selectedDate = null;
        detailEl.innerHTML = '';
        renderCalendar(container);
      });
      return;
    }

    const dayPnL = trades.reduce((s, t) => s + (parseFloat(t.resultMoney) || 0), 0);

    let html = `
      <div class="calendar-detail animate-fade-in-up">
        <div class="calendar-detail-header">
          <div>
            <h3 class="calendar-detail-date">${Utils.formatDate(dateStr, 'long')}</h3>
            <span class="text-sm text-secondary">${trades.length} trade${trades.length !== 1 ? 's' : ''} · Net: <span class="${Utils.pnlClass(dayPnL)} font-mono font-semibold">${Utils.formatCurrency(dayPnL)}</span></span>
          </div>
          <button class="btn btn-ghost btn-sm" id="cal-close-detail">✕</button>
        </div>
    `;

    if (trades.length > 0) {
      html += `<div class="table-container mt-4"><table class="data-table"><thead><tr>
        <th>Instrument</th><th>Dir</th><th>Setup</th><th>Entry</th><th>Exit</th><th>P&L</th><th>R</th>
      </tr></thead><tbody>`;
      trades.forEach(t => {
        const pnl = parseFloat(t.resultMoney) || 0;
        html += `<tr class="${pnl > 0 ? 'row-win' : pnl < 0 ? 'row-loss' : ''}" style="cursor:pointer" onclick="window.location.hash='#/edit-trade/${t.id}'">
          <td><span class="tag tag-accent">${t.instrument}</span></td>
          <td><span class="tag ${t.direction === 'Long' ? 'tag-profit' : 'tag-loss'}">${t.direction}</span></td>
          <td>${t.setupName || '—'}</td>
          <td class="cell-mono">${t.entryPrice}</td>
          <td class="cell-mono">${t.exitPrice || '—'}</td>
          <td class="cell-pnl ${Utils.pnlClass(pnl)}">${Utils.formatCurrency(pnl)}</td>
          <td class="cell-pnl ${Utils.pnlClass(t.resultR)}">${Utils.formatR(parseFloat(t.resultR) || 0)}</td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    }

    if (journal) {
      html += `<div class="trade-review-note mt-4">
        <div class="trade-review-note-label">Journal Entry ${journal.mood ? '· ' + journal.mood : ''}</div>
        <div class="trade-review-note-text">${Utils.escapeHTML(journal.content)}</div>
      </div>`;
    }

    html += `</div>`;
    detailEl.innerHTML = html;

    detailEl.querySelector('#cal-close-detail').addEventListener('click', () => {
      selectedDate = null;
      detailEl.innerHTML = '';
      renderCalendar(container);
    });
  }

  function destroy() {
    selectedDate = null;
  }

  return { render, destroy };
})();
