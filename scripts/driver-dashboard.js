"use strict";

function getToken() { return localStorage.getItem('ride_token') || null; }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ── Panel nav ─────────────────────────────────────────────────── */
function switchPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item[data-panel], .dmn-item[data-panel]').forEach(i => i.classList.remove('active'));
  document.getElementById('panel-' + name)?.classList.add('active');
  document.querySelector(`.sb-item[data-panel="${name}"]`)?.classList.add('active');
  document.querySelector(`.dmn-item[data-panel="${name}"]`)?.classList.add('active');
  closeDropdowns();
}

/* ── Dropdowns ─────────────────────────────────────────────────── */
function closeDropdowns() {
  document.querySelectorAll('.st-dropdown').forEach(d => d.classList.remove('open'));
}
document.addEventListener('click', e => {
  if (!e.target.closest('.tb-avatar') && !e.target.closest('.st-dropdown'))
    closeDropdowns();
});

/* ── Toast ─────────────────────────────────────────────────────── */
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

/* ── Date helpers ──────────────────────────────────────────────── */
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDatetime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/* ── Mock driver data (demo) ───────────────────────────────────── */
function getDriverData(uid) {
  const key = 'ride_driver_' + uid;
  const stored = localStorage.getItem(key);
  if (stored) return JSON.parse(stored);

  const now = Date.now();
  const H = 3600000, D = 86400000;
  const data = {
    online: false,
    rating: 4.8,
    rides: [
      { id: 'd1', from: 'Fiumicino Airport', to: 'Hotel Eden, Roma', datetime: new Date(now - 2 * H).toISOString(), status: 'completed', fare: 55.00, passenger: 'Marco R.' },
      { id: 'd2', from: 'Termini Station', to: 'EUR Centro', datetime: new Date(now - 5 * H).toISOString(), status: 'completed', fare: 22.00, passenger: 'Sofia B.' },
      { id: 'd3', from: 'Piazza Navona', to: 'Trastevere', datetime: new Date(now - 1 * D - 1 * H).toISOString(), status: 'completed', fare: 18.50, passenger: 'Luca T.' },
      { id: 'd4', from: 'Parioli', to: 'Colosseo', datetime: new Date(now - 2 * D).toISOString(), status: 'completed', fare: 14.00, passenger: 'Anna M.' },
      { id: 'd5', from: 'Via Veneto', to: 'Ciampino Airport', datetime: new Date(now - 3 * D).toISOString(), status: 'completed', fare: 38.00, passenger: 'Pietro V.' },
      { id: 'd6', from: 'Testaccio', to: 'Ostiense', datetime: new Date(now - 4 * D).toISOString(), status: 'cancelled', fare: 0, passenger: 'Giulia F.' },
      { id: 'd7', from: 'Prati', to: 'Borghese', datetime: new Date(now - 5 * D).toISOString(), status: 'completed', fare: 11.00, passenger: 'Roberto C.' },
      { id: 'd8', from: 'EUR', to: 'Fiumicino Airport', datetime: new Date(now - 7 * D).toISOString(), status: 'completed', fare: 45.00, passenger: 'Emma D.' },
    ],
    assigned: [],
  };
  localStorage.setItem(key, JSON.stringify(data));
  return data;
}
function saveDriverData(uid, data) {
  localStorage.setItem('ride_driver_' + uid, JSON.stringify(data));
}

/* ── Render overview ───────────────────────────────────────────── */
function renderOverview(user, uid) {
  const data = getDriverData(uid);
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  document.getElementById('wsGreeting').textContent = `${g}, ${user.firstName || 'Driver'} ✦`;
  document.getElementById('wsDate').textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // Stats
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayRides = data.rides.filter(r => r.status === 'completed' && new Date(r.datetime) >= todayStart);
  const todayEarn = todayRides.reduce((s, r) => s + r.fare, 0);
  const totalEarn = data.rides.filter(r => r.status === 'completed').reduce((s, r) => s + r.fare, 0);
  document.getElementById('wsTodayEarnings').textContent = '€' + todayEarn.toFixed(2);
  document.getElementById('wsTodayRides').textContent = todayRides.length;
  document.getElementById('wsRating').textContent = data.rating.toFixed(1) + ' ★';
  document.getElementById('wsTotalEarnings').textContent = '€' + totalEarn.toFixed(2);

  // Status card
  const statusPillEl = document.getElementById('statusPill');
  const statusDescEl = document.getElementById('statusDesc');
  const goOnlineBtn  = document.getElementById('goOnlineBtn');
  const onlineToggle = document.getElementById('onlineToggle');
  const onlineLabel  = document.getElementById('onlineLabel');

  function updateOnlineUI(online) {
    statusPillEl.textContent = online ? 'Online' : 'Offline';
    statusPillEl.className = 'pill ' + (online ? 'green' : 'red');
    statusDescEl.textContent = online
      ? 'You are online and will receive ride requests in your area.'
      : 'You are currently offline. Go online to start receiving ride requests.';
    goOnlineBtn.textContent = online ? 'Go Offline' : 'Go Online';
    goOnlineBtn.className = 'dd-go-online-btn' + (online ? ' go-offline' : '');
    onlineToggle.className = 'dd-online-toggle' + (online ? ' online' : '');
    onlineToggle.querySelector('.dot-indicator').className = 'dot-indicator ' + (online ? 'online' : 'offline');
    onlineLabel.textContent = online ? 'Online' : 'Offline';
  }

  updateOnlineUI(data.online);

  goOnlineBtn.onclick = onlineToggle.onclick = () => {
    data.online = !data.online;
    saveDriverData(uid, data);
    updateOnlineUI(data.online);
    toast(data.online ? 'You are now online!' : 'You are now offline.');
  };

  // Assigned rides
  renderAssigned(data);

  // Recent activity
  renderRecentActivity(data.rides.slice(0, 5));
}

