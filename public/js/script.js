/* /cassino/public/js/script.js —šÂ¬ VemNaBet Desktop Layout */

var allGames = [];

/* ========== GAME CARDS ========== */
function gameCardHTML(game) {
  if (!game.image_url) return '';
  var img = game.image_url;
  var name = game.game_name || 'Jogo';
  var code = game.game_code || '';
  var h = '<a href="/game/' + code + '" class="game-card" title="' + name + '" style="text-decoration:none">';
  h += '<img src="' + img + '" alt="' + name + '" draggable="false" loading="lazy" onerror="this.onerror=null;this.closest(\'a\').style.display=\'none\'">';
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

// Autofill prevention: input starts readonly, only enabled on user click
if (searchInput) {
  searchInput.readOnly = true;
  searchInput.value = '';
  searchInput.style.cursor = 'pointer';
  searchInput.addEventListener('focus', function() {
    if (searchInput.readOnly) {
      searchInput.readOnly = false;
      searchInput.value = '';
      searchInput.style.cursor = '';
      openSearch();
    }
  });
}
var searchBox = document.getElementById('searchBox');
if (searchBox) {
  searchBox.addEventListener('click', function(e) {
    if (searchInput && searchInput.readOnly) {
      searchInput.readOnly = false;
      searchInput.value = '';
      searchInput.style.cursor = '';
      openSearch();
      setTimeout(function() { searchInput.focus(); }, 10);
    } else if (searchInput && !searchIsOpen) {
      openSearch();
      setTimeout(function() { searchInput.focus(); }, 10);
    }
  });
}

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
  if (searchInput) { searchInput.value = ''; searchInput.blur(); searchInput.readOnly = true; searchInput.style.cursor = 'pointer'; }
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
  // Special "all" command —šÂ¬ shows every game
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
  if (!game.image_url) return '';
  var img = game.image_url;
  var name = game.game_name || 'Jogo';
  var code = game.game_code || '';
  return '<a href="/game/' + code + '" class="game-card" title="' + name + '" style="text-decoration:none">' +
    '<img src="' + img + '" alt="' + name + '" draggable="false" loading="lazy" onerror="this.onerror=null;this.closest(\'a\').style.display=\'none\'">' +
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

/* Provider grid IDs —šÂ¬ REPLACED by dynamic filter */
var homeFilteredGames = [];
var homeShown = 0;
var homePageSize = 24;
var homeActiveProvider = '';

function renderHomeFiltered() {
  var grid = document.getElementById('homeFilteredGrid');
  var loadMore = document.getElementById('homeLoadMore');
  var title = document.getElementById('providerSectionTitle');
  if (!grid) return;

  // Sort: featured first, then rest
  var sorted = allGames.slice().sort(function(a, b) {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    if (a.is_featured && b.is_featured) return (a.featured_order || 999) - (b.featured_order || 999);
    return 0;
  });

  // Filter by provider
  if (homeActiveProvider) {
    homeFilteredGames = sorted.filter(function(g) {
      return (g.provider || '').toUpperCase() === homeActiveProvider.toUpperCase();
    });
    if (title) title.textContent = 'Jogos da ' + homeActiveProvider;
  } else {
    homeFilteredGames = sorted;
    if (title) title.textContent = 'Todos os Jogos';
  }

  homeShown = 0;
  grid.innerHTML = '';
  showMoreHome();
}

function showMoreHome() {
  var grid = document.getElementById('homeFilteredGrid');
  var loadMore = document.getElementById('homeLoadMore');
  if (!grid) return;
  var next = homeFilteredGames.slice(homeShown, homeShown + homePageSize);
  grid.insertAdjacentHTML('beforeend', next.map(gameCardHTML).join(''));
  homeShown += next.length;
  if (loadMore) loadMore.style.display = homeShown >= homeFilteredGames.length ? 'none' : 'inline-block';
}

function buildHomeProviderDropdown() {
  var dd = document.getElementById('homeProviderDropdown');
  if (!dd) return;
  // Extract unique providers
  var provs = {};
  allGames.forEach(function(g) { if (g.provider) provs[g.provider.toUpperCase()] = g.provider; });
  var sorted = Object.keys(provs).sort();

  // Keep the "Todos" radio that's already in the HTML
  var html = '<label class="archive-provider-item" style="font-weight:600;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:6px;margin-bottom:4px"><input type="radio" name="homeProv" value="" class="home-prov-radio" checked> Todos os Provedores</label>';
  sorted.forEach(function(k) {
    html += '<label class="archive-provider-item"><input type="radio" name="homeProv" value="' + provs[k] + '" class="home-prov-radio"> ' + provs[k] + '</label>';
  });
  dd.innerHTML = html;

  // Listen for changes
  dd.addEventListener('change', function() {
    var checked = dd.querySelector('.home-prov-radio:checked');
    homeActiveProvider = checked ? checked.value : '';
    var label = document.getElementById('homeProviderLabel');
    if (label) label.textContent = homeActiveProvider || 'Todos';
    renderHomeFiltered();
  });
}

// Toggle dropdown
(function() {
  var btn = document.getElementById('homeProviderBtn');
  var dd = document.getElementById('homeProviderDropdown');
  if (btn && dd) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      dd.classList.toggle('open');
    });
    document.addEventListener('click', function(e) {
      if (!dd.contains(e.target) && e.target !== btn) dd.classList.remove('open');
    });
  }
  var loadMore = document.getElementById('homeLoadMore');
  if (loadMore) loadMore.addEventListener('click', showMoreHome);
})();

function renderAllSections() {
  var featured = allGames.filter(function(g) { return g.is_featured; })
    .sort(function(a, b) { return (a.featured_order || 0) - (b.featured_order || 0); });
  var hot = featured.length ? featured.slice(0, 10) : allGames.slice(0, 9);
  renderTop10(hot);
  buildHomeProviderDropdown();
  renderHomeFiltered();
  renderCategorySection('live', 'liveGamesScroll');
  renderCategorySection('crash', 'crashGamesScroll');
}

function renderCategorySection(category, containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var games = allGames.filter(function(g) {
    return (g.category || '').toLowerCase() === category.toLowerCase();
  });
  if (!games.length) { el.closest('.game-section').style.display = 'none'; return; }
  el.innerHTML = games.map(function(g) { return gameCardHTML(g); }).join('');
}

/* ========== TOP 10 SLIDER ========== */
function top10CardHTML(game, rank) {
  if (!game.image_url) return '';
  var img = game.image_url;
  var name = game.game_name || 'Jogo';
  var code = game.game_code || '';
  var h = '<a href="/game/' + code + '" class="top10-card" title="' + name + '" style="text-decoration:none">';
  h += '<span class="top10-rank">' + rank + '</span>';
  h += '<div class="top10-img-wrap">';
  h += '<span class="top10-badge">' + rank + '</span>';
  h += '<img src="' + img + '" alt="' + name + '" draggable="false" loading="lazy" onerror="this.onerror=null;this.closest(\'a\').style.display=\'none\'">';
  h += '<div class="top10-hover"><span class="top10-play">&#9654; JOGAR</span></div>';
  h += '</div>';
  h += '</a>';
  return h;
}

var top10Offset = 0;
var top10Total = 0;

function renderTop10(games) {
  var track = document.getElementById('top10Track');
  if (!track) return;
  var list = games.slice(0, 10);
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

if (bannerPrev) bannerPrev.addEventListener('click', function() {
  if (isMobile() && bannerSlider) {
    var slide = bannerSlider.querySelector('.banner-slide');
    if (slide) bannerSlider.scrollBy({ left: -(slide.offsetWidth + 10), behavior: 'smooth' });
  } else {
    showBanner(bannerIndex - 1); startBannerAuto();
  }
});
if (bannerNext) bannerNext.addEventListener('click', function() {
  if (isMobile() && bannerSlider) {
    var slide = bannerSlider.querySelector('.banner-slide');
    if (slide) bannerSlider.scrollBy({ left: slide.offsetWidth + 10, behavior: 'smooth' });
  } else {
    showBanner(bannerIndex + 1); startBannerAuto();
  }
});

/* Sync dots with scroll position on mobile */
if (bannerSlider && bannerDotsEl) {
  bannerSlider.addEventListener('scroll', function() {
    if (!isMobile()) return;
    var slides = getBannerSlides();
    if (!slides.length) return;
    var scrollLeft = bannerSlider.scrollLeft;
    var slideW = slides[0].offsetWidth + 10;
    var idx = Math.round(scrollLeft / slideW);
    var dots = bannerDotsEl.querySelectorAll('.dot');
    dots.forEach(function(d, i) { d.classList.toggle('active', i === idx); });
  });
}

/* ========== TOUCH SWIPE —šÂ¬ TOP10 ========== */
(function() {
  var vp = document.querySelector('.top10-viewport');
  if (!vp) return;
  var startX = 0, startY = 0, dragging = false;
  vp.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragging = true;
  }, { passive: true });
  vp.addEventListener('touchmove', function(e) {
    if (!dragging) return;
    var dx = e.touches[0].clientX - startX;
    var dy = e.touches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      e.preventDefault();
    }
  }, { passive: false });
  vp.addEventListener('touchend', function(e) {
    if (!dragging) return;
    dragging = false;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) slideTop10(dx < 0 ? 1 : -1);
  }, { passive: true });
})();

/* ========== TOUCH SWIPE —šÂ¬ BANNER (desktop mode) ========== */
(function() {
  if (!bannerSlider) return;
  var startX = 0, dragging = false;
  bannerSlider.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX;
    dragging = true;
  }, { passive: true });
  bannerSlider.addEventListener('touchend', function(e) {
    if (!dragging) return;
    dragging = false;
    /* On mobile the CSS scroll-snap handles swipe natively; only act on desktop-style slider */
    if (window.innerWidth <= 768) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) {
      showBanner(bannerIndex + (dx < 0 ? 1 : -1));
      startBannerAuto();
    }
  }, { passive: true });
})();

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

