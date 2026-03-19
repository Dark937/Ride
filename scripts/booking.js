"use strict";
/* ═══════════════════════════════════════════════════════════════════
   RIDE — BOOKING PAGE  (scripts/booking.js)
   Requires: shared.js loaded before this file.
   ═══════════════════════════════════════════════════════════════════ */

/* ── I18N ADDITIONS (booking-specific keys) ───────────────────────── */
const BOOKING_KEYS = {
  en: {
    bookPageTitle:"Book a Ride — Ride",
    bookTitle:"Book a Ride", bookSubtitle:"Enter your pickup and destination",
    whereTitle:"Where", whenTitle:"When", vehicleTitle:"Vehicle",
    pickupPlaceholder:"Pickup location", dropoffPlaceholder:"Destination",
    quickDests:"Quick destinations",
    rideNow:"Ride now", schedule:"Schedule",
    passengers:"Passengers", passengersMax:"Maximum 4",
    notesPlaceholder:"Any notes for the driver…",
    chooseVehicle:"Choose your vehicle",
    back:"Back", continueBtn:"Continue", confirmRide:"Confirm ride",
    bookingConfirmed:"Ride confirmed!", viewInDashboard:"View in Dashboard",
    yourDriver:"Your driver", yourTrip:"Your trip",
    hello:"Hey", rightHint:"Fill in your pickup and destination to see vehicles and pricing.",
    rideTime:"Ride time", estDistance:"Distance", arrivalTime:"Arrival", estFare:"Est. fare",
    pts:"pts", pickup:"Pickup", destination:"Destination",
    etaLabel:"ETA", signOutQ:"Sign out?",
    signOutDesc:"You'll need to sign in again to access your account.",
    driverArrival:"Driver arrival",
    confirmMsg:"Your driver is on the way. Track in the dashboard.",
    selectVehicleFirst:"Please select a vehicle to continue.",
    enterLocations:"Please enter pickup and destination first.",
  },
  it: {
    bookPageTitle:"Prenota un Viaggio — Ride",
    bookTitle:"Prenota un Viaggio", bookSubtitle:"Inserisci il punto di partenza e la destinazione",
    whereTitle:"Dove", whenTitle:"Quando", vehicleTitle:"Veicolo",
    pickupPlaceholder:"Punto di partenza", dropoffPlaceholder:"Destinazione",
    quickDests:"Destinazioni rapide",
    rideNow:"Adesso", schedule:"Pianifica",
    passengers:"Passeggeri", passengersMax:"Massimo 4",
    notesPlaceholder:"Note per l'autista…",
    chooseVehicle:"Scegli il veicolo",
    back:"Indietro", continueBtn:"Continua", confirmRide:"Conferma viaggio",
    bookingConfirmed:"Viaggio confermato!", viewInDashboard:"Vedi nel Dashboard",
    yourDriver:"Il tuo autista", yourTrip:"Il tuo viaggio",
    hello:"Ciao", rightHint:"Inserisci partenza e destinazione per vedere i veicoli disponibili.",
    rideTime:"Durata", estDistance:"Distanza", arrivalTime:"Arrivo", estFare:"Prezzo est.",
    pts:"pts", pickup:"Partenza", destination:"Destinazione",
    etaLabel:"ETA", signOutQ:"Uscire?",
    signOutDesc:"Dovrai accedere di nuovo per usare il tuo account.",
    driverArrival:"Arrivo autista",
    confirmMsg:"Il tuo autista è in arrivo. Traccia il viaggio nella dashboard.",
    selectVehicleFirst:"Seleziona un veicolo per continuare.",
    enterLocations:"Inserisci prima partenza e destinazione.",
  },
  fr: {
    bookPageTitle:"Réserver un Trajet — Ride",
    bookTitle:"Réserver un Trajet", bookSubtitle:"Entrez votre lieu de départ et destination",
    whereTitle:"Où", whenTitle:"Quand", vehicleTitle:"Véhicule",
    pickupPlaceholder:"Lieu de départ", dropoffPlaceholder:"Destination",
    quickDests:"Destinations rapides",
    rideNow:"Maintenant", schedule:"Programmer",
    passengers:"Passagers", passengersMax:"Maximum 4",
    notesPlaceholder:"Notes pour le chauffeur…",
    chooseVehicle:"Choisissez votre véhicule",
    back:"Retour", continueBtn:"Continuer", confirmRide:"Confirmer",
    bookingConfirmed:"Trajet confirmé!", viewInDashboard:"Voir dans le Dashboard",
    yourDriver:"Votre chauffeur", yourTrip:"Votre trajet",
    hello:"Bonjour", rightHint:"Entrez votre départ et destination pour voir les véhicules.",
    rideTime:"Durée", estDistance:"Distance", arrivalTime:"Arrivée", estFare:"Prix est.",
    pts:"pts", pickup:"Départ", destination:"Destination",
    etaLabel:"ETA", signOutQ:"Se déconnecter?",
    signOutDesc:"Vous devrez vous reconnecter pour accéder à votre compte.",
    driverArrival:"Arrivée chauffeur",
    confirmMsg:"Votre chauffeur est en route. Suivez dans le tableau de bord.",
    selectVehicleFirst:"Veuillez sélectionner un véhicule pour continuer.",
    enterLocations:"Veuillez d'abord entrer départ et destination.",
  },
  es: {
    bookPageTitle:"Reservar un Viaje — Ride",
    bookTitle:"Reservar un Viaje", bookSubtitle:"Ingresa tu punto de recogida y destino",
    whereTitle:"Dónde", whenTitle:"Cuándo", vehicleTitle:"Vehículo",
    pickupPlaceholder:"Punto de recogida", dropoffPlaceholder:"Destino",
    quickDests:"Destinos rápidos",
    rideNow:"Ahora", schedule:"Programar",
    passengers:"Pasajeros", passengersMax:"Máximo 4",
    notesPlaceholder:"Notas para el conductor…",
    chooseVehicle:"Elige tu vehículo",
    back:"Atrás", continueBtn:"Continuar", confirmRide:"Confirmar",
    bookingConfirmed:"¡Viaje confirmado!", viewInDashboard:"Ver en Dashboard",
    yourDriver:"Tu conductor", yourTrip:"Tu viaje",
    hello:"Hola", rightHint:"Ingresa recogida y destino para ver vehículos y precios.",
    rideTime:"Duración", estDistance:"Distancia", arrivalTime:"Llegada", estFare:"Precio est.",
    pts:"pts", pickup:"Recogida", destination:"Destino",
    etaLabel:"ETA", signOutQ:"¿Cerrar sesión?",
    signOutDesc:"Necesitarás iniciar sesión de nuevo para acceder a tu cuenta.",
    driverArrival:"Llegada conductor",
    confirmMsg:"Tu conductor está en camino. Rastrea en el dashboard.",
    selectVehicleFirst:"Por favor selecciona un vehículo para continuar.",
    enterLocations:"Por favor ingresa recogida y destino primero.",
  },
  zh: {
    bookPageTitle:"预约行程 — Ride",
    bookTitle:"预约行程", bookSubtitle:"输入上车地点和目的地",
    whereTitle:"去哪里", whenTitle:"何时", vehicleTitle:"车辆",
    pickupPlaceholder:"上车地点", dropoffPlaceholder:"目的地",
    quickDests:"快速目的地",
    rideNow:"立即出发", schedule:"预约",
    passengers:"乘客", passengersMax:"最多4人",
    notesPlaceholder:"司机备注…",
    chooseVehicle:"选择车辆",
    back:"返回", continueBtn:"继续", confirmRide:"确认行程",
    bookingConfirmed:"行程已确认！", viewInDashboard:"在仪表板中查看",
    yourDriver:"您的司机", yourTrip:"您的行程",
    hello:"你好", rightHint:"输入出发地和目的地以查看可用车辆和价格。",
    rideTime:"行程时间", estDistance:"距离", arrivalTime:"到达", estFare:"预估费用",
    pts:"积分", pickup:"上车", destination:"目的地",
    etaLabel:"预计到达", signOutQ:"退出登录？",
    signOutDesc:"需要重新登录才能访问您的账户。",
    driverArrival:"司机到达",
    confirmMsg:"您的司机正在路上，请在仪表板中追踪。",
    selectVehicleFirst:"请先选择车辆。",
    enterLocations:"请先输入出发地和目的地。",
  },
};

