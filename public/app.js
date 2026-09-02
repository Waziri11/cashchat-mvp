document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const chatMessages = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const userIdInput = document.getElementById('userIdInput');
  const toggleLedgerBtn = document.getElementById('toggleLedgerBtn');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');
  const ledgerSidebar = document.getElementById('ledgerSidebar');
  const resetBtn = document.getElementById('resetBtn');
  const voiceRecordBtn = document.getElementById('voiceRecordBtn');
  const voiceBanner = document.getElementById('voiceBanner');
  const voiceStatus = document.getElementById('voiceStatus');
  const cancelVoiceBtn = document.getElementById('cancelVoiceBtn');
  const botStatusText = document.getElementById('botStatusText');

  // Dashboard Stats Elements
  const netBalanceDisplay = document.getElementById('netBalanceDisplay');
  const cashInDisplay = document.getElementById('cashInDisplay');
  const cashOutDisplay = document.getElementById('cashOutDisplay');
  const debtsList = document.getElementById('debtsList');
  const debtCountBadge = document.getElementById('debtCountBadge');
  const transactionsList = document.getElementById('transactionsList');
  const transCountBadge = document.getElementById('transCountBadge');

  // State
  let currentUserId = localStorage.getItem('cashchat_user_id') || userIdInput.value || 'demo_merchant_01';
  userIdInput.value = currentUserId;
  let recognition = null;
  let isRecording = false;

  // Initialize Speech Recognition if supported
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isRecording = true;
      voiceRecordBtn.classList.add('recording');
      voiceBanner.style.display = 'flex';
      voiceStatus.textContent = 'Listening... Speak your transaction or query';
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      messageInput.value = transcript;
      autoResizeTextarea();
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      stopRecording();
    };

    recognition.onend = () => {
      stopRecording();
      if (messageInput.value.trim().length > 0) {
        // Auto-submit after speech ends
        sendMessage(messageInput.value.trim());
        messageInput.value = '';
        autoResizeTextarea();
      }
    };
  } else {
    voiceRecordBtn.style.display = 'none';
  }

  function startRecording() {
    if (recognition && !isRecording) {
      try {
        recognition.start();
      } catch (e) {
        console.error('Error starting speech recognition:', e);
      }
    }
  }

  function stopRecording() {
    if (recognition && isRecording) {
      isRecording = false;
      try {
        recognition.stop();
      } catch (e) {}
    }
    voiceRecordBtn.classList.remove('recording');
    voiceBanner.style.display = 'none';
  }

  voiceRecordBtn.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  cancelVoiceBtn.addEventListener('click', () => {
    stopRecording();
    messageInput.value = '';
  });

  // User ID Change Listener
  userIdInput.addEventListener('change', () => {
    const val = userIdInput.value.trim();
    if (val) {
      currentUserId = val;
      localStorage.setItem('cashchat_user_id', currentUserId);
      refreshLedger();
    }
  });

  // Sidebar Toggle for Mobile & Desktop
  toggleLedgerBtn.addEventListener('click', () => {
    ledgerSidebar.classList.toggle('open');
  });

  closeSidebarBtn.addEventListener('click', () => {
    ledgerSidebar.classList.remove('open');
  });

  // Auto-resize Textarea
  function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
  }

  messageInput.addEventListener('input', autoResizeTextarea);

  // Keyboard shortcut: Enter to send, Shift+Enter for newline
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit'));
    }
  });

  // Quick Suggestion Chips
  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const text = chip.getAttribute('data-text');
      if (text) {
        sendMessage(text);
      }
    });
  });

  // Chat Form Submit
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;

    sendMessage(text);
    messageInput.value = '';
    autoResizeTextarea();
  });

  // Reset Button
  resetBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear your chat and reset your demo ledger transactions?')) {
      try {
        const res = await fetch('/api/ledger/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUserId })
        });
        const data = await res.json();
        if (data.success) {
          // Clear non-welcome chat messages
          const welcome = chatMessages.querySelector('.welcome-card');
          chatMessages.innerHTML = '';
          if (welcome) chatMessages.appendChild(welcome);

          appendBotMessage({
            reply: "🧹 All transactions and debts for this demo session have been reset successfully.",
            intent: "RESET"
          });

          updateDashboard(data.overview);
        }
      } catch (err) {
        console.error('Failed to reset ledger:', err);
      }
    }
  });

  // Core Send Message
  async function sendMessage(text) {
    appendUserMessage(text);
    const typingIndicator = showTypingIndicator();
    scrollToBottom();

    try {
      botStatusText.textContent = 'Processing with Gemini NLU...';
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          userId: currentUserId
        })
      });

      const data = await response.json();
      removeTypingIndicator(typingIndicator);
      botStatusText.textContent = 'Conversational Cashflow & Ledger Assistant';

      if (data.success) {
        appendBotMessage(data);
        if (data.overview) {
          updateDashboard(data.overview);
        }
      } else {
        appendBotMessage({
          reply: `⚠️ Error: ${data.error || 'Failed to process message'}`,
          intent: 'ERROR'
        });
      }
    } catch (error) {
      removeTypingIndicator(typingIndicator);
      botStatusText.textContent = 'Conversational Cashflow & Ledger Assistant';
      appendBotMessage({
        reply: "⚠️ Network or server error occurred. Please verify the server is running.",
        intent: 'ERROR'
      });
      console.error('Chat Error:', error);
    }

    scrollToBottom();
  }

  // Render User Message
  function appendUserMessage(text) {
    const row = document.createElement('div');
    row.className = 'msg-row user';

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    row.innerHTML = `
      <div class="msg-bubble">
        <div class="msg-body">${escapeHTML(text)}</div>
        <div class="msg-meta">
          <span>${now}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      </div>
    `;

    chatMessages.appendChild(row);
  }

  // Render Bot Message with Rich Cards
  function appendBotMessage(data) {
    const row = document.createElement('div');
    row.className = 'msg-row bot';

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let tagHtml = '';
    let detailCardHtml = '';

    if (data.intent === 'LOG_TRANSACTION') {
      const isIncome = data.parsedData?.transaction_type === 'cash_in';
      tagHtml = `<div class="msg-header-tag ${isIncome ? 'tag-cash_in' : 'tag-cash_out'}">
        ${isIncome ? '🟢 Cash In Recorded' : '🔴 Cash Out Recorded'}
      </div>`;

      if (data.parsedData) {
        detailCardHtml = `
          <div class="msg-detail-card">
            <div>
              <div class="detail-item-label">Amount</div>
              <div class="detail-item-value" style="color: ${isIncome ? '#34d399' : '#f87171'}">$${Number(data.parsedData.amount).toFixed(2)}</div>
            </div>
            <div>
              <div class="detail-item-label">Category</div>
              <div class="detail-item-value">${escapeHTML(data.parsedData.category || 'General')}</div>
            </div>
          </div>
        `;
      }
    } else if (data.intent === 'LOG_DEBT') {
      tagHtml = `<div class="msg-header-tag tag-debt">📌 Debt Logged</div>`;
      if (data.parsedData) {
        detailCardHtml = `
          <div class="msg-detail-card">
            <div>
              <div class="detail-item-label">Customer</div>
              <div class="detail-item-value">${escapeHTML(data.parsedData.customer_name || 'Customer')}</div>
            </div>
            <div>
              <div class="detail-item-label">Amount Owed</div>
              <div class="detail-item-value" style="color: #fbbf24">$${Number(data.parsedData.amount).toFixed(2)}</div>
            </div>
          </div>
        `;
      }
    } else if (data.intent === 'QUERY_BALANCE') {
      tagHtml = `<div class="msg-header-tag tag-balance">📊 Balance Report</div>`;
    } else if (data.intent === 'QUERY_DEBT') {
      tagHtml = `<div class="msg-header-tag tag-debt">👥 Debt Ledger</div>`;
    }

    const formattedReply = formatMarkdown(data.reply || '');

    row.innerHTML = `
      <div class="msg-bubble">
        ${tagHtml}
        <div class="msg-body">${formattedReply}</div>
        ${detailCardHtml}
        <div class="msg-meta">
          <span>${now}</span>
        </div>
      </div>
    `;

    chatMessages.appendChild(row);
  }

  // Typing Indicator Helper
  function showTypingIndicator() {
    const row = document.createElement('div');
    row.className = 'msg-row bot typing-row';
    row.innerHTML = `
      <div class="msg-bubble typing-bubble">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;
    chatMessages.appendChild(row);
    return row;
  }

  function removeTypingIndicator(indicator) {
    if (indicator && indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  }

  // Update Live Dashboard Sidebar
  function updateDashboard(overview) {
    if (!overview) return;

    // Update Balance
    if (overview.balance) {
      const net = overview.balance.netBalance || 0;
      const cashIn = overview.balance.totalCashIn || 0;
      const cashOut = overview.balance.totalCashOut || 0;

      netBalanceDisplay.textContent = `$${net.toFixed(2)}`;
      netBalanceDisplay.className = `net-amount ${net >= 0 ? 'positive' : 'negative'}`;

      cashInDisplay.textContent = `$${cashIn.toFixed(2)}`;
      cashOutDisplay.textContent = `$${cashOut.toFixed(2)}`;
    }

    // Update Debts
    if (overview.debtsList) {
      const activeDebts = overview.debtsList.filter(d => d.status !== 'settled');
      debtCountBadge.textContent = activeDebts.length;

      if (activeDebts.length === 0) {
        debtsList.innerHTML = `<div class="empty-state">No outstanding customer debts.</div>`;
      } else {
        debtsList.innerHTML = activeDebts.map(debt => `
          <div class="debt-card" id="debt-${debt._id}">
            <div class="debt-header">
              <span class="debt-name">👤 ${escapeHTML(debt.customerName)}</span>
              <span class="debt-amount">$${Number(debt.amount).toFixed(2)}</span>
            </div>
            <div class="debt-footer">
              <span>Status: <strong style="color: #fbbf24">${debt.status}</strong></span>
              <button class="btn-settle" onclick="window.settleDebtRecord('${debt._id}')">Mark Settled</button>
            </div>
          </div>
        `).join('');
      }
    }

    // Update Recent Transactions
    if (overview.transactions) {
      transCountBadge.textContent = overview.transactions.length;

      if (overview.transactions.length === 0) {
        transactionsList.innerHTML = `<div class="empty-state">No transactions recorded yet today.</div>`;
      } else {
        transactionsList.innerHTML = overview.transactions.map(t => {
          const isIncome = t.type === 'cash_in';
          return `
            <div class="transaction-item trans-${t.type}">
              <div class="trans-left">
                <div class="trans-icon">${isIncome ? '↓' : '↑'}</div>
                <div>
                  <div class="trans-desc" title="${escapeHTML(t.description)}">${escapeHTML(t.description)}</div>
                  <div class="trans-category">${escapeHTML(t.category)} • ${new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
              <div class="trans-amount">${isIncome ? '+' : '-'}$${Number(t.amount).toFixed(2)}</div>
            </div>
          `;
        }).join('');
      }
    }
  }

  // Settle Debt Function exposed to global window
  window.settleDebtRecord = async (debtId) => {
    try {
      const res = await fetch('/api/ledger/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debtId, userId: currentUserId })
      });
      const data = await res.json();
      if (data.success) {
        appendBotMessage({
          reply: `✅ Debt of $${data.updatedDebt.amount} for **${data.updatedDebt.customerName}** has been marked as settled.`,
          intent: 'LOG_TRANSACTION'
        });
        updateDashboard(data.overview);
        scrollToBottom();
      }
    } catch (err) {
      console.error('Failed to settle debt:', err);
    }
  };

  // Fetch initial ledger overview
  async function refreshLedger() {
    try {
      const res = await fetch(`/api/ledger/overview?userId=${encodeURIComponent(currentUserId)}`);
      const data = await res.json();
      if (data.success) {
        updateDashboard(data);
      }
    } catch (e) {
      console.warn('Could not load initial ledger overview:', e);
    }
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  function formatMarkdown(text) {
    if (!text) return '';
    let escaped = escapeHTML(text);
    // Replace **bold** with <strong>bold</strong>
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Replace *italic* with <em>italic</em>
    escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Replace newlines with <br>
    escaped = escaped.replace(/\n/g, '<br>');
    return escaped;
  }

  // Initial load
  refreshLedger();
});