/* Bottom nav Menu button ‚¬ opens sidebar on mobile */
var bnavMenu = document.getElementById('bnav-menu');
if (bnavMenu) bnavMenu.addEventListener('click', function(e) {
  e.preventDefault();
  if (isMobile()) {
    if (sidebar) sidebar.classList.toggle('mobile-open');
    if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
  }
});

/* CASSINO accordion */
if (menuToggle) menuToggle.addEventListener('click', function() {
  menuToggle.classList.toggle('collapsed');
  if (menuList) {
    menuList.style.maxHeight = menuToggle.classList.contains('collapsed') ? '0' : menuList.scrollHeight + 'px';
  }
  syncCollapsedSections();
});

/* ESPORTES group accordion —šÂ¬ toggles esportes + popular + top5 */
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
      if (logged) {
        refreshWalletUI();
        // Ensure login timer persists across deploys
        if (!sessionStorage.getItem('acctLoginStart')) {
          sessionStorage.setItem('acctLoginStart', String(Date.now()));
          acctLoginStart = Date.now();
        }
        // Helper: detect email-like values (not a real name)
        function isEmail(v) { return v && v.indexOf('@') !== -1; }
        // Set user name in dropdown (skip if it looks like an email)
        var nameEl = document.getElementById('dropdownUserName');
        if (nameEl && j.user) {
          var safeName = (!isEmail(j.user.name)) ? j.user.name : null;
          nameEl.textContent = safeName || 'Usuário';
        }
        // Set date
        var dateEl = document.getElementById('dropdownDate');
        if (dateEl) dateEl.textContent = 'Atualizado em: ' + new Date().toLocaleString('pt-BR');
        // Wallet section
        var wBal = document.getElementById('walletMainBalance');
        var wUid = document.getElementById('walletUserId');
        if (wUid && j.user) wUid.textContent = j.user.id || '';
        // Account section data
        var acctName = document.getElementById('acctFooterName');
        var safeFooterName = (j.user && !isEmail(j.user.name)) ? j.user.name : null;
        if (acctName) acctName.textContent = safeFooterName || 'Usuário';
        // Mirror name to all footer bars
        var uName = safeFooterName || 'Usuário';
        document.querySelectorAll('.acctFooterNameMirror').forEach(function(e) { e.textContent = uName; });
        var acctUid = document.getElementById('acctUserId');
        if (acctUid && j.user) acctUid.value = j.user.id || '—šÂ¬';
        var acctEmail = document.getElementById('acctEmailValue');
        var userEmail = (j.user && (j.user.email || j.user.username)) || '';
        if (acctEmail && userEmail) acctEmail.textContent = userEmail;
        // Dropdown email
        var ddEmail = document.getElementById('dropdownUserEmail');
        if (ddEmail && userEmail) ddEmail.textContent = userEmail;
        // Dropdown user ID
        var ddUid = document.getElementById('dropdownUserId');
        if (ddUid && j.user) ddUid.textContent = 'ID: ' + (j.user.id || '');
        // Phone
        var acctPhoneVal = document.getElementById('acctPhoneValue');
        var acctPhoneInp = document.getElementById('acctPhoneInput');
        if (j.user && j.user.phone) {
          var ph = j.user.phone.replace(/\D/g,'');
          var fmtPh = ph.length >= 11 ? '(' + ph.slice(0,2) + ') ' + ph.slice(2,7) + '-' + ph.slice(7) : j.user.phone;
          if (acctPhoneVal) acctPhoneVal.textContent = '+55 ' + fmtPh;
          if (acctPhoneInp) acctPhoneInp.value = fmtPh;
        }
        // Address
        if (j.user.address_cep) {
          var add = (j.user.address_street || '') + ' - ' + (j.user.address_city || '') + ', ' + (j.user.address_state || '');
          var addrVal = document.getElementById('acctAddressValue');
          if (addrVal) addrVal.textContent = add;
          var cepInp = document.getElementById('acctCep');
          if (cepInp) cepInp.value = j.user.address_cep;
          var ruaInp = document.getElementById('acctRua');
          if (ruaInp) ruaInp.value = j.user.address_street || '';
          var cidInp = document.getElementById('acctCidade');
          if (cidInp) cidInp.value = j.user.address_city || '';
          var estInp = document.getElementById('acctEstado');
          if (estInp) estInp.value = j.user.address_state || '';
        }
        // CPF/Doc
        if (j.user.cpf) {
          var c = j.user.cpf.replace(/\D/g,'');
          var fmtCpf = c.slice(0,3) + '.' + c.slice(3,6) + '.' + c.slice(6,9) + '-' + c.slice(9);
          var docVal = document.getElementById('acctDocValue');
          if (docVal) docVal.textContent = fmtCpf;
          var cpfInp = document.getElementById('acctCpfInput');
          if (cpfInp) cpfInp.value = fmtCpf;
        }
        // PIX
        var pixType = j.user.pix_type || 'cpf';
        var sel = document.getElementById('acctPixType');
        if (sel) sel.value = pixType;
        var pInp = document.getElementById('acctPixKeyInput');
        if (pInp && j.user.pix_key) pInp.value = j.user.pix_key;
        var pSum = document.getElementById('acctPixSummary');
        if (pSum) {
          if (j.user.pix_key) {
            pSum.textContent = '— ' + pixType.toUpperCase() + ': ' + j.user.pix_key;
          } else if (j.user.cpf) {
            var pc = j.user.cpf.replace(/\D/g,'');
            pSum.textContent = '— CPF: ' + pc.slice(0,3) + '.' + pc.slice(3,6) + '.' + pc.slice(6,9) + '-' + pc.slice(9);
          }
        }
        // Name (skip if it looks like an email)
        var nameInp = document.getElementById('acctNomeCompleto');
        if (nameInp && j.user.name && !isEmail(j.user.name)) {
          nameInp.value = j.user.name;
        }
        // Photo card user info
        var photoUserName = document.getElementById('acctPhotoUserName');
        if (photoUserName && j.user) {
          var rawName = (!isEmail(j.user.name)) ? (j.user.name || '') : '';
          var firstName = rawName.split(' ')[0] || 'Usuário';
          photoUserName.textContent = firstName;
        }
        var photoUserId = document.getElementById('acctPhotoUserId');
        if (photoUserId && j.user) photoUserId.textContent = 'ID: ' + (j.user.id || '—šÂ¬');
        // Birth date
        if (j.user.birth_date) {
          var bd = new Date(j.user.birth_date);
          var bdStr = bd.toLocaleDateString('pt-BR');
          var bdInp = document.getElementById('acctBirthInput');
          if (bdInp) bdInp.value = bdStr;
        }
        // Doc summary (CPF + birth)
        if (j.user.cpf || j.user.birth_date) {
          var docVal2 = document.getElementById('acctDocValue');
          if (docVal2) {
            var parts = [];
            if (j.user.cpf) { var cc = j.user.cpf.replace(/\D/g,''); parts.push(cc.slice(0,3)+'.'+cc.slice(3,6)+'.'+cc.slice(6,9)+'-'+cc.slice(9)); }
            if (j.user.birth_date) { parts.push(new Date(j.user.birth_date).toLocaleDateString('pt-BR')); }
            docVal2.textContent = parts.join(' - ');
          }
        }
        // Login history
        populateLoginHistory();
        // Limits
        populateLimits(j.user);
        // PIX on sacar
        populateSacarPix(j.user);
        // Avatar
        if (j.user.avatar_url && typeof setAvatarEverywhere === 'function') {
          setAvatarEverywhere(j.user.avatar_url);
        }
        // Notifications + Indique
        if (typeof startNotifPolling === 'function') startNotifPolling();
        if (typeof setupIndiqueLink === 'function') setupIndiqueLink();
      }
    }).catch(function() {
      document.body.classList.add('is-guest');
      document.body.classList.remove('is-logged');
    });
}

/* ========== AUTH BUTTONS ========== */
var btnOpenRegister = document.getElementById('btnOpenRegister');
var btnOpenLogin = document.getElementById('btnOpenLogin');
if (btnOpenRegister) btnOpenRegister.addEventListener('click', function() {
  if (typeof openRegisterModal === 'function') openRegisterModal();
});
if (btnOpenLogin) btnOpenLogin.addEventListener('click', function() {
  if (typeof openLoginModal === 'function') openLoginModal();
});

/* ========== LOGGED-IN HEADER ========== */
// Deposit button
var btnDeposit = document.getElementById('btnDeposit');
if (btnDeposit) btnDeposit.addEventListener('click', function() {
  if (!document.body.classList.contains('is-logged')) {
    if (typeof openLoginModal === 'function') openLoginModal();
    return;
  }
  if (typeof openDepositModal === 'function') {
    openDepositModal();
  } else {
    window.location.href = '/?panel=depositar';
  }
});

// Refresh balance
var topbarRefresh = document.getElementById('topbarRefresh');
if (topbarRefresh) topbarRefresh.addEventListener('click', function(e) {
  e.stopPropagation();
  topbarRefresh.classList.add('spinning');
  refreshWalletUI();
  setTimeout(function() { topbarRefresh.classList.remove('spinning'); }, 600);
});

// Balance button opens wallet section
var topbarBalanceBtn = document.getElementById('topbarBalanceBtn');
if (topbarBalanceBtn) topbarBalanceBtn.addEventListener('click', function() {
  showWalletSection('carteira');
  if (topbarDropdown && topbarDropdown.classList.contains('open')) topbarDropdown.classList.remove('open');
});

// User dropdown
var topbarUserBtn = document.getElementById('topbarUserBtn');
var topbarDropdown = document.getElementById('topbarDropdown');
if (topbarUserBtn && topbarDropdown) {
  topbarUserBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    topbarDropdown.classList.toggle('open');
  });
  document.addEventListener('click', function(e) {
    if (topbarDropdown.classList.contains('open') && !topbarDropdown.contains(e.target) && e.target !== topbarUserBtn) {
      topbarDropdown.classList.remove('open');
    }
  });
}

