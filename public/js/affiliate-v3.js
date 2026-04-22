/* Affiliate v3 — frontend controller (vanilla JS) */
(function () {
  'use strict';

  const root = document.querySelector('[data-aff3]');
  if (!root) return;

  const state = {
    period: 'today',
    from: '',
    to: '',
    iperiod: 'all',
    ifrom: '',
    ito: '',
    ipage: 1,
    spage: 1,
    affCode: ''
  };

  const fmtBRL = (cents) => 'R$ ' + ((parseInt(cents) || 0) / 100).toFixed(2).replace('.', ',');
  const api = async (path, opts) => {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    opts.credentials = 'same-origin';
    const r = await fetch(path, opts);
    return r.json();
  };

  const qs = (sel) => root.querySelector(sel);
  const qsa = (sel) => root.querySelectorAll(sel);

  const toast = (msg, type) => {
    if (typeof window.showToast === 'function') window.showToast(msg, type || 'info');
    else alert(msg);
  };

  // ═════════ TABS ═════════
  qsa('[data-aff3-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.aff3Tab;
      qsa('[data-aff3-tab]').forEach(b => b.classList.toggle('active', b === btn));
      qsa('[data-aff3-pane]').forEach(p => p.classList.toggle('active', p.dataset.aff3Pane === tab));
      if (tab === 'links') loadLinks();
      if (tab === 'indicados') loadIndicados();
    });
  });

  // ═════════ DASHBOARD ═════════
  async function loadDashboard() {
    try {
      const q = new URLSearchParams({ period: state.period });
      if (state.period === 'custom' && state.from && state.to) {
        q.set('from', state.from); q.set('to', state.to);
      }
      const d = await api('/api/affiliate/dashboard?' + q.toString());
      if (!d.ok) return;

      state.affCode = d.code || '';
      const baseUrl = (window.location.origin + '/?ref=' + d.code);
      const inp = qs('#aff3LinkInput');
      if (inp) inp.value = baseUrl;
      const sub = qs('#aff3SubaffLink');
      if (sub) sub.value = window.location.origin + '/?subaff=' + d.code;

      const model = (d.model || 'revshare').toUpperCase();
      const pct = d.pct || 50;
      const badge = qs('#aff3ModelBadge');
      if (badge) badge.textContent = model === 'CPA' ? ('CPA R$ ' + pct) : ('REV ' + pct + '%');

      const m = d.metrics || {};
      const setTxt = (key, val) => { const el = root.querySelector(`[data-aff3-metric="${key}"]`); if (el) el.textContent = val; };
      setTxt('visits', m.visits || 0);
      setTxt('signups', m.signups || 0);
      setTxt('ftd_qty', m.ftd_qty || 0);
      setTxt('qftd_qty', m.qftd_qty || 0);
      setTxt('ftd_qty_b', m.ftd_qty || 0);
      setTxt('qftd_qty_b', m.qftd_qty || 0);
      setTxt('dep_qty', m.dep_qty || 0);
      setTxt('dep_tot', fmtBRL(m.dep_tot));
      setTxt('wd_qty', m.wd_qty || 0);
      setTxt('wd_tot', fmtBRL(m.wd_tot));
      setTxt('ftd_tot', fmtBRL(m.ftd_tot));
      setTxt('qftd_tot', fmtBRL(m.qftd_tot));
      setTxt('rev_pending', fmtBRL(m.rev_pending));
      setTxt('rev_period', fmtBRL(m.rev_period));
      setTxt('rev_paid_total', fmtBRL(m.rev_paid_total));

      loadSubaffiliates();
    } catch (e) { console.error('[aff3] dashboard', e); }
  }

  async function loadSubaffiliates() {
    try {
      const q = new URLSearchParams({ page: state.spage, per_page: 10 });
      const d = await api('/api/affiliate/subaffiliates?' + q.toString());
      const list = qs('#aff3SubaffList');
      const pag = qs('#aff3SubaffPagination');
      if (!list) return;
      if (!d.ok || !d.subs || !d.subs.length) {
        list.innerHTML = `<div class="aff3-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div>Você ainda não tem subafiliados cadastrados</div>
        </div>`;
        if (pag) pag.innerHTML = '';
        return;
      }
      list.innerHTML = '<div class="aff3-table-wrap"><table class="aff3-table"><thead><tr><th>Afiliado</th><th>Email</th><th>Nível</th><th>Indicados</th><th>Comissões</th><th>Desde</th></tr></thead><tbody>' +
        d.subs.map(s => `<tr>
          <td><strong>${escapeHtml(s.username || '—')}</strong></td>
          <td>${escapeHtml(s.email || '—')}</td>
          <td><span class="aff3-lvl-badge aff3-lvl-badge-l2">L${s.level || 2}</span></td>
          <td>${s.leads || 0}</td>
          <td><strong style="color:var(--aff3-green1)">${fmtBRL(s.commissions)}</strong></td>
          <td>${new Date(s.created_at).toLocaleDateString('pt-BR')}</td>
        </tr>`).join('') + '</tbody></table></div>';
      renderPagerGeneric(pag, d.pagination, (p) => { state.spage = p; loadSubaffiliates(); });
    } catch (e) { console.error('[aff3] subaff', e); }
  }

  // Period controls (dashboard)
  qsa('[data-aff3-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.aff3Period;
      qsa('[data-aff3-period]').forEach(b => b.classList.toggle('active', b === btn));
      const range = qs('#aff3CustomRange');
      if (p === 'custom') { if (range) range.style.display = 'flex'; return; }
      if (range) range.style.display = 'none';
      state.period = p; state.from = ''; state.to = '';
      loadDashboard();
    });
  });
  const applyR = qs('#aff3ApplyRange');
  if (applyR) applyR.addEventListener('click', (e) => {
    e.preventDefault();
    const f = qs('#aff3DateFrom').value, t = qs('#aff3DateTo').value;
    if (!f || !t) return toast('Selecione data inicial e final', 'error');
    const d1 = new Date(f), d2 = new Date(t);
    if (isNaN(d1) || isNaN(d2)) return toast('Datas inválidas', 'error');
    if (d2 < d1) return toast('Data final deve ser maior que a inicial', 'error');
    const diff = (d2 - d1) / 86400000;
    if (diff > 92) return toast('Período máximo: 3 meses', 'error');
    state.period = 'custom'; state.from = f; state.to = t;
    loadDashboard();
  });

  // Copy link buttons
  const copyBtn = qs('#aff3CopyBtn');
  if (copyBtn) copyBtn.addEventListener('click', () => {
    const inp = qs('#aff3LinkInput');
    if (!inp || !inp.value) return;
    navigator.clipboard.writeText(inp.value).then(() => toast('Link copiado!', 'success'));
  });
  const shareBtn = qs('#aff3ShareBtn');
  if (shareBtn) shareBtn.addEventListener('click', () => {
    const inp = qs('#aff3LinkInput'); if (!inp) return;
    if (navigator.share) {
      navigator.share({ title: 'VemNaBet', text: 'Cadastre-se na VemNaBet com meu link!', url: inp.value });
    } else {
      navigator.clipboard.writeText(inp.value).then(() => toast('Link copiado para compartilhar!', 'success'));
    }
  });
  const subCopy = qs('#aff3SubaffCopy');
  if (subCopy) subCopy.addEventListener('click', () => {
    const inp = qs('#aff3SubaffLink');
    if (!inp || !inp.value) return;
    navigator.clipboard.writeText(inp.value).then(() => toast('Link de convite copiado!', 'success'));
  });

  // ═════════ LINKS ═════════
  async function loadLinks() {
    const d = await api('/api/affiliate/links');
    const list = qs('#aff3LinksList');
    if (!list) return;
    if (!d.ok || !d.links.length) {
      list.innerHTML = '<div class="aff3-empty"><div>Nenhum link de campanha criado ainda.</div></div>';
      return;
    }
    list.innerHTML = d.links.map(l => {
      const url = window.location.origin + '/?ref=' + l.code;
      return `<div class="aff3-link-item" data-link-id="${l.id}">
        <div class="aff3-link-item-head">
          <div class="aff3-link-item-name">${escapeHtml(l.name)}</div>
          <div style="display:flex;gap:6px;align-items:center">
            <span class="aff3-link-item-code">${escapeHtml(l.code)}</span>
            <button class="aff3-btn aff3-btn-ghost aff3-btn-sm" data-aff3-copy-link="${escapeAttr(url)}">Copiar</button>
            <button class="aff3-btn aff3-btn-danger aff3-btn-sm" data-aff3-del-link="${l.id}">Excluir</button>
          </div>
        </div>
        <div class="aff3-link-item-url">${escapeHtml(url)}</div>
        <div class="aff3-link-item-stats">
          <div class="aff3-link-stat"><strong>${l.clicks || 0}</strong> cliques</div>
          <div class="aff3-link-stat"><strong>${l.signups || 0}</strong> cadastros</div>
          <div class="aff3-link-stat"><strong>${l.deposits || 0}</strong> depósitos</div>
          <div class="aff3-link-stat">criado em ${new Date(l.created_at).toLocaleDateString('pt-BR')}</div>
        </div>
      </div>`;
    }).join('');
    // wire copy/delete
    list.querySelectorAll('[data-aff3-copy-link]').forEach(b => {
      b.addEventListener('click', () => navigator.clipboard.writeText(b.dataset.aff3CopyLink).then(() => toast('Link copiado!', 'success')));
    });
    list.querySelectorAll('[data-aff3-del-link]').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Excluir este link? Os cliques registrados serão perdidos.')) return;
        const r = await api('/api/affiliate/links/' + b.dataset.aff3DelLink, { method: 'DELETE' });
        if (r.ok) { toast('Link excluído', 'success'); loadLinks(); } else toast(r.msg || 'Erro', 'error');
      });
    });
  }

  const linkForm = qs('#aff3LinkForm');
  if (linkForm) linkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = qs('#aff3LinkName').value.trim();
    const code = qs('#aff3LinkCode').value.trim();
    if (!name) return toast('Informe um nome', 'error');
    const r = await api('/api/affiliate/links', { method: 'POST', body: JSON.stringify({ name, code }) });
    if (r.ok) {
      toast('Link criado!', 'success');
      qs('#aff3LinkName').value = ''; qs('#aff3LinkCode').value = '';
      loadLinks();
    } else toast(r.msg || 'Erro', 'error');
  });

  // ═════════ INDICADOS ═════════
  async function loadIndicados() {
    const q = new URLSearchParams({ period: state.iperiod, page: state.ipage, per_page: 20 });
    if (state.iperiod === 'custom') { q.set('from', state.ifrom); q.set('to', state.ito); }
    const d = await api('/api/affiliate/indicados?' + q.toString());
    if (!d.ok) return;

    const s = d.summary || {};
    const setI = (k, v) => { const el = root.querySelector(`[data-aff3-imetric="${k}"]`); if (el) el.textContent = v; };
    setI('total', s.total_leads || 0);
    setI('deps', s.with_deposit || 0);
    setI('bonus', fmtBRL(s.bonus_paid_cents));
    setI('revshare', fmtBRL(s.revshare_total_cents));
    setI('total_comm', fmtBRL(s.total_commission_cents));

    const body = qs('#aff3IBody');
    if (!d.rows.length) {
      body.innerHTML = '<tr><td colspan="8" class="aff3-empty-row">Nenhum indicado no período selecionado.</td></tr>';
    } else {
      body.innerHTML = d.rows.map(r => `<tr>
        <td><strong>${escapeHtml(r.username || '—')}</strong></td>
        <td>${escapeHtml(r.email || '—')}</td>
        <td>${new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
        <td>${fmtBRL(r.cpa)}</td>
        <td>${fmtBRL(r.revshare)}</td>
        <td style="color:var(--aff3-green1)">${fmtBRL(r.deposits)}</td>
        <td style="color:#f87171">${fmtBRL(r.withdrawals)}</td>
        <td><strong>${fmtBRL(r.total_commission)}</strong></td>
      </tr>`).join('');
    }
    renderPagination(d.pagination);
  }

  function renderPagination(p) {
    renderPagerGeneric(qs('#aff3IPagination'), p, (i) => { state.ipage = i; loadIndicados(); });
  }

  function renderPagerGeneric(el, p, onGo) {
    if (!el) return;
    if (!p || p.pages <= 1) { el.innerHTML = ''; return; }
    const cur = p.page, max = p.pages;
    let html = `<button class="aff3-page" ${cur <= 1 ? 'disabled' : ''} data-pg="${cur - 1}">‹</button>`;
    const start = Math.max(1, cur - 2), end = Math.min(max, cur + 2);
    if (start > 1) html += `<button class="aff3-page" data-pg="1">1</button>` + (start > 2 ? '<span class="aff3-page" style="border:none;background:none">…</span>' : '');
    for (let i = start; i <= end; i++) html += `<button class="aff3-page ${i === cur ? 'active' : ''}" data-pg="${i}">${i}</button>`;
    if (end < max) html += (end < max - 1 ? '<span class="aff3-page" style="border:none;background:none">…</span>' : '') + `<button class="aff3-page" data-pg="${max}">${max}</button>`;
    html += `<button class="aff3-page" ${cur >= max ? 'disabled' : ''} data-pg="${cur + 1}">›</button>`;
    el.innerHTML = html;
    el.querySelectorAll('[data-pg]').forEach(b => b.addEventListener('click', () => onGo(parseInt(b.dataset.pg))));
  }

  qsa('[data-aff3-iperiod]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.aff3Iperiod;
      qsa('[data-aff3-iperiod]').forEach(b => b.classList.toggle('active', b === btn));
      const range = qs('#aff3ICustomRange');
      if (p === 'custom') { if (range) range.style.display = 'flex'; return; }
      if (range) range.style.display = 'none';
      state.iperiod = p; state.ifrom = ''; state.ito = ''; state.ipage = 1;
      loadIndicados();
    });
  });
  const iApply = qs('#aff3IApply');
  if (iApply) iApply.addEventListener('click', (e) => {
    e.preventDefault();
    const f = qs('#aff3IDateFrom').value, t = qs('#aff3IDateTo').value;
    if (!f || !t) return toast('Selecione as datas', 'error');
    const d1 = new Date(f), d2 = new Date(t);
    if (isNaN(d1) || isNaN(d2)) return toast('Datas inválidas', 'error');
    if (d2 < d1) return toast('Data final deve ser maior que a inicial', 'error');
    const diff = (d2 - d1) / 86400000;
    if (diff > 92) return toast('Período máximo: 3 meses', 'error');
    state.iperiod = 'custom'; state.ifrom = f; state.ito = t; state.ipage = 1;
    loadIndicados();
  });

  // ═════════ SAQUES (removido — agora via suporte) ═════════

  // ═════════ HELPERS ═════════
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

  // ═════════ INIT ═════════
  // Load on panel open (deferred until wallet panel Indique is shown)
  let loaded = false;
  const tryLoad = () => {
    const panel = document.getElementById('walletPanelIndique');
    if (!panel) return;
    const visible = panel.offsetParent !== null;
    if (visible && !loaded) { loaded = true; loadDashboard(); }
  };
  // Observe wallet panel visibility changes
  if (window.MutationObserver) {
    const panel = document.getElementById('walletPanelIndique');
    if (panel) {
      new MutationObserver(tryLoad).observe(panel, { attributes: true, attributeFilter: ['style', 'class'] });
    }
  }
  document.addEventListener('click', tryLoad);
  setTimeout(tryLoad, 500);
  setTimeout(tryLoad, 2000);
})();
