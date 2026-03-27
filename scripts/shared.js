/* ═══════════════════════════════════════════════════════════════════
   RIDE — SHARED CORE  (scripts/shared.js)
   Must be loaded FIRST on every page, before any page-specific script.
   ═══════════════════════════════════════════════════════════════════ */
"use strict";

/* ── SQLite ───────────────────────────────────────────────────────── */
let db;

const dbReady = (async () => {
  try {
    const SQL = await initSqlJs({ locateFile: f => `assets/${f}` });
    const saved = await _idbGet("database");
    db = saved ? new SQL.Database(saved) : new SQL.Database();

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        firstName TEXT, lastName TEXT,
        email TEXT UNIQUE, password TEXT,
        initials TEXT, createdAt TEXT,
        photo TEXT, phone TEXT,
        city TEXT, country TEXT, birthday TEXT,
        lang TEXT, theme TEXT, reduceMotion TEXT
      )
    `);
    ["photo","phone","city","country","birthday","lang","theme","reduceMotion"].forEach(col => {
      try { db.run("ALTER TABLE users ADD COLUMN " + col + " TEXT"); } catch(_){}
    });
    await _idbSave();
  } catch(e) { console.error("DB init error:", e); }
})();

async function _idbSave() {
  if (!db) return;
  const data = db.export();
  return new Promise((res, rej) => {
    const r = indexedDB.open("rideDB", 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains("sqlite"))
        r.result.createObjectStore("sqlite");
    };
    r.onsuccess = () => {
      const tx = r.result.transaction(["sqlite"], "readwrite");
      const p  = tx.objectStore("sqlite").put(data, "database");
      p.onsuccess = res; p.onerror = () => rej(p.error);
    };
    r.onerror = () => rej(r.error);
  });
}

async function _idbGet(key) {
  return new Promise(res => {
    const r = indexedDB.open("rideDB", 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains("sqlite"))
        r.result.createObjectStore("sqlite");
    };
    r.onsuccess = () => {
      const tx = r.result.transaction(["sqlite"], "readonly");
      const g  = tx.objectStore("sqlite").get(key);
      g.onsuccess = () => res(g.result || null);
      g.onerror   = () => res(null);
    };
    r.onerror = () => res(null);
  });
}

function saveDatabase() { return _idbSave(); }

/* ── SESSION ──────────────────────────────────────────────────────── */
const Session = {
  async save(user) {
    await dbReady;
    if (!db) throw new Error("DB not ready");

    // Fetch the full existing record so we never overwrite fields with null
    let existing = {};
    try {
      const sr = db.prepare("SELECT * FROM users WHERE id=?");
      const ex = sr.getAsObject([user.id]); sr.free();
      if (ex && ex.id) existing = ex;
    } catch(_) {}

    // Preserve password from DB if not supplied on the incoming object
    const existingPassword = user.password || existing.password || "";

    // Merge: incoming values take priority; fall back to existing DB values
    const merged = {
      id:        user.id,
      firstName: user.firstName  ?? existing.firstName  ?? "",
      lastName:  user.lastName   ?? existing.lastName   ?? "",
      email:     user.email      ?? existing.email      ?? "",
      password:  existingPassword,
      initials:  user.initials   ?? existing.initials   ?? "",
      createdAt: user.createdAt  ?? existing.createdAt  ?? new Date().toISOString(),
      photo:     user.photo      !== undefined ? user.photo    : (existing.photo    ?? null),
      phone:     user.phone      !== undefined ? user.phone    : (existing.phone    ?? null),
      city:      user.city       !== undefined ? user.city     : (existing.city     ?? null),
      country:   user.country    !== undefined ? user.country  : (existing.country  ?? null),
      birthday:  user.birthday   !== undefined ? user.birthday : (existing.birthday ?? null),
      lang:        user.lang        !== undefined ? user.lang        : (existing.lang        ?? null),
      theme:       user.theme       !== undefined ? user.theme       : (existing.theme       ?? null),
      reduceMotion:user.reduceMotion !== undefined ? user.reduceMotion: (existing.reduceMotion ?? null),
    };

    const s = db.prepare(`
      INSERT OR REPLACE INTO users
      (id,firstName,lastName,email,password,initials,createdAt,photo,phone,city,country,birthday,lang,theme,reduceMotion)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    s.run([merged.id, merged.firstName, merged.lastName, merged.email,
           merged.password, merged.initials, merged.createdAt,
           merged.photo, merged.phone, merged.city,
           merged.country, merged.birthday, merged.lang,
           merged.theme ?? null, merged.reduceMotion ?? null]);
    s.free();
    await _idbSave();
    localStorage.setItem("current_user_id", user.id);
  },

  async get() {
    await dbReady;
    try {
      const uid = localStorage.getItem("current_user_id");
      if (!uid || !db) return null;
      const s = db.prepare("SELECT * FROM users WHERE id = ?");
      const r = s.getAsObject([uid]); s.free();
      if (r && r.id) {
        const safe = {...r}; delete safe.password;
        // Apply user's preferred lang/theme/motion from account
        if (safe.lang)  Lang.set(safe.lang);
        if (safe.theme) Theme.set(safe.theme);
        // reduceMotion is applied explicitly in bootstrap, not here
        return safe;
      }
      return null;
    } catch(e) { console.error("Session.get error:", e); return null; }
  },

  clear(wipePrefs = false) {
    localStorage.removeItem("current_user_id");
    if (wipePrefs) {
      // On logout: remove stored prefs so system defaults take over
      localStorage.removeItem("ride_theme");
      localStorage.removeItem("ride_reduce_motion");
      localStorage.removeItem("ride_lang");
      // Expire cookies immediately so they don't persist across sessions
      const expired = "expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax";
      document.cookie = "ride_lang=" + expired;
      document.cookie = "ride_theme=" + expired;
      // Restore system theme and Italian default
      Theme.apply();
      Lang.apply();
      Motion.apply();
    }
  },

  // Device session tracking
  saveDevice() {
    const ua = navigator.userAgent;
    const isMobile = /Mobile|Android|iPhone|iPad/.test(ua);
    const brand = /Edg/.test(ua) ? "Edge" : /Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "Browser";
    const os = /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : "Unknown";
    const type = isMobile ? "mobile" : "desktop";
    const now = new Date().toISOString();
    const devices = JSON.parse(localStorage.getItem("ride_devices") || "[]");
    // Mark all others as not-current
    devices.forEach(d => { d.current = false; });
    const existing = devices.find(d => d.brand === brand && d.os === os);
    if (existing) {
      existing.lastSeen = now; existing.current = true;
    } else {
      devices.push({ id: Math.random().toString(36).slice(2,10), brand, os, type, lastSeen: now, current: true });
    }
    localStorage.setItem("ride_devices", JSON.stringify(devices.slice(-6)));
  },
  getDevices()       { return JSON.parse(localStorage.getItem("ride_devices") || "[]"); },
  removeDevice(id)   {
    const d = this.getDevices().filter(x => x.id !== id);
    localStorage.setItem("ride_devices", JSON.stringify(d));
  },

  async isLoggedIn() { return !!(await this.get()); }
};