// Logout
var dropdownLogout = document.getElementById('dropdownLogout');
if (dropdownLogout) dropdownLogout.addEventListener('click', function(e) {
  e.preventDefault();
  sessionStorage.removeItem('acctLoginStart');
  fetch('/api/logout', { method: 'POST', credentials: 'include' })
    .then(function() { window.location.reload(); })
    .catch(function() { window.location.reload(); });
});

// Dropdown Menu ‚¬ toggles sidebar (same as bars)
var dropdownMenu = document.getElementById('dropdownMenu');
if (dropdownMenu) dropdownMenu.addEventListener('click', function(e) {
  e.preventDefault();
  if (topbarDropdown) topbarDropdown.classList.remove('open');
  if (isMobile()) {
    if (sidebar) sidebar.classList.toggle('mobile-open');
    if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
  } else {
    if (barsToggle) barsToggle.click();
  }
});

// Dropdown Wallet ‚¬ open wallet section with saldo sub-menu
var dropdownWallet = document.getElementById('dropdownWallet');
if (dropdownWallet) dropdownWallet.addEventListener('click', function(e) {
  e.preventDefault();
  if (topbarDropdown) topbarDropdown.classList.remove('open');
  showWalletSection('carteira');
});

/* ========== THEME TOGGLE ========== */
function setTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('vemNaBetTheme', mode);
  document.querySelectorAll('.theme-btn-dark').forEach(function(b) { b.classList.toggle('active', mode === 'dark'); });
  document.querySelectorAll('.theme-btn-light').forEach(function(b) { b.classList.toggle('active', mode === 'light'); });
  document.querySelectorAll('.wallet-theme-card').forEach(function(c) {
    c.classList.toggle('active', c.getAttribute('data-set-theme') === mode);
  });
}
// Init theme from localStorage
(function() {
  var saved = localStorage.getItem('vemNaBetTheme') || 'dark';
  setTheme(saved);
})();
document.querySelectorAll('#themeDark, .theme-btn-dark').forEach(function(btn) {
  btn.addEventListener('click', function(e) { e.preventDefault(); setTheme('dark'); });
});
document.querySelectorAll('#themeLight, .theme-btn-light').forEach(function(btn) {
  btn.addEventListener('click', function(e) { e.preventDefault(); setTheme('light'); });
});

