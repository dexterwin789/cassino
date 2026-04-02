/* admin.js — Admin panel CRUD logic */
(function () {
  const body = document.body;

  async function fetchJSON(url, opts = {}) {
    try {
      const defaults = { credentials: "include", headers: {} };
      if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
        defaults.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(opts.body);
      }
      const res = await fetch(url, { ...defaults, ...opts });
      return await res.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /* helper: build query string */
  function qs(obj) {
    return Object.entries(obj)
      .filter(([, v]) => v !== "" && v !== null && v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
  }

  /* ============ USERS ============ */
  const usersTable = document.getElementById("usersTableBody");
  const usersSearch = document.getElementById("usersSearch");
  const usersActiveFilter = document.getElementById("usersActiveFilter");
  const usersPrev = document.getElementById("usersPrev");
  const usersNext = document.getElementById("usersNext");
  const usersPageInfo = document.getElementById("usersPageInfo");

  let usersPage = 1;

  async function loadUsers() {
    if (!usersTable) return;

    const q = usersSearch?.value.trim() || "";
    const active = usersActiveFilter?.value || "";

    const data = await fetchJSON(`/admin/api/users?${qs({ q, active, page: usersPage, limit: 25 })}`);

    if (!data.ok) {
      usersTable.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#f44;">Erro ao carregar</td></tr>`;
      return;
    }

    const users = data.users || [];

    if (!users.length) {
      usersTable.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#aaa;">Nenhum usuário encontrado</td></tr>`;
      if (usersPageInfo) usersPageInfo.textContent = "0 / 0";
      return;
    }

    usersTable.innerHTML = users
      .map(
        (u) => `
      <tr>
        <td>${u.id}</td>
        <td>${esc(u.username)}</td>
        <td>${esc(u.phone || "-")}</td>
        <td>R$ ${u.balance || "0.00"}</td>
        <td><span class="badge ${u.is_active ? "badge-ok" : "badge-off"}">${u.is_active ? "Ativo" : "Inativo"}</span></td>
        <td>
          <button class="btn-sm btn-toggle" data-user="${u.id}" data-active="${u.is_active ? 1 : 0}">
            ${u.is_active ? "Desativar" : "Ativar"}
          </button>
        </td>
      </tr>`
      )
      .join("");

    const totalPages = data.totalPages || 1;
    if (usersPageInfo) usersPageInfo.textContent = `${usersPage} / ${totalPages}`;
    if (usersPrev) usersPrev.disabled = usersPage <= 1;
    if (usersNext) usersNext.disabled = usersPage >= totalPages;
  }

  usersSearch?.addEventListener("input", debounce(() => { usersPage = 1; loadUsers(); }, 400));
  usersActiveFilter?.addEventListener("change", () => { usersPage = 1; loadUsers(); });
  usersPrev?.addEventListener("click", () => { if (usersPage > 1) { usersPage--; loadUsers(); } });
  usersNext?.addEventListener("click", () => { usersPage++; loadUsers(); });

  usersTable?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-toggle");
    if (!btn) return;
    const id = btn.dataset.user;
    const curr = btn.dataset.active === "1";
    await fetchJSON(`/admin/api/users/${id}/toggle`, { method: "POST", body: { is_active: !curr } });
    loadUsers();
  });

  /* ============ DEPOSITS ============ */
  const depsTable = document.getElementById("depositsTableBody");
  const depsSearch = document.getElementById("depositsSearch");
  const depsStatusFilter = document.getElementById("depositsStatusFilter");
  const depsPrev = document.getElementById("depositsPrev");
  const depsNext = document.getElementById("depositsNext");
  const depsPageInfo = document.getElementById("depositsPageInfo");

  let depsPage = 1;

  async function loadDeposits() {
    if (!depsTable) return;

    const q = depsSearch?.value.trim() || "";
    const status = depsStatusFilter?.value || "";

    const data = await fetchJSON(`/admin/api/deposits?${qs({ q, status, page: depsPage, limit: 25 })}`);

    if (!data.ok) {
      depsTable.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#f44;">Erro ao carregar</td></tr>`;
      return;
    }

    const deps = data.deposits || [];

    if (!deps.length) {
      depsTable.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#aaa;">Nenhum depósito encontrado</td></tr>`;
      if (depsPageInfo) depsPageInfo.textContent = "0 / 0";
      return;
    }

    depsTable.innerHTML = deps
      .map(
        (d) => `
      <tr>
        <td>${d.id}</td>
        <td>${d.user_id} — ${esc(d.username || "")}</td>
        <td>R$ ${d.amount_brl}</td>
        <td><span class="badge badge-${d.status === "paid" ? "ok" : d.status === "pending" ? "warn" : "off"}">${esc(d.status)}</span></td>
        <td>${new Date(d.created_at).toLocaleString("pt-BR")}</td>
        <td>${esc(d.tx_id || "-")}</td>
      </tr>`
      )
      .join("");

    const totalPages = data.totalPages || 1;
    if (depsPageInfo) depsPageInfo.textContent = `${depsPage} / ${totalPages}`;
    if (depsPrev) depsPrev.disabled = depsPage <= 1;
    if (depsNext) depsNext.disabled = depsPage >= totalPages;
  }

  depsSearch?.addEventListener("input", debounce(() => { depsPage = 1; loadDeposits(); }, 400));
  depsStatusFilter?.addEventListener("change", () => { depsPage = 1; loadDeposits(); });
  depsPrev?.addEventListener("click", () => { if (depsPage > 1) { depsPage--; loadDeposits(); } });
  depsNext?.addEventListener("click", () => { depsPage++; loadDeposits(); });

  /* ============ GAMES ============ */
  const gamesTable = document.getElementById("gamesTableBody");
  const gamesSearch = document.getElementById("gamesSearch");
  const gamesPrev = document.getElementById("gamesPrev");
  const gamesNext = document.getElementById("gamesNext");
  const gamesPageInfo = document.getElementById("gamesPageInfo");

  let gamesPage = 1;

  async function loadGames() {
    if (!gamesTable) return;

    const q = gamesSearch?.value.trim() || "";

    const data = await fetchJSON(`/admin/api/games?${qs({ q, page: gamesPage, limit: 25 })}`);

    if (!data.ok) {
      gamesTable.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#f44;">Erro ao carregar</td></tr>`;
      return;
    }

    const games = data.games || [];

    if (!games.length) {
      gamesTable.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#aaa;">Nenhum jogo encontrado</td></tr>`;
      if (gamesPageInfo) gamesPageInfo.textContent = "0 / 0";
      return;
    }

    gamesTable.innerHTML = games
      .map(
        (g) => `
      <tr>
        <td>${g.id}</td>
        <td>${esc(g.name)}</td>
        <td>${esc(g.provider || "-")}</td>
        <td><span class="badge ${g.is_active ? "badge-ok" : "badge-off"}">${g.is_active ? "Ativo" : "Inativo"}</span></td>
        <td>
          <button class="btn-sm btn-toggle-game" data-game="${g.id}" data-active="${g.is_active ? 1 : 0}">
            ${g.is_active ? "Desativar" : "Ativar"}
          </button>
        </td>
      </tr>`
      )
      .join("");

    const totalPages = data.totalPages || 1;
    if (gamesPageInfo) gamesPageInfo.textContent = `${gamesPage} / ${totalPages}`;
    if (gamesPrev) gamesPrev.disabled = gamesPage <= 1;
    if (gamesNext) gamesNext.disabled = gamesPage >= totalPages;
  }

  gamesSearch?.addEventListener("input", debounce(() => { gamesPage = 1; loadGames(); }, 400));
  gamesPrev?.addEventListener("click", () => { if (gamesPage > 1) { gamesPage--; loadGames(); } });
  gamesNext?.addEventListener("click", () => { gamesPage++; loadGames(); });

  gamesTable?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-toggle-game");
    if (!btn) return;
    const id = btn.dataset.game;
    const curr = btn.dataset.active === "1";
    await fetchJSON(`/admin/api/games/${id}/toggle`, { method: "POST", body: { is_active: !curr } });
    loadGames();
  });

  /* ============ UTILS ============ */
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s ?? "";
    return d.innerHTML;
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  /* ============ AUTO INIT ============ */
  if (usersTable) loadUsers();
  if (depsTable) loadDeposits();
  if (gamesTable) loadGames();
})();