/* Merge booking keys into LANGS */
if (typeof LANGS !== "undefined") {
  Object.keys(BOOKING_KEYS).forEach(l => {
    if (LANGS[l]) Object.assign(LANGS[l], BOOKING_KEYS[l]);
  });
}

/* ── HELPER ──────────────────────────────────────────────────────────── */
function t(key) { return Lang.t(key) || key; }
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(el._tid);
  el._tid = setTimeout(() => el.classList.remove("show"), 2800);
}

/* ── VEHICLES DATA ────────────────────────────────────────────────────── */
const VEHICLES = [
  {
    id: "economy",
    emoji: "🚗",
    name: "Ride Economy",
    sub: "Comfortable city ride",
    ratePerKm: 1.10,
    baseFare: 3.5,
    eta: 4,
    capacity: 4,
    badge: null,
    features: ["4 seats", "A/C", "Wi-Fi"],
    unlocked: true,
  },
  {
    id: "comfort",
    emoji: "🚙",
    name: "Ride Comfort",
    sub: "Premium sedan, extra space",
    ratePerKm: 1.65,
    baseFare: 5.0,
    eta: 6,
    capacity: 4,
    badge: { label: "Popular", cls: "new" },
    features: ["4 seats", "Premium A/C", "Leather"],
    unlocked: true,
  },
  {
    id: "business",
    emoji: "🏎️",
    name: "Ride Business",
    sub: "Ferrari Roma or similar",
    ratePerKm: 2.80,
    baseFare: 12.0,
    eta: 8,
    capacity: 3,
    badge: { label: "Gold", cls: "gold" },
    features: ["3 seats", "Supercar", "Champagne"],
    unlocked: true,
  },
  {
    id: "green",
    emoji: "⚡",
    name: "Ride Green",
    sub: "100% electric fleet",
    ratePerKm: 1.30,
    baseFare: 4.0,
    eta: 7,
    capacity: 4,
    badge: { label: "Eco", cls: "eco" },
    features: ["4 seats", "Zero CO₂", "Silent"],
    unlocked: true,
  },
  {
    id: "van",
    emoji: "🚐",
    name: "Ride Van",
    sub: "Perfect for groups",
    ratePerKm: 1.90,
    baseFare: 7.0,
    eta: 9,
    capacity: 7,
    badge: null,
    features: ["7 seats", "Luggage", "A/C"],
    unlocked: true,
  },
];

