/* ═══════════════════════════════════════════════════════════════════
   RIDE — SETTINGS PAGE  (scripts/settings.js)
   Requires: shared.js loaded first.
   ═══════════════════════════════════════════════════════════════════ */
"use strict";

/* ── SERVER HELPERS ──────────────────────────────────────────────── */
function getToken() { return localStorage.getItem('ride_token') || null; }

async function patchProfile(data) {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(data),
    });
    if (res.ok) return (await res.json()).user;
  } catch (_) {}
  return null;
}

/* Resize image to maxPx × maxPx JPEG before uploading */
function resizePhoto(file, maxPx = 256, quality = 0.82) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/* ── TOAST ──────────────────────────────────────────────────────────── */
function showToast(msg) {
  const t   = document.getElementById("toast");
  const lbl = document.getElementById("toastMsg");
  if (!t || !lbl) return;
  lbl.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove("show"), 3000);
}

function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.origText = btn.textContent;
    btn.textContent = "Saving…";
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.origText || "Save";
    btn.disabled = false;
  }
}

/* ── SIDEBAR NAV ─────────────────────────────────────────────────────── */
function initNav() {
  const items  = document.querySelectorAll(".sb-item[data-panel]");
  const panels = document.querySelectorAll(".panel");

  function activate(id) {
    items.forEach(i  => i.classList.toggle("active", i.dataset.panel === id));
    panels.forEach(p => p.classList.toggle("active", p.id === id));
    const content = document.getElementById("mainContent");
    if (content) content.scrollTop = 0;
    history.replaceState(null, "", `#${id}`);
  }

  items.forEach(i => i.addEventListener("click", () => activate(i.dataset.panel)));

  // Mobile nav — mirrors sidebar nav
  const mnItems = [...document.querySelectorAll(".mn-item[data-panel]")];
  mnItems.forEach(btn => btn.addEventListener("click", () => activate(btn.dataset.panel)));

  // Patch activate to also sync mobile nav active state
  const _origActivate = activate;
  activate = function(id) {
    _origActivate(id);
    mnItems.forEach(b => b.classList.toggle("active", b.dataset.panel === id));
  };

  const hash  = location.hash.replace("#", "");
  const valid = [...panels].some(p => p.id === hash);
  activate(valid ? hash : "p-account");
}

/* ── POPULATE USER UI ─────────────────────────────────────────────── */
async function populateUserUI(user) {
  if (!user) return;
  const full = `${user.firstName||""} ${user.lastName||""}`.trim() || "—";

  const tbAvatar = document.getElementById("tbAvatar");
  const tbName   = document.getElementById("tbName");
  if (tbName)   tbName.textContent = full;
  if (tbAvatar) {
    if (user.photo) _setAvatarPhoto(tbAvatar, user.photo, "");
    else tbAvatar.textContent = user.initials || full[0] || "R";
  }

  const sbAv     = document.getElementById("sbAv");
  const sbPname  = document.getElementById("sbPname");
  const sbPemail = document.getElementById("sbPemail");
  if (sbPname)  sbPname.textContent  = full;
  if (sbPemail) sbPemail.textContent = user.email || "—";
  if (sbAv) {
    if (user.photo) _setAvatarPhoto(sbAv, user.photo, "");
    else sbAv.textContent = user.initials || full[0] || "R";
  }

  const avCircle = document.getElementById("avCircle");
  const avName   = document.getElementById("avName");
  if (avName)   avName.textContent = full;
  if (avCircle) {
    if (user.photo) _setAvatarPhoto(avCircle, user.photo, "");
    else avCircle.textContent = user.initials || full[0] || "R";
  }
}