/* ========== WALLET ========== */
function refreshWalletUI() {
  fetch('/api/wallet', { credentials: 'include' })
    .then(function(res) { return res.json().catch(function() { return null; }); })
    .then(function(j) {
      if (!j || !j.ok) return;
      var bal = j.balance_brl || '0,00';
      document.querySelectorAll('#walletBalance, .topbar-balance-val').forEach(function(el) {
        el.textContent = 'R$ ' + bal;
      });
      var wBal = document.getElementById('walletMainBalance');
      if (wBal) wBal.textContent = bal;
      document.querySelectorAll('.walletBalanceMirror').forEach(function(el) { el.textContent = bal; });
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

/* ========== WALLET SECTION (show/hide home) ========== */
function showWalletSection(panel) {
  // If not on home page, redirect to home with panel param
  if (!document.getElementById('homeContent')) {
    window.location.href = '/?panel=' + encodeURIComponent(panel);
    return;
  }
  // Depositar —šÂ¬ just open modal, don't navigate
  if (panel === 'depositar') {
    if (typeof openDepositModal === 'function') openDepositModal();
    return;
  }
  var home = document.getElementById('homeContent');
  var wallet = document.getElementById('wallet-section');
  if (home) home.style.display = 'none';
  if (wallet) wallet.style.display = '';

  // Determine which menu to show
  var subPanels = ['perfil','dadosConta','loginSeg','histLogin','jogoResp'];
  var saldoPanels = ['saldo','carteira','sacar','histTransacoes'];
  var apostasPanels = ['apostas','apostasCassino','apostasEsportivas'];
  var isSubPanel = panel && subPanels.indexOf(panel) !== -1;
  var isSaldoPanel = panel && saldoPanels.indexOf(panel) !== -1;
  var isApostasPanel = panel && apostasPanels.indexOf(panel) !== -1;

  if (isSubPanel) {
    showWalletSubMenu();
  } else if (isSaldoPanel) {
    showSaldoSubMenu();
  } else if (isApostasPanel) {
    showApostasSubMenu();
  }

  if (panel) {
    var activeMenu;
    if (isSubPanel) activeMenu = document.getElementById('walletSubMenu');
    else if (isSaldoPanel) activeMenu = document.getElementById('walletSubMenuSaldo');
    else if (isApostasPanel) activeMenu = document.getElementById('walletSubMenuApostas');
    else activeMenu = document.getElementById('walletMainMenu');
    if (activeMenu) {
      activeMenu.querySelectorAll('.wallet-nav-item').forEach(function(n) { n.classList.remove('active'); });
      var navItem = activeMenu.querySelector('.wallet-nav-item[data-panel="' + panel + '"]');
      if (navItem) navItem.classList.add('active');
    }
    document.querySelectorAll('.wallet-panel').forEach(function(p) { p.classList.remove('active'); });
    var target = document.getElementById('walletPanel' + panel.charAt(0).toUpperCase() + panel.slice(1));
    if (target) target.classList.add('active');
    // Load withdrawals when sacar panel is shown
    if (panel === 'sacar') loadWithdrawals();
    // Load transactions when history panel is shown
    if (panel === 'histTransacoes') loadTransactions();
    // Load notifications when panel shown
    if (panel === 'notif' && typeof loadNotifications === 'function') loadNotifications();
  }

  // Set initial mobile state
  if (isMobile()) {
    if (panel && (subPanels.indexOf(panel) !== -1 && panel !== 'perfil')) {
      _walletMobileReturnTo = 'perfil';
      var navI = document.querySelector('#walletSubMenu .wallet-nav-item[data-panel="' + panel + '"]');
      setWalletMobileState('content', navI ? navI.textContent.trim() : panel);
    } else if (panel && (saldoPanels.indexOf(panel) !== -1 && panel !== 'saldo')) {
      _walletMobileReturnTo = 'saldo';
      var navS = document.querySelector('#walletSubMenuSaldo .wallet-nav-item[data-panel="' + panel + '"]');
      setWalletMobileState('content', navS ? navS.textContent.trim() : panel);
    } else if (panel && (apostasPanels.indexOf(panel) !== -1 && panel !== 'apostas')) {
      _walletMobileReturnTo = 'apostas';
      var navA = document.querySelector('#walletSubMenuApostas .wallet-nav-item[data-panel="' + panel + '"]');
      setWalletMobileState('content', navA ? navA.textContent.trim() : panel);
    } else if (isSubPanel || isSaldoPanel || isApostasPanel) {
      setWalletMobileState('submenu');
    } else {
      setWalletMobileState('nav');
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function hideWalletSection() {
  var home = document.getElementById('homeContent');
  var wallet = document.getElementById('wallet-section');
  if (home) home.style.display = '';
  if (wallet) wallet.style.display = 'none';
  // Reset to main menu
  hideWalletSubMenu();
  setWalletMobileState('nav');
}

/* ========== MOBILE WALLET STATES ========== */
var _walletMobileReturnTo = null; // tracks which sub-menu to return to from content view

function setWalletMobileState(state, label) {
  if (!isMobile()) return;
  var grid = document.querySelector('.wallet-grid');
  if (!grid) return;
  var contentBack = document.getElementById('walletContentBack');
  var contentBackLabel = document.getElementById('walletContentBackLabel');
  grid.classList.remove('mobile-nav-view', 'mobile-submenu-view', 'mobile-content-view');
  if (state === 'nav') {
    grid.classList.add('mobile-nav-view');
    if (contentBack) contentBack.style.display = 'none';
  } else if (state === 'submenu') {
    grid.classList.add('mobile-submenu-view');
    if (contentBack) contentBack.style.display = 'none';
  } else if (state === 'content') {
    grid.classList.add('mobile-content-view');
    if (contentBack) contentBack.style.display = '';
    if (contentBackLabel && label) contentBackLabel.textContent = label;
  }
}

// Sub-menu show/hide
function showWalletSubMenu() {
  var main = document.getElementById('walletMainMenu');
  var sub = document.getElementById('walletSubMenu');
  var subSaldo = document.getElementById('walletSubMenuSaldo');
  var subApostas = document.getElementById('walletSubMenuApostas');
  if (main) main.style.display = 'none';
  if (sub) sub.style.display = '';
  if (subSaldo) subSaldo.style.display = 'none';
  if (subApostas) subApostas.style.display = 'none';
}
function showSaldoSubMenu() {
  var main = document.getElementById('walletMainMenu');
  var sub = document.getElementById('walletSubMenu');
  var subSaldo = document.getElementById('walletSubMenuSaldo');
  var subApostas = document.getElementById('walletSubMenuApostas');
  if (main) main.style.display = 'none';
  if (sub) sub.style.display = 'none';
  if (subSaldo) subSaldo.style.display = '';
  if (subApostas) subApostas.style.display = 'none';
}
function showApostasSubMenu() {
  var main = document.getElementById('walletMainMenu');
  var sub = document.getElementById('walletSubMenu');
  var subSaldo = document.getElementById('walletSubMenuSaldo');
  var subApostas = document.getElementById('walletSubMenuApostas');
  if (main) main.style.display = 'none';
  if (sub) sub.style.display = 'none';
  if (subSaldo) subSaldo.style.display = 'none';
  if (subApostas) subApostas.style.display = '';
}
function hideWalletSubMenu() {
  var main = document.getElementById('walletMainMenu');
  var sub = document.getElementById('walletSubMenu');
  var subSaldo = document.getElementById('walletSubMenuSaldo');
  var subApostas = document.getElementById('walletSubMenuApostas');
  if (main) main.style.display = '';
  if (sub) sub.style.display = 'none';
  if (subSaldo) subSaldo.style.display = 'none';
  if (subApostas) subApostas.style.display = 'none';
}

// Make accessible globally
window.showWalletSection = showWalletSection;
window.hideWalletSection = hideWalletSection;

// Sub-menu back button
var walletSubBack = document.getElementById('walletSubBack');
if (walletSubBack) walletSubBack.addEventListener('click', function(e) {
  e.preventDefault();
  hideWalletSubMenu();
  // Activate perfil panel + main menu item
  document.querySelectorAll('.wallet-nav-item').forEach(function(n) { n.classList.remove('active'); });
  var mainPerfil = document.querySelector('#walletMainMenu .wallet-nav-item[data-panel="perfil"]');
  if (mainPerfil) mainPerfil.classList.add('active');
  document.querySelectorAll('.wallet-panel').forEach(function(p) { p.classList.remove('active'); });
  var perfilPanel = document.getElementById('walletPanelPerfil');
  if (perfilPanel) perfilPanel.classList.add('active');
  setWalletMobileState('nav');
});

// Nav item switching —šÂ¬ main menu
document.querySelectorAll('#walletMainMenu .wallet-nav-item[data-panel]').forEach(function(item) {
  item.addEventListener('click', function(e) {
    e.preventDefault();
    var hasSubmenu = item.getAttribute('data-has-submenu');
    var panel = item.getAttribute('data-panel');
    // Tema —šÂ¬ do nothing (toggle buttons handle it inline)
    if (panel === 'tema') return;
    if (hasSubmenu === 'true') {
      // Open Meu Perfil sub-menu
      showWalletSubMenu();
      document.querySelectorAll('.wallet-nav-item').forEach(function(n) { n.classList.remove('active'); });
      document.querySelectorAll('.wallet-panel').forEach(function(p) { p.classList.remove('active'); });
      var perfilPanel = document.getElementById('walletPanelPerfil');
      if (perfilPanel) perfilPanel.classList.add('active');
      _walletMobileReturnTo = 'perfil';
      setWalletMobileState('submenu');
      return;
    }
    if (hasSubmenu === 'saldo') {
      // Open Gestão de Saldo sub-menu
      showSaldoSubMenu();
      document.querySelectorAll('.wallet-nav-item').forEach(function(n) { n.classList.remove('active'); });
      document.querySelectorAll('.wallet-panel').forEach(function(p) { p.classList.remove('active'); });
      var saldoPanel = document.getElementById('walletPanelCarteira');
      if (saldoPanel) saldoPanel.classList.add('active');
      var cartItem = document.querySelector('#walletSubMenuSaldo .wallet-nav-item[data-panel="carteira"]');
      if (cartItem) cartItem.classList.add('active');
      _walletMobileReturnTo = 'saldo';
      setWalletMobileState('submenu');
      return;
    }
    if (hasSubmenu === 'apostas') {
      // Open Histórico de Apostas sub-menu
      showApostasSubMenu();
      document.querySelectorAll('.wallet-nav-item').forEach(function(n) { n.classList.remove('active'); });
      document.querySelectorAll('.wallet-panel').forEach(function(p) { p.classList.remove('active'); });
      var cassinoPanel = document.getElementById('walletPanelApostasCassino');
      if (cassinoPanel) cassinoPanel.classList.add('active');
      var cassinoItem = document.querySelector('#walletSubMenuApostas .wallet-nav-item[data-panel="apostasCassino"]');
      if (cassinoItem) cassinoItem.classList.add('active');
      _walletMobileReturnTo = 'apostas';
      setWalletMobileState('submenu');
      return;
    }
    hideWalletSubMenu();
    document.querySelectorAll('.wallet-nav-item').forEach(function(n) { n.classList.remove('active'); });
    item.classList.add('active');
    document.querySelectorAll('.wallet-panel').forEach(function(p) { p.classList.remove('active'); });
    var target = document.getElementById('walletPanel' + panel.charAt(0).toUpperCase() + panel.slice(1));
    if (target) target.classList.add('active');
    // Items without sub-menu go directly to content view on mobile
    _walletMobileReturnTo = 'main';
    setWalletMobileState('content', item.textContent.trim().split('\n')[0].trim());
  });
});

// Nav item switching —šÂ¬ sub-menu (Meu Perfil)
document.querySelectorAll('#walletSubMenu .wallet-nav-item[data-panel]').forEach(function(item) {
  item.addEventListener('click', function(e) {
    e.preventDefault();
    document.querySelectorAll('#walletSubMenu .wallet-nav-item').forEach(function(n) { n.classList.remove('active'); });
    item.classList.add('active');
    var panel = item.getAttribute('data-panel');
    document.querySelectorAll('.wallet-panel').forEach(function(p) { p.classList.remove('active'); });
    var target = document.getElementById('walletPanel' + panel.charAt(0).toUpperCase() + panel.slice(1));
    if (target) target.classList.add('active');
    _walletMobileReturnTo = 'perfil';
    setWalletMobileState('content', item.textContent.trim());
    if (panel === 'sacar') loadWithdrawals();
    if (panel === 'histTransacoes') loadTransactions();
  });
});

// Nav item switching —šÂ¬ sub-menu (Gestão de Saldo)
document.querySelectorAll('#walletSubMenuSaldo .wallet-nav-item[data-panel]').forEach(function(item) {
  item.addEventListener('click', function(e) {
    e.preventDefault();
    var panel = item.getAttribute('data-panel');
    // Depositar —šÂ¬ just open modal, don't navigate
    if (panel === 'depositar') {
      if (typeof openDepositModal === 'function') openDepositModal();
      return;
    }
    document.querySelectorAll('#walletSubMenuSaldo .wallet-nav-item').forEach(function(n) { n.classList.remove('active'); });
    item.classList.add('active');
    document.querySelectorAll('.wallet-panel').forEach(function(p) { p.classList.remove('active'); });
    var target = document.getElementById('walletPanel' + panel.charAt(0).toUpperCase() + panel.slice(1));
    if (target) target.classList.add('active');
    if (panel === 'sacar') loadWithdrawals();
    if (panel === 'histTransacoes') loadTransactions();
    _walletMobileReturnTo = 'saldo';
    setWalletMobileState('content', item.textContent.trim());
  });
});

// Saldo sub-menu back button
var walletSubBackSaldo = document.getElementById('walletSubBackSaldo');
if (walletSubBackSaldo) walletSubBackSaldo.addEventListener('click', function(e) {
  e.preventDefault();
  hideWalletSubMenu();
  document.querySelectorAll('.wallet-nav-item').forEach(function(n) { n.classList.remove('active'); });
  var mainSaldo = document.querySelector('#walletMainMenu .wallet-nav-item[data-panel="saldo"]');
  if (mainSaldo) mainSaldo.classList.add('active');
  document.querySelectorAll('.wallet-panel').forEach(function(p) { p.classList.remove('active'); });
  var saldoPanel = document.getElementById('walletPanelSaldo');
  if (saldoPanel) saldoPanel.classList.add('active');
  setWalletMobileState('nav');
});

// Nav item switching —šÂ¬ sub-menu (Histórico de Apostas)
document.querySelectorAll('#walletSubMenuApostas .wallet-nav-item[data-panel]').forEach(function(item) {
  item.addEventListener('click', function(e) {
    e.preventDefault();
    document.querySelectorAll('#walletSubMenuApostas .wallet-nav-item').forEach(function(n) { n.classList.remove('active'); });
    item.classList.add('active');
    var panel = item.getAttribute('data-panel');
    document.querySelectorAll('.wallet-panel').forEach(function(p) { p.classList.remove('active'); });
    var target = document.getElementById('walletPanel' + panel.charAt(0).toUpperCase() + panel.slice(1));
    if (target) target.classList.add('active');
    _walletMobileReturnTo = 'apostas';
    setWalletMobileState('content', item.textContent.trim());
  });
});

// Apostas sub-menu back button
var walletSubBackApostas = document.getElementById('walletSubBackApostas');
if (walletSubBackApostas) walletSubBackApostas.addEventListener('click', function(e) {
  e.preventDefault();
  hideWalletSubMenu();
  document.querySelectorAll('.wallet-nav-item').forEach(function(n) { n.classList.remove('active'); });
  var mainApostas = document.querySelector('#walletMainMenu .wallet-nav-item[data-panel="apostas"]');
  if (mainApostas) mainApostas.classList.add('active');
  document.querySelectorAll('.wallet-panel').forEach(function(p) { p.classList.remove('active'); });
  var apostasPanel = document.getElementById('walletPanelApostasCassino');
  if (apostasPanel) apostasPanel.classList.add('active');
  setWalletMobileState('nav');
});

// Wallet deposit button —šÂ¬ just opens modal over current page
var walletDepositBtn = document.getElementById('walletDepositBtn');
if (walletDepositBtn) walletDepositBtn.addEventListener('click', function(e) {
  e.preventDefault();
  if (typeof openDepositModal === 'function') openDepositModal();
});

// Wallet sacar button in Meu Perfil —šÂ¬ go to sacar panel
var walletWithdrawBtn = document.getElementById('walletWithdrawBtn');
if (walletWithdrawBtn) walletWithdrawBtn.addEventListener('click', function(e) {
  e.preventDefault();
  showWalletSection('sacar');
});

// Mobile content-back button
var walletContentBack = document.getElementById('walletContentBack');
if (walletContentBack) walletContentBack.addEventListener('click', function(e) {
  e.preventDefault();
  if (_walletMobileReturnTo === 'perfil') {
    showWalletSubMenu();
    document.querySelectorAll('.wallet-panel').forEach(function(p) { p.classList.remove('active'); });
    var perfilPanel = document.getElementById('walletPanelPerfil');
    if (perfilPanel) perfilPanel.classList.add('active');
    document.querySelectorAll('#walletSubMenu .wallet-nav-item').forEach(function(n) { n.classList.remove('active'); });
    setWalletMobileState('submenu');
  } else if (_walletMobileReturnTo === 'saldo') {
    showSaldoSubMenu();
    document.querySelectorAll('.wallet-panel').forEach(function(p) { p.classList.remove('active'); });
    var cartPanel = document.getElementById('walletPanelCarteira');
    if (cartPanel) cartPanel.classList.add('active');
    document.querySelectorAll('#walletSubMenuSaldo .wallet-nav-item').forEach(function(n) { n.classList.remove('active'); });
    var cartItem = document.querySelector('#walletSubMenuSaldo .wallet-nav-item[data-panel="carteira"]');
    if (cartItem) cartItem.classList.add('active');
    setWalletMobileState('submenu');
  } else if (_walletMobileReturnTo === 'apostas') {
    showApostasSubMenu();
    document.querySelectorAll('.wallet-panel').forEach(function(p) { p.classList.remove('active'); });
    var casPanel = document.getElementById('walletPanelApostasCassino');
    if (casPanel) casPanel.classList.add('active');
    document.querySelectorAll('#walletSubMenuApostas .wallet-nav-item').forEach(function(n) { n.classList.remove('active'); });
    var casItem = document.querySelector('#walletSubMenuApostas .wallet-nav-item[data-panel="apostasCassino"]');
    if (casItem) casItem.classList.add('active');
    setWalletMobileState('submenu');
  } else {
    hideWalletSubMenu();
    setWalletMobileState('nav');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ========== ACCOUNT SECTION EXPAND/COLLAPSE ========== */
function toggleAcctSection(id) {
  var section = document.getElementById(id);
  if (!section) return;
  section.classList.toggle('open');
  var btn = section.querySelector('.acct-toggle-btn');
  if (btn) {
    if (section.classList.contains('open')) {
      btn.textContent = 'CANCELAR';
    } else {
      // Restore original text
      var origTexts = { acctEmail:'EDITAR', acctCelular:'EDITAR', acctEndereco:'EDITAR',
        acctDocumento:'VER DADOS', acctContratos:'VISUALIZAR', acctPix:'EDITAR',
        acctDados:'VER DADOS', acctSenha:'EDITAR' };
      btn.textContent = origTexts[id] || 'EDITAR';
    }
  }
}
window.toggleAcctSection = toggleAcctSection;

/* ========== ACCOUNT LOGGED TIME TIMER ========== */
var acctLoginStart = parseInt(sessionStorage.getItem('acctLoginStart')) || Date.now();
var acctTimerInterval = null;

function startAcctTimer() {
  var el = document.getElementById('acctLoggedTime');
  if (!el) return;
  if (acctTimerInterval) clearInterval(acctTimerInterval);
  acctTimerInterval = setInterval(function() {
    var diff = Math.floor((Date.now() - acctLoginStart) / 1000);
    var m = Math.floor(diff / 60);
    var s = diff % 60;
    var txt = (m < 10 ? '0' : '') + m + 'm ' + (s < 10 ? '0' : '') + s + 's';
    el.textContent = txt;
    document.querySelectorAll('.acctLoggedTimeMirror').forEach(function(e) { e.textContent = txt; });
  }, 1000);
}

function updateAcctInfo() {
  // Set last login
  var lastLogin = document.getElementById('acctLastLogin');
  var now = new Date();
  var loginTxt = now.toLocaleDateString('pt-BR') + ', ' +
    now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (lastLogin) lastLogin.textContent = loginTxt;
  document.querySelectorAll('.acctLastLoginMirror').forEach(function(e) { e.textContent = loginTxt; });
  // Set current time for login history
  var currentTime = document.getElementById('acctCurrentTime');
  if (currentTime) {
    currentTime.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  startAcctTimer();
}
// Start timer on load
updateAcctInfo();

// Wallet logout
var walletLogout = document.getElementById('walletLogout');
if (walletLogout) walletLogout.addEventListener('click', function(e) {
  e.preventDefault();
  fetch('/api/logout', { method: 'POST', credentials: 'include' })
    .then(function() { window.location.reload(); })
    .catch(function() { window.location.reload(); });
});

// Wallet theme cards
document.querySelectorAll('.wallet-theme-card[data-set-theme]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var mode = btn.getAttribute('data-set-theme');
    if (typeof setTheme === 'function') setTheme(mode);
    document.querySelectorAll('.wallet-theme-card').forEach(function(c) { c.classList.remove('active'); });
    btn.classList.add('active');
  });
});

// Dropdown links that open wallet panels
var dropdownPanelMap = {
  'dropdownNotif': 'notif',
  'dropdownPrizes': 'premios',
  'dropdownBets': 'apostasCassino',
  'dropdownReferrals': 'indique',
  'dropdownPerfil': 'perfil',
  'dropdownPassword': 'loginSeg',
  'dropdownSupport': null,
  'dropdownPromos': null
};
Object.keys(dropdownPanelMap).forEach(function(id) {
  var el = document.getElementById(id);
  var panel = dropdownPanelMap[id];
  if (el && panel) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      if (topbarDropdown) topbarDropdown.classList.remove('open');
      showWalletSection(panel);
    });
  }
});

// Logo click ‚¬ back to home
var topbarLogo = document.querySelector('.topbar-logo');
if (topbarLogo) {
  topbarLogo.addEventListener('click', function(e) {
    var wallet = document.getElementById('wallet-section');
    if (wallet && wallet.style.display !== 'none') {
      e.preventDefault();
      hideWalletSection();
    }
  });
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
  '/public/img/games/2.webp','/public/img/games/3.webp',
  '/public/img/games/4.webp','/public/img/games/5.webp','/public/img/games/6.webp',
  '/public/img/games/7.webp','/public/img/games/8.webp','/public/img/games/9.webp',
  '/public/img/games/10.webp','/public/img/games/11.webp','/public/img/games/12.webp'
];

function randomName() {
  return fakeNames[Math.floor(Math.random() * fakeNames.length)] + ' ***';
}
function randomGame() {
  var gamesWithImg = allGames.filter(function(g) { return g.image_url; });
  if (gamesWithImg.length > 0) {
    var g = gamesWithImg[Math.floor(Math.random() * gamesWithImg.length)];
    return { name: g.game_name || 'Jogo', img: g.image_url };
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
  var firstCard = cards[0];
  var gap = 12;
  var cardW = firstCard.offsetWidth + gap;
  var wrapper = track.parentElement;
  var visibleCount = wrapper ? Math.max(1, Math.floor(wrapper.offsetWidth / cardW)) : 3;
  var maxIdx = Math.max(0, cards.length - visibleCount);
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

/* ========== ÃÆ’Ã…Â¡LTIMAS APOSTAS RENDER + VERTICAL SCROLL ========== */
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
      '<span class="aposta-arrow">‚¬</span>' +
      '<span class="aposta-win">' + a.win + '</span>' +
    '</div>' +
    '<span class="aposta-chevron">—šÂ¬Ã‚Âº</span>' +
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
function dismissPreloader() {
  var pl = document.getElementById('pagePreloader');
  if (pl) {
    pl.classList.add('fade-out');
    setTimeout(function() { pl.remove(); }, 500);
  }
}

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
    if (window.innerWidth > 768) startBannerAuto();
    updateAuthState().then(function() {
      dismissPreloader();
      // Auto-open deposit modal if redirected from registration
      if (window.location.search.indexOf('openDeposit=1') !== -1) {
        history.replaceState(null, '', window.location.pathname);
        setTimeout(function() {
          if (typeof openDepositModal === 'function') openDepositModal();
        }, 300);
      }
      // Auto-open panel if redirected from game/games page
      var panelParam = new URLSearchParams(window.location.search).get('panel');
      if (panelParam) {
        history.replaceState(null, '', window.location.pathname);
        setTimeout(function() {
          if (panelParam === 'depositar' && typeof openDepositModal === 'function') {
            openDepositModal();
          } else {
            showWalletSection(panelParam);
          }
        }, 300);
      }
    }).catch(dismissPreloader);
  }).catch(function() {
    dismissPreloader();
  });
}

/* ========== SAVE ACCOUNT FIELD ========== */
function saveAcctField(type) {
  if (type === 'phone') {
    var phoneInp = document.getElementById('acctPhoneInput');
    if (!phoneInp || !phoneInp.value.trim()) { showToast('Informe o celular.', 'error'); return; }
    fetch('/api/user/update-phone', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneInp.value.replace(/\D/g,'') })
    }).then(function(r) { return r.json(); }).then(function(j) {
      if (j.ok) {
        showToast(j.msg, 'success');
        var d = document.getElementById('acctPhoneValue');
        if (d) d.textContent = '+55 ' + phoneInp.value;
        toggleAcctSection('acctCelular');
      } else { showToast(j.msg || 'Erro', 'error'); }
    }).catch(function() { showToast('Erro de conexão.', 'error'); });
    return;
  }
  if (type === 'address') {
    var cep = document.getElementById('acctCep');
    var rua = document.getElementById('acctRua');
    var cidade = document.getElementById('acctCidade');
    var estado = document.getElementById('acctEstado');
    fetch('/api/user/update-address', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cep: cep ? cep.value : '', street: rua ? rua.value : '', city: cidade ? cidade.value : '', state: estado ? estado.value : '' })
    }).then(function(r) { return r.json(); }).then(function(j) {
      if (j.ok) {
        showToast(j.msg, 'success');
        var d = document.getElementById('acctAddressValue');
        if (d) d.textContent = (rua ? rua.value : '') + ' - ' + (cidade ? cidade.value : '') + ', ' + (estado ? estado.value : '');
        toggleAcctSection('acctEndereco');
      } else { showToast(j.msg || 'Erro', 'error'); }
    }).catch(function() { showToast('Erro de conexão.', 'error'); });
    return;
  }
  if (type === 'pix') {
    var pixType = document.getElementById('acctPixType');
    var pixKey = document.getElementById('acctPixKeyInput');
    if (!pixKey || !pixKey.value.trim()) { showToast('Informe a chave PIX.', 'error'); return; }
    fetch('/api/user/update-pix', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pix_type: pixType ? pixType.value : 'cpf', pix_key: pixKey.value })
    }).then(function(r) { return r.json(); }).then(function(j) {
      if (j.ok) {
        showToast(j.msg, 'success');
        var d = document.getElementById('acctPixSummary');
        if (d) d.textContent = '— ' + (pixType ? pixType.value.toUpperCase() : 'CPF') + ': ' + pixKey.value;
        toggleAcctSection('acctPix');
      } else { showToast(j.msg || 'Erro', 'error'); }
    }).catch(function() { showToast('Erro de conexão.', 'error'); });
    return;
  }
  if (type === 'password') {
    var cur = document.getElementById('acctSenhaAtual');
    var nova = document.getElementById('acctSenhaNova');
    var conf = document.getElementById('acctSenhaConfirm');
    if (!cur || !nova || !conf) return;
    if (!cur.value || !nova.value) { showToast('Preencha todos os campos.', 'error'); return; }
    if (nova.value !== conf.value) { showToast('As senhas não coincidem.', 'error'); return; }
    if (nova.value.length < 6) { showToast('Mínimo 6 caracteres.', 'error'); return; }
    fetch('/api/user/change-password', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: cur.value, new_password: nova.value })
    }).then(function(r) { return r.json(); }).then(function(j) {
      if (j.ok) {
        showToast(j.msg, 'success');
        cur.value = ''; nova.value = ''; conf.value = '';
        toggleAcctSection('acctSenha');
      } else { showToast(j.msg || 'Erro', 'error'); }
    }).catch(function() { showToast('Erro de conexão.', 'error'); });
    return;
  }
  // Generic (pausas, etc)
  if (type === 'pausaTemp' || type === 'autoExclusao') {
    showToast('Configuração salva com sucesso!', 'success');
    return;
  }
  showToast('Salvo com sucesso!', 'success');
}
window.saveAcctField = saveAcctField;

