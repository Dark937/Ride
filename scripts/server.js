require('dotenv').config();

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// FIX V-01: added security middleware
/* ── INLINE SECURITY (no extra deps) ──────────────────────────────── */

// Helmet equivalent: set all critical security headers manually
function applySecurityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options',    'nosniff');
  res.setHeader('X-Frame-Options',           'DENY');
  res.setHeader('X-XSS-Protection',          '0'); // disabled in favour of CSP
  res.setHeader('Referrer-Policy',           'strict-origin-when-cross-origin');
  // Allow geolocation from same origin (needed for "My Position" in booking)
  res.setHeader('Permissions-Policy',        'geolocation=(self), camera=(), microphone=()');
  // CSP: whitelist inline scripts by hash (no unsafe-inline needed),
  // allow Google Fonts, unpkg CDN (spline viewer), Google Maps JS API, and WASM execution.
  const inlineScriptHashes = [
    "'sha256-Cnvf4An+Z1PYTrc86hNsT128/nDRkkQHDoq7KJ781GM='", // index.html
    "'sha256-5qOFzbSteATv9poShdvmMth/arfJmZdBhlcuffpYD1c='", // dashboard.html
    "'sha256-WnvhjbPqxyliCkx0EZdyUKN6m5L360DNy6peJb86JHU='", // settings.html
    "'sha256-ZlyzTylzriMqewO9P8iTDN96VchltcvA7jE6Xk/vb4Y='", // login.html + register.html
    "'sha256-7h4N/XV4lF09Y30+EA2Ti3YBV2TboMwATObM6Mh4XUk='", // booking.html
  ].join(' ');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    // Client JS + unpkg CDN (Leaflet, Spline) + WASM
    `script-src 'self' https://unpkg.com ${inlineScriptHashes} 'wasm-unsafe-eval'`,
    // Google Fonts + unpkg (Leaflet CSS) + self styles + inline styles
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://unpkg.com",
    // Google Fonts
    "font-src 'self' https://fonts.gstatic.com data:",
    // Images: self + data URIs + blob + CartoDB tiles + OSM tiles
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org",
    // API calls: self + Nominatim (geocoding/autocomplete) + OSRM (routing) + unpkg
    "connect-src 'self' https://nominatim.openstreetmap.org https://router.project-osrm.org https://unpkg.com",
    // WASM workers
    "worker-src 'self' blob:",
    // No iframes
    "frame-ancestors 'none'",
    // No plugins
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; '));
  // HSTS only over HTTPS
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

// express-rate-limit equivalent: simple in-memory IP rate limiter
function makeRateLimiter(max, windowMs, message) {
  const store = new Map();
  setInterval(() => {
    const now = Date.now();
    store.forEach((v, k) => { if (now - v.start > windowMs) store.delete(k); });
  }, windowMs).unref();

  return function rateLimiter(req, res, next) {
    const ip  = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const rec = store.get(ip);
    if (!rec || now - rec.start > windowMs) {
      store.set(ip, { count: 1, start: now });
      return next();
    }
    rec.count++;
    if (rec.count > max) {
      return res.status(429).json({ error: message });
    }
    next();
  };
}

// express-mongo-sanitize equivalent: strip keys starting with $ or containing .
function sanitizeBody(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else {
      obj[key] = sanitizeBody(obj[key]);
    }
  }
  return obj;
}
function mongoSanitizeMiddleware(req, res, next) {
  if (req.body)   req.body   = sanitizeBody(req.body);
  if (req.params) req.params = sanitizeBody(req.params);
  next();
}

const app = express();
const port = process.env.PORT || 3000;

