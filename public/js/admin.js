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
    const apis = { users: '/admin/api/users', deposits: '/admin/api/deposits', games: '/admin/api/games', transactions: '/admin/api/transactions', banners: '/admin/api/banners', bets: '/admin/api/bets', affiliates: '/admin/api/affiliates', support: '/admin/api/support', promotions: '/admin/api/promotions', audit: '/admin/api/audit', withdrawals: '/admin/api/withdrawals', notifications: '/admin/api/notifications', limits: '/admin/api/limits', leagues: '/admin/api/leagues', coupons: '/admin/api/coupons' };
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
      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-balance-user');
        if (!btn) return;
        const amount = prompt('Ajuste de saldo em centavos (positivo=crédito, negativo=débito):');
        if (!amount) return;
        const reason = prompt('Motivo do ajuste:') || '';
        await fetch(`/admin/api/users/${btn.dataset.id}/balance`, {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ amount_cents: parseInt(amount), reason }), credentials: 'same-origin'
        });
        load();
      });
      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-block-user');
        if (!btn) return;
        const reason = prompt('Motivo do bloqueio:');
        if (!reason) return;
        await fetch(`/admin/api/users/${btn.dataset.id}/block`, {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ block_reason: reason }), credentials: 'same-origin'
        });
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

    if (pageName === 'affiliates') {
      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-toggle-affiliate');
        if (!btn) return;
        await fetch(`/admin/api/affiliates/${btn.dataset.id}/toggle`, { method: 'POST', credentials: 'same-origin' });
        load();
      });
    }

    if (pageName === 'promotions') {
      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-toggle-promo');
        if (!btn) return;
        await fetch(`/admin/api/promotions/${btn.dataset.id}/toggle`, { method: 'POST', credentials: 'same-origin' });
        load();
      });
      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-delete-promo');
        if (!btn) return;
        if (!confirm('Excluir promoção?')) return;
        await fetch(`/admin/api/promotions/${btn.dataset.id}`, { method: 'DELETE', credentials: 'same-origin' });
        load();
      });
    }

    if (pageName === 'withdrawals') {
      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-approve-wd');
        if (!btn) return;
        const note = prompt('Observação (opcional):') || '';
        await fetch(`/admin/api/withdrawals/${btn.dataset.id}/approve`, {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ admin_note: note }), credentials: 'same-origin'
        });
        load();
      });
      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-reject-wd');
        if (!btn) return;
        const note = prompt('Motivo da rejeição:');
        if (note === null) return;
        await fetch(`/admin/api/withdrawals/${btn.dataset.id}/reject`, {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ admin_note: note }), credentials: 'same-origin'
        });
        load();
      });
    }

    if (pageName === 'notifications') {
      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-delete-notif');
        if (!btn) return;
        if (!confirm('Excluir notificação?')) return;
        await fetch(`/admin/api/notifications/${btn.dataset.id}`, { method: 'DELETE', credentials: 'same-origin' });
        load();
      });
    }

    if (pageName === 'limits') {
      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-toggle-limit');
        if (!btn) return;
        await fetch(`/admin/api/limits/${btn.dataset.id}/toggle`, { method: 'POST', credentials: 'same-origin' });
        load();
      });
      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-delete-limit');
        if (!btn) return;
        if (!confirm('Excluir limite?')) return;
        await fetch(`/admin/api/limits/${btn.dataset.id}`, { method: 'DELETE', credentials: 'same-origin' });
        load();
      });
    }

    if (pageName === 'leagues') {
      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-toggle-league');
        if (!btn) return;
        await fetch(`/admin/api/leagues/${btn.dataset.id}/toggle`, {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ item_type: btn.dataset.type }), credentials: 'same-origin'
        });
        load();
      });
      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-delete-league');
        if (!btn) return;
        if (!confirm('Excluir?')) return;
        await fetch(`/admin/api/leagues/${btn.dataset.id}`, {
          method: 'DELETE', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ item_type: btn.dataset.type }), credentials: 'same-origin'
        });
        load();
      });
    }

    if (pageName === 'coupons') {
      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-toggle-coupon');
        if (!btn) return;
        await fetch(`/admin/api/coupons/${btn.dataset.id}/toggle`, { method: 'POST', credentials: 'same-origin' });
        load();
      });
      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-delete-coupon');
        if (!btn) return;
        if (!confirm('Excluir cupom?')) return;
        await fetch(`/admin/api/coupons/${btn.dataset.id}`, { method: 'DELETE', credentials: 'same-origin' });
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
        <td style="color:var(--adm-green2)">${brl(wallet)}</td>
        <td>${brl(Number(r.bonus || 0))}</td>
        <td>${activeTag(r.is_active)}</td>
        <td style="color:rgba(255,255,255,.45)">${fdate(r.created_at)}</td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            <button class="adm-btn btn-toggle-user" data-id="${r.id}" style="font-size:11px;height:30px;padding:0 8px;">${r.is_active ? 'Desativar' : 'Ativar'}</button>
            <button class="adm-btn btn-balance-user" data-id="${r.id}" style="font-size:11px;height:30px;padding:0 8px;border-color:rgba(46,231,107,.3);color:#2ee76b">R$</button>
            <button class="adm-btn btn-block-user" data-id="${r.id}" style="font-size:11px;height:30px;padding:0 8px;border-color:rgba(255,77,77,.3);color:#ff4d4d">Block</button>
          </div>
        </td>
      </tr>`;
    }
    if (page === 'deposits') {
      const amt = Number(r.amount_cents || 0) / 100;
      return `<tr>
        <td>${r.id}</td>
        <td>${r.user_id}</td>
        <td style="color:var(--adm-green2);font-weight:900">${brl(amt)}</td>
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
        <td style="color:var(--adm-green2);font-weight:900">${brl(amt)}</td>
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
    if (page === 'bets') {
      const amt = Number(r.amount_cents || 0) / 100;
      const pay = Number(r.payout_cents || 0) / 100;
      const statusCls = { won: 'ok', lost: 'bad', pending: 'warn', canceled: 'bad' };
      return `<tr>
        <td>${r.id}</td>
        <td><strong>${esc(r.username || r.user_id)}</strong> <span style="color:rgba(255,255,255,.35)">#${r.user_id}</span></td>
        <td style="color:rgba(255,255,255,.55)">${esc(r.game_name || r.game_id || '-')}</td>
        <td style="color:var(--adm-green2);font-weight:900">${brl(amt)}</td>
        <td style="color:#2ee76b;font-weight:700">${brl(pay)}</td>
        <td>${r.multiplier || '—'}x</td>
        <td><span class="adm-tag ${statusCls[r.status] || ''}">${esc(r.status)}</span></td>
        <td style="color:rgba(255,255,255,.45)">${fdate(r.created_at)}</td>
      </tr>`;
    }
    if (page === 'affiliates') {
      const earned = Number(r.total_earned_cents || 0) / 100;
      return `<tr>
        <td>${r.id}</td>
        <td><strong>${esc(r.username || r.user_id)}</strong></td>
        <td style="color:var(--adm-green2);font-weight:700">${esc(r.code)}</td>
        <td>${r.commission_pct}%</td>
        <td style="color:#2ee76b;font-weight:700">${brl(earned)}</td>
        <td>${activeTag(r.is_active)}</td>
        <td style="color:rgba(255,255,255,.45)">${fdate(r.created_at)}</td>
        <td><button class="adm-btn btn-toggle-affiliate" data-id="${r.id}" style="font-size:11px;height:30px;padding:0 8px;">${r.is_active ? 'Desativar' : 'Ativar'}</button></td>
      </tr>`;
    }
    if (page === 'support') {
      const statusCls = { open: 'warn', in_progress: 'info', closed: 'ok' };
      const statusLabel = { open: 'Aberto', in_progress: 'Em andamento', closed: 'Fechado' };
      const prioCls = { low: '', normal: '', high: 'warn', urgent: 'bad' };
      return `<tr>
        <td>${r.id}</td>
        <td><strong>${esc(r.username || r.user_id || '-')}</strong></td>
        <td>${esc(r.subject)}</td>
        <td><span class="adm-tag ${statusCls[r.status] || ''}">${statusLabel[r.status] || esc(r.status)}</span></td>
        <td><span class="adm-tag ${prioCls[r.priority] || ''}">${esc(r.priority)}</span></td>
        <td style="color:rgba(255,255,255,.45)">${fdate(r.created_at)}</td>
        <td style="color:rgba(255,255,255,.45)">${fdate(r.updated_at)}</td>
        <td><button class="adm-btn btn-view-ticket" data-id="${r.id}" style="font-size:11px;height:30px;padding:0 8px;">Ver</button></td>
      </tr>`;
    }
    if (page === 'promotions') {
      const val = Number(r.value_cents || 0) / 100;
      return `<tr>
        <td>${r.id}</td>
        <td><strong>${esc(r.title)}</strong></td>
        <td><span class="adm-tag">${esc(r.type)}</span></td>
        <td style="color:var(--adm-green2)">${r.value_pct > 0 ? r.value_pct + '%' : brl(val)}</td>
        <td style="color:rgba(255,255,255,.55)">${esc(r.code || '-')}</td>
        <td>${r.claimed_count || 0}${r.max_uses ? '/' + r.max_uses : ''}</td>
        <td>${activeTag(r.is_active)}</td>
        <td style="color:rgba(255,255,255,.45)">${r.expires_at ? fdate(r.expires_at) : '—'}</td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="adm-btn btn-toggle-promo" data-id="${r.id}" style="font-size:11px;height:30px;padding:0 8px;">${r.is_active ? 'Off' : 'On'}</button>
            <button class="adm-btn btn-delete-promo" data-id="${r.id}" style="font-size:11px;height:30px;padding:0 8px;border-color:rgba(255,77,77,.3);color:#ff4d4d">×</button>
          </div>
        </td>
      </tr>`;
    }
    if (page === 'audit') {
      return `<tr>
        <td>${r.id}</td>
        <td style="color:var(--adm-green2)">${esc(r.admin_name || r.admin_id || '-')}</td>
        <td><strong>${esc(r.action)}</strong></td>
        <td style="color:rgba(255,255,255,.55)">${esc(r.target_type || '-')}</td>
        <td>${r.target_id || '-'}</td>
        <td style="color:rgba(255,255,255,.35)">${esc(r.ip_address || '-')}</td>
        <td style="color:rgba(255,255,255,.45)">${fdate(r.created_at)}</td>
      </tr>`;
    }
    if (page === 'withdrawals') {
      const amt = Number(r.amount_cents || 0) / 100;
      const statusMap = { pending: 'warn', approved: 'ok', rejected: 'bad', paid: 'ok' };
      const statusLabel = { pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado', paid: 'Pago' };
      const actions = r.status === 'pending'
        ? `<div style="display:flex;gap:4px;">
            <button class="adm-btn btn-approve-wd" data-id="${r.id}" style="font-size:11px;height:30px;padding:0 8px;border-color:rgba(46,231,107,.3);color:#2ee76b">Aprovar</button>
            <button class="adm-btn btn-reject-wd" data-id="${r.id}" style="font-size:11px;height:30px;padding:0 8px;border-color:rgba(255,77,77,.3);color:#ff4d4d">Rejeitar</button>
          </div>`
        : `<span style="color:rgba(255,255,255,.35)">${esc(r.admin_note || '-')}</span>`;
      return `<tr>
        <td>${r.id}</td>
        <td><strong>${esc(r.username || r.user_id)}</strong> <span style="color:rgba(255,255,255,.35)">#${r.user_id}</span></td>
        <td style="color:var(--adm-green2);font-weight:900">${brl(amt)}</td>
        <td style="color:rgba(255,255,255,.55)">${esc(r.pix_type || '-')} / ${esc(r.pix_key || '-')}</td>
        <td><span class="adm-tag ${statusMap[r.status] || ''}">${statusLabel[r.status] || esc(r.status)}</span></td>
        <td style="color:rgba(255,255,255,.45)">${fdate(r.created_at)}</td>
        <td>${actions}</td>
      </tr>`;
    }
    if (page === 'notifications') {
      const tipoColors = { info: '', success: 'ok', warning: 'warn', promo: 'ok', deposit: 'ok' };
      const target = r.user_id === 0 ? '<span class="adm-tag">Global</span>' : `<strong>${esc(r.username || '#' + r.user_id)}</strong>`;
      return `<tr>
        <td>${r.id}</td>
        <td><span class="adm-tag ${tipoColors[r.tipo] || ''}">${esc(r.tipo)}</span></td>
        <td><strong>${esc(r.titulo)}</strong></td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(255,255,255,.55)">${esc(r.mensagem)}</td>
        <td>${target}</td>
        <td style="color:rgba(255,255,255,.45)">${fdate(r.created_at)}</td>
        <td><button class="adm-btn btn-delete-notif" data-id="${r.id}" style="font-size:11px;height:30px;padding:0 8px;border-color:rgba(255,77,77,.3);color:#ff4d4d">×</button></td>
      </tr>`;
    }
    if (page === 'limits') {
      const val = Number(r.limit_value || 0);
      const typeLabel = { deposit: 'Depósito', bet: 'Aposta', loss: 'Perda', time: 'Tempo' };
      const periodLabel = { daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal' };
      return `<tr>
        <td>${r.id}</td>
        <td><strong>${esc(r.username || r.user_id)}</strong> <span style="color:rgba(255,255,255,.35)">#${r.user_id}</span></td>
        <td><span class="adm-tag">${typeLabel[r.limit_type] || esc(r.limit_type)}</span></td>
        <td>${periodLabel[r.period] || esc(r.period)}</td>
        <td style="color:var(--adm-green2);font-weight:700">${r.limit_type === 'time' ? val + ' min' : brl(val / 100)}</td>
        <td style="color:rgba(255,255,255,.55)">${r.enforced_by === 'admin' ? '<span class="adm-tag warn">Admin</span>' : '<span class="adm-tag">Usuário</span>'}</td>
        <td>${activeTag(r.is_active)}</td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="adm-btn btn-toggle-limit" data-id="${r.id}" style="font-size:11px;height:30px;padding:0 8px;">${r.is_active ? 'Off' : 'On'}</button>
            <button class="adm-btn btn-delete-limit" data-id="${r.id}" style="font-size:11px;height:30px;padding:0 8px;border-color:rgba(255,77,77,.3);color:#ff4d4d">×</button>
          </div>
        </td>
      </tr>`;
    }
    if (page === 'leagues') {
      const isSport = r.item_type === 'sport';
      return `<tr>
        <td>${r.id}</td>
        <td><span class="adm-tag ${isSport ? 'ok' : ''}">${isSport ? 'Esporte' : 'Liga'}</span></td>
        <td style="color:rgba(255,255,255,.55)">${isSport ? '—' : esc(r.sport_name || '-')}</td>
        <td><strong>${esc(r.name)}</strong> <span style="color:rgba(255,255,255,.35)">${esc(r.slug)}</span></td>
        <td style="color:rgba(255,255,255,.55)">${esc(r.country || '-')}</td>
        <td>${r.sort_order}</td>
        <td>${activeTag(r.is_active)}</td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="adm-btn btn-toggle-league" data-id="${r.id}" data-type="${r.item_type}" style="font-size:11px;height:30px;padding:0 8px;">${r.is_active ? 'Off' : 'On'}</button>
            <button class="adm-btn btn-delete-league" data-id="${r.id}" data-type="${r.item_type}" style="font-size:11px;height:30px;padding:0 8px;border-color:rgba(255,77,77,.3);color:#ff4d4d">×</button>
          </div>
        </td>
      </tr>`;
    }
    if (page === 'coupons') {
      const val = Number(r.value_cents || 0) / 100;
      const minDep = Number(r.min_deposit || 0) / 100;
      return `<tr>
        <td>${r.id}</td>
        <td style="color:var(--adm-green2);font-weight:900">${esc(r.code)}</td>
        <td><span class="adm-tag">${esc(r.type)}</span></td>
        <td style="font-weight:700">${r.value_pct > 0 ? r.value_pct + '%' : brl(val)}</td>
        <td style="color:rgba(255,255,255,.55)">${minDep > 0 ? brl(minDep) : '—'}</td>
        <td>${r.used_count}${r.max_uses ? '/' + r.max_uses : ''}</td>
        <td>${activeTag(r.is_active)}</td>
        <td style="color:rgba(255,255,255,.45)">${r.expires_at ? fdate(r.expires_at) : '—'}</td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="adm-btn btn-toggle-coupon" data-id="${r.id}" style="font-size:11px;height:30px;padding:0 8px;">${r.is_active ? 'Off' : 'On'}</button>
            <button class="adm-btn btn-delete-coupon" data-id="${r.id}" style="font-size:11px;height:30px;padding:0 8px;border-color:rgba(255,77,77,.3);color:#ff4d4d">×</button>
          </div>
        </td>
      </tr>`;
    }
    return '';
  }

  document.getElementById('btnSyncPF')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnSyncPF');
    btn.disabled = true; btn.textContent = '⏳ Sincronizando...';
    try {
      const r = await fetch('/admin/api/games/sync-playfivers', { method: 'POST', credentials: 'same-origin' });
      const d = await r.json();
      if (d.ok) {
        alert(`Sync concluído!\nInseridos: ${d.inserted}\nAtualizados: ${d.updated}\nIgnorados: ${d.skipped}`);
        location.reload();
      } else { alert(d.msg || 'Erro no sync'); }
    } catch (e) { alert('Erro: ' + e.message); }
    finally { btn.disabled = false; btn.textContent = '🔄 Sync PlayFivers'; }
  });

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

  document.getElementById('btnAddPromo')?.addEventListener('click', async () => {
    const title = prompt('Título da promoção:');
    if (!title) return;
    const type = prompt('Tipo (bonus/cashback/freebet):') || 'bonus';
    const code = prompt('Código (opcional):') || '';
    const value_cents = prompt('Valor em centavos (ex: 1000 = R$10):') || '0';
    const value_pct = prompt('Percentual (ex: 50 = 50%):') || '0';
    const max_uses = prompt('Máx. de usos (0 = ilimitado):') || '0';
    const r = await fetch('/admin/api/promotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, type, code: code || undefined, value_cents, value_pct, max_uses }),
      credentials: 'same-origin'
    });
    const d = await r.json();
    if (d.ok) location.reload();
    else alert(d.msg || 'Erro');
  });

  document.getElementById('btnAddNotif')?.addEventListener('click', async () => {
    const titulo = prompt('Título da notificação:');
    if (!titulo) return;
    const mensagem = prompt('Mensagem:') || '';
    const tipo = prompt('Tipo (info/success/warning/promo/deposit):') || 'info';
    const user_id = prompt('User ID (0 = global para todos):') || '0';
    const link = prompt('Link (opcional):') || '';
    const r = await fetch('/admin/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo, mensagem, tipo, user_id, link }),
      credentials: 'same-origin'
    });
    const d = await r.json();
    if (d.ok) location.reload();
    else alert(d.msg || 'Erro');
  });

  document.getElementById('btnAddSport')?.addEventListener('click', async () => {
    const name = prompt('Nome do esporte:');
    if (!name) return;
    const slug = prompt('Slug (ex: futebol):') || name.toLowerCase().replace(/\s+/g, '-');
    const sort_order = prompt('Ordem (0, 1, 2...):') || '0';
    const r = await fetch('/admin/api/sports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug, sort_order }),
      credentials: 'same-origin'
    });
    const d = await r.json();
    if (d.ok) location.reload();
    else alert(d.msg || 'Erro');
  });

  document.getElementById('btnAddLeague')?.addEventListener('click', async () => {
    const name = prompt('Nome da liga:');
    if (!name) return;
    const slug = prompt('Slug (ex: brasileirao-a):') || name.toLowerCase().replace(/\s+/g, '-');
    const sport_id = prompt('Sport ID:') || '';
    const country = prompt('País (ex: Brasil):') || '';
    const sort_order = prompt('Ordem (0, 1, 2...):') || '0';
    const r = await fetch('/admin/api/leagues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug, sport_id, country, sort_order }),
      credentials: 'same-origin'
    });
    const d = await r.json();
    if (d.ok) location.reload();
    else alert(d.msg || 'Erro');
  });

  document.getElementById('btnAddCoupon')?.addEventListener('click', async () => {
    const code = prompt('Código do cupom (ex: BEM-VINDO):');
    if (!code) return;
    const type = prompt('Tipo (bonus/cashback/freebet):') || 'bonus';
    const description = prompt('Descrição:') || '';
    const value_cents = prompt('Valor em centavos (ex: 1000 = R$10):') || '0';
    const value_pct = prompt('Percentual (ex: 50 = 50%):') || '0';
    const min_deposit = prompt('Depósito mínimo em centavos (0 = sem mínimo):') || '0';
    const max_uses = prompt('Máx. de usos (0 = ilimitado):') || '0';
    const r = await fetch('/admin/api/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, type, description, value_cents, value_pct, min_deposit, max_uses }),
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
