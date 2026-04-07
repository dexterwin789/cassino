/* /cassino/public/js/script.js — CassinoBet Desktop Layout */

var allGames = [];

/* ========== GAME CARDS ========== */
function gameCardHTML(game) {
  var img = game.image_url || '/public/img/games/1.avif';
  var name = game.game_name || 'Jogo';
  var code = game.game_code || '';
  var h = '<a href="/game/' + code + '" class="game-card" title="' + name + '" style="text-decoration:none">';
  h += '<img src="' + img + '" alt="' + name + '" draggable="false" loading="lazy">';
  h += '<div class="game-overlay">';
  h += '<span class="game-name">' + name + '</span>';
  h += '<span class="play-btn">&#9654; JOGAR</span>';
  h += '</div></a>';
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
/* ========== SEARCH ========== */
var searchInput = document.getElementById('searchGames');
var searchOverlay = document.getElementById('searchOverlay');
var searchResults = document.getElementById('searchResults');
var searchGrid = document.getElementById('searchGrid');
var searchFooter = document.getElementById('searchFooter');
var searchCount = document.getElementById('searchCount');
var searchLoadMore = document.getElementById('searchLoadMore');
var searchCloseBtn = document.getElementById('searchClose');
var searchTagsEl = document.getElementById('searchTags');
var searchMessage = document.getElementById('searchMessage');
var searchTimer = null;
var searchFiltered = [];
var searchShown = 0;
var searchPageSize = 15;
var searchActiveTag = 'Todos';
var searchIsOpen = false;

/* Animated placeholder */
var placeholderPhrases = ['Fortune Tiger...','Aviator...','Big Bass Bonanza...','Sweet Bonanza...','Mines...','Gates of Olympus...','Spaceman...','Roleta Brasileira...','Fortune Ox...','Sugar Rush...'];
var phIdx = 0;
var phCharIdx = 0;
var phDeleting = false;
var phInterval = null;

function animatePlaceholder() {
  if (!searchInput || searchIsOpen) return;
  var phrase = placeholderPhrases[phIdx];
  if (!phDeleting) {
    phCharIdx++;
    searchInput.placeholder = phrase.substring(0, phCharIdx);
    if (phCharIdx >= phrase.length) {
      phDeleting = true;
      clearInterval(phInterval);
      setTimeout(function() { phInterval = setInterval(animatePlaceholder, 40); }, 1500);
      return;
    }
  } else {
    phCharIdx--;
    searchInput.placeholder = phrase.substring(0, phCharIdx);
    if (phCharIdx <= 0) {
      phDeleting = false;
      phIdx = (phIdx + 1) % placeholderPhrases.length;
      clearInterval(phInterval);
      setTimeout(function() { phInterval = setInterval(animatePlaceholder, 80); }, 300);
      return;
    }
  }
}
function startPlaceholderAnim() {
  stopPlaceholderAnim();
  phCharIdx = 0;
  phDeleting = false;
  phInterval = setInterval(animatePlaceholder, 80);
}
function stopPlaceholderAnim() {
  if (phInterval) { clearInterval(phInterval); phInterval = null; }
}

function openSearch() {
  searchIsOpen = true;
  stopPlaceholderAnim();
  if (searchInput) searchInput.placeholder = 'Pesquise um jogo de cassino...';
  var section = document.getElementById('searchSection');
  if (section) {
    // Scroll so the search section sits just below the header (topbar height ~64px + some margin)
    var rect = section.getBoundingClientRect();
    var topbarH = 64;
    var desiredOffset = topbarH + 36; // 100px from true top
    var scrollTarget = window.scrollY + rect.top - desiredOffset;
    if (scrollTarget < 0) scrollTarget = 0;
    window.scrollTo({top: scrollTarget, behavior: 'instant'});
    section.classList.add('search-active');
  }
  if (searchOverlay) searchOverlay.classList.add('active');
  if (searchResults) searchResults.classList.add('active');
  if (searchCloseBtn) searchCloseBtn.classList.add('active');
  document.body.classList.add('search-lock');
  handleSearchState();
}

function closeSearch() {
  searchIsOpen = false;
  var section = document.getElementById('searchSection');
  if (section) section.classList.remove('search-active');
  if (searchOverlay) searchOverlay.classList.remove('active');
  if (searchResults) searchResults.classList.remove('active');
  if (searchCloseBtn) searchCloseBtn.classList.remove('active');
  if (searchInput) { searchInput.value = ''; searchInput.blur(); }
  document.body.classList.remove('search-lock');
  searchFiltered = [];
  searchShown = 0;
  searchActiveTag = 'Todos';
  if (searchGrid) searchGrid.innerHTML = '';
  if (searchFooter) searchFooter.style.display = 'none';
  if (searchTagsEl) searchTagsEl.innerHTML = '';
  if (searchMessage) searchMessage.style.display = 'none';
  startPlaceholderAnim();
}

function handleSearchState() {
  var q = (searchInput ? searchInput.value : '').trim();
  // Hide everything first
  if (searchMessage) searchMessage.style.display = 'none';
  if (searchTagsEl) searchTagsEl.style.display = 'none';
  if (searchGrid) searchGrid.style.display = 'none';
  if (searchFooter) searchFooter.style.display = 'none';

  if (q.length === 0) {
    if (searchTagsEl) searchTagsEl.innerHTML = '';
    if (searchGrid) searchGrid.innerHTML = '';
    return;
  }
  // Special "all" command — shows every game
  if (q.toLowerCase() === 'all') {
    searchActiveTag = 'Todos';
    searchFiltered = allGames.slice();
    searchShown = 0;
    var allTags = extractTags(searchFiltered);
    renderSearchTags(allTags);
    if (searchGrid) { searchGrid.innerHTML = ''; searchGrid.style.display = 'grid'; }
    showMoreSearchResults();
    return;
  }
  if (q.length < 2) {
    if (searchMessage) {
      searchMessage.textContent = 'Pesquisa mínima de 2 caracteres';
      searchMessage.style.display = 'block';
    }
    if (searchTagsEl) searchTagsEl.innerHTML = '';
    if (searchGrid) searchGrid.innerHTML = '';
    return;
  }
  doSearch();
}

function extractTags(games) {
  var tagSet = {};
  games.forEach(function(g) {
    if (g.provider) tagSet[g.provider] = true;
    if (g.category) {
      g.category.split(',').forEach(function(c) {
        var t = c.trim();
        if (t) tagSet[t] = true;
      });
    }
  });
  var tags = ['Todos'];
  Object.keys(tagSet).sort().forEach(function(t) { tags.push(t); });
  return tags;
}

function renderSearchTags(tags) {
  if (!searchTagsEl) return;
  if (!tags || tags.length <= 1) {
    searchTagsEl.style.display = 'none';
    searchTagsEl.innerHTML = '';
    return;
  }
  searchTagsEl.style.display = 'flex';
  searchTagsEl.innerHTML = tags.map(function(t) {
    return '<button class="search-tag' + (t === searchActiveTag ? ' active' : '') + '" data-tag="' + t + '">' + t + '</button>';
  }).join('');
  searchTagsEl.querySelectorAll('.search-tag').forEach(function(btn) {
    btn.addEventListener('click', function() {
      searchActiveTag = btn.dataset.tag;
      searchTagsEl.querySelectorAll('.search-tag').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      applyTagFilter();
    });
  });
}

function doSearch() {
  var q = (searchInput ? searchInput.value : '').trim().toLowerCase();
  searchActiveTag = 'Todos';

  // Find all games matching text query
  var queryMatched = allGames.filter(function(g) {
    return (g.game_name || '').toLowerCase().includes(q) ||
      (g.provider || '').toLowerCase().includes(q) ||
      (g.category || '').toLowerCase().includes(q);
  });

  if (queryMatched.length === 0) {
    // No results
    if (searchMessage) {
      searchMessage.textContent = 'Não encontramos resultados para sua busca';
      searchMessage.style.display = 'block';
    }
    if (searchTagsEl) { searchTagsEl.innerHTML = ''; searchTagsEl.style.display = 'none'; }
    if (searchGrid) { searchGrid.innerHTML = ''; searchGrid.style.display = 'none'; }
    if (searchFooter) searchFooter.style.display = 'none';
    return;
  }

  // Build dynamic tags from results
  var dynamicTags = extractTags(queryMatched);
  renderSearchTags(dynamicTags);

  // Store full query results and show
  searchFiltered = queryMatched;
  searchShown = 0;
  if (searchGrid) { searchGrid.innerHTML = ''; searchGrid.style.display = 'grid'; }
  showMoreSearchResults();
}

function applyTagFilter() {
  var q = (searchInput ? searchInput.value : '').trim().toLowerCase();
  var queryMatched = allGames.filter(function(g) {
    return (g.game_name || '').toLowerCase().includes(q) ||
      (g.provider || '').toLowerCase().includes(q) ||
      (g.category || '').toLowerCase().includes(q);
  });

  if (searchActiveTag !== 'Todos') {
    var tag = searchActiveTag.toLowerCase();
    searchFiltered = queryMatched.filter(function(g) {
      return (g.category || '').toLowerCase().includes(tag) ||
        (g.provider || '').toLowerCase().includes(tag);
    });
  } else {
    searchFiltered = queryMatched;
  }

  searchShown = 0;
  if (searchGrid) { searchGrid.innerHTML = ''; searchGrid.style.display = 'grid'; }
  if (searchMessage) searchMessage.style.display = 'none';
  showMoreSearchResults();
}

function searchCardHTML(game) {
  var img = game.image_url || '/public/img/games/1.avif';
  var name = game.game_name || 'Jogo';
  var code = game.game_code || '';
  return '<a href="/game/' + code + '" class="game-card" title="' + name + '" style="text-decoration:none">' +
    '<img src="' + img + '" alt="' + name + '" draggable="false" loading="lazy">' +
    '<div class="game-overlay">' +
      '<span class="play-btn">&#9654; JOGAR</span>' +
    '</div></a>';
}

function showMoreSearchResults() {
  if (!searchGrid) return;
  var next = searchFiltered.slice(searchShown, searchShown + searchPageSize);
  searchGrid.insertAdjacentHTML('beforeend', next.map(searchCardHTML).join(''));
  searchShown += next.length;
  var total = searchFiltered.length;
  if (searchFooter && searchCount) {
    var pct = total > 0 ? Math.round((Math.min(searchShown, total) / total) * 100) : 0;
    searchCount.innerHTML = '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>Mostrando ' + Math.min(searchShown, total) + ' de ' + total + ' jogos';
    searchFooter.style.display = total > 0 ? 'block' : 'none';
    if (searchLoadMore) searchLoadMore.style.display = searchShown >= total ? 'none' : 'inline-block';
  }
}

if (searchInput) {
  searchInput.addEventListener('focus', function() { openSearch(); });
  searchInput.addEventListener('input', function() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function() { handleSearchState(); }, 300);
  });
}
if (searchOverlay) searchOverlay.addEventListener('click', closeSearch);
if (searchCloseBtn) searchCloseBtn.addEventListener('click', closeSearch);
if (searchLoadMore) searchLoadMore.addEventListener('click', showMoreSearchResults);
document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && searchIsOpen) closeSearch(); });

