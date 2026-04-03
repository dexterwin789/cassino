/* /cassino/public/js/script.js — ported from PHP version */

let banners = [];
let allGames = [];

const baseTabs = [
  { id: "quente", label: "Quente", icon: "/public/img/aba1.png" },
  { id: "pg",     label: "PG",     icon: "/public/img/aba2.png" },
  { id: "wg",     label: "WG",     icon: "/public/img/aba5.png" },
  { id: "pp",     label: "PP",     icon: "/public/img/aba3.png" },
  { id: "jili",   label: "JiLi",   icon: "/public/img/aba4.png" },
  { id: "cq9",    label: "CQ9",    icon: "/public/img/aba6.png" },
  { id: "evor",   label: "Evor",   icon: "/public/img/aba7.png" },
];

let tabActive = "quente";

function getGamesForTab(tabId) {
  if (tabId === 'quente') return allGames.filter(g => g.category === 'quente');
  return allGames.filter(g => g.provider === tabId || g.category === tabId);
}

function gameCardHTML(game) {
  const img = game.image_url || '/public/img/games/1.avif';
  return `<a class="game" href="#" title="${game.game_name}"><img src="${img}" alt="${game.game_name}" draggable="false" loading="lazy"></a>`;
}

function pageHTML(tabId) {
  const games = getGamesForTab(tabId || tabActive);
  if (!games.length) {
    return `<div class="games-grid"><p style="text-align:center;color:#aaa;grid-column:1/-1;padding:20px;">Nenhum jogo disponível</p></div>`;
  }
  let html = `<div class="games-grid">`;
  games.forEach(g => { html += gameCardHTML(g); });
  html += `</div>`;
  return html;
}

/* menu spacer + telegram alignment */
const menuFixed = document.getElementById("menuFixed");
const menuSpacer = document.getElementById("menuSpacer");
const appEl = document.getElementById("app");
const telegramFab = document.querySelector(".telegram-fab");

function syncMenuSpacer(){
  const h = menuFixed.getBoundingClientRect().height;
  menuSpacer.style.height = `${h}px`;
}
function positionTelegram(){
  if(!telegramFab) return;
  const rect = appEl.getBoundingClientRect();
  const right = Math.max(10, window.innerWidth/2 - rect.width/2 + 14);
  telegramFab.style.right = `${right}px`;
}
window.addEventListener("resize", ()=>{ syncMenuSpacer(); positionTelegram(); });
window.addEventListener("scroll", positionTelegram);

/* banner */
const bannerViewport = document.getElementById("bannerViewport");
const bannerTrack = document.getElementById("bannerTrack");
const bannerDots = document.getElementById("bannerDots");

let bIndex = 0;
let bTimer = null;

function mountBanners(){
  bannerTrack.innerHTML = banners.map(b => `
    <div class="bslide">
      <img src="${b.src}" alt="${b.alt}" draggable="false" loading="lazy">
    </div>
  `).join("");

  bannerDots.innerHTML = banners.map((_,i)=>`
    <button class="bdot ${i===0 ? "active" : ""}" aria-label="Banner ${i+1}" data-i="${i}"></button>
  `).join("");

  bannerDots.addEventListener("click", (e)=>{
    const d = e.target.closest(".bdot");
    if(!d) return;
    goBanner(+d.dataset.i);
    restartBanner();
  });

  bannerViewport.addEventListener("dragstart",(e)=>e.preventDefault());
  enableBannerSwipe();
  startBanner();
  renderBanner();
}
function renderBanner(){
  bannerTrack.style.transition = "transform .35s ease";
  bannerTrack.style.transform = `translateX(-${bIndex*100}%)`;
  [...bannerDots.querySelectorAll(".bdot")].forEach((d,i)=>{
    d.classList.toggle("active", i===bIndex);
  });
}
function goBanner(i){
  bIndex = (i + banners.length) % banners.length;
  renderBanner();
}
function startBanner(){
  stopBanner();
  bTimer = setInterval(()=>goBanner(bIndex+1), 5000);
}
function stopBanner(){ if(bTimer) clearInterval(bTimer); bTimer=null; }
function restartBanner(){ startBanner(); }

