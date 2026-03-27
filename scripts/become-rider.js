"use strict";

function getToken() { return localStorage.getItem('ride_token') || null; }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

document.addEventListener('DOMContentLoaded', async () => {
  Theme.apply(); Lang.apply();

  const user = await Session.get();
  const form     = document.getElementById('brForm');
  const submitBtn = document.getElementById('brSubmit');
  const submitLbl = document.getElementById('brSubmitLabel');
  const spinner  = document.getElementById('brSpinner');
  const errorEl  = document.getElementById('brError');
  const formCard = document.getElementById('brFormCard');
  const result   = document.getElementById('brResult');
  const resultIcon  = document.getElementById('brResultIcon');
  const resultTitle = document.getElementById('brResultTitle');
  const resultMsg   = document.getElementById('brResultMsg');

  // Pre-fill user info if logged in
  if (user) {
    const first = document.getElementById('brFirst');
    const last  = document.getElementById('brLast');
    const phone = document.getElementById('brPhone');
    const city  = document.getElementById('brCity');
    if (first && user.firstName) first.value = user.firstName;
    if (last  && user.lastName)  last.value  = user.lastName;
    if (phone && user.phone)     phone.value = user.phone;
    if (city  && user.city)      city.value  = user.city;

    // Already a rider?
    if ((user.accountType || 'user') === 'rider') {
      formCard.innerHTML = `<div style="text-align:center;padding:32px 0">
        <div style="font-size:40px;margin-bottom:12px">🏁</div>
        <h2 style="font-size:18px;font-weight:700;margin-bottom:8px">You're already a Ride driver!</h2>
        <p style="font-size:13.5px;color:var(--muted)">Your account already has rider status. Head to your dashboard to manage rides.</p>
        <a href="dashboard.html" class="br-result-btn" style="margin-top:20px;display:inline-flex">Go to Dashboard</a>
      </div>`;
      return;
    }
  } else {
    // Not logged in — redirect
    window.location.href = 'login.html?redirect=become-rider.html';
    return;
  }

  // Character counter
  const textarea = document.getElementById('brStatement');
  const counter  = document.getElementById('brCharCount');
  textarea?.addEventListener('input', () => {
    if (counter) counter.textContent = textarea.value.length;
  });

  // Form submit
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    errorEl.style.display = 'none';

    const data = {
      firstName:    document.getElementById('brFirst')?.value.trim(),
      lastName:     document.getElementById('brLast')?.value.trim(),
      phone:        document.getElementById('brPhone')?.value.trim(),
      city:         document.getElementById('brCity')?.value.trim(),
      vehicleMake:  document.getElementById('brMake')?.value.trim(),
      vehicleModel: document.getElementById('brModel')?.value.trim(),
      vehicleYear:  document.getElementById('brYear')?.value.trim(),
      experience:   document.getElementById('brExp')?.value.trim(),
      licenseNumber:document.getElementById('brLicense')?.value.trim(),
      statement:    document.getElementById('brStatement')?.value.trim(),
    };

    // Client-side validation
    for (const [k, v] of Object.entries(data)) {
      if (!v) {
        showError('Please fill in all fields.');
        return;
      }
    }
    if (data.statement.length < 20) {
      showError('Personal statement must be at least 20 characters.');
      return;
    }
    const year = parseInt(data.vehicleYear);
    if (isNaN(year) || year < 2015) {
      showError('Vehicle must be from 2015 or newer.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/apply-rider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getToken(),
        },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        showError(json.error || 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }
      showResult(json.decision, json.reason);
    } catch (_) {
      showError('Network error. Please check your connection and try again.');
      setLoading(false);
    }
  });

  function setLoading(on) {
    submitBtn.disabled = on;
    submitLbl.style.display = on ? 'none' : '';
    spinner.style.display = on ? '' : 'none';
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = '';
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showResult(decision, reason) {
    formCard.style.display = 'none';
    result.style.display = '';

    if (decision === 'approved') {
      resultIcon.className = 'br-result-icon approved';
      resultIcon.textContent = '🎉';
      resultTitle.textContent = 'Application approved!';
      resultMsg.textContent = `Congratulations! You've been approved as a Ride driver. ${reason ? 'Note: ' + reason : 'Check your email for details.'}`;
    } else if (decision === 'rejected') {
      resultIcon.className = 'br-result-icon rejected';
      resultIcon.textContent = '❌';
      resultTitle.textContent = 'Application not approved';
      resultMsg.textContent = `Thank you for applying. ${reason ? reason : 'Unfortunately your application did not meet our current requirements.'} You may apply again after reviewing the requirements.`;
    } else {
      // pending (AI unavailable)
      resultIcon.className = 'br-result-icon';
      resultIcon.style.background = 'rgba(61,94,255,.12)';
      resultIcon.textContent = '⏳';
      resultTitle.textContent = 'Application received';
      resultMsg.textContent = 'Your application is under review. You will receive an email with our decision within 24 hours.';
    }
  }
});
