/* ============================================================
   Trade Journal — App Shell
   Router, navigation, toasts, initialization
   ============================================================ */

const App = (() => {

  let currentPage = null;

  const routes = {
    '/dashboard': { module: () => Dashboard, title: 'Dashboard' },
    '/insights': { module: () => Insights, title: 'Insights' },
    '/new-trade': { module: () => TradeForm, title: 'New Trade' },
    '/trades': { module: () => TradeList, title: 'Trade Log' },
    '/calendar': { module: () => Calendar, title: 'Calendar' },
    '/journal': { module: () => Journal, title: 'Journal' },
    '/calculator': { module: () => Calculator, title: 'Position Calculator' },
    '/settings': { module: () => Settings, title: 'Settings' },
  };

  function init() {
    initTheme();
    initAuth();
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('Service Worker registration failed:', err);
      });
    }
  }

  let authEventsBound = false;

  // ==========================================
  // HARDCODE YOUR SUPABASE CREDENTIALS HERE
  // ==========================================
  const SUPABASE_URL = 'https://cphfylbrlkqywfelrvgm.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwaGZ5bGJybGtxeXdmZWxydmdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNzI0MzksImV4cCI6MjA5ODY0ODQzOX0.u_nlNhmTVQpuVExasu03SDsPi8S_di3f-YodbolV65M';
  // ==========================================

  // ---- Auth & Supabase system ----
  async function initAuth() {
    const url = SUPABASE_URL || localStorage.getItem('tj_sb_url');
    const key = SUPABASE_KEY || localStorage.getItem('tj_sb_key');

    if (!authEventsBound) {
      bindAuthEvents();
      authEventsBound = true;
    }

    if (url && key) {
      // Initialize Supabase client
      try {
        window.supabaseClient = supabase.createClient(url, key);
      } catch (e) {
        toast('Invalid Supabase URL or Key format.', 'error');
        showAuth('config');
        return;
      }

      try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();

        if (session) {
          // Logged in
          hideAuth();
          startApp();
        } else {
          // Needs login
          showAuth('login');
        }

        // Listen for auth changes
        window.supabaseClient.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_OUT') {
            showAuth('login');
          } else if (event === 'SIGNED_IN') {
            hideAuth();
            startApp();
          }
        });
      } catch (e) {
        toast('Failed to connect to Supabase. Check URL/Key.', 'error');
        showAuth('config');
      }
    } else {
      // Needs configuration
      showAuth('config');
    }
  }

  async function startApp() {
    await Store.fetchCloudData();
    Store.processSyncQueue();
    renderShell();
    window.addEventListener('hashchange', () => navigate());
    navigate();
  }

  function showAuth(view) {
    document.getElementById('auth-overlay').classList.remove('hidden');
    if (view === 'config') {
      document.getElementById('auth-config-section').classList.remove('hidden');
      document.getElementById('auth-login-section').classList.add('hidden');
    } else {
      document.getElementById('auth-config-section').classList.add('hidden');
      document.getElementById('auth-login-section').classList.remove('hidden');
    }
  }

  function hideAuth() {
    document.getElementById('auth-overlay').classList.add('hidden');
  }

  function bindAuthEvents() {
    // Config connect
    document.getElementById('auth-connect-btn').addEventListener('click', () => {
      const url = document.getElementById('auth-supabase-url').value.trim();
      const key = document.getElementById('auth-supabase-key').value.trim();
      if (!url || !key) return toast('Please enter URL and Key', 'error');

      localStorage.setItem('tj_sb_url', url);
      localStorage.setItem('tj_sb_key', key);
      initAuth();
    });

    // Reconnect / Change DB
    document.getElementById('auth-reconnect-btn').addEventListener('click', () => {
      localStorage.removeItem('tj_sb_url');
      localStorage.removeItem('tj_sb_key');
      showAuth('config');
    });

    // Login
    document.getElementById('auth-login-btn').addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      if (!email || !password) return toast('Enter email and password', 'error');

      const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
      if (error) toast(error.message, 'error');
      else toast('Logged in successfully', 'success');
    });

    // Signup
    document.getElementById('auth-signup-btn').addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      if (!email || !password) return toast('Enter email and password', 'error');

      const { error } = await window.supabaseClient.auth.signUp({ email, password });
      if (error) toast(error.message, 'error');
      else toast('Signup successful! Check email or log in.', 'success');
    });
  }

  // ---- Theme system ----
  function initTheme() {
    const saved = localStorage.getItem('tj_theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    }
    // Default is dark (no attribute = :root dark tokens)
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    if (next === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', next);
    }
    localStorage.setItem('tj_theme', next);
    updateThemeToggleUI();
    // Re-render current page to update chart colors
    if (currentPage && currentPage.destroy) currentPage.destroy();
    const contentEl = document.getElementById('main-content');
    if (currentPage && contentEl) currentPage.render(contentEl);
  }

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  }

  function updateThemeToggleUI() {
    const label = document.getElementById('theme-label');
    if (label) {
      label.textContent = getTheme() === 'light' ? 'Light Mode' : 'Dark Mode';
    }
  }

  function renderShell() {
    document.getElementById('app').innerHTML = `
      <nav class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-logo">
            <div class="sidebar-logo-icon">📈</div>
            <div>
              <div class="sidebar-logo-text">Verdiq</div>
              <span class="sidebar-logo-sub">Forex & Futures</span>
            </div>
          </div>
        </div>

        <div class="sidebar-nav">
          <div class="nav-section-label">Overview</div>
          <a class="nav-item" data-route="/dashboard" href="#/dashboard">
            <span class="nav-item-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></span>
            <span>Dashboard</span>
          </a>

          <div class="nav-section-label">Trading</div>
          <a class="nav-item" data-route="/new-trade" href="#/new-trade">
            <span class="nav-item-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg></span>
            <span>New Trade</span>
          </a>
          <a class="nav-item" data-route="/trades" href="#/trades">
            <span class="nav-item-icon"><svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></span>
            <span>Trade Log</span>
            <span class="nav-item-badge" id="nav-trade-count">0</span>
          </a>

          <div class="nav-section-label">Review</div>
          <a class="nav-item" data-route="/insights" href="#/insights">
            <span class="nav-item-icon"><svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg></span>
            <span>Insights</span>
          </a>
          <a class="nav-item" data-route="/calendar" href="#/calendar">
            <span class="nav-item-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
            <span>Calendar</span>
          </a>
          <a class="nav-item" data-route="/journal" href="#/journal">
            <span class="nav-item-icon"><svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></span>
            <span>Journal</span>
          </a>

          <div class="nav-section-label">Tools</div>
          <a class="nav-item" data-route="/calculator" href="#/calculator">
            <span class="nav-item-icon"><svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16.01" y2="14"/><line x1="12" y1="14" x2="12.01" y2="14"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="16" y1="10" x2="16.01" y2="10"/><line x1="12" y1="10" x2="12.01" y2="10"/><line x1="8" y1="10" x2="8.01" y2="10"/><line x1="16" y1="18" x2="16.01" y2="18"/><line x1="12" y1="18" x2="12.01" y2="18"/><line x1="8" y1="18" x2="8.01" y2="18"/></svg></span>
            <span>Calculator</span>
          </a>
        </div>

        <div class="sidebar-footer">
          <div class="theme-toggle" id="theme-toggle">
            <span class="nav-item-icon"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg></span>
            <span class="theme-toggle-label" id="theme-label">${getTheme() === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
            <div class="theme-toggle-track">
              <div class="theme-toggle-icons"><span>🌙</span><span>☀️</span></div>
              <div class="theme-toggle-thumb"></div>
            </div>
          </div>
          <a class="nav-item" data-route="/settings" href="#/settings">
            <span class="nav-item-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
            <span>Settings</span>
          </a>
          <button class="nav-item" id="auth-logout-btn" style="width: 100%; text-align: left; color: var(--color-loss);">
            <span class="nav-item-icon"><svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span>
            <span>Log Out</span>
          </button>
        </div>
      </nav>

      <div class="mobile-overlay" id="mobile-overlay"></div>

      <button class="mobile-nav-toggle" id="mobile-toggle">☰</button>

      <main class="main-content" id="main-content"></main>

      <nav class="mobile-nav" id="mobile-nav">
        <a class="mobile-nav-item" data-route="/dashboard" href="#/dashboard">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          <span>Home</span>
        </a>
        <a class="mobile-nav-item" data-route="/trades" href="#/trades">
          <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          <span>Log</span>
        </a>
        <a class="mobile-nav-item mobile-nav-primary" data-route="/new-trade" href="#/new-trade">
          <div class="mobile-nav-fab">
            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
        </a>
        <a class="mobile-nav-item" data-route="/calculator" href="#/calculator">
          <svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16.01" y2="14"/><line x1="12" y1="14" x2="12.01" y2="14"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="16" y1="10" x2="16.01" y2="10"/><line x1="12" y1="10" x2="12.01" y2="10"/><line x1="8" y1="10" x2="8.01" y2="10"/><line x1="16" y1="18" x2="16.01" y2="18"/><line x1="12" y1="18" x2="12.01" y2="18"/><line x1="8" y1="18" x2="8.01" y2="18"/></svg>
          <span>Calc</span>
        </a>
        <a class="mobile-nav-item" data-route="/settings" href="#/settings">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span>Setup</span>
        </a>
      </nav>

      <div class="toast-container" id="toast-container"></div>
    `;

    // Mobile toggle
    document.getElementById('mobile-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    document.getElementById('mobile-overlay').addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
    });

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Logout
    document.getElementById('auth-logout-btn').addEventListener('click', async () => {
      if (window.supabaseClient) {
        await window.supabaseClient.auth.signOut();
      }
    });

    // Update trade count badge
    updateTradeCount();
    Store.on('trades-changed', updateTradeCount);
  }

  async function updateTradeCount() {
    const badge = document.getElementById('nav-trade-count');
    if (badge) {
      const trades = await Store.getTrades();
      badge.textContent = trades.length;
    }
  }

  function navigate() {
    const hash = window.location.hash.slice(1) || '/dashboard';
    const path = hash.split('?')[0]; // strip query params

    // Handle edit-trade route
    let routePath = path;
    let tradeId = null;
    if (path.startsWith('/edit-trade/')) {
      tradeId = path.replace('/edit-trade/', '');
      routePath = '/edit-trade';
    }

    const route = routes[routePath] || (routePath === '/edit-trade' ? routes['/new-trade'] : routes['/dashboard']);

    // Destroy current page
    if (currentPage && currentPage.destroy) {
      currentPage.destroy();
    }

    // Update active nav
    document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(item => {
      const itemRoute = item.dataset.route;
      if (!itemRoute) return;
      if (routePath === '/edit-trade' && itemRoute === '/new-trade') {
        item.classList.add('active');
      } else {
        item.classList.toggle('active', itemRoute === routePath);
      }
    });

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');

    // Update title
    document.title = `${route.title} — Verdiq`;

    // Render page
    const contentEl = document.getElementById('main-content');
    const module = route.module();
    currentPage = module;

    if (tradeId) {
      module.render(contentEl, tradeId);
    } else {
      module.render(contentEl);
    }
  }

  // ---- Toast system ----
  function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
      success: '✓',
      error: '✗',
      info: 'ℹ',
      warning: '⚠',
    };

    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-${type}`;
    toastEl.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span>${message}</span>
      <span class="toast-close">&times;</span>
    `;

    container.appendChild(toastEl);

    // Auto remove
    const timer = setTimeout(() => removeToast(toastEl), 4000);

    toastEl.querySelector('.toast-close').addEventListener('click', () => {
      clearTimeout(timer);
      removeToast(toastEl);
    });
  }

  function removeToast(el) {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 250);
  }

  return { init, toast, navigate };
})();

// Boot
document.addEventListener('DOMContentLoaded', App.init);