function enableBannerSwipe(){
  let down=false, startX=0, dx=0;
  bannerViewport.style.touchAction = "pan-y";

  bannerViewport.addEventListener("pointerdown",(e)=>{
    down=true; startX=e.clientX; dx=0;
    stopBanner();
    bannerViewport.setPointerCapture(e.pointerId);
  });

  bannerViewport.addEventListener("pointermove",(e)=>{
    if(!down) return;
    dx = e.clientX - startX;
    bannerTrack.style.transition = "none";
    const pct = (dx / bannerViewport.clientWidth) * 18;
    bannerTrack.style.transform = `translateX(calc(-${bIndex*100}% + ${pct}%))`;
    if(Math.abs(dx) > 6) e.preventDefault?.();
  }, { passive:false });

  function end(){
    if(!down) return;
    down=false;
    bannerTrack.style.transition = "";
    const threshold = bannerViewport.clientWidth * 0.16;
    if(dx > threshold) goBanner(bIndex-1);
    else if(dx < -threshold) goBanner(bIndex+1);
    else renderBanner();
    startBanner();
  }

  bannerViewport.addEventListener("pointerup", end);
  bannerViewport.addEventListener("pointercancel", end);
  bannerViewport.addEventListener("lostpointercapture", end);
}

/* winners */
const marqueeInner = document.getElementById("marqueeInner");
function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function genWinnerText(){
  const id = `${rand(1,9)}${rand(0,9)}${rand(0,9)}${rand(0,9)}${rand(0,9)}`;
  const amount = (rand(10,9999) + rand(0,99)/100).toFixed(2);
  return `<span class="marquee__item">
    <span class="marquee__gold">${id}****</span>
    <span>acabou de retirar</span>
    <span class="marquee__gold">${amount} R$</span>
  </span>`;
}
function mountMarquee(){
  const items = new Array(10).fill(0).map(genWinnerText).join("");
  marqueeInner.innerHTML = items + items;
}

/* TABS loop + CLICK/ACTIVE PC FIX */
const tabsViewport = document.getElementById("tabsViewport");
const tabsRow = document.getElementById("tabsRow");

let loopTabs = [];
let tabsX = 0;
let tabItemWidth = 0;
let isInitedLoop = false;

function mountTabsLoop(){
  const clones = baseTabs.map(t => ({...t, _clone:true}));
  loopTabs = [...clones, ...baseTabs, ...clones];

  tabsRow.innerHTML = loopTabs.map(t => `
    <div class="tab ${t.id===tabActive && !t._clone ? "active" : ""}"
         data-id="${t.id}" data-clone="${t._clone ? "1":"0"}">
      <div class="tabIcon">
        <img src="${t.icon}" alt="${t.label}" draggable="false">
      </div>
      <span>${t.label}</span>
    </div>
  `).join("");

  requestAnimationFrame(()=>{
    const first = tabsRow.querySelector(".tab");
    tabItemWidth = first ? (first.getBoundingClientRect().width + 14) : 70;
    tabsX = -baseTabs.length * tabItemWidth;
    applyTabsTransform(false);
    isInitedLoop = true;
    applyActiveEverywhere();
  });

  enableTabsLoopSwipeAndClick();
}

function applyTabsTransform(withTransition=true){
  tabsRow.style.transition = withTransition ? "transform .18s ease" : "none";
  tabsRow.style.transform = `translateX(${tabsX}px)`;
}

function normalizeTabsLoop(){
  if(!isInitedLoop) return;
  const total = baseTabs.length;
  const minX = -(total*2) * tabItemWidth;
  if(tabsX < minX){ tabsX += total * tabItemWidth; applyTabsTransform(false); }
  if(tabsX > -total * tabItemWidth){ tabsX -= total * tabItemWidth; applyTabsTransform(false); }
}

