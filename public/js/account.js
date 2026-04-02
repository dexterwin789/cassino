/* account.js — account drawer */
(function () {
  const drawer = document.getElementById("accountDrawer");
  const closeBtn = document.getElementById("closeAccount");

  if (!drawer) return;

  function openAccountDrawer() {
    if (window.drawerManager) {
      window.drawerManager.closeAll();
    }
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    refreshAccountUI();
  }

  function closeAccountDrawer() {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  window.openAccountDrawer = openAccountDrawer;
  window.closeAccountDrawer = closeAccountDrawer;

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    closeAccountDrawer();
  });

  drawer.addEventListener("click", (e) => {
    if (e.target === drawer) closeAccountDrawer();
  });

  /* menu bottom link */
  document.getElementById("openAccountBottom")?.addEventListener("click", (e) => {
    e.preventDefault();
    const logged = document.getElementById("app")?.classList.contains("is-logged");
    if (!logged) {
      if (typeof openAuth === "function") openAuth();
      return;
    }
    openAccountDrawer();
  });

  /* refresh UI */
  async function refreshAccountUI() {
    try {
      const res = await fetch("/api/me", { credentials: "include", cache: "no-store" });
      const j = await res.json();
      if (!j || !j.ok || !j.logged) return;

      const u = j.user;
      const el = (id) => document.getElementById(id);

      if (el("acUsername")) el("acUsername").textContent = u.username || "-";
      if (el("acUserId")) el("acUserId").textContent = u.id || "-";
      if (el("acPhone")) el("acPhone").textContent = u.phone || "-";
    } catch (e) {}

    try {
      const res = await fetch("/api/wallet", { credentials: "include" });
      const j = await res.json();
      if (!j || !j.ok) return;

      const el = (id) => document.getElementById(id);
      if (el("acBalance")) el("acBalance").textContent = j.balance_brl || "0,00";
    } catch (e) {}
  }

  /* copy helpers */
  document.getElementById("copyAccountId")?.addEventListener("click", async (e) => {
    e.preventDefault();
    const id = document.getElementById("acUserId")?.textContent?.trim();
    if (!id) return;
    try { await navigator.clipboard.writeText(id); } catch { }
  });

  /* logout from account */
  document.getElementById("acLogout")?.addEventListener("click", async (e) => {
    e.preventDefault();
    try { await fetch("/api/logout", { method: "POST", credentials: "include" }); } catch {}
    closeAccountDrawer();
    if (typeof updateAuthState === "function") await updateAuthState();
  });
})();
