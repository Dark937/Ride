"use strict";

/* ════════════════════════════════════════════════════════
   SERVER API HELPERS
   ════════════════════════════════════════════════════════ */
function getToken() { return localStorage.getItem('ride_token') || null; }

async function apiRequest(method, path, body) {
  const token = getToken();
  if (!token) return null;
  try {
    const opts = { method, headers: { 'Authorization': 'Bearer ' + token } };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const r = await fetch(path, opts);
    if (!r.ok) return null;
    return r.json();
  } catch (_) { return null; }
}

/* Sync server data → localStorage, auto-complete past rides, award points */
async function syncFromServer(uid) {
  const token = getToken();
  if (!token) return;
  try {
    const allBookings = await apiRequest('GET', '/api/bookings');
    if (!allBookings) return;

    const now = Date.now();
    // Auto-complete upcoming rides whose end time has passed
    const toComplete = allBookings.filter(b =>
      b.status === 'upcoming' &&
      new Date(b.datetime).getTime() + (b.durationMin || 30) * 60000 < now
    );
    await Promise.all(toComplete.map(b =>
      apiRequest('POST', `/api/bookings/${b._id}/complete`)
    ));

    // Reload after completions
    const refreshed = toComplete.length
      ? (await apiRequest('GET', '/api/bookings'))
      : allBookings;
    if (!refreshed) return;

    const upcoming   = refreshed.filter(b => b.status === 'upcoming').map(b => ({
      id: b._id, from: b.from, to: b.to, datetime: b.datetime,
      car: b.car, fare: b.fare, durationMin: b.durationMin, passengers: b.passengers, notes: b.notes,
    }));
    const completed  = refreshed.filter(b => b.status !== 'upcoming').map(b => ({
      id: b._id, from: b.from, to: b.to, date: b.completedAt || b.datetime,
      status: b.status, fare: b.fare, car: b.car, pts: b.pts || Math.round(b.fare),
    }));

    localStorage.setItem('ride_bookings_' + uid, JSON.stringify(upcoming));
    if (completed.length) localStorage.setItem('ride_rides_' + uid, JSON.stringify(completed));

    const fid = await apiRequest('GET', '/api/fidelity');
    if (fid) localStorage.setItem('ride_fidelity_' + uid, JSON.stringify(fid));
  } catch (_) {}
}

/* ════════════════════════════════════════════════════════
   DATA LAYER
   ════════════════════════════════════════════════════════ */
const RideData = {
  K: k => k + '_' + (localStorage.getItem('current_user_id')||''),
  seed() { /* no demo data — histories are empty by default */ },
  getRides(uid)       { return JSON.parse(localStorage.getItem('ride_rides_'+uid)||'[]'); },
  getBookings(uid)    { return JSON.parse(localStorage.getItem('ride_bookings_'+uid)||'[]'); },
  getCards(uid)       { return JSON.parse(localStorage.getItem('ride_cards_'+uid)||'[]'); },
  getFid(uid)         { return JSON.parse(localStorage.getItem('ride_fidelity_'+uid)||'{"pts":0,"redeemed":0,"totalEarned":0}'); },
  getFidHistory(uid)  { return JSON.parse(localStorage.getItem('ride_fidelity_history_'+uid)||'[]'); },
  saveFidHistory(uid,v){ localStorage.setItem('ride_fidelity_history_'+uid, JSON.stringify(v)); },
  saveCards(uid,v)    { localStorage.setItem('ride_cards_'+uid, JSON.stringify(v)); },
  saveBookings(uid,v) { localStorage.setItem('ride_bookings_'+uid, JSON.stringify(v)); },
  getWallet(uid)      { return parseFloat(localStorage.getItem('ride_wallet_'+uid)||'0'); },
  getWalletTxs(uid)  { return JSON.parse(localStorage.getItem('ride_wallet_txs_'+uid)||'[]'); },
  saveWallet(uid,bal,txs){ localStorage.setItem('ride_wallet_'+uid,String(bal)); localStorage.setItem('ride_wallet_txs_'+uid,JSON.stringify(txs)); },
};

/* ════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════ */
function toast(msg) {
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2600);
}
function fmtDate(iso,short=false) {
  const d=new Date(iso);
  if(short) return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}
function fmtDatetime(iso) {
  const d=new Date(iso);
  return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})+
         ' · '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
}
function statusPill(s) {
  const m={completed:'green',cancelled:'red',ongoing:'blue'};
  return `<span class="pill ${m[s]||'blue'}">${s.charAt(0).toUpperCase()+s.slice(1)}</span>`;
}

/* ════════════════════════════════════════════════════════
   PANEL NAV
   ════════════════════════════════════════════════════════ */
const PANEL_TITLES={dashboard:'Dashboard',fidelity:'My Fidelity',payments:'Wallet',account:'My Account'};
function switchPanel(name) {
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.sb-item[data-panel]').forEach(i=>i.classList.remove('active'));
  document.querySelectorAll('.dmn-item[data-panel]').forEach(i=>i.classList.remove('active'));
  document.getElementById('panel-'+name)?.classList.add('active');
  document.querySelector(`.sb-item[data-panel="${name}"]`)?.classList.add('active');
  document.querySelector(`.dmn-item[data-panel="${name}"]`)?.classList.add('active');
  closeAllDropdowns();
}

/* ════════════════════════════════════════════════════════
   TOPBAR DROPDOWNS
   ════════════════════════════════════════════════════════ */
function closeAllDropdowns() {
  document.querySelectorAll('.tb-dropdown,.st-dropdown').forEach(d=>d.classList.remove('open'));
}
function toggleDropdown(id) {
  const dd=document.getElementById(id);
  const wasOpen=dd.classList.contains('open');
  closeAllDropdowns();
  if(!wasOpen) dd.classList.add('open');
}
document.addEventListener('click', e=>{
  if(!e.target.closest('.tb-icon-btn')&&!e.target.closest('.tb-avatar')&&!e.target.closest('.tb-dropdown')&&!e.target.closest('.st-dropdown')&&!e.target.closest('#tbAvatar'))
    closeAllDropdowns();
});

/* ════════════════════════════════════════════════════════
   DASHBOARD PANEL
   ════════════════════════════════════════════════════════ */
function renderDashboard(user, uid) {
  const rides=RideData.getRides(uid), bookings=RideData.getBookings(uid), fid=RideData.getFid(uid);
  const h=new Date().getHours();
  const g=h<12?'Good morning':h<18?'Good afternoon':'Good evening';
  document.getElementById('wsGreeting').textContent=`${g}, ${user.firstName||'Rider'} ✦`;
  document.getElementById('wsDate').textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const ms=new Date(); ms.setDate(1); ms.setHours(0,0,0,0);
  const completedRides=rides.filter(r=>r.status==='completed');
  const monthSpent=completedRides.filter(r=>new Date(r.date)>=ms).reduce((s,r)=>s+r.fare,0);
  document.getElementById('wsRides').textContent=completedRides.length;
  document.getElementById('wsPts').textContent=fid.pts.toLocaleString();
  document.getElementById('wsSpent').textContent='€'+monthSpent.toFixed(0);
  document.getElementById('wsWallet').textContent='€'+RideData.getWallet(uid).toFixed(2);
  renderNextRide(bookings,uid);
  // Fidelity mini
  const pct=Math.min((fid.totalEarned/GOLD_THRESHOLD)*100,100);
  const isGoldMini=fid.totalEarned>=GOLD_THRESHOLD;
  document.getElementById('fidMiniPts').textContent=fid.pts.toLocaleString();
  document.getElementById('fidMiniBar').style.width=pct+'%';
  document.getElementById('fidMiniNext').textContent=
    isGoldMini?`${pct.toFixed(0)}% · ${Lang.t('goldUnlocked')}`:`${pct.toFixed(0)}% · ${Lang.t('ptsToGold').replace('{n}',Math.max(0,GOLD_THRESHOLD-fid.totalEarned))}`;
  const tierLabelEl=document.getElementById('fidMiniTierLabel');
  if(tierLabelEl) tierLabelEl.textContent=isGoldMini?Lang.t('tierGold'):Lang.t('tierStandard');
  renderRecentRides(rides.slice(0,5));
  renderInsights(uid, rides);
  renderChart(rides,'week');
}

