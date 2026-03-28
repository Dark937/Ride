/* ═══════════════════════════════════════════════════════════════════
   RIDE — SHARED UTILITIES (scripts/shared.js)
   Client-side Session & Auth handling
   ═══════════════════════════════════════════════════════════════════ */

"use strict";

// ── API BASE URL ──
const API_URL = process.env.API_URL || 'http://localhost:5000/api';

/* ── THEME MANAGEMENT ────────────────────────────────────────────── */
const Theme = {
  get() {
    return localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  },
  set(theme) {
    localStorage.setItem('theme', theme);
    this.apply();
  },
  toggle() {
    const current = this.get();
    this.set(current === 'dark' ? 'light' : 'dark');
  },
  apply() {
    const theme = this.get();
    document.documentElement.setAttribute('data-theme', theme);
  }
};

/* ── LANGUAGE MANAGEMENT ─────────────────────────────────────────── */
const LANGS = {
  en: { /* English translations */ },
  it: { /* Italian translations */ },
  fr: { /* French translations */ },
  es: { /* Spanish translations */ },
  zh: { /* Chinese translations */ }
};

const Lang = {
  get() {
    return localStorage.getItem('lang') || 'en';
  },
  set(lang) {
    if (Object.keys(LANGS).includes(lang)) {
      localStorage.setItem('lang', lang);
    }
  },
  apply() {
    // Applied by individual pages
  }
};

/* ── MOTION PREFERENCES ──────────────────────────────────────────── */
const Motion = {
  get() {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return localStorage.getItem('motion') || (prefersReduced ? 'reduced' : 'normal');
  },
  set(motion) {
    localStorage.setItem('motion', motion);
    this.apply();
  },
  apply() {
    const motion = this.get();
    if (motion === 'reduced') {
      document.documentElement.style.setProperty('--animation-duration', '0.01ms');
    } else {
      document.documentElement.style.removeProperty('--animation-duration');
    }
  }
};

/* ── SESSION & AUTH ──────────────────────────────────────────────── */
const Session = {
  TOKEN_KEY: 'auth_token',
  USER_KEY: 'auth_user',
  DEVICE_KEY: 'device_id',

  /**
   * Save user and token to localStorage
   */
  async save(user, token) {
    try {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      if (token) {
        localStorage.setItem(this.TOKEN_KEY, token);
      }
    } catch (e) {
      console.error('Error saving session:', e);
    }
  },

  /**
   * Get current user from localStorage
   */
  async get() {
    try {
      const user = localStorage.getItem(this.USER_KEY);
      if (!user) return null;
      return JSON.parse(user);
    } catch (e) {
      console.error('Error getting user:', e);
      return null;
    }
  },

  /**
   * Get auth token
   */
  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  /**
   * Clear session on sign-out
   */
  clear(signOut = false) {
    try {
      localStorage.removeItem(this.USER_KEY);
      localStorage.removeItem(this.TOKEN_KEY);
      
      if (signOut) {
        // Optional: notify backend of sign-out
        const token = localStorage.getItem(this.TOKEN_KEY);
        if (token) {
          fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          }).catch();
        }
      }
    } catch (e) {
      console.error('Error clearing session:', e);
    }
  },

  /**
   * Save device ID for analytics
   */
  saveDevice() {
    if (!localStorage.getItem(this.DEVICE_KEY)) {
      const deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem(this.DEVICE_KEY, deviceId);
    }
  },

  /**
   * Check if user is logged in
   */
  async isLoggedIn() {
    return !!(await this.get());
  }
};

/* ── MOCK AUTH (calls backend API) ───────────────────────────────── */
const MockAuth = {
  /**
   * Register a new user with MongoDB backend
   */
  async register({ firstName, lastName, email, password }) {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password })
      });

      const result = await response.json();

      if (!response.ok) {
        return { ok: false, error: result.error || 'Registration failed.' };
      }

      // Save user and token
      await Session.save(result.user, result.token);

      return { ok: true, user: result.user };
    } catch (error) {
      console.error('Register error:', error);
      return { ok: false, error: error.message || 'Registration failed.' };
    }
  },

  /**
   * Login user with MongoDB backend
   */
  async login({ email, password }) {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();

      if (!response.ok) {
        return { ok: false, error: result.error || 'Login failed.' };
      }

      // Save user and token
      await Session.save(result.user, result.token);

      return { ok: true, user: result.user };
    } catch (error) {
      console.error('Login error:', error);
      return { ok: false, error: error.message || 'Login failed.' };
    }
  }
};

/* ── VALIDATION HELPERS ──────────────────────────────────────────── */
const Validate = {
  email:    v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
  minLen:   (v, n) => v.length >= n,
  notEmpty: v => v.trim().length > 0,
};

/**
 * Show inline field error
 */
function fieldError(inputEl, msg) {
  if (!inputEl) return;
  inputEl.classList.add("is-error");
  const errEl = inputEl.closest(".auth-field")?.querySelector(".auth-field-error");
  if (errEl) {
    errEl.textContent = msg;
    errEl.classList.add("visible");
  }
}

/**
 * Clear inline field error
 */
function fieldOk(inputEl) {
  if (!inputEl) return;
  inputEl.classList.remove("is-error");
  const errEl = inputEl.closest(".auth-field")?.querySelector(".auth-field-error");
  if (errEl) errEl.classList.remove("visible");
}

/* ── APPLY INITIAL THEME & MOTION ────────────────────────────────── */
Theme.apply();
Motion.apply();