/* ── ACCOUNT PANEL ───────────────────────────────────────────────── */
async function initAccount() {
  // Auth: prefer JWT → server profile; fallback to local SQLite session
  let user = null;
  const token = getToken();
  if (token) {
    try {
      const r = await fetch('/api/profile', { headers: { 'Authorization': 'Bearer ' + token } });
      if (r.ok) { const d = await r.json(); user = d.user; }
    } catch (_) {}
  }
  if (!user) user = await Session.get();
  if (!user) { window.location.href = "login.html"; return; }

  // Apply server-stored preferences
  if (user.theme)        { Theme.set(user.theme);               Theme.apply(); }
  if (user.lang)         { Lang.set(user.lang);                 Lang.apply(); }
  if (user.reduceMotion) { Motion.set(user.reduceMotion === 'true'); Motion.apply(); }

  await populateUserUI(user);

  const fields = {
    dFirst: "firstName", dLast: "lastName", dEmail: "email",
    dPhone: "phone", dCity: "city", dCountry: "country", dBirthday: "birthday"
  };
  Object.entries(fields).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.value = user[key] || "";
  });

  // Photo upload
  const photoInput      = document.getElementById("photoInput");
  const avOverlay       = document.getElementById("changePhotoBtn");
  const changePhotoLink = document.getElementById("changePhotoLink");
  const triggerPhoto    = () => photoInput?.click();
  avOverlay?.addEventListener("click", triggerPhoto);
  changePhotoLink?.addEventListener("click", triggerPhoto);

  photoInput?.addEventListener("change", async e => {
    const file = e.target.files?.[0]; if (!file) return;
    const dataUrl = await resizePhoto(file);
    if (!dataUrl) { showToast("Failed to process photo."); return; }
    const current = await Session.get();
    if (current) await Session.save({ ...current, photo: dataUrl });
    await patchProfile({ photo: dataUrl });
    await populateUserUI(await Session.get() || user);
    showToast("Photo updated!");
  });

  // Save / cancel
  const saveBtn   = document.getElementById("saveAccount");
  const cancelBtn = document.getElementById("cancelAccount");

  saveBtn?.addEventListener("click", async () => {
    let ok = true;
    [["dFirst","dFirstErr"],["dLast","dLastErr"],["dEmail","dEmailErr"]].forEach(([id,errId]) => {
      const el = document.getElementById(id), err = document.getElementById(errId);
      if (!el) return;
      if (!el.value.trim()) {
        el.classList.add("err"); if (err) err.textContent = "Required"; ok = false;
      } else {
        el.classList.remove("err"); if (err) err.textContent = "";
      }
    });
    if (!ok) return;
    setLoading(saveBtn, true);
    const current = await Session.get() || user;
    const newFirst = document.getElementById("dFirst")?.value.trim() || current.firstName;
    const newLast  = document.getElementById("dLast")?.value.trim()  || current.lastName;
    // Recompute initials whenever name changes
    const newInitials = ((newFirst[0]||"") + (newLast[0]||"")).toUpperCase() || current.initials || "R";
    const profileData = {
      firstName: newFirst,
      lastName:  newLast,
      initials:  newInitials,
      email:     document.getElementById("dEmail")?.value.trim()   || current.email,
      phone:     document.getElementById("dPhone")?.value.trim()   || null,
      city:      document.getElementById("dCity")?.value.trim()    || null,
      country:   document.getElementById("dCountry")?.value.trim() || null,
      birthday:  document.getElementById("dBirthday")?.value       || null,
    };
    await Session.save({ ...current, ...profileData });
    await patchProfile(profileData);
    setLoading(saveBtn, false);
    await populateUserUI(await Session.get() || user);
    showToast("Changes saved!");
  });

  cancelBtn?.addEventListener("click", async () => {
    const u = await Session.get();
    Object.entries(fields).forEach(([id, key]) => {
      const el = document.getElementById(id); if (el) el.value = u[key] || "";
    });
  });

  document.getElementById("deleteAccountBtn")?.addEventListener("click", () => {
    if (!confirm("Delete your account? This cannot be undone.")) return;
    const uid = localStorage.getItem("current_user_id");
    if (uid && db) {
      const d = db.prepare("DELETE FROM users WHERE id = ?");
      d.run([uid]); d.free(); saveDatabase();
    }
    Session.clear(true);
    window.location.href = "index.html";
  });

  return user;
}

