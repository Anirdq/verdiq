/* ============================================================
   Trade Journal — Dashboard
   Performance analytics with Chart.js charts
   ============================================================ */

const Dashboard = (() => {

  let charts = {};
  let currentFilter = { range: 'All Time', instrument: '' };

  async function render(container) {
    const presets = Utils.dateRangePresets();
    const settings = await Store.getSettings();

    container.innerHTML = `
      <div class="page-container page-enter">
        <div class="page-header">
          <div class="page-header-left">
            <h1 class="page-title">Dashboard</h1>
            <p class="page-subtitle">Your trading performance at a glance</p>
          </div>
          <div class="page-header-actions">
            <select id="dash-instrument-filter" class="form-select" style="min-width:120px">
              <option value="">All Instruments</option>
              ${settings.instruments.map(i => `<option value="${i}" ${currentFilter.instrument === i ? 'selected' : ''}>${i}</option>`).join('')}
            </select>
            <div class="toggle-group" id="dash-range-group">
              ${Object.keys(presets).map(key =>
                `<button class="toggle-btn ${currentFilter.range === key ? 'active' : ''}" data-range="${key}">${key.replace('This ', '')}</button>`
              ).join('')}
            </div>
          </div>
        </div>

        <div id="dash-stats" class="dashboard-stats stagger"></div>

        <div id="dash-charts" class="dashboard-charts stagger" style="animation-delay:0.2s">
          <div class="chart-container chart-full" id="chart-equity-wrap">
            <div class="chart-header">
              <span class="chart-title">Equity Curve</span>
            </div>
            <div class="chart-canvas-wrap" style="height:300px"><canvas id="chart-equity"></canvas></div>
          </div>
          <div class="chart-container" id="chart-winloss-wrap">
            <div class="chart-header">
              <span class="chart-title">Win / Loss</span>
            </div>
            <div class="chart-canvas-wrap"><canvas id="chart-winloss"></canvas></div>
          </div>
          <div class="chart-container" id="chart-rdist-wrap">
            <div class="chart-header">
              <span class="chart-title">R-Multiple Distribution</span>
            </div>
            <div class="chart-canvas-wrap"><canvas id="chart-rdist"></canvas></div>
          </div>
          <div class="chart-container" id="chart-instrument-wrap">
            <div class="chart-header">
              <span class="chart-title">P&L by Instrument</span>
            </div>
            <div class="chart-canvas-wrap"><canvas id="chart-instrument"></canvas></div>
          </div>
          <div class="chart-container" id="chart-session-wrap">
            <div class="chart-header">
              <span class="chart-title">P&L by Session</span>
            </div>
            <div class="chart-canvas-wrap"><canvas id="chart-session"></canvas></div>
          </div>
        </div>
      </div>
    `;

    // Bind events
    container.querySelector('#dash-range-group').addEventListener('click', e => {
      const btn = e.target.closest('.toggle-btn');
      if (!btn) return;
      container.querySelectorAll('#dash-range-group .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter.range = btn.dataset.range;
      updateDashboard(container);
    });

    container.querySelector('#dash-instrument-filter').addEventListener('change', e => {
      currentFilter.instrument = e.target.value;
      updateDashboard(container);
    });

    updateDashboard(container);
  }

  async function updateDashboard(container) {
    const presets = Utils.dateRangePresets();
    const range = presets[currentFilter.range] || presets['All Time'];

    const trades = await Store.filterTrades({
      startDate: range.start,
      endDate: range.end,
      instrument: currentFilter.instrument || undefined,
    });

    const stats = Utils.calcStats(trades);
    renderStats(container.querySelector('#dash-stats'), stats);
    renderCharts(trades, stats);
  }

  function renderStats(el, s) {
    const streakText = s.currentStreak.type === 'win'
      ? `🔥 ${s.currentStreak.count}W streak`
      : s.currentStreak.type === 'loss'
        ? `❄️ ${s.currentStreak.count}L streak`
        : '—';

    el.innerHTML = `
      <div class="stat-card accent">
        <div class="stat-card-label">Total Trades</div>
        <div class="stat-card-value">${s.totalTrades}</div>
        <div class="stat-card-meta">${s.wins}W / ${s.losses}L / ${s.breakeven}BE</div>
      </div>
      <div class="stat-card ${s.winRate >= 50 ? 'profit' : 'loss'}">
        <div class="stat-card-label">Win Rate</div>
        <div class="stat-card-value ${s.winRate >= 50 ? 'text-profit' : 'text-loss'}">${Utils.formatPercent(s.winRate)}</div>
        <div class="stat-card-meta">${s.wins} of ${s.totalTrades} trades</div>
      </div>
      <div class="stat-card ${s.netPnL >= 0 ? 'profit' : 'loss'}">
        <div class="stat-card-label">Net P&L</div>
        <div class="stat-card-value ${Utils.pnlClass(s.netPnL)}">${Utils.formatCurrency(s.netPnL)}</div>
        <div class="stat-card-meta">Fees: ${Utils.formatCurrencyNoSign(s.totalFees)}</div>
      </div>
      <div class="stat-card ${s.avgR >= 0 ? 'profit' : 'loss'}">
        <div class="stat-card-label">Avg R</div>
        <div class="stat-card-value ${Utils.pnlClass(s.avgR)}">${Utils.formatR(s.avgR)}</div>
        <div class="stat-card-meta">Expectancy: ${Utils.formatCurrency(s.expectancy)}</div>
      </div>
      <div class="stat-card ${s.profitFactor >= 1 ? 'profit' : 'loss'}">
        <div class="stat-card-label">Profit Factor</div>
        <div class="stat-card-value ${s.profitFactor >= 1 ? 'text-profit' : 'text-loss'}">${s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)}</div>
        <div class="stat-card-meta">Gross: ${Utils.formatCurrencyNoSign(s.grossProfit)} / ${Utils.formatCurrencyNoSign(s.grossLoss)}</div>
      </div>
      <div class="stat-card profit">
        <div class="stat-card-label">Avg Win</div>
        <div class="stat-card-value text-profit">${Utils.formatCurrency(s.avgWin)}</div>
        <div class="stat-card-meta">Best: ${Utils.formatCurrency(s.bestTrade)}</div>
      </div>
      <div class="stat-card loss">
        <div class="stat-card-label">Avg Loss</div>
        <div class="stat-card-value text-loss">${Utils.formatCurrency(-s.avgLoss)}</div>
        <div class="stat-card-meta">Worst: ${Utils.formatCurrency(s.worstTrade)}</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-card-label">Streak</div>
        <div class="stat-card-value" style="font-size:var(--text-md)">${streakText}</div>
        <div class="stat-card-meta">Max W: ${s.maxConsecWins} / Max L: ${s.maxConsecLosses}</div>
      </div>
    `;
  }

  function renderCharts(trades, stats) {
    // Destroy existing charts
    Object.values(charts).forEach(c => c.destroy());
    charts = {};

    if (trades.length === 0) return;

    // Read colors from CSS vars so charts adapt to dark/light theme
    const cs = getComputedStyle(document.documentElement);
    const cv = (name) => cs.getPropertyValue(name).trim();
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    const chartColors = {
      profit: cv('--color-profit') || '#10b981',
      profitBg: isLight ? 'rgba(13,150,104,0.12)' : 'rgba(16,185,129,0.15)',
      loss: cv('--color-loss') || '#f43f5e',
      lossBg: isLight ? 'rgba(220,38,70,0.12)' : 'rgba(244,63,94,0.15)',
      accent: cv('--color-accent') || '#3b82f6',
      accentBg: 'rgba(59,130,246,0.15)',
      purple: cv('--color-purple') || '#8b5cf6',
      warning: cv('--color-warning') || '#f59e0b',
      gridColor: isLight ? 'rgba(208,215,222,0.6)' : 'rgba(48,54,61,0.5)',
      textColor: cv('--text-secondary') || '#8b949e',
      tooltipBg: cv('--bg-tertiary') || '#1c2128',
      tooltipBorder: cv('--border-primary') || '#30363d',
      cardBg: cv('--bg-secondary') || '#161b22',
    };

    const defaultScaleOpts = {
      grid: { color: chartColors.gridColor, drawBorder: false },
      ticks: { color: chartColors.textColor, font: { family: "'Inter', sans-serif", size: 11 } },
    };

    // 1. Equity Curve
    const cumData = Utils.cumulativePnL(trades);
    charts.equity = new Chart(document.getElementById('chart-equity'), {
      type: 'line',
      data: {
        labels: cumData.map(d => Utils.formatDate(d.date, 'dayMonth')),
        datasets: [{
          label: 'Cumulative P&L',
          data: cumData.map(d => d.cumulative),
          borderColor: chartColors.profit,
          backgroundColor: chartColors.profitBg,
          fill: true,
          tension: 0.3,
          pointRadius: cumData.length > 50 ? 0 : 3,
          pointHoverRadius: 5,
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: chartColors.tooltipBg,
            borderColor: chartColors.tooltipBorder,
            borderWidth: 1,
            titleFont: { family: "'Inter', sans-serif" },
            bodyFont: { family: "'JetBrains Mono', monospace" },
            callbacks: {
              label: ctx => `P&L: ${Utils.formatCurrency(ctx.parsed.y)}`,
            }
          }
        },
        scales: {
          x: { ...defaultScaleOpts, display: true },
          y: {
            ...defaultScaleOpts,
            ticks: {
              ...defaultScaleOpts.ticks,
              callback: val => Utils.formatCurrency(val, 0),
            }
          },
        },
      }
    });

    // 2. Win/Loss Donut
    charts.winloss = new Chart(document.getElementById('chart-winloss'), {
      type: 'doughnut',
      data: {
        labels: ['Wins', 'Losses', 'Breakeven'],
        datasets: [{
          data: [stats.wins, stats.losses, stats.breakeven],
          backgroundColor: [chartColors.profit, chartColors.loss, '#484f58'],
          borderColor: chartColors.cardBg,
          borderWidth: 3,
          hoverOffset: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: chartColors.textColor, font: { family: "'Inter', sans-serif", size: 12 }, padding: 16, usePointStyle: true, pointStyleWidth: 10 },
          },
          tooltip: {
            backgroundColor: '#161b22',
            borderColor: '#30363d',
            borderWidth: 1,
          }
        }
      }
    });

    // 3. R Distribution
    const rs = trades.map(t => parseFloat(t.resultR) || 0).filter(r => !isNaN(r));
    const rBuckets = {};
    rs.forEach(r => {
      const bucket = Math.round(r * 2) / 2; // round to 0.5R
      const key = bucket.toFixed(1) + 'R';
      rBuckets[key] = (rBuckets[key] || 0) + 1;
    });
    const rLabels = Object.keys(rBuckets).sort((a, b) => parseFloat(a) - parseFloat(b));
    const rValues = rLabels.map(k => rBuckets[k]);
    const rColors = rLabels.map(k => parseFloat(k) >= 0 ? chartColors.profit : chartColors.loss);

    charts.rdist = new Chart(document.getElementById('chart-rdist'), {
      type: 'bar',
      data: {
        labels: rLabels,
        datasets: [{
          label: 'Trades',
          data: rValues,
          backgroundColor: rColors.map(c => c + '88'),
          borderColor: rColors,
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder, borderWidth: 1 } },
        scales: {
          x: defaultScaleOpts,
          y: { ...defaultScaleOpts, beginAtZero: true, ticks: { ...defaultScaleOpts.ticks, stepSize: 1 } },
        },
      }
    });

    // 4. P&L by Instrument
    const byInstrument = Utils.groupBy(trades, t => t.instrument || 'Unknown');
    const instrLabels = Object.keys(byInstrument);
    const instrPnL = instrLabels.map(k => byInstrument[k].reduce((s, t) => s + (parseFloat(t.resultMoney) || 0), 0));
    const instrColors = instrPnL.map(v => v >= 0 ? chartColors.profit : chartColors.loss);

    charts.instrument = new Chart(document.getElementById('chart-instrument'), {
      type: 'bar',
      data: {
        labels: instrLabels,
        datasets: [{
          label: 'P&L',
          data: instrPnL,
          backgroundColor: instrColors.map(c => c + '88'),
          borderColor: instrColors,
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#161b22', borderColor: '#30363d', borderWidth: 1,
            callbacks: { label: ctx => Utils.formatCurrency(ctx.parsed.x) }
          }
        },
        scales: {
          x: { ...defaultScaleOpts, ticks: { ...defaultScaleOpts.ticks, callback: v => Utils.formatCurrency(v, 0) } },
          y: defaultScaleOpts,
        },
      }
    });

    // 5. P&L by Session
    const bySession = Utils.groupBy(trades, t => t.session || 'Unknown');
    const sessLabels = Object.keys(bySession);
    const sessPnL = sessLabels.map(k => bySession[k].reduce((s, t) => s + (parseFloat(t.resultMoney) || 0), 0));
    const sessColors = sessPnL.map(v => v >= 0 ? chartColors.profit : chartColors.loss);

    charts.session = new Chart(document.getElementById('chart-session'), {
      type: 'bar',
      data: {
        labels: sessLabels,
        datasets: [{
          label: 'P&L',
          data: sessPnL,
          backgroundColor: sessColors.map(c => c + '88'),
          borderColor: sessColors,
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#161b22', borderColor: '#30363d', borderWidth: 1,
            callbacks: { label: ctx => Utils.formatCurrency(ctx.parsed.y) }
          }
        },
        scales: {
          x: defaultScaleOpts,
          y: { ...defaultScaleOpts, ticks: { ...defaultScaleOpts.ticks, callback: v => Utils.formatCurrency(v, 0) } },
        },
      }
    });
  }

  function destroy() {
    Object.values(charts).forEach(c => c.destroy());
    charts = {};
  }

  return { render, destroy };
})();
