require('dotenv').config();

const express    = require('express');
const path       = require('path');
const Database   = require('better-sqlite3');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const fs         = require('fs');

// ─── SQLite setup ────────────────────────────────────────────────────────────
const DATA_DIR = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'ride.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name           TEXT    NOT NULL,
    last_name            TEXT    NOT NULL,
    email                TEXT    NOT NULL UNIQUE,
    password             TEXT    NOT NULL,
    initials             TEXT,
    created_at           TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    phone                TEXT,
    city                 TEXT,
    country              TEXT,
    birthday             TEXT,
    account_type         TEXT    DEFAULT 'user',
    photo                TEXT,
    theme                TEXT,
    lang                 TEXT,
    reduce_motion        TEXT,
    password_reset_token TEXT,
    password_reset_expiry TEXT,
    two_fa_enabled       INTEGER DEFAULT 0,
    two_fa_code          TEXT,
    two_fa_expiry        TEXT
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    from_loc     TEXT    NOT NULL,
    to_loc       TEXT    NOT NULL,
    from_lat     REAL,
    from_lng     REAL,
    to_lat       REAL,
    to_lng       REAL,
    datetime     TEXT    NOT NULL,
    car          TEXT    NOT NULL,
    car_id       TEXT    DEFAULT '',
    fare         REAL    NOT NULL,
    duration_min INTEGER DEFAULT 30,
    dist_km      REAL,
    passengers   INTEGER DEFAULT 1,
    notes        TEXT    DEFAULT '',
    driver       TEXT    DEFAULT '',
    status       TEXT    DEFAULT 'upcoming',
    pts          INTEGER DEFAULT 0,
    completed_at TEXT,
    created_at   TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS fidelity (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL UNIQUE,
    pts          INTEGER DEFAULT 0,
    redeemed     INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS driver_applications (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL,
    first_name     TEXT    NOT NULL,
    last_name      TEXT    NOT NULL,
    email          TEXT    NOT NULL,
    phone          TEXT    NOT NULL,
    city           TEXT    NOT NULL,
    experience     INTEGER NOT NULL,
    vehicle_make   TEXT,
    vehicle_model  TEXT,
    vehicle_year   INTEGER,
    license_number TEXT    NOT NULL,
    statement      TEXT    NOT NULL,
    decision       TEXT    DEFAULT 'pending',
    ai_reason      TEXT,
    created_at     TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );
`);

// ─── Row → response mappers ───────────────────────────────────────────────────
function mapUser(row, includePassword = false) {
  if (!row) return null;
  const u = {
    id:           row.id,
    firstName:    row.first_name,
    lastName:     row.last_name,
    email:        row.email,
    initials:     row.initials,
    createdAt:    row.created_at,
    phone:        row.phone      ?? null,
    city:         row.city       ?? null,
    country:      row.country    ?? null,
    birthday:     row.birthday   ?? null,
    accountType:  row.account_type,
    photo:        row.photo      ?? null,
    theme:        row.theme      ?? null,
    lang:         row.lang       ?? null,
    reduceMotion: row.reduce_motion ?? null,
    twoFaEnabled: !!row.two_fa_enabled,
    twoFaCode:    row.two_fa_code    ?? null,
    twoFaExpiry:  row.two_fa_expiry  ?? null,
    passwordResetToken:  row.password_reset_token  ?? null,
    passwordResetExpiry: row.password_reset_expiry ?? null,
  };
  if (includePassword) u.password = row.password;
  return u;
}

function mapBooking(row) {
  if (!row) return null;
  return {
    _id:         row.id,          // keep _id for frontend compat
    id:          row.id,
    userId:      row.user_id,
    from:        row.from_loc,
    to:          row.to_loc,
    fromLat:     row.from_lat,
    fromLng:     row.from_lng,
    toLat:       row.to_lat,
    toLng:       row.to_lng,
    datetime:    row.datetime,
    car:         row.car,
    carId:       row.car_id,
    fare:        row.fare,
    durationMin: row.duration_min,
    distKm:      row.dist_km,
    passengers:  row.passengers,
    notes:       row.notes,
    driver:      row.driver,
    status:      row.status,
    pts:         row.pts,
    completedAt: row.completed_at ?? null,
    createdAt:   row.created_at,
  };
}

// ─── Prepared statements ──────────────────────────────────────────────────────
const stmts = {
  // Users
  userByEmail:   db.prepare('SELECT * FROM users WHERE email = ?'),
  userById:      db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser:    db.prepare(`INSERT INTO users (first_name, last_name, email, password, initials)
                             VALUES (@firstName, @lastName, @email, @password, @initials)`),
  updateUser:    (fields) => {
    const sets = fields.map(f => `${f} = @${f}`).join(', ');
    return db.prepare(`UPDATE users SET ${sets} WHERE id = @id`);
  },

  // Bookings
  bookingsByUser:    db.prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY datetime DESC LIMIT 200'),
  upcomingByUser:    db.prepare("SELECT * FROM bookings WHERE user_id = ? AND status = 'upcoming'"),
  upcomingExcept:    db.prepare("SELECT * FROM bookings WHERE user_id = ? AND status = 'upcoming' AND id != ?"),
  bookingByIdUser:   db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?'),
  insertBooking:     db.prepare(`INSERT INTO bookings
    (user_id, from_loc, to_loc, from_lat, from_lng, to_lat, to_lng, datetime, car, car_id,
     fare, duration_min, dist_km, passengers, notes, driver, pts)
    VALUES (@userId, @fromLoc, @toLoc, @fromLat, @fromLng, @toLat, @toLng, @datetime, @car, @carId,
            @fare, @durationMin, @distKm, @passengers, @notes, @driver, @pts)`),
  updateBookingStatus: db.prepare('UPDATE bookings SET status = ?, completed_at = ? WHERE id = ?'),
  updateBookingFields: db.prepare('UPDATE bookings SET datetime = @datetime, passengers = @passengers, notes = @notes WHERE id = @id'),

  // Fidelity
  fidelityByUser: db.prepare('SELECT * FROM fidelity WHERE user_id = ?'),
  upsertFidelity: db.prepare(`INSERT INTO fidelity (user_id, pts, redeemed, total_earned)
                               VALUES (@userId, @pts, @redeemed, @totalEarned)
                               ON CONFLICT(user_id) DO UPDATE SET
                                 pts = pts + excluded.pts,
                                 total_earned = total_earned + excluded.total_earned`),

  // Driver applications
  recentAppCount: db.prepare('SELECT COUNT(*) as count FROM driver_applications WHERE user_id = ? AND created_at >= ?'),
  insertDriverApp: db.prepare(`INSERT INTO driver_applications
    (user_id, first_name, last_name, email, phone, city, experience, license_number, statement)
    VALUES (@userId, @firstName, @lastName, @email, @phone, @city, @experience, @licenseNumber, @statement)`),
  updateDriverApp: db.prepare('UPDATE driver_applications SET decision = @decision, ai_reason = @aiReason WHERE id = @id'),
};

// ─── HTTP Security headers ────────────────────────────────────────────────────
function applySecurityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options',    'nosniff');
  res.setHeader('X-Frame-Options',           'DENY');
  res.setHeader('X-XSS-Protection',          '0');
  res.setHeader('Referrer-Policy',           'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy',        'geolocation=(self), camera=(), microphone=()');
  const inlineScriptHashes = [
    "'sha256-tx4La0ktT1Q0U69zVI8fZo7/7BtX0RiHH6jsqgKcN/E='", // index.html
    "'sha256-5qOFzbSteATv9poShdvmMth/arfJmZdBhlcuffpYD1c='", // dashboard.html
    "'sha256-WnvhjbPqxyliCkx0EZdyUKN6m5L360DNy6peJb86JHU='", // settings.html
    "'sha256-ZlyzTylzriMqewO9P8iTDN96VchltcvA7jE6Xk/vb4Y='", // login.html + register.html
    "'sha256-7h4N/XV4lF09Y30+EA2Ti3YBV2TboMwATObM6Mh4XUk='", // book-ride.html
  ].join(' ');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    `script-src 'self' https://unpkg.com ${inlineScriptHashes} 'wasm-unsafe-eval'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://unpkg.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://prod.spline.design https://cdn.spline.design https://app.spline.design https://images.unsplash.com",
    "connect-src 'self' https://nominatim.openstreetmap.org https://photon.komoot.io https://router.project-osrm.org https://unpkg.com https://prod.spline.design https://cdn.spline.design https://app.spline.design https://api.anthropic.com",
    "worker-src 'self' blob: https://unpkg.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; '));
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

// ─── In-memory rate limiter ───────────────────────────────────────────────────
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
    if (rec.count > max) return res.status(429).json({ error: message });
    next();
  };
}

