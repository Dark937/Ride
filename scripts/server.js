require('dotenv').config();

const express  = require('express');
const path     = require('path');
const mongoose = require('mongoose');
const cors     = require('cors');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');

// Header di sicurezza HTTP (senza dipendenze esterne)
function applySecurityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options',    'nosniff');
  res.setHeader('X-Frame-Options',           'DENY');
  res.setHeader('X-XSS-Protection',          '0');
  res.setHeader('Referrer-Policy',           'strict-origin-when-cross-origin');
  // Geolocalizzazione consentita solo dalla stessa origine (serve per "La mia posizione" nel booking)
  res.setHeader('Permissions-Policy',        'geolocation=(self), camera=(), microphone=()');
  // CSP: hash degli script inline invece di unsafe-inline
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
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://prod.spline.design https://cdn.spline.design https://images.unsplash.com",
    "connect-src 'self' https://nominatim.openstreetmap.org https://photon.komoot.io https://router.project-osrm.org https://unpkg.com https://prod.spline.design https://cdn.spline.design https://api.anthropic.com",
    "worker-src 'self' blob: https://unpkg.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; '));
  // HSTS solo su HTTPS
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

// Rate limiter in memoria per IP (senza dipendenze esterne)
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

// Rimozione chiavi MongoDB pericolose dal body ($ e .)
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

const app  = express();
const port = process.env.PORT || 3000;

// JWT_SECRET obbligatorio in produzione
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET non impostato.');
    process.exit(1);
  }
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';

app.listen(port, '0.0.0.0', () => console.log(`Server avviato sulla porta ${port}`));

app.use(applySecurityHeaders);

// Redirect HTTP → HTTPS in produzione
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, 'https://' + req.headers.host + req.url);
  }
  next();
});

// Origini consentite per CORS
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
    // Nessun header Origin = richiesta same-origin (pagina browser, curl, Postman)
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

// Limite dimensione body JSON (512kb per consentire foto profilo in base64)
app.use(express.json({ limit: '512kb' }));

// Protezione CSRF via Origin/Referer sulle richieste mutanti
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) return next();
  const origin  = req.headers['origin'];
  const referer = req.headers['referer'];
  const source  = origin || (referer ? new URL(referer).origin : null);
  if (!source) return next();
  if (allowedOrigins.some(o => source === o || source.startsWith(o))) return next();
  return res.status(403).json({ error: 'Richiesta cross-origin non consentita.' });
});

// Sanitizzazione NoSQL
app.use(mongoSanitizeMiddleware);

// File statici: blocca l'accesso ai file sensibili prima di servire la directory
const ROOT = path.resolve(__dirname, '..');
const BLOCKED_PATHS = [
  /^scripts[/\\]server\.js$/,
  /^\.env/,
  /^node_modules[/\\]/,
  /^package(-lock)?\.json$/,
  /^\.git[/\\]/,
];
app.use((req, res, next) => {
  const rel = decodeURIComponent(req.path).replace(/^\//, '').replace(/\\/g, '/');
  if (BLOCKED_PATHS.some(re => re.test(rel))) return res.status(404).end();
  next();
});
app.use(express.static(ROOT));

// Rate limiter: autenticazione (brute-force)
const authLimiter = makeRateLimiter(
  10,
  15 * 60 * 1000,
  'Troppi tentativi. Riprova tra qualche minuto.'
);
// Rate limiter: creazione prenotazioni
const bookingLimiter = makeRateLimiter(
  20,
  60 * 60 * 1000,
  'Troppe richieste di prenotazione. Aspetta qualche minuto.'
);
// Rate limiter: aggiornamento profilo
const profileLimiter = makeRateLimiter(
  30,
  60 * 60 * 1000,
  'Troppe modifiche al profilo. Riprova tra un\'ora.'
);

// Connessione MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ride')
  .then(() => console.log('Connesso a MongoDB'))
  .catch(err => console.error('Errore connessione MongoDB:', err));

// Helper email
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

// Schema utente con validazione a livello di campo
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
  phone:       { type: String, maxlength: 32, default: null },
  city:        { type: String, maxlength: 100, default: null },
  country:     { type: String, maxlength: 100, default: null },
  birthday:    { type: Date, default: null },
  accountType: { type: String, enum: ['user', 'rider'], default: 'user' },
  photo:       { type: String, maxlength: 350000, default: null }, // base64 data URL, max ~256KB (circa)
  theme:       { type: String, enum: ['dark', 'light'], default: null },
  lang:        { type: String, maxlength: 8, default: null },
  reduceMotion:{ type: String, enum: ['true', 'false'], default: null },
  // Reset password
  passwordResetToken:  { type: String, default: null },
  passwordResetExpiry: { type: Date,   default: null },
  twoFaEnabled: { type: Boolean, default: false },
  twoFaCode:    { type: String,  default: null },
  twoFaExpiry:  { type: Date,    default: null },
});