const DRIVERS = [
  { name: "Marco V.", emoji: "👨‍✈️", since: "2023", rating: 4.97, review: "Extremely professional, always on time. The car was immaculate every single trip.", reviewer: "Giulia T.", reviewDate: "March 2026" },
  { name: "Sofia R.", emoji: "👩‍✈️", since: "2022", rating: 4.95, review: "Smooth ride and great conversation. Knows the best routes to avoid traffic.", reviewer: "Luca B.", reviewDate: "February 2026" },
  { name: "Andrea C.", emoji: "🧑‍✈️", since: "2024", rating: 4.92, review: "Super punctual and very kind. Highly recommended for airport transfers.", reviewer: "Elena M.", reviewDate: "March 2026" },
  { name: "Valentina F.", emoji: "👩", since: "2021", rating: 4.99, review: "The best Ride driver I've ever had. Impeccable service every time.", reviewer: "Roberto P.", reviewDate: "March 2026" },
];

/* ── MAP CANVAS ───────────────────────────────────────────────────────── */
const MapRenderer = (() => {
  let canvas, ctx, W, H;
  let fromPt = null, toPt = null;
  let animFrameId = null;
  let driverT = 0, driverDir = 1;

  // Rome-like street grid seed points
  const NODES = [
    [120,180],[280,140],[440,160],[600,130],[760,170],[880,200],
    [100,300],[260,290],[420,280],[580,260],[720,300],[860,320],
    [80,420], [240,400],[400,380],[560,360],[700,420],[840,400],
    [110,520],[270,500],[430,480],[590,460],[730,520],[860,510],
    [130,620],[300,600],[460,580],[620,560],[780,620],[900,600],
  ];

  function init() {
    canvas = document.getElementById("mapBg");
    ctx    = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    drawBaseMap();
  }

  function resize() {
    W = canvas.width  = canvas.offsetWidth  || window.innerWidth;
    H = canvas.height = canvas.offsetHeight || window.innerHeight;
    drawBaseMap();
  }

  function isDark() {
    return document.documentElement.getAttribute("data-theme") !== "light";
  }

  function drawBaseMap() {
    if (!ctx) return;
    const dark = isDark();

    // Background
    ctx.fillStyle = dark ? "#0d1117" : "#e8ecf0";
    ctx.fillRect(0, 0, W, H);

    // Water blob (bottom-right)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(W * .8, H * .85, W * .25, H * .2, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "rgba(20,50,110,.35)" : "rgba(150,200,240,.5)";
    ctx.fill();
    ctx.restore();

    // Park areas
    const parks = [
      { x: W * .15, y: H * .3, rx: W * .06, ry: H * .08 },
      { x: W * .55, y: H * .55, rx: W * .05, ry: H * .07 },
      { x: W * .75, y: H * .2,  rx: W * .04, ry: H * .05 },
    ];
    parks.forEach(p => {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = dark ? "rgba(20,60,30,.3)" : "rgba(160,210,140,.45)";
      ctx.fill();
      ctx.restore();
    });

    // Grid streets
    const cols = 14, rows = 9;
    const cw = W / (cols - 1), ch = H / (rows - 1);
    const jitter = (seed) => (Math.sin(seed * 137.5) * 0.5 + 0.5) * 8 - 4;

    ctx.strokeStyle = dark ? "rgba(255,255,255,.055)" : "rgba(255,255,255,.8)";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";

    // Vertical streets
    for (let i = 0; i < cols; i++) {
      ctx.beginPath();
      for (let j = 0; j < rows; j++) {
        const x = i * cw + jitter(i * 100 + j);
        const y = j * ch + jitter(i + j * 200);
        if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Horizontal streets
    for (let j = 0; j < rows; j++) {
      ctx.beginPath();
      for (let i = 0; i < cols; i++) {
        const x = i * cw + jitter(i * 300 + j);
        const y = j * ch + jitter(i * 400 + j);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Major roads (brighter, wider)
    ctx.strokeStyle = dark ? "rgba(255,255,255,.11)" : "rgba(255,255,255,.95)";
    ctx.lineWidth = 3;
    const majors = [
      [[0, H * .35], [W, H * .38]],
      [[0, H * .65], [W, H * .62]],
      [[W * .3, 0], [W * .32, H]],
      [[W * .65, 0], [W * .67, H]],
    ];
    majors.forEach(([[x1,y1],[x2,y2]]) => {
      ctx.beginPath();
      const mx = (x1+x2)/2, my = (y1+y2)/2;
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx + jitter(x1)*3, my + jitter(y1)*3, x2, y2);
      ctx.stroke();
    });

    // Street labels (faint text)
    ctx.fillStyle = dark ? "rgba(255,255,255,.12)" : "rgba(60,70,100,.3)";
    ctx.font = "bold 9px 'DM Sans', sans-serif";
    ctx.letterSpacing = "0.05em";
    const labels = ["Via del Corso","Via Veneto","Via Appia","Lungotevere","Via Nazionale","Corso Vittorio"];
    labels.forEach((lbl, i) => {
      ctx.save();
      const lx = W * (.1 + i * .15);
      const ly = H * (.25 + (i % 3) * .2);
      ctx.translate(lx, ly);
      ctx.rotate((i % 2 === 0) ? 0 : -Math.PI / 2);
      ctx.fillText(lbl, 0, 0);
      ctx.restore();
    });

    // Block fills (city buildings tone)
    ctx.fillStyle = dark ? "rgba(255,255,255,.018)" : "rgba(0,0,30,.03)";
    for (let i = 0; i < 40; i++) {
      const bx = (Math.sin(i * 13.7) * .5 + .5) * W;
      const by = (Math.sin(i * 7.3)  * .5 + .5) * H;
      const bw = 20 + (Math.sin(i * 3.1) * .5 + .5) * 60;
      const bh = 15 + (Math.sin(i * 5.7) * .5 + .5) * 40;
      ctx.fillRect(bx - bw/2, by - bh/2, bw, bh);
    }
  }

  function setRoute(from, to) {
    fromPt = from; toPt = to;
    updateSVGRoute();
    updateStats();
    startDriverAnimation();
  }

  function clearRoute() {
    fromPt = null; toPt = null;
    stopDriverAnimation();
    hideSVGRoute();
    hideStats();
  }

  // Map logical coords to SVG viewBox (1000×700)
  function toSVG(pt) {
    return { x: (pt.x / 100) * 1000, y: (pt.y / 100) * 700 };
  }

  function updateSVGRoute() {
    if (!fromPt || !toPt) return;
    const fSVG = toSVG(fromPt);
    const tSVG = toSVG(toPt);

    // Curved bezier path
    const mx = (fSVG.x + tSVG.x) / 2;
    const my = (fSVG.y + tSVG.y) / 2 - Math.abs(tSVG.x - fSVG.x) * 0.3;
    const d  = `M ${fSVG.x} ${fSVG.y} Q ${mx} ${my} ${tSVG.x} ${tSVG.y}`;

    ["routeShadow","routePath","routePulse"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.setAttribute("d", d);
    });

    const rp = document.getElementById("routePath");
    if (rp) {
      const len = rp.getTotalLength?.() || 800;
      rp.style.strokeDasharray  = len;
      rp.style.strokeDashoffset = len;
      rp.classList.remove("drawn");
      requestAnimationFrame(() => { rp.classList.add("drawn"); });
    }

    const rpu = document.getElementById("routePulse");
    if (rpu) { rpu.classList.remove("animating"); requestAnimationFrame(() => rpu.classList.add("animating")); }

    // Position pins
    positionPin("pinFrom", fSVG.x, fSVG.y);
    positionPin("pinTo",   tSVG.x, tSVG.y);

    document.getElementById("pinFrom").style.display = "";
    document.getElementById("pinTo").style.display   = "";
    document.getElementById("driverMarker").style.display = "";
    document.getElementById("pinFrom").querySelector(".pin-label").textContent = t("pickup");
    document.getElementById("pinTo").querySelector(".pin-label").textContent   = t("destination");
  }

  function positionPin(id, x, y) {
    const g = document.getElementById(id);
    if (!g) return;
    g.setAttribute("transform", `translate(${x}, ${y})`);
  }

  function hideSVGRoute() {
    ["routeShadow","routePath","routePulse"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.setAttribute("d", "");
    });
    document.getElementById("pinFrom").style.display = "none";
    document.getElementById("pinTo").style.display   = "none";
    document.getElementById("driverMarker").style.display = "none";
  }

  function startDriverAnimation() {
    stopDriverAnimation();
    driverT = 0; driverDir = 1;

    function tick() {
      if (!fromPt || !toPt) return;
      const rp = document.getElementById("routePath");
      if (!rp) return;
      const len = rp.getTotalLength?.() || 0;
      if (!len) { animFrameId = requestAnimationFrame(tick); return; }

      driverT += driverDir * 0.0018;
      if (driverT > 1) { driverT = 1; driverDir = -1; }
      if (driverT < 0) { driverT = 0; driverDir = 1;  }

      const pt = rp.getPointAtLength(driverT * len);
      const dm = document.getElementById("driverMarker");
      if (dm) dm.setAttribute("transform", `translate(${pt.x}, ${pt.y})`);

      animFrameId = requestAnimationFrame(tick);
    }
    animFrameId = requestAnimationFrame(tick);
  }

  function stopDriverAnimation() {
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  }

  function updateStats() {
    const stats = document.getElementById("mapStats");
    if (stats) stats.classList.add("visible");
  }
  function hideStats() {
    const stats = document.getElementById("mapStats");
    if (stats) stats.classList.remove("visible");
  }

  function redraw() {
    drawBaseMap();
    if (fromPt && toPt) updateSVGRoute();
  }

  return { init, setRoute, clearRoute, redraw };
})();

/* ── LOCATION LOOKUP (mock geocoder) ─────────────────────────────────── */
const ROME_PLACES = [
  { main: "Piazza Navona",          sub: "Centro Storico, Roma",           x: 38, y: 48 },
  { main: "Fiumicino Airport",      sub: "Via dell'Aeroporto, Fiumicino",  x: 6,  y: 82 },
  { main: "Roma Termini Station",   sub: "Piazza dei Cinquecento, Roma",   x: 58, y: 50 },
  { main: "Colosseum",              sub: "Piazza del Colosseo, Roma",      x: 55, y: 58 },
  { main: "Vatican City",           sub: "Città del Vaticano, Roma",       x: 30, y: 43 },
  { main: "Via del Corso 1",        sub: "Centro Storico, Roma",           x: 44, y: 46 },
  { main: "Trastevere",             sub: "Rione Trastevere, Roma",         x: 36, y: 60 },
  { main: "EUR Centro",             sub: "Via Cristoforo Colombo, Roma",   x: 48, y: 80 },
  { main: "Piazza Venezia",         sub: "Centro Storico, Roma",           x: 46, y: 52 },
  { main: "Villa Borghese",         sub: "Viale dei Bambini, Roma",        x: 50, y: 32 },
  { main: "Parioli",                sub: "Quartiere Parioli, Roma",        x: 52, y: 28 },
  { main: "Testaccio",              sub: "Rione Testaccio, Roma",          x: 42, y: 65 },
  { main: "Ostiense",               sub: "Via Ostiense, Roma",             x: 46, y: 70 },
  { main: "Prati",                  sub: "Quartiere Prati, Roma",          x: 32, y: 38 },
  { main: "Pantheon",               sub: "Piazza della Rotonda, Roma",     x: 42, y: 49 },
  { main: "Napoili Centrale",       sub: "Piazza Garibaldi, Napoli",       x: 88, y: 65 },
  { main: "Hotel Eden Roma",        sub: "Via Ludovisi 49, Roma",          x: 50, y: 40 },
  { main: "Gianicolo",              sub: "Via Garibaldi, Roma",            x: 28, y: 52 },
  { main: "Pigneto",                sub: "Via del Pigneto, Roma",          x: 68, y: 52 },
  { main: "Via Veneto",             sub: "Via Vittorio Veneto, Roma",      x: 53, y: 42 },
  { main: "Tiburtina Station",      sub: "Via Tiburtina, Roma",            x: 70, y: 45 },
  { main: "Ciampino Airport",       sub: "Via Appia Nuova, Ciampino",      x: 65, y: 82 },
  { main: "Largo Argentina",        sub: "Largo di Torre Argentina, Roma", x: 41, y: 51 },
  { main: "Porta Portese",          sub: "Via Portuense, Roma",            x: 35, y: 64 },
  { main: "Piazza del Popolo",      sub: "Flaminio, Roma",                 x: 43, y: 30 },
];

function searchPlaces(query) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return ROME_PLACES.filter(p =>
    p.main.toLowerCase().includes(q) || p.sub.toLowerCase().includes(q)
  ).slice(0, 5);
}

