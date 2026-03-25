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
    name: "Porsche 718",
    sub: "Precision handling. City-ready performance.",
    img: "data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 70' fill='none'><rect x='5' y='32' width='130' height='26' rx='8' fill='%233d5eff' fill-opacity='0.12'/><path d='M22 32 Q32 14 52 10 L88 10 Q108 14 118 32Z' fill='%233d5eff' fill-opacity='0.2'/><circle cx='37' cy='58' r='10' fill='%233d5eff' fill-opacity='0.3'/><circle cx='103' cy='58' r='10' fill='%233d5eff' fill-opacity='0.3'/></svg>",
    ratePerKm: 1.80,
    baseFare: 5.0,
    eta: 4,
    capacity: 2,
    badge: null,
    features: ["2 seats", "Sport", "A/C"],
    unlocked: true,
  },
  {
    id: "business",
    name: "Mercedes S-Class",
    sub: "Flagship comfort for business and first-class travel.",
    img: "data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 70' fill='none'><rect x='5' y='32' width='130' height='26' rx='8' fill='%238b9ab5' fill-opacity='0.12'/><path d='M22 32 Q32 14 52 10 L88 10 Q108 14 118 32Z' fill='%238b9ab5' fill-opacity='0.2'/><circle cx='37' cy='58' r='10' fill='%238b9ab5' fill-opacity='0.3'/><circle cx='103' cy='58' r='10' fill='%238b9ab5' fill-opacity='0.3'/></svg>",
    ratePerKm: 2.20,
    baseFare: 8.0,
    eta: 6,
    capacity: 4,
    badge: { label: "Popular", cls: "new" },
    features: ["4 seats", "Premium A/C", "Leather"],
    unlocked: true,
  },
  {
    id: "premium",
    name: "Rolls-Royce Ghost",
    sub: "Unmatched refinement. Silence as a feature.",
    img: "data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 70' fill='none'><rect x='5' y='32' width='130' height='26' rx='8' fill='%23d4af37' fill-opacity='0.15'/><path d='M22 32 Q32 14 52 10 L88 10 Q108 14 118 32Z' fill='%23d4af37' fill-opacity='0.22'/><circle cx='37' cy='58' r='10' fill='%23d4af37' fill-opacity='0.35'/><circle cx='103' cy='58' r='10' fill='%23d4af37' fill-opacity='0.35'/></svg>",
    ratePerKm: 4.50,
    baseFare: 20.0,
    eta: 10,
    capacity: 4,
    badge: { label: "Luxury", cls: "gold" },
    features: ["4 seats", "Chauffeur", "Champagne"],
    unlocked: true,
  },
  {
    id: "electric",
    name: "Tesla Model S Plaid",
    sub: "Zero emissions. Full performance. AI-native.",
    img: "data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 70' fill='none'><rect x='5' y='32' width='130' height='26' rx='8' fill='%2322c55e' fill-opacity='0.12'/><path d='M22 32 Q32 14 52 10 L88 10 Q108 14 118 32Z' fill='%2322c55e' fill-opacity='0.2'/><circle cx='37' cy='58' r='10' fill='%2322c55e' fill-opacity='0.3'/><circle cx='103' cy='58' r='10' fill='%2322c55e' fill-opacity='0.3'/></svg>",
    ratePerKm: 1.60,
    baseFare: 5.5,
    eta: 5,
    capacity: 4,
    badge: { label: "Eco", cls: "eco" },
    features: ["4 seats", "Zero CO₂", "Autopilot"],
    unlocked: true,
  },
  {
    id: "supercar",
    name: "Lamborghini Urus",
    sub: "The Ride signature. Raw presence, every arrival.",
    img: "data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 70' fill='none'><rect x='5' y='32' width='130' height='26' rx='8' fill='%23f59e0b' fill-opacity='0.12'/><path d='M22 32 Q32 14 52 10 L88 10 Q108 14 118 32Z' fill='%23f59e0b' fill-opacity='0.2'/><circle cx='37' cy='58' r='10' fill='%23f59e0b' fill-opacity='0.3'/><circle cx='103' cy='58' r='10' fill='%23f59e0b' fill-opacity='0.3'/></svg>",
    ratePerKm: 5.50,
    baseFare: 30.0,
    eta: 8,
    capacity: 4,
    badge: { label: "Signature", cls: "gold" },
    features: ["4 seats", "Supercar", "Track-ready"],
    unlocked: true,
  },
  {
    id: "xl",
    name: "Range Rover Autobiography",
    sub: "Group travel with no compromise on luxury.",
    img: "data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 70' fill='none'><rect x='5' y='32' width='130' height='26' rx='8' fill='%23a78bfa' fill-opacity='0.12'/><path d='M22 32 Q32 14 52 10 L88 10 Q108 14 118 32Z' fill='%23a78bfa' fill-opacity='0.2'/><circle cx='37' cy='58' r='10' fill='%23a78bfa' fill-opacity='0.3'/><circle cx='103' cy='58' r='10' fill='%23a78bfa' fill-opacity='0.3'/></svg>",
    ratePerKm: 2.80,
    baseFare: 12.0,
    eta: 9,
    capacity: 7,
    badge: null,
    features: ["7 seats", "XL Luggage", "Premium"],
    unlocked: true,
  },
];