// FIX V-02: fail fast if JWT_SECRET not set in production; no fallback
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable is not set.');
    process.exit(1);
  }
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on ${port}`);
});

// Security headers (inline, no dep)
app.use(applySecurityHeaders);

// CORS: build allowed-origins list from env + auto-detect Render URL
const allowedOrigins = (() => {
  const list = [];
  // Explicit list from env (comma-separated)
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach(o => list.push(o.trim()));
  }
  // Render auto-injects RENDER_EXTERNAL_URL with the primary service URL
  if (process.env.RENDER_EXTERNAL_URL) {
    list.push(process.env.RENDER_EXTERNAL_URL.replace(/\/$/, ''));
  }
  // Always allow localhost for local development
  list.push('http://localhost:3000');
  list.push('http://localhost:8080');
  list.push('http://127.0.0.1:3000');
  return list;
})();

app.use(cors({
  origin: (origin, cb) => {
    // No Origin header = same-origin request (browser page load, curl, Postman)
    // Always allow — these cannot be cross-site forged
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // In production log the blocked origin to help diagnose misconfiguration
    if (process.env.NODE_ENV === 'production') {
      console.warn('[CORS] blocked origin:', origin, '| add to ALLOWED_ORIGINS env var');
    }
    cb(new Error('CORS: origin not allowed'));
  },
  methods: ['GET', 'POST'],
  credentials: false,
  optionsSuccessStatus: 200
}));

// FIX V-05: limit JSON body size to prevent payload attacks
app.use(express.json({ limit: '16kb' }));

// CSRF-equivalent: verify Origin/Referer on all state-mutating POST requests.
// Since the API uses stateless JWT (no session cookies), CSRF risk is low, but
// this adds an extra layer: reject requests whose Origin/Referer doesn't match
// an allowed origin. Browsers always send Origin on cross-origin POST; if it's
// absent we allow it (same-origin request or server-to-server tool).
app.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  const origin  = req.headers['origin'];
  const referer = req.headers['referer'];
  const source  = origin || (referer ? new URL(referer).origin : null);
  if (!source) return next(); // same-origin or curl/Postman — allow
  if (allowedOrigins.some(o => source === o || source.startsWith(o))) return next();
  return res.status(403).json({ error: 'Forbidden: cross-origin request rejected.' });
});

// NoSQL injection sanitization (inline, no dep)
app.use(mongoSanitizeMiddleware);

// Static files: serve from project root (one level above scripts/)
// Block direct access to server.js, .env, and node_modules
const ROOT = path.resolve(__dirname, '..');
app.use(express.static(ROOT, {
  // Never serve sensitive files
  setHeaders(res, filePath) {
    const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
    const blocked = [
      /^scripts[\/\\]server\.js$/,    // only the server file itself
      /^\.env/,                           // env files of any name
      /^node_modules[\/\\]/,            // dependencies
      /^package(-lock)?\.json$/,          // package manifests
      /^\.git[\/\\]/,                  // git internals
    ];
    if (blocked.some(re => re.test(rel))) {
      res.statusCode = 403;
    }
  }
}));

// FIX V-08: rate limiters — brute-force protection on auth endpoints
const authLimiter = makeRateLimiter(
  10,                                          // 10 attempts per IP
  15 * 60 * 1000,                              // per 15-minute window
  'Too many attempts. Please try again later.' // message
);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ride')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// FIX V-09: add field-level validation and length limits to the schema
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 64 },
  lastName:  { type: String, required: true, trim: true, maxlength: 64 },
  email:     {
    type: String, required: true, unique: true,
    trim: true, lowercase: true, maxlength: 254,
    match: [EMAIL_REGEX, 'Invalid email address'],
  },
  password:  { type: String, required: true },
  initials:  { type: String, maxlength: 4 },
  createdAt: { type: Date, default: Date.now },
  phone:     { type: String, maxlength: 32, default: null },
  city:      { type: String, maxlength: 100, default: null },
  country:   { type: String, maxlength: 100, default: null },
  birthday:  { type: Date, default: null },
});

const User = mongoose.model('User', userSchema);

// ── Input validation helper ──────────────────────────────────────────────────
// FIX V-10: centralised validation; rejects non-string types (NoSQL object injection)
function validateRegisterInput({ firstName, lastName, email, password }) {
  if (typeof firstName !== 'string' || typeof lastName !== 'string' ||
      typeof email    !== 'string' || typeof password !== 'string') {
    return 'All fields must be strings.';
  }
  if (!firstName.trim() || !lastName.trim()) return 'Name fields are required.';
  if (firstName.length > 64 || lastName.length > 64) return 'Name too long.';
  if (!EMAIL_REGEX.test(email.trim())) return 'Invalid email address.';
  if (email.length > 254) return 'Email too long.';
  if (password.length < 8)  return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password too long.';
  return null;
}

function validateLoginInput({ email, password }) {
  if (typeof email !== 'string' || typeof password !== 'string') {
    return 'All fields must be strings.';
  }
  if (!EMAIL_REGEX.test(email.trim())) return 'Invalid email address.';
  if (!password || password.length > 128) return 'Invalid password.';
  return null;
}

// Routes
// FIX V-08 applied: authLimiter on both auth endpoints
app.post('/api/register', authLimiter, async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // FIX V-10: validate before touching the DB
    const validationError = validateRegisterInput({ firstName, lastName, email, password });
    if (validationError) return res.status(400).json({ error: validationError });

    // FIX V-09: normalise email consistently (lowercase + trim)
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    // FIX V-11: bcrypt cost factor 12 (10 is below current recommendation)
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      email:     normalizedEmail,
      password:  hashedPassword,
      initials:  ((firstName.trim()[0] || '') + (lastName.trim()[0] || '')).toUpperCase(),
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      // FIX V-12: specify algorithm explicitly to prevent alg:none attack
      { expiresIn: '7d', algorithm: 'HS256' }
    );

    res.status(201).json({
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName:  user.lastName,
        email:     user.email,
        initials:  user.initials,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    // FIX V-13: never leak internal error details to the client
    console.error('[register]', error);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // FIX V-10: validate before touching the DB
    const validationError = validateLoginInput({ email, password });
    if (validationError) return res.status(400).json({ error: 'Invalid email or password.' });

    // FIX V-09: normalise email before lookup
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // FIX V-14: constant-time comparison even when user doesn't exist
    // (prevents user enumeration via timing side-channel)
    const dummyHash = '$2a$12$invalidhashfortimingprotectiononly00000000000000000000';
    const hashToCompare = user ? user.password : dummyHash;
    const isValidPassword = await bcrypt.compare(password, hashToCompare);

    if (!user || !isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      // FIX V-12: explicit algorithm
      { expiresIn: '7d', algorithm: 'HS256' }
    );

    res.json({
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName:  user.lastName,
        email:     user.email,
        initials:  user.initials,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    console.error('[login]', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required.' });
  }

  // FIX V-12: enforce algorithm whitelist in verify too
  jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token.' });
    }
    req.user = user;
    next();
  });
};

// Protected route
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user });
  } catch (error) {
    console.error('[profile]', error);
    res.status(500).json({ error: 'Failed to get profile.' });
  }
});

// FIX V-07: serve HTML pages from explicit paths within 'public'
// (express.static already handles this; these routes remain for clean URLs)
const ROOT_DIR = path.resolve(__dirname, '..');
const PAGES = {
  login:'login.html', register:'register.html', settings:'settings.html',
  privacy:'privacy.html', tos:'tos.html', dashboard:'dashboard.html',
  booking:'booking.html'
};
Object.entries(PAGES).forEach(([route, file]) => {
  app.get('/' + route, (_req, res) => {
    res.sendFile(path.join(ROOT_DIR, file));
  });
});
// Serve index.html for the root path explicitly
app.get('/', (_req, res) => res.sendFile(path.join(ROOT_DIR, 'index.html')));

if (process.env.NODE_ENV === 'production') {
  module.exports = app;
}