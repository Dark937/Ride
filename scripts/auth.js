/* ═══════════════════════════════════════════════════════════════════
   RIDE — AUTH PAGE LOGIC  (scripts/auth.js)
   Used by: login.html, register.html
   Requires: shared.js (loaded first)
   ═══════════════════════════════════════════════════════════════════ */

"use strict";

/* ── PASSWORD VISIBILITY TOGGLE ───────────────────────────────────── */

function initPasswordToggles() {
  document.querySelectorAll(".auth-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input  = btn.closest(".auth-field-row").querySelector("input");
      const isText = input.type === "text";
      input.type   = isText ? "password" : "text";
      btn.innerHTML = isText
        ? `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
        : `<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    });
  });
}

/* ── PASSWORD STRENGTH ────────────────────────────────────────────── */

function getStrength(pw) {
  let s = 0;
  if (pw.length >= 8)             s++;
  if (/[A-Z]/.test(pw))           s++;
  if (/[0-9]/.test(pw))           s++;
  if (/[^A-Za-z0-9]/.test(pw))    s++;
  return s;
}

function updateStrengthMeter(pw) {
  const bar   = document.querySelector(".strength-bar");
  const label = document.querySelector(".strength-label");
  if (!bar || !label) return;
  const s      = getStrength(pw);
  const levels = ["", "weak", "fair", "good", "strong"];
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  bar.querySelectorAll("span").forEach((sp, i) => {
    sp.className = i < s ? levels[s] : "";
  });
  label.textContent = pw.length ? labels[s] : "";
}

/* ── FORGOT PASSWORD MODAL ────────────────────────────────────────── */

function initForgotPassword() {
  const link = document.getElementById("forgotLink");
  if (!link) return;

  // Build modal markup
  const overlay = document.createElement("div");
  overlay.id        = "forgotModal";
  overlay.className = "fm-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="fm-box" role="dialog" aria-modal="true" aria-labelledby="fmTitle">
      <button class="fm-close" id="fmClose" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>

      <div class="fm-icon">
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="1.8"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </div>

      <div id="fmStep1">
        <h2 id="fmTitle">Reset your password</h2>
        <p>Enter your email and we'll send a reset link.</p>
        <div class="auth-field" style="margin-top:24px;">
          <label for="fmEmail">Email address</label>
          <div class="auth-field-row">
            <input type="email" id="fmEmail" placeholder="you@example.com" autocomplete="email">
          </div>
          <span class="auth-field-error" role="alert"></span>
        </div>
        <button type="button" id="fmSubmit" class="auth-submit" style="margin-top:20px;">
          <span class="btn-text">Send reset link</span>
          <span class="spinner" aria-hidden="true"></span>
        </button>
        <div class="auth-error-banner" id="fmError" role="alert">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p></p>
        </div>
      </div>

      <div id="fmStep2" style="display:none;">
        <div class="fm-success-icon">
          <svg viewBox="0 0 52 52" fill="none">
            <circle cx="26" cy="26" r="24" stroke="rgba(34,197,94,.3)" stroke-width="1.5"/>
            <path d="M16 26l8 8 13-13" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h2>Check your email</h2>
        <p id="fmSuccessMsg">We've sent a reset link to <strong></strong>.</p>
        <p style="margin-top:10px; font-size:13px; color:var(--muted-2);">
          Didn't receive it?
          <button type="button" id="fmRetry" class="fm-link-btn">Try a different email</button>
        </p>
        <button type="button" id="fmDone" class="auth-submit" style="margin-top:24px;">
          <span class="btn-text">Back to sign in</span>
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const openFM = () => {
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => document.getElementById("fmEmail")?.focus(), 100);
  };
  const closeFM = () => {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    setTimeout(() => {
      document.getElementById("fmStep1").style.display = "";
      document.getElementById("fmStep2").style.display = "none";
      const em = document.getElementById("fmEmail");
      if (em) { em.value = ""; fieldOk(em); }
      document.getElementById("fmError").classList.remove("visible");
    }, 300);
  };

  link.addEventListener("click",  (e) => { e.preventDefault(); openFM(); });
  document.getElementById("fmClose").addEventListener("click", closeFM);
  document.getElementById("fmDone").addEventListener("click",  closeFM);
  document.getElementById("fmRetry").addEventListener("click", () => {
    document.getElementById("fmStep1").style.display = "";
    document.getElementById("fmStep2").style.display = "none";
    const em = document.getElementById("fmEmail");
    if (em) { em.value = ""; fieldOk(em); em.focus(); }
  });

  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeFM(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) closeFM();
  });

  document.getElementById("fmSubmit").addEventListener("click", async () => {
    const em  = document.getElementById("fmEmail");
    const err = document.getElementById("fmError");
    fieldOk(em);
    err.classList.remove("visible");

    if (!Validate.email(em.value)) {
      fieldError(em, "Please enter a valid email address.");
      return;
    }

    const btn = document.getElementById("fmSubmit");
    btn.classList.add("is-loading"); btn.disabled = true;

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em.value.trim() }),
      });
    } catch (_) { /* server unavailable — still show success to avoid info leak */ }

    btn.classList.remove("is-loading"); btn.disabled = false;

    const strong = document.querySelector("#fmSuccessMsg strong");
    if (strong) strong.textContent = em.value.trim();
    document.getElementById("fmStep1").style.display = "none";
    document.getElementById("fmStep2").style.display = "";
  });
}