/* ── SECURITY PANEL ──────────────────────────────────────────────── */
async function initSecurity() {
  const pwNew = document.getElementById("pwNew");
  pwNew?.addEventListener("input", () => {
    const v    = pwNew.value;
    const bars = document.querySelectorAll(".str-meter span");
    const lbl  = document.getElementById("strLbl");
    let score  = 0;
    if (v.length >= 8)          score++;
    if (/[A-Z]/.test(v))        score++;
    if (/[0-9]/.test(v))        score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    const cls    = ["","w","f","g","s"];
    const labels = ["","Weak","Fair","Good","Strong"];
    bars.forEach((b,i) => { b.className = i < score ? cls[score] : ""; });
    if (lbl) lbl.textContent = v.length ? labels[score] : "";
  });

  document.querySelectorAll(".pw-eye").forEach(btn => {
    btn.addEventListener("click", () => {
      const inp = document.getElementById(btn.dataset.for); if (!inp) return;
      inp.type = inp.type === "password" ? "text" : "password";
    });
  });

  const savePw  = document.getElementById("savePw");
  const clearPw = document.getElementById("clearPw");

  savePw?.addEventListener("click", async () => {
    const pwCur = document.getElementById("pwCur");
    const pwCfm = document.getElementById("pwCfm");
    if (!pwCur || !pwNew || !pwCfm) return;

    ["pwCurErr","pwNewErr","pwCfmErr"].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = "";
    });
    [pwCur, pwNew, pwCfm].forEach(el => el.classList.remove("err"));

    let ok = true;
    if (!pwCur.value) { pwCur.classList.add("err"); document.getElementById("pwCurErr").textContent="Required"; ok=false; }
    if (!pwNew.value) { pwNew.classList.add("err"); document.getElementById("pwNewErr").textContent="Required"; ok=false; }
    if (pwNew.value && pwNew.value.length < 8) { pwNew.classList.add("err"); document.getElementById("pwNewErr").textContent="Min 8 characters"; ok=false; }
    if (pwNew.value && pwCfm.value !== pwNew.value) { pwCfm.classList.add("err"); document.getElementById("pwCfmErr").textContent="Passwords don't match"; ok=false; }
    if (!ok) return;

    setLoading(savePw, true);
    await dbReady;
    const uid = localStorage.getItem("current_user_id");
    if (!uid || !db) { showToast("Not logged in."); setLoading(savePw,false); return; }
    const s   = db.prepare("SELECT password FROM users WHERE id=?");
    const row = s.getAsObject([uid]); s.free();
    if (row.password !== pwCur.value) {
      pwCur.classList.add("err");
      document.getElementById("pwCurErr").textContent = "Incorrect password";
      setLoading(savePw, false); return;
    }
    const upd = db.prepare("UPDATE users SET password=? WHERE id=?");
    upd.run([pwNew.value, uid]); upd.free();
    await saveDatabase();
    pwCur.value = ""; pwNew.value = ""; pwCfm.value = "";
    document.querySelectorAll(".str-meter span").forEach(b => b.className="");
    const lbl = document.getElementById("strLbl"); if (lbl) lbl.textContent="";
    setLoading(savePw, false);
    showToast("Password updated!");
  });

  clearPw?.addEventListener("click", () => {
    ["pwCur","pwNew","pwCfm"].forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
    ["pwCurErr","pwNewErr","pwCfmErr"].forEach(id => { const el=document.getElementById(id); if(el) el.textContent=""; });
    ["pwCur","pwNew","pwCfm"].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove("err"); });
    document.querySelectorAll(".str-meter span").forEach(b => b.className="");
    const lbl=document.getElementById("strLbl"); if(lbl) lbl.textContent="";
  });

  // Email 2FA toggle
  const twoFaToggle = document.getElementById("twoFaToggle");
  if (twoFaToggle) {
    // Load current state from server
    const token = getToken();
    if (token) {
      fetch('/api/profile', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.user?.twoFaEnabled != null) twoFaToggle.checked = !!data.user.twoFaEnabled; })
        .catch(() => {});
    }
    twoFaToggle.addEventListener("change", async () => {
      const enabled = twoFaToggle.checked;
      if (!token) { twoFaToggle.checked = !enabled; showToast("Please sign in to change this setting."); return; }
      try {
        const resp = await fetch('/api/auth/2fa/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ enabled }),
        });
        if (resp.ok) {
          showToast(enabled ? "Two-factor authentication enabled." : "Two-factor authentication disabled.");
        } else {
          twoFaToggle.checked = !enabled;
          showToast("Failed to update 2FA setting.");
        }
      } catch (_) {
        twoFaToggle.checked = !enabled;
        showToast("Connection error.");
      }
    });
  }

  renderSessions();
  function renderSessions() {
    const container = document.getElementById("sessionsContainer");
    if (!container) return;
    const devices = Session.getDevices();
    if (devices.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">No active sessions found.</p>';
      return;
    }
    const iconDesktop = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`;
    const iconMobile  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>`;
    container.innerHTML = devices.map(d => {
      const lastSeen = new Date(d.lastSeen);
      const now      = new Date();
      const diffMin  = Math.round((now - lastSeen) / 60000);
      const timeStr  = d.current ? "Active now"
        : diffMin < 60   ? `${diffMin}m ago`
        : diffMin < 1440 ? `${Math.round(diffMin/60)}h ago`
        : lastSeen.toLocaleDateString();
      return `<div class="sess-row" data-id="${d.id}">
        <div class="sess-icon">${d.type === "mobile" ? iconMobile : iconDesktop}</div>
        <div class="sess-info">
          <div class="sess-name">${esc(d.brand)} on ${esc(d.os)}${d.current ? ' <span class="badge-brand" style="font-size:10px;padding:1px 7px;margin-left:6px;border-radius:999px">This device</span>' : ''}</div>
          <div class="sess-meta">${timeStr}</div>
        </div>
        ${d.current ? '' : `<button class="sess-revoke" data-id="${d.id}" title="Revoke">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="13" height="13"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>`}
      </div>`;
    }).join("");
    container.querySelectorAll(".sess-revoke").forEach(btn =>
      btn.addEventListener("click", () => {
        Session.removeDevice(btn.dataset.id);
        renderSessions();
        showToast("Session revoked.");
      })
    );
  }
}