/* ── STATE ───────────────────────────────────────────────────────────── */
const state = {
  step: 1,
  pickup: null,   // { main, sub, x, y }
  dropoff: null,
  mode: "now",    // "now" | "schedule"
  date: "",
  time: "",
  passengers: 1,
  notes: "",
  vehicle: null,  // vehicle id
  driver: null,
  distKm: 0,
  durationMin: 0,
  fareEur: 0,
  user: null,
};

/* ── DISTANCE & FARE CALCULATOR ─────────────────────────────────────── */
function calcTrip(pickup, dropoff, vehicle) {
  if (!pickup || !dropoff) return { km: 0, min: 0, fare: 0 };
  const dx = (pickup.x - dropoff.x);
  const dy = (pickup.y - dropoff.y);
  // Rough normalised distance → km (assuming ~1 unit = 0.7 km for Rome scale)
  const raw  = Math.sqrt(dx*dx + dy*dy);
  const km   = Math.max(1, raw * 0.65);
  const min  = Math.round(km * 2.8 + 4 + Math.random() * 3);
  const v    = vehicle || VEHICLES[0];
  const fare = v.baseFare + km * v.ratePerKm;
  return { km: parseFloat(km.toFixed(1)), min, fare: parseFloat(fare.toFixed(2)) };
}

