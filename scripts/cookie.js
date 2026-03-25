/**
 * RIDE — Cookie Consent Banner
 * GDPR / D.Lgs. 196/2003 (Codice Privacy) / Provvedimento Garante 8 maggio 2014
 *
 * Logica:
 * - Al primo accesso mostra il banner cookie.
 * - L'utente può accettare tutti, rifiutare i non-essenziali, o personalizzare.
 * - La scelta è salvata in localStorage con timestamp.
 * - I cookie tecnici (tema, lingua, sessione) sono sempre consentiti perché
 *   necessari al funzionamento del servizio (art. 122 co. 1 Codice Privacy).
 * - I cookie analytics/marketing sono disabilitati finché l'utente non acconsente.
 */

(function () {
  "use strict";

  const STORAGE_KEY  = "ride_cookie_consent";
  const CONSENT_VER  = "1"; // incrementare se cambiano le categorie di cookie

  /* ── Categorie ─────────────────────────────────────────────── */
  const CATEGORIES = {
    necessary:   { label: "Cookie necessari",    required: true  },
    preferences: { label: "Cookie di preferenza", required: false },
    analytics:   { label: "Cookie analitici",     required: false },
    marketing:   { label: "Cookie di marketing",  required: false },
  };

  /* ── Helpers ────────────────────────────────────────────────── */
  function getConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      // Invalida consenso precedente se la versione è cambiata
      if (obj.version !== CONSENT_VER) return null;
      return obj;
    } catch (_) { return null; }
  }

  function saveConsent(choices) {
    const obj = {
      version:   CONSENT_VER,
      timestamp: new Date().toISOString(),
      choices,   // { necessary:true, preferences:bool, analytics:bool, marketing:bool }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    // Dispatch event so other scripts can react
    window.dispatchEvent(new CustomEvent("cookieConsentChanged", { detail: obj }));
  }

  function acceptAll() {
    const choices = {};
    Object.keys(CATEGORIES).forEach(k => { choices[k] = true; });
    saveConsent(choices);
    removeBanner();
  }

  function rejectNonEssential() {
    const choices = {};
    Object.keys(CATEGORIES).forEach(k => { choices[k] = CATEGORIES[k].required; });
    saveConsent(choices);
    removeBanner();
  }

  function saveCustom() {
    const choices = {};
    Object.keys(CATEGORIES).forEach(k => {
      const cb = document.getElementById("cc-cb-" + k);
      choices[k] = CATEGORIES[k].required ? true : (cb ? cb.checked : false);
    });
    saveConsent(choices);
    removeBanner();
    hidePanel();
  }

  function removeBanner() {
    const el = document.getElementById("cookieBanner");
    if (el) {
      el.classList.add("cc-hide");
      setTimeout(() => el.remove(), 400);
    }
  }

  function hidePanel() {
    const el = document.getElementById("ccPanel");
    if (el) el.classList.add("cc-panel-hide");
  }

  function showPanel() {
    const el = document.getElementById("ccPanel");
    if (el) el.classList.remove("cc-panel-hide");
  }

  /* ── Costruzione HTML ────────────────────────────────────────── */
  function buildBanner() {
    const banner = document.createElement("div");
    banner.id = "cookieBanner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Consenso cookie");
    banner.innerHTML = `
      <div class="cc-inner">
        <div class="cc-text">
          <strong>Questo sito utilizza cookie</strong>
          <p>Utilizziamo cookie tecnici necessari al funzionamento e, previo tuo consenso, cookie di preferenza, analitici e di marketing. Puoi accettare tutti i cookie, rifiutare quelli non essenziali, oppure personalizzare le tue scelte. Per saperne di più consulta la nostra <a href="privacy.html" class="cc-link">Privacy Policy</a> e la <a href="privacy.html#cookie" class="cc-link">Cookie Policy</a>.</p>
        </div>
        <div class="cc-actions">
          <button id="ccCustomize" class="cc-btn cc-ghost">Personalizza</button>
          <button id="ccReject"    class="cc-btn cc-ghost">Rifiuta</button>
          <button id="ccAccept"    class="cc-btn cc-primary">Accetta tutti</button>
        </div>
      </div>

      <!-- Pannello preferenze dettagliato -->
      <div id="ccPanel" class="cc-panel cc-panel-hide">
        <div class="cc-panel-header">
          <strong>Impostazioni cookie</strong>
          <button id="ccPanelClose" class="cc-close" aria-label="Chiudi">&times;</button>
        </div>
        <div class="cc-panel-body">
          ${Object.entries(CATEGORIES).map(([key, cat]) => `
            <div class="cc-row">
              <div class="cc-row-info">
                <span class="cc-row-label">${cat.label}</span>
                ${cat.required
                  ? '<span class="cc-required">Sempre attivi</span>'
                  : ''}
              </div>
              <label class="cc-switch" aria-label="${cat.label}">
                <input type="checkbox" id="cc-cb-${key}"
                  ${cat.required ? "checked disabled" : ""}>
                <span class="cc-slider"></span>
              </label>
            </div>`).join("")}
        </div>
        <div class="cc-panel-footer">
          <button id="ccSaveCustom" class="cc-btn cc-primary" style="width:100%">Salva preferenze</button>
        </div>
      </div>
    `;
    return banner;
  }

  /* ── Wire events ─────────────────────────────────────────────── */
  function wireBanner() {
    document.getElementById("ccAccept")?.addEventListener("click",     acceptAll);
    document.getElementById("ccReject")?.addEventListener("click",     rejectNonEssential);
    document.getElementById("ccCustomize")?.addEventListener("click",  showPanel);
    document.getElementById("ccPanelClose")?.addEventListener("click", hidePanel);
    document.getElementById("ccSaveCustom")?.addEventListener("click", saveCustom);
  }

  /* ── Init ────────────────────────────────────────────────────── */
  function init() {
    if (getConsent()) return; // già dato il consenso, non mostrare

    const banner = buildBanner();
    document.body.appendChild(banner);
    // Forza reflow per triggherare la transizione CSS
    requestAnimationFrame(() => {
      requestAnimationFrame(() => banner.classList.add("cc-visible"));
    });
    wireBanner();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ── API pubblica ─────────────────────────────────────────────── */
  window.CookieConsent = {
    get: getConsent,
    hasCategory: (cat) => {
      const c = getConsent();
      return c ? !!c.choices[cat] : false;
    },
    /** Riapre il pannello preferenze (link in footer/privacy page) */
    reopen() {
      if (!document.getElementById("cookieBanner")) {
        const banner = buildBanner();
        document.body.appendChild(banner);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => banner.classList.add("cc-visible"));
        });
        wireBanner();
      }
      showPanel();
    },
  };
})();