/* ========== TOGGLE LIMIT FORM ========== */
var _limitsLoaded = false;
function toggleLimitForm(formId, value) {
  var form = document.getElementById(formId);
  if (!form) return;
  var fields = form.querySelector('.acct-limit-fields');
  var tag = document.getElementById('tag' + formId.charAt(0).toUpperCase() + formId.slice(1));
  if (value === 'unlimited' || value === 'no') {
    if (fields) fields.style.display = 'none';
    if (tag) { tag.style.display = ''; tag.textContent = 'Ilimitado'; tag.style.background = 'rgba(34,197,94,.15)'; tag.style.color = '#22c55e'; }
    // Auto-save when user switches back to unlimited (not on initial load)
    if (_limitsLoaded) saveLimits();
  } else {
    if (fields) fields.style.display = '';
    if (tag) { tag.textContent = 'Personalizado'; tag.style.background = 'rgba(37,211,102,.12)'; tag.style.color = '#25D366'; }
  }
}
window.toggleLimitForm = toggleLimitForm;

/* ========== PIX MASK ========== */
var pixMaskHandler = null;
function updatePixMask() {
  var sel = document.getElementById('acctPixType');
  var inp = document.getElementById('acctPixKeyInput');
  var label = document.getElementById('acctPixKeyLabel');
  if (!sel || !inp) return;
  var type = sel.value;
  var masks = { cpf: '000.000.000-00', email: 'email@exemplo.com', phone: '(00) 00000-0000', random: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' };
  var labels = { cpf: 'Chave PIX (CPF)', email: 'Chave PIX (E-mail)', phone: 'Chave PIX (Celular)', random: 'Chave PIX (Aleatória)' };
  inp.placeholder = masks[type] || 'Chave PIX';
  inp.value = '';
  if (label) label.textContent = labels[type] || 'Chave PIX';
  // Remove old mask handler
  if (pixMaskHandler) inp.removeEventListener('input', pixMaskHandler);
  pixMaskHandler = null;
  // Apply mask for cpf/phone
  if (type === 'cpf') {
    pixMaskHandler = function() { applyMaskValue(inp, '000.000.000-00'); };
    inp.addEventListener('input', pixMaskHandler);
  } else if (type === 'phone') {
    pixMaskHandler = function() { applyMaskValue(inp, '(00) 00000-0000'); };
    inp.addEventListener('input', pixMaskHandler);
  }
}
window.updatePixMask = updatePixMask;

/* ========== INPUT MASKS ========== */
function applyMaskValue(el, mask) {
  var v = el.value.replace(/\D/g, '');
  var result = '';
  var vi = 0;
  for (var i = 0; i < mask.length && vi < v.length; i++) {
    if (mask[i] === '0') { result += v[vi]; vi++; }
    else { result += mask[i]; if (v[vi] === mask[i]) vi++; }
  }
  el.value = result;
}
function applyMask(el, mask) {
  if (!el) return;
  el.addEventListener('input', function() { applyMaskValue(el, mask); });
}
// CEP mask
applyMask(document.getElementById('acctCep'), '00000-000');
// Phone mask
applyMask(document.getElementById('acctPhoneInput'), '(00) 00000-0000');

/* ========== CEP AUTOCOMPLETE ========== */
var cepInput = document.getElementById('acctCep');
if (cepInput) {
  cepInput.addEventListener('blur', function() {
    var cep = cepInput.value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    fetch('https://viacep.com.br/ws/' + cep + '/json/')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.erro) { showToast('CEP não encontrado.', 'error'); return; }
        var rua = document.getElementById('acctRua');
        var cidade = document.getElementById('acctCidade');
        var estado = document.getElementById('acctEstado');
        if (rua && d.logradouro) rua.value = d.logradouro;
        if (cidade && d.localidade) cidade.value = d.localidade;
        if (estado && d.uf) estado.value = d.uf;
      }).catch(function() {});
  });
}