/* ── MOCK AUTH ────────────────────────────────────────────────────── */
const Auth = {
  /* simple bcrypt-free hash — good enough for a local demo DB */
  _hash(pw) {
    let h = 5381;
    for (let i = 0; i < pw.length; i++) h = ((h << 5) + h) ^ pw.charCodeAt(i);
    return (h >>> 0).toString(16);
  },

  async register({ firstName, lastName, email, password }) {
    await dbReady;
    if (!db) return { ok: false, error: "Database not ready." };
    try {
      // Check duplicate email
      const chk = db.prepare("SELECT id FROM users WHERE email = ?");
      const ex  = chk.getAsObject([email.trim().toLowerCase()]); chk.free();
      if (ex && ex.id) return { ok: false, error: "An account with this email already exists." };

      const id       = "u_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      const initials = ((firstName[0]||"") + (lastName[0]||"")).toUpperCase();
      const user = {
        id, firstName, lastName,
        email:     email.trim().toLowerCase(),
        password:  this._hash(password),
        initials,
        createdAt: new Date().toISOString(),
        photo: null, phone: null, city: null, country: null, birthday: null, lang: null,
      };
      const s = db.prepare(
        `INSERT INTO users (id,firstName,lastName,email,password,initials,createdAt,photo,phone,city,country,birthday,lang)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      s.run([user.id, user.firstName, user.lastName, user.email, user.password,
             user.initials, user.createdAt, null, null, null, null, null, null]);
      s.free();
      await _idbSave();
      const safe = {...user}; delete safe.password;
      return { ok: true, user: safe };
    } catch(e) {
      return { ok: false, error: "Registration failed: " + e.message };
    }
  },

  async login({ email, password }) {
    await dbReady;
    if (!db) return { ok: false, error: "Database not ready." };
    try {
      const s = db.prepare("SELECT * FROM users WHERE email = ?");
      const r = s.getAsObject([email.trim().toLowerCase()]); s.free();
      if (!r || !r.id) return { ok: false, error: "No account found with this email address." };
      if (r.password !== this._hash(password)) return { ok: false, error: "Incorrect password." };
      const safe = {...r}; delete safe.password;
      return { ok: true, user: safe };
    } catch(e) {
      return { ok: false, error: "Login failed: " + e.message };
    }
  },
};

/* ── LANGUAGES ────────────────────────────────────────────────────── */
const LANGS = {
  en: {
    home:"Home", features:"Features", vehicles:"Vehicles",
    fidelity:"Fidelity", drive:"Drive with us",
    getStarted:"Get started", bookNow:"Book now", viewPlans:"View plans", explore:"Explore",
    signIn:"Sign in", createAccount:"Create account",
    welcomeBack:"Welcome back", createYourAccount:"Create your account",
    dontHaveAccount:"Don't have an account?", signUpFree:"Sign up for free",
    alreadyHaveAccount:"Already have an account?",
    emailAddress:"Email address", password:"Password",
    firstName:"First name", lastName:"Last name",
    confirmPassword:"Confirm password", forgotPassword:"Forgot password?",
    continueWithGoogle:"Continue with Google", continueWithApple:"Continue with Apple",
    orContinueWith:"or", agreeTerms:"I agree to the",
    termsOfService:"Terms of Service", andText:"and",
    privacyPolicy:"Privacy Policy", bySigningIn:"By signing in you agree to our",
    myRides:"My rides", fidelityPoints:"Fidelity points",
    settings:"Settings", signOut:"Sign out", langLabel:"EN",
    // Dashboard keys
    dashTitle:"Dashboard", myFidelityTitle:"My Fidelity", paymentsTitle:"Payments",
    myAccountTitle:"My Account", totalRides:"Total rides", spentThisMonth:"Spent this month",
    fidelityPts:"points available", nextRide:"Next Ride", recentRides:"Recent Rides",
    recentReviews:"Recent Reviews", spendingOverview:"Spending Overview",
    noUpcomingRides:"No upcoming rides", bookRide:"Book a ride",
    bookAnother:"Book another", cancelRide:"Cancel ride",
    myFidelityCard:"My Fidelity Card",
    settings:"Settings",
    signOut:"Sign out",
    cancel:"Cancel",
    addNewCard:"Add new card",
    cardNumber:"Card number",
    cardholderName:"Cardholder name",
    expiry:"Expiry",
    saveCard:"Save card",
    editInSettings:"Edit in Settings",
    fidelityTier:"Current tier",
    fidAvailLabel:"Available points", fidLifeLabel:"Lifetime earned", fidRedeemedLabel:"Redeemed",
    memberSince:"Member since",
    paymentMethods2:"Payment Methods",
    personalInfo2:"Personal Info",
    pointsHistory:"Points History",
    spending:"Spending",
    upcomingAll:"See all",
    recentReviews:"Recent Reviews",
    account:"Account", security:"Security", appearance:"Appearance",
    billing:"Billing", notifications:"Notifications", logout:"Log out",
    personalInfo:"Personal information",
    updateNameContact:"Manage your personal information and profile photo.",
    saveChanges:"Save changes", cancel:"Cancel", changePhoto:"Change photo",
    phoneNumber:"Phone number", city:"City",
    changePassword:"Change password", currentPassword:"Current password",
    newPassword:"New password", confirmNewPassword:"Confirm new password",
    updatePassword:"Update password", clear:"Clear",
    activeSessions:"Active sessions", dangerZone:"Danger zone",
    deleteAccount:"Delete account",
    language:"Language", themeDisplay:"Theme & Display",
    darkMode:"Dark mode", reduceMotion:"Reduce motion",
    saveLanguage:"Save language",
    switchTheme:"Switch between light and dark interface.",
    minimiseAnimations:"Minimise animations and transitions sitewide.",
    paymentMethods:"Payment methods", transactionHistory:"Transaction history",
    addCard:"Add card",
    rideUpdates:"Ride updates", pushNotifications:"Push notifications",
    smsNotifications:"SMS notifications", rideReceipts:"Ride receipts",
    accountUpdates:"Account updates", promotionalOffers:"Promotional offers",
    savePreferences:"Save preferences", privacy:"Privacy",
    sectionCoreFeatures:"Core Features", sectionHowItWorks:"How It Works",
    sectionOurVehicles:"Our Vehicles", sectionFidelityCard:"Fidelity Card",
    sectionDriveWithRide:"Drive with Ride",
    footerProduct:"Product", footerCompany:"Company", footerLegal:"Legal",
    footerCopyright:"© 2026 Ride. All rights reserved.",
    // Driver promo card
    dpEyebrow:"Earn with Ride",
    dpHeadline:"Drive on\nyour terms.",
    dpBody:"Flexible hours, fast payments, dedicated support. Join thousands of drivers across Italy.",
    dpStatHour:"avg/hr",
    dpStatApproval:"approval",
    dpStatFlex:"flex",
    dpStatHourVal:"€18",
    dpStatApprovalVal:"48h",
    dpStatFlexVal:"flex",
    dpCta:"Learn more",
    // Settings panel descriptions
    securityDesc:"Manage your password, two-factor authentication and active sessions.",
    appearanceDesc:"Customise language, theme and visual preferences across all Ride pages.",
    billingDesc:"Manage your payment methods and view transaction history.",
    notificationsDesc:"Control how and when Ride contacts you.",
    privacyDesc:"Control what data Ride collects and how it's used.",
    // Panel sub-labels
    langDesc:"Choose the language displayed across all Ride pages.",
    themeDesc:"Switch between light and dark interface.",
    motionDesc:"Minimise animations and transitions sitewide.",
    paymentDesc:"Add or remove cards from your account.",
    transactionDesc:"Your recent rides and charges.",
    rideUpdatesLabel:"Ride updates",
    pushDesc:"Driver arrival, route changes and trip completion.",
    smsDesc:"Text updates for driver ETA and pickup.",
    remindersLabel:"Ride reminders",
    remindersDesc:"Reminder 30 minutes before a scheduled ride.",
    receiptDesc:"Full breakdown emailed after every trip.",
    accountUpdateDesc:"Security alerts and important account changes.",
    promoDesc:"Exclusive discounts and seasonal events.",
    dataUsageTitle:"Data usage",
    shareLabel:"Share ride data with partners",
    shareDesc:"Allow anonymised trip data to be shared with transportation partners.",
    marketingLabel:"Personalised marketing",
    marketingDesc:"Allow Ride to use your data for personalised offers and ads.",
    analyticsLabel:"Analytics & performance data",
    analyticsDesc:"Help improve Ride by sharing anonymous usage metrics.",
    locationLabel:"Precise location",
    locationDesc:"Use your exact GPS location for better pickup accuracy.",
    yourDataTitle:"Your data",
    yourDataDesc:"You can request a full export of your personal data at any time. We'll email it to you within 48 hours.",
    exportDataBtn:"Request data export",
    dangerDesc:"Permanently delete your account and all associated data.",
    twoFaTitle:"Two-factor authentication",
    totpLabel:"Authenticator app (TOTP)",
    totpDesc:"Require a time-based code when signing in from a new device.",
    loginAlertLabel:"Login activity alerts",
    loginAlertDesc:"Send an email when a new sign-in is detected.",
    sessionDesc:"Devices currently signed in to your account.",
    passwordDesc:"Manage your password, two-factor authentication and active sessions.",
    // Landing page
    heroTitle:"Move Faster. Ride Smarter.",
    heroSubtitle:"Powered by AI",
    heroDesc:"From quick city rides to daily commuting, Ride delivers a smooth and reliable experience powered by modern technology and intuitive design.",
    f1Title:"Your route is ready before traffic gets a vote.",
    f1Text:"Ride tracks live traffic, demand patterns, and predictive data to optimize every journey before delays become your problem.",
    f2Title:"Your trip leaves a lighter footprint.",
    f2Text:"Smarter dispatch means fewer empty vehicles, less wasted mileage, and a city that moves cleaner — because your ride is part of a better system.",
    f3Title:"Support that's already there when you need it.",
    f3Text:"Before pickup, during the ride, and after drop-off — real-time AI guidance and personalized updates keep you in control at every step.",
    f4Title:"You don't just arrive. You make an entrance.",
    f4Text:"Supercars and high-performance vehicles are part of every Ride experience — not an upgrade. This is what transport looks like when it's built around identity.",
    howItWorksTitle:"Every ride, engineered before it begins.",
    howItWorksDesc:"Book in seconds. The system handles everything else.",
    step1Title:"Choose your class",
    step1Text:"Select the vehicle that matches your style and destination. The system locks in your preferences instantly.",
    step2Title:"AI prepares the route",
    step2Text:"Before the car arrives, AI has already solved the route, timing, and road conditions. Nothing left to chance.",
    step3Title:"Ride without friction",
    step3Text:"Your driver arrives on time, in the right car, on the optimized path. Door to door, exactly as planned.",
    vehiclesTitle:"Supercars are not a side feature. They are the identity.",
    vehiclesDesc:"Ride is built around high-performance design, premium comfort, and unforgettable presence. This is mobility with actual character.",
    v1p:"Precision handling. City-ready performance.",
    v2p:"Flagship comfort for business and first-class travel.",
    v3p:"Unmatched refinement. Silence as a feature.",
    v4p:"Zero emissions. Full performance. AI-native.",
    v5p:"The Ride signature. Raw presence, every arrival.",
    v6p:"Group travel with no compromise on luxury.",
    fidelityTitle:"Rewards that make premium mobility worth repeating.",
    fidelityText:"The Ride Fidelity Card turns every journey into long-term value. Earn points, unlock exclusive discounts, access priority booking, and get benefits designed for frequent premium riders.",
    benefitItem1:"Earn points on every ride",
    benefitItem2:"Priority access during peak hours",
    benefitItem3:"Exclusive monthly discounts",
    benefitItem4:"Members-only offers and upgrades",
    fidGetCard:"Get your card",
    driverTitle:"Turn your car into something that works for you.",
    driverText:"Join the Ride driver network. Set your hours, choose your rides, and earn more with a platform built around performance — not just availability.",
    driverApply:"Apply to drive",
    driverLearn:"Learn more",
    stat1Val:"+40%",
    stat1Label:"Average earnings vs standard platforms",
    stat2Val:"Full flex",
    stat2Label:"No minimums, no schedules, no pressure",
    stat3Val:"AI dispatch",
    stat3Label:"Smarter routing means less dead mileage",
    partnersTrustedBy:"Trusted by",
    footerTagline:"Ride merges AI, premium service, and high-performance vehicles to redefine what urban mobility can feel like.",
    myDashboard:"My Dashboard",
    // Supercar DNA section
    sectionSupercarDNA:"Supercar DNA",
    scdTitle:"Performance is not optional. It is the baseline.",
    scdText:"Every Ride vehicle is chosen for one reason: it has to feel like nothing else on the road. 0–100 in under four seconds. Carbon fibre where aluminium would have been enough. Sound that makes the city pay attention.",
    scdStat1Val:"0→100",
    scdStat1Label:"under 4 seconds",
    scdStat2Val:"1,200+",
    scdStat2Label:"combined horsepower",
    scdStat3Val:"100%",
    scdStat3Label:"hand-selected fleet",
    scdBadgeSub:"Performance fleet",
    ctaBook:"Book now",
    // Dashboard — fidelity mini & fidelity panel
    rideFidelity:"Ride Fidelity",
    viewFidelity:"View Fidelity →",
    ptsToGold:"{n} pts to Gold",
    goldUnlocked:"Gold unlocked ✦",
    tierStandard:"Standard",
    tierGold:"Gold ✦",
    // Dashboard — wallet
    rideWallet:"Ride Wallet",
    addFunds:"Add funds",
    noTransactions:"No transactions yet",
    fundsAdded:"Funds added",
    // Dashboard — insights card
    rideInsights:"Ride Insights",
    topDest:"Top destination",
    avgFare:"Avg fare",
    totalDist:"Total distance",
    monthRides:"Rides this month",
    noInsights:"Complete rides to see insights.",
    // Confirmations
    cancelRideQ:"Cancel this ride?",
    keepRide:"Keep ride",
  },

  it: {
    home:"Home", features:"Funzionalità", vehicles:"Veicoli",
    fidelity:"Fedeltà", drive:"Guida con noi",
    getStarted:"Inizia ora", bookNow:"Prenota ora", viewPlans:"Vedi piani", explore:"Esplora",
    signIn:"Accedi", createAccount:"Crea account",
    welcomeBack:"Bentornato", createYourAccount:"Crea il tuo account",
    dontHaveAccount:"Non hai un account?", signUpFree:"Registrati gratis",
    alreadyHaveAccount:"Hai già un account?",
    emailAddress:"Indirizzo email", password:"Password",
    firstName:"Nome", lastName:"Cognome",
    confirmPassword:"Conferma password", forgotPassword:"Password dimenticata?",
    continueWithGoogle:"Continua con Google", continueWithApple:"Continua con Apple",
    orContinueWith:"oppure", agreeTerms:"Accetto i",
    termsOfService:"Termini di Servizio", andText:"e la",
    privacyPolicy:"Privacy Policy", bySigningIn:"Accedendo accetti i nostri",
    myRides:"I miei viaggi", fidelityPoints:"Punti fedeltà",
    settings:"Impostazioni", signOut:"Esci", langLabel:"IT",
    // Dashboard keys
    dashTitle:"Dashboard", myFidelityTitle:"La mia Fedeltà", paymentsTitle:"Pagamenti",
    myAccountTitle:"Il mio Account", totalRides:"Viaggi totali", spentThisMonth:"Speso questo mese",
    fidelityPts:"punti disponibili", nextRide:"Prossimo Viaggio", recentRides:"Viaggi recenti",
    recentReviews:"Recensioni recenti", spendingOverview:"Riepilogo spese",
    noUpcomingRides:"Nessun viaggio programmato", bookRide:"Prenota un viaggio",
    bookAnother:"Prenota un altro", cancelRide:"Cancella viaggio",
    myFidelityCard:"La mia Carta Fedeltà",
    settings:"Impostazioni",
    signOut:"Esci",
    cancel:"Annulla",
    addNewCard:"Aggiungi carta",
    cardNumber:"Numero carta",
    cardholderName:"Titolare",
    expiry:"Scadenza",
    saveCard:"Salva carta",
    editInSettings:"Modifica in Impostazioni",
    fidelityTier:"Livello attuale",
    fidAvailLabel:"Punti disponibili", fidLifeLabel:"Totale guadagnati", fidRedeemedLabel:"Riscattati",
    memberSince:"Membro dal",
    paymentMethods2:"Metodi di pagamento",
    personalInfo2:"Informazioni",
    pointsHistory:"Storico punti",
    spending:"Spese",
    upcomingAll:"Vedi tutti",
    recentReviews:"Recensioni recenti",
    account:"Account", security:"Sicurezza", appearance:"Aspetto",
    billing:"Fatturazione", notifications:"Notifiche", logout:"Esci",
    personalInfo:"Informazioni personali",
    updateNameContact:"Gestisci le tue informazioni personali e la foto del profilo.",
    saveChanges:"Salva modifiche", cancel:"Annulla", changePhoto:"Cambia foto",
    phoneNumber:"Numero di telefono", city:"Città",
    changePassword:"Cambia password", currentPassword:"Password attuale",
    newPassword:"Nuova password", confirmNewPassword:"Conferma nuova password",
    updatePassword:"Aggiorna password", clear:"Cancella",
    activeSessions:"Sessioni attive", dangerZone:"Zona pericolosa",
    deleteAccount:"Elimina account",
    language:"Lingua", themeDisplay:"Tema e visualizzazione",
    darkMode:"Modalità scura", reduceMotion:"Riduci animazioni",
    saveLanguage:"Salva lingua",
    switchTheme:"Passa tra tema chiaro e scuro.",
    minimiseAnimations:"Minimizza animazioni e transizioni.",
    paymentMethods:"Metodi di pagamento", transactionHistory:"Storico transazioni",
    addCard:"Aggiungi carta",
    rideUpdates:"Aggiornamenti viaggio", pushNotifications:"Notifiche push",
    smsNotifications:"Notifiche SMS", rideReceipts:"Ricevute viaggio",
    accountUpdates:"Aggiornamenti account", promotionalOffers:"Offerte promozionali",
    savePreferences:"Salva preferenze", privacy:"Privacy",
    sectionCoreFeatures:"Funzionalità principali", sectionHowItWorks:"Come funziona",
    sectionOurVehicles:"I nostri veicoli", sectionFidelityCard:"Carta Fedeltà",
    sectionDriveWithRide:"Guida con Ride",
    footerProduct:"Prodotto", footerCompany:"Azienda", footerLegal:"Legale",
    footerCopyright:"© 2026 Ride. Tutti i diritti riservati.",
    dpEyebrow:"Guadagna con Ride",
    dpHeadline:"Guida quando\nvuoi tu.",
    dpBody:"Orari flessibili, pagamenti rapidi, supporto dedicato. Unisciti a migliaia di driver in tutta Italia.",
    dpStatHour:"media/ora",
    dpStatApproval:"approvazione",
    dpStatFlex:"orari liberi",
    dpStatHourVal:"€18",
    dpStatApprovalVal:"48h",
    dpStatFlexVal:"flex",
    dpCta:"Scopri di più",
    securityDesc:"Gestisci password, autenticazione a due fattori e sessioni attive.",
    appearanceDesc:"Personalizza lingua, tema e preferenze visive su tutte le pagine.",
    billingDesc:"Gestisci i metodi di pagamento e visualizza lo storico transazioni.",
    notificationsDesc:"Controlla come e quando Ride ti contatta.",
    privacyDesc:"Controlla quali dati Ride raccoglie e come vengono utilizzati.",
    langDesc:"Scegli la lingua visualizzata su tutte le pagine di Ride.",
    themeDesc:"Passa tra tema chiaro e scuro.",
    motionDesc:"Minimizza animazioni e transizioni su tutto il sito.",
    paymentDesc:"Aggiungi o rimuovi carte dal tuo account.",
    transactionDesc:"I tuoi viaggi recenti e addebiti.",
    rideUpdatesLabel:"Aggiornamenti viaggio",
    pushDesc:"Arrivo autista, cambi percorso e completamento viaggio.",
    smsDesc:"Aggiornamenti via SMS per l'ETA dell'autista.",
    remindersLabel:"Promemoria viaggio",
    remindersDesc:"Promemoria 30 minuti prima di un viaggio programmato.",
    receiptDesc:"Riepilogo completo inviato per email dopo ogni viaggio.",
    accountUpdateDesc:"Avvisi di sicurezza e modifiche importanti all'account.",
    promoDesc:"Sconti esclusivi ed eventi stagionali.",
    dataUsageTitle:"Utilizzo dati",
    shareLabel:"Condividi dati viaggio con i partner",
    shareDesc:"Consenti la condivisione di dati anonimi con i partner di trasporto.",
    marketingLabel:"Marketing personalizzato",
    marketingDesc:"Consenti a Ride di usare i tuoi dati per offerte personalizzate.",
    analyticsLabel:"Dati analitici e prestazioni",
    analyticsDesc:"Aiuta a migliorare Ride condividendo metriche di utilizzo anonime.",
    locationLabel:"Posizione precisa",
    locationDesc:"Usa la tua posizione GPS esatta per una migliore precisione di pickup.",
    yourDataTitle:"I tuoi dati",
    yourDataDesc:"Puoi richiedere un'esportazione completa dei tuoi dati personali in qualsiasi momento. Te li invieremo per email entro 48 ore.",
    exportDataBtn:"Richiedi esportazione dati",
    dangerDesc:"Elimina definitivamente il tuo account e tutti i dati associati.",
    twoFaTitle:"Autenticazione a due fattori",
    totpLabel:"App autenticazione (TOTP)",
    totpDesc:"Richiedi un codice temporaneo al login da un nuovo dispositivo.",
    loginAlertLabel:"Avvisi attività di accesso",
    loginAlertDesc:"Invia un'email quando viene rilevato un nuovo accesso.",
    sessionDesc:"Dispositivi attualmente connessi al tuo account.",
    passwordDesc:"Gestisci password, autenticazione a due fattori e sessioni attive.",
    // Landing page
    heroTitle:"Muoviti più veloce. Viaggia meglio.",
    heroSubtitle:"Potenziato dall'IA",
    heroDesc:"Dalle corse in città ai tragitti quotidiani, Ride offre un'esperienza fluida e affidabile, basata su tecnologia moderna e design intuitivo.",
    f1Title:"Il tuo percorso è pronto prima ancora che il traffico decida.",
    f1Text:"Ride traccia il traffico in tempo reale, i pattern di domanda e i dati predittivi per ottimizzare ogni viaggio prima che i ritardi diventino un tuo problema.",
    f2Title:"Il tuo viaggio lascia un'impronta più leggera.",
    f2Text:"Un dispatch più intelligente significa meno veicoli vuoti, meno chilometri sprecati e una città che si muove in modo più pulito — perché il tuo viaggio fa parte di un sistema migliore.",
    f3Title:"Assistenza già pronta quando ne hai bisogno.",
    f3Text:"Prima del pickup, durante il viaggio e dopo l'arrivo — guida AI in tempo reale e aggiornamenti personalizzati ti mantengono in controllo ad ogni passo.",
    f4Title:"Non arrivi soltanto. Fai un ingresso.",
    f4Text:"Supercar e veicoli ad alte prestazioni fanno parte di ogni esperienza Ride — non sono un upgrade. Questo è il trasporto quando è progettato attorno all'identità.",
    howItWorksTitle:"Ogni viaggio, studiato prima ancora di iniziare.",
    howItWorksDesc:"Prenota in pochi secondi. Il sistema si occupa di tutto il resto.",
    step1Title:"Scegli la tua categoria",
    step1Text:"Seleziona il veicolo adatto al tuo stile e alla tua destinazione. Il sistema registra le tue preferenze all'istante.",
    step2Title:"L'AI prepara il percorso",
    step2Text:"Prima che l'auto arrivi, l'AI ha già calcolato percorso, tempi e condizioni stradali. Niente è lasciato al caso.",
    step3Title:"Viaggia senza attrito",
    step3Text:"Il tuo autista arriva puntuale, con il veicolo giusto, sul percorso ottimizzato. Porta a porta, esattamente come pianificato.",
    vehiclesTitle:"Le supercar non sono un extra. Sono parte dell'identità.",
    vehiclesDesc:"Ride nasce attorno al design ad alte prestazioni, al comfort premium e a una presenza che non passa inosservata. Questa è mobilità con carattere vero.",
    v1p:"Handling preciso. Prestazioni per la città.",
    v2p:"Comfort top per viaggi business e first class.",
    v3p:"Raffinatezza senza paragoni. Il silenzio come caratteristica.",
    v4p:"Zero emissioni. Performance totale. Nativo AI.",
    v5p:"La firma Ride. Presenza pura, ogni arrivo.",
    v6p:"Viaggi di gruppo senza compromessi sul lusso.",
    fidelityTitle:"Premi che rendono la mobilità premium ancora più conveniente.",
    fidelityText:"La Carta Fedeltà Ride trasforma ogni viaggio in valore duraturo. Accumula punti, sblocca sconti esclusivi, accedi alle prenotazioni prioritarie e scopri benefit pensati per i viaggiatori premium.",
    benefitItem1:"Accumula punti ad ogni viaggio",
    benefitItem2:"Accesso prioritario nelle ore di punta",
    benefitItem3:"Sconti mensili esclusivi",
    benefitItem4:"Offerte e upgrade riservati ai soci",
    fidGetCard:"Ottieni la tua carta",
    driverTitle:"Trasforma la tua auto in qualcosa che lavora per te.",
    driverText:"Entra nella rete Ride. Scegli i tuoi orari, seleziona le corse e guadagna di più con una piattaforma centrata sulle performance — non solo sulla disponibilità.",
    driverApply:"Candidati come autista",
    driverLearn:"Scopri di più",
    stat1Val:"+40%",
    stat1Label:"Guadagno medio vs. piattaforme standard",
    stat2Val:"Totale libertà",
    stat2Label:"Nessun minimo, nessun programma, nessuna pressione",
    stat3Val:"AI dispatch",
    stat3Label:"Percorsi più intelligenti, meno chilometri a vuoto",
    partnersTrustedBy:"Collaborano con noi",
    footerTagline:"Ride unisce AI, servizio premium e veicoli ad alte prestazioni per ridefinire cosa può essere la mobilità urbana.",
    myDashboard:"La mia Dashboard",
    // Supercar DNA section
    sectionSupercarDNA:"DNA Supercar",
    scdTitle:"Le prestazioni non sono opzionali. Sono il punto di partenza.",
    scdText:"Ogni veicolo Ride è scelto per un solo motivo: deve dare una sensazione unica sulla strada. Da 0 a 100 in meno di quattro secondi. Fibra di carbonio dove l'alluminio sarebbe bastato. Un suono che fa alzare lo sguardo alla città.",
    scdStat1Val:"0→100",
    scdStat1Label:"meno di 4 secondi",
    scdStat2Val:"1.200+",
    scdStat2Label:"cavalli combinati",
    scdStat3Val:"100%",
    scdStat3Label:"flotta selezionata a mano",
    scdBadgeSub:"Flotta performance",
    ctaBook:"Prenota ora",
    rideFidelity:"Fedeltà Ride",
    viewFidelity:"Vedi Fedeltà →",
    ptsToGold:"{n} punti al Gold",
    goldUnlocked:"Gold sbloccato ✦",
    tierStandard:"Standard",
    tierGold:"Gold ✦",
    rideWallet:"Portafoglio Ride",
    addFunds:"Aggiungi fondi",
    noTransactions:"Nessuna transazione",
    fundsAdded:"Fondi aggiunti",
    rideInsights:"Statistiche",
    topDest:"Destinazione top",
    avgFare:"Tariffa media",
    totalDist:"Distanza totale",
    monthRides:"Viaggi questo mese",
    noInsights:"Completa dei viaggi per vedere le statistiche.",
    cancelRideQ:"Annullare il viaggio?",
    keepRide:"Mantieni viaggio",
  },

  fr: {
    home:"Accueil", features:"Fonctionnalités", vehicles:"Véhicules",
    fidelity:"Fidélité", drive:"Conduire avec nous",
    getStarted:"Commencer", bookNow:"Réserver", viewPlans:"Voir les plans", explore:"Explorer",
    signIn:"Se connecter", createAccount:"Créer un compte",
    welcomeBack:"Bon retour", createYourAccount:"Créer votre compte",
    dontHaveAccount:"Pas encore de compte?", signUpFree:"S'inscrire gratuitement",
    alreadyHaveAccount:"Déjà un compte?",
    emailAddress:"Adresse e-mail", password:"Mot de passe",
    firstName:"Prénom", lastName:"Nom",
    confirmPassword:"Confirmer le mot de passe", forgotPassword:"Mot de passe oublié?",
    continueWithGoogle:"Continuer avec Google", continueWithApple:"Continuer avec Apple",
    orContinueWith:"ou", agreeTerms:"J'accepte les",
    termsOfService:"Conditions d'utilisation", andText:"et la",
    privacyPolicy:"Politique de confidentialité",
    bySigningIn:"En vous connectant vous acceptez nos",
    myRides:"Mes trajets", fidelityPoints:"Points fidélité",
    settings:"Paramètres", signOut:"Déconnexion", langLabel:"FR",
    dashTitle:"Tableau de bord", myFidelityTitle:"Ma Fidélité", paymentsTitle:"Paiements",
    myAccountTitle:"Mon Compte", totalRides:"Trajets totaux", spentThisMonth:"Dépensé ce mois",
    fidelityPts:"points disponibles", nextRide:"Prochain Trajet", recentRides:"Trajets récents",
    recentReviews:"Avis récents", spendingOverview:"Aperçu des dépenses",
    noUpcomingRides:"Aucun trajet prévu", bookRide:"Réserver un trajet",
    bookAnother:"Réserver un autre", cancelRide:"Annuler le trajet",
    myFidelityCard:"Ma Carte Fidélité",
    settings:"Paramètres",
    signOut:"Déconnexion",
    cancel:"Annuler",
    addNewCard:"Ajouter une carte",
    cardNumber:"Numéro de carte",
    cardholderName:"Titulaire",
    expiry:"Expiration",
    saveCard:"Enregistrer",
    editInSettings:"Modifier dans Paramètres",
    fidelityTier:"Niveau actuel",
    fidAvailLabel:"Points disponibles", fidLifeLabel:"Total gagné", fidRedeemedLabel:"Échangés",
    memberSince:"Membre depuis",
    paymentMethods2:"Moyens de paiement",
    personalInfo2:"Informations",
    pointsHistory:"Historique",
    spending:"Dépenses",
    upcomingAll:"Voir tout",
    recentReviews:"Avis récents",
    account:"Compte", security:"Sécurité", appearance:"Apparence",
    billing:"Facturation", notifications:"Notifications", logout:"Déconnexion",
    personalInfo:"Informations personnelles",
    updateNameContact:"Gérez vos informations personnelles et votre photo de profil.",
    saveChanges:"Enregistrer", cancel:"Annuler", changePhoto:"Changer la photo",
    phoneNumber:"Numéro de téléphone", city:"Ville",
    changePassword:"Changer le mot de passe", currentPassword:"Mot de passe actuel",
    newPassword:"Nouveau mot de passe", confirmNewPassword:"Confirmer le nouveau mot de passe",
    updatePassword:"Mettre à jour", clear:"Effacer",
    activeSessions:"Sessions actives", dangerZone:"Zone dangereuse",
    deleteAccount:"Supprimer le compte",
    language:"Langue", themeDisplay:"Thème et affichage",
    darkMode:"Mode sombre", reduceMotion:"Réduire les animations",
    saveLanguage:"Enregistrer la langue",
    switchTheme:"Basculer entre thème clair et sombre.",
    minimiseAnimations:"Minimiser les animations.",
    paymentMethods:"Moyens de paiement", transactionHistory:"Historique des transactions",
    addCard:"Ajouter une carte",
    rideUpdates:"Mises à jour du trajet", pushNotifications:"Notifications push",
    smsNotifications:"Notifications SMS", rideReceipts:"Reçus de trajets",
    accountUpdates:"Mises à jour du compte", promotionalOffers:"Offres promotionnelles",
    savePreferences:"Enregistrer les préférences", privacy:"Confidentialité",
    sectionCoreFeatures:"Fonctionnalités clés", sectionHowItWorks:"Comment ça marche",
    sectionOurVehicles:"Nos véhicules", sectionFidelityCard:"Carte Fidélité",
    sectionDriveWithRide:"Conduire avec Ride",
    footerProduct:"Produit", footerCompany:"Entreprise", footerLegal:"Mentions légales",
    footerCopyright:"© 2026 Ride. Tous droits réservés.",
    dpEyebrow:"Gagnez avec Ride",
    dpHeadline:"Conduisez à\nvotre rythme.",
    dpBody:"Horaires flexibles, paiements rapides, support dédié. Rejoignez des milliers de chauffeurs.",
    dpStatHour:"moy/h",
    dpStatApproval:"approbation",
    dpStatFlex:"horaires libres",
    dpStatHourVal:"€18",
    dpStatApprovalVal:"48h",
    dpStatFlexVal:"flex",
    dpCta:"En savoir plus",
    securityDesc:"Gérez votre mot de passe, l'authentification à deux facteurs et les sessions actives.",
    appearanceDesc:"Personnalisez la langue, le thème et les préférences visuelles.",
    billingDesc:"Gérez vos moyens de paiement et consultez l'historique.",
    notificationsDesc:"Contrôlez comment et quand Ride vous contacte.",
    privacyDesc:"Contrôlez les données que Ride collecte et leur utilisation.",
    langDesc:"Choisissez la langue affichée sur toutes les pages Ride.",
    themeDesc:"Basculer entre thème clair et sombre.",
    motionDesc:"Minimiser les animations et transitions sur tout le site.",
    paymentDesc:"Ajoutez ou supprimez des cartes de votre compte.",
    transactionDesc:"Vos trajets récents et charges.",
    rideUpdatesLabel:"Mises à jour du trajet",
    pushDesc:"Arrivée du chauffeur, changements d'itinéraire et fin de trajet.",
    smsDesc:"Mises à jour par SMS pour l'ETA du chauffeur.",
    remindersLabel:"Rappels de trajet",
    remindersDesc:"Rappel 30 minutes avant un trajet planifié.",
    receiptDesc:"Récapitulatif complet envoyé par email après chaque trajet.",
    accountUpdateDesc:"Alertes de sécurité et changements importants du compte.",
    promoDesc:"Réductions exclusives et événements saisonniers.",
    dataUsageTitle:"Utilisation des données",
    shareLabel:"Partager les données de trajet avec les partenaires",
    shareDesc:"Autoriser le partage de données anonymisées avec les partenaires.",
    marketingLabel:"Marketing personnalisé",
    marketingDesc:"Autoriser Ride à utiliser vos données pour des offres personnalisées.",
    analyticsLabel:"Données analytiques et performances",
    analyticsDesc:"Aidez à améliorer Ride en partageant des métriques anonymes.",
    locationLabel:"Localisation précise",
    locationDesc:"Utilisez votre GPS exact pour une meilleure précision de prise en charge.",
    yourDataTitle:"Vos données",
    yourDataDesc:"Vous pouvez demander une exportation complète de vos données à tout moment. Nous vous l'enverrons par email dans les 48 heures.",
    exportDataBtn:"Demander l'exportation des données",
    dangerDesc:"Supprimez définitivement votre compte et toutes les données associées.",
    twoFaTitle:"Authentification à deux facteurs",
    totpLabel:"Application d'authentification (TOTP)",
    totpDesc:"Exiger un code temporel lors de la connexion depuis un nouvel appareil.",
    loginAlertLabel:"Alertes d'activité de connexion",
    loginAlertDesc:"Envoyer un email lorsqu'une nouvelle connexion est détectée.",
    sessionDesc:"Appareils actuellement connectés à votre compte.",
    passwordDesc:"Gérez votre mot de passe, l'authentification à deux facteurs et les sessions actives.",
    // Landing page
    heroTitle:"Bougez plus vite. Roulez mieux.",
    heroSubtitle:"Propulsé par l'IA",
    heroDesc:"Des trajets en ville aux navettes quotidiennes, Ride offre une expérience fluide et fiable grâce à une technologie moderne et un design intuitif.",
    f1Title:"Votre itinéraire est prêt avant même que le trafic décide.",
    f1Text:"Ride exploite les données de trafic en temps réel, les schémas de demande et les prévisions pour optimiser chaque trajet avant que les retards ne deviennent votre problème.",
    f2Title:"Votre trajet laisse une empreinte plus légère.",
    f2Text:"Un dispatch plus intelligent signifie moins de véhicules vides, moins de kilomètres gaspillés et une ville qui circule mieux — car votre trajet fait partie d'un système plus efficient.",
    f3Title:"Un support déjà là quand vous en avez besoin.",
    f3Text:"Avant la prise en charge, pendant le trajet et après l'arrivée — des conseils IA en temps réel et des mises à jour personnalisées vous gardent en contrôle à chaque étape.",
    f4Title:"Vous n'arrivez pas seulement. Vous faites une entrée.",
    f4Text:"Les supercars et les véhicules haute performance font partie de chaque expérience Ride — ce n'est pas une option. C'est le transport quand il est conçu autour de l'identité.",
    howItWorksTitle:"Chaque trajet, préparé avant même de commencer.",
    howItWorksDesc:"Réservez en quelques secondes. Le système s'occupe de tout le reste.",
    step1Title:"Choisissez votre catégorie",
    step1Text:"Sélectionnez le véhicule adapté à votre style et destination. Le système enregistre vos préférences instantanément.",
    step2Title:"L'IA prépare l'itinéraire",
    step2Text:"Avant que la voiture arrive, l'IA a déjà résolu l'itinéraire, le timing et les conditions. Rien n'est laissé au hasard.",
    step3Title:"Voyagez sans friction",
    step3Text:"Votre chauffeur arrive à l'heure, dans la bonne voiture, sur le trajet optimisé. De porte à porte, exactement comme prévu.",
    vehiclesTitle:"Les supercars ne sont pas un extra. Elles font partie de l'identité.",
    vehiclesDesc:"Ride est conçu autour du design haute performance, du confort premium et d'une présence inoubliable. C'est la mobilité avec un vrai caractère.",
    v1p:"Handling précis. Performance urbaine.",
    v2p:"Confort de première classe pour les voyages d'affaires.",
    v3p:"Raffinement inégalé. Le silence comme caractéristique.",
    v4p:"Zéro émissions. Performance totale. Natif IA.",
    v5p:"La signature Ride. Présence brute, chaque arrivée.",
    v6p:"Voyages en groupe sans compromis sur le luxe.",
    fidelityTitle:"Des récompenses qui font de la mobilité premium une évidence.",
    fidelityText:"La Carte Fidélité Ride transforme chaque trajet en valeur durable. Cumulez des points, débloquez des réductions exclusives et accédez aux réservations prioritaires.",
    benefitItem1:"Cumulez des points à chaque trajet",
    benefitItem2:"Accès prioritaire aux heures de pointe",
    benefitItem3:"Réductions mensuelles exclusives",
    benefitItem4:"Offres et upgrades réservés aux membres",
    fidGetCard:"Obtenir ma carte",
    driverTitle:"Transformez votre voiture en quelque chose qui travaille pour vous.",
    driverText:"Rejoignez le réseau Ride. Fixez vos horaires, choisissez vos trajets et gagnez plus avec une plateforme axée sur la performance.",
    driverApply:"Postuler comme chauffeur",
    driverLearn:"En savoir plus",
    stat1Val:"+40%",
    stat1Label:"Revenus moyens vs. plateformes standard",
    stat2Val:"Flexibilité totale",
    stat2Label:"Pas de minimums, pas d'horaires, pas de pression",
    stat3Val:"IA dispatch",
    stat3Label:"Des itinéraires plus intelligents, moins de kilomètres à vide",
    partnersTrustedBy:"Ils nous font confiance",
    footerTagline:"Ride fusionne IA, service premium et véhicules haute performance pour redéfinir la mobilité urbaine.",
    myDashboard:"Mon tableau de bord",
    // Supercar DNA section
    sectionSupercarDNA:"ADN Supercar",
    scdTitle:"La performance n'est pas une option. C'est la base.",
    scdText:"Chaque véhicule Ride est choisi pour une seule raison : il doit donner une sensation unique sur la route. De 0 à 100 en moins de quatre secondes. Fibre de carbone là où l'aluminium aurait suffi. Un son qui fait lever la tête dans toute la ville.",
    scdStat1Val:"0→100",
    scdStat1Label:"moins de 4 secondes",
    scdStat2Val:"1 200+",
    scdStat2Label:"chevaux combinés",
    scdStat3Val:"100%",
    scdStat3Label:"flotte sélectionnée à la main",
    scdBadgeSub:"Flotte performance",
    ctaBook:"Réserver",
    rideFidelity:"Fidélité Ride", viewFidelity:"Voir Fidélité →",
    ptsToGold:"{n} pts vers Gold", goldUnlocked:"Gold débloqué ✦",
    tierStandard:"Standard", tierGold:"Gold ✦",
    rideWallet:"Portefeuille Ride", addFunds:"Ajouter des fonds",
    noTransactions:"Aucune transaction", fundsAdded:"Fonds ajoutés",
    rideInsights:"Statistiques", topDest:"Destination principale",
    avgFare:"Tarif moyen", totalDist:"Distance totale",
    monthRides:"Trajets ce mois", noInsights:"Effectuez des trajets pour voir vos statistiques.",
    cancelRideQ:"Annuler ce trajet ?", keepRide:"Garder le trajet",
  },

  es: {
    home:"Inicio", features:"Características", vehicles:"Vehículos",
    fidelity:"Fidelidad", drive:"Conducir con nosotros",
    getStarted:"Comenzar", bookNow:"Reservar ahora", viewPlans:"Ver planes", explore:"Explorar",
    signIn:"Iniciar sesión", createAccount:"Crear cuenta",
    welcomeBack:"Bienvenido de nuevo", createYourAccount:"Crea tu cuenta",
    dontHaveAccount:"¿No tienes cuenta?", signUpFree:"Regístrate gratis",
    alreadyHaveAccount:"¿Ya tienes cuenta?",
    emailAddress:"Correo electrónico", password:"Contraseña",
    firstName:"Nombre", lastName:"Apellido",
    confirmPassword:"Confirmar contraseña", forgotPassword:"¿Olvidaste tu contraseña?",
    continueWithGoogle:"Continuar con Google", continueWithApple:"Continuar con Apple",
    orContinueWith:"o", agreeTerms:"Acepto los",
    termsOfService:"Términos de servicio", andText:"y la",
    privacyPolicy:"Política de privacidad",
    bySigningIn:"Al iniciar sesión aceptas nuestros",
    myRides:"Mis viajes", fidelityPoints:"Puntos de fidelidad",
    settings:"Configuración", signOut:"Cerrar sesión", langLabel:"ES",
    dashTitle:"Panel", myFidelityTitle:"Mi Fidelidad", paymentsTitle:"Pagos",
    myAccountTitle:"Mi Cuenta", totalRides:"Viajes totales", spentThisMonth:"Gastado este mes",
    fidelityPts:"puntos disponibles", nextRide:"Próximo Viaje", recentRides:"Viajes recientes",
    recentReviews:"Reseñas recientes", spendingOverview:"Resumen de gastos",
    noUpcomingRides:"Sin viajes programados", bookRide:"Reservar un viaje",
    bookAnother:"Reservar otro", cancelRide:"Cancelar viaje",
    myFidelityCard:"Mi Tarjeta Fidelidad",
    settings:"Configuración",
    signOut:"Cerrar sesión",
    cancel:"Cancelar",
    addNewCard:"Añadir tarjeta",
    cardNumber:"Número de tarjeta",
    cardholderName:"Titular",
    expiry:"Caducidad",
    saveCard:"Guardar",
    editInSettings:"Editar en Configuración",
    fidelityTier:"Nivel actual",
    fidAvailLabel:"Puntos disponibles", fidLifeLabel:"Total ganado", fidRedeemedLabel:"Canjeados",
    memberSince:"Miembro desde",
    paymentMethods2:"Métodos de pago",
    personalInfo2:"Información",
    pointsHistory:"Historial",
    spending:"Gastos",
    upcomingAll:"Ver todo",
    recentReviews:"Reseñas recientes",
    account:"Cuenta", security:"Seguridad", appearance:"Apariencia",
    billing:"Facturación", notifications:"Notificaciones", logout:"Cerrar sesión",
    personalInfo:"Información personal",
    updateNameContact:"Gestiona tu información personal y foto de perfil.",
    saveChanges:"Guardar cambios", cancel:"Cancelar", changePhoto:"Cambiar foto",
    phoneNumber:"Número de teléfono", city:"Ciudad",
    changePassword:"Cambiar contraseña", currentPassword:"Contraseña actual",
    newPassword:"Nueva contraseña", confirmNewPassword:"Confirmar nueva contraseña",
    updatePassword:"Actualizar contraseña", clear:"Limpiar",
    activeSessions:"Sesiones activas", dangerZone:"Zona de peligro",
    deleteAccount:"Eliminar cuenta",
    language:"Idioma", themeDisplay:"Tema y pantalla",
    darkMode:"Modo oscuro", reduceMotion:"Reducir animaciones",
    saveLanguage:"Guardar idioma",
    switchTheme:"Cambiar entre tema claro y oscuro.",
    minimiseAnimations:"Minimizar animaciones.",
    paymentMethods:"Métodos de pago", transactionHistory:"Historial de transacciones",
    addCard:"Añadir tarjeta",
    rideUpdates:"Actualizaciones de viaje", pushNotifications:"Notificaciones push",
    smsNotifications:"Notificaciones SMS", rideReceipts:"Recibos de viaje",
    accountUpdates:"Actualizaciones de cuenta", promotionalOffers:"Ofertas promocionales",
    savePreferences:"Guardar preferencias", privacy:"Privacidad",
    sectionCoreFeatures:"Características clave", sectionHowItWorks:"Cómo funciona",
    sectionOurVehicles:"Nuestros vehículos", sectionFidelityCard:"Tarjeta Fidelidad",
    sectionDriveWithRide:"Conduce con Ride",
    footerProduct:"Producto", footerCompany:"Empresa", footerLegal:"Legal",
    footerCopyright:"© 2026 Ride. Todos los derechos reservados.",
    dpEyebrow:"Gana con Ride",
    dpHeadline:"Conduce cuando\nquieras.",
    dpBody:"Horarios flexibles, pagos rápidos, soporte dedicado. Únete a miles de conductores.",
    dpStatHour:"media/h",
    dpStatApproval:"aprobación",
    dpStatFlex:"horario libre",
    dpStatHourVal:"€18",
    dpStatApprovalVal:"48h",
    dpStatFlexVal:"flex",
    dpCta:"Saber más",
    securityDesc:"Gestiona tu contraseña, autenticación de dos factores y sesiones activas.",
    appearanceDesc:"Personaliza idioma, tema y preferencias visuales en todas las páginas.",
    billingDesc:"Gestiona tus métodos de pago y consulta el historial de transacciones.",
    notificationsDesc:"Controla cómo y cuándo Ride te contacta.",
    privacyDesc:"Controla qué datos recopila Ride y cómo se utilizan.",
    langDesc:"Elige el idioma que se muestra en todas las páginas de Ride.",
    themeDesc:"Cambiar entre tema claro y oscuro.",
    motionDesc:"Minimizar animaciones y transiciones en todo el sitio.",
    paymentDesc:"Añade o elimina tarjetas de tu cuenta.",
    transactionDesc:"Tus viajes recientes y cargos.",
    rideUpdatesLabel:"Actualizaciones de viaje",
    pushDesc:"Llegada del conductor, cambios de ruta y finalización del viaje.",
    smsDesc:"Actualizaciones por SMS para el ETA del conductor.",
    remindersLabel:"Recordatorios de viaje",
    remindersDesc:"Recordatorio 30 minutos antes de un viaje programado.",
    receiptDesc:"Resumen completo enviado por email después de cada viaje.",
    accountUpdateDesc:"Alertas de seguridad y cambios importantes de la cuenta.",
    promoDesc:"Descuentos exclusivos y eventos de temporada.",
    dataUsageTitle:"Uso de datos",
    shareLabel:"Compartir datos de viaje con socios",
    shareDesc:"Permitir que datos de viaje anonimizados se compartan con socios de transporte.",
    marketingLabel:"Marketing personalizado",
    marketingDesc:"Permitir que Ride use tus datos para ofertas personalizadas.",
    analyticsLabel:"Datos analíticos y rendimiento",
    analyticsDesc:"Ayuda a mejorar Ride compartiendo métricas de uso anónimas.",
    locationLabel:"Ubicación precisa",
    locationDesc:"Usa tu GPS exacto para mayor precisión en la recogida.",
    yourDataTitle:"Tus datos",
    yourDataDesc:"Puedes solicitar una exportación completa de tus datos en cualquier momento. Te los enviaremos por email en 48 horas.",
    exportDataBtn:"Solicitar exportación de datos",
    dangerDesc:"Elimina permanentemente tu cuenta y todos los datos asociados.",
    twoFaTitle:"Autenticación de dos factores",
    totpLabel:"Aplicación de autenticación (TOTP)",
    totpDesc:"Requerir un código temporal al iniciar sesión desde un nuevo dispositivo.",
    loginAlertLabel:"Alertas de actividad de inicio de sesión",
    loginAlertDesc:"Enviar un email cuando se detecte un nuevo inicio de sesión.",
    sessionDesc:"Dispositivos actualmente conectados a tu cuenta.",
    passwordDesc:"Gestiona tu contraseña, autenticación de dos factores y sesiones activas.",
    // Landing page
    heroTitle:"Muévete más rápido. Viaja mejor.",
    heroSubtitle:"Impulsado por IA",
    heroDesc:"Desde viajes rápidos por la ciudad hasta desplazamientos diarios, Ride ofrece una experiencia fluida y confiable impulsada por tecnología moderna y diseño intuitivo.",
    f1Title:"Tu ruta está lista antes de que el tráfico decida.",
    f1Text:"Ride usa datos de tráfico en tiempo real, patrones de demanda e inteligencia predictiva para optimizar cada viaje antes de que los retrasos sean tu problema.",
    f2Title:"Tu viaje deja una huella más ligera.",
    f2Text:"Un dispatch más inteligente significa menos vehículos vacíos, menos kilómetros desperdiciados y una ciudad que se mueve más limpia — porque tu viaje forma parte de un sistema mejor.",
    f3Title:"Asistencia ya disponible cuando la necesitas.",
    f3Text:"Antes de la recogida, durante el viaje y después de la llegada — guía IA en tiempo real y actualizaciones personalizadas te mantienen en control en cada paso.",
    f4Title:"No solo llegas. Haces una entrada.",
    f4Text:"Los supercars y los vehículos de alto rendimiento son parte de cada experiencia Ride — no son una opción. Esto es el transporte cuando está diseñado en torno a la identidad.",
    howItWorksTitle:"Cada viaje, preparado antes de empezar.",
    howItWorksDesc:"Reserva en segundos. El sistema se encarga del resto.",
    step1Title:"Elige tu categoría",
    step1Text:"Selecciona el vehículo que se adapta a tu estilo y destino. El sistema registra tus preferencias al instante.",
    step2Title:"La IA prepara la ruta",
    step2Text:"Antes de que llegue el coche, la IA ya ha calculado la ruta, el tiempo y las condiciones. Nada queda al azar.",
    step3Title:"Viaja sin fricción",
    step3Text:"Tu conductor llega a tiempo, en el coche correcto, por la ruta optimizada. De puerta a puerta, exactamente como se planeó.",
    vehiclesTitle:"Los supercars no son un extra. Son parte de la identidad.",
    vehiclesDesc:"Ride está construido alrededor del diseño de alto rendimiento, el confort premium y una presencia que no pasa desapercibida. Esto es movilidad con carácter real.",
    v1p:"Manejo preciso. Rendimiento para la ciudad.",
    v2p:"Confort de primera clase para viajes de negocios.",
    v3p:"Refinamiento inigualable. El silencio como característica.",
    v4p:"Cero emisiones. Rendimiento total. Nativo IA.",
    v5p:"La firma Ride. Presencia pura, cada llegada.",
    v6p:"Viajes en grupo sin compromisos en lujo.",
    fidelityTitle:"Recompensas que hacen que la movilidad premium valga la pena.",
    fidelityText:"La Tarjeta Fidelidad Ride convierte cada viaje en valor duradero. Acumula puntos, desbloquea descuentos exclusivos y accede a reservas prioritarias.",
    benefitItem1:"Acumula puntos en cada viaje",
    benefitItem2:"Acceso prioritario en horas punta",
    benefitItem3:"Descuentos mensuales exclusivos",
    benefitItem4:"Ofertas y upgrades solo para miembros",
    fidGetCard:"Obtener mi tarjeta",
    driverTitle:"Convierte tu coche en algo que trabaje para ti.",
    driverText:"Únete a la red de conductores Ride. Fija tus horarios, elige tus viajes y gana más con una plataforma centrada en el rendimiento.",
    driverApply:"Solicitar ser conductor",
    driverLearn:"Saber más",
    stat1Val:"+40%",
    stat1Label:"Ganancias medias vs. plataformas estándar",
    stat2Val:"Flexibilidad total",
    stat2Label:"Sin mínimos, sin horarios, sin presión",
    stat3Val:"IA dispatch",
    stat3Label:"Rutas más inteligentes, menos kilómetros vacíos",
    partnersTrustedBy:"Confían en nosotros",
    footerTagline:"Ride fusiona IA, servicio premium y vehículos de alto rendimiento para redefinir la movilidad urbana.",
    myDashboard:"Mi panel",
    // Supercar DNA section
    sectionSupercarDNA:"ADN Supercar",
    scdTitle:"El rendimiento no es opcional. Es el punto de partida.",
    scdText:"Cada vehículo Ride se elige por una sola razón: tiene que sentirse único en la carretera. De 0 a 100 en menos de cuatro segundos. Fibra de carbono donde el aluminio habría bastado. Un sonido que hace mirar a toda la ciudad.",
    scdStat1Val:"0→100",
    scdStat1Label:"menos de 4 segundos",
    scdStat2Val:"1.200+",
    scdStat2Label:"caballos combinados",
    scdStat3Val:"100%",
    scdStat3Label:"flota seleccionada a mano",
    scdBadgeSub:"Flota de alto rendimiento",
    ctaBook:"Reservar",
    rideFidelity:"Fidelidad Ride", viewFidelity:"Ver Fidelidad →",
    ptsToGold:"{n} pts para Gold", goldUnlocked:"Gold desbloqueado ✦",
    tierStandard:"Estándar", tierGold:"Gold ✦",
    rideWallet:"Cartera Ride", addFunds:"Añadir fondos",
    noTransactions:"Sin transacciones", fundsAdded:"Fondos añadidos",
    rideInsights:"Estadísticas", topDest:"Destino principal",
    avgFare:"Tarifa media", totalDist:"Distancia total",
    monthRides:"Viajes este mes", noInsights:"Completa viajes para ver las estadísticas.",
    cancelRideQ:"¿Cancelar este viaje?", keepRide:"Mantener viaje",
  },

  zh: {
    home:"首页", features:"功能", vehicles:"车辆",
    fidelity:"忠诚度", drive:"与我们一起驾驶",
    getStarted:"立即开始", bookNow:"立即预订", viewPlans:"查看方案", explore:"探索",
    signIn:"登录", createAccount:"创建账户",
    welcomeBack:"欢迎回来", createYourAccount:"创建您的账户",
    dontHaveAccount:"没有账户？", signUpFree:"免费注册",
    alreadyHaveAccount:"已有账户？",
    emailAddress:"电子邮箱", password:"密码",
    firstName:"名", lastName:"姓",
    confirmPassword:"确认密码", forgotPassword:"忘记密码？",
    continueWithGoogle:"使用 Google 继续", continueWithApple:"使用 Apple 继续",
    orContinueWith:"或", agreeTerms:"我同意",
    termsOfService:"服务条款", andText:"和",
    privacyPolicy:"隐私政策", bySigningIn:"登录即表示您同意我们的",
    myRides:"我的行程", fidelityPoints:"忠诚积分",
    settings:"设置", signOut:"退出登录", langLabel:"ZH",
    dashTitle:"仪表板", myFidelityTitle:"我的积分", paymentsTitle:"支付",
    myAccountTitle:"我的账户", totalRides:"总行程", spentThisMonth:"本月消费",
    fidelityPts:"可用积分", nextRide:"下次行程", recentRides:"最近行程",
    recentReviews:"最近评价", spendingOverview:"消费概览",
    noUpcomingRides:"暂无预约行程", bookRide:"预约行程",
    bookAnother:"再次预约", cancelRide:"取消行程",
    myFidelityCard:"我的积分卡",
    settings:"设置",
    signOut:"退出登录",
    cancel:"取消",
    addNewCard:"添加卡片",
    cardNumber:"卡号",
    cardholderName:"持卡人",
    expiry:"有效期",
    saveCard:"保存",
    editInSettings:"在设置中编辑",
    fidelityTier:"当前等级",
    fidAvailLabel:"可用积分", fidLifeLabel:"累计获得", fidRedeemedLabel:"已兑换",
    memberSince:"会员自",
    paymentMethods2:"支付方式",
    personalInfo2:"个人信息",
    pointsHistory:"积分记录",
    spending:"消费",
    upcomingAll:"查看全部",
    recentReviews:"最近评价",
    account:"账户", security:"安全", appearance:"外观",
    billing:"账单", notifications:"通知", logout:"退出登录",
    personalInfo:"个人信息",
    updateNameContact:"管理您的个人信息和头像。",
    saveChanges:"保存更改", cancel:"取消", changePhoto:"更换照片",
    phoneNumber:"电话号码", city:"城市",
    changePassword:"修改密码", currentPassword:"当前密码",
    newPassword:"新密码", confirmNewPassword:"确认新密码",
    updatePassword:"更新密码", clear:"清除",
    activeSessions:"活跃会话", dangerZone:"危险区域",
    deleteAccount:"删除账户",
    language:"语言", themeDisplay:"主题与显示",
    darkMode:"深色模式", reduceMotion:"减少动画",
    saveLanguage:"保存语言",
    switchTheme:"在浅色和深色界面之间切换。",
    minimiseAnimations:"最小化全站动画和过渡效果。",
    paymentMethods:"支付方式", transactionHistory:"交易记录",
    addCard:"添加卡片",
    rideUpdates:"行程更新", pushNotifications:"推送通知",
    smsNotifications:"短信通知", rideReceipts:"行程收据",
    accountUpdates:"账户更新", promotionalOffers:"促销优惠",
    savePreferences:"保存偏好", privacy:"隐私",
    sectionCoreFeatures:"核心功能", sectionHowItWorks:"使用方式",
    sectionOurVehicles:"我们的车辆", sectionFidelityCard:"忠诚卡",
    sectionDriveWithRide:"加入 Ride 驾驶",
    footerProduct:"产品", footerCompany:"公司", footerLegal:"法律",
    footerCopyright:"© 2026 Ride. 保留所有权利。",
    dpEyebrow:"与 Ride 一起赚钱",
    dpHeadline:"按您的\n条件驾驶。",
    dpBody:"灵活工时，快速付款，专属支持。加入全国数千名司机。",
    dpStatHour:"均/时",
    dpStatApproval:"审核",
    dpStatFlex:"灵活",
    dpStatHourVal:"€18",
    dpStatApprovalVal:"48小时",
    dpStatFlexVal:"弹性",
    dpCta:"了解更多",
    securityDesc:"管理密码、双重身份验证和活跃会话。",
    appearanceDesc:"自定义语言、主题和所有页面的视觉偏好。",
    billingDesc:"管理付款方式并查看交易历史。",
    notificationsDesc:"控制 Ride 联系您的方式和时间。",
    privacyDesc:"控制 Ride 收集的数据及其使用方式。",
    langDesc:"选择所有 Ride 页面上显示的语言。",
    themeDesc:"在浅色和深色界面之间切换。",
    motionDesc:"最小化全站动画和过渡效果。",
    paymentDesc:"从您的账户添加或删除卡片。",
    transactionDesc:"您最近的行程和费用。",
    rideUpdatesLabel:"行程更新",
    pushDesc:"司机到达、路线变更和行程完成通知。",
    smsDesc:"司机预计到达时间的短信更新。",
    remindersLabel:"行程提醒",
    remindersDesc:"预定行程前30分钟的提醒。",
    receiptDesc:"每次行程后通过电子邮件发送完整明细。",
    accountUpdateDesc:"安全警报和重要账户变更。",
    promoDesc:"专属折扣和季节性活动。",
    dataUsageTitle:"数据使用",
    shareLabel:"与合作伙伴共享行程数据",
    shareDesc:"允许与交通合作伙伴共享匿名行程数据。",
    marketingLabel:"个性化营销",
    marketingDesc:"允许 Ride 使用您的数据提供个性化优惠。",
    analyticsLabel:"分析与性能数据",
    analyticsDesc:"通过共享匿名使用指标帮助改善 Ride。",
    locationLabel:"精确位置",
    locationDesc:"使用您的精确 GPS 位置以获得更好的接送精度。",
    yourDataTitle:"您的数据",
    yourDataDesc:"您可以随时申请完整的个人数据导出。我们将在48小时内通过电子邮件发送给您。",
    exportDataBtn:"申请数据导出",
    dangerDesc:"永久删除您的账户和所有相关数据。",
    twoFaTitle:"双重身份验证",
    totpLabel:"身份验证器应用 (TOTP)",
    totpDesc:"从新设备登录时需要时间码。",
    loginAlertLabel:"登录活动警报",
    loginAlertDesc:"检测到新登录时发送电子邮件。",
    sessionDesc:"当前登录到您账户的设备。",
    passwordDesc:"管理密码、双重身份验证和活跃会话。",
    // Landing page
    heroTitle:"更快出行，更智慧驾乘。",
    heroSubtitle:"由人工智能驱动",
    heroDesc:"无论是城市快捷出行还是日常通勤，Ride 都能通过现代技术和直觉设计，为您提供流畅可靠的体验。",
    f1Title:"您的路线在交通开口前已经准备好。",
    f1Text:"Ride 利用实时交通数据、需求规律和预测智能，在延误成为您的问题之前优化每条路线。",
    f2Title:"您的出行留下更轻的足迹。",
    f2Text:"更智能的调度意味着更少的空驶车辆、更少的浪费里程，以及一个运转更清洁的城市——因为您的行程是更好系统的一部分。",
    f3Title:"需要时支持已在等候。",
    f3Text:"上车前、行程中、下车后——实时 AI 引导和个性化更新让您在每一步都保持掌控。",
    f4Title:"您不只是到达，而是登场。",
    f4Text:"超跑和高性能车辆是每次 Ride 体验的一部分——不是升级选项。这就是出行围绕身份感而设计时的样子。",
    howItWorksTitle:"每次行程，在出发前就已准备完毕。",
    howItWorksDesc:"几秒内完成预订，系统处理好其他一切。",
    step1Title:"选择您的级别",
    step1Text:"选择适合您风格和目的地的车辆。系统立即记录您的偏好。",
    step2Title:"AI 规划路线",
    step2Text:"在车辆到达之前，AI 已经解决了路线、时间和道路状况。没有任何事情留给偶然。",
    step3Title:"无摩擦出行",
    step3Text:"您的司机准时到达，驾驶合适的车辆，走优化路线。从门到门，一切按计划进行。",
    vehiclesTitle:"超跑不是附加功能，而是品牌身份的一部分。",
    vehiclesDesc:"Ride 以高性能设计、顶级舒适度和令人难忘的气场为核心。这是真正有个性的出行。",
    v1p:"精准操控，城市性能。",
    v2p:"商务和头等舱旅行的旗舰舒适。",
    v3p:"无与伦比的精致。以寂静为特色。",
    v4p:"零排放。全性能。AI原生。",
    v5p:"Ride 标志。纯粹气场，每次到达。",
    v6p:"团队出行，奢华不妥协。",
    fidelityTitle:"让高端出行值得重复的奖励。",
    fidelityText:"Ride 忠诚卡将每次旅程转化为长期价值。积累积分，解锁专属折扣，享受优先预订和专为高频优质乘客设计的权益。",
    benefitItem1:"每次出行积累积分",
    benefitItem2:"高峰期优先通道",
    benefitItem3:"专属月度折扣",
    benefitItem4:"会员专属优惠和升级",
    fidGetCard:"获取我的卡",
    driverTitle:"让您的车为您工作。",
    driverText:"加入 Ride 司机网络。设定您的时间，选择您的行程，通过一个以绩效为核心的平台赚取更多。",
    driverApply:"申请成为司机",
    driverLearn:"了解更多",
    stat1Val:"+40%",
    stat1Label:"与标准平台相比的平均收入",
    stat2Val:"完全灵活",
    stat2Label:"无最低要求，无时间表，无压力",
    stat3Val:"AI 调度",
    stat3Label:"更智能的路线，更少的空驶里程",
    partnersTrustedBy:"合作伙伴",
    footerTagline:"Ride 将 AI、优质服务和高性能车辆融为一体，重新定义城市出行。",
    myDashboard:"我的控制台",
    // Supercar DNA section
    sectionSupercarDNA:"超跑基因",
    scdTitle:"性能不是选项，而是起点。",
    scdText:"每辆 Ride 车辆只为一个理由而选择：它必须让人感受到路上无可替代的存在。0 到 100 不到四秒。碳纤维用在铝就够的地方。那种让整座城市为之侧目的声浪。",
    scdStat1Val:"0→100",
    scdStat1Label:"不足 4 秒",
    scdStat2Val:"1,200+",
    scdStat2Label:"综合马力",
    scdStat3Val:"100%",
    scdStat3Label:"精心挑选车队",
    scdBadgeSub:"性能车队",
    ctaBook:"立即预订",
    rideFidelity:"乘车忠诚度", viewFidelity:"查看忠诚度 →",
    ptsToGold:"{n} 积分升Gold", goldUnlocked:"Gold 已解锁 ✦",
    tierStandard:"标准", tierGold:"Gold ✦",
    rideWallet:"乘车钱包", addFunds:"充值",
    noTransactions:"暂无交易记录", fundsAdded:"充值成功",
    rideInsights:"行程统计", topDest:"最常去目的地",
    avgFare:"平均费用", totalDist:"总里程",
    monthRides:"本月行程", noInsights:"完成行程后查看统计数据。",
    cancelRideQ:"取消此行程？", keepRide:"保留行程",
  }
};

/* ── LANG ─────────────────────────────────────────────────────────── */
const Lang = {
  // Default: Italian. Detect from browser only if no stored pref.
  _detect() {
    const nav = (navigator.language || navigator.userLanguage || "it").toLowerCase();
    if (nav.startsWith("fr")) return "fr";
    if (nav.startsWith("es")) return "es";
    if (nav.startsWith("zh")) return "zh";
    if (nav.startsWith("en")) return "en";
    return "it"; // Italian as default
  },
  // Cookie helpers (for guest users without an account)
  _getCookie() {
    const m = document.cookie.match(/(?:^|;\s*)ride_lang=([^;]+)/);
    return m ? m[1] : null;
  },
  _setCookie(l) {
    // 1-year cookie, SameSite=Lax, no Secure flag needed for local
    const exp = new Date(Date.now() + 365*24*60*60*1000).toUTCString();
    document.cookie = `ride_lang=${l};expires=${exp};path=/;SameSite=Lax`;
  },
  get() {
    // Priority: 1) localStorage (set by logged-in user), 2) cookie (guest), 3) detect
    return localStorage.getItem("ride_lang") || this._getCookie() || this._detect();
  },
  set(l) {
    // Always write both so it persists across login/logout transitions
    localStorage.setItem("ride_lang", l);
    this._setCookie(l);
  },
  t(key) { return (LANGS[this.get()] || LANGS.en)[key] || key; },
  apply() {
    const t = LANGS[this.get()] || LANGS.en;
    // data-i18n (standard key)
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const v = t[el.dataset.i18n]; if (v != null) el.textContent = v;
    });
    // data-i18n-key (used on index.html sections)
    document.querySelectorAll("[data-i18n-key]").forEach(el => {
      const v = t[el.dataset.i18nKey];
      if (v == null) return;
      const svgs = [...el.querySelectorAll("svg")];
      el.textContent = v;
      svgs.forEach(s => el.insertBefore(s, el.firstChild));
    });
    // placeholders
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const v = t[el.dataset.i18nPlaceholder]; if (v != null) el.placeholder = v;
    });
    // aria-label
    document.querySelectorAll("[data-i18n-aria]").forEach(el => {
      const v = t[el.dataset.i18nAria]; if (v != null) el.setAttribute("aria-label", v);
    });
    document.querySelectorAll(".lang-label").forEach(el => {
      el.textContent = t.langLabel || this.get().toUpperCase();
    });
    document.documentElement.lang = this.get();

    // Update driver promo card if present
    _applyDriverPromo(t);

    // Update settings panel descriptions if present
    _applySettingsDescriptions(t);
  }
};

function _applyDriverPromo(t) {
  const eyebrow  = document.querySelector(".dp-eyebrow");
  const headline = document.querySelector(".dp-headline");
  const body     = document.querySelector(".dp-body");
  const label    = document.querySelector(".dp-label");

  if (eyebrow && t.dpEyebrow) {
    // preserve the SVG icon inside eyebrow
    const svg = eyebrow.querySelector("svg");
    eyebrow.textContent = t.dpEyebrow;
    if (svg) eyebrow.insertBefore(svg, eyebrow.firstChild);
  }
  if (headline && t.dpHeadline) {
    // Safe: escape the translation value first, then restore only the
    // intentional line-break tag. Translation strings are trusted static
    // data but we escape anyway for defence-in-depth.
    headline.innerHTML = esc(t.dpHeadline).replace("\n", "<br>");
  }
  if (body && t.dpBody) {
    body.textContent = t.dpBody;
  }
  if (label && t.dpCta) {
    label.textContent = t.dpCta;
  }

  // Stats
  const statVals  = document.querySelectorAll(".dp-stat-val");
  const statLbls  = document.querySelectorAll(".dp-stat-lbl");
  const valKeys   = ["dpStatHourVal", "dpStatApprovalVal", "dpStatFlexVal"];
  const lblKeys   = ["dpStatHour", "dpStatApproval", "dpStatFlex"];
  statVals.forEach((el, i) => { if (t[valKeys[i]]) el.textContent = t[valKeys[i]]; });
  statLbls.forEach((el, i) => { if (t[lblKeys[i]]) el.textContent = t[lblKeys[i]]; });
}

function _applySettingsDescriptions(t) {
  // Panel header descriptions — use data-i18n-desc attribute if present
  const descMap = {
    "p-account":       "updateNameContact",
    "p-security":      "securityDesc",
    "p-appearance":    "appearanceDesc",
    "p-billing":       "billingDesc",
    "p-notifications": "notificationsDesc",
    "p-privacy":       "privacyDesc",
  };
  Object.entries(descMap).forEach(([panelId, key]) => {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const desc = panel.querySelector(".panel-header p");
    if (desc && t[key]) desc.textContent = t[key];
  });

  // Dynamic text nodes with data-i18n already handled above.
  // Extra card-sub / tog-desc elements that need runtime update:
  const extraMap = [
    [".card-sub[data-i18n-key='langDesc']",        "langDesc"],
    [".tog-desc[data-i18n-key='themeDesc']",       "themeDesc"],
    [".tog-desc[data-i18n-key='motionDesc']",      "motionDesc"],
    [".card-sub[data-i18n-key='paymentDesc']",     "paymentDesc"],
    [".card-sub[data-i18n-key='transactionDesc']", "transactionDesc"],
  ];
  extraMap.forEach(([sel, key]) => {
    document.querySelectorAll(sel).forEach(el => { if (t[key]) el.textContent = t[key]; });
  });
}

/* ── THEME ────────────────────────────────────────────────────────── */
const Theme = {
  // Default to dark mode; only follow system if user has an explicit stored preference
  _detect() {
    return "dark";
  },
  _getCookie() {
    const m = document.cookie.match(/(?:^|;\s*)ride_theme=([^;]+)/);
    return m ? m[1] : null;
  },
  _setCookie(t) {
    const exp = new Date(Date.now() + 365*24*60*60*1000).toUTCString();
    document.cookie = `ride_theme=${t};expires=${exp};path=/;SameSite=Lax`;
  },
  get()  {
    return localStorage.getItem("ride_theme") || this._getCookie() || this._detect();
  },
  set(t) {
    localStorage.setItem("ride_theme", t);
    this._setCookie(t);
  },

  apply() {
    const t = this.get();
    document.documentElement.setAttribute("data-theme", t);

    document.querySelectorAll(".theme-toggle-input").forEach(inp => {
      inp.checked = (t === "dark");
    });

    document.querySelectorAll(".theme-toggle-btn, .auth-theme-btn").forEach(btn => {
      const d = btn.querySelector(".icon-dark");
      const l = btn.querySelector(".icon-light");
      if (d) d.style.display = (t === "light") ? "none"  : "block";
      if (l) l.style.display = (t === "light") ? "block" : "none";
    });

  },

  toggle() { this.set(this.get() === "dark" ? "light" : "dark"); this.apply(); },

  /** Call once per page to fix bfcache restores and cross-tab theme sync */
  watch() {
    // Re-apply when browser restores page from back/forward cache
    window.addEventListener("pageshow", (e) => { if (e.persisted) this.apply(); });
    // Re-apply when theme is changed in another tab or page
    window.addEventListener("storage", (e) => { if (e.key === "ride_theme") this.apply(); });
  }
};

/* ── REDUCE MOTION ────────────────────────────────────────────────── */
const Motion = {
  // Default: OFF (false). Only activated when user explicitly enables it in settings.
  get() {
    const s = localStorage.getItem("ride_reduce_motion");
    return s === "true"; // never auto-detect — default is always false
  },
  set(v) { localStorage.setItem("ride_reduce_motion", String(v)); },
  apply() {
    document.documentElement.classList.toggle("reduce-motion", this.get());
    document.querySelectorAll(".motion-toggle-input").forEach(inp => { inp.checked = this.get(); });
  }
};

/* ── VALIDATION ───────────────────────────────────────────────────── */
const Validate = {
  email:    v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
  minLen:   (v, n) => v.length >= n,
  notEmpty: v => v.trim().length > 0
};

function fieldError(el, msg) {
  el.classList.add("is-error");
  const e = el.closest(".auth-field")?.querySelector(".auth-field-error");
  if (e) { e.textContent = msg; e.classList.add("visible"); }
}
function fieldOk(el) {
  el.classList.remove("is-error");
  const e = el.closest(".auth-field")?.querySelector(".auth-field-error");
  if (e) e.classList.remove("visible");
}


/* ── SAFE PHOTO HELPER ────────────────────────────────────────────────
   FIX C-02: use DOM API to set avatar photo — avoids innerHTML XSS
   when a user sets a crafted data: URL as their profile photo.     */
function _setAvatarPhoto(el, src, altText) {
  if (!el) return;
  // Only allow data: URLs (base64 uploads) or same-origin relative paths
  const isSafe = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/.test(src)
              || /^(?!javascript:)(?![/]{2})[\w\-./ ]+$/.test(src);
  if (!isSafe) { console.warn('Avatar photo blocked — unsafe src'); return; }
  el.textContent = '';
  const img = document.createElement('img');
  img.src = src;
  img.alt = altText || '';
  el.appendChild(img);
}


/* ── HTML ESCAPE HELPER ──────────────────────────────────────────────
   Use this for EVERY value that comes from user-controlled storage
   (localStorage, IndexedDB, URL params) before inserting into innerHTML.
   ─────────────────────────────────────────────────────────────────── */
function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/`/g, "&#96;");
}

/* ── INSTANT PREFS (prevent flash) ───────────────────────────────── */
(function() {
  // Apply theme immediately to avoid FOUC
  // Use stored pref, cookie, or fall back to system preference
  const stored = localStorage.getItem("ride_theme");
  const cookie = (document.cookie.match(/(?:^|;\s*)ride_theme=([^;]+)/) || [])[1];
  const system = window.matchMedia && window.matchMedia("(prefers-color-scheme:dark)").matches
    ? "dark" : "light";
  const theme = stored || cookie || system;
  document.documentElement.setAttribute("data-theme", theme);
  // Motion: only from localStorage (account preference)
  if (localStorage.getItem("ride_reduce_motion") === "true")
    document.documentElement.classList.add("reduce-motion");
})();
/* ── CLEAN URLS (remove .html from address bar) ─────────────────── */
(function() {
  const path = window.location.pathname;
  if (path.endsWith('.html')) {
    const clean = path.slice(0, -5) || '/';
    history.replaceState(null, '', clean + window.location.search + window.location.hash);
  }
})();