function applyActiveEverywhere(){
  tabsRow.querySelectorAll(".tab").forEach(t=>{
    t.classList.toggle("active", t.dataset.id === tabActive);
  });
}

function setActiveTab(id){
  tabActive = id;
  applyActiveEverywhere();
  renderContent();
}

function enableTabsLoopSwipeAndClick(){
  let down=false, startX=0, startTabsX=0, moved=false, targetTab=null;

  tabsViewport.style.touchAction = "pan-y";
  tabsViewport.addEventListener("dragstart",(e)=>e.preventDefault());

  tabsViewport.addEventListener("pointerdown",(e)=>{
    down=true;
    moved=false;
    startX=e.clientX;
    startTabsX=tabsX;
    targetTab = e.target.closest(".tab");
    tabsViewport.setPointerCapture(e.pointerId);
  });

  tabsViewport.addEventListener("pointermove",(e)=>{
    if(!down) return;
    const dx = e.clientX - startX;

    if(Math.abs(dx) > 6) moved = true;

    if(moved){
      tabsX = startTabsX + dx;
      applyTabsTransform(false);
      e.preventDefault?.();
    }
  }, { passive:false });

  tabsViewport.addEventListener("pointerup",()=>{
    if(!down) return;
    down=false;

    if(moved){
      applyTabsTransform(true);
      normalizeTabsLoop();
      return;
    }

    if(targetTab){
      setActiveTab(targetTab.dataset.id);
    }
  });

  tabsViewport.addEventListener("pointercancel",()=>{ down=false; });
}

/* CONTENT */
const content = document.getElementById("content");

function getTabMeta(id){ return baseTabs.find(t=>t.id===id) || baseTabs[0]; }
function titleHTML(tabId){
  const meta = getTabMeta(tabId);
  return `
    <div class="title">
      <img class="ticon" src="${meta.icon}" alt="" draggable="false">
      <span>${meta.label}</span>
    </div>
  `;
}
function slider12HTML(tabId){
  const gamesHtml = pageHTML(tabId);
  return `
    <section class="section slider12" data-slider12="${tabId}">
      <div class="section-head">
        ${titleHTML(tabId)}
        <div class="right">
          <button class="more" data-act="more">Mais</button>
        </div>
      </div>
      ${gamesHtml}
    </section>
  `;
}

function tabQuenteHTML(){
  // Show "quente" section first, then previews of other categories that have games
  let html = slider12HTML("quente");
  for (const tab of baseTabs) {
    if (tab.id === "quente") continue;
    const games = getGamesForTab(tab.id);
    if (games.length) html += slider12HTML(tab.id);
  }
  return html;
}

function tabNormalHTML(tabId){
  return `
    <section class="section">
      <div class="section-head">${titleHTML(tabId)}</div>
      ${pageHTML(tabId)}
    </section>
  `;
}

function renderContent(){
  content.innerHTML = (tabActive === "quente") ? tabQuenteHTML() : tabNormalHTML(tabActive);
  content.querySelectorAll("img").forEach(img=>img.setAttribute("draggable","false"));

  // "Mais" button click handler
  content.onclick = (e)=>{
    const act = e.target.closest("[data-act]")?.dataset.act;
    if(!act) return;
    const slider = e.target.closest("[data-slider12]");
    if(slider && act === "more") setActiveTab(slider.dataset.slider12);
  };
}

/* INIT */
async function initApp() {
  // Fetch games and banners from API
  try {
    const [gamesRes, bannersRes] = await Promise.all([
      fetch('/api/games').then(r => r.json()).catch(() => ({ ok: false, data: [] })),
      fetch('/api/banners').then(r => r.json()).catch(() => ({ ok: false, data: [] }))
    ]);
    allGames = (gamesRes.ok && gamesRes.data) ? gamesRes.data : [];
    banners = (bannersRes.ok && bannersRes.data) ? bannersRes.data.map(b => ({ src: b.image_url, alt: 'Banner', link: b.link_url })) : [];
  } catch (e) {
    console.error('[INIT] fetch error:', e);
    allGames = [];
    banners = [];
  }

  syncMenuSpacer();
  mountBanners();
  mountMarquee();
  mountTabsLoop();
  renderContent();
  positionTelegram();
}
initApp();