// ─── App setup ───────────────────────────────────────────────────────────────
const app  = express();
const port = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET non impostato.');
    process.exit(1);
  }
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';

app.listen(port, '0.0.0.0', () => console.log(`Server avviato sulla porta ${port} (SQLite)`));

app.use(applySecurityHeaders);

// Redirect HTTP → HTTPS in produzione
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, 'https://' + req.headers.host + req.url);
  }
  next();
});

// CORS
const allowedOrigins = (() => {
  const list = [];
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach(o => list.push(o.trim()));
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    list.push(process.env.RENDER_EXTERNAL_URL.replace(/\/$/, ''));
  }
  list.push('http://localhost:3000');
  list.push('http://localhost:8080');
  list.push('http://127.0.0.1:3000');
  return list;
})();

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (process.env.NODE_ENV === 'production') {
      console.warn('[CORS] origine bloccata:', origin);
    }
    cb(new Error('CORS: origine non consentita'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: false,
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '512kb' }));

// CSRF check
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) return next();
  const origin  = req.headers['origin'];
  const referer = req.headers['referer'];
  const source  = origin || (referer ? new URL(referer).origin : null);
  if (!source) return next();
  if (allowedOrigins.some(o => source === o || source.startsWith(o))) return next();
  return res.status(403).json({ error: 'Richiesta cross-origin non consentita.' });
});

