const VAPID_PUBLIC_KEY = "BJXLIPh4YoLx91Julz5elFgYJanLQ1OkfYW_fNeLjfwemFqcmbPmizV_bFuMwiKSr5aB5DYBT2-nV74Zbl-c8HQ";

const CATEGORIES = ["Global Giant", "Comeback", "Cautionary Tale", "India Rising", "Global Startup", "Everyday Product"];

let ALL = [];
let activeCategory = "All";
let currentDetailSlug = null;

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// ---------- storage ----------

const store = {
  readSet: () => new Set(JSON.parse(localStorage.getItem("bs_read") || "[]")),
  saveRead: set => localStorage.setItem("bs_read", JSON.stringify([...set])),
  savedSet: () => new Set(JSON.parse(localStorage.getItem("bs_saved") || "[]")),
  saveSaved: set => localStorage.setItem("bs_saved", JSON.stringify([...set])),
  getKey: () => localStorage.getItem("bs_key") || "",
  setKey: k => localStorage.setItem("bs_key", k),
};

function markRead(slug) {
  const s = store.readSet();
  if (s.has(slug)) return;
  s.add(slug);
  store.saveRead(s);
}

function toggleSaved(slug) {
  const s = store.savedSet();
  if (s.has(slug)) s.delete(slug); else s.add(slug);
  store.saveSaved(s);
  return s.has(slug);
}

// ---------- deterministic "today's pick" (mirrors api/notify.js logic) ----------

// UTC-based to match api/notify.js exactly, so the in-app spotlight lines
// up with the morning push regardless of the phone's local timezone.
function dayOfYear(d) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 0));
  const diff = d - start;
  return Math.floor(diff / 86400000);
}

// simple seeded shuffle so the rotation order isn't just array order,
// but stays stable across reloads (and matches the server's picks)
function seededOrder(n, seed) {
  const arr = Array.from({ length: n }, (_, i) => i);
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function todaysPick() {
  const order = seededOrder(ALL.length, 42);
  const idx = order[dayOfYear(new Date()) % ALL.length];
  return ALL[idx];
}

// ---------- rendering helpers ----------

function catClass(cat) { return "cat-" + cat.replace(/\s+/g, "-"); }

function cardHTML(cs, { showTag = true } = {}) {
  const read = store.readSet().has(cs.slug);
  const saved = store.savedSet().has(cs.slug);
  return `
    <div class="card ${read ? "" : "unread"}" data-slug="${cs.slug}">
      <div class="emoji">${cs.emoji}</div>
      <div class="body">
        <p class="company"><span class="dot"></span>${cs.company}</p>
        <p class="hook-line">${cs.hook}</p>
        ${showTag ? `<span class="tag ${catClass(cs.category)}">${cs.category}</span>` : ""}
      </div>
      <button class="bookmark-btn ${saved ? "saved" : ""}" data-slug="${cs.slug}" aria-label="Save">${saved ? "★" : "☆"}</button>
    </div>`;
}

function renderFeed() {
  const pick = todaysPick();
  const spotlight = $("#spotlight");
  spotlight.dataset.slug = pick.slug;
  spotlight.innerHTML = `
    <div class="kicker">Today's spotlight</div>
    <h2 class="headline">${pick.company}</h2>
    <p class="hook">${pick.hook}</p>
    <div class="meta-row">
      <span class="tag ${catClass(pick.category)}">${pick.category}</span>
      <span>· ${pick.hq}</span>
    </div>`;

  const rest = ALL.filter(c => c.slug !== pick.slug);
  // unread first, otherwise stable order
  rest.sort((a, b) => {
    const ar = store.readSet().has(a.slug), br = store.readSet().has(b.slug);
    if (ar === br) return 0;
    return ar ? 1 : -1;
  });
  $("#feedList").innerHTML = rest.map(cs => cardHTML(cs)).join("");
}

function renderBrowse() {
  const q = ($("#searchInput").value || "").trim().toLowerCase();
  let list = ALL;
  if (activeCategory !== "All") list = list.filter(c => c.category === activeCategory);
  if (q) list = list.filter(c => c.company.toLowerCase().includes(q) || c.hook.toLowerCase().includes(q));
  $("#browseList").innerHTML = list.map(cs => cardHTML(cs)).join("") ||
    `<p class="empty-state" style="display:block">No matches.</p>`;
}

function renderCategoryChips() {
  const chips = ["All", ...CATEGORIES];
  $("#categoryChips").innerHTML = chips.map(c =>
    `<button class="chip ${c === activeCategory ? "active" : ""}" data-cat="${c}">${c}</button>`
  ).join("");
}

function renderSaved() {
  const saved = store.savedSet();
  const list = ALL.filter(c => saved.has(c.slug));
  $("#savedList").innerHTML = list.map(cs => cardHTML(cs, { showTag: false })).join("");
  $("#savedEmpty").style.display = list.length ? "none" : "block";
}

function renderDetail(slug) {
  const cs = ALL.find(c => c.slug === slug);
  if (!cs) return;
  currentDetailSlug = slug;
  markRead(slug);
  const saved = store.savedSet().has(slug);
  const s = cs.sections;
  $("#detailArticle").innerHTML = `
    <span class="art-tag ${catClass(cs.category)}">${cs.category}</span>
    <h1>${cs.emoji} ${cs.company}</h1>
    <p class="art-meta">${cs.hq} · Founded ${cs.founded}</p>
    <p class="art-hook">${cs.hook}</p>

    <div class="art-section"><p class="art-section-label">Origin</p><p>${s.origin}</p></div>
    <div class="art-section"><p class="art-section-label">The Struggle</p><p>${s.struggle}</p></div>
    <div class="art-section"><p class="art-section-label">The Turn</p><p>${s.turn}</p></div>
    <div class="art-section"><p class="art-section-label">Today</p><p>${s.today}</p></div>

    <div class="takeaway">
      <p class="art-section-label">Takeaway</p>
      <p>${cs.takeaway}</p>
    </div>

    <div class="detail-actions">
      <button id="detailSaveBtn" class="${saved ? "saved" : ""}">${saved ? "★ Saved" : "☆ Save for later"}</button>
    </div>
  `;
  $("#detailSaveBtn").addEventListener("click", () => {
    const nowSaved = toggleSaved(slug);
    $("#detailSaveBtn").textContent = nowSaved ? "★ Saved" : "☆ Save for later";
    $("#detailSaveBtn").classList.toggle("saved", nowSaved);
  });
}

// ---------- view / tab switching ----------

function showView(name) {
  $$(".view").forEach(v => v.classList.remove("active"));
  $("#view-" + name).classList.add("active");
  if (name === "feed") { $("#tabs").style.display = "flex"; renderFeed(); }
  else if (name === "browse") { $("#tabs").style.display = "flex"; renderBrowse(); }
  else if (name === "saved") { $("#tabs").style.display = "flex"; renderSaved(); }
  else { $("#tabs").style.display = "none"; }
  if (name === "settings") updateProgressLine();
  if (name === "feed" || name === "browse" || name === "saved") {
    $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === name));
  }
  window.scrollTo(0, 0);
}

