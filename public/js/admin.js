/* ═══════════════════════════════════════════════════
   ADMIN PANEL — CRUD Controller (data-attribute pattern)
   Works with data-page, data-action, data-filter, data-tbody
═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  const brl = (n) => {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
    } catch { return 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ','); }
  };

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function tag(status) {
    const s = (status || '').toLowerCase();
    if (s === 'paid') return `<span class="adm-tag ok">paid</span>`;
    if (s === 'pending') return `<span class="adm-tag warn">pending</span>`;
    if (s === 'failed' || s === 'canceled') return `<span class="adm-tag bad">${esc(s)}</span>`;
    return `<span class="adm-tag">${esc(s)}</span>`;
  }

  function activeTag(v) {
    return Number(v) ? `<span class="adm-tag ok">Ativo</span>` : `<span class="adm-tag bad">Inativo</span>`;
  }

  function fdate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  /* ─── Generic table controller ───────────────── */
  function initCard(card) {
    const pageName = card.dataset.page;
    const apis = { users: '/admin/api/users', deposits: '/admin/api/deposits', games: '/admin/api/games', transactions: '/admin/api/transactions', banners: '/admin/api/banners' };
    const api = apis[pageName];
    if (!api) return;

    let page = 1;
    const tb = card.querySelector('[data-tbody]');
    const countEl = card.querySelector('[data-count]');
    const pageNumEl = card.querySelector('[data-page-num]');

    function getFilters() {
      const p = {};
      card.querySelectorAll('[data-filter]').forEach(el => {
        const v = (el.value || '').trim();
        if (v) p[el.dataset.filter] = v;
      });
      return p;
    }

    async function load() {
      const params = { ...getFilters(), page, limit: getFilters().limit || 25 };
      const qs = new URLSearchParams(params).toString();
      tb.innerHTML = `<tr><td colspan="99" style="text-align:center;padding:32px;color:rgba(255,255,255,.4)">Carregando...</td></tr>`;

      try {
        const r = await fetch(`${api}?${qs}`, { credentials: 'same-origin' });
        const d = await r.json();
        if (!d.ok) throw new Error(d.msg);

        if (countEl) countEl.textContent = d.total || 0;
        if (pageNumEl) pageNumEl.textContent = d.page || page;

        const rows = d.rows || [];
        if (!rows.length) {
          tb.innerHTML = `<tr><td colspan="99" style="text-align:center;padding:32px;color:rgba(255,255,255,.35)">Nenhum resultado</td></tr>`;
          return;
        }

        tb.innerHTML = rows.map(r => renderRow(pageName, r)).join('');
      } catch (e) {
        tb.innerHTML = `<tr><td colspan="99" style="text-align:center;padding:32px;color:#ff4d4d">${esc(e.message || 'Erro')}</td></tr>`;
      }
    }

    card.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'apply') { page = 1; load(); }
      if (action === 'refresh') { load(); }
      if (action === 'prev') { page = Math.max(1, page - 1); load(); }
      if (action === 'next') { page++; load(); }
    });

    card.querySelectorAll('input[data-filter="q"]').forEach(inp => {
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { page = 1; load(); } });
    });

    if (pageName === 'users') {
      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-toggle-user');
        if (!btn) return;
        await fetch(`/admin/api/users/${btn.dataset.id}/toggle`, { method: 'POST', credentials: 'same-origin' });
        load();
      });
    }

    if (pageName === 'games') {
      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-toggle-game');
        if (!btn) return;
        await fetch(`/admin/api/games/${btn.dataset.id}/toggle`, { method: 'POST', credentials: 'same-origin' });
        load();
      });
      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-delete-game');
        if (!btn) return;
        if (!confirm('Excluir jogo?')) return;
        await fetch(`/admin/api/games/${btn.dataset.id}`, { method: 'DELETE', credentials: 'same-origin' });
        load();
      });
    }

    if (pageName === 'banners') {
      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-toggle-banner');
        if (!btn) return;
        await fetch(`/admin/api/banners/${btn.dataset.id}/toggle`, { method: 'POST', credentials: 'same-origin' });
        load();
      });
      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-delete-banner');
        if (!btn) return;
        if (!confirm('Excluir banner?')) return;
        await fetch(`/admin/api/banners/${btn.dataset.id}`, { method: 'DELETE', credentials: 'same-origin' });
        load();
      });
    }

    load();
  }

  function renderRow(page, r) {
    if (page === 'users') {
      const wallet = Number(r.wallet_balance_cents || 0) / 100;
      return `<tr>
        <td>${r.id}</td>
        <td><strong>${esc(r.username)}</strong></td>
        <td style="color:rgba(255,255,255,.55)">${esc(r.phone || '-')}</td>
        <td style="color:var(--adm-gold2)">${brl(wallet)}</td>
        <td>${brl(Number(r.bonus || 0))}</td>
        <td>${r.credit_score || 0}</td>
        <td>${activeTag(r.is_active)}</td>
        <td style="color:rgba(255,255,255,.45)">${fdate(r.created_at)}</td>
        <td><button class="adm-btn btn-toggle-user" data-id="${r.id}" style="font-size:11px;height:32px;padding:0 10px;">${r.is_active ? 'Desativar' : 'Ativar'}</button></td>
      </tr>`;
    }
    if (page === 'deposits') {
      const amt = Number(r.amount_cents || 0) / 100;
      return `<tr>
        <td>${r.id}</td>
        <td>${r.user_id}</td>
        <td style="color:var(--adm-gold2);font-weight:900">${brl(amt)}</td>
        <td>${tag(r.status)}</td>
        <td style="color:rgba(255,255,255,.45)">${esc(r.provider || '-')}</td>
        <td style="color:rgba(255,255,255,.45)">${esc(r.provider_ref || '-')}</td>
        <td style="color:rgba(255,255,255,.45)">${fdate(r.created_at)}</td>
        <td style="color:rgba(255,255,255,.45)">${fdate(r.updated_at)}</td>
      </tr>`;
    }
    if (page === 'games') {
      return `<tr>
        <td>${r.id}</td>
        <td>${r.image_url ? `<img class="adm-thumb" src="${esc(r.image_url)}" alt="">` : '<span style="color:rgba(255,255,255,.3)">—</span>'}</td>
        <td>${esc(r.game_code)}</td>
        <td><strong>${esc(r.game_name)}</strong></td>
        <td style="color:rgba(255,255,255,.45)">${esc(r.provider || '-')}</td>
        <td>${esc(r.category || '-')}</td>
        <td>${activeTag(r.is_active)}</td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="adm-btn btn-toggle-game" data-id="${r.id}" style="font-size:11px;height:30px;padding:0 8px;">${r.is_active ? 'Off' : 'On'}</button>
            <button class="adm-btn btn-delete-game" data-id="${r.id}" style="font-size:11px;height:30px;padding:0 8px;border-color:rgba(255,77,77,.3);color:#ff4d4d">×</button>
          </div>
        </td>
      </tr>`;
    }
    if (page === 'transactions') {
      const amt = Number(r.amount_cents || 0) / 100;
      const typeTag = { deposit: 'ok', withdrawal: 'warn', bonus: 'info', bet: '', win: 'ok' };
      const cls = typeTag[r.type] || '';
      return `<tr>
        <td>${r.id}</td>
        <td><strong>${esc(r.username || r.user_id)}</strong> <span style="color:rgba(255,255,255,.35)">#${r.user_id}</span></td>
        <td><span class="adm-tag ${cls}">${esc(r.type)}</span></td>
        <td style="color:var(--adm-gold2);font-weight:900">${brl(amt)}</td>
        <td>${tag(r.status)}</td>
        <td style="color:rgba(255,255,255,.45)">${esc(r.provider || '-')}</td>
        <td style="color:rgba(255,255,255,.45)">${esc(r.provider_ref || '-')}</td>
        <td style="color:rgba(255,255,255,.45)">${fdate(r.created_at)}</td>
      </tr>`;
    }
    if (page === 'banners') {
      return `<tr>
        <td>${r.id}</td>
        <td>${r.image_url ? `<img class="adm-thumb" src="${esc(r.image_url)}" alt="" style="width:80px;height:40px;object-fit:cover;border-radius:6px">` : '—'}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(255,255,255,.55)">${esc(r.image_url)}</td>
        <td style="color:rgba(255,255,255,.45)">${esc(r.link_url || '-')}</td>
        <td>${r.sort_order}</td>
        <td>${activeTag(r.is_active)}</td>
        <td style="color:rgba(255,255,255,.45)">${fdate(r.created_at)}</td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="adm-btn btn-toggle-banner" data-id="${r.id}" style="font-size:11px;height:30px;padding:0 8px;">${r.is_active ? 'Off' : 'On'}</button>
            <button class="adm-btn btn-delete-banner" data-id="${r.id}" style="font-size:11px;height:30px;padding:0 8px;border-color:rgba(255,77,77,.3);color:#ff4d4d">×</button>
          </div>
        </td>
      </tr>`;
    }
    return '';
  }

  document.getElementById('btnAddGame')?.addEventListener('click', async () => {
    const code = prompt('Game code:');
    if (!code) return;
    const name = prompt('Game name:');
    if (!name) return;
    const provider = prompt('Provider (opcional):') || '';
    const image_url = prompt('Image URL (opcional):') || '';
    const category = prompt('Categoria (slots/crash/mines/dice):') || 'slots';
    const r = await fetch('/admin/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_code: code, game_name: name, provider, image_url, category }),
      credentials: 'same-origin'
    });
    const d = await r.json();
    if (d.ok) location.reload();
    else alert(d.msg || 'Erro');
  });

  document.getElementById('btnAddBanner')?.addEventListener('click', async () => {
    const image_url = prompt('Image URL do banner:');
    if (!image_url) return;
    const link_url = prompt('Link URL (opcional):') || '';
    const sort_order = prompt('Ordem de exibição (0, 1, 2...):') || '0';
    const r = await fetch('/admin/api/banners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url, link_url, sort_order }),
      credentials: 'same-origin'
    });
    const d = await r.json();
    if (d.ok) location.reload();
    else alert(d.msg || 'Erro');
  });

  function boot() {
    document.querySelectorAll('[data-page]').forEach(initCard);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