// Start placeholder animation on load
startPlaceholderAnim();

/* Provider grid IDs */
var providerGrids = [
  { id: 'gridAmusnet', match: 'amusnet' },
  { id: 'gridHacksaw', match: 'hacksaw' },
  { id: 'gridPG', match: 'pg' },
  { id: 'gridCPGames', match: 'cp' },
  { id: 'gridPopokGames', match: 'popok' },
  { id: 'gridPP', match: 'pp' },
  { id: 'gridEvolution', match: 'evolution' },
  { id: 'gridSpribe', match: 'spribe' },
  { id: 'gridJILI', match: 'jili' },
  { id: 'gridCQ9', match: 'cq9' },
  { id: 'gridBetsoft', match: 'betsoft' },
  { id: 'gridPlaynGO', match: 'playngo' },
  { id: 'gridNetEnt', match: 'netent' },
  { id: 'gridEvoplay', match: 'evor' },
  { id: 'gridWazdan', match: 'wazdan' },
  { id: 'gridBGaming', match: 'bgaming' }
];

function renderProviderGrids(games) {
  var used = 0;
  providerGrids.forEach(function(pg) {
    var matched = games.filter(function(g) {
      return (g.provider || '').toLowerCase() === pg.match ||
             (g.provider || '').toLowerCase().includes(pg.match);
    }).slice(0, 6);
    if (matched.length < 6) {
      var fill = games.slice(used, used + 6);
      matched = fill.length >= 6 ? fill : games.slice(0, 6);
    }
    used += 6;
    if (used >= games.length) used = 0;
    renderGames(matched, pg.id);
  });
}

