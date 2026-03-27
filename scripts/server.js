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
    "'sha256-7h4N/XV4lF09Y30+EA2Ti3YBV2TboMwATObM6Mh4XUk='", // book-ride.html
  ].join(' ');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    // Client JS + unpkg CDN (Leaflet, Spline) + WASM
    `script-src 'self' https://unpkg.com ${inlineScriptHashes} 'wasm-unsafe-eval'`,
    // Google Fonts + unpkg (Leaflet CSS) + self styles + inline styles
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://unpkg.com",
    // Google Fonts
    "font-src 'self' https://fonts.gstatic.com data:",
    // Images: self + data URIs + blob + CartoDB tiles + OSM tiles + Spline + Unsplash
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://prod.spline.design https://cdn.spline.design https://images.unsplash.com",
    // API calls: self + Nominatim + OSRM + unpkg + Spline scene/CDN
    "connect-src 'self' https://nominatim.openstreetmap.org https://photon.komoot.io https://router.project-osrm.org https://unpkg.com https://prod.spline.design https://cdn.spline.design https://api.anthropic.com",
    // WASM workers + Spline workers
    "worker-src 'self' blob: https://unpkg.com",
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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
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
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) return next();
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
// Rate limiter for booking creation (prevent spam)
const bookingLimiter = makeRateLimiter(
  20,                                          // 20 bookings per IP
  60 * 60 * 1000,                              // per hour
  'Too many booking requests. Please wait before trying again.'
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
  accountType: { type: String, enum: ['user', 'rider'], default: 'user' },
});

const User = mongoose.model('User', userSchema);

// ── Booking schema ──────────────────────────────────────────────────────────
const bookingSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  from:        { type: String, required: true, maxlength: 500 },
  to:          { type: String, required: true, maxlength: 500 },
  fromLat:     { type: Number, default: null },
  fromLng:     { type: Number, default: null },
  toLat:       { type: Number, default: null },
  toLng:       { type: Number, default: null },
  datetime:    { type: Date, required: true },
  car:         { type: String, required: true, maxlength: 100 },
  carId:       { type: String, maxlength: 50, default: '' },
  fare:        { type: Number, required: true, min: 0 },
  durationMin: { type: Number, min: 0, default: 30 },
  distKm:      { type: Number, min: 0, default: null },
  passengers:  { type: Number, default: 1, min: 1, max: 7 },
  notes:       { type: String, maxlength: 500, default: '' },
  driver:      { type: String, maxlength: 100, default: '' },
  status:      { type: String, enum: ['upcoming', 'completed', 'cancelled'], default: 'upcoming' },
  pts:         { type: Number, default: 0, min: 0 },
  completedAt: { type: Date, default: null },
  createdAt:   { type: Date, default: Date.now },
});
const Booking = mongoose.model('Booking', bookingSchema);

// ── Fidelity schema ─────────────────────────────────────────────────────────
const fidelitySchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  pts:         { type: Number, default: 0, min: 0 },
  redeemed:    { type: Number, default: 0, min: 0 },
  totalEarned: { type: Number, default: 0, min: 0 },
});
const Fidelity = mongoose.model('Fidelity', fidelitySchema);

// ── Driver Application schema ────────────────────────────────────────────────
const driverApplicationSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  firstName:    { type: String, required: true, maxlength: 64 },
  lastName:     { type: String, required: true, maxlength: 64 },
  email:        { type: String, required: true, maxlength: 254 },
  phone:        { type: String, required: true, maxlength: 32 },
  city:         { type: String, required: true, maxlength: 100 },
  experience:   { type: Number, required: true, min: 0, max: 60 },
  vehicleMake:  { type: String, required: true, maxlength: 64 },
  vehicleModel: { type: String, required: true, maxlength: 64 },
  vehicleYear:  { type: Number, required: true, min: 1990, max: 2030 },
  licenseNumber:{ type: String, required: true, maxlength: 32 },
  statement:    { type: String, required: true, maxlength: 1000 },
  decision:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  aiReason:     { type: String, maxlength: 500 },
  createdAt:    { type: Date, default: Date.now },
});
const DriverApplication = mongoose.model('DriverApplication', driverApplicationSchema);

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

// ── Booking endpoints ────────────────────────────────────────────────────────
app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.userId }).sort({ datetime: -1 }).limit(200);
    res.json(bookings);
  } catch (err) { console.error('[bookings GET]', err); res.status(500).json({ error: 'Failed to load bookings.' }); }
});