/* =========================
   MODAL DEPÓSITO
========================= */
const depositModal = document.getElementById("depositModal");
const openDepositPlus = document.getElementById("openDepositPlus");
const openDepositWallet = document.getElementById("openDepositWallet");
const closeDeposit = document.getElementById("closeDeposit");

const depositGrid = document.getElementById("depositGrid");
const depositInput = document.getElementById("depositAmount");
const depositShown = document.getElementById("depositShown");
const depositClear = document.getElementById("depositClear");

function formatBRLNumber(n){
  const v = Number(n || 0);
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function setDepositValue(n){
  const val = Math.max(0, Number(n || 0));
  if(val === 0){
    depositShown.textContent = "R$0,00";
  }else{
    depositShown.textContent = `R$${formatBRLNumber(val)}`;
  }
  depositInput.value = val ? String(val) : "";
}

function clearDepositSelection(){
  depositGrid?.querySelectorAll(".dep-chip").forEach(b=>b.classList.remove("active"));
}

function openDeposit(){
  depositModal.classList.add("open");
  depositModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  clearDepositSelection();
  setDepositValue(0);
}

function closeDepositModal(){
  depositModal.classList.remove("open");
  depositModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function requireLoggedForDeposit(e){
  const logged = appEl.classList.contains("is-logged");
  if (logged) return true;
  e?.preventDefault?.();
  openAuth();
  setAuthTab("login");
  return false;
}

openDepositPlus?.addEventListener("click", (e) => {
  e.preventDefault();
  if (!requireLoggedForDeposit(e)) return;
  openDeposit();
});

openDepositWallet?.addEventListener("click", (e) => {
  e.preventDefault();
  if (!requireLoggedForDeposit(e)) return;
  openDeposit();
});

closeDeposit?.addEventListener("click", (e)=>{ e.preventDefault(); closeDepositModal(); });

depositModal?.addEventListener("click", (e)=>{
  if(e.target === depositModal) closeDepositModal();
});

depositGrid?.addEventListener("click", (e)=>{
  const btn = e.target.closest(".dep-chip");
  if(!btn) return;

  const val = Number(btn.dataset.val || 0);

  clearDepositSelection();
  btn.classList.add("active");

  setDepositValue(val);
});

depositInput?.addEventListener("input", ()=>{
  const raw = (depositInput.value || "").replace(/[^\d]/g, "");
  depositInput.value = raw;

  const n = raw ? Number(raw) : 0;
  depositShown.textContent = n ? `R$${formatBRLNumber(n)}` : "R$0,00";

  clearDepositSelection();
});

depositClear?.addEventListener("click", (e)=>{
  e.preventDefault();
  depositInput.value = "";
  depositShown.textContent = "R$0,00";
  clearDepositSelection();
});


/* =========================
   OFFCANVAS MENU
========================= */
const offcanvas = document.getElementById("offcanvas");
const openOffcanvas = document.getElementById("openOffcanvas");
const closeOffcanvas = document.getElementById("closeOffcanvas");
const copyUserIdBtn = document.getElementById("copyUserId");
const ocUserId = document.getElementById("ocUserId");
const openDepositFromMenu = document.getElementById("openDepositFromMenu");

function openOffcanvasMenu(){
  offcanvas.classList.add("open");
  offcanvas.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeOffcanvasMenu(){
  offcanvas.classList.remove("open");
  offcanvas.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
openOffcanvas?.addEventListener("click", async (e)=>{
  e.preventDefault();
  await updateAuthState();
  openOffcanvasMenu();
});

closeOffcanvas?.addEventListener("click", (e)=>{
  e.preventDefault();
  closeOffcanvasMenu();
});

offcanvas?.addEventListener("click", (e)=>{
  if(e.target === offcanvas) closeOffcanvasMenu();
});

window.addEventListener("keydown", (e)=>{
  if(e.key === "Escape" && offcanvas?.classList.contains("open")){
    closeOffcanvasMenu();
  }
});

copyUserIdBtn?.addEventListener("click", async (e)=>{
  e.preventDefault();
  const id = (ocUserId?.textContent || "").trim();
  if(!id) return;

  try{
    await navigator.clipboard.writeText(id);
  }catch(err){
    const ta = document.createElement("textarea");
    ta.value = id;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }

  copyUserIdBtn.style.transform = "scale(1.08)";
  setTimeout(()=>{ copyUserIdBtn.style.transform=""; }, 160);
});

openDepositFromMenu?.addEventListener("click", (e) => {
  e.preventDefault();
  if (!requireLoggedForDeposit(e)) return;
  closeOffcanvasMenu();
  openDeposit();
});

/* =========================
   MODAL AUTH (REGISTRO / LOGIN)
========================= */
const authModal = document.getElementById("authModal");
const authClose = document.getElementById("authClose");
const tabRegister = document.getElementById("tabRegister");
const tabLogin = document.getElementById("tabLogin");
const paneRegister = document.getElementById("paneRegister");
const paneLogin = document.getElementById("paneLogin");

function openAuth(){
  authModal.classList.add("open");
  authModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setAuthTab("register");
}
function closeAuth(){
  authModal.classList.remove("open");
  authModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function setAuthTab(which){
  const isReg = which === "register";
  tabRegister.classList.toggle("active", isReg);
  tabLogin.classList.toggle("active", !isReg);
  paneRegister.classList.toggle("show", isReg);
  paneLogin.classList.toggle("show", !isReg);
}

tabRegister?.addEventListener("click", ()=> setAuthTab("register"));
tabLogin?.addEventListener("click", ()=> setAuthTab("login"));

authClose?.addEventListener("click", closeAuth);

authModal?.addEventListener("click", (e)=>{
  const card = e.target.closest(".auth-card");
  if(!card) closeAuth();
});

window.addEventListener("keydown", (e)=>{
  if(e.key === "Escape" && authModal?.classList.contains("open")) closeAuth();
});

document.getElementById("openAuthBottom")?.addEventListener("click", (e) => {
  e.preventDefault();
  const logged = appEl.classList.contains("is-logged");
  if (!logged) {
    openAuth();
    setAuthTab("login");
  }
});


/* helpers: clear + eye + warn */
function bindField(inputId, errId){
  const input = document.getElementById(inputId);
  const err = document.getElementById(errId);
  if(!input) return;

  const clearBtn = document.querySelector(`button.clear[data-clear="#${inputId}"]`);
  const eyeBtn = document.querySelector(`button.eye[data-eye="#${inputId}"]`);

  function refresh(){
    const has = !!input.value.trim();
    if(clearBtn) clearBtn.classList.toggle("hidden", !has);
    if(err) err.classList.toggle("show", !has);
  }

  input.addEventListener("input", refresh);
  input.addEventListener("blur", refresh);

  if(clearBtn){
    clearBtn.addEventListener("click", ()=>{
      input.value = "";
      refresh();
      input.focus();
      if(eyeBtn){
        input.type = "password";
        eyeBtn.querySelector("img").src = "/public/img/hidd.svg";
      }
    });
    clearBtn.classList.add("hidden");
  }

  if(eyeBtn){
    eyeBtn.addEventListener("click", ()=>{
      const img = eyeBtn.querySelector("img");
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      img.src = isHidden ? "/public/img/show.svg" : "/public/img/hidd.svg";
      input.focus();
    });
  }

  if(err) err.classList.remove("show");
}

bindField("regUser", "errRegUser");
bindField("regPass", "errRegPass");
bindField("regPhone", null);

bindField("logUser", "errLogUser");
bindField("logPass", "errLogPass");


// =========================
// AUTH REAL (LOGIN/REGISTER) + HEADER GUEST/LOGGED
// =========================
async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json: j };
}

async function updateAuthState() {
  let j = null;

  try {
    const res = await fetch("/api/me", {
      credentials: "include",
      cache: "no-store"
    });
    j = await res.json().catch(() => null);
  } catch (e) {
    j = null;
  }

  const logged = !!(j && j.ok && j.logged);

  appEl.classList.toggle("is-logged", logged);
  appEl.classList.toggle("is-guest", !logged);

  const ocName = document.getElementById("ocUserName");
  const ocId = document.getElementById("ocUserId");

  if (!logged) {
    if (ocName) ocName.textContent = "User";
    if (ocId) ocId.textContent = "-";
    return;
  }

  if (ocName && j.user?.username) ocName.textContent = j.user.username;
  if (ocId && j.user?.id) ocId.textContent = j.user.id;

  refreshWalletUI();
}


document.getElementById("openLoginTop")?.addEventListener("click", () => {
  openAuth();
  setAuthTab("login");
});
document.getElementById("openRegisterTop")?.addEventListener("click", () => {
  openAuth();
  setAuthTab("register");
});

document.getElementById("btnRegister")?.addEventListener("click", async () => {
  const username = document.getElementById("regUser")?.value.trim() || "";
  const password = document.getElementById("regPass")?.value || "";
  const phone = document.getElementById("regPhone")?.value.trim() || "";

  if (username.length < 3) { document.getElementById("errRegUser")?.classList.add("show"); return; }
  if (password.length < 6 || password.length > 16) { document.getElementById("errRegPass")?.classList.add("show"); return; }

  const btn = document.getElementById("btnRegister");
  btn.disabled = true;

  const { ok, json } = await apiPost("/api/register", { username, password, phone });

  btn.disabled = false;

  if (!ok) {
    alert(json?.error === "username_taken" ? "Usuário já existe." : ("Erro: " + (json?.error || json?.msg || "unknown")));
    return;
  }

  closeAuth();
  await updateAuthState();
});

document.getElementById("btnLogin")?.addEventListener("click", async () => {
  const username = document.getElementById("logUser")?.value.trim() || "";
  const password = document.getElementById("logPass")?.value || "";

  if (username.length < 3) { document.getElementById("errLogUser")?.classList.add("show"); return; }
  if (password.length < 6 || password.length > 16) { document.getElementById("errLogPass")?.classList.add("show"); return; }

  const btn = document.getElementById("btnLogin");
  btn.disabled = true;

  const { ok, json } = await apiPost("/api/login", { username, password });

  btn.disabled = false;

  if (!ok) {
    alert(json?.error === "invalid_credentials" ? "Usuário ou senha inválidos." : ("Erro: " + (json?.error || json?.msg || "unknown")));
    return;
  }

  closeAuth();
  await updateAuthState();
});

updateAuthState();


// =========================
// WALLET UI
// =========================
async function fetchWallet() {
  const res = await fetch("/api/wallet", { credentials: "include" });
  const j = await res.json().catch(() => null);
  if (!j || !j.ok) return null;
  return j;
}

function brlToPt(v) {
  return String(v ?? "0.00").replace(".", ",");
}

async function refreshWalletUI() {
  const w = await fetchWallet();
  if (!w) return;

  const headerBalance = document.getElementById("walletBalance");
  if (headerBalance) headerBalance.textContent = w.balance_brl;

  const depBalance = document.getElementById("depositBalance");
  if (depBalance) depBalance.textContent = brlToPt(w.balance_brl);
}

// =========================
// PIX / QR + aprovação
// =========================
const btnRechargeNow = document.getElementById("btnRechargeNow");
const pixResult = document.getElementById("pixResult");
const pixQr = document.getElementById("pixQr");
const pixCopy = document.getElementById("pixCopy");
const pixMeta = document.getElementById("pixMeta");
const btnCopyPix = document.getElementById("btnCopyPix");

let lastPix = null;

async function createDepositPix(amountBrl) {
  const res = await fetch("/api/deposit/create", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount_brl: amountBrl })
  });

  const txt = await res.text();
  try { return JSON.parse(txt); }
  catch { return { ok:false, error:"invalid_json", details: txt, status: res.status }; }
}