function updateMapStats() {
  if (!state.pickup || !state.dropoff) return;
  const trip = calcTrip(state.pickup, state.dropoff, VEHICLES.find(v => v.id === state.vehicle));
  state.distKm = trip.km; state.durationMin = trip.min; state.fareEur = trip.fare;

  const now = new Date();
  now.setMinutes(now.getMinutes() + trip.min);
  const arrival = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  document.getElementById("statDuration").textContent = trip.min + " min";
  document.getElementById("statDistance").textContent = trip.km + " km";
  document.getElementById("statArrival").textContent  = arrival;
  document.getElementById("statFare").textContent     = "€" + trip.fare.toFixed(2);

  updateRecap();
}

/* ── AUTOCOMPLETE ────────────────────────────────────────────────────── */
function initAutocomplete(inputId, acId, onSelect) {
  const input = document.getElementById(inputId);
  const ac    = document.getElementById(acId);

  input.addEventListener("input", () => {
    const results = searchPlaces(input.value);
    if (!results.length || !input.value.trim()) { ac.classList.remove("open"); ac.innerHTML = ""; return; }

    ac.innerHTML = results.map(p => `
      <div class="bk-ac-item" data-main="${esc(p.main)}" data-sub="${esc(p.sub)}" data-x="${Number(p.x)}" data-y="${Number(p.y)}">
        <div class="bk-ac-icon">
          <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" fill="currentColor"/></svg>
        </div>
        <div>
          <div class="bk-ac-main">${esc(p.main)}</div>
          <div class="bk-ac-sub">${esc(p.sub)}</div>
        </div>
      </div>`).join("");
    ac.classList.add("open");

    ac.querySelectorAll(".bk-ac-item").forEach(item => {
      item.addEventListener("click", () => {
        const place = { main: item.dataset.main, sub: item.dataset.sub, x: +item.dataset.x, y: +item.dataset.y };
        input.value = place.main;
        ac.classList.remove("open"); ac.innerHTML = "";
        onSelect(place);
      });
    });
  });

  document.addEventListener("click", e => { if (!ac.contains(e.target) && e.target !== input) { ac.classList.remove("open"); ac.innerHTML = ""; } });
}

/* ── STEP NAVIGATION ─────────────────────────────────────────────────── */
function goStep(n) {
  [1,2,3].forEach(i => {
    document.getElementById(`stepContent${i}`).classList.toggle("hidden", i !== n);
    const ind = document.getElementById(`step${i}ind`);
    ind.classList.toggle("active", i === n);
    ind.classList.toggle("done",   i < n);
  });
  state.step = n;
}

