/* ═══════════════════════════════════════════════════════════════════
   RIDE — AUTH LOGIC  (scripts/auth.js)

   Responsibilities:
   ─ Session storage (SQLite database)
   ─ Login form validation + submit (login.html)
   ─ Register form validation + submit (register.html)
   ─ Password strength meter (register.html)
   ─ Password show/hide toggles
   ─ Topbar dropdown (index.html) — open/close, guest vs logged-in
   ─ Sign-out handler

   NOTE: This is a front-end demo — authentication is simulated.
         In production, replace MOCK_AUTH with real API calls.
   ═══════════════════════════════════════════════════════════════════ */

"use strict";

/* ── SQLITE DATABASE SETUP ────────────────────────────────────────── */

let db; // Global SQLite database instance
let dbReady; // Promise that resolves when DB is ready

async function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const request = indexedDB.open('rideDB', 1);
  return new Promise((resolve, reject) => {
    request.onupgradeneeded = () => {
      const idb = request.result;
      if (!idb.objectStoreNames.contains('sqlite')) {
        idb.createObjectStore('sqlite');
      }
    };
    request.onsuccess = () => {
      const idb = request.result;
      const transaction = idb.transaction(['sqlite'], 'readwrite');
      const store = transaction.objectStore('sqlite');
      const putRequest = store.put(data, 'database');
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
}

async function loadDatabase() {
  return new Promise((resolve) => {
    const request = indexedDB.open('rideDB', 1);
    request.onupgradeneeded = () => {
      const idb = request.result;
      if (!idb.objectStoreNames.contains('sqlite')) {
        idb.createObjectStore('sqlite');
      }
    };
    request.onsuccess = () => {
      const idb = request.result;
      const transaction = idb.transaction(['sqlite'], 'readonly');
      const store = transaction.objectStore('sqlite');
      const getRequest = store.get('database');
      getRequest.onsuccess = () => resolve(getRequest.result || null);
      getRequest.onerror = () => resolve(null);
    };
    request.onerror = () => resolve(null);
  });
}

async function initDatabase() {
  // Load sql.js from local assets
  const SQL = await initSqlJs({ locateFile: file => `assets/${file}` });
  const savedData = await loadDatabase();
  if (savedData) {
    db = new SQL.Database(savedData);
  } else {
    db = new SQL.Database();
  }

  // Create users table if it doesn't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,  -- In production, hash this!
      initials TEXT,
      createdAt TEXT
    )
  `);

  // Save initial state
  await saveDatabase();
}

dbReady = initDatabase(); // Initialize on load

/* ── STORAGE HELPERS ──────────────────────────────────────────────── */

const Session = {
  /** Save user object to SQLite (simulate session by storing current user ID) */
  async save(user) {
    await dbReady;
    try {
      // Insert or replace user in database
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO users (id, firstName, lastName, email, password, initials, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run([user.id, user.firstName, user.lastName, user.email, user.password || '', user.initials, user.createdAt]);
      stmt.free();

      // Save database to IndexedDB
      await saveDatabase();

      // Store current session user ID in localStorage for simplicity
      localStorage.setItem('current_user_id', user.id);
    } catch (e) {
      console.error('Error saving user:', e);
    }
  },

  /** Get current user or null */
  async get() {
    await dbReady;
    try {
      const userId = localStorage.getItem('current_user_id');
      if (!userId) return null;

      const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
      const result = stmt.getAsObject([userId]);
      stmt.free();

      if (result.id) {
        // Remove password from returned object for security
        delete result.password;
        return result;
      }
      return null;
    } catch (e) {
      console.error('Error getting user:', e);
      return null;
    }
  },

  /** Remove session */
  clear() {
    try {
      localStorage.removeItem('current_user_id');
    } catch (e) {
      console.error('Error clearing session:', e);
    }
  },

  /** Check if someone is logged in */
  async isLoggedIn() { return !!(await this.get()); }
};

/* ── MOCK AUTH  (replace with real API) ───────────────────────────── */

const MockAuth = {

  /**
   * Simulated register.
   * Returns { ok: true, user } or { ok: false, error: string }
   */
  register({ firstName, lastName, email, password }) {
    return new Promise(resolve => {
      setTimeout(async () => {
        try {
          // Check if email already exists
          const checkStmt = db.prepare('SELECT id FROM users WHERE email = ?');
          const existing = checkStmt.getAsObject([email]);
          checkStmt.free();

          if (existing.id) {
            resolve({ ok: false, error: 'Email already registered.' });
            return;
          }

          // Create user
          const user = {
            id:        crypto.randomUUID?.() || Date.now().toString(36),
            firstName,
            lastName,
            email,
            password,  // In production, hash this!
            initials:  (firstName[0] + lastName[0]).toUpperCase(),
            createdAt: new Date().toISOString()
          };

          // Save to DB
          await Session.save(user);

          resolve({ ok: true, user });
        } catch (e) {
          console.error('Register error:', e);
          resolve({ ok: false, error: 'Registration failed.' });
        }
      }, 900);
    });
  },

  /**
   * Simulated login.
   * Checks email and password against database.
   */
  login({ email, password }) {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
          const user = stmt.getAsObject([email]);
          stmt.free();

          if (!user.id || user.password !== password) {
            resolve({ ok: false, error: 'Invalid email or password.' });
            return;
          }

          // Remove password for session
          delete user.password;

          // Save session
          await Session.save(user);

          resolve({ ok: true, user });
        } catch (e) {
          console.error('Login error:', e);
          resolve({ ok: false, error: 'Login failed.' });
        }
      }, 900);
    });
  }
};

/* ── VALIDATION HELPERS ───────────────────────────────────────────── */

const Validate = {
  email:    v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
  minLen:   (v, n) => v.length >= n,
  notEmpty: v => v.trim().length > 0,
};

/** Show inline field error */
function fieldError(inputEl, msg) {
  inputEl.classList.add("is-error");
  const errEl = inputEl.closest(".auth-field")?.querySelector(".auth-field-error");
  if (errEl) { errEl.textContent = msg; errEl.classList.add("visible"); }
}

/** Clear inline field error */
function fieldOk(inputEl) {
  inputEl.classList.remove("is-error");
  const errEl = inputEl.closest(".auth-field")?.querySelector(".auth-field-error");
  if (errEl) errEl.classList.remove("visible");
}

/* ── PASSWORD STRENGTH METER ──────────────────────────────────────── */

function getStrength(pw) {
  let score = 0;
  if (pw.length >= 8)              score++;
  if (/[A-Z]/.test(pw))            score++;
  if (/[0-9]/.test(pw))            score++;
  if (/[^A-Za-z0-9]/.test(pw))     score++;
  return score; // 0-4
}

function updateStrengthMeter(pw) {
  const bar   = document.querySelector(".strength-bar");
  const label = document.querySelector(".strength-label");
  if (!bar || !label) return;

  const score  = getStrength(pw);
  const levels = ["", "weak", "fair", "good", "strong"];
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const spans  = bar.querySelectorAll("span");

  spans.forEach((s, i) => {
    s.className = i < score ? levels[score] : "";
  });
  label.textContent = pw.length ? labels[score] : "";
}

/* ── PASSWORD TOGGLE (show / hide) ───────────────────────────────── */

function initPasswordToggles() {
  document.querySelectorAll(".auth-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const input  = btn.closest(".auth-field-row").querySelector("input");
      const isText = input.type === "text";
      input.type   = isText ? "password" : "text";

      // swap eye icon
      btn.innerHTML = isText
        ? `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
        : `<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    });
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

  function showBanner(msg) {
    banner.querySelector("p").textContent = msg;
    banner.classList.add("visible");
  }
  function hideBanner() { banner.classList.remove("visible"); }

  function setLoading(on) {
    submitBtn.classList.toggle("is-loading", on);
    submitBtn.disabled = on;
  }

  // Clear errors on type
  emailIn.addEventListener("input", () => { fieldOk(emailIn); hideBanner(); });
  passIn.addEventListener("input",  () => { fieldOk(passIn);  hideBanner(); });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    hideBanner();

    let valid = true;

    if (!Validate.email(emailIn.value)) {
      fieldError(emailIn, "Please enter a valid email address.");
      valid = false;
    }
    if (!Validate.minLen(passIn.value, 3)) {
      fieldError(passIn, "Password is required.");
      valid = false;
    }
    if (!valid) return;

    setLoading(true);

    const result = await MockAuth.login({ email: emailIn.value.trim(), password: passIn.value });

    setLoading(false);

    if (!result.ok) {
      showBanner(result.error);
      return;
    }

    await Session.save(result.user);

    // Redirect back to home (or wherever they came from)
    const redirect = new URLSearchParams(window.location.search).get("redirect") || "index.html";
    window.location.href = redirect;
  });
}

/* ── REGISTER FORM ────────────────────────────────────────────────── */

function initRegisterForm() {
  const form      = document.getElementById("registerForm");
  if (!form) return;

  const firstIn   = document.getElementById("regFirst");
  const lastIn    = document.getElementById("regLast");
  const emailIn   = document.getElementById("regEmail");
  const passIn    = document.getElementById("regPassword");
  const confirmIn = document.getElementById("regConfirm");
  const termsIn   = document.getElementById("regTerms");
  const submitBtn = document.getElementById("registerSubmit");
  const banner    = document.getElementById("registerError");

  function showBanner(msg) { banner.querySelector("p").textContent = msg; banner.classList.add("visible"); }
  function hideBanner()    { banner.classList.remove("visible"); }
  function setLoading(on)  { submitBtn.classList.toggle("is-loading", on); submitBtn.disabled = on; }

  // Strength meter on password input
  passIn.addEventListener("input", () => {
    fieldOk(passIn);
    hideBanner();
    updateStrengthMeter(passIn.value);
  });

  [firstIn, lastIn, emailIn, confirmIn].forEach(el =>
    el.addEventListener("input", () => { fieldOk(el); hideBanner(); })
  );

  form.addEventListener("submit", async e => {
    e.preventDefault();
    hideBanner();

    let valid = true;

    if (!Validate.notEmpty(firstIn.value)) { fieldError(firstIn, "First name is required.");              valid = false; }
    if (!Validate.notEmpty(lastIn.value))  { fieldError(lastIn,  "Last name is required.");               valid = false; }
    if (!Validate.email(emailIn.value))    { fieldError(emailIn, "Please enter a valid email address."); valid = false; }
    if (!Validate.minLen(passIn.value, 8)) { fieldError(passIn,  "Password must be at least 8 characters."); valid = false; }
    if (passIn.value !== confirmIn.value)  { fieldError(confirmIn, "Passwords do not match.");            valid = false; }
    if (!termsIn.checked) { showBanner("You must agree to the Terms of Service."); valid = false; }

    if (!valid) return;

    setLoading(true);

    const result = await MockAuth.register({
      firstName: firstIn.value.trim(),
      lastName:  lastIn.value.trim(),
      email:     emailIn.value.trim(),
      password:  passIn.value
    });

    setLoading(false);

    if (!result.ok) { showBanner(result.error); return; }

    await Session.save(result.user);
    window.location.href = "index.html";
  });
}

/* ── TOPBAR DROPDOWN (index.html) ─────────────────────────────────── */

async function initTopbarDropdown() {
  const profileBtn  = document.querySelector(".profile-btn");
  const profileWrap = document.querySelector(".profile-btn-wrap");
  const dropdown    = document.getElementById("profileDropdown");
  if (!profileBtn || !dropdown) return;

  const user = await Session.get();

  if (user) {
    /* ── Logged-in state ── */
    const circle = profileBtn.querySelector(".circle");
    if (circle) {
      circle.classList.add("is-logged-in");
      circle.textContent = user.initials || "R";
    }

    // Fill dropdown with user info
    const ddName  = dropdown.querySelector(".dd-name");
    const ddEmail = dropdown.querySelector(".dd-email");
    if (ddName)  ddName.textContent  = `${user.firstName} ${user.lastName}`.trim();
    if (ddEmail) ddEmail.textContent = user.email || "";

    // Show logged-in menu, hide guest menu
    dropdown.querySelectorAll("[data-guest]").forEach(el => el.style.display = "none");
    dropdown.querySelectorAll("[data-user]").forEach(el => el.style.display = "");

    // Sign out
    dropdown.querySelector(".dd-signout")?.addEventListener("click", () => {
      Session.clear();
      dropdown.classList.remove("is-open");
      window.location.reload();
    });

  } else {
    /* ── Guest state ── */
    dropdown.querySelectorAll("[data-user]").forEach(el => el.style.display = "none");
    dropdown.querySelectorAll("[data-guest]").forEach(el => el.style.display = "");

    dropdown.querySelector(".dd-login")?.addEventListener("click", () => {
      window.location.href = "login.html";
    });
    dropdown.querySelector(".dd-register")?.addEventListener("click", () => {
      window.location.href = "register.html";
    });
  }

  /* ── Toggle open/close ── */
  profileBtn.addEventListener("click", e => {
    e.stopPropagation();
    dropdown.classList.toggle("is-open");
  });

  // Close on outside click
  document.addEventListener("click", e => {
    if (profileWrap && !profileWrap.contains(e.target)) {
      dropdown.classList.remove("is-open");
    }
  });

  // Close on Escape
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") dropdown.classList.remove("is-open");
  });
}

/* ── GOOGLE SIGN-IN STUB ──────────────────────────────────────────── */

function initSocialButtons() {
  document.querySelectorAll(".auth-social-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      // Placeholder — integrate real OAuth here
      alert("Social sign-in coming soon. Use email & password for now.");
    });
  });
}

/* ── BOOTSTRAP ────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", async () => {
  initPasswordToggles();
  initLoginForm();
  initRegisterForm();
  await initTopbarDropdown();
  initSocialButtons();
});