function renderAllSections() {
  var hot = allGames.slice(0, 9);
  renderTop10(hot);
  renderProviderGrids(allGames);
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
  var list = games.slice(0, 9);
  top10Total = list.length;
  top10Offset = 0;
  if (!list.length) { track.innerHTML = ''; return; }
  track.innerHTML = list.map(function(g, i) { return top10CardHTML(g, i + 1); }).join('');
  track.style.transform = 'translateX(0)';
  updateTop10Arrows();
}

function getTop10Step() {
  var track = document.getElementById('top10Track');
  if (!track || !track.children.length) return 250;
  var card = track.children[0];
  return card.offsetWidth + 20;
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
    renderTop10(filtered.slice(0, 9));
    renderProviderGrids(filtered);
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
if (btnOpenLogin) btnOpenLogin.addEventListener('click', function() {
  if (typeof openLoginModal === 'function') openLoginModal();
  else openAuth('login');
});

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

/* ========== FOOTER SEO TOGGLE ========== */
function toggleFooterSeo() {
  var more = document.getElementById('footerSeoMore');
  var btn = document.getElementById('footerSeoToggle');
  if (!more || !btn) return;
  if (more.style.display === 'none') {
    more.style.display = 'block';
    btn.textContent = 'Ver menos';
  } else {
    more.style.display = 'none';
    btn.textContent = 'Ver mais';
  }
}

/* ========== GANHOS TABS ========== */
document.querySelectorAll('.ganhos-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.ganhos-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    renderGanhos();
  });
});