/* ── VEHICLE LIST ────────────────────────────────────────────────────── */
function renderVehicles() {
  const trip = calcTrip(state.pickup, state.dropoff);
  const list = document.getElementById("vehicleList");
  const lbl  = document.getElementById("step3RouteLabel");
  if (lbl) lbl.textContent = state.pickup && state.dropoff
    ? `${state.pickup.main} → ${state.dropoff.main}`
    : "";

  list.innerHTML = VEHICLES.map(v => {
    const trip_v = calcTrip(state.pickup, state.dropoff, v);
    const arrNow = new Date(); arrNow.setMinutes(arrNow.getMinutes() + v.eta);
    const etaStr = arrNow.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const isSelected = v.id === state.vehicle;

    return `<div class="bk-vehicle-card${isSelected ? " selected" : ""}" data-vid="${v.id}">
      ${v.badge ? `<span class="bk-vc-badge ${v.badge.cls}">${v.badge.label}</span>` : ""}
      <div class="bk-vc-top">
        <div class="bk-vc-icon">${v.emoji}</div>
        <div class="bk-vc-info">
          <div class="bk-vc-name">${v.name}</div>
          <div class="bk-vc-sub">${v.sub}</div>
        </div>
      </div>
      <div class="bk-vc-bottom">
        <div class="bk-vc-meta">
          <span class="bk-vc-meta-item"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" fill="none"/><polyline points="12 6 12 12 16 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>${v.eta} min</span>
          <span class="bk-vc-meta-item"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>${v.capacity}</span>
        </div>
        <div class="bk-vc-price">€${trip_v.fare.toFixed(2)}<span class="per-km"> €${v.ratePerKm.toFixed(2)}/km</span></div>
      </div>
    </div>`;
  }).join("");

  list.querySelectorAll(".bk-vehicle-card").forEach(card => {
    card.addEventListener("click", () => {
      state.vehicle = card.dataset.vid;
      list.querySelectorAll(".bk-vehicle-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      document.getElementById("btnConfirm").disabled = false;
      updateMapStats();
      updateRecap();
      updateEarnBanner();
    });
  });
}

/* ── RIGHT PANEL: DRIVER & RECAP ─────────────────────────────────────── */
function assignDriver() {
  state.driver = DRIVERS[Math.floor(Math.random() * DRIVERS.length)];
  const d = state.driver;

  const av = document.getElementById("driverAv");
  av.textContent = d.emoji;

  document.getElementById("driverName").textContent = d.name;
  document.getElementById("driverSub").textContent  = `Driving with us since ${d.since}`;

  const stars = document.getElementById("driverStars");
  stars.innerHTML = Array.from({length:5},(_,i) =>
    `<span class="bk-star${i < Math.round(d.rating) ? "" : " empty"}">★</span>`
  ).join("");

  document.getElementById("reviewText").textContent = d.review;
  document.getElementById("reviewMeta").innerHTML   = `<strong>${esc(d.reviewer)}</strong> · ${esc(d.reviewDate)}`;

  document.getElementById("recapGreeting").classList.add("hidden");
  document.getElementById("recapDriver").classList.remove("hidden");
}

function updateRecap() {
  if (!state.pickup || !state.dropoff) return;
  const trip = calcTrip(state.pickup, state.dropoff, VEHICLES.find(v => v.id === state.vehicle));

  document.getElementById("recapFrom").textContent = state.pickup.main;
  document.getElementById("recapTo").textContent   = state.dropoff.main;
  document.getElementById("recapDuration").textContent = trip.min + " min";
  document.getElementById("recapFare").textContent     = "€" + trip.fare.toFixed(2);

  const pts = Math.round(trip.fare);
  document.getElementById("recapPts").textContent = "+" + pts;
  document.getElementById("recapPass").textContent = state.passengers;

  document.getElementById("recapRoute").classList.remove("hidden");
}

function updateEarnBanner() {
  if (!state.vehicle || !state.pickup || !state.dropoff) return;
  const trip = calcTrip(state.pickup, state.dropoff, VEHICLES.find(v => v.id === state.vehicle));
  const pts  = Math.round(trip.fare);
  const el   = document.getElementById("earnBanner");
  const txt  = document.getElementById("earnText");
  txt.textContent = `Earn ${pts} fidelity points on this trip`;
  el.style.display = "flex";
}

/* ── TOPBAR DROPDOWN ─────────────────────────────────────────────────── */
function initDropdown(user) {
  const avatar   = document.getElementById("tbAvatar");
  const dropdown = document.getElementById("profileDropdown");

  if (user) {
    const full = `${user.firstName||""} ${user.lastName||""}`.trim() || "Rider";
    document.getElementById("ddName").textContent  = full;
    document.getElementById("ddEmail").textContent = user.email || "";

    const ddAv = document.getElementById("ddAvatar");
    if (user.photo) { _setAvatarPhoto(ddAv, user.photo, ""); ddAv.style.background = "transparent"; }
    else ddAv.textContent = user.initials || full[0] || "R";

    if (user.photo) { _setAvatarPhoto(avatar, user.photo, ""); }
    else avatar.textContent = user.initials || full[0] || "R";
  }

  let open = false;
  avatar.addEventListener("click", e => { e.stopPropagation(); open = !open; dropdown.classList.toggle("open", open); });
  document.addEventListener("click", e => { if (!dropdown.contains(e.target) && e.target !== avatar) { open = false; dropdown.classList.remove("open"); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { open = false; dropdown.classList.remove("open"); } });

  document.getElementById("ddSignOut").addEventListener("click", () => {
    dropdown.classList.remove("open"); open = false;
    document.getElementById("soModal").classList.add("open");
  });
  document.getElementById("soCancel").addEventListener("click", () => document.getElementById("soModal").classList.remove("open"));
  document.getElementById("soModal").addEventListener("click", e => { if (e.target === document.getElementById("soModal")) document.getElementById("soModal").classList.remove("open"); });
  document.getElementById("soConfirm").addEventListener("click", () => { Session.clear(true); window.location.href = "index.html"; });
}

/* ── BACK BUTTON ─────────────────────────────────────────────────────── */
function initBackBtn() {
  const backEl  = document.getElementById("tbBack");
  const backLbl = document.getElementById("tbBackLabel");
  if (!backEl || !backLbl) return;
  const PAGE_LABELS = { "index.html":"Home","index":"Home","/":"Home","dashboard.html":"Dashboard","dashboard":"Dashboard" };
  const ref  = document.referrer;
  let label  = "Home", href = "index.html";
  if (ref) {
    try {
      const u = new URL(ref), page = u.pathname.split("/").pop().replace(".html","") || "index";
      const key = Object.keys(PAGE_LABELS).find(k => k.replace(".html","") === page);
      if (key) { label = PAGE_LABELS[key]; href = ref; }
    } catch(_) {}
  }
  backLbl.textContent = label; backEl.href = href;
  backEl.addEventListener("click", e => { if (ref && href === ref) { e.preventDefault(); history.back(); } });
}

/* ── FIDELITY MINI ───────────────────────────────────────────────────── */
function initFidelityMini(uid) {
  if (!uid) { document.getElementById("fidMini").style.display = "none"; return; }
  const fid = JSON.parse(localStorage.getItem("ride_fidelity_" + uid) || '{"pts":0,"totalEarned":0}');
  const GOLD = 2000;
  const pct  = Math.min((fid.totalEarned / GOLD) * 100, 100);
  document.getElementById("fidPts").textContent = fid.pts.toLocaleString();
  document.getElementById("fidFill").style.width = pct + "%";
  document.getElementById("fidNext").textContent = fid.totalEarned >= GOLD
    ? "Gold tier unlocked ✦"
    : `${Math.max(0, GOLD - fid.totalEarned)} pts to Gold`;
}

/* ── LOCATE ME ───────────────────────────────────────────────────────── */
function initLocateBtn() {
  document.getElementById("locateBtn").addEventListener("click", () => {
    // Simulate locating — pick a random central Rome place
    const defaults = ROME_PLACES.filter(p => p.x > 30 && p.x < 65 && p.y > 35 && p.y < 65);
    const place    = defaults[Math.floor(Math.random() * defaults.length)];
    document.getElementById("inputPickup").value = place.main;
    state.pickup = place;
    checkStep1();
    toast("📍 " + place.main);
  });
}

/* ── QUICK DESTINATIONS ──────────────────────────────────────────────── */
function initQuickDests() {
  document.querySelectorAll(".bk-quick-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const dest = btn.dataset.dest;
      const match = ROME_PLACES.find(p => p.main.toLowerCase().includes(dest.toLowerCase().split(",")[0].toLowerCase().trim()));
      if (match) {
        document.getElementById("inputDropoff").value = match.main;
        state.dropoff = match;
        const clear = document.getElementById("clearDropoff");
        if (clear) clear.style.display = "flex";
        checkStep1();
        if (state.pickup && state.dropoff) {
          MapRenderer.setRoute(state.pickup, state.dropoff);
          assignDriver();
          updateMapStats();
        }
      }
    });
  });

  document.getElementById("clearDropoff").addEventListener("click", () => {
    document.getElementById("inputDropoff").value = "";
    state.dropoff = null;
    document.getElementById("clearDropoff").style.display = "none";
    MapRenderer.clearRoute();
    document.getElementById("mapStats").classList.remove("visible");
    checkStep1();
    document.getElementById("recapRoute").classList.add("hidden");
    document.getElementById("recapDriver").classList.add("hidden");
    document.getElementById("recapGreeting").classList.remove("hidden");
    document.getElementById("earnBanner").style.display = "none";
  });
}