// Block sensitive file paths
const ROOT = path.resolve(__dirname, '..');
const BLOCKED_PATHS = [
  /^scripts[/\\]server\.js$/,
  /^\.env/,
  /^node_modules[/\\]/,
  /^package(-lock)?\.json$/,
  /^\.git[/\\]/,
  /^data[/\\]/,   // protect SQLite database file
];
app.use((req, res, next) => {
  const rel = decodeURIComponent(req.path).replace(/^\//, '').replace(/\\/g, '/');
  if (BLOCKED_PATHS.some(re => re.test(rel))) return res.status(404).end();
  next();
});
app.use(express.static(ROOT));

// Rate limiters
const authLimiter = makeRateLimiter(10, 15 * 60 * 1000, 'Troppi tentativi. Riprova tra qualche minuto.');
const bookingLimiter = makeRateLimiter(20, 60 * 60 * 1000, 'Troppe richieste di prenotazione. Aspetta qualche minuto.');
const profileLimiter = makeRateLimiter(30, 60 * 60 * 1000, "Troppe modifiche al profilo. Riprova tra un'ora.");

console.log('Connesso a SQLite (ride.db)');

// ─── Email helper ─────────────────────────────────────────────────────────────
const nodemailer = require('nodemailer');
function createMailTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}
async function sendMail(to, subject, html) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  try {
    const transporter = createMailTransporter();
    await transporter.sendMail({
      from: `"Ride" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('[sendMail]', err.message);
  }
}

// ─── Validation helpers ───────────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

// ─── JWT middleware ───────────────────────────────────────────────────────────
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required.' });
  jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token.' });
    req.user = user;
    next();
  });
};

// ─── Auth: Register ───────────────────────────────────────────────────────────
app.post('/api/register', authLimiter, async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const validationError = validateRegisterInput({ firstName, lastName, email, password });
    if (validationError) return res.status(400).json({ error: validationError });

    const normalizedEmail = email.trim().toLowerCase();
    const existing = stmts.userByEmail.get(normalizedEmail);
    if (existing) return res.status(400).json({ error: 'Email already registered.' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const initials = ((firstName.trim()[0] || '') + (lastName.trim()[0] || '')).toUpperCase();

    const result = stmts.insertUser.run({
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      email:     normalizedEmail,
      password:  hashedPassword,
      initials,
    });

    const user = mapUser(stmts.userById.get(result.lastInsertRowid));

    await sendMail(
      user.email,
      'Welcome to Ride!',
      `<h2>Hi ${user.firstName},</h2><p>Welcome to Ride! Your account has been created successfully.</p><p>You can now sign in and start booking rides.</p><p style="color:#888;font-size:12px">If you didn't create this account, please ignore this email.</p>`,
    );

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });

    res.status(201).json({ user, token });
  } catch (error) {
    console.error('[register]', error);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// ─── Auth: Login ──────────────────────────────────────────────────────────────
app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const validationError = validateLoginInput({ email, password });
    if (validationError) return res.status(400).json({ error: 'Invalid email or password.' });

    const normalizedEmail = email.trim().toLowerCase();
    const row = stmts.userByEmail.get(normalizedEmail);
    const user = row ? mapUser(row, true) : null;

    const dummyHash = '$2a$12$invalidhashfortimingprotectiononly00000000000000000000';
    const hashToCompare = user ? user.password : dummyHash;
    const isValidPassword = await bcrypt.compare(password, hashToCompare);

    if (!user || !isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // 2FA
    if (user.twoFaEnabled) {
      const code   = String(Math.floor(100000 + Math.random() * 900000));
      const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      db.prepare('UPDATE users SET two_fa_code = ?, two_fa_expiry = ? WHERE id = ?').run(code, expiry, user.id);
      await sendMail(
        user.email,
        'Your Ride sign-in code',
        `<h2>Your sign-in code</h2><p>Use the code below to complete your sign in. It expires in 10 minutes.</p><h1 style="letter-spacing:8px;font-size:36px">${code}</h1><p style="color:#888;font-size:12px">If you didn't request this, please change your password immediately.</p>`,
      );
      const tempToken = jwt.sign({ userId: user.id, twoFaPending: true }, JWT_SECRET, { expiresIn: '10m', algorithm: 'HS256' });
      return res.json({ twoFaRequired: true, tempToken });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
    delete user.password;
    res.json({ user, token });
  } catch (error) {
    console.error('[login]', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// ─── Profile: GET ─────────────────────────────────────────────────────────────
app.get('/api/profile', authenticateToken, (req, res) => {
  try {
    const row = stmts.userById.get(req.user.userId);
    if (!row) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: mapUser(row) });
  } catch (error) {
    console.error('[profile]', error);
    res.status(500).json({ error: 'Failed to get profile.' });
  }
});

// ─── Profile: PATCH ───────────────────────────────────────────────────────────
app.patch('/api/profile', authenticateToken, profileLimiter, async (req, res) => {
  try {
    const ALLOWED_MAP = {
      firstName:    'first_name',
      lastName:     'last_name',
      phone:        'phone',
      city:         'city',
      country:      'country',
      birthday:     'birthday',
      photo:        'photo',
      theme:        'theme',
      lang:         'lang',
      reduceMotion: 'reduce_motion',
      initials:     'initials',
    };

    const updateCols = {};

    for (const [jsKey, colKey] of Object.entries(ALLOWED_MAP)) {
      if (req.body[jsKey] !== undefined) updateCols[colKey] = req.body[jsKey];
    }

    // Validate string fields
    if (updateCols.first_name !== undefined) {
      if (typeof updateCols.first_name !== 'string' || !updateCols.first_name.trim())
        return res.status(400).json({ error: 'Invalid first name.' });
      updateCols.first_name = updateCols.first_name.trim().slice(0, 64);
    }
    if (updateCols.last_name !== undefined) {
      if (typeof updateCols.last_name !== 'string' || !updateCols.last_name.trim())
        return res.status(400).json({ error: 'Invalid last name.' });
      updateCols.last_name = updateCols.last_name.trim().slice(0, 64);
    }
    if (updateCols.theme && !['dark','light'].includes(updateCols.theme))
      return res.status(400).json({ error: 'Invalid theme.' });
    if (updateCols.reduce_motion && !['true','false'].includes(updateCols.reduce_motion))
      return res.status(400).json({ error: 'Invalid reduceMotion value.' });
    if (updateCols.lang && (typeof updateCols.lang !== 'string' || updateCols.lang.length > 8))
      return res.status(400).json({ error: 'Invalid lang.' });

    if (updateCols.photo !== undefined && updateCols.photo !== null) {
      if (typeof updateCols.photo !== 'string')
        return res.status(400).json({ error: 'Invalid photo.' });
      if (updateCols.photo.length > 350000)
        return res.status(400).json({ error: 'Photo too large (max ~256 KB).' });
      if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(updateCols.photo))
        return res.status(400).json({ error: 'Invalid photo format.' });
    }

    // Recalculate initials if name changed
    if (updateCols.first_name || updateCols.last_name) {
      const cur = stmts.userById.get(req.user.userId);
      if (cur) {
        const f = updateCols.first_name || cur.first_name;
        const l = updateCols.last_name  || cur.last_name;
        updateCols.initials = ((f[0]||'') + (l[0]||'')).toUpperCase();
      }
    }

    if (Object.keys(updateCols).length === 0) {
      const row = stmts.userById.get(req.user.userId);
      return res.json({ user: mapUser(row) });
    }

    const sets   = Object.keys(updateCols).map(c => `${c} = @${c}`).join(', ');
    const params = { ...updateCols, id: req.user.userId };
    db.prepare(`UPDATE users SET ${sets} WHERE id = @id`).run(params);

    const updated = stmts.userById.get(req.user.userId);
    if (!updated) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: mapUser(updated) });
  } catch (err) {
    console.error('[profile PATCH]', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// ─── Bookings: GET ────────────────────────────────────────────────────────────
app.get('/api/bookings', authenticateToken, (req, res) => {
  try {
    const rows = stmts.bookingsByUser.all(req.user.userId);
    res.json(rows.map(mapBooking));
  } catch (err) {
    console.error('[bookings GET]', err);
    res.status(500).json({ error: 'Failed to load bookings.' });
  }
});

// ─── Bookings: POST ───────────────────────────────────────────────────────────
app.post('/api/bookings', authenticateToken, bookingLimiter, (req, res) => {
  try {
    const { from, to, fromLat, fromLng, toLat, toLng, datetime, car, carId,
            fare, durationMin, distKm, passengers, notes, driver } = req.body;

    if (!from || !to || !datetime || !car || fare === undefined)
      return res.status(400).json({ error: 'Missing required fields.' });

    const newStart = new Date(datetime);
    if (isNaN(newStart.getTime())) return res.status(400).json({ error: 'Invalid datetime.' });
    const dur    = parseInt(durationMin) || 30;
    const newEnd = new Date(newStart.getTime() + dur * 60000);

    // Conflict check
    const existing = stmts.upcomingByUser.all(req.user.userId);
    const conflict = existing.find(b => {
      const bS = new Date(b.datetime).getTime();
      const bE = bS + (b.duration_min || 30) * 60000;
      return newStart.getTime() < bE && newEnd.getTime() > bS;
    });
    if (conflict) return res.status(409).json({
      error: 'You already have a booking during this time.',
      conflict: conflict.id,
    });

    const result = stmts.insertBooking.run({
      userId:      req.user.userId,
      fromLoc:     String(from).slice(0, 500),
      toLoc:       String(to).slice(0, 500),
      fromLat:     fromLat ?? null,
      fromLng:     fromLng ?? null,
      toLat:       toLat   ?? null,
      toLng:       toLng   ?? null,
      datetime:    newStart.toISOString(),
      car:         String(car).slice(0, 100),
      carId:       carId ? String(carId).slice(0, 50) : '',
      fare:        Math.max(0, parseFloat(fare)),
      durationMin: dur,
      distKm:      distKm ? parseFloat(distKm) : null,
      passengers:  Math.max(1, Math.min(7, parseInt(passengers) || 1)),
      notes:       notes  ? String(notes).slice(0, 500)  : '',
      driver:      driver ? String(driver).slice(0, 100) : '',
      pts:         Math.round(parseFloat(fare)),
    });

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(mapBooking(booking));
  } catch (err) {
    console.error('[bookings POST]', err);
    res.status(500).json({ error: 'Failed to create booking.' });
  }
});

// ─── Bookings: PUT (edit) ─────────────────────────────────────────────────────
app.put('/api/bookings/:id', authenticateToken, (req, res) => {
  try {
    const row = stmts.bookingByIdUser.get(req.params.id, req.user.userId);
    if (!row) return res.status(404).json({ error: 'Booking not found.' });
    if (row.status !== 'upcoming') return res.status(400).json({ error: 'Only upcoming bookings can be edited.' });

    let newDatetime  = row.datetime;
    let newPassengers = row.passengers;
    let newNotes      = row.notes;

    const { datetime, passengers, notes } = req.body;
    if (datetime) {
      const newStart = new Date(datetime);
      if (isNaN(newStart.getTime())) return res.status(400).json({ error: 'Invalid datetime.' });
      const newEnd = new Date(newStart.getTime() + (row.duration_min || 30) * 60000);

      const existing = stmts.upcomingExcept.all(req.user.userId, row.id);
      const conflict = existing.find(b => {
        const bS = new Date(b.datetime).getTime();
        const bE = bS + (b.duration_min || 30) * 60000;
        return newStart.getTime() < bE && newEnd.getTime() > bS;
      });
      if (conflict) return res.status(409).json({ error: 'Time conflicts with another booking.' });
      newDatetime = newStart.toISOString();
    }
    if (passengers !== undefined) newPassengers = Math.max(1, Math.min(7, parseInt(passengers) || 1));
    if (notes      !== undefined) newNotes = String(notes).slice(0, 500);

    db.prepare('UPDATE bookings SET datetime = @datetime, passengers = @passengers, notes = @notes WHERE id = @id')
      .run({ datetime: newDatetime, passengers: newPassengers, notes: newNotes, id: row.id });

    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(row.id);
    res.json(mapBooking(updated));
  } catch (err) {
    console.error('[bookings PUT]', err);
    res.status(500).json({ error: 'Failed to update booking.' });
  }
});

// ─── Bookings: DELETE (cancel) ────────────────────────────────────────────────
app.delete('/api/bookings/:id', authenticateToken, (req, res) => {
  try {
    const row = stmts.bookingByIdUser.get(req.params.id, req.user.userId);
    if (!row) return res.status(404).json({ error: 'Booking not found.' });
    if (row.status !== 'upcoming') return res.status(400).json({ error: 'Only upcoming bookings can be cancelled.' });

    db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(row.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[bookings DELETE]', err);
    res.status(500).json({ error: 'Failed to cancel booking.' });
  }
});

// ─── Bookings: Complete ───────────────────────────────────────────────────────
app.post('/api/bookings/:id/complete', authenticateToken, (req, res) => {
  try {
    const row = stmts.bookingByIdUser.get(req.params.id, req.user.userId);
    if (!row) return res.status(404).json({ error: 'Booking not found.' });
    if (row.status !== 'upcoming') return res.json({ ok: true, alreadyDone: true });

    const completedAt = new Date().toISOString();
    db.prepare("UPDATE bookings SET status = 'completed', completed_at = ? WHERE id = ?").run(completedAt, row.id);

    const pts = row.pts || Math.round(row.fare);

    db.prepare(`
      INSERT INTO fidelity (user_id, pts, redeemed, total_earned)
      VALUES (@userId, @pts, 0, @pts)
      ON CONFLICT(user_id) DO UPDATE SET
        pts = pts + excluded.pts,
        total_earned = total_earned + excluded.total_earned
    `).run({ userId: req.user.userId, pts });

    const fid = stmts.fidelityByUser.get(req.user.userId);
    res.json({
      ok: true,
      pts,
      fidelity: { pts: fid.pts, redeemed: fid.redeemed, totalEarned: fid.total_earned },
    });
  } catch (err) {
    console.error('[bookings complete]', err);
    res.status(500).json({ error: 'Failed to complete booking.' });
  }
});

// ─── Apply rider ──────────────────────────────────────────────────────────────
const applyRiderLimiter = makeRateLimiter(3, 24*60*60*1000, 'Puoi inviare al massimo 3 candidature al giorno.');

app.post('/api/apply-rider', authenticateToken, applyRiderLimiter, async (req, res) => {
  try {
    const uid  = req.user.userId;
    const userRow = stmts.userById.get(uid);
    if (!userRow) return res.status(404).json({ error: 'User not found.' });
    const user = mapUser(userRow);

    if ((user.accountType || 'user') === 'rider') {
      return res.status(400).json({ error: 'Il tuo account è già un account autista.' });
    }

    const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString();
    const { count } = stmts.recentAppCount.get(uid, yesterday);
    if (count >= 3) {
      return res.status(429).json({ error: 'Hai già inviato 3 candidature oggi. Riprova tra 24 ore.' });
    }

    const { firstName, lastName, phone, city, experience, licenseNumber, statement } = req.body;

    if (!firstName || !lastName || !phone || !city || experience == null || !licenseNumber || !statement) {
      return res.status(400).json({ error: 'Tutti i campi sono obbligatori.' });
    }
    if (typeof statement !== 'string' || statement.length < 20) {
      return res.status(400).json({ error: 'La descrizione personale deve essere di almeno 20 caratteri.' });
    }

    const appResult = stmts.insertDriverApp.run({
      userId: uid, firstName, lastName, email: user.email,
      phone, city, experience: Number(experience),
      licenseNumber, statement,
    });
    const appId = appResult.lastInsertRowid;

    let decision = 'pending';
    let aiReason = 'Revisione manuale richiesta.';

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
              content: `You are reviewing a driver application for a luxury ride-hailing service. Analyze the application and decide if it should be approved or rejected.\n\nApplicant: ${firstName} ${lastName}\nCity: ${city}\nDriving experience: ${experience} years\nLicense number: ${licenseNumber}\nPersonal statement: ${statement}\n\nApproval criteria: at least 2 years driving experience, complete information, professional tone in statement.\n\nRespond with ONLY valid JSON (no markdown): {"decision":"approved","reason":"brief reason"} or {"decision":"rejected","reason":"brief reason"}`,
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

    stmts.updateDriverApp.run({ decision, aiReason, id: appId });

    if (decision === 'approved') {
      db.prepare("UPDATE users SET account_type = 'rider' WHERE id = ?").run(uid);
    }

    if (decision !== 'pending') {
      const isApproved = decision === 'approved';
      await sendMail(
        user.email,
        isApproved ? 'Welcome to the Ride team!' : 'Your Ride driver application',
        isApproved
          ? `<h2>Congratulations, ${firstName}!</h2><p>Your application to become a Ride driver has been <strong>approved</strong>. Your account has been upgraded to a rider account. Welcome to the team!</p><p>Reason: ${aiReason}</p>`
          : `<h2>Hi ${firstName},</h2><p>Thank you for applying to become a Ride driver. Unfortunately, your application has been <strong>rejected</strong> at this time.</p><p>Reason: ${aiReason}</p><p>You may apply again after reviewing the requirements.</p>`,
      );
    }

    res.json({ ok: true, decision, reason: aiReason });
  } catch (err) {
    console.error('[apply-rider]', err);
    res.status(500).json({ error: 'Failed to process application.' });
  }
});

// ─── Forgot password ──────────────────────────────────────────────────────────
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }
    const row = stmts.userByEmail.get(email.trim().toLowerCase());
    if (row) {
      const token  = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      db.prepare('UPDATE users SET password_reset_token = ?, password_reset_expiry = ? WHERE id = ?')
        .run(token, expiry, row.id);
      const baseUrl   = process.env.SITE_URL || `http://localhost:${process.env.PORT || 3000}`;
      const resetLink = `${baseUrl}/reset-password.html?token=${token}`;
      await sendMail(
        row.email,
        'Reset your Ride password',
        `<h2>Password reset</h2><p>Hi ${row.first_name},</p><p>Click the link below to reset your password. The link expires in 1 hour.</p><p><a href="${resetLink}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px">Reset password</a></p><p style="color:#888;font-size:12px">If you didn't request this, you can safely ignore this email.</p>`,
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[forgot-password]', err);
    res.status(500).json({ error: 'Failed to process request.' });
  }
});

// ─── Reset password ───────────────────────────────────────────────────────────
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (typeof token !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid request.' });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    const now = new Date().toISOString();
    const row = db.prepare(
      'SELECT * FROM users WHERE password_reset_token = ? AND password_reset_expiry > ?'
    ).get(token, now);
    if (!row) return res.status(400).json({ error: 'Invalid or expired reset token.' });

    const hashed = await bcrypt.hash(password, 12);
    db.prepare('UPDATE users SET password = ?, password_reset_token = NULL, password_reset_expiry = NULL WHERE id = ?')
      .run(hashed, row.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[reset-password]', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// ─── 2FA: toggle ─────────────────────────────────────────────────────────────
app.post('/api/auth/2fa/toggle', authenticateToken, (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'Invalid request.' });
    db.prepare('UPDATE users SET two_fa_enabled = ?, two_fa_code = NULL, two_fa_expiry = NULL WHERE id = ?')
      .run(enabled ? 1 : 0, req.user.userId);
    res.json({ ok: true, twoFaEnabled: enabled });
  } catch (err) {
    console.error('[2fa toggle]', err);
    res.status(500).json({ error: 'Failed to update 2FA setting.' });
  }
});

// ─── 2FA: verify ──────────────────────────────────────────────────────────────
app.post('/api/auth/2fa/verify', authLimiter, (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (typeof tempToken !== 'string' || typeof code !== 'string') {
      return res.status(400).json({ error: 'Invalid request.' });
    }
    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET, { algorithms: ['HS256'] });
    } catch (_) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }
    if (!decoded.twoFaPending) return res.status(401).json({ error: 'Invalid token.' });

    const row = stmts.userById.get(decoded.userId);
    if (!row || !row.two_fa_code || !row.two_fa_expiry) {
      return res.status(401).json({ error: 'No pending 2FA code.' });
    }
    if (new Date() > new Date(row.two_fa_expiry)) {
      return res.status(401).json({ error: 'Code has expired. Please sign in again.' });
    }

    const expected = Buffer.from(row.two_fa_code);
    const received = Buffer.from(code.trim().padEnd(row.two_fa_code.length, '\0').slice(0, row.two_fa_code.length));
    const match    = expected.length === received.length && crypto.timingSafeEqual(expected, received);
    if (!match) return res.status(401).json({ error: 'Incorrect code.' });

    db.prepare('UPDATE users SET two_fa_code = NULL, two_fa_expiry = NULL WHERE id = ?').run(row.id);
    const token = jwt.sign({ userId: row.id }, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
    res.json({ user: mapUser(row), token });
  } catch (err) {
    console.error('[2fa verify]', err);
    res.status(500).json({ error: 'Verification failed.' });
  }
});

// ─── Fidelity: GET ────────────────────────────────────────────────────────────
app.get('/api/fidelity', authenticateToken, (req, res) => {
  try {
    const fid = stmts.fidelityByUser.get(req.user.userId);
    res.json({ pts: fid?.pts || 0, redeemed: fid?.redeemed || 0, totalEarned: fid?.total_earned || 0 });
  } catch (err) {
    console.error('[fidelity GET]', err);
    res.status(500).json({ error: 'Failed to load fidelity.' });
  }
});

// ─── HTML page routes ─────────────────────────────────────────────────────────
const ROOT_DIR = path.resolve(__dirname, '..');
const PAGES = {
  login:'login.html', register:'register.html', settings:'settings.html',
  privacy:'privacy.html', tos:'tos.html', dashboard:'dashboard.html',
  booking:'book-ride.html', 'become-driver':'become-driver.html',
  'reset-password':'reset-password.html',
};
Object.entries(PAGES).forEach(([route, file]) => {
  app.get('/' + route, (_req, res) => {
    res.sendFile(path.join(ROOT_DIR, file));
  });
});
app.get('/', (_req, res) => res.sendFile(path.join(ROOT_DIR, 'index.html')));

if (process.env.NODE_ENV === 'production') {
  module.exports = app;
}