const DRIVERS = [
  { name: "Marco V.", emoji: "👨‍✈️", since: "2023", rating: 4.97, review: "Extremely professional, always on time. The car was immaculate every single trip.", reviewer: "Giulia T.", reviewDate: "March 2026" },
  { name: "Sofia R.", emoji: "👩‍✈️", since: "2022", rating: 4.95, review: "Smooth ride and great conversation. Knows the best routes to avoid traffic.", reviewer: "Luca B.", reviewDate: "February 2026" },
  { name: "Andrea C.", emoji: "🧑‍✈️", since: "2024", rating: 4.92, review: "Super punctual and very kind. Highly recommended for airport transfers.", reviewer: "Elena M.", reviewDate: "March 2026" },
  { name: "Valentina F.", emoji: "👩", since: "2021", rating: 4.99, review: "The best Ride driver I've ever had. Impeccable service every time.", reviewer: "Roberto P.", reviewDate: "March 2026" },
];

/* ── GOOGLE MAPS ──────────────────────────────────────────────────────── */
const DARK_MAP_STYLE = [
  { elementType: "geometry",            stylers: [{ color: "#0d1117" }] },
  { elementType: "labels.text.fill",    stylers: [{ color: "#4a5568" }] },
  { elementType: "labels.text.stroke",  stylers: [{ color: "#0d1117" }] },
  { featureType: "road",                elementType: "geometry",        stylers: [{ color: "#1a1f2e" }] },
  { featureType: "road",                elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road.highway",        elementType: "geometry",        stylers: [{ color: "#2c3347" }] },
  { featureType: "road",                elementType: "labels.text.fill",stylers: [{ color: "#4a5568" }] },
  { featureType: "water",               elementType: "geometry",        stylers: [{ color: "#0d1520" }] },
  { featureType: "poi",                 stylers: [{ visibility: "off" }] },
  { featureType: "transit",             stylers: [{ visibility: "off" }] },
  { featureType: "administrative",      elementType: "geometry",        stylers: [{ color: "#1e2433" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
];

const LIGHT_MAP_STYLE = [
  { featureType: "poi",     stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

let gmap = null, directionsService = null, directionsRenderer = null, geocoder = null;

window.initMap = async function() {
  const { Map }                   = await google.maps.importLibrary("maps");
  const { DirectionsService,
          DirectionsRenderer }    = await google.maps.importLibrary("routes");
  const { Geocoder }              = await google.maps.importLibrary("geocoding");

  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  geocoder          = new Geocoder();
  directionsService = new DirectionsService();

  gmap = new Map(document.getElementById("map"), {
    center:           { lat: 41.9, lng: 12.49 },
    zoom:             12,
    styles:           isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE,
    disableDefaultUI: true,
    gestureHandling:  "greedy",
    clickableIcons:   false,
  });

  directionsRenderer = new DirectionsRenderer({
    map:             gmap,
    suppressMarkers: false,
    polylineOptions: { strokeColor: "#3d5eff", strokeWeight: 5, strokeOpacity: 0.9 },
  });

  new MutationObserver(() => {
    if (!gmap) return;
    const dark = document.documentElement.getAttribute("data-theme") !== "light";
    gmap.setOptions({ styles: dark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  wireAutocomplete();
};

function calcRoute() {
  if (!state.pickup || !state.dropoff || !directionsService) return;
  directionsService.route({
    origin:      { lat: state.pickup.lat,  lng: state.pickup.lng  },
    destination: { lat: state.dropoff.lat, lng: state.dropoff.lng },
    travelMode:  google.maps.TravelMode.DRIVING,
  }, (result, status) => {
    if (status === "OK") {
      directionsRenderer.setDirections(result);
      updateRouteStats(result.routes[0].legs[0]);
      assignDriver();
    } else {
      console.warn("Directions failed:", status);
    }
  });
}

function updateRouteStats(leg) {
  const km   = parseFloat((leg.distance.value / 1000).toFixed(1));
  const min  = Math.round(leg.duration.value / 60);
  state.distKm      = km;
  state.durationMin = min;

  const arrival = new Date(Date.now() + leg.duration.value * 1000);
  const arrStr  = arrival.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const veh  = VEHICLES.find(v => v.id === state.vehicle) || VEHICLES[0];
  const fare = veh.baseFare + km * veh.ratePerKm;
  state.fareEur = parseFloat(fare.toFixed(2));

  document.getElementById("statDuration").textContent = min + " min";
  document.getElementById("statDistance").textContent = km  + " km";
  document.getElementById("statArrival").textContent  = arrStr;
  document.getElementById("statFare").textContent     = "€" + fare.toFixed(2);
  document.getElementById("mapStats").classList.add("visible");
  // Mobile inline stats strip
  const mob = document.getElementById("mobStats");
  if (mob) {
    document.getElementById("mobTime").textContent = min + " min";
    document.getElementById("mobDist").textContent = km  + " km";
    document.getElementById("mobFare").textContent = "€" + fare.toFixed(2);
    mob.classList.add("visible");
  }
  updateRecap();
  // Re-render vehicle list prices if user is already on step 3
  if (state.step === 3) renderVehicles();
}

/* Update stats bar fare when vehicle selection changes */
function refreshStatsFare() {
  if (!state.distKm || !state.vehicle) return;
  const veh  = VEHICLES.find(v => v.id === state.vehicle) || VEHICLES[0];
  const fare = veh.baseFare + state.distKm * veh.ratePerKm;
  state.fareEur = parseFloat(fare.toFixed(2));
  const fareStr = "€" + fare.toFixed(2);
  const el = document.getElementById("statFare");
  if (el) el.textContent = fareStr;
  const mob = document.getElementById("mobFare");
  if (mob) mob.textContent = fareStr;
}

/* ── LOCATION LOOKUP (mock geocoder — fallback if Maps not loaded) ─────── */
const ROME_PLACES = [
  { main: "Piazza Navona",          sub: "Centro Storico, Roma",           lat: 41.8992, lng: 12.4730 },
  { main: "Fiumicino Airport",      sub: "Via dell'Aeroporto, Fiumicino",  lat: 41.7999, lng: 12.2462 },
  { main: "Roma Termini Station",   sub: "Piazza dei Cinquecento, Roma",   lat: 41.9009, lng: 12.4975 },
  { main: "Colosseum",              sub: "Piazza del Colosseo, Roma",      lat: 41.8902, lng: 12.4922 },
  { main: "Vatican City",           sub: "Città del Vaticano, Roma",       lat: 41.9022, lng: 12.4539 },
  { main: "Trastevere",             sub: "Rione Trastevere, Roma",         lat: 41.8887, lng: 12.4675 },
  { main: "Piazza Venezia",         sub: "Centro Storico, Roma",           lat: 41.8958, lng: 12.4823 },
  { main: "Villa Borghese",         sub: "Viale dei Bambini, Roma",        lat: 41.9143, lng: 12.4922 },
];

/* ── STATE ───────────────────────────────────────────────────────────── */
const state = {
  step: 1,
  pickup: null,   // { main, sub, lat, lng }
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
  // Use real data from state if set by updateRouteStats; fall back to straight-line estimate
  const km  = state.distKm     || 7;
  const min = state.durationMin || Math.round(km * 2.5 + 4);
  const v   = vehicle || VEHICLES[0];
  const fare = v.baseFare + km * v.ratePerKm;
  return { km: parseFloat(km.toFixed(1)), min, fare: parseFloat(fare.toFixed(2)) };
}

/* ── AUTOCOMPLETE (Google Places — AutocompleteSuggestion API) ────────── */
async function wireAutocomplete() {
  const { AutocompleteSuggestion } = await google.maps.importLibrary("places");

  const PIN_SVG = `<svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>`;

  function setupInput(inputEl, acContainer, onSelect) {
    let debounceTimer = null;

    inputEl.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      const val = inputEl.value.trim();
      acContainer.innerHTML = "";
      if (val.length < 2) { acContainer.classList.remove("open"); return; }

      debounceTimer = setTimeout(async () => {
        try {
          const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: val,
            includedRegionCodes: ["it"],
          });
          acContainer.innerHTML = "";
          if (!suggestions.length) { acContainer.classList.remove("open"); return; }

          acContainer.classList.add("open");
          suggestions.slice(0, 5).forEach(s => {
            const pred = s.placePrediction;
            const item = document.createElement("div");
            item.className = "bk-ac-item";
            const icon = document.createElement("span");
            icon.className = "bk-ac-icon";
            icon.innerHTML = PIN_SVG;
            const txt = document.createElement("span");
            const main = document.createElement("div");
            main.className = "bk-ac-main";
            main.textContent = pred.mainText.toString();
            const sub = document.createElement("div");
            sub.className = "bk-ac-sub";
            sub.textContent = pred.secondaryText ? pred.secondaryText.toString() : "";
            txt.appendChild(main);
            txt.appendChild(sub);
            item.appendChild(icon);
            item.appendChild(txt);
            item.addEventListener("click", async () => {
              inputEl.value = pred.mainText.toString();
              acContainer.classList.remove("open");
              acContainer.innerHTML = "";
              const place = pred.toPlace();
              await place.fetchFields({ fields: ["location", "displayName", "formattedAddress"] });
              onSelect({
                main: place.displayName || pred.mainText.toString(),
                sub:  place.formattedAddress || (pred.secondaryText ? pred.secondaryText.toString() : ""),
                lat:  place.location.lat(),
                lng:  place.location.lng(),
              });
            });
            acContainer.appendChild(item);
          });
        } catch (_) { acContainer.classList.remove("open"); }
      }, 200);
    });

    document.addEventListener("click", e => {
      if (!inputEl.contains(e.target) && !acContainer.contains(e.target)) {
        acContainer.classList.remove("open");
      }
    });
  }

  setupInput(
    document.getElementById("inputPickup"),
    document.getElementById("acPickup"),
    loc => { state.pickup = loc; checkStep1(); if (state.dropoff) calcRoute(); }
  );

  setupInput(
    document.getElementById("inputDropoff"),
    document.getElementById("acDropoff"),
    loc => {
      state.dropoff = loc;
      document.getElementById("clearDropoff").style.display = "flex";
      checkStep1();
      if (state.pickup) calcRoute();
    }
  );
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
    const isSelected = v.id === state.vehicle;

    return `<div class="bk-vehicle-card${isSelected ? " selected" : ""}" data-vid="${v.id}">
      ${v.badge ? `<span class="bk-vc-badge ${v.badge.cls}">${v.badge.label}</span>` : ""}
      <div class="bk-vc-top">
        <div class="bk-vc-img">
          <img src="${esc(v.img)}" alt="${esc(v.name)}">
        </div>
        <div class="bk-vc-info">
          <div class="bk-vc-name">${esc(v.name)}</div>
          <div class="bk-vc-sub">${esc(v.sub)}</div>
          <div class="bk-vc-features">${v.features.map(f => `<span>${esc(f)}</span>`).join("")}</div>
        </div>
      </div>
      <div class="bk-vc-bottom">
        <div class="bk-vc-meta">
          <span class="bk-vc-meta-item"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" fill="none"/><polyline points="12 6 12 12 16 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>${v.eta} min ETA</span>
          <span class="bk-vc-meta-item"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>${v.capacity} seats</span>
        </div>
        <div class="bk-vc-price">€${trip_v.fare.toFixed(2)}<span class="per-km"> €${v.ratePerKm.toFixed(2)}/km</span></div>
      </div>
    </div>`;
  }).join("");

  list.querySelectorAll(".bk-vc-img img").forEach(img => {
    img.addEventListener("error", function() { this.style.display = "none"; });
  });

  list.querySelectorAll(".bk-vehicle-card").forEach(card => {
    card.addEventListener("click", () => {
      state.vehicle = card.dataset.vid;
      list.querySelectorAll(".bk-vehicle-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      document.getElementById("btnConfirm").disabled = false;
      refreshStatsFare();
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
    if (!navigator.geolocation) { toast("Geolocation not supported"); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      const latLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (geocoder) {
        geocoder.geocode({ location: latLng }, (results, status) => {
          if (status === "OK" && results[0]) {
            const res  = results[0];
            const name = res.address_components?.find(c => c.types.includes("route"))?.long_name
                      || res.formatted_address;
            state.pickup = { main: name, sub: res.formatted_address, lat: latLng.lat, lng: latLng.lng };
            document.getElementById("inputPickup").value = name;
            checkStep1();
            toast("📍 " + name);
            if (state.dropoff) calcRoute();
          }
        });
      } else {
        // Maps not loaded yet — use coords as label
        state.pickup = { main: "My location", sub: "", lat: latLng.lat, lng: latLng.lng };
        document.getElementById("inputPickup").value = "My location";
        checkStep1();
        toast("📍 My location");
      }
    }, () => toast("Could not get your location"));
  });
}

/* ── CLEAR DROPOFF ───────────────────────────────────────────────────── */
function initClearDropoff() {
  document.getElementById("clearDropoff").addEventListener("click", () => {
    document.getElementById("inputDropoff").value = "";
    state.dropoff = null;
    state.distKm = 0; state.durationMin = 0;
    document.getElementById("clearDropoff").style.display = "none";
    if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
    document.getElementById("mapStats").classList.remove("visible");
    // Reset mobile stats strip so stale values are not shown
    const mob = document.getElementById("mobStats");
    if (mob) {
      mob.classList.remove("visible");
      document.getElementById("mobTime").textContent = "—";
      document.getElementById("mobDist").textContent = "—";
      document.getElementById("mobFare").textContent = "—";
    }
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
  // Mode toggle buttons
  document.querySelectorAll(".bk-toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".bk-toggle-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.mode = btn.dataset.val;
      document.getElementById("schedulePicker").classList.toggle("hidden", state.mode !== "schedule");
    });
  });

  const dayEl  = document.getElementById("inputDay");
  const monEl  = document.getElementById("inputMonth");
  const yearEl = document.getElementById("inputYear");
  const hourEl = document.getElementById("inputHour");
  const minEl  = document.getElementById("inputMinute");

  // Populate month select
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  MONTHS.forEach((m, i) => {
    const o = document.createElement("option");
    o.value = String(i + 1).padStart(2, "0");
    o.textContent = m;
    monEl.appendChild(o);
  });

  // Populate year select (current + 2 years)
  const curYear = new Date().getFullYear();
  for (let y = curYear; y <= curYear + 2; y++) {
    const o = document.createElement("option");
    o.value = y;
    o.textContent = y;
    yearEl.appendChild(o);
  }

  // Populate hour select (00–23)
  for (let h = 0; h < 24; h++) {
    const o = document.createElement("option");
    o.value = o.textContent = String(h).padStart(2, "0");
    hourEl.appendChild(o);
  }

  // Populate minute select (every 5 min)
  for (let m = 0; m < 60; m += 5) {
    const o = document.createElement("option");
    o.value = o.textContent = String(m).padStart(2, "0");
    minEl.appendChild(o);
  }

  // Rebuild day options to match the real number of days for the selected month/year.
  // new Date(year, month, 0) returns the last day of the previous month,
  // so new Date(year, month, 0).getDate() gives the correct max day.
  function updateDays() {
    const month  = parseInt(monEl.value,  10);
    const year   = parseInt(yearEl.value, 10);
    const maxDay = new Date(year, month, 0).getDate();
    const prevDay = parseInt(dayEl.value || "1", 10);
    dayEl.innerHTML = "";
    for (let d = 1; d <= maxDay; d++) {
      const o = document.createElement("option");
      o.value = String(d).padStart(2, "0");
      o.textContent = d;
      dayEl.appendChild(o);
    }
    // Clamp to last valid day (e.g. if Feb was selected when day was 31, cap to 28/29)
    dayEl.value = String(Math.min(prevDay, maxDay)).padStart(2, "0");
  }

  // Default: next rounded hour
  const now = new Date();
  now.setHours(now.getHours() + 1, 0, 0, 0);
  monEl.value  = String(now.getMonth() + 1).padStart(2, "0");
  yearEl.value = now.getFullYear();
  updateDays(); // must run after month/year are set
  dayEl.value  = String(now.getDate()).padStart(2, "0");
  hourEl.value = String(now.getHours()).padStart(2, "0");
  minEl.value  = "00";

  function syncState() {
    state.date = `${yearEl.value}-${monEl.value}-${dayEl.value}`;
    state.time = `${hourEl.value}:${minEl.value}`;
  }
  syncState();

  // Re-generate days whenever month or year changes, then sync
  monEl.addEventListener("change",  () => { updateDays(); syncState(); });
  yearEl.addEventListener("change", () => { updateDays(); syncState(); });
  [dayEl, hourEl, minEl].forEach(el => el.addEventListener("change", syncState));
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

  // Init UI components (map initialised via window.initMap Google Maps callback)
  initDropdown(user);
  initBackBtn();
  initFidelityMini(user?.id);
  initLocateBtn();
  initClearDropoff();
  initPassengerCounter();
  initTimeToggle();

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

  // Theme / lang sync from other tabs
  window.addEventListener("storage", e => {
    if (e.key === "ride_reduce_motion") Motion.apply();
    if (e.key === "ride_lang")          { Lang.apply(); applyBookingTranslations(); }
  });
});