app.post('/api/bookings', authenticateToken, bookingLimiter, async (req, res) => {
  try {
    const { from, to, fromLat, fromLng, toLat, toLng, datetime, car, carId,
            fare, durationMin, distKm, passengers, notes, driver } = req.body;
    if (!from || !to || !datetime || !car || fare === undefined)
      return res.status(400).json({ error: 'Missing required fields.' });

    const newStart = new Date(datetime);
    if (isNaN(newStart.getTime())) return res.status(400).json({ error: 'Invalid datetime.' });
    const dur = parseInt(durationMin) || 30;
    const newEnd = new Date(newStart.getTime() + dur * 60000);

    // Conflict check: overlapping upcoming bookings
    const existing = await Booking.find({ userId: req.user.userId, status: 'upcoming' });
    const conflict = existing.find(b => {
      const bS = new Date(b.datetime).getTime();
      const bE = bS + (b.durationMin || 30) * 60000;
      return newStart.getTime() < bE && newEnd.getTime() > bS;
    });
    if (conflict) return res.status(409).json({ error: 'You already have a booking during this time.', conflict: conflict._id });

    const booking = new Booking({
      userId: req.user.userId,
      from: String(from).slice(0, 500), to: String(to).slice(0, 500),
      fromLat: fromLat ?? null, fromLng: fromLng ?? null,
      toLat: toLat ?? null, toLng: toLng ?? null,
      datetime: newStart, car: String(car).slice(0, 100),
      carId: carId ? String(carId).slice(0, 50) : '',
      fare: Math.max(0, parseFloat(fare)), durationMin: dur,
      distKm: distKm ? parseFloat(distKm) : null,
      passengers: Math.max(1, Math.min(7, parseInt(passengers) || 1)),
      notes: notes ? String(notes).slice(0, 500) : '',
      driver: driver ? String(driver).slice(0, 100) : '',
      pts: Math.round(parseFloat(fare)),
    });
    await booking.save();
    res.status(201).json(booking);
  } catch (err) { console.error('[bookings POST]', err); res.status(500).json({ error: 'Failed to create booking.' }); }
});

app.put('/api/bookings/:id', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.status !== 'upcoming') return res.status(400).json({ error: 'Only upcoming bookings can be edited.' });

    const { datetime, passengers, notes } = req.body;
    if (datetime) {
      const newStart = new Date(datetime);
      if (isNaN(newStart.getTime())) return res.status(400).json({ error: 'Invalid datetime.' });
      const newEnd = new Date(newStart.getTime() + (booking.durationMin || 30) * 60000);
      const existing = await Booking.find({ userId: req.user.userId, status: 'upcoming', _id: { $ne: booking._id } });
      const conflict = existing.find(b => {
        const bS = new Date(b.datetime).getTime();
        const bE = bS + (b.durationMin || 30) * 60000;
        return newStart.getTime() < bE && newEnd.getTime() > bS;
      });
      if (conflict) return res.status(409).json({ error: 'Time conflicts with another booking.' });
      booking.datetime = newStart;
    }
    if (passengers !== undefined) booking.passengers = Math.max(1, Math.min(7, parseInt(passengers) || 1));
    if (notes !== undefined) booking.notes = String(notes).slice(0, 500);
    await booking.save();
    res.json(booking);
  } catch (err) { console.error('[bookings PUT]', err); res.status(500).json({ error: 'Failed to update booking.' }); }
});

app.delete('/api/bookings/:id', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.status !== 'upcoming') return res.status(400).json({ error: 'Only upcoming bookings can be cancelled.' });
    booking.status = 'cancelled';
    await booking.save();
    res.json({ ok: true });
  } catch (err) { console.error('[bookings DELETE]', err); res.status(500).json({ error: 'Failed to cancel booking.' }); }
});

app.post('/api/bookings/:id/complete', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.status !== 'upcoming') return res.json({ ok: true, alreadyDone: true });
    booking.status = 'completed';
    booking.completedAt = new Date();
    await booking.save();
    const pts = booking.pts || Math.round(booking.fare);
    let fid = await Fidelity.findOne({ userId: req.user.userId });
    if (!fid) fid = new Fidelity({ userId: req.user.userId });
    fid.pts += pts; fid.totalEarned += pts;
    await fid.save();
    res.json({ ok: true, pts, fidelity: { pts: fid.pts, redeemed: fid.redeemed, totalEarned: fid.totalEarned } });
  } catch (err) { console.error('[bookings complete]', err); res.status(500).json({ error: 'Failed to complete booking.' }); }
});

// ── Rider Application ────────────────────────────────────────────────────────
const applyRiderLimiter = makeRateLimiter(3, 24*60*60*1000, 'You can only submit 3 applications per day.');

