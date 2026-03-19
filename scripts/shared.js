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
        lang TEXT
      )
    `);
    ["photo","phone","city","country","birthday","lang"].forEach(col => {
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
      lang:      user.lang       !== undefined ? user.lang     : (existing.lang     ?? null),
    };

    const s = db.prepare(`
      INSERT OR REPLACE INTO users
      (id,firstName,lastName,email,password,initials,createdAt,photo,phone,city,country,birthday,lang)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    s.run([merged.id, merged.firstName, merged.lastName, merged.email,
           merged.password, merged.initials, merged.createdAt,
           merged.photo, merged.phone, merged.city,
           merged.country, merged.birthday, merged.lang]);
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
        // Apply user's preferred language if set in their account
        if (safe.lang) Lang.set(safe.lang);
        return safe;
      }
      return null;
    } catch(e) { console.error("Session.get error:", e); return null; }
  },

  clear(wipePrefs = false) {
    localStorage.removeItem("current_user_id");
    if (wipePrefs) {
      localStorage.removeItem("ride_theme");
      localStorage.removeItem("ride_reduce_motion");
      localStorage.removeItem("ride_lang");
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.classList.remove("reduce-motion");
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
    getStarted:"Get started", viewPlans:"View plans",
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
  },

  it: {
    home:"Home", features:"Funzionalità", vehicles:"Veicoli",
    fidelity:"Fedeltà", drive:"Guida con noi",
    getStarted:"Inizia ora", viewPlans:"Vedi piani",
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
  },

  fr: {
    home:"Accueil", features:"Fonctionnalités", vehicles:"Véhicules",
    fidelity:"Fidélité", drive:"Conduire avec nous",
    getStarted:"Commencer", viewPlans:"Voir les plans",
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
  },

  es: {
    home:"Inicio", features:"Características", vehicles:"Vehículos",
    fidelity:"Fidelidad", drive:"Conducir con nosotros",
    getStarted:"Comenzar", viewPlans:"Ver planes",
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
  },

  zh: {
    home:"首页", features:"功能", vehicles:"车辆",
    fidelity:"忠诚度", drive:"与我们一起驾驶",
    getStarted:"立即开始", viewPlans:"查看方案",
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
  }
};

/* ── LANG ─────────────────────────────────────────────────────────── */
const Lang = {
  _detect() {
    const nav = (navigator.language || navigator.userLanguage || "it").toLowerCase();
    if (nav.startsWith("it")) return "it";
    if (nav.startsWith("fr")) return "fr";
    if (nav.startsWith("es")) return "es";
    if (nav.startsWith("zh")) return "zh";
    if (nav.startsWith("en")) return "en";
    return "it";
  },
  get()  { return localStorage.getItem("ride_lang") || this._detect(); },
  set(l) { localStorage.setItem("ride_lang", l); },
  t(key) { return (LANGS[this.get()] || LANGS.en)[key] || key; },
  apply() {
    const t = LANGS[this.get()] || LANGS.en;
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const v = t[el.dataset.i18n]; if (v != null) el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const v = t[el.dataset.i18nPlaceholder]; if (v != null) el.placeholder = v;
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
    headline.innerHTML = t.dpHeadline.replace("\n", "<br>");
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
  get()  { return localStorage.getItem("ride_theme") || "dark"; },
  set(t) { localStorage.setItem("ride_theme", t); },

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

  toggle() { this.set(this.get() === "dark" ? "light" : "dark"); this.apply(); }
};

/* ── REDUCE MOTION ────────────────────────────────────────────────── */
const Motion = {
  get() {
    const s = localStorage.getItem("ride_reduce_motion");
    return s !== null ? s === "true" : window.matchMedia("(prefers-reduced-motion:reduce)").matches;
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

/* ── INSTANT PREFS (prevent flash) ───────────────────────────────── */
(function() {
  const isLanding = document.documentElement.hasAttribute("data-landing");
  if (!isLanding) {
    Theme.apply();
  }
})();
Motion.apply();
/* ── CLEAN URLS (remove .html from address bar) ─────────────────── */
(function() {
  const path = window.location.pathname;
  if (path.endsWith('.html')) {
    const clean = path.slice(0, -5) || '/';
    history.replaceState(null, '', clean + window.location.search + window.location.hash);
  }
})();