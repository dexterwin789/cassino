/* /cassino/public/js/script.js — Esportiva Desktop Layout */

var allGames = [];

/* ========== GAME CARDS ========== */
function gameCardHTML(game) {
  var img = game.image_url || '/public/img/games/1.avif';
  var name = game.game_name || 'Jogo';
  var h = '<div class="game-card" title="' + name + '">';
  h += '<img src="' + img + '" alt="' + name + '" draggable="false" loading="lazy">';
  h += '<div class="game-overlay">';
  h += '<span class="game-name">' + name + '</span>';
  h += '<span class="play-btn">&#9654; JOGAR</span>';
  h += '</div></div>';
  return h;
}

function renderGames(games, containerId, limit) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var list = limit ? games.slice(0, limit) : games;
  if (!list.length) {
    el.innerHTML = '<p class="no-games">Nenhum jogo dispon\u00edvel</p>';
    return;
  }
  el.innerHTML = list.map(gameCardHTML).join('');
}

/* ========== SEARCH ========== */
var searchInput = document.getElementById('searchGames');
var searchTimer = null;
if (searchInput) {
  searchInput.addEventListener('input', function() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function() {
      var q = (searchInput.value || '').trim().toLowerCase();
      if (!q) { renderAllSections(); return; }
      var filtered = allGames.filter(function(g) {
        return (g.game_name || '').toLowerCase().includes(q) ||
          (g.provider || '').toLowerCase().includes(q) ||
          (g.category || '').toLowerCase().includes(q);
      });
      renderGames(filtered, 'gamesRecommended');
      renderGames([], 'gamesHot');
      renderGames([], 'gamesAll');
    }, 300);
  });
}

function renderAllSections() {
  var recommended = allGames.filter(function(g) { return g.category === 'quente' || g.category === 'recommended'; }).slice(0, 8);
  var hot = allGames.filter(function(g) { return g.category !== 'quente'; }).slice(0, 12);
  renderGames(recommended.length ? recommended : allGames.slice(0, 8), 'gamesRecommended');
  renderGames(hot.length ? hot : allGames.slice(8, 20), 'gamesHot', 12);
  renderGames(allGames, 'gamesAll');
}

/* ========== BANNER SLIDER ========== */
var bannerIndex = 0;
var bannerTimer = null;
var bannerSlider = document.getElementById('bannerSlider');
var bannerDotsEl = document.getElementById('bannerDots');
var bannerPrev = document.getElementById('bannerPrev');
var bannerNext = document.getElementById('bannerNext');

function getBannerSlides() {
  return bannerSlider ? bannerSlider.querySelectorAll('.banner-slide') : [];
}

function showBanner(i) {
  var slides = getBannerSlides();
  if (!slides.length) return;
  bannerIndex = ((i % slides.length) + slides.length) % slides.length;
  slides.forEach(function(s, idx) { s.classList.toggle('active', idx === bannerIndex); });
  var dots = bannerDotsEl ? bannerDotsEl.querySelectorAll('.dot') : [];
  dots.forEach(function(d, idx) { d.classList.toggle('active', idx === bannerIndex); });
}

function startBannerAuto() {
  stopBannerAuto();
  bannerTimer = setInterval(function() { showBanner(bannerIndex + 1); }, 5000);
}
function stopBannerAuto() {
  if (bannerTimer) clearInterval(bannerTimer);
  bannerTimer = null;
}

function initBannerDots() {
  var slides = getBannerSlides();
  if (!bannerDotsEl || !slides.length) return;
  var html = '';
  for (var i = 0; i < slides.length; i++) {
    html += '<button class="dot ' + (i === 0 ? 'active' : '') + '" data-i="' + i + '"></button>';
  }
  bannerDotsEl.innerHTML = html;
  bannerDotsEl.addEventListener('click', function(e) {
    var dot = e.target.closest('.dot');
    if (!dot) return;
    showBanner(+dot.dataset.i);
    startBannerAuto();
  });
}

if (bannerPrev) bannerPrev.addEventListener('click', function() { showBanner(bannerIndex - 1); startBannerAuto(); });
if (bannerNext) bannerNext.addEventListener('click', function() { showBanner(bannerIndex + 1); startBannerAuto(); });

