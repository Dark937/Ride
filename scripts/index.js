/* ═══════════════════════════════════════════════════════════════════
   RIDE — INDEX PAGE JS  (scripts/index.js)
   Requires: shared.js loaded before this file.
   ═══════════════════════════════════════════════════════════════════ */
"use strict";

/* ── LANG FLAGS MAP ────────────────────────────────────────────────── */
const LANG_ORDER = ["en","it","fr","es","zh"];

/* ── TOPBAR DROPDOWN + GUEST CONTROLS ─────────────────────────────── */
async function initTopbarDropdown() {
  const profileBtn = document.getElementById("profileBtn");
  const dropdown   = document.getElementById("profileDropdown");
  if (!profileBtn || !dropdown) return;

  // No theme toggle on landing page.
  const langBtn = document.getElementById("langToggleBtn");

  const user = await Session.get();

  // ── Wire lang toggle (same for guest & logged-in) ──
  if (langBtn) {
    langBtn.addEventListener("click", () => {
      const next = LANG_ORDER[(LANG_ORDER.indexOf(Lang.get()) + 1) % LANG_ORDER.length];
      Lang.set(next);
      Lang.apply();
        applyLandingTranslations();
    });
  }

  if (user) {
    /* ── LOGGED IN ── */
    // Hide lang toggle when user is logged in (preferences are in settings)
    if (langBtn) langBtn.style.display = "none";

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

    // Sign-out modal
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
    /* ── GUEST ── */
    // Show lang toggle for guests
    if (langBtn) langBtn.style.display = "";
    dropdown.querySelectorAll("[data-user]").forEach(el  => el.style.display = "none");
    dropdown.querySelectorAll("[data-guest]").forEach(el => el.style.display = "");
  }

  // Dropdown open/close
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

/* ── APPLY LANDING TRANSLATIONS ───────────────────────────────────── */
function applyLandingTranslations() {
  const t = LANGS[Lang.get()] || LANGS.en;

  // ── Hero CTA buttons ──
  document.querySelectorAll(".btn-primary  span").forEach(el => { el.textContent = t.getStarted || el.textContent; });
  document.querySelectorAll(".btn-secondary span").forEach(el => { el.textContent = t.viewPlans  || el.textContent; });

  // ── Hamburger nav links (nav-link inside nav-overlay) ──
  const navLinks = document.querySelectorAll(".nav-overlay .nav-link");
  const navKeys  = ["home","features","vehicles","fidelity","drive"];
  navLinks.forEach((a, i) => { if (navKeys[i] && t[navKeys[i]]) a.textContent = t[navKeys[i]]; });

  // ── Helper: replace text but preserve child SVG ──
  const _set = (el, text) => {
    if (!el || !text) return;
    const svgs = [...el.querySelectorAll("svg")];
    el.textContent = text;
    svgs.forEach(svg => el.insertBefore(svg, el.firstChild));
  };

  // ── Profile dropdown — logged in ──
  const ui = [...document.querySelectorAll("[data-user] .dd-item")];
  if (ui[0]) _set(ui[0], t.myRides       || "My rides");
  if (ui[1]) _set(ui[1], t.fidelityPoints || "Fidelity points");
  if (ui[2]) _set(ui[2], t.settings       || "Settings");
  _set(document.querySelector(".dd-signout"), t.signOut || "Sign out");

  // ── Profile dropdown — guest ──
  const gi = [...document.querySelectorAll("[data-guest] .dd-item")];
  if (gi[0]) _set(gi[0], t.signIn        || "Sign in");
  if (gi[1]) _set(gi[1], t.createAccount || "Create account");

  // ── Section kickers (use data-i18n-key for stable lookup) ──
  document.querySelectorAll(".section-kicker[data-i18n-key]").forEach(k => {
    const v = t[k.dataset.i18nKey];
    if (v) k.textContent = v;
  });

  // ── Footer column headings (use data-i18n-key) ──
  document.querySelectorAll(".footer-grid h4[data-i18n-key]").forEach(h => {
    const v = t[h.dataset.i18nKey];
    if (v) h.textContent = v;
  });

  // ── Footer bottom copyright ──
  const ftCopy = document.querySelector(".footer-bottom p");
  if (ftCopy && t.footerCopyright) ftCopy.textContent = t.footerCopyright;

  // ── Nav social links (footer) ──
  const ftSocials = document.querySelector(".footer-bottom");
  // leave as-is, platform names don't translate

  // ── data-i18n attributes (shared.js handles these) ──
  Lang.apply();
}

/* ── BOOTSTRAP ────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  // NOTE: Theme.apply() intentionally NOT called here —
  // theme cannot be changed on the landing page.
  Motion.apply();
  Lang.apply();

  await initTopbarDropdown();
  applyLandingTranslations();
});