/* ── SOCIAL BUTTONS ───────────────────────────────────────────────── */

function initSocialButtons() {
  document.querySelectorAll(".auth-social-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      alert("Social sign-in coming soon. Use email & password for now.");
    });
  });
}

/* ── THEME BUTTON (auth pages) ────────────────────────────────────── */

function initAuthThemeBtn() {
  document.querySelectorAll(".auth-theme-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      Theme.toggle();
    });
  });
}

/* ── 2FA CODE MODAL ───────────────────────────────────────────────── */

function build2FAModal() {
  if (document.getElementById("twoFaModal")) return;
  const el = document.createElement("div");
  el.id        = "twoFaModal";
  el.className = "fm-overlay";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="fm-box" role="dialog" aria-modal="true" aria-labelledby="twoFaTitle">
      <div class="fm-icon">
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/>
          <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </div>
      <h2 id="twoFaTitle">Two-factor verification</h2>
      <p id="twoFaDesc">We sent a 6-digit code to your email. Enter it below.</p>
      <div class="auth-field" style="margin-top:20px;">
        <label for="twoFaCode">Verification code</label>
        <div class="auth-field-row">
          <input type="text" id="twoFaCodeInput" placeholder="000000" maxlength="6" inputmode="numeric" autocomplete="one-time-code">
        </div>
        <span class="auth-field-error" role="alert"></span>
      </div>
      <button type="button" id="twoFaSubmit" class="auth-submit" style="margin-top:20px;">
        <span class="btn-text">Verify</span>
        <span class="spinner" aria-hidden="true"></span>
      </button>
      <div class="auth-error-banner" id="twoFaError" role="alert">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p></p>
      </div>
    </div>`;
  document.body.appendChild(el);
  return el;
}

function show2FAModal(tempToken, onSuccess) {
  const overlay = build2FAModal() || document.getElementById("twoFaModal");
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setTimeout(() => document.getElementById("twoFaCodeInput")?.focus(), 100);

  const btn   = document.getElementById("twoFaSubmit");
  const errEl = document.getElementById("twoFaError");

  // Remove old listener by replacing button
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  newBtn.addEventListener("click", async () => {
    const code = document.getElementById("twoFaCodeInput").value.trim();
    errEl.classList.remove("visible");
    if (!code || code.length !== 6) {
      errEl.querySelector("p").textContent = "Please enter the 6-digit code.";
      errEl.classList.add("visible");
      return;
    }
    newBtn.classList.add("is-loading"); newBtn.disabled = true;
    try {
      const resp = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code }),
      });
      const data = await resp.json();
      if (resp.ok) {
        overlay.classList.remove("is-open");
        document.body.style.overflow = "";
        onSuccess(data);
      } else {
        errEl.querySelector("p").textContent = data.error || "Verification failed.";
        errEl.classList.add("visible");
        newBtn.classList.remove("is-loading"); newBtn.disabled = false;
      }
    } catch (_) {
      errEl.querySelector("p").textContent = "Connection error. Please try again.";
      errEl.classList.add("visible");
      newBtn.classList.remove("is-loading"); newBtn.disabled = false;
    }
  });
}

/* ── LOGIN FORM ───────────────────────────────────────────────────── */

function initLoginForm() {
  const form      = document.getElementById("loginForm");
  if (!form) return;

  const emailIn   = document.getElementById("loginEmail");
  const passIn    = document.getElementById("loginPassword");
  const submitBtn = document.getElementById("loginSubmit");
  const banner    = document.getElementById("loginError");

  const showBanner = (msg) => { banner.querySelector("p").textContent = msg; banner.classList.add("visible"); };
  const hideBanner = ()    => banner.classList.remove("visible");
  const setLoading = (on)  => { submitBtn.classList.toggle("is-loading", on); submitBtn.disabled = on; };

  emailIn.addEventListener("input", () => { fieldOk(emailIn); hideBanner(); });
  passIn.addEventListener("input",  () => { fieldOk(passIn);  hideBanner(); });

  const finishLogin = async (userData, token) => {
    localStorage.setItem('ride_token', token);
    await Session.save({ ...userData, id: userData.id.toString() });
    setLoading(false);
    Session.saveDevice();
    const rawRedirect = new URLSearchParams(window.location.search).get("redirect") || "";
    const ALLOWED_REDIRECTS = ["dashboard.html", "index.html", "settings.html", "become-driver.html", "driver-dashboard.html", ""];
    const redirect = ALLOWED_REDIRECTS.includes(rawRedirect) ? rawRedirect : "index.html";
    window.location.href = redirect || "index.html";
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBanner();
    let valid = true;
    if (!Validate.email(emailIn.value)) { fieldError(emailIn, "Please enter a valid email address."); valid = false; }
    if (!Validate.minLen(passIn.value, 3)) { fieldError(passIn, "Password is required."); valid = false; }
    if (!valid) return;

    setLoading(true);
    let loggedIn = false;

    // Try server API first (enables cross-device sync via JWT)
    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailIn.value.trim(), password: passIn.value }),
      });
      if (resp.ok) {
        const data = await resp.json();
        // 2FA required — show code input modal
        if (data.twoFaRequired) {
          setLoading(false);
          show2FAModal(data.tempToken, async (verified) => {
            await finishLogin(verified.user, verified.token);
          });
          return;
        }
        await finishLogin(data.user, data.token);
        return;
      }
      if (resp.status !== 0) {
        const data = await resp.json().catch(() => ({}));
        setLoading(false);
        showBanner(data.error || "Login failed.");
        return;
      }
    } catch (_) { /* server unavailable — fall back to local */ }

    if (!loggedIn) {
      const result = await Auth.login({ email: emailIn.value.trim(), password: passIn.value });
      if (!result.ok) { setLoading(false); showBanner(result.error); return; }
      localStorage.removeItem('ride_token');
      await Session.save(result.user);
    }

    setLoading(false);
    Session.saveDevice();
    // FIX C-01: prevent open redirect — only allow same-origin relative paths
    const rawRedirect = new URLSearchParams(window.location.search).get("redirect") || "";
    const ALLOWED_REDIRECTS = ["dashboard.html", "index.html", "settings.html", "become-driver.html", "driver-dashboard.html", ""];
    const redirect = ALLOWED_REDIRECTS.includes(rawRedirect) ? rawRedirect : "index.html";
    window.location.href = redirect || "index.html";
  });

  initForgotPassword();
}

/* ── REGISTER FORM ────────────────────────────────────────────────── */

function initRegisterForm() {
  const form = document.getElementById("registerForm");
  if (!form) return;

  const firstIn   = document.getElementById("regFirst");
  const lastIn    = document.getElementById("regLast");
  const emailIn   = document.getElementById("regEmail");
  const passIn    = document.getElementById("regPassword");
  const confirmIn = document.getElementById("regConfirm");
  const termsIn   = document.getElementById("regTerms");
  const submitBtn = document.getElementById("registerSubmit");
  const banner    = document.getElementById("registerError");

  const showBanner = (msg) => { banner.querySelector("p").textContent = msg; banner.classList.add("visible"); };
  const hideBanner = ()    => banner.classList.remove("visible");
  const setLoading = (on)  => { submitBtn.classList.toggle("is-loading", on); submitBtn.disabled = on; };

  passIn.addEventListener("input", () => { fieldOk(passIn); hideBanner(); updateStrengthMeter(passIn.value); });
  [firstIn, lastIn, emailIn, confirmIn].forEach((el) =>
    el.addEventListener("input", () => { fieldOk(el); hideBanner(); })
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBanner();
    let valid = true;
    if (!Validate.notEmpty(firstIn.value))   { fieldError(firstIn,   "First name is required.");                      valid = false; }
    if (!Validate.notEmpty(lastIn.value))    { fieldError(lastIn,    "Last name is required.");                        valid = false; }
    if (!Validate.email(emailIn.value))      { fieldError(emailIn,   "Please enter a valid email address.");           valid = false; }
    if (!Validate.minLen(passIn.value, 8))   { fieldError(passIn,    "Password must be at least 8 characters.");       valid = false; }
    if (passIn.value !== confirmIn.value)    { fieldError(confirmIn, "Passwords do not match.");                       valid = false; }
    if (!termsIn.checked)                   { showBanner("You must agree to the Terms of Service.");                   valid = false; }
    if (!valid) return;

    setLoading(true);
    let serverRegistered = false;

    // Try server API first (enables cross-device sync)
    try {
      const resp = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstIn.value.trim(),
          lastName:  lastIn.value.trim(),
          email:     emailIn.value.trim(),
          password:  passIn.value,
        }),
      });
      const data = await resp.json();
      if (resp.ok) {
        localStorage.setItem('ride_token', data.token);
        await Session.save({ ...data.user, id: data.user.id.toString() });
        serverRegistered = true;
      } else {
        setLoading(false);
        showBanner(data.error || 'Registration failed.');
        return;
      }
    } catch (_) { /* server unavailable — fall back to local */ }

    if (!serverRegistered) {
      const result = await Auth.register({
        firstName: firstIn.value.trim(),
        lastName:  lastIn.value.trim(),
        email:     emailIn.value.trim(),
        password:  passIn.value,
      });
      if (!result.ok) { setLoading(false); showBanner(result.error); return; }
      localStorage.removeItem('ride_token');
      await Session.save(result.user);
    }

    setLoading(false);
    Session.saveDevice();
    window.location.href = "/";
  });
}

/* ── BOOTSTRAP ────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", async () => {
  // Apply prefs (theme, lang, motion already applied by shared.js inline)
  // Re-apply after DOM is ready to catch any dynamically added elements
  Theme.apply();
  Motion.apply();
  Lang.apply();

  initPasswordToggles();
  initAuthThemeBtn();
  initLoginForm();
  initRegisterForm();
  initSocialButtons();
});