/* ========== PHOTO UPLOAD ========== */
function setAvatarEverywhere(src) {
  var img = document.getElementById('acctPhotoImg');
  if (img) img.src = src;
  var topAvatar = document.getElementById('topbarAvatar');
  if (topAvatar) topAvatar.src = src;
  document.querySelectorAll('.topbar-dropdown-avatar').forEach(function(a) { a.src = src; });
}
var acctPhotoInput = document.getElementById('acctPhotoInput');
var acctPhotoAlter = document.getElementById('acctPhotoAlter');
if (acctPhotoAlter) acctPhotoAlter.addEventListener('click', function() {
  if (acctPhotoInput) acctPhotoInput.click();
});
if (acctPhotoInput) {
  acctPhotoInput.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Selecione uma imagem válida.', 'error'); return; }
    if (file.size > 2 * 1024 * 1024) { showToast('Imagem muito grande (máx 2MB).', 'error'); return; }
    var reader = new FileReader();
    reader.onload = function(ev) {
      var src = ev.target.result;
      // Save to server
      fetch('/api/user/upload-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ avatar_url: src })
      }).then(function(r) { return r.json(); }).then(function(j) {
        if (j.ok) {
          setAvatarEverywhere(src);
          showToast('Foto atualizada!', 'success');
        } else {
          showToast(j.msg || 'Erro ao salvar foto.', 'error');
        }
      }).catch(function() { showToast('Erro ao salvar foto.', 'error'); });
    };
    reader.readAsDataURL(file);
  });
}
var acctPhotoRemove = document.getElementById('acctPhotoRemove');
if (acctPhotoRemove) acctPhotoRemove.addEventListener('click', function() {
  fetch('/api/user/remove-avatar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  }).then(function(r) { return r.json(); }).then(function(j) {
    if (j.ok) {
      var defaultSvg = '/public/img/novo/topo3.svg';
      setAvatarEverywhere(defaultSvg);
      if (acctPhotoInput) acctPhotoInput.value = '';
      showToast('Foto removida.', 'info');
    }
  }).catch(function() {});
});

/* ========== LOGIN HISTORY TABLE ========== */
function populateLoginHistory() {
  var body = document.getElementById('loginHistoryBody');
  var count = document.getElementById('loginHistoryCount');
  if (!body) return;
  fetch('/api/user/login-history', { credentials: 'include' })
    .then(function(r) { return r.json(); })
    .then(function(j) {
      if (!j.ok || !j.rows.length) {
        body.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted)">Nenhum registro encontrado.</td></tr>';
        if (count) count.textContent = '0 registros';
        return;
      }
      body.innerHTML = '';
      j.rows.forEach(function(r) {
        var d = new Date(r.created_at);
        var dt = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        var tr = document.createElement('tr');
        tr.innerHTML = '<td>' + dt + '</td><td>' + (r.ip || '—šÂ¬') + '</td><td>' + ((r.city || '') + (r.state ? ', ' + r.state : '') || '—šÂ¬') + '</td><td>' + (r.coords || '—šÂ¬') + '</td>';
        body.appendChild(tr);
      });
      if (count) count.textContent = 'Mostrando ' + j.rows.length + ' registro' + (j.rows.length > 1 ? 's' : '');
    }).catch(function() {
      body.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px">Erro ao carregar histórico.</td></tr>';
    });
}

/* ========== BRL MASK FOR LIMIT/WITHDRAWAL INPUTS ========== */
function applyBrlMask(el) {
  if (!el) return;
  el.addEventListener('input', function() {
    var v = el.value.replace(/\D/g, '');
    if (!v) { el.value = ''; return; }
    var cents = parseInt(v);
    var brl = (cents / 100).toFixed(2);
    var parts = brl.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    el.value = 'R$ ' + parts[0] + ',' + parts[1];
  });
}
function parseBrl(str) {
  if (!str) return 0;
  var v = str.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(v) || 0;
}
document.querySelectorAll('.brl-mask-input').forEach(function(el) { applyBrlMask(el); });

