const Insights = (() => {
  let chartSetup = null;
  let chartDay = null;

  async function render(container) {
    const trades = await Store.getTrades();
    const settings = await Store.getSettings();

    container.innerHTML = `
      <div class="page-container page-enter">
        <div class="page-header">
          <div class="page-header-left">
            <h1 class="page-title">Insights & Analytics</h1>
            <p class="page-subtitle">Deep dive into your performance and edge.</p>
          </div>
        </div>

        ${trades.length === 0 ? `
          <div style="text-align:center; padding: 40px; color: var(--text-muted)">
            <div style="font-size: 32px; margin-bottom: 16px;">📊</div>
            <p>Log some trades to see your insights.</p>
          </div>
        ` : `
          <div class="dashboard-grid mb-6">
            <div class="dashboard-card stat-card">
              <div class="stat-title">Most Profitable Setup</div>
              <div class="stat-value" id="in-best-setup">...</div>
            </div>
            <div class="dashboard-card stat-card">
              <div class="stat-title">Best Day of Week</div>
              <div class="stat-value" id="in-best-day">...</div>
            </div>
            <div class="dashboard-card stat-card">
              <div class="stat-title">Max Drawdown</div>
              <div class="stat-value text-loss" id="in-max-dd">...</div>
            </div>
            <div class="dashboard-card stat-card">
              <div class="stat-title">Most Common Mistake</div>
              <div class="stat-value text-warning" id="in-worst-mistake" style="color: #fbbf24">...</div>
            </div>
          </div>

          <div class="dashboard-grid">
            <div class="dashboard-card chart-card">
              <h3 class="settings-section-title" style="margin:0 0 16px 0; font-size:14px;">Performance by Setup</h3>
              <div class="chart-container" style="height: 250px;">
                <canvas id="chart-setup"></canvas>
              </div>
            </div>

            <div class="dashboard-card chart-card">
              <h3 class="settings-section-title" style="margin:0 0 16px 0; font-size:14px;">Win Rate by Day of Week</h3>
              <div class="chart-container" style="height: 250px;">
                <canvas id="chart-day"></canvas>
              </div>
            </div>
          </div>
        `}
      </div>
    `;

    if (trades.length > 0) {
      calculateInsights(trades, settings);
    }
  }

  function calculateInsights(trades, settings) {
    // Basic calcs
    let peakEquity = settings.accountBalance || 0;
    let currentEquity = peakEquity;
    let maxDrawdown = 0;

    const setupPnL = {};
    const dayStats = { 0: {w:0, l:0}, 1: {w:0, l:0}, 2: {w:0, l:0}, 3: {w:0, l:0}, 4: {w:0, l:0}, 5: {w:0, l:0}, 6: {w:0, l:0} };
    const mistakeCounts = {};

    // Sort ascending for equity curve DD
    const ascTrades = [...trades].sort((a,b) => new Date(a.date) - new Date(b.date));

    ascTrades.forEach(t => {
      const pnl = parseFloat(t.resultMoney) || 0;
      
      // Equity & Drawdown
      currentEquity += pnl;
      if (currentEquity > peakEquity) peakEquity = currentEquity;
      const dd = peakEquity - currentEquity;
      if (dd > maxDrawdown) maxDrawdown = dd;

      // Setups
      const setup = t.setupName || 'None';
      setupPnL[setup] = (setupPnL[setup] || 0) + pnl;

      // Days (0 = Sunday, 1 = Monday...)
      const dayIndex = new Date(t.date).getDay();
      if (pnl > 0) dayStats[dayIndex].w++;
      else if (pnl < 0) dayStats[dayIndex].l++;

      // Mistakes
      if (t.mistakeTags && t.mistakeTags.length) {
        t.mistakeTags.forEach(m => {
          mistakeCounts[m] = (mistakeCounts[m] || 0) + 1;
        });
      }
    });

    // Best Setup
    let bestSetup = 'None';
    let bestSetupPnL = -Infinity;
    for (const [s, pnl] of Object.entries(setupPnL)) {
      if (pnl > bestSetupPnL) { bestSetupPnL = pnl; bestSetup = s; }
    }
    document.getElementById('in-best-setup').textContent = bestSetupPnL > 0 ? bestSetup : 'None yet';

    // Best Day
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let bestDay = 'None';
    let bestDayWr = -1;
    for (let i = 0; i < 7; i++) {
      const total = dayStats[i].w + dayStats[i].l;
      if (total > 0) {
        const wr = dayStats[i].w / total;
        if (wr > bestDayWr) { bestDayWr = wr; bestDay = dayNames[i]; }
      }
    }
    document.getElementById('in-best-day').textContent = bestDayWr >= 0 ? `${bestDay} (${(bestDayWr*100).toFixed(0)}%)` : 'None yet';

    // Max Drawdown
    document.getElementById('in-max-dd').textContent = '-' + Utils.formatCurrency(maxDrawdown);

    // Worst Mistake
    let worstMistake = 'None';
    let worstMistakeCount = 0;
    for (const [m, c] of Object.entries(mistakeCounts)) {
      if (c > worstMistakeCount) { worstMistakeCount = c; worstMistake = m; }
    }
    document.getElementById('in-worst-mistake').textContent = worstMistakeCount > 0 ? worstMistake : 'None';

    // Render Charts
    renderCharts(setupPnL, dayStats, dayNames);
  }

  function renderCharts(setupPnL, dayStats, dayNames) {
    const rootStyle = getComputedStyle(document.documentElement);
    const colorProfit = rootStyle.getPropertyValue('--color-profit').trim() || '#10b981';
    const colorLoss = rootStyle.getPropertyValue('--color-loss').trim() || '#f43f5e';
    const colorText = rootStyle.getPropertyValue('--text-secondary').trim() || '#8b949e';
    const colorGrid = rootStyle.getPropertyValue('--border-primary').trim() || '#30363d';

    Chart.defaults.color = colorText;
    Chart.defaults.font.family = rootStyle.getPropertyValue('--font-body').trim() || 'Inter, sans-serif';

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false, drawBorder: false } },
        y: { grid: { color: colorGrid, drawBorder: false } }
      }
    };

    // Setup Chart
    const setupLabels = Object.keys(setupPnL);
    const setupData = Object.values(setupPnL);
    const setupColors = setupData.map(v => v >= 0 ? colorProfit : colorLoss);

    const ctxSetup = document.getElementById('chart-setup').getContext('2d');
    chartSetup = new Chart(ctxSetup, {
      type: 'bar',
      data: {
        labels: setupLabels,
        datasets: [{
          data: setupData,
          backgroundColor: setupColors,
          borderRadius: 4
        }]
      },
      options: commonOptions
    });

    // Day Chart (Win Rate)
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const dayWrData = [1, 2, 3, 4, 5].map(i => {
      const total = dayStats[i].w + dayStats[i].l;
      return total > 0 ? (dayStats[i].w / total) * 100 : 0;
    });

    const ctxDay = document.getElementById('chart-day').getContext('2d');
    chartDay = new Chart(ctxDay, {
      type: 'bar',
      data: {
        labels: dayLabels,
        datasets: [{
          data: dayWrData,
          backgroundColor: '#8b5cf6',
          borderRadius: 4
        }]
      },
      options: {
        ...commonOptions,
        scales: {
          x: { grid: { display: false, drawBorder: false } },
          y: { 
            grid: { color: colorGrid, drawBorder: false },
            min: 0, max: 100,
            ticks: { callback: v => v + '%' }
          }
        }
      }
    });
  }

  function destroy() {
    if (chartSetup) chartSetup.destroy();
    if (chartDay) chartDay.destroy();
  }

  return { render, destroy };
})();
