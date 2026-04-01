"use strict";

/* ════════════════════════════════════════════════════════
   CLIENT-SIDE DATA LAYER (SQLite)
   ════════════════════════════════════════════════════════ */
const DriverData = {
  async getRides(uid) {
    const all = await Booking.list(uid, true);
    return all;
  },
  async toggleOnline(uid, status) {
    await Auth.updateProfile(uid, { online: status ? 1 : 0 });
    return status;
  }
};

/* ── Render overview ───────────────────────────────────────────── */
async function renderOverview(user, uid) {
  const rides = await DriverData.getRides(uid);
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  document.getElementById('wsGreeting').textContent = `${g}, ${user.firstName || 'Driver'} ✦`;
  document.getElementById('wsDate').textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // Stats
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayRides = rides.filter(r => r.status === 'completed' && new Date(r.date) >= todayStart);
  const todayEarn = todayRides.reduce((s, r) => s + (r.fare || 0), 0);
  const totalEarn = rides.filter(r => r.status === 'completed').reduce((s, r) => s + (r.fare || 0), 0);
  document.getElementById('wsTodayEarnings').textContent = '€' + todayEarn.toFixed(2);
  document.getElementById('wsTodayRides').textContent = todayRides.length;
  document.getElementById('wsRating').textContent = '4.9 ★'; // Static for demo
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
    const dot = onlineToggle.querySelector('.dot-indicator');
    if(dot) dot.className = 'dot-indicator ' + (online ? 'online' : 'offline');
    onlineLabel.textContent = online ? 'Online' : 'Offline';
  }

  updateOnlineUI(user.online == 1);

  goOnlineBtn.onclick = onlineToggle.onclick = async () => {
    const next = !(user.online == 1);
    await DriverData.toggleOnline(uid, next);
    user.online = next ? 1 : 0;
    updateOnlineUI(next);
    toast(next ? 'You are now online!' : 'You are now offline.');
  };

  // Assigned rides (none for static demo unless we add logic)
  renderAssigned([]);

  // Recent activity
  renderRecentActivity(rides.slice(0, 5));
}

function renderAssigned(assigned) {
  const body = document.getElementById('assignedRideBody');
  const countEl = document.getElementById('assignedCount');
  if (!assigned || !assigned.length) {
    if(countEl) countEl.style.display = 'none';
    body.innerHTML = '<div class="dd-no-ride">No assigned rides at the moment.</div>';
    return;
  }
  const next = assigned[0];
  if(countEl) { countEl.style.display = ''; countEl.textContent = assigned.length + ' assigned'; }
  body.innerHTML = `
    <div class="dd-ride-row">
      <div class="dd-ride-icon"><svg viewBox="0 0 24 24"><path d="M19 17H5"/><path d="M5 17l-1-5h15l-1 5"/><path d="M8 17v2m8-2v2"/></svg></div>
      <div class="dd-ride-info">
        <div class="dd-ride-route">${esc(next.pickup)} → ${esc(next.destination)}</div>
        <div class="dd-ride-meta">
          <span>${esc(fmtDatetime(next.date))}</span>
          <span>Rider</span>
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
        <div class="dd-ride-route">${esc(r.pickup)} → ${esc(r.destination)}</div>
        <div class="dd-ride-meta">
          <span>${esc(fmtDatetime(r.date))}</span>
          <span class="pill ${statusColor}" style="font-size:10.5px;padding:2px 8px">${esc(r.status)}</span>
          <span>Rider</span>
        </div>
      </div>
      ${r.status === 'completed' ? `<div class="dd-ride-fare">€${parseFloat(r.fare).toFixed(2)}</div>` : ''}
    </div>`;
  }).join('');
}

/* ── Render rides list ─────────────────────────────────────────── */
async function renderRides(uid, filter = 'all') {
  let rides = await DriverData.getRides(uid);
  const body = document.getElementById('ridesListBody');
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
        <div class="dd-ride-route">${esc(r.pickup)} → ${esc(r.destination)}</div>
        <div class="dd-ride-meta">
          <span>${esc(fmtDatetime(r.date))}</span>
          <span class="pill ${statusColor}" style="font-size:10.5px;padding:2px 8px">${esc(r.status)}</span>
          <span>Rider</span>
        </div>
      </div>
      ${r.status === 'completed' ? `<div class="dd-ride-fare">€${parseFloat(r.fare).toFixed(2)}</div>` : ''}
    </div>`;
  }).join('');
}

/* ── Render earnings ───────────────────────────────────────────── */
async function renderEarnings(uid) {
  const rides = await DriverData.getRides(uid);
  const completed = rides.filter(r => r.status === 'completed');

  const now = new Date();
  const todayStart  = new Date(now); todayStart.setHours(0,0,0,0);
  const weekStart   = new Date(now); weekStart.setDate(now.getDate() - now.getDay());  weekStart.setHours(0,0,0,0);
  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1);

  const earn = (from) => completed.filter(r => new Date(r.date) >= from).reduce((s, r) => s + (r.fare || 0), 0);
  document.getElementById('earnToday').textContent  = '€' + earn(todayStart).toFixed(2);
  document.getElementById('earnWeek').textContent   = '€' + earn(weekStart).toFixed(2);
  document.getElementById('earnMonth').textContent  = '€' + earn(monthStart).toFixed(2);
  document.getElementById('earnTotal').textContent  = '€' + completed.reduce((s,r) => s + (r.fare || 0), 0).toFixed(2);

  const body = document.getElementById('earningsHistoryBody');
  if (!completed.length) {
    body.innerHTML = '<div class="dd-empty">No completed rides yet.</div>';
    return;
  }
  body.innerHTML = completed.map(r => `
    <div class="dd-ride-row">
      <div class="dd-ride-icon"><svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
      <div class="dd-ride-info">
        <div class="dd-ride-route">${esc(r.pickup)} → ${esc(r.destination)}</div>
        <div class="dd-ride-meta">
          <span>${esc(fmtDate(r.date))}</span>
          <span>Rider</span>
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

  let user = await Session.get();
  if (!user) {
    window.location.href = 'login.html?redirect=driver-dashboard.html';
    return;
  }
  // In our static demo, we trust the accountType or allow access if on this page
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
    Session.clear(true);
    window.location.href = 'index.html';
  });

  // Sidebar + mobile nav
  document.querySelectorAll('.sb-item[data-panel], .dmn-item[data-panel]').forEach(item => {
    item.addEventListener('click', async e => {
      e.preventDefault();
      const p = item.dataset.panel;
      switchPanel(p);
      if (p === 'overview')  await renderOverview(user, uid);
      if (p === 'rides')     await renderRides(uid);
      if (p === 'earnings')  await renderEarnings(uid);
      if (p === 'account')   renderAccount(user);
    });
  });

  // Rides filter buttons
  document.querySelectorAll('.dd-filter-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.dd-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await renderRides(uid, btn.dataset.filter);
    });
  });

  // Initial render
  await renderOverview(user, uid);
});