/* ========== SIDEBAR ========== */
var sidebar = document.getElementById('sidebar');
var sidebarOverlay = document.getElementById('sidebarOverlay');
var btnHamburger = document.getElementById('btnHamburger');
var menuToggle = document.getElementById('menuCassinoToggle');
var menuList = document.getElementById('menuCassinoList');

if (btnHamburger) btnHamburger.addEventListener('click', function() {
  if (sidebar) sidebar.classList.toggle('open');
  if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
});
if (sidebarOverlay) sidebarOverlay.addEventListener('click', function() {
  if (sidebar) sidebar.classList.remove('open');
  if (sidebarOverlay) sidebarOverlay.classList.remove('active');
});

if (menuToggle) menuToggle.addEventListener('click', function() {
  menuToggle.classList.toggle('collapsed');
  if (menuList) {
    menuList.style.maxHeight = menuToggle.classList.contains('collapsed') ? '0' : menuList.scrollHeight + 'px';
  }
});

if (menuList) menuList.addEventListener('click', function(e) {
  var li = e.target.closest('li');
  if (!li) return;
  menuList.querySelectorAll('li').forEach(function(l) { l.classList.remove('active'); });
  li.classList.add('active');
  var filter = li.dataset.filter;
  if (filter === 'all') {
    renderAllSections();
  } else {
    var filtered = allGames.filter(function(g) {
      return (g.category || '').toLowerCase() === filter || (g.provider || '').toLowerCase() === filter;
    });
    renderGames(filtered.length ? filtered : allGames.slice(0, 8), 'gamesRecommended');
    renderGames([], 'gamesHot');
    renderGames([], 'gamesAll');
  }
});

/* ========== AUTH STATE ========== */
function apiPost(url, body) {
  return fetch(url, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function(res) {
    return res.json().catch(function() { return {}; }).then(function(j) {
      return { ok: res.ok, status: res.status, json: j };
    });
  });
}

function updateAuthState() {
  return fetch('/api/me', { credentials: 'include', cache: 'no-store' })
    .then(function(res) { return res.json().catch(function() { return null; }); })
    .then(function(j) {
      var logged = !!(j && j.ok && j.logged);
      document.body.classList.toggle('is-logged', logged);
      document.body.classList.toggle('is-guest', !logged);
      if (logged) refreshWalletUI();
    }).catch(function() {
      document.body.classList.add('is-guest');
      document.body.classList.remove('is-logged');
    });
}

/* ========== AUTH MODAL ========== */
var authModal = document.getElementById('authModal');
var authClose = document.getElementById('authClose');
var formRegister = document.getElementById('formRegister');
var formLogin = document.getElementById('formLogin');

function openAuth(tab) {
  if (authModal) authModal.classList.add('open');
  document.body.style.overflow = 'hidden';
  setAuthTab(tab || 'register');
}
function closeAuth() {
  if (authModal) authModal.classList.remove('open');
  document.body.style.overflow = '';
}
function setAuthTab(which) {
  var isReg = which === 'register';
  if (authModal) authModal.querySelectorAll('.auth-tab').forEach(function(t) {
    t.classList.toggle('active', t.dataset.tab === which);
  });
  if (formRegister) formRegister.style.display = isReg ? '' : 'none';
  if (formLogin) formLogin.style.display = isReg ? 'none' : '';
}

if (authClose) authClose.addEventListener('click', closeAuth);
if (authModal) authModal.addEventListener('click', function(e) { if (e.target === authModal) closeAuth(); });

if (authModal) authModal.querySelectorAll('.auth-tab').forEach(function(t) {
  t.addEventListener('click', function() { setAuthTab(t.dataset.tab); });
});

var btnOpenRegister = document.getElementById('btnOpenRegister');
var btnOpenLogin = document.getElementById('btnOpenLogin');
if (btnOpenRegister) btnOpenRegister.addEventListener('click', function() { openAuth('register'); });
if (btnOpenLogin) btnOpenLogin.addEventListener('click', function() { openAuth('login'); });