/* ── STEP 1 VALIDATION ───────────────────────────────────────────────── */
function checkStep1() {
  document.getElementById("btnStep1Next").disabled = !(state.pickup && state.dropoff);
}

/* ── PASSENGERS COUNTER ──────────────────────────────────────────────── */
function initPassengerCounter() {
  const val  = document.getElementById("passVal");
  const minus= document.getElementById("passMinus");
  const plus = document.getElementById("passPlus");

  minus.addEventListener("click", () => { if (state.passengers > 1) { state.passengers--; val.textContent = state.passengers; updateRecap(); } });
  plus.addEventListener ("click", () => { if (state.passengers < 4) { state.passengers++; val.textContent = state.passengers; updateRecap(); } });
}

/* ── TIME TOGGLE ─────────────────────────────────────────────────────── */
function initTimeToggle() {
  document.querySelectorAll(".bk-toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".bk-toggle-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.mode = btn.dataset.val;
      document.getElementById("schedulePicker").classList.toggle("hidden", state.mode !== "schedule");
    });
  });

  // Default date/time
  const now = new Date();
  now.setHours(now.getHours() + 1, 0, 0, 0);
  document.getElementById("inputDate").value = now.toISOString().split("T")[0];
  document.getElementById("inputDate").min   = new Date().toISOString().split("T")[0];
  document.getElementById("inputTime").value = now.toTimeString().slice(0,5);
}