function renderPix(copyPaste, meta, invoiceUrl) {
  pixResult.style.display = "block";
  pixCopy.value = copyPaste || "";

  const qrSrc = "https://quickchart.io/qr?size=260&margin=2&text=" + encodeURIComponent(copyPaste);

  pixQr.innerHTML = `
    <div style="display:flex;justify-content:center;margin:12px 0;">
      <img
        src="${qrSrc}"
        alt="QR PIX"
        style="width:260px;height:260px;background:#fff;padding:10px;border-radius:14px"
        referrerpolicy="no-referrer"
      >
    </div>
  `;

  if (pixMeta) {
    pixMeta.textContent =
      `Ref: ${meta.externalReference} | TX: ${meta.transactionId} | Valor: R$ ${meta.amount_brl}`;
  }
}


btnCopyPix?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(pixCopy.value);
    btnCopyPix.textContent = "Copiado!";
    setTimeout(() => (btnCopyPix.textContent = "Copiar PIX"), 1200);
  } catch {
    pixCopy.select();
    document.execCommand("copy");
  }
});


// ---------- polling ----------
let __watchTimer = null;

function stopWatchPayment(){
  if (__watchTimer) clearInterval(__watchTimer);
  __watchTimer = null;
}

async function fetchDepositStatus(txId){
  const res = await fetch(`/api/deposit/status?tx_id=${encodeURIComponent(txId)}`, {
    credentials: "include"
  });
  const txt = await res.text();
  try { return JSON.parse(txt); }
  catch { return { ok:false, error:"invalid_json", raw:txt, http_status:res.status }; }
}

