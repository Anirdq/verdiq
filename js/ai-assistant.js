const AIAssistant = (() => {

  let isGenerating = false;

  async function render(container) {
    const settings = await Store.getSettings();
    const hasKey = !!settings.geminiApiKey;

    container.innerHTML = `
      <div class="page-container page-enter" style="max-width: 800px;">
        <div class="page-header">
          <div class="page-header-left">
            <h1 class="page-title">
              <span style="background: linear-gradient(90deg, #8b5cf6, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">AI Coach</span>
            </h1>
            <p class="page-subtitle">Your personal AI trading assistant powered by Gemini.</p>
          </div>
        </div>

        ${!hasKey ? `
          <div class="dashboard-card" style="text-align: center; padding: 40px;">
            <div style="font-size: 40px; margin-bottom: 16px;">🔑</div>
            <h3 style="margin-bottom: 8px;">API Key Required</h3>
            <p style="color: var(--text-muted); margin-bottom: 24px;">Please add your Gemini API Key in Settings to enable the AI Coach.</p>
            <button class="btn btn-primary" onclick="document.querySelector('[data-route=\\'/settings\\']').click()">Go to Settings</button>
          </div>
        ` : `
          <div class="dashboard-card mb-6">
            <h3 class="settings-section-title">Trade Analysis</h3>
            <p class="settings-section-desc">Get personalized insights on your recent trades, identify psychological patterns, and find areas for improvement.</p>
            <div style="margin-top: 16px;">
              <button class="btn btn-primary" id="ai-analyze-btn" style="background: linear-gradient(90deg, #8b5cf6, #ec4899); border: none; color: white;">
                <span class="btn-icon">✨</span> Analyze My Trades
              </button>
            </div>
          </div>

          <div id="ai-response-container" class="dashboard-card hidden" style="position: relative; min-height: 200px;">
            <div id="ai-loading" class="hidden" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-card); border-radius: inherit; z-index: 10;">
              <div class="spinner" style="width: 32px; height: 32px; border: 3px solid var(--border-primary); border-top-color: #8b5cf6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
              <p style="margin-top: 16px; color: var(--text-muted);">Analyzing your trading data...</p>
            </div>
            
            <div class="settings-section-title" style="margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
              <span>🤖</span> AI Insights
            </div>
            <div id="ai-response-content" style="font-size: 14px; line-height: 1.6; color: var(--text-primary); white-space: pre-wrap;"></div>
          </div>
          
          <!-- Simple CSS for spinner animation if not exists -->
          <style>
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            #ai-response-content h1, #ai-response-content h2, #ai-response-content h3 { margin-top: 1.5em; margin-bottom: 0.5em; font-weight: 600; }
            #ai-response-content p { margin-bottom: 1em; }
            #ai-response-content ul, #ai-response-content ol { padding-left: 1.5em; margin-bottom: 1em; }
            #ai-response-content li { margin-bottom: 0.25em; }
            #ai-response-content strong { color: var(--text-highlight, #fff); }
          </style>
        `}
      </div>
    `;

    if (hasKey) {
      bindEvents(container, settings.geminiApiKey);
    }
  }

  function bindEvents(container, apiKey) {
    const analyzeBtn = container.querySelector('#ai-analyze-btn');
    const responseContainer = container.querySelector('#ai-response-container');
    const loadingEl = container.querySelector('#ai-loading');
    const contentEl = container.querySelector('#ai-response-content');

    if (!analyzeBtn) return;

    analyzeBtn.addEventListener('click', async () => {
      if (isGenerating) return;
      
      const trades = await Store.getTrades();
      if (trades.length === 0) {
        App.toast('You need to log some trades first!', 'warning');
        return;
      }

      // Prepare data for AI — limit to last 50 trades to avoid token limits
      const recentTrades = trades.slice(0, 50).map(t => ({
        date: t.date,
        instrument: t.instrument,
        direction: t.direction,
        setup: t.setupName,
        pnl: parseFloat(t.resultMoney) || 0,
        rr: parseFloat(t.resultR) || 0,
        emotions: [t.emotionBefore, t.emotionDuring, t.emotionAfter].filter(Boolean).join(', '),
        mistakes: t.mistakeTags ? t.mistakeTags.join(', ') : '',
        followedPlan: t.ruleFollowed
      }));

      const prompt = `You are an expert trading psychologist and performance analyst. 
Analyze the following recent trades from my trading journal. 
Provide concise, actionable feedback.
Focus on:
1. What I am doing well (Best setups, strongest pairs).
2. What psychological or strategic mistakes I am making (based on mistakes and emotions).
3. A short, punchy 3-step action plan for my next trading session.

Here is the data in JSON format:
${JSON.stringify(recentTrades, null, 2)}`;

      isGenerating = true;
      responseContainer.classList.remove('hidden');
      loadingEl.classList.remove('hidden');
      contentEl.innerHTML = '';
      analyzeBtn.disabled = true;

      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7 }
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error?.message || 'Failed to fetch AI response');
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
        
        // Simple markdown parsing for the output
        let htmlContent = text
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/^### (.*$)/gim, '<h3>$1</h3>')
          .replace(/^## (.*$)/gim, '<h2>$1</h2>')
          .replace(/^# (.*$)/gim, '<h1>$1</h1>')
          .replace(/^\* (.*$)/gim, '<ul><li>$1</li></ul>')
          .replace(/<\/ul>\n<ul>/g, '\n')
          .replace(/\n/g, '<br>');

        contentEl.innerHTML = htmlContent;
      } catch (err) {
        App.toast(err.message, 'error');
        contentEl.innerHTML = `<span class="text-loss">Error: ${err.message}</span>`;
      } finally {
        isGenerating = false;
        loadingEl.classList.add('hidden');
        analyzeBtn.disabled = false;
      }
    });
  }

  function destroy() {
    isGenerating = false;
  }

  return { render, destroy };
})();
