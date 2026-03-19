"use strict";

/* ════════════════════════════════════════════════════════
   DATA LAYER
   ════════════════════════════════════════════════════════ */
const RideData = {
  K: k => k + '_' + (localStorage.getItem('current_user_id')||''),
  seed(uid) {
    const rk = 'ride_rides_'+uid, bk='ride_bookings_'+uid,
          ck='ride_cards_'+uid, fk='ride_fidelity_'+uid;
    if (!localStorage.getItem(rk)) {
      const now = Date.now();
      localStorage.setItem(rk, JSON.stringify([
        {id:'r1',from:'Piazza Navona',to:'Fiumicino Airport',date:new Date(now-4*86400000).toISOString(),status:'completed',fare:38.50,car:'Ferrari Roma',pts:39},
        {id:'r2',from:'Termini Station',to:'Colosseo',date:new Date(now-5*86400000).toISOString(),status:'completed',fare:11.20,car:'Lamborghini Urus',pts:11},
        {id:'r3',from:'Trastevere',to:'EUR Centro',date:new Date(now-6*86400000).toISOString(),status:'cancelled',fare:0,car:'Porsche Taycan',pts:0},
        {id:'r4',from:'Prati',to:'Testaccio',date:new Date(now-7*86400000).toISOString(),status:'completed',fare:9.80,car:'Aston Martin DBX',pts:10},
        {id:'r5',from:'Via Veneto',to:'Tiburtina',date:new Date(now-8*86400000).toISOString(),status:'completed',fare:16.40,car:'Bentley Flying Spur',pts:16},
        {id:'r6',from:'Colosseo',to:'Villa Borghese',date:new Date(now-12*86400000).toISOString(),status:'completed',fare:8.20,car:'Ferrari Roma',pts:8},
        {id:'r7',from:'Ostiense',to:'Parioli',date:new Date(now-14*86400000).toISOString(),status:'completed',fare:14.60,car:'Rolls Royce Ghost',pts:15},
        {id:'r8',from:'Piazza Venezia',to:'Gianicolo',date:new Date(now-20*86400000).toISOString(),status:'completed',fare:7.50,car:'Lamborghini Urus',pts:8},
        {id:'r9',from:'Pantheon',to:'Pigneto',date:new Date(now-25*86400000).toISOString(),status:'completed',fare:12.80,car:'Porsche Taycan',pts:13},
        {id:'r10',from:'EUR',to:'Fiumicino Airport',date:new Date(now-35*86400000).toISOString(),status:'completed',fare:28.00,car:'Bentley Flying Spur',pts:28},
        {id:'r11',from:'Trastevere',to:'Parioli',date:new Date(now-50*86400000).toISOString(),status:'completed',fare:11.00,car:'Ferrari Roma',pts:11},
        {id:'r12',from:'Termini',to:'Ostia Lido',date:new Date(now-65*86400000).toISOString(),status:'completed',fare:32.00,car:'Rolls Royce Ghost',pts:32},
      ]));
    }
    if (!localStorage.getItem(bk)) {
      const t1=new Date(); t1.setDate(t1.getDate()+1); t1.setHours(9,30,0,0);
      const t2=new Date(); t2.setDate(t2.getDate()+5); t2.setHours(14,0,0,0);
      localStorage.setItem(bk, JSON.stringify([
        {id:'b1',from:'Via del Corso 1',to:'Fiumicino Airport',datetime:t1.toISOString(),car:'Ferrari Roma',fare:38.50},
        {id:'b2',from:'Hotel Eden, Roma',to:'Napoli Centrale',datetime:t2.toISOString(),car:'Bentley Flying Spur',fare:95.00},
      ]));
    }
    if (!localStorage.getItem(ck)) {
      localStorage.setItem(ck, JSON.stringify([
        {id:'c1',brand:'VISA',cls:'visa',num:'•••• •••• •••• 4242',exp:'12/26',name:'Marco Rossi',dflt:true},
        {id:'c2',brand:'MC',cls:'mc',num:'•••• •••• •••• 8888',exp:'09/27',name:'Marco Rossi',dflt:false},
      ]));
    }
    if (!localStorage.getItem(fk)) {
      localStorage.setItem(fk, JSON.stringify({pts:1240,redeemed:360,totalEarned:1600}));
    }
  },
  getRides(uid)    { return JSON.parse(localStorage.getItem('ride_rides_'+uid)||'[]'); },
  getBookings(uid) { return JSON.parse(localStorage.getItem('ride_bookings_'+uid)||'[]'); },
  getCards(uid)    { return JSON.parse(localStorage.getItem('ride_cards_'+uid)||'[]'); },
  getFid(uid)      { return JSON.parse(localStorage.getItem('ride_fidelity_'+uid)||'{"pts":0,"redeemed":0,"totalEarned":0}'); },
  saveCards(uid,v) { localStorage.setItem('ride_cards_'+uid, JSON.stringify(v)); },
  saveBookings(uid,v){ localStorage.setItem('ride_bookings_'+uid, JSON.stringify(v)); },
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
const PANEL_TITLES={dashboard:'Dashboard',fidelity:'My Fidelity',payments:'Payments',account:'My Account'};
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
  document.querySelectorAll('.tb-dropdown').forEach(d=>d.classList.remove('open'));
}
function toggleDropdown(id) {
  const dd=document.getElementById(id);
  const wasOpen=dd.classList.contains('open');
  closeAllDropdowns();
  if(!wasOpen) dd.classList.add('open');
}
document.addEventListener('click', e=>{
  if(!e.target.closest('.tb-icon-btn')&&!e.target.closest('.tb-avatar')&&!e.target.closest('.tb-dropdown')&&!e.target.closest('#tbAvatar'))
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
  const monthSpent=rides.filter(r=>r.status==='completed'&&new Date(r.date)>=ms).reduce((s,r)=>s+r.fare,0);
  document.getElementById('wsRides').textContent=rides.length;
  document.getElementById('wsPts').textContent=fid.pts.toLocaleString();
  document.getElementById('wsSpent').textContent='€'+monthSpent.toFixed(0);
  renderNextRide(bookings,uid);
  // Fidelity mini
  const pct=Math.min((fid.totalEarned/GOLD_THRESHOLD)*100,100);
  document.getElementById('fidMiniPts').textContent=fid.pts.toLocaleString();
  document.getElementById('fidMiniBar').style.width=pct+'%';
  document.getElementById('fidMiniNext').textContent=
    fid.totalEarned>=GOLD_THRESHOLD?'Gold tier unlocked ✦':`${Math.max(0,GOLD_THRESHOLD-fid.totalEarned)} pts to Gold`;
  renderRecentRides(rides.slice(0,5));
  renderReviews(uid);
  renderChart(rides,'week');
}

function renderNextRide(bookings,uid) {
  const body=document.getElementById('nextRideBody');
  const badge=document.getElementById('nextRideCount');
  if(!bookings||!bookings.length) {
    badge.style.display='none';
    body.innerHTML=`<div class="nr-empty"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><p>${Lang.t('noUpcomingRides')}</p></div><button class="nr-book-btn" onclick="window.location.href='index.html'"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>${Lang.t('bookRide')}</button>`;
    return;
  }
  const next=bookings[0];
  badge.style.display=''; badge.textContent=bookings.length+' upcoming';
  const more=bookings.length>1?`<div class="nr-more" id="seeAllUpcoming">+ ${bookings.length-1} more — tap to manage</div>`:'';
  body.innerHTML=`<div class="nr-ride"><div class="nr-route"><div class="nr-point"><span class="nr-dot from"></span>${esc(next.from)}</div><div class="nr-connector"></div><div class="nr-point"><span class="nr-dot to"></span>${esc(next.to)}</div></div><div class="nr-meta"><span class="nr-meta-item"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${esc(fmtDatetime(next.datetime))}</span><span class="nr-meta-item"><svg viewBox="0 0 24 24"><path d="M19 17H5"/><path d="M5 17l-1-5h15l-1 5"/><path d="M8 17v2m8-2v2"/></svg>${esc(next.car)}</span><span class="nr-meta-item" style="color:var(--brand)">€${esc(next.fare.toFixed(2))}</span></div><div class="nr-actions"><button class="nr-btn primary" onclick="window.location.href='index.html'">${Lang.t('bookAnother')}</button><button class="nr-btn ghost" data-cancel="${esc(next.id)}" data-uid="${esc(uid)}">${Lang.t('cancelRide')}</button></div>${more}</div>`;
  document.getElementById('seeAllUpcoming')?.addEventListener('click',()=>openUpcoming(bookings,uid));
  document.querySelector(`[data-cancel="${next.id}"]`)?.addEventListener('click',()=>cancelBooking(next.id,uid));
}

function cancelBooking(id,uid) {
  const b=RideData.getBookings(uid).filter(x=>x.id!==id);
  RideData.saveBookings(uid,b); renderNextRide(b,uid);
  if(document.getElementById('upcomingOverlay').classList.contains('open')) openUpcoming(b,uid);
  toast('Ride cancelled.');
}
function openUpcoming(bookings,uid) {
  const ol=document.getElementById('upcomingList');
  ol.innerHTML=bookings.map(b=>`<div class="upcoming-item"><div class="ui-date">${esc(fmtDatetime(b.datetime))}</div><div><div class="ui-point"><span class="nr-dot from" style="margin-right:8px"></span>${esc(b.from)}</div><div style="width:1px;height:7px;background:var(--border-md);margin:2px 0 2px 3.5px"></div><div class="ui-point"><span class="nr-dot to" style="margin-right:8px"></span>${esc(b.to)}</div></div><div style="font-size:12px;color:var(--muted);margin:6px 0">${esc(b.car)} · €${esc(b.fare.toFixed(2))}</div><div class="ui-actions"><button class="ui-btn cancel" data-cancel="${esc(b.id)}" data-uid="${esc(uid)}">Cancel</button><button class="ui-btn edit">Edit (soon)</button></div></div>`).join('');
  ol.querySelectorAll('[data-cancel]').forEach(btn=>btn.addEventListener('click',()=>cancelBooking(btn.dataset.cancel,btn.dataset.uid)));
  document.getElementById('upcomingOverlay').classList.add('open');
}

function renderReviews(uid) {
  const el = document.getElementById('reviewsList');
  if (!el) return;
  const rides = RideData.getRides(uid).filter(r => r.status === 'completed');

  // Generate deterministic per-ride reviews the user gave to drivers
  const DRIVER_NAMES = ['Luca B.','Marco V.','Giulia T.','Andrea C.','Sofia R.','Matteo F.','Elena M.','Roberto P.'];
  const COMMENTS = [
    'Excellent driver, very professional and on time.',
    'Smooth ride, the car was spotless. Great experience.',
    'Very punctual, knew the best routes to avoid traffic.',
    'Friendly and professional. Would definitely book again.',
    'Great ride overall, only slightly late on pickup.',
    'Very comfortable trip. Driver was courteous throughout.',
    'Perfect service. The car was immaculate.',
    'Quick and efficient. Highly recommended.',
  ];

  if (!rides.length) {
    el.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:8px 0">No reviews given yet.</div>`;
    return;
  }

  const shown = rides.slice(0, 3).map((r, i) => {
    // Deterministic but varied rating: mostly 5, occasional 4
    const rating = (i % 5 === 2) ? 4 : 5;
    const driverIdx = (r.id.charCodeAt(r.id.length - 1) + i) % DRIVER_NAMES.length;
    const commentIdx = (r.id.charCodeAt(r.id.length - 1) * 3 + i) % COMMENTS.length;
    return {
      driver: DRIVER_NAMES[driverIdx],
      rating,
      text: COMMENTS[commentIdx],
      route: r.to,
      date: r.date,
    };
  });

  const avgRating = (shown.reduce((s, r) => s + r.rating, 0) / shown.length).toFixed(1);
  // Update the pill in the card header
  const pill = document.querySelector('#nextRideCard')?.closest('.dash-row')
    ?.querySelector('.card-sm .pill');
  if (pill) pill.textContent = avgRating + ' ★';

  el.innerHTML = shown.map(r => {
    const stars = Array.from({length:5},(_,i) =>
      `<span class="review-star${i < r.rating ? '' : ' empty'}">★</span>`
    ).join('');
    return `<div class="review-item">
      <div class="review-avatar">${r.driver[0]}</div>
      <div style="flex:1;min-width:0">
        <div class="review-stars">${stars}</div>
        <div class="review-text">${r.text}</div>
        <div class="review-meta">${r.driver} · Ride to ${r.route} · ${fmtDate(r.date, true)}</div>
      </div>
    </div>`;
  }).join('');
}

function renderRecentRides(rides) {
  const tb=document.getElementById('recentRidesTbody');
  if(!rides.length){tb.innerHTML=`<tr><td colspan="4" style="color:var(--muted);text-align:center;padding:16px 0">No rides yet.</td></tr>`;return;}
  tb.innerHTML=rides.map(r=>`<tr><td><div class="ride-route-cell"><div class="rr-from"><span class="rd from"></span>${esc(r.from)}</div><div class="rr-conn"></div><div class="rr-to"><span class="rd to"></span>${esc(r.to)}</div></div></td><td class="ride-date">${esc(fmtDate(r.date,true))}</td><td>${statusPill(r.status)}</td><td class="ride-fare">${r.status==='cancelled'?'<span style="color:var(--faint)">—</span>':'€'+esc(String(r.fare.toFixed(2)))}</td></tr>`).join('');
}

/* ── CHART — SVG cartesian grid ── */
const CHART_DATA={
  week(rides){
    const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const today=new Date(),dow=today.getDay()||7;
    return days.map((_,i)=>{
      const d=new Date(today);d.setDate(d.getDate()-(dow-1-i));d.setHours(0,0,0,0);
      const nd=new Date(d);nd.setDate(nd.getDate()+1);
      const s=rides.filter(r=>r.status==='completed'&&new Date(r.date)>=d&&new Date(r.date)<nd).reduce((a,r)=>a+r.fare,0);
      return {label:days[i],val:s};
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
    const today=new Date(),dow=today.getDay()||7;
    rangeCompletedCount=rides.filter(r=>{
      if(r.status!=='completed') return false;
      const rd=new Date(r.date);
      const monday=new Date(today);monday.setDate(today.getDate()-(dow-1));monday.setHours(0,0,0,0);
      const sunday=new Date(monday);sunday.setDate(monday.getDate()+7);
      return rd>=monday&&rd<sunday;
    }).length;
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
  const W=400,H=130,PAD={t:12,r:10,b:24,l:38};
  const cW=W-PAD.l-PAD.r, cH=H-PAD.t-PAD.b;
  const max=Math.max(...data.map(d=>d.val),1);
  // Y-axis ticks
  const yTicks=4;
  const tickStep=max/yTicks;
  let html='';
  // grid lines + y labels
  for(let i=0;i<=yTicks;i++){
    const y=PAD.t+cH-(i/yTicks)*cH;
    const val=Math.round(tickStep*i);
    html+=`<line x1="${PAD.l}" y1="${y.toFixed(1)}" x2="${W-PAD.r}" y2="${y.toFixed(1)}" class="chart-grid-line" vector-effect="non-scaling-stroke"/>`;
    html+=`<text x="${PAD.l-5}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--faint)" font-family="DM Mono,monospace">€${val}</text>`;
  }
  // Bars + x labels
  const n=data.length;
  const barW=Math.max(4, (cW/n)*0.55);
  const gap=(cW-barW*n)/(n+1);
  data.forEach((d,i)=>{
    const bH=d.val>0?Math.max((d.val/max)*cH,3):0;
    const x=PAD.l+gap+(barW+gap)*i;
    const y=PAD.t+cH-bH;
    html+=`<rect class="chart-bar-rect" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bH.toFixed(1)}" rx="3" data-val="${d.val.toFixed(2)}" data-label="${d.label}"/>`;
    html+=`<text x="${(x+barW/2).toFixed(1)}" y="${H-6}" text-anchor="middle" font-size="9" fill="var(--faint)" font-family="DM Sans,sans-serif">${d.label}</text>`;
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
      bar.classList.add('active');
    });
    bar.addEventListener('mouseleave',()=>{tt.classList.remove('show');bar.classList.remove('active');});
  });
}

/* ════════════════════════════════════════════════════════
   FIDELITY PANEL
   ════════════════════════════════════════════════════════ */

const PARTNER_COUPONS = [
  {id:'c1', badge:'partner', badgeLabel:'Partner', name:'20% off at Eataly', desc:'Valid on your next purchase over €30', cost:150, used:false},
  {id:'c2', badge:'free',    badgeLabel:'Free ride', name:'Free ride up to €15', desc:'Redeem for any city ride', cost:200, used:false},
  {id:'c3', badge:'discount', badgeLabel:'Discount', name:'€10 off next ride', desc:'Applied automatically at checkout', cost:100, used:false},
  {id:'c4', badge:'partner', badgeLabel:'Partner', name:'Free coffee at Lavazza', desc:'One free espresso at any Lavazza café', cost:50, used:false},
  {id:'c5', badge:'partner', badgeLabel:'Partner', name:'15% off at Trenitalia', desc:'On regional trains, valid 30 days', cost:300, used:false},
  {id:'c6', badge:'discount', badgeLabel:'Discount', name:'€5 credit', desc:'Added to your Ride wallet instantly', cost:60, used:false},
];

function renderPartnerCoupons(pts) {
  const el = document.getElementById('partnerCouponList');
  if (!el) return;
  const shown = PARTNER_COUPONS.slice(0, 3);
  el.innerHTML = shown.map(cp => `
    <div class="coupon-item" data-id="${cp.id}">
      <span class="coupon-badge ${cp.badge}">${cp.badgeLabel}</span>
      <div class="coupon-info">
        <div class="coupon-name">${cp.name}</div>
        <div class="coupon-desc">${cp.desc}</div>
      </div>
      <div class="coupon-cost">${cp.cost} pts</div>
    </div>`).join('');
  document.getElementById('couponsAvail').textContent = PARTNER_COUPONS.length + ' available';

  el.querySelectorAll('.coupon-item').forEach(item => {
    item.addEventListener('click', () => {
      const cp = PARTNER_COUPONS.find(x => x.id === item.dataset.id);
      if (!cp) return;
      if (pts < cp.cost) { toast('Not enough points to redeem this coupon.'); return; }
      if (confirm(`Redeem "${cp.name}" for ${cp.cost} points?`)) {
        toast(`✓ Coupon redeemed: ${cp.name}`);
      }
    });
  });
}

function openCouponModal(title, coupons, pts) {
  document.getElementById('couponModalTitle').textContent = title;
  const list = document.getElementById('couponModalList');
  list.innerHTML = coupons.map(cp => `
    <div class="coupon-item" data-cost="${cp.cost}" data-name="${cp.name}" data-pts="${pts}">
      <span class="coupon-badge ${cp.badge}">${cp.badgeLabel}</span>
      <div class="coupon-info">
        <div class="coupon-name">${cp.name}</div>
        <div class="coupon-desc">${cp.desc}</div>
        ${pts < cp.cost ? '<div class="coupon-used">Need '+(cp.cost-pts)+' more pts</div>' : ''}
      </div>
      <div class="coupon-cost" style="color:${pts>=cp.cost?'var(--brand)':'var(--faint)'}">${cp.cost} pts</div>
    </div>`).join('');
  list.querySelectorAll('.coupon-item').forEach(item => {
    item.addEventListener('click', () => {
      const cost = +item.dataset.cost, name = item.dataset.name, avail = +item.dataset.pts;
      if (avail < cost) { toast('Not enough points.'); return; }
      if (confirm(`Redeem "${name}" for ${cost} points?`)) {
        document.getElementById('couponOverlay').classList.remove('open');
        toast(`✓ Coupon redeemed: ${name}`);
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
  document.getElementById('fhTierBadge').textContent=isGold?'✦ Gold Tier':'✦ Standard Tier';
  document.getElementById('fidHeroNext').textContent=isGold
    ?`Gold unlocked ✦`
    :`${Math.max(0,GOLD_THRESHOLD-fid.totalEarned).toLocaleString()} pts to Gold`;

  // Physical card preview
  const fcpPts=document.getElementById('fcpPts');
  const fcpTier=document.getElementById('fcpTier');
  if(fcpPts) fcpPts.textContent=fid.pts.toLocaleString()+' pts';
  if(fcpTier) fcpTier.textContent=isGold?'GOLD':'STANDARD';

  // Stats
  document.getElementById('fsAvailable').textContent=fid.pts.toLocaleString();
  document.getElementById('fsTotal').textContent=fid.totalEarned.toLocaleString();
  document.getElementById('fsRedeemed').textContent=fid.redeemed.toLocaleString();
  document.getElementById('fsTier').textContent=isGold?'Gold ✦':'Standard';
  const infoTier=document.getElementById('infoTier');
  if(infoTier) infoTier.textContent=isGold?'Gold ✦':'Standard';

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
    grid.innerHTML=shown.map(cp=>`
      <div class="coupon-item" data-id="${cp.id}">
        <div class="coupon-item-top">
          <span class="coupon-badge ${cp.badge}">${cp.badgeLabel}</span>
          <span class="coupon-cost-tag">${cp.cost} pts</span>
        </div>
        <div class="coupon-name">${cp.name}</div>
        <div class="coupon-desc-short">${cp.desc}</div>
      </div>`).join('');
    grid.querySelectorAll('.coupon-item').forEach(item=>{
      item.addEventListener('click',()=>{
        const cp=PARTNER_COUPONS.find(x=>x.id===item.dataset.id);
        if(!cp) return;
        if(fid.pts<cp.cost){toast('Not enough points to redeem this coupon.');return;}
        if(confirm(`Redeem "${cp.name}" for ${cp.cost} points?`)) toast(`✓ Coupon redeemed: ${cp.name}`);
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

  // History
  const histEl=document.getElementById('fidHistory');
  const entries=rides.slice(0,8).map(r=>({title:'Ride to '+esc(r.to),date:r.date,pts:'+'+esc(String(r.pts)),plus:true}));
  entries.splice(2,0,{title:'Points redeemed — discount applied',date:new Date(Date.now()-10*86400000).toISOString(),pts:'-120',plus:false});
  histEl.innerHTML=entries.map(e=>`<div class="fid-row"><div class="fid-row-icon" style="background:${e.plus?'var(--green-dim)':'var(--accent-dim)'};color:${e.plus?'var(--green)':'var(--accent)'}"><svg viewBox="0 0 24 24">${e.plus?'<polyline points="18 15 12 9 6 15"/>':'<polyline points="6 9 12 15 18 9"/>'}</svg></div><div class="fid-row-info"><div class="fid-row-title">${e.title}</div><div class="fid-row-date">${esc(fmtDate(e.date))}</div></div><div class="fid-row-pts ${e.plus?'plus':'minus'}">${e.pts} pts</div></div>`).join('');
}

/* ════════════════════════════════════════════════════════
   PAYMENTS PANEL
   ════════════════════════════════════════════════════════ */
function renderPayments(uid){renderCards(uid);renderTransactions(uid);initAddCard(uid);}
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
function renderTransactions(uid){
  const rides=RideData.getRides(uid);
  const tb=document.getElementById('txTbody');
  tb.innerHTML=rides.slice(0,10).map(r=>`<tr><td class="tx-desc">Ride to ${esc(r.to)}</td><td class="tx-date">${esc(fmtDate(r.date))}</td><td class="tx-amt" style="text-align:right">${r.status==='cancelled'?'—':'€'+esc(String(r.fare.toFixed(2)))}</td><td>${statusPill(r.status)}</td></tr>`).join('');
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
  document.getElementById('psRides').textContent=rides.length;
  document.getElementById('psPts').textContent=fid.pts.toLocaleString();
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

  const user=await Session.get();
  if(!user){window.location.href='login.html?redirect=dashboard.html';return;}
  // Apply user's saved preferences from DB
  Lang.apply();
  Theme.apply();
  if(user.reduceMotion !== undefined && user.reduceMotion !== null) {
    Motion.set(user.reduceMotion === 'true');
    Motion.apply();
  }
  const uid=user.id;
  RideData.seed(uid);

  const name=`${user.firstName||''} ${user.lastName||''}`.trim()||'Rider';

  // Topbar avatar
  const tbAv=document.getElementById('tbAvatar');
  if(tbAv){
    if(user.photo){_setAvatarPhoto(tbAv,user.photo,"");tbAv.classList.add('has-photo');}
    else{tbAv.textContent=user.initials||name[0]||'R';}
  }

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
  document.getElementById('notifBtn').addEventListener('click',()=>toggleDropdown('notifDropdown'));
  document.getElementById('tbAvatar').addEventListener('click',()=>toggleDropdown('profileDropdown'));

  // Profile dropdown actions
  document.getElementById('ddFidelityCard')?.addEventListener('click',()=>{switchPanel('fidelity');renderFidelity(uid);closeAllDropdowns();});
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
    if(e.key==='ride_lang'){Lang.apply();}
  });

  // Render
  renderDashboard(user,uid);
  // Handle #fidelity hash navigation (from external links)
  if (window.location.hash === '#fidelity') {
    switchPanel('fidelity');
    renderFidelity(uid);
  }
  Lang.apply(); // apply after render
});