/* ========== RANDOM DATA HELPERS ========== */
var fakeNames = [
  'Lucas','Ana','Pedro','Maria','João','Carla','Bruno','Fernanda','Rafael','Juliana',
  'Carlos','Patrícia','Thiago','Camila','Diego','Amanda','Rodrigo','Larissa','Felipe','Mariana',
  'Gustavo','Beatriz','André','Letícia','Daniel','Tatiana','Leandro','Vanessa','Marcos','Bruna',
  'Eduardo','Raquel','Vinícius','Isabela','Fabio','Renata','Mateus','Aline','Gabriel','Priscila',
  'Leonardo','Natália','Henrique','Débora','Alex','Cristiane','Paulo','Sabrina','Roberto','Luciana'
];
var gameImages = [
  '/public/img/games/1.avif','/public/img/games/2.webp','/public/img/games/3.webp',
  '/public/img/games/4.webp','/public/img/games/5.webp','/public/img/games/6.webp',
  '/public/img/games/7.webp','/public/img/games/8.webp','/public/img/games/9.webp',
  '/public/img/games/10.webp','/public/img/games/11.webp','/public/img/games/12.webp'
];

function randomName() {
  return fakeNames[Math.floor(Math.random() * fakeNames.length)] + ' ***';
}
function randomGame() {
  if (allGames.length > 0) {
    var g = allGames[Math.floor(Math.random() * allGames.length)];
    return { name: g.game_name || 'Jogo', img: g.image_url || gameImages[Math.floor(Math.random() * gameImages.length)] };
  }
  var gameNames = ['Fortune Tiger','Aviator','Mines','Sweet Bonanza','Roleta Brasileira','Gates of Olympus','Spaceman','Penalty Shootout','Sugar Rush','Bikini Paradise','Fortune Ox','Dragon Tiger'];
  var idx = Math.floor(Math.random() * gameNames.length);
  return { name: gameNames[idx], img: gameImages[idx % gameImages.length] };
}
function randomBRL(min, max) {
  var val = (Math.random() * (max - min) + min);
  return 'R$ ' + val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ========== MAIORES GANHOS RENDER + AUTO-SCROLL ========== */
var ganhosInterval = null;
var ganhosScrollIdx = 0;

function generateGanhos(count) {
  var items = [];
  for (var i = 0; i < count; i++) {
    var g = randomGame();
    items.push({ user: randomName(), game: g.name, img: g.img, amount: randomBRL(1000, 80000) });
  }
  items.sort(function(a, b) {
    return parseFloat(b.amount.replace(/[^\d,]/g, '').replace(',', '.')) - parseFloat(a.amount.replace(/[^\d,]/g, '').replace(',', '.'));
  });
  return items;
}

function renderGanhos() {
  var track = document.getElementById('ganhosTrack');
  if (!track) return;
  var items = generateGanhos(12);
  var html = '';
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    html += '<div class="ganho-card">' +
      '<img src="' + it.img + '" alt="" class="ganho-thumb">' +
      '<div class="ganho-info">' +
        '<div class="ganho-user">' + it.user + '</div>' +
        '<div class="ganho-game">' + it.game + '</div>' +
        '<div class="ganho-amount">' + it.amount + '</div>' +
      '</div></div>';
  }
  track.innerHTML = html;
  ganhosScrollIdx = 0;
  track.style.transition = 'none';
  track.style.transform = 'translateX(0)';
  startGanhosScroll();
}