/* ── APPEARANCE PANEL ────────────────────────────────────────────── */
async function initAppearance() {
  const themeToggle = document.getElementById("themeToggleInp");
  if (themeToggle) {
    themeToggle.checked = (Theme.get() === "dark");
    themeToggle.addEventListener("change", async () => {
      const next = themeToggle.checked ? "dark" : "light";
      Theme.set(next);
      Theme.apply();
      // Persist to account if logged in
      const u = await Session.get();
      if (u) await Session.save({ ...u, theme: next });
      patchProfile({ theme: next });
    });
  }

  const motionToggle = document.getElementById("motionToggleInp");
  if (motionToggle) {
    // Legge direttamente da localStorage per evitare desync con shared.js
    const reduceActive = localStorage.getItem("ride_reduce_motion") === "true";
    motionToggle.checked = reduceActive;
    motionToggle.addEventListener("change", async () => {
      localStorage.setItem("ride_reduce_motion", motionToggle.checked ? "true" : "false");
      if (motionToggle.checked) {
        document.documentElement.classList.add("reduce-motion");
      } else {
        document.documentElement.classList.remove("reduce-motion");
      }
      // Propaga anche a Motion (se definito in shared.js)
      if (typeof Motion !== "undefined") {
        Motion.set(motionToggle.checked);
        Motion.apply();
      }
      // Persist to account if logged in
      const u = await Session.get();
      if (u) await Session.save({ ...u, reduceMotion: String(motionToggle.checked) });
      patchProfile({ reduceMotion: String(motionToggle.checked) });
    });
  }

  const langGrid = document.getElementById("langGrid");
  if (langGrid) {
    const current = Lang.get();
    langGrid.querySelectorAll(".lang-card").forEach(card => {
      card.classList.toggle("sel", card.dataset.lang === current);
      card.addEventListener("click", () => {
        langGrid.querySelectorAll(".lang-card").forEach(c => c.classList.remove("sel"));
        card.classList.add("sel");
      });
    });
  }

  document.getElementById("saveLang")?.addEventListener("click", async () => {
    const sel = document.querySelector("#langGrid .lang-card.sel");
    if (!sel) return;
    const newLang = sel.dataset.lang;
    // Fetch the session FIRST — Session.get() internally calls Lang.set(user.lang)
    // which would overwrite the new choice if called after Lang.set(newLang).
    const u = await Session.get();
    Lang.set(newLang);
    if (u) await Session.save({ ...u, lang: newLang });
    patchProfile({ lang: newLang });
    // Apply AFTER all async work so no subsequent Lang.set() can overwrite
    Lang.apply();
    showToast(Lang.t("saveLanguage") || "Language saved!");
  });
}