/* ========== SAVE LIMITS ========== */
function saveLimits() {
  var depType = document.querySelector('input[name="limitDepType"]:checked');
  var betType = document.querySelector('input[name="limitBetType"]:checked');
  var lossType = document.querySelector('input[name="limitLossType"]:checked');
  var timeType = document.querySelector('input[name="limitTimeType"]:checked');

  var data = {
    limit_deposit_type: depType ? depType.value : 'unlimited',
    limit_deposit_period: (document.getElementById('limitDepositPeriod') || {}).value || '',
    limit_deposit_amount: Math.round(parseBrl((document.getElementById('limitDepositAmount') || {}).value) * 100),
    limit_bet_type: betType ? betType.value : 'unlimited',
    limit_bet_period: (document.getElementById('limitBetPeriod') || {}).value || '',
    limit_bet_amount: Math.round(parseBrl((document.getElementById('limitBetAmount') || {}).value) * 100),
    limit_loss_type: lossType ? lossType.value : 'unlimited',
    limit_loss_period: (document.getElementById('limitLossPeriod') || {}).value || '',
    limit_loss_amount: Math.round(parseBrl((document.getElementById('limitLossAmount') || {}).value) * 100),
    limit_time_type: timeType ? timeType.value : 'unlimited',
    limit_time_period: (document.getElementById('limitTimePeriod') || {}).value || '',
    limit_time_value: (document.getElementById('limitTimeValue') || {}).value || ''
  };

  fetch('/api/user/update-limits', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(function(r) { return r.json(); }).then(function(j) {
    if (j.ok) showToast(j.msg, 'success');
    else showToast(j.msg || 'Erro', 'error');
  }).catch(function() { showToast('Erro de conexão.', 'error'); });
}
window.saveLimits = saveLimits;

/* ========== POPULATE LIMITS ========== */
function populateLimits(user) {
  if (!user) return;
  var limitDefs = [
    { key: 'deposit', radio: 'limitDepType', period: 'limitDepositPeriod', amount: 'limitDepositAmount', tag: 'tagLimitDeposit' },
    { key: 'bet', radio: 'limitBetType', period: 'limitBetPeriod', amount: 'limitBetAmount', tag: 'tagLimitBet' },
    { key: 'loss', radio: 'limitLossType', period: 'limitLossPeriod', amount: 'limitLossAmount', tag: 'tagLimitLoss' }
  ];
  limitDefs.forEach(function(def) {
    var typeVal = user['limit_' + def.key + '_type'] || 'unlimited';
    var periodVal = user['limit_' + def.key + '_period'] || '';
    var amountVal = parseInt(user['limit_' + def.key + '_amount']) || 0;

    // Set radio
    var radio = document.querySelector('input[name="' + def.radio + '"][value="' + (typeVal === 'unlimited' ? 'unlimited' : 'custom') + '"]');
    if (radio) { radio.checked = true; toggleLimitForm(def.key === 'deposit' ? 'limitDeposit' : def.key === 'bet' ? 'limitBet' : 'limitLoss', typeVal === 'unlimited' ? 'unlimited' : 'custom'); }

    // Set period
    var periodEl = document.getElementById(def.period);
    if (periodEl && periodVal) periodEl.value = periodVal;

    // Set amount as BRL
    if (typeVal !== 'unlimited' && amountVal > 0) {
      var amtEl = document.getElementById(def.amount);
      if (amtEl) {
        var brl = (amountVal / 100).toFixed(2);
        var parts = brl.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        amtEl.value = 'R$ ' + parts[0] + ',' + parts[1];
      }
    }
  });

  // Time limit
  var timeType = user.limit_time_type || 'unlimited';
  var timeRadio = document.querySelector('input[name="limitTimeType"][value="' + (timeType === 'unlimited' ? 'unlimited' : 'custom') + '"]');
  if (timeRadio) { timeRadio.checked = true; toggleLimitForm('limitTime', timeType === 'unlimited' ? 'unlimited' : 'custom'); }
  var timePeriod = document.getElementById('limitTimePeriod');
  if (timePeriod && user.limit_time_period) timePeriod.value = user.limit_time_period;
  var timeValue = document.getElementById('limitTimeValue');
  if (timeValue && user.limit_time_value) timeValue.value = user.limit_time_value;
  // Mark limits as loaded so subsequent toggles auto-save
  _limitsLoaded = true;
}

/* ========== WITHDRAWAL ========== */
function submitWithdrawal() {
  var pixType = document.getElementById('sacarPixType');
  var pixKey = document.getElementById('sacarPixKey');
  var amountEl = document.getElementById('sacarAmount');
  if (!pixKey || !pixKey.value.trim()) { showToast('Informe a chave PIX.', 'error'); return; }
  if (!amountEl || !amountEl.value.trim()) { showToast('Informe o valor.', 'error'); return; }
  var amount = parseBrl(amountEl.value);
  if (amount < 10) { showToast('Valor mínimo: R$ 10,00', 'error'); return; }

  fetch('/api/withdrawal/create', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pix_type: pixType ? pixType.value : 'cpf',
      pix_key: pixKey.value,
      amount_brl: amount
    })
  }).then(function(r) { return r.json(); }).then(function(j) {
    if (j.ok) {
      showToast(j.msg, 'success');
      amountEl.value = '';
      loadWithdrawals();
      refreshWalletUI();
    } else { showToast(j.msg || 'Erro', 'error'); }
  }).catch(function() { showToast('Erro de conexão.', 'error'); });
}
window.submitWithdrawal = submitWithdrawal;

function loadWithdrawals() {
  var list = document.getElementById('sacarPendingList');
  if (!list) return;
  fetch('/api/user/withdrawals', { credentials: 'include' })
    .then(function(r) { return r.json(); })
    .then(function(j) {
      if (!j.ok || !j.rows.length) { list.innerHTML = ''; return; }
      var html = '<div style="margin-top:8px"><div class="wallet-panel-title" style="font-size:14px">Saques Solicitados</div>';
      j.rows.forEach(function(w) {
        var d = new Date(w.created_at);
        var dt = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        var statusCls = 'tx-status tx-status-' + w.status;
        var statusLabel = w.status === 'pending' ? 'Pendente' : w.status === 'approved' ? 'Aprovado' : w.status === 'rejected' ? 'Rejeitado' : w.status;
        var amt = (parseInt(w.amount_cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        html += '<div class="acct-section" style="margin-bottom:8px"><div style="padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">';
        html += '<div><strong style="color:var(--text)">R$ ' + amt + '</strong> <span style="font-size:12px;color:var(--text-muted)">' + w.pix_type.toUpperCase() + ': ' + w.pix_key + '</span></div>';
        html += '<div style="display:flex;align-items:center;gap:10px"><span class="' + statusCls + '">' + statusLabel + '</span><span style="font-size:11px;color:var(--text-muted)">' + dt + '</span></div>';
        html += '</div></div>';
      });
      html += '</div>';
      list.innerHTML = html;
    }).catch(function() {});
}

/* ========== TRANSACTION HISTORY ========== */
var histCurrentType = 'all';
var histCurrentPeriod = 'total';

function loadTransactions() {
  var body = document.getElementById('histTransBody');
  var count = document.getElementById('histTransCount');
  if (!body) return;

  fetch('/api/user/transactions?type=' + encodeURIComponent(histCurrentType) + '&period=' + encodeURIComponent(histCurrentPeriod), { credentials: 'include' })
    .then(function(r) { return r.json(); })
    .then(function(j) {
      if (!j.ok || !j.rows.length) {
        body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">Nenhuma transação encontrada.</td></tr>';
        if (count) count.textContent = '0 transaçÃÆ’Ã‚Âµes';
        return;
      }
      body.innerHTML = '';
      j.rows.forEach(function(tx) {
        var d = new Date(tx.created_at);
        var dt = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        var typeCls = 'tx-type tx-type-' + tx.type;
        var typeLabel = tx.type === 'deposit' ? 'Depósito' : tx.type === 'withdrawal' ? 'Saque' : tx.type;
        var statusCls = 'tx-status tx-status-' + tx.status;
        var statusLabel = tx.status === 'paid' ? 'Pago' : tx.status === 'pending' ? 'Pendente' : tx.status === 'approved' ? 'Aprovado' : tx.status === 'failed' ? 'Falhou' : tx.status === 'rejected' ? 'Rejeitado' : tx.status;
        var amt = (parseInt(tx.amount_cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        var tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.innerHTML = '<td><span class="' + typeCls + '">' + typeLabel + '</span></td>' +
          '<td style="font-size:12px;color:var(--text-muted)">#' + tx.id + '</td>' +
          '<td style="font-size:12px">' + (tx.provider || '—šÂ¬') + '</td>' +
          '<td style="font-weight:700">R$ ' + amt + '</td>' +
          '<td><span class="' + statusCls + '">' + statusLabel + '</span></td>' +
          '<td style="font-size:12px;color:var(--text-muted)">' + dt + '</td>';
        body.appendChild(tr);
      });
      if (count) count.textContent = 'Mostrando ' + j.rows.length + ' transaç' + (j.rows.length > 1 ? 'ÃÆ’Ã‚Âµes' : 'ão');
    }).catch(function() {
      body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px">Erro ao carregar transaçÃÆ’Ã‚Âµes.</td></tr>';
    });
}

// Transaction History tab switching (scoped to histTransacoes panel)
document.querySelectorAll('#walletPanelHistTransacoes .hist-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('#walletPanelHistTransacoes .hist-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    histCurrentType = tab.getAttribute('data-type');
    loadTransactions();
  });
});
var histPeriodEl = document.getElementById('histPeriod');
if (histPeriodEl) {
  histPeriodEl.addEventListener('change', function() {
    histCurrentPeriod = histPeriodEl.value;
    loadTransactions();
  });
}

// Betting history tab switching —šÂ¬ Cassino
document.querySelectorAll('#betCassinoTabs .hist-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('#betCassinoTabs .hist-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
  });
});

// Betting history tab switching —šÂ¬ Esportivas
document.querySelectorAll('#betSportTabs .hist-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('#betSportTabs .hist-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
  });
});

// Extrato tab switching
document.querySelectorAll('#extratoTabs .hist-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('#extratoTabs .hist-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
  });
});

/* ========== POPULATE PIX ON SACAR ========== */
function populateSacarPix(user) {
  if (!user) return;
  var type = document.getElementById('sacarPixType');
  var key = document.getElementById('sacarPixKey');
  var pixType = user.pix_type || 'cpf';
  if (type) type.value = pixType;
  if (key) {
    if (user.pix_key) {
      key.value = user.pix_key;
    } else if (user.cpf && pixType === 'cpf') {
      var c = user.cpf.replace(/\D/g,'');
      key.value = c.slice(0,3) + '.' + c.slice(3,6) + '.' + c.slice(6,9) + '-' + c.slice(9);
    }
    // Apply mask based on type
    if (pixType === 'cpf') applySacarPixMask('000.000.000-00');
    else if (pixType === 'phone') applySacarPixMask('(00) 00000-0000');
  }
  // Also set carteira user id
  var cid = document.getElementById('walletCarteiraUserId');
  if (cid && user.id) cid.textContent = user.id;
}

