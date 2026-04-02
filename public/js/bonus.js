/* bonus.js — bonus drawer */
(function () {
  const drawer = document.getElementById("bonusDrawer");
  const closeBtn = document.getElementById("closeBonus");

  if (!drawer) return;

  const bonusBanners = [
    { src: "/public/img/banner1.avif", alt: "Bônus 1" },
    { src: "/public/img/banner2.webp", alt: "Bônus 2" },
    { src: "/public/img/banner3.webp", alt: "Bônus 3" },
    { src: "/public/img/banner4.avif", alt: "Bônus 4" },
    { src: "/public/img/banner5.webp", alt: "Bônus 5" },
    { src: "/public/img/banner6.avif", alt: "Bônus 6" },
    { src: "/public/img/banner7.avif", alt: "Bônus 7" },
    { src: "/public/img/banner8.avif", alt: "Bônus 8" },
    { src: "/public/img/banner9.webp", alt: "Bônus 9" },
    { src: "/public/img/banner10.webp", alt: "Bônus 10" },
  ];

  let mounted = false;

  function openBonusDrawer() {
    if (window.drawerManager) {
      window.drawerManager.closeAll();
    }

    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    if (!mounted) {
      mountBonusContent();
      mounted = true;
    }
  }

  function closeBonusDrawer() {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  window.openBonusDrawer = openBonusDrawer;
  window.closeBonusDrawer = closeBonusDrawer;

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    closeBonusDrawer();
  });

  drawer.addEventListener("click", (e) => {
    if (e.target === drawer) closeBonusDrawer();
  });

  /* menu bottom link */
  document.getElementById("openBonusBottom")?.addEventListener("click", (e) => {
    e.preventDefault();
    openBonusDrawer();
  });

  /* Bonus tabs */
  function mountBonusContent() {
    const body = drawer.querySelector(".drawer-body");
    if (!body) return;

    /* tabs */
    const tabsHTML = `
      <div class="bonus-tabs">
        <button class="bonus-tab active" data-tab="all">Todos</button>
        <button class="bonus-tab" data-tab="deposit">Depósito</button>
        <button class="bonus-tab" data-tab="daily">Diário</button>
      </div>
    `;

    /* cards */
    const cardsHTML = bonusBanners
      .map(
        (b) => `
      <div class="bonus-card">
        <img src="${b.src}" alt="${b.alt}" draggable="false" loading="lazy">
        <div class="bonus-card-overlay">
          <button class="bonus-claim-btn">Resgatar</button>
        </div>
      </div>
    `
      )
      .join("");

    body.innerHTML = tabsHTML + `<div class="bonus-grid">${cardsHTML}</div>`;

    /* tab switching (visual only) */
    body.addEventListener("click", (e) => {
      const tab = e.target.closest(".bonus-tab");
      if (!tab) return;
      body.querySelectorAll(".bonus-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
    });
  }
})();