/* ── BILLING PANEL ───────────────────────────────────────────────── */
function initBilling() {
  const uid = localStorage.getItem("current_user_id") || "guest";
  const CARDS_KEY = "ride_cards_" + uid;

  function loadCards() {
    try { return JSON.parse(localStorage.getItem(CARDS_KEY) || "[]"); }
    catch { return []; }
  }
  function saveCards(cards) {
    localStorage.setItem(CARDS_KEY, JSON.stringify(cards));
  }

  // Seed demo cards if none exist
  if (!localStorage.getItem(CARDS_KEY)) {
    saveCards([
      { id:"c1", brand:"VISA", cls:"visa", num:"•••• •••• •••• 4242", exp:"12/26", name:"Marco Rossi", dflt:true  },
      { id:"c2", brand:"MC",   cls:"mc",   num:"•••• •••• •••• 8888", exp:"09/25", name:"Marco Rossi", dflt:false }
    ]);
  }

  const cardsList = document.getElementById("cardsList");
  if (cardsList) {
    function renderCards() {
      const cards = loadCards();
      cardsList.innerHTML = cards.map((card, i) => `
        <div class="card-item${card.dflt ? " dflt" : ""}" data-idx="${i}">
          <span class="cbrand ${esc(card.cls)}">${esc(card.brand)}</span>
          <div class="cinfo">
            <div class="cnum">${card.num}</div>
            <div class="cmeta">Expires ${esc(card.exp)} · ${esc(card.name)}</div>
          </div>
          <div class="cbadges">
            ${card.dflt
              ? '<span class="badge-brand">Default</span>'
              : `<button class="set-dflt" data-idx="${i}">Set default</button>`}
          </div>
          <button class="cbtn-del" data-idx="${i}" title="Remove card">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>`).join("");
    }

    renderCards();

    cardsList.addEventListener("click", e => {
      const cards = loadCards();
      const dfltBtn = e.target.closest(".set-dflt");
      if (dfltBtn) {
        const idx = parseInt(dfltBtn.dataset.idx, 10);
        cards.forEach((card, i) => { card.dflt = (i === idx); });
        saveCards(cards); renderCards(); showToast("Default card updated.");
        return;
      }
      const delBtn = e.target.closest(".cbtn-del");
      if (delBtn) {
        const idx = parseInt(delBtn.dataset.idx, 10);
        const wasDflt = cards[idx]?.dflt;
        cards.splice(idx, 1);
        if (wasDflt && cards.length > 0) cards[0].dflt = true;
        saveCards(cards); renderCards(); showToast("Card removed.");
      }
    });
  }

  const billTbody = document.getElementById("billTbody");
  if (billTbody) {
    const txKey = "ride_rides_" + uid;
    let rides = [];
    try { rides = JSON.parse(localStorage.getItem(txKey) || "[]"); } catch {}
    if (rides.length) {
      billTbody.innerHTML = rides.slice(0, 8).map(r => `
        <tr>
          <td>Ride to ${esc(r.to || "—")}</td>
          <td>${r.date ? new Date(r.date).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}) : "—"}</td>
          <td>${r.status === "cancelled" ? "—" : "€" + (r.fare || 0).toFixed(2)}</td>
          <td><span class="badge ${r.status==="completed"?"badge-green":r.status==="cancelled"?"badge-red":"badge-yellow"}">${r.status||"—"}</span></td>
        </tr>`).join("");
    } else {
      const rows = [
        { desc:"Ride to Termini Station",   date:"7 Mar 2026",  amt:"€8.50",  status:"Completed", cls:"badge-green"  },
        { desc:"Ride to Fiumicino Airport", date:"5 Mar 2026",  amt:"€32.00", status:"Completed", cls:"badge-green"  },
        { desc:"Ride to Testaccio",         date:"2 Mar 2026",  amt:"€6.20",  status:"Refunded",  cls:"badge-purple" },
        { desc:"Ride to Prati",             date:"28 Feb 2026", amt:"€11.00", status:"Completed", cls:"badge-green"  },
        { desc:"Ride to EUR",               date:"25 Feb 2026", amt:"€14.50", status:"Pending",   cls:"badge-yellow" }
      ];
      billTbody.innerHTML = rows.map(r =>
        `<tr><td>${r.desc}</td><td>${r.date}</td><td>${r.amt}</td>
         <td><span class="badge ${r.cls}">${r.status}</span></td></tr>`
      ).join("");
    }
  }

  const addCardToggle = document.getElementById("addCardToggle");
  const addForm       = document.getElementById("addForm");
  const addCardCancel = document.getElementById("addCardCancel");
  const addCardSave   = document.getElementById("addCardSave");

  addCardToggle?.addEventListener("click", () => addForm?.classList.toggle("show"));
  addCardCancel?.addEventListener("click", () => { addForm?.classList.remove("show"); clearForm(); });

  const cName = document.getElementById("cName");
  const cNum  = document.getElementById("cNum");
  const cExp  = document.getElementById("cExp");
  const cCvv  = document.getElementById("cCvv");

  cName?.addEventListener("input", () => {
    const el = document.getElementById("cpHolder");
    if (el) el.textContent = cName.value.toUpperCase() || "CARDHOLDER NAME";
  });
  cNum?.addEventListener("input", () => {
    let v = cNum.value.replace(/\D/g,"").slice(0,16);
    cNum.value = v.replace(/(.{4})/g,"$1 ").trim();
    const el = document.getElementById("cpNum");
    if (el) el.textContent = (v+"????????????????").slice(0,16).replace(/(.{4})/g,"$1 ").trim().replace(/[0-9]/g,"•");
    const brand = document.getElementById("cpBrand");
    if (brand) brand.textContent = v.startsWith("4")?"VISA":v.startsWith("5")?"MC":v.startsWith("3")?"AMEX":"";
  });
  cExp?.addEventListener("input", () => {
    let v = cExp.value.replace(/\D/g,"").slice(0,4);
    if (v.length > 2) v = v.slice(0,2) + " / " + v.slice(2);
    cExp.value = v;
    const el = document.getElementById("cpExp");
    if (el) el.textContent = v || "MM / YY";
  });

  addCardSave?.addEventListener("click", () => {
    const name = cName?.value.trim();
    const num  = cNum?.value.replace(/\s/g,"");
    const exp  = cExp?.value;
    const cvv  = cCvv?.value;
    if (!name || num.length < 15 || exp.length < 4 || !cvv) {
      showToast("Please fill in all fields correctly."); return;
    }
    const brand = num.startsWith("4")?"VISA":num.startsWith("5")?"MC":num.startsWith("3")?"AMEX":"CARD";
    const cls   = brand==="VISA"?"visa":brand==="MC"?"mc":brand==="AMEX"?"amex":"other";
    const cards = loadCards();
    cards.push({
      id: "c" + Date.now(), brand, cls,
      num: "•••• •••• •••• " + num.slice(-4),
      exp: exp.replace(" ",""), name, dflt: cards.length === 0
    });
    saveCards(cards);
    if (cardsList) renderCards();
    addForm?.classList.remove("show");
    clearForm();
    showToast("Card added!");
  });

  function clearForm() {
    if (cName) cName.value = "";
    if (cNum)  cNum.value  = "";
    if (cExp)  cExp.value  = "";
    if (cCvv)  cCvv.value  = "";
    const h = document.getElementById("cpHolder"); if (h) h.textContent = "CARDHOLDER NAME";
    const n = document.getElementById("cpNum");    if (n) n.textContent = "•••• •••• •••• ••••";
    const e = document.getElementById("cpExp");    if (e) e.textContent = "MM / YY";
    const b = document.getElementById("cpBrand");  if (b) b.textContent = "";
  }
}
/* ── NOTIFICATIONS PANEL ─────────────────────────────────────────── */
function initNotifications() {
  const PREFS_KEY = "ride_notif_prefs";
  const IDS = ["nPush","nSms","nRideReminders","nReceipts","nAccount","nPromo"];

  // Load saved prefs
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el && saved[id] !== undefined) el.checked = saved[id];
    });
  } catch (_) {}

  // When push toggle is enabled, request browser permission
  const pushEl = document.getElementById("nPush");
  pushEl?.addEventListener("change", async () => {
    if (!pushEl.checked) return;
    if (!("Notification" in window)) {
      showToast("Browser notifications are not supported.");
      pushEl.checked = false;
      return;
    }
    if (Notification.permission === "denied") {
      showToast("Notification permission blocked. Allow it in browser settings.");
      pushEl.checked = false;
      return;
    }
    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        showToast("Permission not granted — push notifications disabled.");
        pushEl.checked = false;
        return;
      }
    }
    showToast("Push notifications enabled!");
    // Send a test notification
    new Notification("Ride Notifications", {
      body: "You'll now receive ride reminders and updates.",
      icon: "assets/favicon.svg",
    });
  });

  document.getElementById("saveNotifs")?.addEventListener("click", () => {
    const prefs = {};
    IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) prefs[id] = el.checked;
    });
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    showToast("Notification preferences saved!");
  });
}