// Sacar PIX key mask
var sacarPixMaskHandler = null;
function applySacarPixMask(mask) {
  var key = document.getElementById('sacarPixKey');
  if (!key) return;
  if (sacarPixMaskHandler) key.removeEventListener('input', sacarPixMaskHandler);
  sacarPixMaskHandler = function() { applyMaskValue(key, mask); };
  key.addEventListener('input', sacarPixMaskHandler);
}

// Sacar PIX type change ‚¬ update mask and pre-fill
var sacarPixTypeEl = document.getElementById('sacarPixType');
if (sacarPixTypeEl) {
  sacarPixTypeEl.addEventListener('change', function() {
    var t = sacarPixTypeEl.value;
    var key = document.getElementById('sacarPixKey');
    if (sacarPixMaskHandler && key) { key.removeEventListener('input', sacarPixMaskHandler); sacarPixMaskHandler = null; }
    if (key) key.value = '';
    if (t === 'cpf') { applySacarPixMask('000.000.000-00'); key.placeholder = '000.000.000-00'; }
    else if (t === 'phone') { applySacarPixMask('(00) 00000-0000'); key.placeholder = '(00) 00000-0000'; }
    else if (t === 'email') { key.placeholder = 'email@exemplo.com'; }
    else { key.placeholder = 'Chave aleatória'; }
  });
}

/* ========== NOTIFICATIONS ========== */
var _notifLoaded = false;
var _notifPollId = null;

function notifRelativeTime(dateStr) {
  var now = Date.now();
  var d = new Date(dateStr).getTime();
  var diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return Math.floor(diff / 60) + ' min atrás';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h atrás';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd atrás';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

var notifTypeIcons = {
  info: { emoji: 'Â¹Á¯Ã‚Â¸Ã‚Â', cls: 'info' },
  success: { emoji: '—œ', cls: 'success' },
  warning: { emoji: 'Á¯Ã‚Â¸Ã‚Â', cls: 'warning' },
  promo: { emoji: 'Á°Ã…Â¸Ã…Â½Ã‚Â', cls: 'promo' },
  deposit: { emoji: 'Á°Ã…Â¸Â°', cls: 'success' },
  bonus: { emoji: 'Á°Ã…Â¸Ã…Â½', cls: 'promo' }
};

function renderNotifications(notifications) {
  var list = document.getElementById('notifList');
  var emptyBanner = document.getElementById('notifEmptyBanner');
  var markAll = document.getElementById('notifMarkAll');
  var showReadBtn = document.getElementById('notifShowRead');
  if (!list) return;
  
  var unreadNotifs = notifications ? notifications.filter(function(n) { return !n.lida; }) : [];
  var readNotifs = notifications ? notifications.filter(function(n) { return n.lida; }) : [];
  
  // Show/hide empty banner
  if (emptyBanner) emptyBanner.style.display = unreadNotifs.length === 0 ? '' : 'none';
  if (markAll) markAll.style.display = unreadNotifs.length > 0 ? 'inline-block' : 'none';
  if (showReadBtn) showReadBtn.style.display = readNotifs.length > 0 ? '' : 'none';
  
  if (!notifications || !notifications.length) {
    list.innerHTML = '';
    return;
  }
  
  // Render unread notifications
  var html = '';
  unreadNotifs.forEach(function(n) {
    var icon = notifTypeIcons[n.tipo] || notifTypeIcons.info;
    html += '<div class="notif-item unread" data-id="' + n.id + '">';
    html += '<div class="notif-icon ' + icon.cls + '">' + icon.emoji + '</div>';
    html += '<div class="notif-body">';
    html += '<div class="notif-title">' + (n.titulo || '') + '</div>';
    if (n.mensagem) html += '<div class="notif-msg">' + n.mensagem + '</div>';
    html += '<div class="notif-time">' + notifRelativeTime(n.created_at) + '</div>';
    html += '</div></div>';
  });
  
  // Render read notifications (hidden by default)
  if (readNotifs.length) {
    html += '<div class="notif-read-section" id="notifReadSection" style="display:none">';
    readNotifs.forEach(function(n) {
      var icon = notifTypeIcons[n.tipo] || notifTypeIcons.info;
      html += '<div class="notif-item" data-id="' + n.id + '">';
      html += '<div class="notif-icon ' + icon.cls + '">' + icon.emoji + '</div>';
      html += '<div class="notif-body">';
      html += '<div class="notif-title">' + (n.titulo || '') + '</div>';
      if (n.mensagem) html += '<div class="notif-msg">' + n.mensagem + '</div>';
      html += '<div class="notif-time">' + notifRelativeTime(n.created_at) + '</div>';
      html += '</div></div>';
    });
    html += '</div>';
  }
  
  list.innerHTML = html;
  // Click to mark as read
  list.querySelectorAll('.notif-item.unread').forEach(function(item) {
    item.addEventListener('click', function() {
      var id = item.getAttribute('data-id');
      markNotifRead(id);
      item.classList.remove('unread');
    });
  });
}

function loadNotifications() {
  fetch('/api/notifications?limit=30', { credentials: 'include' })
    .then(function(r) { return r.json(); })
    .then(function(j) {
      if (!j || !j.ok) return;
      renderNotifications(j.notifications);
      updateNotifBadge(j.unread || 0);
    }).catch(function() {});
}

function updateNotifBadge(count) {
  var badges = document.querySelectorAll('#topbarNotifBadge, #sidebarNotifBadge');
  badges.forEach(function(b) {
    b.textContent = count > 99 ? '99+' : count;
    b.style.display = count > 0 ? '' : 'none';
  });
}

function pollNotifCount() {
  fetch('/api/notifications/count', { credentials: 'include' })
    .then(function(r) { return r.json(); })
    .then(function(j) {
      if (j && j.ok) updateNotifBadge(j.unread || 0);
    }).catch(function() {});
}

function markNotifRead(id) {
  fetch('/api/notifications/read', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: parseInt(id) })
  }).then(function() { pollNotifCount(); }).catch(function() {});
}

function markAllNotifsRead() {
  fetch('/api/notifications/read-all', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  }).then(function() {
    document.querySelectorAll('.notif-item.unread').forEach(function(i) { i.classList.remove('unread'); });
    var markAll = document.getElementById('notifMarkAll');
    if (markAll) markAll.style.display = 'none';
    updateNotifBadge(0);
  }).catch(function() {});
}

// Wire mark-all button
var notifMarkAllBtn = document.getElementById('notifMarkAll');
if (notifMarkAllBtn) notifMarkAllBtn.addEventListener('click', markAllNotifsRead);

// Wire show-read button
var notifShowReadBtn = document.getElementById('notifShowRead');
if (notifShowReadBtn) {
  notifShowReadBtn.addEventListener('click', function() {
    var section = document.getElementById('notifReadSection');
    if (section) {
      var visible = section.style.display !== 'none';
      section.style.display = visible ? 'none' : '';
      notifShowReadBtn.textContent = visible ? 'Mostrar notificaçÃÆ’Ã‚Âµes lidas' : 'Ocultar notificaçÃÆ’Ã‚Âµes lidas';
    }
  });
}

// Wire refresh button
var notifRefreshBtn = document.getElementById('notifRefreshBtn');
if (notifRefreshBtn) notifRefreshBtn.addEventListener('click', function() { loadNotifications(); });

// Start polling when logged in
function startNotifPolling() {
  if (_notifPollId) return;
  loadNotifications();
  _notifPollId = setInterval(pollNotifCount, 30000);
}
function stopNotifPolling() {
  if (_notifPollId) { clearInterval(_notifPollId); _notifPollId = null; }
}

// Topbar bell ‚¬ open notif panel
var topbarNotifBtn = document.getElementById('topbarNotif');
if (topbarNotifBtn) topbarNotifBtn.addEventListener('click', function(e) {
  e.preventDefault();
  if (topbarDropdown) topbarDropdown.classList.remove('open');
  showWalletSection('notif');
  loadNotifications();
});
// Sidebar bell ‚¬ open notif panel
var sidebarNotifBtn = document.getElementById('sidebarNotifBtn');
if (sidebarNotifBtn) sidebarNotifBtn.addEventListener('click', function(e) {
  e.preventDefault();
  showWalletSection('notif');
  loadNotifications();
});

/* ========== INDIQUE E GANHE ========== */
function setupIndiqueLink() {
  var input = document.getElementById('indiqueLinkInput');
  var copyBtn = document.getElementById('indiqueCopyBtn');
  var shareBtn = document.getElementById('indiqueShareBtn');
  if (!input) return;

  // Generate referral link from user session
  var userId = document.getElementById('walletUserId');
  var uid = userId ? userId.textContent.trim() : '';
  if (uid) {
    input.value = window.location.origin + '/?ref=' + uid;
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      if (!input.value) return;
      navigator.clipboard.writeText(input.value).then(function() {
        showToast('Link copiado!', 'success');
      }).catch(function() {
        input.select();
        document.execCommand('copy');
        showToast('Link copiado!', 'success');
      });
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', function() {
      if (navigator.share && input.value) {
        navigator.share({ title: 'VemNaBet', text: 'Venha jogar comigo!', url: input.value });
      } else if (input.value) {
        navigator.clipboard.writeText(input.value);
        showToast('Link copiado!', 'success');
      }
    });
  }
}

// Period tabs
document.querySelectorAll('.indique-period').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.indique-period').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
  });
});

// Prêmios tabs
document.querySelectorAll('.premios-tab').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.premios-tab').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
  });
});

// Prêmios filters
document.querySelectorAll('.premios-filter').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.premios-filter').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
  });
});

initApp();