function openDetail(slug) {
  renderDetail(slug);
  showView("detail");
  history.pushState({}, "", `?cs=${encodeURIComponent(slug)}`);
}

// ---------- event wiring ----------

function wireEvents() {
  $$(".tab").forEach(t => t.addEventListener("click", () => showView(t.dataset.view)));

  document.addEventListener("click", e => {
    const bookmarkBtn = e.target.closest(".bookmark-btn");
    if (bookmarkBtn) {
      e.stopPropagation();
      const nowSaved = toggleSaved(bookmarkBtn.dataset.slug);
      bookmarkBtn.textContent = nowSaved ? "★" : "☆";
      bookmarkBtn.classList.toggle("saved", nowSaved);
      if ($("#view-saved").classList.contains("active")) renderSaved();
      return;
    }
    const card = e.target.closest(".card, .spotlight");
    if (card && card.dataset.slug) openDetail(card.dataset.slug);
  });

  $("#backBtn").addEventListener("click", () => {
    history.pushState({}, "", "./");
    showView(activeTabBeforeDetail || "feed");
  });

  $("#searchInput").addEventListener("input", renderBrowse);

  $("#categoryChips").addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    activeCategory = chip.dataset.cat;
    renderCategoryChips();
    renderBrowse();
  });

  $("#settingsBtn").addEventListener("click", () => { activeTabBeforeDetail = currentTab(); showView("settings"); });
  $("#settingsBackBtn").addEventListener("click", () => showView(activeTabBeforeDetail || "feed"));

  $("#enableNotifBtn").addEventListener("click", enableNotifications);
  $("#saveKeyBtn").addEventListener("click", () => {
    store.setKey($("#syncKeyInput").value.trim());
    $("#notifStatus").textContent = "Key saved.";
  });
  $("#resetBtn").addEventListener("click", () => {
    if (!confirm("Clear your read history? Saved bookmarks are kept.")) return;
    localStorage.removeItem("bs_read");
    updateProgressLine();
    if ($("#view-feed").classList.contains("active")) renderFeed();
  });

  window.addEventListener("popstate", () => routeFromLocation());
}

let activeTabBeforeDetail = "feed";
function currentTab() {
  return $$(".tab").find(t => t.classList.contains("active"))?.dataset.view || "feed";
}

function updateProgressLine() {
  const read = store.readSet().size;
  $("#progressLine").textContent = `${read} of ${ALL.length} stories read.`;
  $("#countLine").textContent = ALL.length;
}

// ---------- routing ----------

function routeFromLocation() {
  const params = new URLSearchParams(location.search);
  const slug = params.get("cs");
  if (slug && ALL.find(c => c.slug === slug)) {
    renderDetail(slug);
    showView("detail");
  } else {
    showView("feed");
  }
}

// ---------- push notifications ----------

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function enableNotifications() {
  const status = $("#notifStatus");
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    status.textContent = "Push isn't supported in this browser. On iPhone, add this app to your Home Screen first (Share → Add to Home Screen), then open it from there.";
    return;
  }
  const key = store.getKey();
  if (!key) {
    status.textContent = "Save your sync key first (above).";
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { status.textContent = "Permission denied."; return; }

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-secret": key },
      body: JSON.stringify(sub),
    });
    if (!res.ok) throw new Error("server rejected subscription");
    status.textContent = "Notifications enabled — you'll get spotlights a few times a day.";
  } catch (e) {
    status.textContent = "Couldn't enable notifications: " + (e.message || e);
  }
}

// ---------- boot ----------

async function boot() {
  wireEvents();
  const res = await fetch("data/case-studies.json");
  ALL = await res.json();
  renderCategoryChips();
  $("#syncKeyInput").value = store.getKey();
  updateProgressLine();
  routeFromLocation();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
    navigator.serviceWorker.addEventListener("message", e => {
      if (e.data && e.data.type === "open-case-study" && e.data.slug) openDetail(e.data.slug);
    });
  }
}

boot();