function renderAssigned(data) {
  const body = document.getElementById('assignedRideBody');
  const countEl = document.getElementById('assignedCount');
  if (!data.assigned || !data.assigned.length) {
    countEl.style.display = 'none';
    body.innerHTML = '<div class="dd-no-ride">No assigned rides at the moment.</div>';
    return;
  }
  const next = data.assigned[0];
  countEl.style.display = '';
  countEl.textContent = data.assigned.length + ' assigned';
  body.innerHTML = `
    <div class="dd-ride-row">
      <div class="dd-ride-icon"><svg viewBox="0 0 24 24"><path d="M19 17H5"/><path d="M5 17l-1-5h15l-1 5"/><path d="M8 17v2m8-2v2"/></svg></div>
      <div class="dd-ride-info">
        <div class="dd-ride-route">${esc(next.from)} → ${esc(next.to)}</div>
        <div class="dd-ride-meta">
          <span>${esc(fmtDatetime(next.datetime))}</span>
          <span>${esc(next.passenger)}</span>
        </div>
      </div>
      <div class="dd-ride-fare">€${parseFloat(next.fare).toFixed(2)}</div>
    </div>`;
}

function renderRecentActivity(rides) {
  const body = document.getElementById('recentActivityBody');
  if (!rides.length) {
    body.innerHTML = '<div class="dd-empty">No recent activity.</div>';
    return;
  }
  body.innerHTML = rides.map(r => {
    const statusColor = r.status === 'completed' ? 'green' : r.status === 'cancelled' ? 'red' : 'blue';
    return `<div class="dd-ride-row">
      <div class="dd-ride-icon"><svg viewBox="0 0 24 24"><path d="M19 17H5"/><path d="M5 17l-1-5h15l-1 5"/><path d="M8 17v2m8-2v2"/></svg></div>
      <div class="dd-ride-info">
        <div class="dd-ride-route">${esc(r.from)} → ${esc(r.to)}</div>
        <div class="dd-ride-meta">
          <span>${esc(fmtDatetime(r.datetime))}</span>
          <span class="pill ${statusColor}" style="font-size:10.5px;padding:2px 8px">${esc(r.status)}</span>
          ${r.passenger ? `<span>${esc(r.passenger)}</span>` : ''}
        </div>
      </div>
      ${r.status === 'completed' ? `<div class="dd-ride-fare">€${parseFloat(r.fare).toFixed(2)}</div>` : ''}
    </div>`;
  }).join('');
}

/* ── Render rides list ─────────────────────────────────────────── */
function renderRides(uid, filter = 'all') {
  const data = getDriverData(uid);
  const body = document.getElementById('ridesListBody');
  let rides = data.rides;
  if (filter !== 'all') rides = rides.filter(r => r.status === filter);
  if (!rides.length) {
    body.innerHTML = '<div class="dd-empty">No rides found.</div>';
    return;
  }
  body.innerHTML = rides.map(r => {
    const statusColor = r.status === 'completed' ? 'green' : r.status === 'cancelled' ? 'red' : 'blue';
    return `<div class="dd-ride-row">
      <div class="dd-ride-icon"><svg viewBox="0 0 24 24"><path d="M19 17H5"/><path d="M5 17l-1-5h15l-1 5"/><path d="M8 17v2m8-2v2"/></svg></div>
      <div class="dd-ride-info">
        <div class="dd-ride-route">${esc(r.from)} → ${esc(r.to)}</div>
        <div class="dd-ride-meta">
          <span>${esc(fmtDatetime(r.datetime))}</span>
          <span class="pill ${statusColor}" style="font-size:10.5px;padding:2px 8px">${esc(r.status)}</span>
          ${r.passenger ? `<span>${esc(r.passenger)}</span>` : ''}
        </div>
      </div>
      ${r.status === 'completed' ? `<div class="dd-ride-fare">€${parseFloat(r.fare).toFixed(2)}</div>` : ''}
    </div>`;
  }).join('');
}