function toastPersistent(msg){
  const t = document.getElementById("toast");
  if(!t) return alert(msg);

  t.innerHTML = `
    <div class="toast-icon">✓</div>
    <div class="toast-text">${String(msg)}</div>
    <div class="toast-hint">Toque para fechar</div>
  `;
  t.classList.add("show", "celebrate");

  const close = () => {
    t.classList.remove("show", "celebrate");
    window.removeEventListener("pointerdown", close, true);
    window.removeEventListener("keydown", esc, true);
  };
  const esc = (e) => { if(e.key === "Escape") close(); };

  window.addEventListener("pointerdown", close, true);
  window.addEventListener("keydown", esc, true);
}

async function startWatchPayment(txId){
  stopWatchPayment();

  __watchTimer = setInterval(async ()=>{
    try{
      const j = await fetchDepositStatus(txId);

      if (j?.ok && j.paid){
        stopWatchPayment();
        await refreshWalletUI();
        toastPersistent("✅ Pagamento aprovado e saldo creditado!");
      }
    }catch(e){}
  }, 2000);
}


// ---------- click: gerar pix ----------
btnRechargeNow?.addEventListener("click", async (e) => {
  e.preventDefault();

  const raw = (document.getElementById("depositAmount")?.value || "").replace(/[^\d]/g, "");
  const val = raw ? Number(raw) : 0;
  if (!val || val < 30) return alert("Valor mínimo: R$30");

  btnRechargeNow.disabled = true;
  btnRechargeNow.textContent = "Gerando PIX...";

  const j = await createDepositPix(val);

  btnRechargeNow.disabled = false;
  btnRechargeNow.textContent = "Recarregue Agora";

  if (!j || !j.ok) {
    alert("Erro ao criar PIX: " + (j?.error || j?.msg || "unknown") + (j?.detail ? (" | " + j.detail) : ""));
    return;
  }

  lastPix = j;
  startWatchPayment(j.tx_id);

  const copyPaste =
    j.copyPaste ||
    j.raw?.data?.paymentData?.copyPaste ||
    j.raw?.data?.paymentData?.qrCode ||
    "";

  const transactionId =
    j.transactionId ||
    j.raw?.data?.transactionId ||
    "";

  const externalReference =
    j.externalReference ||
    j.externalRef ||
    String(j.tx_id || "");

  const invoiceUrl =
    j.invoiceUrl ||
    j.raw?.data?.invoiceUrl ||
    "";

  if (!copyPaste) {
    alert("BlackCat não retornou copyPaste/qrCode.");
    return;
  }

  renderPix(copyPaste, {
    externalReference,
    transactionId,
    amount_brl: val.toFixed(2).replace(".", ",")
  }, invoiceUrl);

  lastPix = { copyPaste, externalReference, transactionId, invoiceUrl };
});