// Register
if (formRegister) formRegister.addEventListener('submit', function(e) {
  e.preventDefault();
  var fd = new FormData(formRegister);
  var name = (fd.get('name') || '').trim();
  var cpf = (fd.get('cpf') || '').trim();
  var email = (fd.get('email') || '').trim();
  var phone = (fd.get('phone') || '').trim();
  var password = fd.get('password') || '';
  var password_confirm = fd.get('password_confirm') || '';

  if (password !== password_confirm) return showToast('As senhas n\u00e3o coincidem', 'error');
  if (password.length < 6) return showToast('Senha deve ter pelo menos 6 caracteres', 'error');

  apiPost('/api/register', { name: name, cpf: cpf, email: email, phone: phone, password: password, username: email })
    .then(function(r) {
      if (!r.ok) { showToast(r.json.error || r.json.msg || 'Erro ao registrar', 'error'); return; }
      closeAuth();
      showToast('Conta criada com sucesso!', 'success');
      updateAuthState();
    });
});

// Login
if (formLogin) formLogin.addEventListener('submit', function(e) {
  e.preventDefault();
  var fd = new FormData(formLogin);
  var login = (fd.get('login') || '').trim();
  var password = fd.get('password') || '';
  if (!login || !password) return showToast('Preencha todos os campos', 'error');

  apiPost('/api/login', { username: login, password: password })
    .then(function(r) {
      if (!r.ok) {
        showToast(r.json.error === 'invalid_credentials' ? 'Usu\u00e1rio ou senha inv\u00e1lidos' : (r.json.error || r.json.msg || 'Erro ao entrar'), 'error');
        return;
      }
      closeAuth();
      showToast('Bem-vindo!', 'success');
      updateAuthState();
    });
});

/* ========== DEPOSIT MODAL ========== */
var depositModal = document.getElementById('depositModal');
var depositClose = document.getElementById('depositClose');
var depositAmount = document.getElementById('depositAmount');
var btnConfirmDeposit = document.getElementById('btnConfirmDeposit');
var pixResult = document.getElementById('pixResult');
var pixQr = document.getElementById('pixQr');
var pixCode = document.getElementById('pixCode');
var pixStatus = document.getElementById('pixStatus');
var btnCopyPix = document.getElementById('btnCopyPix');

function openDeposit() {
  var logged = document.body.classList.contains('is-logged');
  if (!logged) { openAuth('login'); return; }
  if (depositModal) depositModal.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (pixResult) pixResult.style.display = 'none';
}
function closeDeposit() {
  if (depositModal) depositModal.classList.remove('open');
  document.body.style.overflow = '';
}

if (depositClose) depositClose.addEventListener('click', closeDeposit);
if (depositModal) depositModal.addEventListener('click', function(e) { if (e.target === depositModal) closeDeposit(); });

var btnDepositTop = document.getElementById('btnDepositTop');
var bnavDeposit = document.getElementById('bnav-deposit');
if (btnDepositTop) btnDepositTop.addEventListener('click', openDeposit);
if (bnavDeposit) bnavDeposit.addEventListener('click', openDeposit);

// Chip selection
if (depositModal) depositModal.querySelectorAll('.chip').forEach(function(chip) {
  chip.addEventListener('click', function() {
    depositModal.querySelectorAll('.chip').forEach(function(c) { c.classList.remove('active'); });
    chip.classList.add('active');
    if (depositAmount) depositAmount.value = 'R$ ' + Number(chip.dataset.val).toLocaleString('pt-BR');
  });
});