/* ── PRIVACY PANEL ───────────────────────────────────────────────── */
function initPrivacy() {
  document.getElementById("exportDataBtn")?.addEventListener("click", () => {
    showToast("Data export request sent — check your email in 48 h.");
  });
  document.getElementById("savePrivacy")?.addEventListener("click", () => {
    showToast("Privacy settings saved!");
  });
}

/* ── PROFILE DROPDOWN (topbar) ───────────────────────────────────── */
function initProfileDropdown(user) {
  const avatar   = document.getElementById("tbAvatar");
  const dropdown = document.getElementById("profileDropdown");
  if (!avatar || !dropdown) return;

  // Populate dropdown user info
  const ddAv    = document.getElementById("ddAvatar");
  const ddName  = document.getElementById("ddName");
  const ddEmail = document.getElementById("ddEmail");
  const full    = `${user.firstName||""} ${user.lastName||""}`.trim() || "Rider";
  if (ddName)  ddName.textContent  = full;
  if (ddEmail) ddEmail.textContent = user.email || "";
  if (ddAv) {
    if (user.photo) { _setAvatarPhoto(ddAv, user.photo, ""); ddAv.style.background = "transparent"; }
    else ddAv.textContent = user.initials || full[0] || "R";
  }

  let isOpen = false;
  const open  = () => { dropdown.classList.add("open"); isOpen = true; };
  const close = () => { dropdown.classList.remove("open"); isOpen = false; };

  avatar.addEventListener("click", e => { e.stopPropagation(); isOpen ? close() : open(); });
  document.addEventListener("click", e => {
    if (!dropdown.contains(e.target) && e.target !== avatar) close();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });

  document.getElementById("ddSignOut")?.addEventListener("click", () => {
    close();
    document.getElementById("soModal")?.classList.add("open");
  });
}