const User = mongoose.model('User', userSchema);

// Schema prenotazione
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

// Schema fedeltà
const fidelitySchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  pts:         { type: Number, default: 0, min: 0 },
  redeemed:    { type: Number, default: 0, min: 0 },
  totalEarned: { type: Number, default: 0, min: 0 },
});
const Fidelity = mongoose.model('Fidelity', fidelitySchema);

// Schema candidatura autista
const driverApplicationSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  firstName:    { type: String, required: true, maxlength: 64 },
  lastName:     { type: String, required: true, maxlength: 64 },
  email:        { type: String, required: true, maxlength: 254 },
  phone:        { type: String, required: true, maxlength: 32 },
  city:         { type: String, required: true, maxlength: 100 },
  experience:   { type: Number, required: true, min: 0, max: 60 },
  vehicleMake:  { type: String, maxlength: 64, default: null },
  vehicleModel: { type: String, maxlength: 64, default: null },
  vehicleYear:  { type: Number, min: 1990, max: 2030, default: null },
  licenseNumber:{ type: String, required: true, maxlength: 32 },
  statement:    { type: String, required: true, maxlength: 1000 },
  decision:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  aiReason:     { type: String, maxlength: 500 },
  createdAt:    { type: Date, default: Date.now },
});
const DriverApplication = mongoose.model('DriverApplication', driverApplicationSchema);

// Validazione input registrazione
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

// Validazione input login
function validateLoginInput({ email, password }) {
  if (typeof email !== 'string' || typeof password !== 'string') {
    return 'All fields must be strings.';
  }
  if (!EMAIL_REGEX.test(email.trim())) return 'Invalid email address.';
  if (!password || password.length > 128) return 'Invalid password.';
  return null;
}

