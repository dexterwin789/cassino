/* ranking.js — ranking drawer */
(function () {
  const drawer = document.getElementById("rankingDrawer");
  const closeBtn = document.getElementById("closeRanking");

  if (!drawer) return;

  let loaded = false;

  function openRankingDrawer() {
    const app = document.getElementById("app");
    const logged = app?.classList.contains("is-logged");
    if (!logged) {
      if (typeof openAuth === "function") openAuth();
      return;
    }

    if (window.drawerManager) {
      window.drawerManager.closeAll();
    }

    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    if (!loaded) {
      loadRanking();
      loaded = true;
    }
  }

  function closeRankingDrawer() {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  window.openRankingDrawer = openRankingDrawer;
  window.closeRankingDrawer = closeRankingDrawer;

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    closeRankingDrawer();
  });

  drawer.addEventListener("click", (e) => {
    if (e.target === drawer) closeRankingDrawer();
  });

  /* menu bottom link */
  document.getElementById("openRankingBottom")?.addEventListener("click", (e) => {
    e.preventDefault();
    openRankingDrawer();
  });

  async function loadRanking() {
    const body = drawer.querySelector(".drawer-body");
    if (!body) return;

    body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gold1);">Carregando...</div>';

    try {
      const res = await fetch("/ranking", { credentials: "include" });
      const html = await res.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const content = doc.querySelector(".ranking-content, main, body");
      body.innerHTML = content ? content.innerHTML : html;
    } catch (e) {
      body.innerHTML = '<div style="text-align:center;padding:40px;color:#f44;">Erro ao carregar ranking.</div>';
    }
  }
})();
