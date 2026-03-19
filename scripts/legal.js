/* ═══════════════════════════════════════════════════════════════════
   RIDE — LEGAL PAGES JS  (scripts/legal.js)
   Used by: tos.html, privacy.html
   Requires: shared.js loaded before this file
   ═══════════════════════════════════════════════════════════════════ */
"use strict";

const LANG_ORDER = ["en","it","fr","es","zh"];

/* ── TOPBAR PROFILE DROPDOWN ─────────────────────────────────────── */
async function initTopbarDropdown() {
  const profileBtn = document.getElementById("profileBtn");
  const dropdown   = document.getElementById("profileDropdown");
  if (!profileBtn || !dropdown) return;

  const langBtn = document.getElementById("langToggleBtn");
  const user    = await Session.get();

  // Wire lang toggle
  if (langBtn) {
    if (user) {
      langBtn.style.display = "none";
    } else {
      langBtn.style.display = "";
      langBtn.addEventListener("click", () => {
        const next = LANG_ORDER[(LANG_ORDER.indexOf(Lang.get()) + 1) % LANG_ORDER.length];
        Lang.set(next);
        Lang.apply();
      });
    }
  }

  if (user) {
    /* ── LOGGED IN ── */
    const circle = profileBtn.querySelector(".circle");
    if (circle) {
      circle.classList.add("is-logged-in");
      if (user.photo) {
        circle.classList.add("has-photo");
        circle.innerHTML = `<img src="${user.photo}" alt="Avatar">`;
      } else {
        circle.textContent = user.initials || "R";
      }
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

/* ── BOOTSTRAP ───────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {

  // Apply stored preferences
  Theme.apply();
  Motion.apply();
  Lang.apply();

  // Wire theme toggle button (present on tos/privacy pages)
  document.getElementById("legalThemeBtn")?.addEventListener("click", () => { Theme.toggle(); });

  // Init profile dropdown (async — reads session, may update Lang from user account)
  await initTopbarDropdown();

  // Re-apply lang after dropdown init (user account lang + dropdown items)
  Lang.apply();

  // ── Dynamic back button ──────────────────────────────────────────
  (function() {
    const backEl  = document.getElementById("tbBack");
    const backLbl = document.getElementById("tbBackLabel");
    if (!backEl || !backLbl) return;

    const PAGE_LABELS = {
      "index.html": "Home",        "index": "Home",        "/": "Home",
      "dashboard.html": "Dashboard", "dashboard": "Dashboard",
      "settings.html": "Settings",  "settings": "Settings",
      "login.html": "Sign in",     "login": "Sign in",
      "register.html": "Sign up",  "register": "Sign up",
    };

    const ref = document.referrer;
    let label = "Home";
    let href  = "index.html";

    if (ref) {
      try {
        const u    = new URL(ref);
        const page = u.pathname.split("/").pop().replace(".html", "") || "index";
        const key  = Object.keys(PAGE_LABELS).find(k => k.replace(".html","") === page);
        if (key) { label = PAGE_LABELS[key]; href = ref; }
      } catch(_) {}
    }

    backLbl.textContent = label;
    backEl.href = href;
    backEl.addEventListener("click", e => {
      if (ref && href === ref) { e.preventDefault(); history.back(); }
    });
  })();

  // Re-apply prefs when changed in Settings tab
  window.addEventListener("storage", e => {
    if (e.key === "ride_theme")         { Theme.apply(); }
    if (e.key === "ride_reduce_motion") { Motion.apply(); }
    if (e.key === "ride_lang")          { Lang.apply(); }
  });

  /* ── Scroll progress bar ──────────────────────────────────────── */
  const bar = document.querySelector(".scroll-bar");
  if (bar) {
    const update = () => {
      const el  = document.documentElement;
      const pct = el.scrollTop / (el.scrollHeight - el.clientHeight) * 100;
      bar.style.width = Math.min(pct, 100) + "%";
    };
    document.addEventListener("scroll", update, { passive: true });
    update();
  }

  /* ── Smooth-scroll TOC links ──────────────────────────────────── */
  document.querySelectorAll(".legal-toc a[href^='#']").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: "smooth" });
    });
  });

  /* ── Highlight active TOC item on scroll ─────────────────────── */
  const sections = [...document.querySelectorAll(".legal-section[id]")];
  const tocLinks = [...document.querySelectorAll(".legal-toc a[href^='#']")];
  if (sections.length && tocLinks.length) {
    const onScroll = () => {
      const scrollY = window.scrollY + 100;
      let current = sections[0];
      for (const s of sections) { if (s.offsetTop <= scrollY) current = s; }
      tocLinks.forEach(a => {
        const active = a.getAttribute("href") === "#" + current.id;
        a.style.color      = active ? "var(--brand)" : "";
        a.style.fontWeight = active ? "600" : "";
      });
    };
    document.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

});