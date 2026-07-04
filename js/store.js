/* ============================================================
   Trade Journal — Data Store (Supabase + IndexedDB Sync)
   Offline-first architecture with aggressive local caching
   ============================================================ */

const Store = (() => {

  // ---- Simple event system ----
  const _listeners = {};
  function on(event, fn) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(fn);
  }
  function off(event, fn) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(f => f !== fn);
  }
  function emit(event, data) {
    if (_listeners[event]) _listeners[event].forEach(fn => fn(data));
  }

  // ---- IndexedDB Wrapper ----
  const DB_NAME = 'tj_database';
  const DB_VERSION = 1;
  let dbPromise = null;

  function initDB() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = e => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('trades')) db.createObjectStore('trades', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('journal')) db.createObjectStore('journal', { keyPath: 'date' });
          if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('sync_queue')) db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  async function idbGet(storeName, key) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = key ? tx.objectStore(storeName).get(key) : tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbPut(storeName, val) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(val);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbDelete(storeName, key) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      if (key) tx.objectStore(storeName).delete(key);
      else tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---- Offline Sync Queue ----
  async function queueSync(action, table, data) {
    await idbPut('sync_queue', { action, table, data, timestamp: Date.now() });
    if (navigator.onLine) {
      processSyncQueue();
    }
  }

  window.addEventListener('online', processSyncQueue);

  let isSyncing = false;
  async function processSyncQueue() {
    if (!window.supabaseClient || isSyncing || !navigator.onLine) return;
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) return;

    isSyncing = true;
    try {
      const queue = await idbGet('sync_queue');
      for (const item of queue) {
        let success = false;
        const sb = window.supabaseClient;

        // Image upload interception for trades
        if (item.table === 'trades' && (item.action === 'insert' || item.action === 'update')) {
          item.data.screenshot_before = await uploadScreenshot(item.data.screenshotBefore, item.data.id, 'before');
          item.data.screenshot_after = await uploadScreenshot(item.data.screenshotAfter, item.data.id, 'after');
          
          // Map JS camelCase to Postgres snake_case
          item.data = {
            id: item.data.id,
            date: item.data.date,
            session: item.data.session,
            instrument: item.data.instrument,
            direction: item.data.direction,
            timeframe: item.data.timeframe,
            setup_name: item.data.setupName,
            entry_price: item.data.entryPrice,
            stop_price: item.data.stopPrice,
            target_price: item.data.targetPrice,
            exit_price: item.data.exitPrice,
            quantity: item.data.quantity,
            risk_money: item.data.riskMoney,
            planned_rr: item.data.plannedRR,
            result_money: item.data.resultMoney,
            result_r: item.data.resultR,
            fees: item.data.fees,
            screenshot_before: item.data.screenshot_before,
            screenshot_after: item.data.screenshot_after,
            rule_followed: item.data.ruleFollowed,
            emotion_before: item.data.emotionBefore,
            emotion_during: item.data.emotionDuring,
            emotion_after: item.data.emotionAfter,
            mistake_tags: item.data.mistakeTags,
            review_note: item.data.reviewNote,
            user_id: session.user.id
          };
        }

        // Journal mapping
        if (item.table === 'journal_entries') {
          item.data.user_id = session.user.id;
        }

        // Settings mapping
        if (item.table === 'user_settings') {
          // Map only columns that exist in the Supabase schema
          item.data = {
            user_id: session.user.id,
            instruments: item.data.instruments,
            sessions: item.data.sessions,
            setup_names: item.data.setupNames,
            emotions: item.data.emotions,
            mistake_tags: item.data.mistakeTags,
            updated_at: new Date().toISOString()
          };
        }

        if (item.action === 'insert' || item.action === 'update') {
          const { error } = await sb.from(item.table).upsert(item.data);
          if (!error) success = true;
          else console.error('Sync error:', error);
        } else if (item.action === 'delete') {
          const { error } = await sb.from(item.table).delete().eq(item.table === 'journal_entries' ? 'date' : 'id', item.data.id);
          if (!error) success = true;
          else console.error('Sync error:', error);
        }

        if (success) {
          await idbDelete('sync_queue', item.id);
        } else {
          // If a sync fails, delete it to prevent blocking the queue forever.
          // In a production app with critical data, we would implement retry logic or a dead-letter queue.
          await idbDelete('sync_queue', item.id);
        }
      }
    } finally {
      isSyncing = false;
    }
  }

  // Helper to compress and upload base64 image to Supabase Storage
  async function uploadScreenshot(base64Data, tradeId, suffix) {
    if (!base64Data || !base64Data.startsWith('data:image')) return base64Data; // already a URL or empty
    try {
      const res = await fetch(base64Data);
      const blob = await res.blob();
      const fileName = `${tradeId}_${suffix}.webp`;
      const { data, error } = await window.supabaseClient.storage
        .from('screenshots')
        .upload(`${window.supabaseClient.auth.user()?.id}/${fileName}`, blob, { upsert: true, contentType: 'image/webp' });
      
      if (error) throw error;
      
      // Get public URL
      const { data: urlData } = window.supabaseClient.storage.from('screenshots').getPublicUrl(data.path);
      return urlData.publicUrl;
    } catch (e) {
      console.error('Upload failed, falling back to empty', e);
      return '';
    }
  }

  // ---- Default Settings ----
  const DEFAULT_SETTINGS = {
    id: 'local',
    instruments: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'ES', 'MES', 'NQ', 'MNQ', 'YM', 'MYM', 'CL', 'GC'],
    sessions: ['Asian', 'London', 'New York', 'London/NY Overlap'],
    setupNames: ['Sweep + MSS + FVG', 'BOS + OB', 'Liquidity Grab', 'Breaker Block', 'Range Breakout'],
    timeframes: ['1m', '3m', '5m', '15m', '30m', '1H', '4H', 'D'],
    emotions: ['Confident', 'Calm', 'Focused', 'Neutral', 'Anxious', 'Fearful', 'Greedy', 'Frustrated', 'Excited', 'Bored', 'Impatient', 'Revenge-minded'],
    mistakeTags: ['FOMO', 'Early Entry', 'Late Entry', 'Revenge Trade', 'Oversized', 'Moved Stop', 'Chased', 'No Stop', 'Ignored Plan', 'Overtrading'],
    currency: 'USD',
    accountBalance: 10000,
    defaultRisk: 1,
  };

  // ===== SETTINGS =====
  async function getSettings() {
    let s = await idbGet('settings', 'local');
    if (!s) {
      s = DEFAULT_SETTINGS;
      await idbPut('settings', s);
    }
    return s;
  }

  async function updateSettings(partial) {
    const current = await getSettings();
    const updated = { ...current, ...partial };
    await idbPut('settings', updated);
    queueSync('update', 'user_settings', updated);
    emit('settings-changed', updated);
    return updated;
  }

  // ===== TRADES =====
  async function getTrades() {
    const trades = await idbGet('trades');
    trades.sort((a, b) => new Date(b.date) - new Date(a.date));
    return trades;
  }

  async function getTradeById(id) {
    return await idbGet('trades', id) || null;
  }

  async function addTrade(trade) {
    const newTrade = { ...trade, id: trade.id || Utils.uuid(), createdAt: Utils.nowISO(), updatedAt: Utils.nowISO() };
    await idbPut('trades', newTrade);
    queueSync('insert', 'trades', newTrade);
    emit('trades-changed', await getTrades());
    return newTrade;
  }

  async function updateTrade(id, updates) {
    const existing = await getTradeById(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: Utils.nowISO() };
    await idbPut('trades', updated);
    queueSync('update', 'trades', updated);
    emit('trades-changed', await getTrades());
    return updated;
  }

  async function deleteTrade(id) {
    await idbDelete('trades', id);
    queueSync('delete', 'trades', { id });
    emit('trades-changed', await getTrades());
  }

  async function filterTrades({ startDate, endDate, instrument, session, direction, setup, result, ruleFollowed } = {}) {
    let trades = await getTrades();
    if (startDate) trades = trades.filter(t => t.date >= startDate);
    if (endDate) trades = trades.filter(t => t.date <= endDate + 'T23:59:59');
    if (instrument) trades = trades.filter(t => t.instrument === instrument);
    if (session) trades = trades.filter(t => t.session === session);
    if (direction) trades = trades.filter(t => t.direction === direction);
    if (setup) trades = trades.filter(t => t.setupName === setup);
    if (result === 'win') trades = trades.filter(t => (parseFloat(t.resultMoney) || 0) > 0);
    else if (result === 'loss') trades = trades.filter(t => (parseFloat(t.resultMoney) || 0) < 0);
    else if (result === 'breakeven') trades = trades.filter(t => (parseFloat(t.resultMoney) || 0) === 0);
    if (ruleFollowed === true || ruleFollowed === 'yes') trades = trades.filter(t => t.ruleFollowed === true);
    else if (ruleFollowed === false || ruleFollowed === 'no') trades = trades.filter(t => t.ruleFollowed === false);
    return trades;
  }

  // ===== JOURNAL =====
  async function getJournalEntries() {
    const entries = await idbGet('journal');
    entries.sort((a, b) => b.date.localeCompare(a.date));
    return entries;
  }

  async function getJournalByDate(dateStr) {
    const date = dateStr.slice(0, 10);
    return await idbGet('journal', date) || null;
  }

  async function saveJournalEntry(entry) {
    const date = entry.date.slice(0, 10);
    const existing = await getJournalByDate(date);
    const newEntry = existing 
      ? { ...existing, ...entry, updatedAt: Utils.nowISO() }
      : { ...entry, id: Utils.uuid(), date, createdAt: Utils.nowISO(), updatedAt: Utils.nowISO() };
    
    await idbPut('journal', newEntry);
    queueSync('upsert', 'journal_entries', newEntry);
    emit('journal-changed', await getJournalEntries());
    return newEntry;
  }

  async function deleteJournalEntry(date) {
    const shortDate = date.slice(0, 10);
    await idbDelete('journal', shortDate);
    queueSync('delete', 'journal_entries', { id: shortDate }); // mapped to date in queue processor
    emit('journal-changed', await getJournalEntries());
  }

  // ===== SYNC FROM SUPABASE (Initial Load) =====
  async function fetchCloudData() {
    if (!window.supabaseClient) return;
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) return;

    try {
      // Fetch Settings
      const { data: s } = await window.supabaseClient.from('user_settings').select('*').single();
      let currentLocal = await idbGet('settings', 'local');
      if (!currentLocal) currentLocal = DEFAULT_SETTINGS;
      
      if (s) {
        const localS = {
          ...currentLocal,
          instruments: s.instruments || currentLocal.instruments,
          sessions: s.sessions || currentLocal.sessions,
          setupNames: s.setup_names || currentLocal.setupNames,
          emotions: s.emotions || currentLocal.emotions,
          mistakeTags: s.mistake_tags || currentLocal.mistakeTags
        };
        await idbPut('settings', localS);
        emit('settings-changed', localS);
      }

      // Fetch Trades
      const { data: t } = await window.supabaseClient.from('trades').select('*');
      if (t) {
        await idbDelete('trades');
        for (const row of t) {
          await idbPut('trades', {
            id: row.id,
            date: row.date,
            session: row.session,
            instrument: row.instrument,
            direction: row.direction,
            timeframe: row.timeframe,
            setupName: row.setup_name,
            entryPrice: row.entry_price,
            stopPrice: row.stop_price,
            targetPrice: row.target_price,
            exitPrice: row.exit_price,
            quantity: row.quantity,
            riskMoney: row.risk_money,
            plannedRR: row.planned_rr,
            resultMoney: row.result_money,
            resultR: row.result_r,
            fees: row.fees,
            screenshotBefore: row.screenshot_before,
            screenshotAfter: row.screenshot_after,
            ruleFollowed: row.rule_followed,
            emotionBefore: row.emotion_before,
            emotionDuring: row.emotion_during,
            emotionAfter: row.emotion_after,
            mistakeTags: row.mistake_tags || [],
            reviewNote: row.review_note
          });
        }
        emit('trades-changed', await getTrades());
      }

      // Fetch Journal
      const { data: j } = await window.supabaseClient.from('journal_entries').select('*');
      if (j) {
        await idbDelete('journal');
        for (const row of j) {
          await idbPut('journal', {
            id: row.id,
            date: row.date,
            content: row.content,
            mood: row.mood
          });
        }
        emit('journal-changed', await getJournalEntries());
      }
    } catch (e) {
      console.error('Initial sync failed, using offline cache', e);
    }
  }

  function clearAll() {
    idbDelete('trades');
    idbDelete('journal');
    idbDelete('settings');
    idbDelete('sync_queue');
    if (window.supabaseClient) window.supabaseClient.auth.signOut();
    emit('trades-changed', []);
    emit('journal-changed', []);
  }

  // No-ops for import/export since we are moving to Cloud Sync
  function exportAll() { alert('Exports are handled via Supabase dashboard now.'); }
  function importJSON() { alert('Imports are handled via Supabase dashboard now.'); }
  function importCSV() { alert('Imports are handled via Supabase dashboard now.'); }

  return {
    on, off, emit,
    getSettings, updateSettings,
    getTrades, getTradeById, addTrade, updateTrade, deleteTrade, filterTrades,
    getJournalEntries, getJournalByDate, saveJournalEntry, deleteJournalEntry,
    fetchCloudData, processSyncQueue, clearAll,
    exportAll, importJSON, importCSV,
    DEFAULT_SETTINGS,
  };
})();