function startGanhosScroll() {
  if (ganhosInterval) clearInterval(ganhosInterval);
  var track = document.getElementById('ganhosTrack');
  if (!track) return;
  var cards = track.querySelectorAll('.ganho-card');
  if (cards.length === 0) return;
  var cardW = 280 + 12; // card width + gap
  var maxIdx = Math.max(0, cards.length - 3);
  ganhosScrollIdx = 0;
  ganhosInterval = setInterval(function() {
    ganhosScrollIdx++;
    if (ganhosScrollIdx > maxIdx) {
      track.style.transition = 'none';
      track.style.transform = 'translateX(0)';
      ganhosScrollIdx = 0;
      setTimeout(function() {
        track.style.transition = 'transform .5s ease';
      }, 50);
    } else {
      track.style.transition = 'transform .5s ease';
      track.style.transform = 'translateX(-' + (ganhosScrollIdx * cardW) + 'px)';
    }
  }, 2500);
}

/* ========== ÚLTIMAS APOSTAS RENDER + VERTICAL SCROLL ========== */
var apostasInterval = null;

function generateAposta() {
  var g = randomGame();
  var bet = Math.random() * 200 + 0.5;
  var mult = Math.random() * 4 + 0.3;
  var win = bet * mult;
  return {
    user: randomName(),
    game: g.name,
    img: g.img,
    bet: 'R$ ' + bet.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    win: 'R$ ' + win.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  };
}

function apostaRowHTML(a) {
  return '<div class="aposta-row">' +
    '<img src="' + a.img + '" class="aposta-icon" alt="">' +
    '<div class="aposta-info">' +
      '<span class="aposta-user">' + a.user + '</span>' +
      '<span class="aposta-game">' + a.game + '</span>' +
    '</div>' +
    '<div class="aposta-values">' +
      '<span class="aposta-bet">' + a.bet + '</span>' +
      '<span class="aposta-arrow">→</span>' +
      '<span class="aposta-win">' + a.win + '</span>' +
    '</div>' +
    '<span class="aposta-chevron">›</span>' +
  '</div>';
}

function renderApostas() {
  var list = document.getElementById('apostasList');
  if (!list) return;
  var html = '';
  for (var i = 0; i < 10; i++) {
    html += apostaRowHTML(generateAposta());
  }
  list.innerHTML = html;
  startApostasScroll();
}

function startApostasScroll() {
  if (apostasInterval) clearInterval(apostasInterval);
  var list = document.getElementById('apostasList');
  if (!list) return;
  var rowH = 56; // px per row

  apostasInterval = setInterval(function() {
    // Slide up one row
    list.style.transition = 'transform .5s ease';
    list.style.transform = 'translateY(-' + rowH + 'px)';

    setTimeout(function() {
      // Remove top row, add new at bottom, reset transform
      list.style.transition = 'none';
      list.style.transform = 'translateY(0)';
      if (list.firstElementChild) list.removeChild(list.firstElementChild);
      var newRow = document.createElement('div');
      newRow.innerHTML = apostaRowHTML(generateAposta());
      list.appendChild(newRow.firstElementChild);
    }, 500);
  }, 2000);
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
    renderGanhos();
    renderApostas();
    initBannerDots();
    showBanner(0);
    startBannerAuto();
    updateAuthState();
  });
}

initApp();