function resetPixUI() {
  if (pixResult) pixResult.style.display = "none";
  if (pixQr) pixQr.innerHTML = "";
  if (pixCopy) pixCopy.value = "";
  if (pixMeta) pixMeta.textContent = "";
  lastPix = null;
}

document.getElementById("openDepositPlus")?.addEventListener("click", () => {
  refreshWalletUI();
  resetPixUI();
});

document.getElementById("openDepositWallet")?.addEventListener("click", () => {
  refreshWalletUI();
  resetPixUI();
});

refreshWalletUI();


function toast(msg, ms=2800){
  const t = document.getElementById("toast");
  if(!t) return alert(msg);

  t.innerHTML = `
    <div class="toast-icon">✓</div>
    <div class="toast-text">${String(msg)}</div>
  `;
  t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=> t.classList.remove("show"), ms);
}


// =========================
// LOGOUT
// =========================
document.getElementById("btnLogout")?.addEventListener("click", async (e) => {
  e.preventDefault();

  try {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
  } catch (err) {}

  try { closeOffcanvasMenu(); } catch {}
  try { closeDepositModal(); } catch {}
  resetPixUI?.();

  await updateAuthState();

  const ocName = document.getElementById("ocUserName");
  const ocId = document.getElementById("ocUserId");
  if (ocName) ocName.textContent = "User";
  if (ocId) ocId.textContent = "-";
});

