"use strict";

const LANG_ORDER = ["en","it","fr","es","zh"];

async function initTopbarDropdown() {
  const profileBtn = document.getElementById("profileBtn");
  const dropdown   = document.getElementById("profileDropdown");
  if (!profileBtn || !dropdown) return;

  const langBtn = document.getElementById("langToggleBtn");
  const user    = await Session.get();

  if (langBtn) {
    langBtn.addEventListener("click", () => {
      const next = LANG_ORDER[(LANG_ORDER.indexOf(Lang.get()) + 1) % LANG_ORDER.length];
      Lang.set(next);
      Lang.apply();
        applyLandingTranslations();
    });
  }

  if (user) {
    // Utente autenticato
    if (langBtn) langBtn.style.display = "none";

    // CTA primario: "Inizia" → "Prenota ora"
    const primaryCta = document.querySelector(".actions .btn-primary");
    if (primaryCta) {
      primaryCta.href = "book-ride.html";
      const span = primaryCta.querySelector("[data-i18n-key='getStarted']");
      if (span) {
        span.dataset.i18nKey = "bookNow";
        const t = LANGS[Lang.get()] || LANGS.en;
        span.textContent = t.bookNow || "Book now";
      }
    }
    // CTA secondario: "Accedi" → "Il mio dashboard"
    const secondaryCta = document.querySelector(".actions .btn-secondary");
    if (secondaryCta) {
      secondaryCta.href = "dashboard.html";
      const secSpan = secondaryCta.querySelector("span");
      if (secSpan) { secSpan.textContent = "My dashboard"; secSpan.removeAttribute("data-i18n-key"); }
    }

    const circle = profileBtn.querySelector(".circle");
    if (circle) {
      circle.classList.add("is-logged-in");
      if (user.photo) {
        circle.classList.add("has-photo");
        circle.innerHTML = `<img src="${user.photo}" alt="Avatar">`;
      }
      else            circle.textContent = user.initials || "R";
    }
    const ddName  = dropdown.querySelector(".dd-name");
    const ddEmail = dropdown.querySelector(".dd-email");
    if (ddName)  ddName.textContent  = `${user.firstName} ${user.lastName}`.trim();
    if (ddEmail) ddEmail.textContent = user.email || "";

    dropdown.querySelectorAll("[data-guest]").forEach(el => el.style.display = "none");
    dropdown.querySelectorAll("[data-user]").forEach(el  => el.style.display = "");

    // Carica punti fedeltà nel dropdown
    const ddFidelityMini  = document.getElementById("ddFidelityMini");
    const ddFidelityPtsVal = document.getElementById("ddFidelityPtsVal");
    const ddFidelityBar   = document.getElementById("ddFidelityBar");
    const rideToken = localStorage.getItem("ride_token");
    if (rideToken && ddFidelityMini) {
      fetch("/api/fidelity", { headers: { "Authorization": "Bearer " + rideToken } })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return;
          const pts = data.pts || 0;
          if (ddFidelityPtsVal) ddFidelityPtsVal.textContent = pts.toLocaleString();
          if (ddFidelityBar) ddFidelityBar.style.width = Math.min(100, (pts / 1000) * 100) + "%";
          ddFidelityMini.style.display = "";
        })
        .catch(() => {});
    }

    // Modale di disconnessione
    const soModal = _buildSignOutModal();
    dropdown.querySelector(".dd-signout")?.addEventListener("click", e => {
      e.preventDefault(); e.stopPropagation();
      dropdown.classList.remove("is-open");
      soModal.classList.add("is-open");
    });
    document.getElementById("soCancel")?.addEventListener("click",  () => soModal.classList.remove("is-open"));
    document.getElementById("soConfirm")?.addEventListener("click", () => { Session.clear(true); window.location.reload(); });
    soModal.addEventListener("click", e => { if (e.target === soModal) soModal.classList.remove("is-open"); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") soModal.classList.remove("is-open"); });

  } else {
    // Ospite non autenticato
    if (langBtn) langBtn.style.display = "";
    dropdown.querySelectorAll("[data-user]").forEach(el  => el.style.display = "none");
    dropdown.querySelectorAll("[data-guest]").forEach(el => el.style.display = "");
  }

  // Apertura/chiusura dropdown profilo
  profileBtn.addEventListener("click", e => { e.stopPropagation(); dropdown.classList.toggle("is-open"); });
  document.addEventListener("click", e => {
    if (!profileBtn.closest(".profile-btn-wrap")?.contains(e.target))
      dropdown.classList.remove("is-open");
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") dropdown.classList.remove("is-open"); });
}

function _buildSignOutModal() {
  if (document.getElementById("soModal")) return document.getElementById("soModal");
  const m = document.createElement("div");
  m.id = "soModal"; m.className = "so-overlay";
  m.innerHTML = `<div class="so-box" role="dialog" aria-modal="true">
    <div class="so-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></div>
    <h3>Sign out?</h3>
    <p>You'll need to sign in again to access your account.</p>
    <div class="so-actions">
      <button class="so-cancel" id="soCancel">Cancel</button>
      <button class="so-confirm" id="soConfirm">Sign out</button>
    </div></div>`;
  document.body.appendChild(m); return m;
}

// Applica le traduzioni alla landing page
function applyLandingTranslations() {
  const t = LANGS[Lang.get()] || LANGS.en;

  // Aggiorna tutti gli elementi data-i18n-key (escluse le label del parallax gestite a parte)
  const PARALLAX_IDS = new Set(["featureTitle", "featureText"]);
  document.querySelectorAll("[data-i18n-key]").forEach(el => {
    if (PARALLAX_IDS.has(el.id)) return; // handled separately
    const v = t[el.dataset.i18nKey];
    if (v == null) return;
    const svgs = [...el.querySelectorAll("svg")];
    el.textContent = v;
    svgs.forEach(s => el.insertBefore(s, el.firstChild));
  });

  // Link di navigazione
  const navLinks = document.querySelectorAll(".nav-overlay .nav-link");
  const navKeys  = ["home","features","vehicles","fidelity","drive"];
  navLinks.forEach((a, i) => { if (navKeys[i] && t[navKeys[i]]) a.textContent = t[navKeys[i]]; });

  // Dropdown profilo
  const _set = (el, text) => {
    if (!el || !text) return;
    const svgs = [...el.querySelectorAll("svg")];
    el.textContent = text;
    svgs.forEach(s => el.insertBefore(s, el.firstChild));
  };
  const ui = [...document.querySelectorAll("[data-user] .dd-item")];
  if (ui[0]) _set(ui[0], t.myDashboard   || "My Dashboard");
  if (ui[1]) _set(ui[1], t.myFidelityCard || "My Fidelity Card");
  if (ui[2]) _set(ui[2], t.settings       || "Settings");
  _set(document.querySelector(".dd-signout"), t.signOut || "Sign out");
  const gi = [...document.querySelectorAll("[data-guest] .dd-item")];
  if (gi[0]) _set(gi[0], t.signIn        || "Sign in");
  if (gi[1]) _set(gi[1], t.createAccount || "Create account");

  // Pannelli feature: aggiorna attributi data-title / data-text
  document.querySelectorAll(".feature-panel[data-i18n-title]").forEach(panel => {
    const tk = panel.dataset.i18nTitle;
    const vk = panel.dataset.i18nText;
    if (tk && t[tk]) panel.dataset.title = t[tk];
    if (vk && t[vk]) panel.dataset.text  = t[vk];
  });

  // Aggiorna titolo/testo del pannello attivo
  const featureTitle = document.getElementById("featureTitle");
  const featureText  = document.getElementById("featureText");
  if (featureTitle && featureText) {
    const activePanel = document.querySelector(".feature-panel.active");
    if (activePanel) {
      featureTitle.textContent = activePanel.dataset.title || featureTitle.textContent;
      featureText.textContent  = activePanel.dataset.text  || featureText.textContent;
    }
  }

  // Copyright nel footer
  const ftCopy = document.querySelector(".footer-bottom p");
  if (ftCopy && t.footerCopyright) ftCopy.textContent = t.footerCopyright;

  Lang.apply();
}

// Inizializzazione
document.addEventListener("DOMContentLoaded", async () => {
  Theme.apply();
  Motion.apply();
  Lang.apply();

  await initTopbarDropdown();
  Lang.apply();
  Theme.apply();
  applyLandingTranslations();
});

// Effetto spotlight sulle card al passaggio del cursore
(function initSpotlight() {
  let cards = [];

  function refreshCards() {
    cards = Array.from(document.querySelectorAll('.vehicle-card, .scd-media'));
  }

  function injectGlows() {
    refreshCards();
    cards.forEach(card => {
      if (!card.querySelector('.spotlight-glow')) {
        const span = document.createElement('span');
        span.className = 'spotlight-glow';
        span.setAttribute('aria-hidden', 'true');
        card.appendChild(span);
      }
    });
  }

  // Coordinate relative alla card (funziona anche con CSS transforms attivi)
  let lastRaf = null;
  document.addEventListener('pointermove', function(e) {
    if (lastRaf) return;
    lastRaf = requestAnimationFrame(function() {
      lastRaf = null;
      const cx  = e.clientX;
      const cy  = e.clientY;
      const hue = (218 + (cx / window.innerWidth) * 50).toFixed(1);

      cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const over = cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom;

        card.style.setProperty('--mx', (cx - rect.left).toFixed(1) + 'px');
        card.style.setProperty('--my', (cy - rect.top).toFixed(1)  + 'px');
        card.style.setProperty('--hue', hue);
        card.classList.toggle('spotlight-active', over);
      });
    });
  });

  document.addEventListener('pointerleave', function() {
    cards.forEach(card => card.classList.remove('spotlight-active'));
  });

  window.addEventListener('resize', refreshCards, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectGlows);
  } else {
    injectGlows();
  }
})();