/* ── BOOKING CONFIRMATION ────────────────────────────────────────────── */
function confirmBooking() {
  if (!state.vehicle) { toast(t("selectVehicleFirst")); return; }

  const trip = calcTrip(state.pickup, state.dropoff, VEHICLES.find(v => v.id === state.vehicle));
  const veh  = VEHICLES.find(v => v.id === state.vehicle);
  const uid  = localStorage.getItem("current_user_id");

  // Save booking to localStorage
  if (uid) {
    const bk   = "ride_bookings_" + uid;
    const bookings = JSON.parse(localStorage.getItem(bk) || "[]");
    const when = state.mode === "now"
      ? new Date(Date.now() + trip.min * 60000).toISOString()
      : new Date(`${state.date}T${state.time}`).toISOString();
    bookings.unshift({
      id: "b" + Date.now(),
      from: state.pickup.main,
      to:   state.dropoff.main,
      datetime: when,
      car:  veh.name,
      fare: trip.fare,
    });
    localStorage.setItem(bk, JSON.stringify(bookings.slice(0, 20)));

    // Update fidelity points
    const fk  = "ride_fidelity_" + uid;
    const fid = JSON.parse(localStorage.getItem(fk) || '{"pts":0,"redeemed":0,"totalEarned":0}');
    const pts = Math.round(trip.fare);
    fid.pts        += pts;
    fid.totalEarned+= pts;
    localStorage.setItem(fk, JSON.stringify(fid));
  }

  // Build confirmation details
  const details = document.getElementById("confirmDetails");
  const msg     = document.getElementById("confirmMsg");
  msg.textContent = t("confirmMsg");

  details.innerHTML = [
    { k: "Vehicle",     v: esc(veh.name) },
    { k: "Fare",        v: "€" + esc(trip.fare.toFixed(2)) },
    { k: "Route",       v: esc(state.pickup.main) + " → " + esc(state.dropoff.main) },
    { k: "Driver",      v: esc(state.driver?.name || "—") },
    { k: "ETA",         v: esc(String(veh.eta)) + " min" },
    { k: "Points",      v: "+" + esc(String(Math.round(trip.fare))) + " pts" },
  ].map(i => `<div class="bk-conf-item"><span class="bk-conf-key">${i.k}</span><span class="bk-conf-val">${i.v}</span></div>`).join("");

  document.getElementById("confirmOverlay").classList.add("open");
}

/* ── APPLY TRANSLATIONS ──────────────────────────────────────────────── */
function applyBookingTranslations() {
  Lang.apply();
  // Update title
  document.title = t("bookPageTitle");
  // Placeholders
  const inPickup  = document.getElementById("inputPickup");
  const inDropoff = document.getElementById("inputDropoff");
  if (inPickup)  inPickup.placeholder  = t("pickupPlaceholder");
  if (inDropoff) inDropoff.placeholder = t("dropoffPlaceholder");
  const inNotes = document.getElementById("inputNotes");
  if (inNotes) inNotes.placeholder = t("notesPlaceholder");
}

/* ── BOOTSTRAP ───────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  Theme.apply(); Motion.apply(); Lang.apply();

  const user = await Session.get();
  if (user) {
    Lang.apply(); Theme.apply();
    if (user.reduceMotion != null) { Motion.set(user.reduceMotion === "true"); Motion.apply(); }
  }

  // Greeting
  if (user) {
    document.getElementById("greetingName").textContent = user.firstName || "";
    document.getElementById("greetingName").style.display = "";
  } else {
    document.getElementById("greetingName").style.display = "none";
  }

  applyBookingTranslations();

  // Init map
  MapRenderer.init();

  // Init UI components
  initDropdown(user);
  initBackBtn();
  initFidelityMini(user?.id);
  initLocateBtn();
  initQuickDests();
  initPassengerCounter();
  initTimeToggle();

  // Autocomplete
  initAutocomplete("inputPickup", "acPickup", place => {
    state.pickup = place;
    document.getElementById("inputPickup").value = place.main;
    checkStep1();
    if (state.dropoff) {
      MapRenderer.setRoute(state.pickup, state.dropoff);
      assignDriver(); updateMapStats();
    }
  });
  initAutocomplete("inputDropoff", "acDropoff", place => {
    state.dropoff = place;
    document.getElementById("inputDropoff").value = place.main;
    document.getElementById("clearDropoff").style.display = "flex";
    checkStep1();
    if (state.pickup) {
      MapRenderer.setRoute(state.pickup, state.dropoff);
      assignDriver(); updateMapStats();
    }
  });

  // Step navigation
  document.getElementById("btnStep1Next").addEventListener("click", () => {
    if (!state.pickup || !state.dropoff) { toast(t("enterLocations")); return; }
    goStep(2);
  });
  document.getElementById("btnStep2Back").addEventListener("click", () => goStep(1));
  document.getElementById("btnStep2Next").addEventListener("click", () => {
    goStep(3);
    renderVehicles();
  });
  document.getElementById("btnStep3Back").addEventListener("click", () => goStep(2));
  document.getElementById("btnConfirm").addEventListener("click", confirmBooking);

  document.getElementById("btnToDashboard").addEventListener("click", () => {
    window.location.href = "dashboard.html";
  });

  // Theme sync from other tabs
  window.addEventListener("storage", e => {
    if (e.key === "ride_theme")         { Theme.apply(); MapRenderer.redraw(); }
    if (e.key === "ride_reduce_motion") { Motion.apply(); }
    if (e.key === "ride_lang")          { Lang.apply(); applyBookingTranslations(); }
  });

  // Redraw map on theme change (for color tokens)
  const themeObserver = new MutationObserver(() => MapRenderer.redraw());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
});