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
      renderTop10(filtered.slice(0, 10));
      renderGames(filtered.slice(0, 6), 'gamesCPGames');
      renderGames(filtered.slice(6, 12), 'gamesPopokGames');
      renderGames(filtered, 'gamesAll');
    }, 300);
  });
}

function renderAllSections() {
  var hot = allGames.slice(0, 10);
  renderTop10(hot);
  /* Provider grids */
  var cpGames = allGames.filter(function(g) { return (g.provider || '').toLowerCase().includes('cp'); }).slice(0, 6);
  var popokGames = allGames.filter(function(g) { return (g.provider || '').toLowerCase().includes('popok'); }).slice(0, 6);
  renderGames(cpGames.length >= 6 ? cpGames : allGames.slice(0, 6), 'gamesCPGames');
  renderGames(popokGames.length >= 6 ? popokGames : allGames.slice(6, 12), 'gamesPopokGames');
  renderGames(allGames, 'gamesAll');
}

/* ========== TOP 10 SLIDER ========== */
function top10CardHTML(game, rank) {
  var img = game.image_url || '/public/img/games/1.avif';
  var name = game.game_name || 'Jogo';
  var h = '<div class="top10-card">';
  h += '<span class="top10-rank">' + rank + '</span>';
  h += '<div class="top10-img-wrap">';
  h += '<span class="top10-badge">' + rank + '</span>';
  h += '<img src="' + img + '" alt="' + name + '" draggable="false" loading="lazy">';
  h += '<div class="top10-hover"><span class="top10-play">&#9654; JOGAR</span></div>';
  h += '</div>';
  h += '</div>';
  return h;
}

var top10Offset = 0;
var top10Total = 0;

function renderTop10(games) {
  var track = document.getElementById('top10Track');
  if (!track) return;
  top10Total = games.length;
  top10Offset = 0;
  if (!games.length) { track.innerHTML = ''; return; }
  track.innerHTML = games.map(function(g, i) { return top10CardHTML(g, i + 1); }).join('');
  track.style.transform = 'translateX(0)';
  updateTop10Arrows();
}

function getTop10Step() {
  var track = document.getElementById('top10Track');
  if (!track || !track.children.length) return 250;
  var card = track.children[0];
  return card.offsetWidth;
}

function slideTop10(dir) {
  var visible = window.innerWidth <= 768 ? 2 : 4;
  var maxOff = Math.max(0, top10Total - visible);
  top10Offset = Math.min(Math.max(0, top10Offset + dir), maxOff);
  var track = document.getElementById('top10Track');
  if (track) track.style.transform = 'translateX(-' + (top10Offset * getTop10Step()) + 'px)';
  updateTop10Arrows();
}

function updateTop10Arrows() {
  var visible = window.innerWidth <= 768 ? 2 : 4;
  var maxOff = Math.max(0, top10Total - visible);
  var prev = document.querySelector('.top10-prev');
  var next = document.querySelector('.top10-next');
  if (prev) prev.style.opacity = top10Offset > 0 ? '1' : '0.3';
  if (next) next.style.opacity = top10Offset < maxOff ? '1' : '0.3';
}

document.addEventListener('click', function(e) {
  if (e.target.closest('.top10-prev')) slideTop10(-1);
  if (e.target.closest('.top10-next')) slideTop10(1);
});

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
var barsToggle = document.getElementById('barsToggle');
var topbarTabs = document.getElementById('topbarTabs');
var menuToggle = document.getElementById('menuCassinoToggle');
var menuList = document.getElementById('menuCassinoList');
var esportesToggle = document.getElementById('menuEsportesToggle');
var esportesGroup = document.getElementById('esportesGroup');

function isMobile() { return window.innerWidth <= 768; }

/* Track which group sections are collapsed */
function syncCollapsedSections() {
  if (!sidebar) return;
  /* CASSINO */
  if (menuToggle && menuToggle.classList.contains('collapsed')) {
    sidebar.classList.add('cassino-closed');
  } else {
    sidebar.classList.remove('cassino-closed');
  }
  /* ESPORTES group */
  if (esportesToggle && esportesToggle.classList.contains('collapsed')) {
    sidebar.classList.add('esportes-closed');
  } else {
    sidebar.classList.remove('esportes-closed');
  }
}

if (barsToggle) barsToggle.addEventListener('click', function() {
  if (isMobile()) {
    if (sidebar) sidebar.classList.toggle('mobile-open');
    if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
  } else {
    if (sidebar) sidebar.classList.toggle('collapsed');
    if (topbarTabs) topbarTabs.classList.toggle('collapsed');
    syncCollapsedSections();
  }
});
if (sidebarOverlay) sidebarOverlay.addEventListener('click', function() {
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (sidebarOverlay) sidebarOverlay.classList.remove('active');
});

/* CASSINO accordion */
if (menuToggle) menuToggle.addEventListener('click', function() {
  menuToggle.classList.toggle('collapsed');
  if (menuList) {
    menuList.style.maxHeight = menuToggle.classList.contains('collapsed') ? '0' : menuList.scrollHeight + 'px';
  }
  syncCollapsedSections();
});

/* ESPORTES group accordion — toggles esportes + popular + top5 */
if (esportesToggle) esportesToggle.addEventListener('click', function() {
  esportesToggle.classList.toggle('collapsed');
  var isCollapsed = esportesToggle.classList.contains('collapsed');
  var lists = esportesGroup ? esportesGroup.querySelectorAll('.menu-list') : [];
  var titles = esportesGroup ? esportesGroup.querySelectorAll('.menu-title:not(#menuEsportesToggle)') : [];
  lists.forEach(function(list) {
    list.style.maxHeight = isCollapsed ? '0' : list.scrollHeight + 'px';
  });
  titles.forEach(function(t) {
    t.style.display = isCollapsed ? 'none' : '';
  });
  syncCollapsedSections();
});

/* ========== SIDEBAR TOOLTIPS (JS, appended to body) ========== */
(function() {
  var tip = null;
  function showTip(el) {
    if (!sidebar || !sidebar.classList.contains('collapsed')) return;
    var text = el.getAttribute('data-tooltip');
    if (!text) return;
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'sidebar-tooltip';
      document.body.appendChild(tip);
    }
    tip.textContent = text;
    tip.style.display = 'block';
    var r = el.getBoundingClientRect();
    tip.style.left = (r.right + 10) + 'px';
    tip.style.top = (r.top + r.height / 2) + 'px';
    tip.style.transform = 'translateY(-50%)';
  }
  function hideTip() {
    if (tip) tip.style.display = 'none';
  }
  if (sidebar) {
    sidebar.addEventListener('mouseover', function(e) {
      var el = e.target.closest('[data-tooltip]');
      if (el) showTip(el);
    });
    sidebar.addEventListener('mouseout', function(e) {
      var el = e.target.closest('[data-tooltip]');
      if (el) hideTip();
    });
  }
})();

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
    renderTop10(filtered.slice(0, 10));
    renderGames(filtered.slice(0, 6), 'gamesCPGames');
    renderGames(filtered.slice(6, 12), 'gamesPopokGames');
    renderGames(filtered, 'gamesAll');
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
    if (sidebar) sidebar.classList.remove('mobile-open');
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
