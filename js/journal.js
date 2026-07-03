/* ============================================================
   Trade Journal — Daily Journal
   Daily reflections and market observations
   ============================================================ */

const Journal = (() => {

  let selectedDate = null;

  const MOODS = [
    { emoji: '🔥', label: 'Great' },
    { emoji: '😊', label: 'Good' },
    { emoji: '😐', label: 'Neutral' },
    { emoji: '😕', label: 'Off' },
    { emoji: '😤', label: 'Bad' },
  ];

  async function render(container) {
    // Check if coming from calendar with a date
    const hash = window.location.hash;
    const dateMatch = hash.match(/date=(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      selectedDate = dateMatch[1];
    } else if (!selectedDate) {
      selectedDate = Utils.todayISO();
    }

    container.innerHTML = `
      <div class="page-container page-enter">
        <div class="page-header">
          <div class="page-header-left">
            <h1 class="page-title">Journal</h1>
            <p class="page-subtitle">Daily reflections and market observations</p>
          </div>
          <div class="page-header-actions">
            <button class="btn btn-primary" id="jrn-new">+ Today's Entry</button>
          </div>
        </div>

        <div class="journal-layout">
          <div class="journal-list" id="jrn-list"></div>
          <div class="journal-editor" id="jrn-editor"></div>
        </div>
      </div>
    `;

    container.querySelector('#jrn-new').addEventListener('click', async () => {
      selectedDate = Utils.todayISO();
      await renderEditor(container);
      await renderList(container);
    });

    await renderList(container);
    await renderEditor(container);
  }

  async function renderList(container) {
    const listEl = container.querySelector('#jrn-list');
    const entries = await Store.getJournalEntries();

    let html = `
      <div class="journal-list-header">
        <span class="text-sm font-semibold">Entries</span>
        <span class="text-xs text-muted">${entries.length}</span>
      </div>
      <div class="journal-list-items">
    `;

    if (entries.length === 0) {
      html += `<div class="p-4 text-center text-sm text-muted">No journal entries yet</div>`;
    }

    entries.forEach(entry => {
      const isActive = selectedDate === entry.date;
      const mood = MOODS.find(m => m.label === entry.mood);
      html += `
        <div class="journal-list-item ${isActive ? 'active' : ''}" data-date="${entry.date}">
          <div class="journal-list-date">${Utils.formatDate(entry.date, 'short')}</div>
          <div class="journal-list-preview">${Utils.escapeHTML((entry.content || '').slice(0, 80))}</div>
          ${mood ? `<div class="journal-list-mood">${mood.emoji} ${mood.label}</div>` : ''}
        </div>
      `;
    });

    html += `</div>`;
    listEl.innerHTML = html;

    // Bind clicks
    listEl.querySelectorAll('.journal-list-item').forEach(item => {
      item.addEventListener('click', async () => {
        selectedDate = item.dataset.date;
        await renderList(container);
        await renderEditor(container);
      });
    });
  }

  async function renderEditor(container) {
    const editorEl = container.querySelector('#jrn-editor');
    const existingEntry = await Store.getJournalByDate(selectedDate);
    const entry = existingEntry || { date: selectedDate, content: '', mood: '' };

    // Get trades for this date
    const allTrades = await Store.getTrades();
    const dayTrades = allTrades.filter(t => t.date.slice(0, 10) === selectedDate);
    const dayPnL = dayTrades.reduce((s, t) => s + (parseFloat(t.resultMoney) || 0), 0);

    let html = `
      <div class="flex justify-between items-center mb-4">
        <div>
          <div class="journal-editor-date">${Utils.formatDate(selectedDate, 'long')}</div>
          ${dayTrades.length > 0 ? `
            <div class="text-sm text-secondary">
              ${dayTrades.length} trade${dayTrades.length !== 1 ? 's' : ''} · 
              <span class="${Utils.pnlClass(dayPnL)} font-mono font-semibold">${Utils.formatCurrency(dayPnL)}</span>
            </div>
          ` : '<div class="text-sm text-muted">No trades this day</div>'}
        </div>
        <button class="btn btn-danger btn-sm" id="jrn-delete" ${!existingEntry ? 'disabled' : ''}>Delete</button>
      </div>

      <div class="form-group mb-4">
        <label class="form-label">How was your day?</label>
        <div class="journal-mood-select" id="jrn-mood">
          ${MOODS.map(m => `
            <div class="mood-option ${entry.mood === m.label ? 'selected' : ''}" data-mood="${m.label}">
              <span class="mood-emoji">${m.emoji}</span>
              <span>${m.label}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Reflections & Observations</label>
        <textarea class="form-textarea" id="jrn-content" rows="12" placeholder="What did you observe in the markets today? What went well? What could you improve? Any lessons learned?">${Utils.escapeHTML(entry.content || '')}</textarea>
      </div>

      <div class="flex justify-end gap-3 mt-4">
        <button class="btn btn-primary" id="jrn-save">💾 Save Entry</button>
      </div>
    `;

    editorEl.innerHTML = html;

    // Mood selection
    editorEl.querySelector('#jrn-mood').addEventListener('click', e => {
      const opt = e.target.closest('.mood-option');
      if (!opt) return;
      editorEl.querySelectorAll('.mood-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });

    // Save
    editorEl.querySelector('#jrn-save').addEventListener('click', async () => {
      const selectedMood = editorEl.querySelector('.mood-option.selected');
      await Store.saveJournalEntry({
        date: selectedDate,
        content: editorEl.querySelector('#jrn-content').value,
        mood: selectedMood ? selectedMood.dataset.mood : '',
      });
      App.toast('Journal entry saved ✓', 'success');
      await renderList(container);
    });

    // Delete
    editorEl.querySelector('#jrn-delete').addEventListener('click', async () => {
      if (confirm('Delete this journal entry?')) {
        await Store.deleteJournalEntry(selectedDate);
        App.toast('Journal entry deleted', 'info');
        selectedDate = Utils.todayISO();
        await renderList(container);
        await renderEditor(container);
      }
    });

    // Auto-save (debounced)
    const autoSave = Utils.debounce(async () => {
      const selectedMood = editorEl.querySelector('.mood-option.selected');
      const content = editorEl.querySelector('#jrn-content').value;
      if (content.trim()) {
        await Store.saveJournalEntry({
          date: selectedDate,
          content,
          mood: selectedMood ? selectedMood.dataset.mood : '',
        });
        await renderList(container);
      }
    }, 2000);

    editorEl.querySelector('#jrn-content').addEventListener('input', autoSave);
  }

  function destroy() {}

  return { render, destroy };
})();
