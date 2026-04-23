/* Chatbot frontend — state machine + API calls */
(function () {
  'use strict';

  const root = document.getElementById('cbRoot');
  if (!root) return;

  const bubble = document.getElementById('cbBubble');
  const closeBtn = document.getElementById('cbClose');
  const msgs = document.getElementById('cbMessages');
  const quick = document.getElementById('cbQuick');
  const escForm = document.getElementById('cbEscalate');
  const badge = document.getElementById('cbBadge');

  let currentTopic = 'outro';
  let historyLoaded = false;

  const STORAGE_KEY = 'vnb_cb_history';

  function toggle() {
    const open = root.getAttribute('data-cb-open') === 'true';
    root.setAttribute('data-cb-open', open ? 'false' : 'true');
    if (!open) {
      if (badge) badge.style.display = 'none';
      if (!historyLoaded) { historyLoaded = true; startGreeting(); }
    }
  }
  function openChat() {
    if (root.getAttribute('data-cb-open') !== 'true') toggle();
  }
  window.openChatbot = openChat;
  bubble.addEventListener('click', toggle);
  closeBtn.addEventListener('click', toggle);

  // Wire any element with [data-cb-open] attribute
  document.addEventListener('click', function(e) {
    var t = e.target.closest('[data-cb-open]');
    if (!t) return;
    e.preventDefault();
    // Close any open login/register/deposit modal first so chatbot is visible
    try {
      if (typeof window.closeLoginModal === 'function') window.closeLoginModal();
      if (typeof window.closeRegisterModal === 'function') window.closeRegisterModal();
    } catch (_) {}
    document.querySelectorAll('.login-overlay.open').forEach(function(o){ o.classList.remove('open'); });
    document.body.style.overflow = '';
    openChat();
  });

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function addMsg(text, sender) {
    const div = document.createElement('div');
    div.className = 'cb-msg cb-msg-' + (sender || 'bot');
    // Bot messages support **bold** markdown and newlines
    if (sender === 'bot' || sender === 'system') {
      div.innerHTML = escapeHtml(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    } else {
      div.textContent = text;
    }
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    saveHistory();
  }

  function addTyping() {
    const d = document.createElement('div');
    d.className = 'cb-typing'; d.id = 'cbTypingDot';
    d.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function removeTyping() {
    const d = document.getElementById('cbTypingDot');
    if (d) d.remove();
  }

  function renderQuick(options) {
    quick.innerHTML = '';
    if (!options || !options.length) return;
    options.forEach(opt => {
      const b = document.createElement('button');
      b.className = 'cb-chip' + (opt.id.startsWith('escalate') ? ' cb-chip-escalate' : '');
      b.textContent = opt.label;
      b.addEventListener('click', () => handleChipClick(opt));
      quick.appendChild(b);
    });
  }

  async function handleChipClick(opt) {
    addMsg(opt.label, 'user');
    quick.innerHTML = '';
    if (opt.id.startsWith('escalate:')) {
      currentTopic = opt.id.split(':')[1] || 'outro';
      addMsg('Vou te conectar com a nossa equipe. Preencha os detalhes abaixo para abrirmos seu chamado.', 'bot');
      escForm.style.display = 'flex';
      return;
    }
    await sendIntent(opt.id);
  }

  async function sendIntent(intent) {
    addTyping();
    try {
      const r = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ intent })
      });
      const d = await r.json();
      // Simulate typing delay (feels more natural)
      await new Promise(res => setTimeout(res, 400 + Math.random() * 400));
      removeTyping();
      if (!d.ok) { addMsg('Desculpe, tive um problema. Tente novamente.', 'bot'); return; }
      addMsg(d.text, 'bot');
      renderQuick(d.options);
    } catch (e) {
      removeTyping();
      addMsg('Desculpe, tive um problema de conexão. Tente novamente.', 'bot');
    }
  }

  function startGreeting() {
    // Try to restore history from localStorage
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
      if (saved.length > 0) {
        saved.forEach(m => addMsg(m.text, m.sender));
        // Re-fetch latest menu
        return sendIntent('menu');
      }
    } catch (_) {}
    sendIntent('greeting');
  }

  function saveHistory() {
    try {
      const items = [...msgs.children].filter(el => el.classList.contains('cb-msg')).slice(-30).map(el => ({
        text: el.textContent,
        sender: el.classList.contains('cb-msg-bot') ? 'bot' : el.classList.contains('cb-msg-user') ? 'user' : 'system'
      }));
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (_) {}
  }

  // ═════════ ESCALATION ═════════
  document.getElementById('cbEscCancel').addEventListener('click', () => {
    escForm.style.display = 'none';
    sendIntent('menu');
  });
  document.getElementById('cbEscSubmit').addEventListener('click', async () => {
    const nameInp = document.getElementById('cbEscName');
    const emailInp = document.getElementById('cbEscEmail');
    const msgInp = document.getElementById('cbEscMessage');
    const msg = msgInp.value.trim();
    if (!msg) { msgInp.focus(); return; }
    const payload = { topic: currentTopic, message: msg };
    if (nameInp) payload.name = nameInp.value.trim();
    if (emailInp) payload.email = emailInp.value.trim();

    const btn = document.getElementById('cbEscSubmit');
    btn.disabled = true; btn.textContent = 'Enviando...';
    try {
      const r = await fetch('/api/chat/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      const d = await r.json();
      if (d.ok) {
        escForm.style.display = 'none';
        addMsg('✅ Chamado #' + d.ticket_id + ' aberto com sucesso!\n\n' + (d.msg || ''), 'system');
        msgInp.value = '';
        setTimeout(() => sendIntent('menu'), 1500);
      } else {
        addMsg('⚠️ ' + (d.msg || 'Erro ao abrir chamado'), 'system');
      }
    } catch (e) {
      addMsg('⚠️ Erro de conexão. Tente novamente.', 'system');
    } finally {
      btn.disabled = false; btn.textContent = 'Enviar chamado';
    }
  });

  // First-time notification badge
  setTimeout(() => {
    if (root.getAttribute('data-cb-open') !== 'true' && !sessionStorage.getItem('vnb_cb_seen')) {
      badge.style.display = 'flex';
      sessionStorage.setItem('vnb_cb_seen', '1');
    }
  }, 8000);
})();
