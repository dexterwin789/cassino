/* Affiliate v3 — frontend controller (vanilla JS) */
(function () {
  'use strict';

  const root = document.querySelector('[data-aff3]');
  if (!root) return;

  const state = {
    period: 'month',
    from: '',
    to: '',
    iperiod: 'month',
    ifrom: '',
    ito: '',
    ipage: 1,
    iperpage: 5,
    spage: 1,
    sperpage: 5,
    affCode: ''
  };

  const fmtBRL = (cents) => 'R$ ' + ((parseInt(cents) || 0) / 100).toFixed(2).replace('.', ',');
  const fmtDate = (value) => value ? new Date(value).toLocaleDateString('pt-BR') : '';
  const parseBRLCents = (value) => {
    const normalized = String(value || '').replace(/\s/g, '').replace(/R\$/i, '').replace(/\./g, '').replace(',', '.');
    const amount = parseFloat(normalized);
    return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
  };
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
      if (tab === 'useful') loadUsefulLinks();
      if (tab === 'domains') loadDomains();
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
      setTxt('available_cents', fmtBRL(m.available_cents));

      renderPayout(d.payout || {}, m);
      renderCareer(d.career || {});
      loadWithdrawals();

      loadSubaffiliates();
    } catch (e) { console.error('[aff3] dashboard', e); }
  }

  function renderPayout(payout, metrics) {
    const min = payout.min_withdrawal_cents || 35000;
    const interval = payout.payment_interval_days || 15;
    const available = metrics.available_cents || 0;
    const minEl = qs('#aff3MinWithdrawal');
    const cycleEl = qs('#aff3PayoutCycle');
    const nextEl = qs('#aff3NextPayout');
    const btn = qs('#aff3WithdrawBtn');
    if (minEl) minEl.textContent = fmtBRL(min);
    if (cycleEl) cycleEl.textContent = interval + ' dias';
    if (nextEl) {
      if (!payout.can_withdraw_by_cycle && payout.next_payout_at) nextEl.textContent = 'Próximo saque em ' + fmtDate(payout.next_payout_at);
      else if (available < min) nextEl.textContent = 'Aguardando saldo mínimo';
      else nextEl.textContent = 'Disponível agora';
    }
    if (btn) btn.disabled = !(payout.can_request_now || (available >= min && payout.can_withdraw_by_cycle !== false));
  }

  function renderCareer(career) {
    const current = career.current || { level: 1, name: 'Iniciante', reward: 'Ative seus primeiros indicados para avançar.' };
    const next = career.next || null;
    const progress = Math.max(0, Math.min(100, parseInt(career.progress_pct || 0, 10)));
    const set = (id, value) => { const el = qs('#' + id); if (el) el.textContent = value; };
    set('aff3CareerLevel', 'L' + current.level);
    set('aff3CareerTitle', current.name || 'Iniciante');
    set('aff3CareerCopy', current.reward || 'Continue aumentando sua base ativa.');
    set('aff3CareerProgressLabel', progress + '%');
    const bar = qs('#aff3CareerProgress');
    if (bar) bar.style.width = progress + '%';
    if (next) {
      set('aff3CareerNext', next.name);
      set('aff3CareerActiveGoal', (career.missing_active_leads || 0) + ' ativo' + ((career.missing_active_leads || 0) === 1 ? '' : 's') + ' restante' + ((career.missing_active_leads || 0) === 1 ? '' : 's'));
      set('aff3CareerCommissionGoal', fmtBRL(career.missing_commission_cents || 0) + ' restantes');
    } else {
      set('aff3CareerNext', 'Topo alcançado');
      set('aff3CareerActiveGoal', 'Meta máxima concluída');
      set('aff3CareerCommissionGoal', 'Plano diamante ativo');
    }
    const tiersEl = qs('#aff3CareerTiers');
    if (tiersEl && career.tiers) {
      tiersEl.innerHTML = career.tiers.map(tier => '<div class="aff3-career-tier' + (tier.level <= current.level ? ' active' : '') + '"><strong>L' + tier.level + '</strong><span>' + escapeHtml(tier.name) + '</span></div>').join('');
    }
  }

  async function loadWithdrawals() {
    const list = qs('#aff3WithdrawList');
    if (!list) return;
    try {
      const d = await api('/api/affiliate/withdrawals');
      const rows = (d.rows || []).slice(0, 5);
      if (!d.ok || !rows.length) {
        list.innerHTML = '<div class="aff3-empty" style="padding:12px">Nenhum saque afiliado solicitado ainda.</div>';
        return;
      }
      const labels = { pending: 'Pendente', approved: 'Aprovado', paid: 'Pago', completed: 'Concluído', rejected: 'Recusado' };
      list.innerHTML = rows.map(row => '<div class="aff3-withdraw-item"><div><strong>' + fmtBRL(row.amount_cents) + '</strong><div>' + escapeHtml((row.pix_type || '').toUpperCase()) + ' · ' + fmtDate(row.requested_at) + '</div></div><span class="aff3-withdraw-status">' + escapeHtml(labels[row.status] || row.status || 'Pendente') + '</span></div>').join('');
    } catch (e) { console.error('[aff3] withdrawals', e); }
  }

  async function loadSubaffiliates() {
    try {
      const q = new URLSearchParams({ page: state.spage, per_page: state.sperpage });
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
      renderPagerGeneric(pag, d.pagination, (p) => { state.spage = p; loadSubaffiliates(); }, state.sperpage, (n) => { state.sperpage = n; state.spage = 1; loadSubaffiliates(); });
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

  const withdrawForm = qs('#aff3WithdrawForm');
  if (withdrawForm) withdrawForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amountInput = qs('#aff3WithdrawAmount');
    const pixTypeInput = qs('#aff3WithdrawPixType');
    const pixKeyInput = qs('#aff3WithdrawPixKey');
    const amount = parseBRLCents(amountInput ? amountInput.value : '');
    const pixType = pixTypeInput ? pixTypeInput.value : 'cpf';
    const pixKey = (pixKeyInput ? pixKeyInput.value : '').trim();
    if (!amount) return toast('Informe o valor do saque.', 'error');
    if (!pixKey) return toast('Informe a chave PIX.', 'error');
    const btn = qs('#aff3WithdrawBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Solicitando...'; }
    try {
      const r = await api('/api/affiliate/withdrawals', {
        method: 'POST',
        body: JSON.stringify({ amount_cents: amount, pix_type: pixType, pix_key: pixKey })
      });
      if (r.ok) {
        toast('Saque afiliado solicitado!', 'success');
        if (amountInput) amountInput.value = '';
        loadDashboard();
      } else {
        toast(r.msg || 'Erro ao solicitar saque.', 'error');
      }
    } catch (err) {
      toast('Erro de rede ao solicitar saque.', 'error');
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Solicitar saque'; }
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
    const q = new URLSearchParams({ period: state.iperiod, page: state.ipage, per_page: state.iperpage });
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
    renderPagerGeneric(qs('#aff3IPagination'), p, (i) => { state.ipage = i; loadIndicados(); }, state.iperpage, (n) => { state.iperpage = n; state.ipage = 1; loadIndicados(); });
  }

  function renderPagerGeneric(el, p, onGo, curPerPage, onPerPage) {
    if (!el) return;
    if (!p || p.total == null) { el.innerHTML = ''; return; }
    const cur = p.page, max = Math.max(1, p.pages), total = p.total;
    const info = `<span class="aff3-page-info">Página <strong>${cur}</strong> de <strong>${max}</strong> · ${total} registro${total === 1 ? '' : 's'}</span>`;
    const sizes = [5, 10, 20];
    const ppCur = curPerPage || 5;
    const pp = onPerPage ? `<div class="aff3-page-pp"><label>Por página</label><select class="aff3-page-pp-select">${sizes.map(n => `<option value="${n}"${n === ppCur ? ' selected' : ''}>${n}</option>`).join('')}</select></div>` : '';
    let navHtml = '';
    if (max > 1) {
      navHtml += `<button class="aff3-page" ${cur <= 1 ? 'disabled' : ''} data-pg="${cur - 1}">‹</button>`;
      const start = Math.max(1, cur - 2), end = Math.min(max, cur + 2);
      if (start > 1) navHtml += `<button class="aff3-page" data-pg="1">1</button>` + (start > 2 ? '<span class="aff3-page-dots">…</span>' : '');
      for (let i = start; i <= end; i++) navHtml += `<button class="aff3-page ${i === cur ? 'active' : ''}" data-pg="${i}">${i}</button>`;
      if (end < max) navHtml += (end < max - 1 ? '<span class="aff3-page-dots">…</span>' : '') + `<button class="aff3-page" data-pg="${max}">${max}</button>`;
      navHtml += `<button class="aff3-page" ${cur >= max ? 'disabled' : ''} data-pg="${cur + 1}">›</button>`;
    }
    el.innerHTML = info + pp + (navHtml ? '<div class="aff3-page-nums">' + navHtml + '</div>' : '');
    el.querySelectorAll('[data-pg]').forEach(b => b.addEventListener('click', () => onGo(parseInt(b.dataset.pg))));
    const sel = el.querySelector('.aff3-page-pp-select');
    if (sel && onPerPage) sel.addEventListener('change', () => onPerPage(parseInt(sel.value, 10)));
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

  // ═════════ LINKS ÚTEIS (4 banners) ═════════
  const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB

  function setSlotUI(card, data) {
    const img = card.querySelector('.aff3-useful-img');
    const empty = card.querySelector('.aff3-useful-empty');
    const titleIn = card.querySelector('.aff3-useful-title');
    const urlIn = card.querySelector('.aff3-useful-url');
    if (data && data.image_url) {
      img.src = data.image_url;
      img.hidden = false;
      if (empty) empty.style.display = 'none';
    } else {
      img.removeAttribute('src');
      img.hidden = true;
      if (empty) empty.style.display = '';
    }
    titleIn.value = (data && data.title) || '';
    urlIn.value = (data && data.target_url) || '';
    card.dataset.pendingImage = '';
  }

  async function loadUsefulLinks() {
    try {
      const d = await api('/api/affiliate/useful-links');
      if (!d.ok) return toast(d.msg || 'Erro ao carregar', 'error');
      const slots = d.slots || [];
      qsa('.aff3-useful-card').forEach(card => {
        const slot = parseInt(card.dataset.uslot, 10);
        const s = slots.find(x => x.slot === slot) || null;
        setSlotUI(card, s);
      });
    } catch (e) { console.error('[aff3] useful', e); }
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  async function saveUsefulSlot(card) {
    const slot = parseInt(card.dataset.uslot, 10);
    const titleIn = card.querySelector('.aff3-useful-title');
    const urlIn = card.querySelector('.aff3-useful-url');
    const img = card.querySelector('.aff3-useful-img');
    const pending = card.dataset.pendingImage || '';
    const existingSrc = img && !img.hidden ? img.getAttribute('src') : '';
    const imageUrl = pending || existingSrc || null;
    const targetUrl = (urlIn.value || '').trim();
    if (!imageUrl) return toast('Selecione uma imagem para este slot', 'error');
    if (!targetUrl) return toast('Informe o link de destino', 'error');
    if (!/^https?:\/\//i.test(targetUrl)) return toast('Link deve começar com http:// ou https://', 'error');
    const saveBtn = card.querySelector('.aff3-useful-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Salvando...'; }
    try {
      const r = await api('/api/affiliate/useful-links', {
        method: 'POST',
        body: JSON.stringify({
          slot,
          image_url: imageUrl,
          target_url: targetUrl,
          title: (titleIn.value || '').trim()
        })
      });
      if (!r.ok) return toast(r.msg || 'Erro ao salvar', 'error');
      toast('Banner salvo!', 'success');
      // refresh this slot with authoritative data
      setSlotUI(card, r.slot);
    } catch (e) {
      console.error('[aff3] useful save', e);
      toast('Erro ao salvar', 'error');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Salvar'; }
    }
  }

  async function clearUsefulSlot(card) {
    const slot = parseInt(card.dataset.uslot, 10);
    if (!confirm('Limpar este banner? Ele sumirá dos apps com seu código.')) return;
    const r = await api('/api/affiliate/useful-links/' + slot, { method: 'DELETE' });
    if (!r.ok) return toast(r.msg || 'Erro', 'error');
    setSlotUI(card, null);
    toast('Slot limpo', 'success');
  }

  // Delegated events — wired once
  root.addEventListener('change', async (ev) => {
    const fileInput = ev.target.closest('.aff3-useful-upload input[type="file"]');
    if (!fileInput) return;
    const card = fileInput.closest('.aff3-useful-card');
    if (!card) return;
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(f.type)) return toast('Formato inválido (PNG/JPG/WEBP)', 'error');
    if (f.size > MAX_IMAGE_BYTES) return toast('Imagem maior que 4MB', 'error');
    try {
      const dataUrl = await fileToDataUrl(f);
      card.dataset.pendingImage = dataUrl;
      const img = card.querySelector('.aff3-useful-img');
      const empty = card.querySelector('.aff3-useful-empty');
      img.src = dataUrl; img.hidden = false;
      if (empty) empty.style.display = 'none';
    } catch (e) { toast('Erro ao ler imagem', 'error'); }
    fileInput.value = '';
  });
  root.addEventListener('click', (ev) => {
    const saveBtn = ev.target.closest('.aff3-useful-save');
    if (saveBtn) { ev.preventDefault(); saveUsefulSlot(saveBtn.closest('.aff3-useful-card')); return; }
    const clearBtn = ev.target.closest('.aff3-useful-clear');
    if (clearBtn) { ev.preventDefault(); clearUsefulSlot(clearBtn.closest('.aff3-useful-card')); return; }
  });

  // ═════════ DOMÍNIOS CUSTOMIZADOS ═════════
  let domState = { code: '', token: '', loaded: false };

  async function loadDomains() {
    // Render snippets immediately with placeholder so user never sees "Carregando..." forever
    renderDomainSnippets();
    try {
      const d = await api('/api/affiliate/domains');
      if (!d || !d.ok) {
        renderDomainSnippets();
        return toast((d && d.msg) || 'Erro ao carregar domínios', 'error');
      }
      domState.code = d.code || '';
      domState.token = d.token || '';
      domState.loaded = true;
      renderDomainsList(d.domains || []);
      renderDomainSnippets();
    } catch (e) {
      console.error('[aff3] domains', e);
      renderDomainSnippets();
      toast('Falha ao carregar domínios', 'error');
    }
  }

  function renderDomainsList(list) {
    const host = document.getElementById('aff3DomList');
    if (!host) return;
    if (!list.length) {
      host.innerHTML = '<div class="aff3-dom-empty">Nenhum domínio cadastrado ainda.</div>';
      return;
    }
    host.innerHTML = list.map(d => {
      const statusClass = 'active';
      const destTxt = d.destination === 'cassino' ? 'Landing' : 'App';
      return '<div class="aff3-dom-item">' +
        '<div class="aff3-dom-item-main">' +
          '<div class="aff3-dom-item-domain">' + escapeHtml(d.domain) + '</div>' +
          '<div class="aff3-dom-item-meta">' +
            '<span class="aff3-dom-tag">→ ' + destTxt + '</span>' +
            '<span class="aff3-dom-status aff3-dom-status-' + statusClass + '">Ativo</span>' +
          '</div>' +
        '</div>' +
        '<div class="aff3-dom-item-actions">' +
          '<button class="aff3-btn aff3-btn-ghost aff3-btn-sm" data-aff3-dom-test="' + escapeAttr(d.domain) + '" title="Testar">Abrir</button>' +
          '<button class="aff3-btn aff3-btn-danger aff3-btn-sm" data-aff3-dom-del="' + d.id + '" title="Remover">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderDomainSnippets() {
    const phpEl = document.getElementById('aff3DomSnippetPhp');
    if (!phpEl) return;
    if (!domState.token) {
      phpEl.textContent = 'Cadastre um domínio acima para gerar o snippet.';
      return;
    }
    const url = 'https://app.vemnabet.bet/r/' + domState.token;
    phpEl.textContent =
      '<?php\n' +
      'header(\'Location: ' + url + '\', true, 302);\n' +
      'exit;';
  }

  // Form submit
  document.addEventListener('submit', async (ev) => {
    const form = ev.target.closest('#aff3DomForm');
    if (!form) return;
    ev.preventDefault();
    const input = document.getElementById('aff3DomInput');
    const destSel = document.getElementById('aff3DomDest');
    const domain = (input.value || '').trim();
    if (!domain) return toast('Informe um domínio', 'error');
    const btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; }
    try {
      const r = await api('/api/affiliate/domains', {
        method: 'POST',
        body: JSON.stringify({ domain, mode: 'snippet', destination: destSel.value })
      });
      if (!r.ok) return toast(r.msg || 'Erro ao cadastrar', 'error');
      toast('Domínio cadastrado!', 'success');
      input.value = '';
      loadDomains();
    } catch (e) { toast('Erro ao cadastrar', 'error'); }
    finally { if (btn) btn.disabled = false; }
  });

  // Click delegation (verify / delete / test / copy)
  root.addEventListener('click', async (ev) => {
    const vBtn = ev.target.closest('[data-aff3-dom-verify]');
    if (vBtn) {
      ev.preventDefault();
      const id = vBtn.getAttribute('data-aff3-dom-verify');
      vBtn.disabled = true; vBtn.textContent = 'Verificando...';
      try {
        const r = await api('/api/affiliate/domains/' + id + '/verify', { method: 'POST' });
        toast(r.msg || (r.ok ? 'OK' : 'Erro'), r.ok && r.status === 'active' ? 'success' : 'info');
        loadDomains();
      } catch { toast('Erro', 'error'); }
      return;
    }
    const dBtn = ev.target.closest('[data-aff3-dom-del]');
    if (dBtn) {
      ev.preventDefault();
      if (!confirm('Remover este domínio?')) return;
      const id = dBtn.getAttribute('data-aff3-dom-del');
      const r = await api('/api/affiliate/domains/' + id, { method: 'DELETE' });
      if (!r.ok) return toast(r.msg || 'Erro', 'error');
      toast('Domínio removido', 'success');
      loadDomains();
      return;
    }
    const tBtn = ev.target.closest('[data-aff3-dom-test]');
    if (tBtn) {
      ev.preventDefault();
      const host = tBtn.getAttribute('data-aff3-dom-test');
      window.open('https://' + host + '/', '_blank', 'noopener');
      return;
    }
    const cBtn = ev.target.closest('[data-copy]');
    if (cBtn) {
      ev.preventDefault();
      const sel = cBtn.getAttribute('data-copy');
      const src = document.querySelector(sel);
      if (src) {
        try { await navigator.clipboard.writeText(src.textContent || ''); toast('Copiado!', 'success'); }
        catch { toast('Não foi possível copiar', 'error'); }
      }
      return;
    }
  });

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