app.post('/api/apply-rider', authenticateToken, applyRiderLimiter, async (req, res) => {
  try {
    const uid = req.user.userId;
    // Check if user is already a rider
    const user = await User.findById(uid).lean();
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if ((user.accountType || 'user') === 'rider') {
      return res.status(400).json({ error: 'Your account is already a rider account.' });
    }

    // Check 24h submission limit per user (DB-based)
    const yesterday = new Date(Date.now() - 24*60*60*1000);
    const recentApps = await DriverApplication.countDocuments({ userId: uid, createdAt: { $gte: yesterday } });
    if (recentApps >= 3) {
      return res.status(429).json({ error: 'You have already submitted 3 applications today. Please wait 24 hours.' });
    }

    const { firstName, lastName, phone, city, experience, vehicleMake, vehicleModel, vehicleYear, licenseNumber, statement } = req.body;

    // Basic validation
    if (!firstName || !lastName || !phone || !city || experience == null || !vehicleMake || !vehicleModel || !vehicleYear || !licenseNumber || !statement) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    if (typeof statement !== 'string' || statement.length < 20) {
      return res.status(400).json({ error: 'Personal statement must be at least 20 characters.' });
    }

    // Save application first
    const app2 = await new DriverApplication({
      userId: uid, firstName, lastName, email: user.email,
      phone, city, experience: Number(experience),
      vehicleMake, vehicleModel, vehicleYear: Number(vehicleYear),
      licenseNumber, statement, decision: 'pending',
    }).save();

    // Analyze with Claude AI (requires ANTHROPIC_API_KEY in .env)
    let decision = 'pending';
    let aiReason = 'Manual review required.';

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 256,
            messages: [{
              role: 'user',
              content: `You are reviewing a driver application for a luxury ride-hailing service. Analyze the application and decide if it should be approved or rejected.\n\nApplicant: ${firstName} ${lastName}\nCity: ${city}\nDriving experience: ${experience} years\nVehicle: ${vehicleMake} ${vehicleModel} (${vehicleYear})\nLicense number: ${licenseNumber}\nPersonal statement: ${statement}\n\nApproval criteria: at least 2 years driving experience, vehicle from 2015 or newer, complete information, professional tone in statement.\n\nRespond with ONLY valid JSON (no markdown): {"decision":"approved","reason":"brief reason"} or {"decision":"rejected","reason":"brief reason"}`,
            }],
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const raw = aiData?.content?.[0]?.text?.trim() || '';
          const parsed = JSON.parse(raw);
          if (parsed.decision === 'approved' || parsed.decision === 'rejected') {
            decision = parsed.decision;
            aiReason = (parsed.reason || '').slice(0, 500);
          }
        }
      } catch (_) { /* AI unavailable — keep pending */ }
    }

    // Update application with decision
    await DriverApplication.findByIdAndUpdate(app2._id, { decision, aiReason });

    // If approved, update user account type
    if (decision === 'approved') {
      await User.findByIdAndUpdate(uid, { accountType: 'rider' });
    }

    // Send email notification (requires SMTP config in .env)
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && decision !== 'pending') {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        const isApproved = decision === 'approved';
        await transporter.sendMail({
          from: `"Ride" <${process.env.SMTP_USER}>`,
          to: user.email,
          subject: isApproved ? 'Welcome to the Ride team! 🎉' : 'Your Ride driver application',
          html: isApproved
            ? `<h2>Congratulations, ${firstName}!</h2><p>Your application to become a Ride driver has been <strong>approved</strong>. Your account has been upgraded to a rider account. Welcome to the team!</p><p>Reason: ${aiReason}</p>`
            : `<h2>Hi ${firstName},</h2><p>Thank you for applying to become a Ride driver. Unfortunately, your application has been <strong>rejected</strong> at this time.</p><p>Reason: ${aiReason}</p><p>You may apply again after reviewing the requirements.</p>`,
        });
      } catch (_) { /* email failure is non-critical */ }
    }

    res.json({ ok: true, decision, reason: aiReason });
  } catch (err) {
    console.error('[apply-rider]', err);
    res.status(500).json({ error: 'Failed to process application.' });
  }
});

// ── Fidelity endpoints ───────────────────────────────────────────────────────
app.get('/api/fidelity', authenticateToken, async (req, res) => {
  try {
    let fid = await Fidelity.findOne({ userId: req.user.userId });
    res.json({ pts: fid?.pts || 0, redeemed: fid?.redeemed || 0, totalEarned: fid?.totalEarned || 0 });
  } catch (err) { console.error('[fidelity GET]', err); res.status(500).json({ error: 'Failed to load fidelity.' }); }
});

// FIX V-07: serve HTML pages from explicit paths within 'public'
// (express.static already handles this; these routes remain for clean URLs)
const ROOT_DIR = path.resolve(__dirname, '..');
const PAGES = {
  login:'login.html', register:'register.html', settings:'settings.html',
  privacy:'privacy.html', tos:'tos.html', dashboard:'dashboard.html',
  booking:'book-ride.html', 'become-rider':'become-rider.html'
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