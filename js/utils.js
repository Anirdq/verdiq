/* ============================================================
   Trade Journal — Utility Functions
   Date formatting, calculations, statistics helpers
   ============================================================ */

const Utils = (() => {

  // ---- Date helpers ----

  function formatDate(dateStr, format = 'short') {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const opts = {
      short: { month: 'short', day: 'numeric', year: 'numeric' },
      long: { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' },
      iso: null,
      time: { hour: '2-digit', minute: '2-digit', hour12: true },
      full: { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' },
      monthYear: { month: 'long', year: 'numeric' },
      dayMonth: { month: 'short', day: 'numeric' },
    };
    if (format === 'iso') return d.toISOString().slice(0, 10);
    return d.toLocaleDateString('en-US', opts[format] || opts.short);
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function getStartOfDay(dateStr) {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getEndOfDay(dateStr) {
    const d = new Date(dateStr);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  function getDayOfWeek(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
  }

  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay(); // 0 = Sun
  }

  function isToday(dateStr) {
    return new Date(dateStr).toDateString() === new Date().toDateString();
  }

  function isSameDay(d1, d2) {
    return new Date(d1).toDateString() === new Date(d2).toDateString();
  }

  function dateRangePresets() {
    const now = new Date();
    const today = todayISO();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    return {
      'This Week': { start: startOfWeek.toISOString().slice(0, 10), end: today },
      'This Month': { start: startOfMonth.toISOString().slice(0, 10), end: today },
      'This Quarter': { start: startOfQuarter.toISOString().slice(0, 10), end: today },
      'This Year': { start: startOfYear.toISOString().slice(0, 10), end: today },
      'All Time': { start: '2000-01-01', end: today },
    };
  }

  // ---- Number formatting ----

  function formatCurrency(val, decimals = 2) {
    if (val == null || isNaN(val)) return '$0.00';
    const sign = val >= 0 ? '+' : '';
    return sign + '$' + Math.abs(val).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function formatCurrencyNoSign(val, decimals = 2) {
    if (val == null || isNaN(val)) return '$0.00';
    return '$' + Math.abs(val).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function formatPercent(val, decimals = 1) {
    if (val == null || isNaN(val)) return '0%';
    return val.toFixed(decimals) + '%';
  }

  function formatR(val) {
    if (val == null || isNaN(val)) return '0R';
    const sign = val >= 0 ? '+' : '';
    return sign + val.toFixed(2) + 'R';
  }

  function formatNumber(val, decimals = 2) {
    if (val == null || isNaN(val)) return '0';
    return parseFloat(val).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  }

  // ---- Trade calculations ----

  function calcPnL(entry, exit, quantity, direction, fees = 0) {
    if (!entry || !exit || !quantity) return null;
    const diff = direction === 'Long' ? (exit - entry) : (entry - exit);
    return (diff * quantity) - (fees || 0);
  }

  function calcRR(entry, stop, target) {
    if (!entry || !stop || !target) return null;
    const risk = Math.abs(entry - stop);
    if (risk === 0) return null;
    const reward = Math.abs(target - entry);
    return reward / risk;
  }

  function calcActualR(entry, exit, stop, direction) {
    if (!entry || !exit || !stop) return null;
    const risk = Math.abs(entry - stop);
    if (risk === 0) return null;
    const pnlPoints = direction === 'Long' ? (exit - entry) : (entry - exit);
    return pnlPoints / risk;
  }

  function calcRiskMoney(entry, stop, quantity) {
    if (!entry || !stop || !quantity) return null;
    return Math.abs(entry - stop) * quantity;
  }

  // ---- Statistics ----

  function calcStats(trades) {
    if (!trades || trades.length === 0) {
      return {
        totalTrades: 0, wins: 0, losses: 0, breakeven: 0,
        winRate: 0, netPnL: 0, grossProfit: 0, grossLoss: 0,
        avgWin: 0, avgLoss: 0, profitFactor: 0,
        avgR: 0, expectancy: 0,
        bestTrade: 0, worstTrade: 0,
        avgPnL: 0, totalFees: 0,
        maxConsecWins: 0, maxConsecLosses: 0,
        currentStreak: { type: null, count: 0 },
      };
    }

    const pnls = trades.map(t => parseFloat(t.resultMoney) || 0);
    const rs = trades.map(t => parseFloat(t.resultR) || 0);

    const wins = trades.filter(t => (parseFloat(t.resultMoney) || 0) > 0);
    const losses = trades.filter(t => (parseFloat(t.resultMoney) || 0) < 0);
    const breakeven = trades.filter(t => (parseFloat(t.resultMoney) || 0) === 0);

    const grossProfit = wins.reduce((s, t) => s + (parseFloat(t.resultMoney) || 0), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + (parseFloat(t.resultMoney) || 0), 0));

    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;

    const netPnL = pnls.reduce((s, v) => s + v, 0);
    const totalFees = trades.reduce((s, t) => s + (parseFloat(t.fees) || 0), 0);
    const avgR = rs.length > 0 ? rs.reduce((s, v) => s + v, 0) / rs.length : 0;

    // Streaks
    let maxConsecWins = 0, maxConsecLosses = 0;
    let curWinStreak = 0, curLossStreak = 0;
    let currentStreak = { type: null, count: 0 };

    // Sort by date for streak calc
    const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
    for (const t of sorted) {
      const pnl = parseFloat(t.resultMoney) || 0;
      if (pnl > 0) {
        curWinStreak++;
        curLossStreak = 0;
        maxConsecWins = Math.max(maxConsecWins, curWinStreak);
        currentStreak = { type: 'win', count: curWinStreak };
      } else if (pnl < 0) {
        curLossStreak++;
        curWinStreak = 0;
        maxConsecLosses = Math.max(maxConsecLosses, curLossStreak);
        currentStreak = { type: 'loss', count: curLossStreak };
      } else {
        curWinStreak = 0;
        curLossStreak = 0;
        currentStreak = { type: 'breakeven', count: 0 };
      }
    }

    return {
      totalTrades: trades.length,
      wins: wins.length,
      losses: losses.length,
      breakeven: breakeven.length,
      winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
      netPnL,
      grossProfit,
      grossLoss,
      avgWin,
      avgLoss,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      avgR,
      expectancy: trades.length > 0 ? netPnL / trades.length : 0,
      bestTrade: pnls.length > 0 ? Math.max(...pnls) : 0,
      worstTrade: pnls.length > 0 ? Math.min(...pnls) : 0,
      avgPnL: pnls.length > 0 ? netPnL / pnls.length : 0,
      totalFees,
      maxConsecWins,
      maxConsecLosses,
      currentStreak,
    };
  }

  // ---- Grouping / Aggregation ----

  function groupBy(items, keyFn) {
    const groups = {};
    for (const item of items) {
      const key = keyFn(item);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }

  function groupByDate(trades) {
    return groupBy(trades, t => t.date.slice(0, 10));
  }

  function cumulativePnL(trades) {
    const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
    let cum = 0;
    return sorted.map(t => {
      cum += (parseFloat(t.resultMoney) || 0);
      return { date: t.date, pnl: parseFloat(t.resultMoney) || 0, cumulative: cum, trade: t };
    });
  }

  // ---- UUID generator ----

  function uuid() {
    return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
      Math.floor(Math.random() * 16).toString(16)
    );
  }

  // ---- Misc ----

  function debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function pnlClass(val) {
    const n = parseFloat(val) || 0;
    if (n > 0) return 'text-profit';
    if (n < 0) return 'text-loss';
    return 'text-muted';
  }

  function pnlSign(val) {
    const n = parseFloat(val) || 0;
    return n > 0 ? '+' : n < 0 ? '' : '';
  }

  // Resize image to fit within maxDim and compress to JPEG for localStorage
  function resizeImage(file, maxDim = 800) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) { h = (h / w) * maxDim; w = maxDim; }
            else { w = (w / h) * maxDim; h = maxDim; }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  return {
    formatDate, todayISO, nowISO, getStartOfDay, getEndOfDay,
    getDayOfWeek, getDaysInMonth, getFirstDayOfMonth,
    isToday, isSameDay, dateRangePresets,
    formatCurrency, formatCurrencyNoSign, formatPercent, formatR, formatNumber,
    calcPnL, calcRR, calcActualR, calcRiskMoney,
    calcStats, groupBy, groupByDate, cumulativePnL,
    uuid, debounce, escapeHTML, pnlClass, pnlSign,
    resizeImage,
  };
})();