function renderNextRide(bookings,uid) {
  const body=document.getElementById('nextRideBody');
  const badge=document.getElementById('nextRideCount');
  if(!bookings||!bookings.length) {
    badge.style.display='none';
    body.innerHTML=`<div class="nr-empty"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><p>${Lang.t('noUpcomingRides')}</p></div><button class="nr-book-btn" id="bookRideBtn"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>${Lang.t('bookRide')}</button>`;
    document.getElementById('bookRideBtn')?.addEventListener('click', () => { window.location.href = 'book-ride.html'; });
    return;
  }
  const next=bookings[0];
  badge.style.display=''; badge.textContent=bookings.length+' upcoming';
  const more=bookings.length>1?`<div class="nr-more" id="seeAllUpcoming">+ ${bookings.length-1} more — tap to manage</div>`:'';
  body.innerHTML=`<div class="nr-ride"><div class="nr-route"><div class="nr-point"><span class="nr-dot from"></span>${esc(next.from)}</div><div class="nr-connector"></div><div class="nr-point"><span class="nr-dot to"></span>${esc(next.to)}</div></div><div class="nr-meta"><span class="nr-meta-item"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${esc(fmtDatetime(next.datetime))}</span><span class="nr-meta-item"><svg viewBox="0 0 24 24"><path d="M19 17H5"/><path d="M5 17l-1-5h15l-1 5"/><path d="M8 17v2m8-2v2"/></svg>${esc(next.car)}</span><span class="nr-meta-item" style="color:var(--brand)">€${esc(next.fare.toFixed(2))}</span></div><div class="nr-actions"><button class="nr-btn primary" id="bookAnotherBtn">${Lang.t('bookAnother')}</button><button class="nr-btn ghost" id="editNextRideBtn">Edit</button><button class="nr-btn ghost" data-cancel="${esc(next.id)}" data-uid="${esc(uid)}">${Lang.t('cancelRide')}</button></div>${more}</div>`;
  document.getElementById('bookAnotherBtn')?.addEventListener('click', () => { window.location.href = 'book-ride.html'; });
  document.getElementById('editNextRideBtn')?.addEventListener('click', () => openEditRide(next, uid));
  document.getElementById('seeAllUpcoming')?.addEventListener('click',()=>openUpcoming(bookings,uid));
  document.querySelector(`[data-cancel="${next.id}"]`)?.addEventListener('click',()=>cancelBooking(next.id,uid));
}

async function cancelBooking(id,uid) {
  const booking = RideData.getBookings(uid).find(b=>b.id===id);
  const confirmed = await showCancelConfirm(booking);
  if (!confirmed) return;
  await apiRequest('DELETE', `/api/bookings/${id}`);
  const b=RideData.getBookings(uid).filter(x=>x.id!==id);
  RideData.saveBookings(uid,b); renderNextRide(b,uid);
  if(document.getElementById('upcomingOverlay').classList.contains('open')) openUpcoming(b,uid);
  toast('Ride cancelled.');
}