/* ── DYNAMIC BACK BUTTON ─────────────────────────────────────────── */
function initBackBtn() {
  const backEl  = document.getElementById("tbBack");
  const backLbl = document.getElementById("tbBackLabel");
  if (!backEl || !backLbl) return;

  const PAGE_LABELS = {
    "index.html": "Home",   "index": "Home",   "/": "Home",
    "dashboard.html": "Dashboard", "dashboard": "Dashboard",
    "login.html": "Sign in",  "login": "Sign in",
  };

  const ref = document.referrer;
  let label = "Home";
  let href  = "index.html";

  if (ref) {
    try {
      const u    = new URL(ref);
      const page = u.pathname.split("/").pop().replace(".html", "") || "index";
      const key  = Object.keys(PAGE_LABELS).find(k => k.replace(".html","") === page);
      if (key) { label = PAGE_LABELS[key]; href = ref; }
    } catch(_) {}
  }

  backLbl.textContent = label;
  backEl.href = href;
  backEl.addEventListener("click", e => {
    if (ref && href === ref) { e.preventDefault(); history.back(); }
  });
}

function initLogout() {
  const modal      = document.getElementById("soModal");
  const btnOpen    = document.getElementById("btnLogout");
  const btnCancel  = document.getElementById("soCancel");
  const btnConfirm = document.getElementById("soConfirm");

  btnOpen?.addEventListener("click",   () => modal?.classList.add("open"));
  btnCancel?.addEventListener("click", () => modal?.classList.remove("open"));
  modal?.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("open"); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") modal?.classList.remove("open"); });
  btnConfirm?.addEventListener("click", () => { Session.clear(true); window.location.href = "index.html"; });
}

/* ── BOOTSTRAP ───────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  // Applica sempre tema e reduce-motion da localStorage (fallback se inline <script> manca in altre pagine)
  const theme = localStorage.getItem("ride_theme") || "dark";
  document.documentElement.setAttribute("data-theme", theme);
  if (localStorage.getItem("ride_reduce_motion") === "true") {
    document.documentElement.classList.add("reduce-motion");
  } else {
    document.documentElement.classList.remove("reduce-motion");
  }

  if (typeof Theme !== "undefined") Theme.apply();
  if (typeof Motion !== "undefined") Motion.apply();
  if (typeof Lang !== "undefined") Lang.apply();

  initNav();
  initLogout();
  initBackBtn();
  const _user = await initAccount();
  if (_user) initProfileDropdown(_user);
  await initSecurity();
  initAppearance();
  initBilling();
  initNotifications();
  initPrivacy();
});