// Registrazione
app.post('/api/register', authLimiter, async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const validationError = validateRegisterInput({ firstName, lastName, email, password });
    if (validationError) return res.status(400).json({ error: validationError });

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      email:     normalizedEmail,
      password:  hashedPassword,
      initials:  ((firstName.trim()[0] || '') + (lastName.trim()[0] || '')).toUpperCase(),
    });

    await user.save();

    // Email di benvenuto
    await sendMail(
      user.email,
      'Welcome to Ride!',
      `<h2>Hi ${user.firstName},</h2><p>Welcome to Ride! Your account has been created successfully.</p><p>You can now sign in and start booking rides.</p><p style="color:#888;font-size:12px">If you didn't create this account, please ignore this email.</p>`,
    );

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });

    res.status(201).json({
      user: {
        id: user._id,
        firstName:   user.firstName,
        lastName:    user.lastName,
        email:       user.email,
        initials:    user.initials,
        createdAt:   user.createdAt,
        phone:       user.phone,
        city:        user.city,
        country:     user.country,
        birthday:    user.birthday,
        accountType: user.accountType,
        photo:       user.photo,
        theme:       user.theme,
        lang:        user.lang,
        reduceMotion:user.reduceMotion,
      },
      token,
    });
  } catch (error) {
    console.error('[register]', error);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// Login
app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const validationError = validateLoginInput({ email, password });
    if (validationError) return res.status(400).json({ error: 'Invalid email or password.' });

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // Hash fittizio per confronto in tempo costante (evita timing side-channel)
    const dummyHash = '$2a$12$invalidhashfortimingprotectiononly00000000000000000000';
    const hashToCompare = user ? user.password : dummyHash;
    const isValidPassword = await bcrypt.compare(password, hashToCompare);

    if (!user || !isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // 2FA: genera e invia codice temporaneo
    if (user.twoFaEnabled) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minuti
      await User.findByIdAndUpdate(user._id, { twoFaCode: code, twoFaExpiry: expiry });
      await sendMail(
        user.email,
        'Your Ride sign-in code',
        `<h2>Your sign-in code</h2><p>Use the code below to complete your sign in. It expires in 10 minutes.</p><h1 style="letter-spacing:8px;font-size:36px">${code}</h1><p style="color:#888;font-size:12px">If you didn't request this, please change your password immediately.</p>`,
      );
      // Token temporaneo a breve scadenza (10 min, senza accesso completo)
      const tempToken = jwt.sign({ userId: user._id, twoFaPending: true }, JWT_SECRET, { expiresIn: '10m', algorithm: 'HS256' });
      return res.json({ twoFaRequired: true, tempToken });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });

    res.json({
      user: {
        id: user._id,
        firstName:   user.firstName,
        lastName:    user.lastName,
        email:       user.email,
        initials:    user.initials,
        createdAt:   user.createdAt,
        phone:       user.phone,
        city:        user.city,
        country:     user.country,
        birthday:    user.birthday,
        accountType: user.accountType,
        photo:       user.photo,
        theme:       user.theme,
        lang:        user.lang,
        reduceMotion:user.reduceMotion,
      },
      token,
    });
  } catch (error) {
    console.error('[login]', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// Verifica JWT
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

// Profilo utente
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

// Aggiornamento profilo
app.patch('/api/profile', authenticateToken, profileLimiter, async (req, res) => {
  try {
const ALLOWED = ['firstName','lastName','phone','city','country','birthday',
                     'photo','theme','lang','reduceMotion','initials','notifPrefs','privacyPrefs'];
    const update = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    // Validazione campi stringa
    if (update.firstName !== undefined) {
      if (typeof update.firstName !== 'string' || !update.firstName.trim())
        return res.status(400).json({ error: 'Invalid first name.' });
      update.firstName = update.firstName.trim().slice(0, 64);
    }
    if (update.lastName !== undefined) {
      if (typeof update.lastName !== 'string' || !update.lastName.trim())
        return res.status(400).json({ error: 'Invalid last name.' });
      update.lastName = update.lastName.trim().slice(0, 64);
    }
    if (update.theme && !['dark','light'].includes(update.theme))
      return res.status(400).json({ error: 'Invalid theme.' });
    if (update.reduceMotion && !['true','false'].includes(update.reduceMotion))
      return res.status(400).json({ error: 'Invalid reduceMotion value.' });
    // Validate prefs objects (JSON → boolean arrays)
    ['notifPrefs','privacyPrefs'].forEach(key => {
      if (update[key] && typeof update[key] !== 'object') {
        return res.status(400).json({ error: `Invalid ${key}.` });
      }
    });
    if (update.lang && (typeof update.lang !== 'string' || update.lang.length > 8))
      return res.status(400).json({ error: 'Invalid lang.' });

    // Validazione foto
    if (update.photo !== undefined && update.photo !== null) {
      if (typeof update.photo !== 'string')
        return res.status(400).json({ error: 'Invalid photo.' });
      if (update.photo.length > 350000)
        return res.status(400).json({ error: 'Photo too large (max ~256 KB).' });
      if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(update.photo))
        return res.status(400).json({ error: 'Invalid photo format.' });
    }

    // Ricalcola le iniziali se il nome è cambiato
    if (update.firstName || update.lastName) {
      const cur = await User.findById(req.user.userId).select('firstName lastName');
      if (cur) {
        const f = update.firstName || cur.firstName;
        const l = update.lastName  || cur.lastName;
        update.initials = ((f[0]||'') + (l[0]||'')).toUpperCase();
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: update },
      { new: true, runValidators: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({ user });
  } catch (err) {
    console.error('[profile PATCH]', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// Prenotazioni
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

    // Controllo conflitti con prenotazioni esistenti
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

// Candidatura autista
const applyRiderLimiter = makeRateLimiter(3, 24*60*60*1000, 'Puoi inviare al massimo 3 candidature al giorno.');

app.post('/api/apply-rider', authenticateToken, applyRiderLimiter, async (req, res) => {
  try {
    const uid = req.user.userId;
    const user = await User.findById(uid).lean();
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if ((user.accountType || 'user') === 'rider') {
      return res.status(400).json({ error: 'Il tuo account è già un account autista.' });
    }

    // Limite 3 candidature per 24 ore (controllo lato DB)
    const yesterday = new Date(Date.now() - 24*60*60*1000);
    const recentApps = await DriverApplication.countDocuments({ userId: uid, createdAt: { $gte: yesterday } });
    if (recentApps >= 3) {
      return res.status(429).json({ error: 'Hai già inviato 3 candidature oggi. Riprova tra 24 ore.' });
    }

    const { firstName, lastName, phone, city, experience, licenseNumber, statement } = req.body;

    if (!firstName || !lastName || !phone || !city || experience == null || !licenseNumber || !statement) {
      return res.status(400).json({ error: 'Tutti i campi sono obbligatori.' });
    }
    if (typeof statement !== 'string' || statement.length < 20) {
      return res.status(400).json({ error: 'La descrizione personale deve essere di almeno 20 caratteri.' });
    }

    const app2 = await new DriverApplication({
      userId: uid, firstName, lastName, email: user.email,
      phone, city, experience: Number(experience),
      licenseNumber, statement, decision: 'pending',
    }).save();

    // Analisi AI della candidatura (richiede ANTHROPIC_API_KEY nel .env)
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
      } catch (_) { /* AI non disponibile — mantieni stato pending */ }
    }

    await DriverApplication.findByIdAndUpdate(app2._id, { decision, aiReason });

    if (decision === 'approved') {
      await User.findByIdAndUpdate(uid, { accountType: 'rider' });
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

// Reset password
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    // Risposta sempre positiva per evitare user enumeration
    if (user) {
      const token  = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 ora
      await User.findByIdAndUpdate(user._id, { passwordResetToken: token, passwordResetExpiry: expiry });
      const baseUrl = process.env.SITE_URL || `http://localhost:${process.env.PORT || 3000}`;
      const resetLink = `${baseUrl}/reset-password.html?token=${token}`;
      await sendMail(
        user.email,
        'Reset your Ride password',
        `<h2>Password reset</h2><p>Hi ${user.firstName},</p><p>Click the link below to reset your password. The link expires in 1 hour.</p><p><a href="${resetLink}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px">Reset password</a></p><p style="color:#888;font-size:12px">If you didn't request this, you can safely ignore this email.</p>`,
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[forgot-password]', err);
    res.status(500).json({ error: 'Failed to process request.' });
  }
});

app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (typeof token !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid request.' });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpiry: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset token.' });
    const hashed = await bcrypt.hash(password, 12);
    await User.findByIdAndUpdate(user._id, {
      password: hashed,
      passwordResetToken: null,
      passwordResetExpiry: null,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[reset-password]', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// 2FA via email
app.post('/api/auth/2fa/toggle', authenticateToken, async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'Invalid request.' });
    await User.findByIdAndUpdate(req.user.userId, { twoFaEnabled: enabled, twoFaCode: null, twoFaExpiry: null });
    res.json({ ok: true, twoFaEnabled: enabled });
  } catch (err) {
    console.error('[2fa toggle]', err);
    res.status(500).json({ error: 'Failed to update 2FA setting.' });
  }
});

app.post('/api/auth/2fa/verify', authLimiter, async (req, res) => {
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
    const user = await User.findById(decoded.userId);
    if (!user || !user.twoFaCode || !user.twoFaExpiry) {
      return res.status(401).json({ error: 'No pending 2FA code.' });
    }
    if (new Date() > user.twoFaExpiry) {
      return res.status(401).json({ error: 'Code has expired. Please sign in again.' });
    }
        // Confronto in tempo costante per prevenire timing attack
    const expected = Buffer.from(user.twoFaCode);
    const received = Buffer.from(code.trim().padEnd(user.twoFaCode.length, '\0').slice(0, user.twoFaCode.length));
    const match = expected.length === received.length && crypto.timingSafeEqual(expected, received);
    if (!match) return res.status(401).json({ error: 'Incorrect code.' });

    await User.findByIdAndUpdate(user._id, { twoFaCode: null, twoFaExpiry: null });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
    res.json({
      user: {
        id: user._id,
        firstName:   user.firstName,
        lastName:    user.lastName,
        email:       user.email,
        initials:    user.initials,
        createdAt:   user.createdAt,
        phone:       user.phone,
        city:        user.city,
        country:     user.country,
        birthday:    user.birthday,
        accountType: user.accountType,
        photo:       user.photo,
        theme:       user.theme,
        lang:        user.lang,
        reduceMotion:user.reduceMotion,
      },
      token,
    });
  } catch (err) {
    console.error('[2fa verify]', err);
    res.status(500).json({ error: 'Verification failed.' });
  }
});

// Fidelity
app.get('/api/fidelity', authenticateToken, async (req, res) => {
  try {
    let fid = await Fidelity.findOne({ userId: req.user.userId });
    res.json({ pts: fid?.pts || 0, redeemed: fid?.redeemed || 0, totalEarned: fid?.totalEarned || 0 });
  } catch (err) { console.error('[fidelity GET]', err); res.status(500).json({ error: 'Failed to load fidelity.' }); }
});

// Route pagine HTML per URL puliti
const ROOT_DIR = path.resolve(__dirname, '..');
const PAGES = {
  login:'login.html', register:'register.html', settings:'settings.html',
  privacy:'privacy.html', tos:'tos.html', dashboard:'dashboard.html',
  booking:'book-ride.html', 'become-rider':'become-rider.html',
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