function showCancelConfirm(booking) {
  return new Promise(resolve => {
    document.getElementById('cancelConfirmOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'cancelConfirmOverlay';
    overlay.className = 'so-overlay';
    overlay.innerHTML = `
      <div class="so-box" role="dialog" aria-modal="true">
        <div class="so-icon" style="color:var(--accent)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h3>${Lang.t('cancelRideQ')}</h3>
        <p>Ride to <strong>${esc(booking?.to||'destination')}</strong> will be removed. This cannot be undone.</p>
        <div class="so-actions">
          <button class="so-cancel" id="ccKeep">${Lang.t('keepRide')}</button>
          <button class="so-confirm" id="ccDo" style="background:var(--accent);color:#fff">${Lang.t('cancelRide')}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    const close = v => { overlay.classList.remove('is-open'); setTimeout(()=>overlay.remove(),300); resolve(v); };
    overlay.querySelector('#ccKeep').addEventListener('click', () => close(false));
    overlay.querySelector('#ccDo').addEventListener('click',  () => close(true));
    overlay.addEventListener('click', e => { if(e.target===overlay) close(false); });
  });
}
function showRedeemConfirm(couponName, cost) {
  return new Promise(resolve => {
    const overlay = document.getElementById('redeemOverlay');
    if (!overlay) { resolve(confirm(`Redeem "${couponName}" for ${cost} pts?`)); return; }
    document.getElementById('redeemDesc').textContent = `"${couponName}"`;
    document.getElementById('redeemCost').textContent = cost.toLocaleString() + ' pts';
    overlay.classList.add('open');
    const close = v => { overlay.classList.remove('open'); resolve(v); };
    const cancelBtn = document.getElementById('redeemCancel');
    const confirmBtn = document.getElementById('redeemConfirmBtn');
    const cancelClone = cancelBtn.cloneNode(true);
    const confirmClone = confirmBtn.cloneNode(true);
    cancelBtn.replaceWith(cancelClone);
    confirmBtn.replaceWith(confirmClone);
    cancelClone.addEventListener('click', () => close(false));
    confirmClone.addEventListener('click', () => close(true));
    overlay.addEventListener('click', e => { if(e.target===overlay) close(false); }, {once:true});
  });
}

function openUpcoming(bookings,uid) {
  const ol=document.getElementById('upcomingList');
  ol.innerHTML=bookings.map(b=>`<div class="upcoming-item"><div class="ui-date">${esc(fmtDatetime(b.datetime))}</div><div><div class="ui-point"><span class="nr-dot from" style="margin-right:8px"></span>${esc(b.from)}</div><div style="width:1px;height:7px;background:var(--border-md);margin:2px 0 2px 3.5px"></div><div class="ui-point"><span class="nr-dot to" style="margin-right:8px"></span>${esc(b.to)}</div></div><div style="font-size:12px;color:var(--muted);margin:6px 0">${esc(b.car)} · €${esc(b.fare.toFixed(2))}</div><div class="ui-actions"><button class="ui-btn cancel" data-cancel="${esc(b.id)}" data-uid="${esc(uid)}">Cancel</button><button class="ui-btn edit" data-edit="${esc(b.id)}" data-uid="${esc(uid)}">Edit</button></div></div>`).join('');
  ol.querySelectorAll('[data-cancel]').forEach(btn=>btn.addEventListener('click',()=>cancelBooking(btn.dataset.cancel,btn.dataset.uid)));
  ol.querySelectorAll('[data-edit]').forEach(btn=>btn.addEventListener('click',()=>{
    const booking=RideData.getBookings(uid).find(b=>b.id===btn.dataset.edit);
    if(booking) openEditRide(booking, uid);
  }));
  document.getElementById('upcomingOverlay').classList.add('open');
}

/* ════════════════════════════════════════════════════════
   EDIT RIDE MODAL
   ════════════════════════════════════════════════════════ */
function openEditRide(booking, uid) {
  // Remove any existing edit modal
  document.getElementById('editRideOverlay')?.remove();

  const dt = new Date(booking.datetime);
  const pad = n => String(n).padStart(2,'0');
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const overlay = document.createElement('div');
  overlay.id = 'editRideOverlay';
  overlay.className = 'upcoming-overlay';
  overlay.style.cssText = 'z-index:1100';
  overlay.innerHTML = `
    <div class="er-modal">
      <div class="er-header">
        <div class="er-header-left">
          <div class="er-header-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <div>
            <div class="er-header-title">Edit Ride</div>
            <div class="er-header-sub">${esc(booking.car)} · €${booking.fare.toFixed(2)}</div>
          </div>
        </div>
        <button class="er-close" id="editRideClose"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>

      <div class="er-route">
        <div class="er-route-point"><span class="nr-dot from"></span><span class="er-route-text">${esc(booking.from)}</span></div>
        <div class="er-route-connector"></div>
        <div class="er-route-point"><span class="nr-dot to"></span><span class="er-route-text">${esc(booking.to)}</span></div>
      </div>

      <div class="er-body">
        <div class="er-section">
          <div class="er-label">Date &amp; Time</div>
          <div class="er-date-row">
            <select id="erDay" class="er-select er-select-sm">
              ${Array.from({length:31},(_,i)=>`<option value="${pad(i+1)}" ${i+1===dt.getDate()?'selected':''}>${i+1}</option>`).join('')}
            </select>
            <select id="erMonth" class="er-select er-select-lg">
              ${MONTHS.map((m,i)=>`<option value="${pad(i+1)}" ${i===dt.getMonth()?'selected':''}>${m}</option>`).join('')}
            </select>
            <select id="erYear" class="er-select er-select-md">
              ${[0,1,2].map(o=>{const y=new Date().getFullYear()+o;return`<option value="${y}" ${y===dt.getFullYear()?'selected':''}>${y}</option>`;}).join('')}
            </select>
            <div class="er-time-sep">at</div>
            <select id="erHour" class="er-select er-select-sm">
              ${Array.from({length:24},(_,i)=>`<option value="${pad(i)}" ${i===dt.getHours()?'selected':''}>${pad(i)}</option>`).join('')}
            </select>
            <div class="er-time-sep">:</div>
            <select id="erMinute" class="er-select er-select-sm">
              ${Array.from({length:12},(_,i)=>`<option value="${pad(i*5)}" ${Math.round(dt.getMinutes()/5)*5===i*5?'selected':''}>${pad(i*5)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="er-section">
          <div class="er-label">Passengers</div>
          <div class="er-stepper">
            <button id="erPassMinus" class="er-step-btn">−</button>
            <span id="erPassVal" class="er-step-val">${booking.passengers||1}</span>
            <button id="erPassPlus" class="er-step-btn">+</button>
            <span class="er-step-label">of 7 max</span>
          </div>
        </div>

        <div class="er-section">
          <div class="er-label">Notes for driver</div>
          <textarea id="erNotes" class="er-textarea" rows="3" placeholder="e.g. extra luggage, special requests…">${esc(booking.notes||'')}</textarea>
        </div>

        <div class="er-actions">
          <button id="erSave" class="er-btn primary">Save changes</button>
          <button id="erCancel" class="er-btn ghost">Discard</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('open'), 10);

  let passengers = booking.passengers || 1;
  const passVal = overlay.querySelector('#erPassVal');
  overlay.querySelector('#erPassMinus').addEventListener('click', () => { if(passengers>1){passengers--;passVal.textContent=passengers;} });
  overlay.querySelector('#erPassPlus').addEventListener('click',  () => { if(passengers<7){passengers++;passVal.textContent=passengers;} });

  const close = () => { overlay.classList.remove('open'); setTimeout(()=>overlay.remove(),300); };
  overlay.querySelector('#editRideClose').addEventListener('click', close);
  overlay.querySelector('#erCancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if(e.target===overlay) close(); });

  overlay.querySelector('#erSave').addEventListener('click', async () => {
    const day=overlay.querySelector('#erDay').value;
    const mon=overlay.querySelector('#erMonth').value;
    const yr =overlay.querySelector('#erYear').value;
    const hr =overlay.querySelector('#erHour').value;
    const mn =overlay.querySelector('#erMinute').value;
    const notes=overlay.querySelector('#erNotes').value.trim();
    const newDatetime = `${yr}-${mon}-${day}T${hr}:${mn}`;

    // Conflict check (excluding current booking)
    const others = RideData.getBookings(uid).filter(b=>b.id!==booking.id && b.status!=='cancelled');
    const newStartMs = new Date(newDatetime).getTime();
    const durationMin = booking.durationMin || 30;
    const newEndMs = newStartMs + durationMin * 60000;
    const conflict = others.find(b => {
      const bS=new Date(b.datetime).getTime();
      const bE=bS+(b.durationMin||30)*60000;
      return newStartMs < bE && newEndMs > bS;
    });
    if(conflict) { toast('⚠ Conflict with ride to '+conflict.to); return; }

    // Try server first
    const saved = await apiRequest('PUT', `/api/bookings/${booking.id}`, {
      datetime: new Date(newDatetime).toISOString(),
      passengers,
      notes,
    });

    // Update localStorage
    const bookings = RideData.getBookings(uid).map(b =>
      b.id===booking.id ? {...b, datetime:new Date(newDatetime).toISOString(), passengers, notes} : b
    );
    RideData.saveBookings(uid, bookings);

    close();
    renderNextRide(bookings, uid);
    if(document.getElementById('upcomingOverlay').classList.contains('open')) openUpcoming(bookings, uid);
    toast('Ride updated.');
  });
}

function renderInsights(uid, rides) {
  const el = document.getElementById('insightsCard');
  if (!el) return;
  const completed = (rides || RideData.getRides(uid)).filter(r => r.status === 'completed');

  if (!completed.length) {
    el.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:12px 0;text-align:center">${Lang.t('noInsights')}</div>`;
    return;
  }

  // Top destination (most frequent `to`)
  const destCount = {};
  completed.forEach(r => { destCount[r.to] = (destCount[r.to]||0)+1; });
  const topDest = Object.entries(destCount).sort((a,b)=>b[1]-a[1])[0][0];

  // Average fare
  const avgFare = completed.reduce((s,r)=>s+r.fare,0)/completed.length;

  // Total distance (estimated from fare: ~€0.9/km)
  const totalKm = Math.round(completed.reduce((s,r)=>s+r.fare,0)/0.9);

  // Rides this month
  const ms = new Date(); ms.setDate(1); ms.setHours(0,0,0,0);
  const monthRides = completed.filter(r=>new Date(r.date)>=ms).length;

  const stat = (label, value, sub='') => `
    <div class="ins-stat">
      <div class="ins-val">${value}</div>
      <div class="ins-label">${label}</div>
      ${sub?`<div class="ins-sub">${sub}</div>`:''}
    </div>`;

  el.innerHTML = `
    <div class="ins-top-dest">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
      <div>
        <div class="ins-dest-label">${Lang.t('topDest')}</div>
        <div class="ins-dest-val">${esc(topDest)}</div>
      </div>
    </div>
    <div class="ins-grid">
      ${stat(Lang.t('avgFare'), '€'+avgFare.toFixed(2))}
      ${stat(Lang.t('totalDist'), totalKm+' km')}
      ${stat(Lang.t('monthRides'), monthRides)}
    </div>`;
}

function renderRecentRides(rides) {
  const tb=document.getElementById('recentRidesTbody');
  if(!rides.length){tb.innerHTML=`<tr><td colspan="4" style="color:var(--muted);text-align:center;padding:16px 0">No rides yet.</td></tr>`;return;}
  tb.innerHTML=rides.map(r=>`<tr><td><div class="ride-route-cell"><div class="rr-from"><span class="rd from"></span>${esc(r.from)}</div><div class="rr-conn"></div><div class="rr-to"><span class="rd to"></span>${esc(r.to)}</div></div></td><td class="ride-date">${esc(fmtDate(r.date,true))}</td><td>${statusPill(r.status)}</td><td class="ride-fare">${r.status==='cancelled'?'<span style="color:var(--faint)">—</span>':'€'+esc(String(r.fare.toFixed(2)))}</td></tr>`).join('');
}

/* ── CHART — SVG cartesian grid ── */
const CHART_DATA={
  week(rides){
    // Last 7 days (today − 6 → today), so there's always data visible
    const today=new Date();
    const DAY_NAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return Array.from({length:7},(_,i)=>{
      const d=new Date(today);d.setDate(d.getDate()-(6-i));d.setHours(0,0,0,0);
      const nd=new Date(d);nd.setDate(nd.getDate()+1);
      const s=rides.filter(r=>r.status==='completed'&&new Date(r.date)>=d&&new Date(r.date)<nd).reduce((a,r)=>a+r.fare,0);
      return {label:DAY_NAMES[d.getDay()],val:s};
    });
  },
  month(rides){
    const b=Array.from({length:4},(_,i)=>({label:`W${i+1}`,val:0}));
    const ms=new Date();ms.setDate(1);ms.setHours(0,0,0,0);
    rides.filter(r=>r.status==='completed'&&new Date(r.date)>=ms).forEach(r=>{
      b[Math.min(Math.floor((new Date(r.date).getDate()-1)/7),3)].val+=r.fare;
    });return b;
  },
  year(rides){
    const mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const yr=new Date().getFullYear();
    return mo.map((m,i)=>({label:m,val:rides.filter(r=>r.status==='completed'&&new Date(r.date).getFullYear()===yr&&new Date(r.date).getMonth()===i).reduce((a,r)=>a+r.fare,0)}));
  },
  all(rides){
    const map={};
    rides.filter(r=>r.status==='completed').forEach(r=>{
      const d=new Date(r.date),k=d.getFullYear()+'/'+String(d.getMonth()+1).padStart(2,'0');
      map[k]=(map[k]||0)+r.fare;
    });
    return Object.entries(map).sort(([a],[b])=>a<b?-1:1).map(([k,v])=>({label:k.slice(5),val:v}));
  }
};

let _chartRides=[],_chartRange='week';
function renderChart(rides,range){
  _chartRides=rides;_chartRange=range;
  document.querySelectorAll('.chart-tab').forEach(t=>t.classList.toggle('active',t.dataset.range===range));
  const data=CHART_DATA[range]?CHART_DATA[range](rides):[];
  const total=data.reduce((s,d)=>s+d.val,0);
  const nonZero=data.filter(d=>d.val>0);
  const avg=nonZero.length?nonZero.reduce((s,d)=>s+d.val,0)/nonZero.length:0;
  // Count rides in this range (not all rides)
  const rangeRideCount=data.reduce((s,d)=>s+(d.val>0?1:0),0); // periods with rides
  // More accurate: sum actual ride counts per period
  let rangeCompletedCount=0;
  if(range==='week'){
    const since=new Date();since.setDate(since.getDate()-6);since.setHours(0,0,0,0);
    rangeCompletedCount=rides.filter(r=>r.status==='completed'&&new Date(r.date)>=since).length;
  } else if(range==='month'){
    const ms=new Date();ms.setDate(1);ms.setHours(0,0,0,0);
    rangeCompletedCount=rides.filter(r=>r.status==='completed'&&new Date(r.date)>=ms).length;
  } else if(range==='year'){
    const yr=new Date().getFullYear();
    rangeCompletedCount=rides.filter(r=>r.status==='completed'&&new Date(r.date).getFullYear()===yr).length;
  } else {
    rangeCompletedCount=rides.filter(r=>r.status==='completed').length;
  }
  document.getElementById('chartSummary').innerHTML=`
    <div class="cs-item"><div class="cs-val" style="color:var(--brand)">€${total.toFixed(0)}</div><div class="cs-label">Total</div></div>
    <div class="cs-item"><div class="cs-val" style="color:var(--muted)">€${avg.toFixed(0)}</div><div class="cs-label">Avg/period</div></div>
    <div class="cs-item"><div class="cs-val" style="color:var(--green)">${rangeCompletedCount}</div><div class="cs-label">Rides</div></div>`;

  const svg=document.getElementById('chartSvg');
  const wrap=document.getElementById('chartSvgWrap');
  const W=Math.max(wrap?wrap.clientWidth:400,200),H=140,PAD={t:14,r:14,b:28,l:42};
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  const cW=W-PAD.l-PAD.r, cH=H-PAD.t-PAD.b;
  const max=Math.max(...data.map(d=>d.val),1);
  const yTicks=4;
  const tickStep=max/yTicks;
  // Nice tick labels: use k for thousands
  const fmtTick=v=>v>=1000?`€${(v/1000).toFixed(v%1000===0?0:1)}k`:`€${Math.round(v)}`;
  let html=`<defs>
    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3d5eff" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#3d5eff" stop-opacity="0.3"/>
    </linearGradient>
    <linearGradient id="barGradHover" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#6b8aff" stop-opacity="1"/>
      <stop offset="100%" stop-color="#3d5eff" stop-opacity="0.7"/>
    </linearGradient>
  </defs>`;
  // grid lines + y labels
  for(let i=0;i<=yTicks;i++){
    const y=PAD.t+cH-(i/yTicks)*cH;
    html+=`<line x1="${PAD.l}" y1="${y.toFixed(1)}" x2="${W-PAD.r}" y2="${y.toFixed(1)}" class="chart-grid-line" vector-effect="non-scaling-stroke"/>`;
    html+=`<text x="${PAD.l-7}" y="${(y+3.5).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--faint)" font-family="DM Mono,monospace">${fmtTick(tickStep*i)}</text>`;
  }
  // Bars + x labels
  const n=data.length;
  const barW=Math.max(6,(cW/n)*0.52);
  const gap=(cW-barW*n)/(n+1);
  data.forEach((d,i)=>{
    const bH=d.val>0?Math.max((d.val/max)*cH,4):0;
    const x=PAD.l+gap+(barW+gap)*i;
    const y=PAD.t+cH-bH;
    html+=`<rect class="chart-bar-rect" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bH.toFixed(1)}" rx="4" fill="url(#barGrad)" data-val="${d.val.toFixed(2)}" data-label="${d.label}"/>`;
    html+=`<text x="${(x+barW/2).toFixed(1)}" y="${H-8}" text-anchor="middle" font-size="9" fill="var(--faint)" font-family="DM Sans,sans-serif">${d.label}</text>`;
  });
  svg.innerHTML=html;

  // Tooltip events
  const tt=document.getElementById('chartTooltip');
  svg.querySelectorAll('.chart-bar-rect').forEach(bar=>{
    bar.addEventListener('mouseenter',e=>{
      const r=bar.getBoundingClientRect();
      tt.textContent=`${bar.dataset.label}: €${parseFloat(bar.dataset.val).toFixed(2)}`;
      tt.style.left=(r.left+r.width/2)+'px';
      tt.style.top=(r.top-32)+'px';
      tt.style.transform='translateX(-50%)';
      tt.classList.add('show');
      bar.setAttribute('fill','url(#barGradHover)');
    });
    bar.addEventListener('mouseleave',()=>{tt.classList.remove('show');bar.setAttribute('fill','url(#barGrad)');});
  });
}

/* ════════════════════════════════════════════════════════
   FIDELITY PANEL
   ════════════════════════════════════════════════════════ */

const PARTNER_COUPONS = [
  {id:'c1', badge:'partner',  badgeLabel:'Partner',   icon:'🍽️', name:'20% off at Eataly',      desc:'Valid on your next purchase over €30', cost:150, discount:null},
  {id:'c2', badge:'free',     badgeLabel:'Free ride', icon:'🚗', name:'Free ride up to €15',     desc:'Redeem for any city ride',             cost:200, discount:{type:'free',   value:15}},
  {id:'c3', badge:'discount', badgeLabel:'Discount',  icon:'🏷️', name:'€10 off next ride',       desc:'Applied automatically at checkout',    cost:100, discount:{type:'fixed',  value:10}},
  {id:'c4', badge:'partner',  badgeLabel:'Partner',   icon:'☕', name:'Free coffee at Lavazza',  desc:'One free espresso at any Lavazza café', cost:50,  discount:null},
  {id:'c5', badge:'partner',  badgeLabel:'Partner',   icon:'🚂', name:'15% off at Trenitalia',   desc:'On regional trains, valid 30 days',    cost:300, discount:null},
  {id:'c6', badge:'discount', badgeLabel:'Discount',  icon:'💳', name:'€5 wallet credit',        desc:'Added to your Ride wallet instantly',   cost:60,  discount:{type:'wallet', value:5}},
];

function generateCouponCode() {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = 'RIDE-';
  for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

function showCouponSuccess(name, code) {
  document.getElementById('couponSuccessOverlay')?.remove();
  const el = document.createElement('div');
  el.id = 'couponSuccessOverlay';
  el.className = 'upcoming-overlay';
  el.style.zIndex = '1200';
  el.innerHTML = `<div class="upcoming-modal" style="max-width:340px;text-align:center;padding:28px 24px">
    <div style="font-size:38px;margin-bottom:14px">🎫</div>
    <div style="font-size:15px;font-weight:700;margin-bottom:6px">${esc(name)}</div>
    <div style="font-size:12.5px;color:var(--muted);margin-bottom:18px">Your coupon code:</div>
    <div style="font-family:monospace;font-size:22px;font-weight:800;letter-spacing:.14em;color:var(--brand);
      background:var(--brand-dim);border:1px solid var(--border-md);border-radius:10px;padding:14px 20px;
      margin-bottom:14px">${esc(code)}</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:22px">Use this code at checkout when booking a ride.<br>Valid for 30 days.</div>
    <button class="fh-btn" id="csOk" style="width:100%;background:var(--brand);color:#fff;border:none;border-radius:10px;padding:12px;font-size:14px;font-weight:600;cursor:pointer">Got it</button>
  </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('open'));
  const close = () => { el.classList.remove('open'); setTimeout(() => el.remove(), 300); };
  document.getElementById('csOk').addEventListener('click', close);
  el.addEventListener('click', e => { if (e.target === el) close(); });
}

function doRedeem(cp, uid, pts) {
  if (pts < cp.cost) { toast('Not enough points to redeem this coupon.'); return false; }

  // Deduct points
  const fid = RideData.getFid(uid);
  fid.pts -= cp.cost;
  fid.redeemed = (fid.redeemed || 0) + cp.cost;
  localStorage.setItem('ride_fidelity_' + uid, JSON.stringify(fid));

  // Save redemption event to fidelity history
  const fidHist = RideData.getFidHistory(uid);
  fidHist.unshift({ type:'redeem', pts: -cp.cost, label: 'Redeemed: ' + cp.name, date: new Date().toISOString() });
  RideData.saveFidHistory(uid, fidHist.slice(0, 50));

  const code = generateCouponCode();
  const expiry = new Date(); expiry.setDate(expiry.getDate() + 30);
  const coupons = JSON.parse(localStorage.getItem('ride_coupons_' + uid) || '[]');
  coupons.push({ code, id: cp.id, name: cp.name, discount: cp.discount, desc: cp.desc,
    used: false, expiresAt: expiry.toISOString(), redeemedAt: new Date().toISOString() });
  localStorage.setItem('ride_coupons_' + uid, JSON.stringify(coupons));

  // Wallet credit handled immediately
  if (cp.discount?.type === 'wallet') {
    const bal = RideData.getWallet(uid) + cp.discount.value;
    const txs = RideData.getWalletTxs(uid);
    txs.unshift({ type:'credit', label:'Fidelity reward: ' + cp.name, date: new Date().toISOString(), amount: cp.discount.value });
    RideData.saveWallet(uid, bal, txs);
  }

  showCouponSuccess(cp.name, code);
  return true;
}

function renderPartnerCoupons(pts) {
  const el = document.getElementById('partnerCouponList');
  if (!el) return;
  const shown = PARTNER_COUPONS.slice(0, 3);
  el.innerHTML = shown.map(cp => {
    const canAfford = pts >= cp.cost;
    return `
    <div class="coupon-item" data-id="${cp.id}" style="${!canAfford?'opacity:.6':''}">
      <span class="coupon-badge ${cp.badge}">${cp.badgeLabel}</span>
      <div class="coupon-info">
        <div class="coupon-name">${cp.icon} ${cp.name}</div>
        <div class="coupon-desc">${cp.desc}</div>
        ${!canAfford?`<div class="coupon-used">Need ${(cp.cost-pts).toLocaleString()} more pts</div>`:''}
      </div>
      <div class="coupon-cost" style="color:${canAfford?'var(--brand)':'var(--faint)'}">${cp.cost} pts</div>
    </div>`;
  }).join('');
  document.getElementById('couponsAvail').textContent = PARTNER_COUPONS.length + ' available';

  el.querySelectorAll('.coupon-item').forEach(item => {
    item.addEventListener('click', async () => {
      const cp = PARTNER_COUPONS.find(x => x.id === item.dataset.id);
      if (!cp) return;
      if (pts < cp.cost) { toast('Not enough points.'); return; }
      const uid2 = localStorage.getItem('current_user_id'); if (!uid2) return;
      const ok = await showRedeemConfirm(cp.name, cp.cost);
      if (ok && doRedeem(cp, uid2, pts)) renderFidelity(uid2);
    });
  });
}

function openCouponModal(title, coupons, pts) {
  document.getElementById('couponModalTitle').textContent = title;
  const list = document.getElementById('couponModalList');
  list.innerHTML = coupons.map(cp => {
    const canAfford = pts >= cp.cost;
    return `
    <div class="coupon-item" data-id="${cp.id}" style="${!canAfford?'opacity:.65':''}">
      <div class="coupon-item-icon">${cp.icon}</div>
      <div class="coupon-info">
        <div class="coupon-name">${cp.name}</div>
        <div class="coupon-desc">${cp.desc}</div>
        ${!canAfford?`<div class="coupon-used" style="font-size:11px;color:var(--faint);margin-top:4px">Need ${(cp.cost-pts).toLocaleString()} more pts</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
        <span class="coupon-badge ${cp.badge}">${cp.badgeLabel}</span>
        <div class="coupon-cost" style="color:${canAfford?'var(--brand)':'var(--faint)'}">${cp.cost} pts</div>
      </div>
    </div>`;
  }).join('');
  list.querySelectorAll('.coupon-item').forEach(item => {
    item.addEventListener('click', async () => {
      const cp = coupons.find(x => x.id === item.dataset.id);
      if (!cp) return;
      if (pts < cp.cost) { toast('Not enough points.'); return; }
      const uid2 = localStorage.getItem('current_user_id'); if (!uid2) return;
      const ok = await showRedeemConfirm(cp.name, cp.cost);
      if (ok) {
        document.getElementById('couponOverlay').classList.remove('open');
        if (doRedeem(cp, uid2, pts)) renderFidelity(uid2);
      }
    });
  });
  document.getElementById('couponOverlay').classList.add('open');
}
const GOLD_THRESHOLD=2000;
function renderFidelity(uid){
  const fid=RideData.getFid(uid);
  const rides=RideData.getRides(uid).filter(r=>r.status==='completed');
  const isGold=fid.totalEarned>=GOLD_THRESHOLD;
  const pct=Math.min((fid.totalEarned/GOLD_THRESHOLD)*100,100);

  // Hero card
  document.getElementById('fidHeroPts').textContent=fid.pts.toLocaleString();
  document.getElementById('fidHeroBar').style.width=pct+'%';
  document.getElementById('fhTierBadge').textContent=isGold?`✦ ${Lang.t('tierGold')} Tier`:`✦ ${Lang.t('tierStandard')} Tier`;
  document.getElementById('fidHeroNext').textContent=isGold
    ?Lang.t('goldUnlocked')
    :Lang.t('ptsToGold').replace('{n}',Math.max(0,GOLD_THRESHOLD-fid.totalEarned).toLocaleString());

  // Physical card preview
  const fcpPts=document.getElementById('fcpPts');
  const fcpTier=document.getElementById('fcpTier');
  if(fcpPts) fcpPts.textContent=fid.pts.toLocaleString()+' pts';
  if(fcpTier) fcpTier.textContent=isGold?Lang.t('tierGold').toUpperCase():Lang.t('tierStandard').toUpperCase();

  // Stats
  document.getElementById('fsAvailable').textContent=fid.pts.toLocaleString();
  document.getElementById('fsTotal').textContent=fid.totalEarned.toLocaleString();
  document.getElementById('fsRedeemed').textContent=fid.redeemed.toLocaleString();
  document.getElementById('fsTier').textContent=isGold?Lang.t('tierGold'):Lang.t('tierStandard');
  const infoTier=document.getElementById('infoTier');
  if(infoTier) infoTier.textContent=isGold?Lang.t('tierGold'):Lang.t('tierStandard');

  // Tier cards
  const t2=document.getElementById('tier2Card');
  const t2badge=document.getElementById('tier2Badge');
  const t2msg=document.getElementById('tier2UnlockMsg');
  const t2ptsNeeded=document.getElementById('tier2PtsNeeded');
  if(isGold){
    t2.classList.remove('locked'); t2.classList.add('active-tier');
    t2badge.textContent='Active'; t2badge.className='ftc-badge active';
    if(t2msg) t2msg.style.display='none';
  } else {
    t2.classList.add('locked'); t2.classList.remove('active-tier');
    t2badge.textContent='Locked'; t2badge.className='ftc-badge locked';
    if(t2msg) t2msg.style.display='';
    if(t2ptsNeeded) t2ptsNeeded.textContent=(GOLD_THRESHOLD-fid.totalEarned).toLocaleString();
  }

  // Partner coupons grid (show 4 in grid)
  const grid=document.getElementById('partnerCouponList');
  if(grid){
    const shown=PARTNER_COUPONS.slice(0,4);
    grid.innerHTML=shown.map(cp=>{
      const canAfford=fid.pts>=cp.cost;
      return `
      <div class="coupon-item" data-id="${cp.id}" style="${!canAfford?'opacity:.6':''}">
        <div class="coupon-item-top">
          <span class="coupon-badge ${cp.badge}">${cp.badgeLabel}</span>
          <span class="coupon-cost-tag" style="color:${canAfford?'var(--brand)':'var(--faint)'}">${cp.cost} pts</span>
        </div>
        <div class="coupon-name">${cp.icon} ${cp.name}</div>
        <div class="coupon-desc-short">${cp.desc}</div>
        ${!canAfford?`<div style="font-size:10.5px;color:var(--faint);margin-top:2px">Need ${(cp.cost-fid.pts).toLocaleString()} more pts</div>`:''}
      </div>`;
    }).join('');
    grid.querySelectorAll('.coupon-item').forEach(item=>{
      item.addEventListener('click', async ()=>{
        const cp=PARTNER_COUPONS.find(x=>x.id===item.dataset.id);
        if(!cp) return;
        if(fid.pts<cp.cost){toast('Not enough points to redeem this coupon.');return;}
        const ok = await showRedeemConfirm(cp.name, cp.cost);
        if(ok && doRedeem(cp, uid, fid.pts)) renderFidelity(uid);
      });
    });
    document.getElementById('couponsAvail').textContent=PARTNER_COUPONS.length+' available';
  }

  // See all / wire buttons (remove old listeners by cloning)
  const exploreBtn=document.getElementById('exploreBtn');
  const redeemBtn=document.getElementById('redeemBtn');
  const seeAllBtn=document.getElementById('seeAllCoupons');
  if(exploreBtn){
    const e2=exploreBtn.cloneNode(true);exploreBtn.replaceWith(e2);
    e2.addEventListener('click',ev=>{ev.preventDefault();openCouponModal('Explore Rewards',PARTNER_COUPONS,fid.pts);});
  }
  if(redeemBtn){
    const r2=redeemBtn.cloneNode(true);redeemBtn.replaceWith(r2);
    r2.addEventListener('click',ev=>{ev.preventDefault();openCouponModal('Redeem Points',PARTNER_COUPONS,fid.pts);});
  }
  if(seeAllBtn){
    const s2=seeAllBtn.cloneNode(true);seeAllBtn.replaceWith(s2);
    s2.addEventListener('click',()=>openCouponModal('All Rewards',PARTNER_COUPONS,fid.pts));
  }

  // History — build from real completed rides + real redemption events
  const histEl=document.getElementById('fidHistory');
  const earnEntries=rides.map(r=>({
    type:'earn', pts:+(r.pts||Math.round(r.fare)), label:'Ride to '+esc(r.to), date:r.date
  }));
  const redeemEntries=RideData.getFidHistory(uid).filter(e=>e.type==='redeem').map(e=>({
    type:'redeem', pts:e.pts, label:esc(e.label), date:e.date
  }));
  const allEntries=[...earnEntries,...redeemEntries]
    .sort((a,b)=>new Date(b.date)-new Date(a.date))
    .slice(0,12);
  if(!allEntries.length){
    histEl.innerHTML=`<div style="color:var(--muted);font-size:13px;padding:16px 0;text-align:center">No points history yet.</div>`;
  } else {
    histEl.innerHTML=allEntries.map(e=>{
      const plus=e.type==='earn';
      const ptsLabel=plus?`+${e.pts}`:`${e.pts}`;
      return `<div class="fid-row"><div class="fid-row-icon" style="background:${plus?'var(--green-dim)':'var(--accent-dim)'};color:${plus?'var(--green)':'var(--accent)'}"><svg viewBox="0 0 24 24">${plus?'<polyline points="18 15 12 9 6 15"/>':'<polyline points="6 9 12 15 18 9"/>'}</svg></div><div class="fid-row-info"><div class="fid-row-title">${e.label}</div><div class="fid-row-date">${esc(fmtDate(e.date))}</div></div><div class="fid-row-pts ${plus?'plus':'minus'}">${ptsLabel} pts</div></div>`;
    }).join('');
  }
}

/* ════════════════════════════════════════════════════════
   PAYMENTS / WALLET PANEL
   ════════════════════════════════════════════════════════ */
function renderPayments(uid){renderWallet(uid);renderCards(uid);initAddCard(uid);}

function renderWallet(uid) {
  const bal = RideData.getWallet(uid);
  const txs = RideData.getWalletTxs(uid);

  const balEl = document.getElementById('walletBalance');
  if (balEl) balEl.textContent = bal.toFixed(2);

  // Show only real wallet transactions (top-ups, wallet-paid rides, fidelity credits)
  const allTxs = [...txs].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,20);

  const listEl = document.getElementById('walletTxList');
  if (listEl) {
    if (!allTxs.length) {
      listEl.innerHTML = `<div class="wallet-empty">${Lang.t('noTransactions')}</div>`;
    } else {
      listEl.innerHTML = allTxs.map(tx => `
        <div class="wallet-tx">
          <div class="wallet-tx-icon ${tx.type}">
            <svg viewBox="0 0 24 24">${tx.type==='credit'
              ? '<polyline points="18 15 12 9 6 15"/>'
              : '<polyline points="6 9 12 15 18 9"/>'}
            </svg>
          </div>
          <div class="wallet-tx-info">
            <div class="wallet-tx-label">${esc(tx.label)}</div>
            <div class="wallet-tx-date">${esc(fmtDate(tx.date))}</div>
          </div>
          <div class="wallet-tx-amount ${tx.type}">${tx.type==='credit'?'+':'−'}€${tx.amount.toFixed(2)}</div>
        </div>`).join('');
    }
  }

  // Preset & custom add buttons
  const customInput = document.getElementById('walletCustomAmt');
  const addBtn = document.getElementById('walletAddBtn');
  document.querySelectorAll('.wallet-preset').forEach(btn => {
    btn.onclick = () => { if (customInput) { customInput.value = btn.dataset.amount; customInput.focus(); } };
  });
  if (addBtn) {
    addBtn.onclick = async () => {
      const v = parseFloat(customInput?.value||'0');
      if (!v || v < 1 || v > 500) { toast('Enter an amount between €1 and €500.'); return; }
      addBtn.disabled = true;
      try { await addToWallet(uid, v); if (customInput) customInput.value = ''; }
      finally { addBtn.disabled = false; }
    };
  }
}

const WALLET_MAX_PER_HOUR = 500; // max €500/hour
const WALLET_MAX_TOPUPS_PER_HOUR = 5; // max 5 top-ups/hour

async function addToWallet(uid, amount) {
  // Rate-limit check
  const nowMs = Date.now();
  const oneHourAgo = nowMs - 3600000;
  const histKey = 'ride_wallet_topup_hist_' + uid;
  const hist = JSON.parse(localStorage.getItem(histKey) || '[]').filter(e => e.ts > oneHourAgo);
  const hourlyTotal = hist.reduce((s, e) => s + e.amount, 0);

  if (hourlyTotal + amount > WALLET_MAX_PER_HOUR) {
    const remaining = Math.max(0, WALLET_MAX_PER_HOUR - hourlyTotal);
    toast(`⚠ Hourly limit reached. You can add up to €${remaining.toFixed(0)} more this hour.`);
    return;
  }
  if (hist.length >= WALLET_MAX_TOPUPS_PER_HOUR) {
    toast('⚠ Too many top-ups this hour. Try again later.');
    return;
  }

  // Fake payment flow
  await runFakePayment(amount);

  // Commit to wallet
  const bal = RideData.getWallet(uid) + amount;
  const txs = RideData.getWalletTxs(uid);
  txs.unshift({ type:'credit', label:Lang.t('fundsAdded'), date:new Date().toISOString(), amount });
  RideData.saveWallet(uid, bal, txs);

  // Save rate-limit history
  hist.push({ ts: nowMs, amount });
  localStorage.setItem(histKey, JSON.stringify(hist));

  renderWallet(uid);
  const wsW = document.getElementById('wsWallet'); if (wsW) wsW.textContent = '€'+bal.toFixed(2);
  const psW = document.getElementById('psWallet'); if (psW) psW.textContent = '€'+bal.toFixed(2);
}

function runFakePayment(amount) {
  return new Promise(resolve => {
    const overlay = document.getElementById('walletPayOverlay');
    const spinner = document.getElementById('walletPaySpinner');
    const successIcon = document.getElementById('walletPaySuccessIcon');
    const title = document.getElementById('walletPayTitle');
    const status = document.getElementById('walletPayStatus');
    const amtDisplay = document.getElementById('walletPayAmountDisplay');

    // Reset state
    spinner.style.display = '';
    successIcon.style.display = 'none';
    title.textContent = 'Processing payment';
    status.textContent = 'Connecting to payment provider…';
    amtDisplay.textContent = '€' + amount.toFixed(2);

    overlay.classList.add('open');

    const steps = [
      { delay: 900,  msg: 'Authorising transaction…' },
      { delay: 1100, msg: 'Confirming with bank…' },
      { delay: 800,  msg: 'Finalising top-up…' },
    ];

    let i = 0;
    function nextStep() {
      if (i >= steps.length) {
        // Success
        spinner.style.display = 'none';
        successIcon.style.display = '';
        title.textContent = 'Payment successful!';
        status.textContent = '€' + amount.toFixed(2) + ' added to your Ride Wallet';
        setTimeout(() => {
          overlay.classList.remove('open');
          resolve();
        }, 1400);
        return;
      }
      const s = steps[i++];
      setTimeout(() => { status.textContent = s.msg; nextStep(); }, s.delay);
    }
    setTimeout(nextStep, 700);
  });
}

function renderCards(uid){
  let cards=RideData.getCards(uid);
  const list=document.getElementById('cardsList');
  list.innerHTML=cards.map((c,i)=>`<div class="pay-card-item${c.dflt?' default':''}"><div class="pay-card-brand ${esc(c.cls)}">${esc(c.brand)}</div><div class="pay-card-info"><div class="pay-card-num">${esc(c.num)}</div><div class="pay-card-exp">Expires ${esc(c.exp)} · ${esc(c.name)}</div></div><div class="pay-card-actions">${c.dflt?'<span class="pay-dflt-badge">Default</span>':`<button class="pay-set-dflt" data-idx="${i}">Set default</button>`}<button class="pay-card-del" data-idx="${i}"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></div></div>`).join('');
  list.addEventListener('click',e=>{
    const dflt=e.target.closest('.pay-set-dflt');
    if(dflt){const idx=+dflt.dataset.idx;cards.forEach((c,i)=>c.dflt=(i===idx));RideData.saveCards(uid,cards);renderCards(uid);toast('Default card updated.');return;}
    const del=e.target.closest('.pay-card-del');
    if(del){const idx=+del.dataset.idx,was=cards[idx]?.dflt;cards.splice(idx,1);if(was&&cards.length)cards[0].dflt=true;RideData.saveCards(uid,cards);renderCards(uid);toast('Card removed.');}
  });
}
/* ── Notifications ─────────────────────────────────────────────── */
function markNotifsRead(uid) {
  localStorage.setItem('ride_notif_seen_'+uid, String(Date.now()));
  const dot = document.getElementById('notifDot');
  if (dot) { dot.style.display = 'none'; dot.textContent = ''; }
}

function renderNotifications(uid) {
  const el = document.getElementById('notifList');
  if (!el) return;
  const bookings = RideData.getBookings(uid);
  const rides    = RideData.getRides(uid).filter(r=>r.status==='completed');
  const fid      = RideData.getFid(uid);
  const now      = Date.now();
  const lastSeen = parseInt(localStorage.getItem('ride_notif_seen_'+uid)||'0');
  const notifs   = [];

  // Upcoming ride within next 48h
  const soon = bookings.find(b => {
    const dt = new Date(b.datetime).getTime();
    return dt > now && dt < now + 48*3600000;
  });
  if (soon) {
    const hrs = Math.round((new Date(soon.datetime).getTime()-now)/3600000);
    // Unread only if the ride was booked after the last time notifications were seen
    const rideTs = new Date(soon.datetime).getTime() - hrs*3600000; // approx booking time
    const isNew = lastSeen === 0 || (soon.id && !sessionStorage.getItem('ride_notif_read_'+soon.id));
    notifs.push({ icon:'📅', text:`Upcoming ride to <b>${esc(soon.to)}</b> in ${hrs < 2 ? 'less than 2 hours' : hrs+' hours'}.`, time:'Upcoming', read: !isNew || lastSeen > 0 });
  }

  // Last earned points
  const lastRide = rides[0];
  if (lastRide) {
    notifs.push({ icon:'⭐', text:`You earned <b>+${lastRide.pts} pts</b> on your ride to ${esc(lastRide.to)}.`, time:fmtDate(lastRide.date,true), read:true });
  }

  // Fidelity tier approaching
  const GOLD=2000;
  if (fid.totalEarned<GOLD && GOLD-fid.totalEarned<=200) {
    notifs.push({ icon:'🏆', text:`Only <b>${GOLD-fid.totalEarned} pts</b> left to unlock Gold tier!`, time:'Tip', read:true });
  }

  // Promo
  notifs.push({ icon:'🎁', text:'Weekend promo: <b>20% off</b> your next 3 rides. Use <b>RIDE20</b>.', time:'3 days ago', read:true });

  // If all notifications have been seen, mark as read
  if (lastSeen > 0) notifs.forEach(n => n.read = true);

  const dot = document.getElementById('notifDot');
  const unreadCount = notifs.filter(n=>!n.read).length;
  if (dot) { dot.style.display = unreadCount > 0 ? '' : 'none'; dot.textContent = unreadCount > 0 ? String(unreadCount) : ''; }

  // Fire real browser notifications if push is enabled and permission granted
  try {
    const prefs = JSON.parse(localStorage.getItem('ride_notif_prefs')||'{}');
    if (prefs.nPush && Notification.permission === 'granted' && soon) {
      const sentKey = 'ride_notif_sent_' + soon.id;
      if (!sessionStorage.getItem(sentKey)) {
        sessionStorage.setItem(sentKey, '1');
        const hrs = Math.round((new Date(soon.datetime).getTime()-now)/3600000);
        new Notification('Upcoming Ride — Ride', {
          body: `Your ride to ${soon.to} is in ${hrs < 2 ? 'less than 2 hours' : hrs+' hours'}.`,
          icon: 'assets/favicon.svg',
        });
      }
    }
  } catch (_) {}

  if (!notifs.length) {
    el.innerHTML = `<div class="tb-dd-empty">No notifications</div>`;
    return;
  }
  el.innerHTML = notifs.map(n=>`
    <div class="notif-item${n.read?'':' unread'}">
      <span class="notif-icon">${n.icon}</span>
      <div class="notif-content">
        <div class="notif-text">${n.text}</div>
        <div class="notif-time">${n.time}</div>
      </div>
    </div>`).join('');
}
function initAddCard(uid){
  const toggle=document.getElementById('addCardToggle'),form=document.getElementById('addCardForm'),
        cancel=document.getElementById('addCardCancel'),save=document.getElementById('addCardSave'),
        cName=document.getElementById('cName'),cNum=document.getElementById('cNum'),
        cExp=document.getElementById('cExp'),cCvv=document.getElementById('cCvv');
  if(!toggle)return;
  toggle.replaceWith(toggle.cloneNode(true)); cancel.replaceWith(cancel.cloneNode(true)); save.replaceWith(save.cloneNode(true));
  const t2=document.getElementById('addCardToggle'),c2=document.getElementById('addCardCancel'),s2=document.getElementById('addCardSave');
  t2.addEventListener('click',()=>form.classList.toggle('show'));
  c2.addEventListener('click',()=>{form.classList.remove('show');clearForm();});
  cName?.addEventListener('input',()=>{const el=document.getElementById('cpHolder');if(el)el.textContent=cName.value.toUpperCase()||'CARDHOLDER NAME';});
  cNum?.addEventListener('input',()=>{
    let v=cNum.value.replace(/\D/g,'').slice(0,16);cNum.value=v.replace(/(.{4})/g,'$1 ').trim();
    const el=document.getElementById('cpNum');if(el)el.textContent=(v+'????????????????').slice(0,16).replace(/(.{4})/g,'$1 ').trim().replace(/[0-9]/g,'•');
    const br=document.getElementById('cpBrand');if(br)br.textContent=v.startsWith('4')?'VISA':v.startsWith('5')?'MC':v.startsWith('3')?'AMEX':'';
  });
  cExp?.addEventListener('input',()=>{
    let v=cExp.value.replace(/\D/g,'').slice(0,4);if(v.length>2)v=v.slice(0,2)+' / '+v.slice(2);cExp.value=v;
    const el=document.getElementById('cpExp');if(el)el.textContent=v||'MM / YY';
  });
  s2.addEventListener('click',()=>{
    const name=cName?.value.trim(),num=cNum?.value.replace(/\s/g,''),exp=cExp?.value,cvv=cCvv?.value;
    if(!name||num.length<15||exp.length<4||!cvv){toast('Please fill in all fields correctly.');return;}
    const brand=num.startsWith('4')?'VISA':num.startsWith('5')?'MC':num.startsWith('3')?'AMEX':'CARD';
    const cls=brand==='VISA'?'visa':brand==='MC'?'mc':brand==='AMEX'?'amex':'other';
    let cards=RideData.getCards(uid);
    cards.push({id:'c'+Date.now(),brand,cls,num:'•••• •••• •••• '+num.slice(-4),exp:exp.replace(' ',''),name,dflt:cards.length===0});
    RideData.saveCards(uid,cards);renderCards(uid);form.classList.remove('show');clearForm();toast('Card added.');
  });
  function clearForm(){
    if(cName)cName.value='';if(cNum)cNum.value='';if(cExp)cExp.value='';if(cCvv)cCvv.value='';
    const h=document.getElementById('cpHolder');if(h)h.textContent='CARDHOLDER NAME';
    const n=document.getElementById('cpNum');if(n)n.textContent='•••• •••• •••• ••••';
    const e=document.getElementById('cpExp');if(e)e.textContent='MM / YY';
    const b=document.getElementById('cpBrand');if(b)b.textContent='';
  }
}

/* ════════════════════════════════════════════════════════
   ACCOUNT PANEL
   ════════════════════════════════════════════════════════ */
function renderAccount(user,uid){
  const rides=RideData.getRides(uid),fid=RideData.getFid(uid);
  const name=`${user.firstName||''} ${user.lastName||''}`.trim();
  const av=document.getElementById('profileAvatar');
  if(av){if(user.photo){_setAvatarPhoto(av,user.photo,"");av.classList.add('has-photo');}else{av.textContent=user.initials||name[0]||'R';}}
  document.getElementById('profileName').textContent=name||'—';
  document.getElementById('profileEmail').textContent=user.email||'—';
  document.getElementById('profileSince').textContent=user.createdAt?'Member since '+fmtDate(user.createdAt):'';
  document.getElementById('psRides').textContent=rides.filter(r=>r.status==='completed').length;
  document.getElementById('psPts').textContent=fid.pts.toLocaleString();
  document.getElementById('psWallet').textContent='€'+RideData.getWallet(uid).toFixed(2);
  document.getElementById('infoFirst').textContent=user.firstName||'—';
  document.getElementById('infoLast').textContent=user.lastName||'—';
  document.getElementById('infoEmail').textContent=user.email||'—';
  document.getElementById('infoPhone').textContent=user.phone||'Not set';
  document.getElementById('infoCity').textContent=user.city||'Not set';
  document.getElementById('infoCountry').textContent=user.country||'Not set';
  document.getElementById('infoSince').textContent=user.createdAt?fmtDate(user.createdAt):'—';
  document.getElementById('infoTier').textContent=fid.totalEarned>=GOLD_THRESHOLD?'Gold ✦':'Standard';
}

/* ════════════════════════════════════════════════════════
   BOOTSTRAP
   ════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async ()=>{
  Theme.apply(); Motion.apply(); Lang.apply();

  // Auth: prefer JWT → server profile; fallback to local SQLite session
  let user = null;
  const token = getToken();
  if (token) {
    try {
      const profRes = await fetch('/api/profile', { headers: { 'Authorization': 'Bearer ' + token } });
      if (profRes.ok) {
        const profData = await profRes.json();
        user = profData.user;
        // Redirect riders to driver dashboard
        if ((profData.user?.accountType || 'user') === 'rider') {
          window.location.href = 'driver-dashboard.html';
          return;
        }
      }
    } catch (_) {}
  }
  if (!user) user = await Session.get();
  if(!user){window.location.href='login.html?redirect=dashboard.html';return;}
  const uid = user.id || user._id?.toString();

  // Apply server-stored preferences (theme, lang, motion)
  if (user.theme)        { Theme.set(user.theme);               Theme.apply(); }
  if (user.lang)         { Lang.set(user.lang);                 Lang.apply(); }
  if (user.reduceMotion) { Motion.set(user.reduceMotion === 'true'); Motion.apply(); }

  // Sync server data → localStorage (auto-completes past rides, awards points)
  await syncFromServer(uid);

  RideData.seed(uid);

  const name=`${user.firstName||''} ${user.lastName||''}`.trim()||'Rider';

  // Topbar avatar
  const tbAv=document.getElementById('tbAvatar');
  if(tbAv){
    if(user.photo){_setAvatarPhoto(tbAv,user.photo,"");tbAv.classList.add('has-photo');}
    else{tbAv.textContent=user.initials||name[0]||'R';}
  }

  // Sidebar profile
  const sbAv=document.getElementById('sbAv');
  if(sbAv){
    if(user.photo){_setAvatarPhoto(sbAv,user.photo,"");sbAv.style.background='transparent';}
    else{sbAv.textContent=user.initials||name[0]||'R';}
  }
  const sbPname=document.getElementById('sbPname');
  const sbPemail=document.getElementById('sbPemail');
  if(sbPname) sbPname.textContent=name||'—';
  if(sbPemail) sbPemail.textContent=user.email||'—';

  // Profile dropdown user info
  const ddAv=document.getElementById('ddAvatar');
  if(ddAv){
    if(user.photo){_setAvatarPhoto(ddAv,user.photo,"");ddAv.style.background='transparent';}
    else{ddAv.textContent=user.initials||name[0]||'R';}
  }
  document.getElementById('ddName').textContent=name;
  document.getElementById('ddEmail').textContent=user.email||'';

  // Sidebar nav
  document.querySelectorAll('.sb-item[data-panel]').forEach(item=>{
    item.addEventListener('click',e=>{
      e.preventDefault();
      const p=item.dataset.panel;
      switchPanel(p);
      if(p==='fidelity') renderFidelity(uid);
      if(p==='payments') renderPayments(uid);
      if(p==='account')  renderAccount(user,uid);
    });
  });

  // Utility tiles
  document.querySelectorAll('.util-item[data-panel]').forEach(item=>{
    item.addEventListener('click',()=>{
      const p=item.dataset.panel;
      switchPanel(p);
      if(p==='payments') renderPayments(uid);
      if(p==='account')  renderAccount(user,uid);
    });
  });

  // Mobile nav
  document.querySelectorAll('.dmn-item[data-panel]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const p=btn.dataset.panel;
      switchPanel(p);
      if(p==='fidelity') renderFidelity(uid);
      if(p==='payments') renderPayments(uid);
      if(p==='account')  renderAccount(user,uid);
    });
  });

  // Fidelity mini
  document.getElementById('fidMiniCard')?.addEventListener('click',()=>{switchPanel('fidelity');renderFidelity(uid);});

  // Chart tabs
  document.querySelectorAll('.chart-tab').forEach(tab=>{
    tab.addEventListener('click',()=>renderChart(RideData.getRides(uid),tab.dataset.range));
  });

  // ── Dynamic back button ──────────────────────────────────────────
  (function initBackBtn() {
    const backEl   = document.getElementById('tbBack');
    const backLbl  = document.getElementById('tbBackLabel');
    if (!backEl || !backLbl) return;

    // Pages that can link to dashboard
    const PAGE_LABELS = {
      'index.html':    'Home',
      'index':         'Home',
      '/':             'Home',
      'settings.html': 'Settings',
      'settings':      'Settings',
      'login.html':    'Sign in',
      'login':         'Sign in',
    };

    const ref = document.referrer;
    let label = 'Home';
    let href  = 'index.html';

    if (ref) {
      try {
        const u    = new URL(ref);
        const page = u.pathname.split('/').pop().replace('.html','') || 'index';
        const key  = Object.keys(PAGE_LABELS).find(k => k.replace('.html','') === page);
        if (key) { label = PAGE_LABELS[key]; href = ref; }
      } catch(_) {}
    }

    backLbl.textContent = label;
    backEl.href = href;
    backEl.addEventListener('click', e => {
      if (ref && href === ref) { e.preventDefault(); history.back(); }
    });
  })();

  // Topbar buttons
  document.getElementById('notifBtn').addEventListener('click', e => {
    e.stopPropagation();
    toggleDropdown('notifDropdown');
    if (document.getElementById('notifDropdown').classList.contains('open')) markNotifsRead(uid);
  });
  document.getElementById('tbAvatar').addEventListener('click', e => {
    e.stopPropagation();
    toggleDropdown('profileDropdown');
  });

  // Profile dropdown actions
  document.getElementById('ddSignOut').addEventListener('click',()=>{
    closeAllDropdowns();
    document.getElementById('soModal').classList.add('is-open');
  });

  // Sign-out modal
  document.getElementById('soCancel').addEventListener('click',()=>document.getElementById('soModal').classList.remove('is-open'));
  document.getElementById('soConfirm').addEventListener('click',()=>{Session.clear(true);window.location.href='index.html';});
  document.getElementById('soModal').addEventListener('click',e=>{if(e.target===document.getElementById('soModal'))document.getElementById('soModal').classList.remove('is-open');});

  // Upcoming close
  document.getElementById('upcomingClose').addEventListener('click',()=>document.getElementById('upcomingOverlay').classList.remove('open'));
  document.getElementById('couponClose')?.addEventListener('click',()=>document.getElementById('couponOverlay').classList.remove('open'));
  document.getElementById('couponOverlay')?.addEventListener('click',e=>{if(e.target===document.getElementById('couponOverlay'))document.getElementById('couponOverlay').classList.remove('open');});
  document.getElementById('upcomingOverlay').addEventListener('click',e=>{if(e.target===document.getElementById('upcomingOverlay'))document.getElementById('upcomingOverlay').classList.remove('open');});

  // Theme/lang sync from settings tab
  window.addEventListener('storage',e=>{
    if(e.key==='ride_reduce_motion'){Motion.apply();}
    if(e.key==='ride_lang'){
      Lang.apply();
      renderDashboard(user,uid);
      // Re-render active non-dashboard panel if open
      const activePanel=document.querySelector('.panel.active');
      if(activePanel&&activePanel.id==='panel-fidelity') renderFidelity(uid);
      if(activePanel&&activePanel.id==='panel-payments') renderWallet(uid);
    }
  });

  // Render
  renderDashboard(user,uid);
  renderNotifications(uid);
  // Handle #fidelity hash navigation (from external links)
  if (window.location.hash === '#fidelity') {
    switchPanel('fidelity');
    renderFidelity(uid);
  }
  Lang.apply(); // apply after render
});