// Offcanvas -> abrir auth (guest)
document.getElementById("openLoginFromMenu")?.addEventListener("click", (e)=>{
  e.preventDefault();
  closeOffcanvasMenu();
  openAuth();
  setAuthTab("login");
});

document.getElementById("openRegisterFromMenu")?.addEventListener("click", (e)=>{
  e.preventDefault();
  closeOffcanvasMenu();
  openAuth();
  setAuthTab("register");
});

document.getElementById("walletRefresh")?.addEventListener("click", (e)=>{
  e.preventDefault();
  refreshWalletUI();
});


// =========================
// DRAWER MANAGER (GLOBAL)
// =========================
(function () {
  const SELECTORS_TO_CLOSE = [
    "#rankingDrawer",
    "#accountDrawer",
    "#bonusDrawer",
    "#offcanvas",
    "#depositModal",
    "#authModal",
    ".auth"
  ];

  function closeEl(el) {
    if (!el) return;
    el.classList.remove("open");
    el.setAttribute("aria-hidden", "true");
  }

  function closeAll() {
    SELECTORS_TO_CLOSE.forEach((sel) => {
      document.querySelectorAll(sel).forEach(closeEl);
    });

    if (typeof window.closeRankingDrawer === "function") {
      try { window.closeRankingDrawer(); } catch (e) {}
    }
    if (typeof window.closeBonusDrawer === "function") {
      try { window.closeBonusDrawer(); } catch (e) {}
    }
    if (typeof window.closeAccountDrawer === "function") {
      try { window.closeAccountDrawer(); } catch (e) {}
    }

    document.body.style.overflow = "";
  }

  function openOne(id) {
    closeAll();

    const el = document.getElementById(id);
    if (!el) return;

    el.classList.add("open");
    el.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  window.drawerManager = {
    closeAll,
    openRanking: () => openOne("rankingDrawer"),
    openBonus: () => openOne("bonusDrawer"),
    openAccount: () => openOne("accountDrawer"),
    openOffcanvas: () => openOne("offcanvas"),
    openDeposit: () => openOne("depositModal"),
    openAuth: () => openOne("authModal"),
  };
})();