// Generate PIX
if (btnConfirmDeposit) btnConfirmDeposit.addEventListener('click', function() {
  var raw = (depositAmount ? depositAmount.value : '').replace(/[^\d]/g, '');
  var val = raw ? Number(raw) : 0;
  if (!val || val < 10) return showToast('Valor m\u00ednimo: R$10', 'error');

  btnConfirmDeposit.disabled = true;
  btnConfirmDeposit.textContent = 'Gerando PIX...';

  fetch('/api/deposit/create', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount_brl: val })
  }).then(function(res) { return res.json().catch(function() { return {}; }); })
  .then(function(j) {
    btnConfirmDeposit.disabled = false;
    btnConfirmDeposit.textContent = 'Gerar PIX';

    if (!j.ok) { showToast('Erro: ' + (j.error || j.msg || 'desconhecido'), 'error'); return; }

    var copyPaste = j.copyPaste || '';
    if (j.raw && j.raw.data && j.raw.data.paymentData) {
      copyPaste = copyPaste || j.raw.data.paymentData.copyPaste || j.raw.data.paymentData.qrCode || '';
    }
    if (!copyPaste) { showToast('PIX n\u00e3o retornou c\u00f3digo', 'error'); return; }

    if (pixResult) pixResult.style.display = '';
    if (pixQr) pixQr.src = 'https://quickchart.io/qr?size=200&margin=2&text=' + encodeURIComponent(copyPaste);
    if (pixCode) pixCode.value = copyPaste;
    if (pixStatus) pixStatus.textContent = 'Aguardando pagamento...';
    if (j.tx_id) startWatchPayment(j.tx_id);
  }).catch(function() {
    btnConfirmDeposit.disabled = false;
    btnConfirmDeposit.textContent = 'Gerar PIX';
    showToast('Erro ao gerar PIX', 'error');
  });
});

if (btnCopyPix) btnCopyPix.addEventListener('click', function() {
  if (navigator.clipboard && pixCode) {
    navigator.clipboard.writeText(pixCode.value).then(function() {
      showToast('PIX copiado!', 'success');
    }).catch(function() { if (pixCode) { pixCode.select(); document.execCommand('copy'); } });
  }
});

/* ========== WALLET ========== */
function refreshWalletUI() {
  fetch('/api/wallet', { credentials: 'include' })
    .then(function(res) { return res.json().catch(function() { return null; }); })
    .then(function(j) {
      if (!j || !j.ok) return;
      var balEl = document.getElementById('walletBalance');
      if (balEl) balEl.textContent = j.balance_brl || 'R$ 0,00';
    }).catch(function() {});
}

/* ========== PAYMENT POLLING ========== */
var __watchTimer = null;
function stopWatchPayment() { if (__watchTimer) clearInterval(__watchTimer); __watchTimer = null; }

function startWatchPayment(txId) {
  stopWatchPayment();
  __watchTimer = setInterval(function() {
    fetch('/api/deposit/status?tx_id=' + encodeURIComponent(txId), { credentials: 'include' })
      .then(function(res) { return res.json().catch(function() { return null; }); })
      .then(function(j) {
        if (j && j.ok && j.paid) {
          stopWatchPayment();
          if (pixStatus) pixStatus.textContent = '\u2705 Pagamento aprovado!';
          showToast('Pagamento aprovado e saldo creditado!', 'success');
          refreshWalletUI();
        }
      }).catch(function() {});
  }, 2000);
}

/* ========== TOAST ========== */
function showToast(msg, type) {
  var container = document.getElementById('toastContainer');
  if (!container) { alert(msg); return; }
  var toast = document.createElement('div');
  toast.className = 'toast ' + (type || 'info');
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = '.3s';
    setTimeout(function() { toast.remove(); }, 300);
  }, 3000);
}

/* ========== LOGOUT ========== */
var btnLogout = document.getElementById('btnLogout');
if (btnLogout) btnLogout.addEventListener('click', function(e) {
  e.preventDefault();
  fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(function() {});
  closeDeposit();
  closeAuth();
  updateAuthState();
  showToast('Desconectado', 'info');
});

/* ========== KEYBOARD ========== */
window.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeAuth();
    closeDeposit();
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
  }
});

/* ========== INIT ========== */
function initApp() {
  Promise.all([
    fetch('/api/games').then(function(r) { return r.json(); }).catch(function() { return { ok: false }; }),
    fetch('/api/banners').then(function(r) { return r.json(); }).catch(function() { return { ok: false }; })
  ]).then(function(results) {
    var gamesRes = results[0];
    allGames = (gamesRes.ok && gamesRes.games) ? gamesRes.games : [];
    renderAllSections();
    initBannerDots();
    showBanner(0);
    startBannerAuto();
    updateAuthState();
  });
}

initApp();