/* ── Render earnings ───────────────────────────────────────────── */
function renderEarnings(uid) {
  const data = getDriverData(uid);
  const completed = data.rides.filter(r => r.status === 'completed');

  const now = new Date();
  const todayStart  = new Date(now); todayStart.setHours(0,0,0,0);
  const weekStart   = new Date(now); weekStart.setDate(now.getDate() - now.getDay());  weekStart.setHours(0,0,0,0);
  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1);

  const earn = (from) => completed.filter(r => new Date(r.datetime) >= from).reduce((s, r) => s + r.fare, 0);
  document.getElementById('earnToday').textContent  = '€' + earn(todayStart).toFixed(2);
  document.getElementById('earnWeek').textContent   = '€' + earn(weekStart).toFixed(2);
  document.getElementById('earnMonth').textContent  = '€' + earn(monthStart).toFixed(2);
  document.getElementById('earnTotal').textContent  = '€' + completed.reduce((s,r) => s + r.fare, 0).toFixed(2);

  const body = document.getElementById('earningsHistoryBody');
  if (!completed.length) {
    body.innerHTML = '<div class="dd-empty">No completed rides yet.</div>';
    return;
  }
  body.innerHTML = completed.map(r => `
    <div class="dd-ride-row">
      <div class="dd-ride-icon"><svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
      <div class="dd-ride-info">
        <div class="dd-ride-route">${esc(r.from)} → ${esc(r.to)}</div>
        <div class="dd-ride-meta">
          <span>${esc(fmtDate(r.datetime))}</span>
          ${r.passenger ? `<span>${esc(r.passenger)}</span>` : ''}
        </div>
      </div>
      <div class="dd-ride-fare">€${parseFloat(r.fare).toFixed(2)}</div>
    </div>`).join('');
}

/* ── Render account ────────────────────────────────────────────── */
function renderAccount(user) {
  const body = document.getElementById('accountProfileBody');
  const rows = [
    ['First name', user.firstName || '—'],
    ['Last name',  user.lastName  || '—'],
    ['Email',      user.email     || '—'],
    ['Phone',      user.phone     || '—'],
    ['City',       user.city      || '—'],
    ['Account type', '<span class="pill green" style="font-size:11px">Driver</span>'],
    ['Member since', user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : '—'],
  ];
  body.innerHTML = rows.map(([label, val]) =>
    `<div class="dd-profile-row"><span class="dd-profile-label">${label}</span><span class="dd-profile-val">${val}</span></div>`
  ).join('');
}

/* ── Bootstrap ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  Theme.apply(); Lang.apply();

  // Auth: prefer JWT → server profile; fallback to local SQLite session
  let user = null;
  let accountType = 'user';
  const token = getToken();

  if (token) {
    try {
      const profRes = await fetch('/api/profile', { headers: { 'Authorization': 'Bearer ' + token } });
      if (profRes.ok) {
        const profData = await profRes.json();
        user = profData.user;
        accountType = profData.user?.accountType || 'user';
      }
    } catch (_) {}
  }
  if (!user) {
    user = await Session.get();
  }
  if (!user) {
    window.location.href = 'login.html?redirect=driver-dashboard.html';
    return;
  }
  if (accountType !== 'rider') {
    window.location.href = 'dashboard.html';
    return;
  }

  const uid = user.id;
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Driver';

  // Populate topbar/sidebar avatars
  const tbAv = document.getElementById('tbAvatar');
  if (tbAv) tbAv.textContent = user.initials || name[0] || 'D';
  const sbAv = document.getElementById('sbAv');
  if (sbAv) sbAv.textContent = user.initials || name[0] || 'D';
  document.getElementById('sbPname').textContent  = name;
  document.getElementById('sbPemail').textContent = user.email || '—';

  // Profile dropdown
  const ddAv = document.getElementById('ddAvatar');
  if (ddAv) ddAv.textContent = user.initials || name[0] || 'D';
  document.getElementById('ddName').textContent  = name;
  document.getElementById('ddEmail').textContent = user.email || '';

  document.getElementById('tbAvatar').addEventListener('click', () => {
    const dd = document.getElementById('profileDropdown');
    const wasOpen = dd.classList.contains('open');
    closeDropdowns();
    if (!wasOpen) dd.classList.add('open');
  });

  document.getElementById('ddSignOut').addEventListener('click', async () => {
    localStorage.removeItem('ride_token');
    await Session.clear?.();
    window.location.href = 'index.html';
  });

  // Sidebar + mobile nav
  document.querySelectorAll('.sb-item[data-panel], .dmn-item[data-panel]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const p = item.dataset.panel;
      switchPanel(p);
      if (p === 'overview')  renderOverview(user, uid);
      if (p === 'rides')     renderRides(uid);
      if (p === 'earnings')  renderEarnings(uid);
      if (p === 'account')   renderAccount(user);
    });
  });

  // Rides filter buttons
  document.querySelectorAll('.dd-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dd-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderRides(uid, btn.dataset.filter);
    });
  });

  // Initial render
  renderOverview(user, uid);
});
