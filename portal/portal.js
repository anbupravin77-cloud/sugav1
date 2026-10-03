/* Suga.health portal — shared client: API, session guard, formatting, safety. */
(function () {
  'use strict';
  var P = {};

  /* ---------- API client ---------- */
  P.api = function (path, opts) {
    opts = opts || {};
    return fetch(path, {
      method: opts.method || 'GET',
      credentials: 'same-origin',
      headers: opts.body ? { 'content-type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (r.status === 401 && location.pathname.indexOf('login') === -1) {
          location.href = 'login.html';
          throw new Error('Not signed in.');
        }
        if (!r.ok) throw new Error(data.error || ('Request failed (' + r.status + ')'));
        return data;
      });
    });
  };

  /* ---------- session ---------- */
  P.me = null;
  P.guard = function (roles) {
    return P.api('/api/auth/me').then(function (d) {
      P.me = d.user;
      if (roles && roles.indexOf(d.user.role) === -1) {
        location.href = 'index.html';
        throw new Error('Wrong role.');
      }
      var chip = document.querySelector('[data-user-chip]');
      if (chip) chip.textContent = d.user.name + ' · ' + (d.user.role === 'admin' ? 'Admin' : 'Doctor');
      document.querySelectorAll('[data-admin-only]').forEach(function (el) {
        if (d.user.role !== 'admin') el.remove();
      });
      return d.user;
    });
  };
  P.logout = function () {
    P.api('/api/auth/logout', { method: 'POST' }).then(function () { location.href = 'login.html'; });
  };

  /* ---------- safety: ALWAYS render patient text through this ---------- */
  P.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* ---------- vocab ---------- */
  P.GOALS = { 'weight-loss': 'Weight loss', 'hair-growth': 'Hair growth', 'sexual-health': 'Sexual health' };
  P.STATUS = {
    new:              { label: 'New',              cls: 'st-new' },
    in_review:        { label: 'In review',        cls: 'st-review' },
    awaiting_patient: { label: 'Awaiting patient', cls: 'st-wait' },
    plan_sent:        { label: 'Plan sent',        cls: 'st-plan' },
    excluded:         { label: 'Excluded',         cls: 'st-excl' },
    closed:           { label: 'Closed',           cls: 'st-closed' },
  };
  P.stamp = function (status) {
    var s = P.STATUS[status] || { label: status, cls: '' };
    return '<span class="pstamp ' + s.cls + '">' + P.esc(s.label) + '</span>';
  };

  /* red-flag ICD codes a doctor wants to see before opening the chart */
  P.RED_FLAGS = {
    'I25.10': 'CAD', 'I48.91': 'AFib', 'I63.9': 'Prior stroke', 'N18.9': 'CKD',
    'E10.9': 'T1 diabetes', 'Z86.711': 'DVT history', 'B18.2': 'Hep C',
  };
  P.flags = function (conditions) {
    var out = [];
    (conditions || []).forEach(function (c) {
      if (c && c.code && P.RED_FLAGS[c.code]) out.push(P.RED_FLAGS[c.code]);
    });
    return out;
  };

  /* ---------- time / SLA (24h review promise) ---------- */
  P.ago = function (iso) {
    var mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 60) return mins + 'm ago';
    var h = Math.floor(mins / 60);
    if (h < 48) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  };
  P.slaClass = function (createdAt, status) {
    if (status !== 'new' && status !== 'in_review') return '';
    var h = (Date.now() - new Date(createdAt).getTime()) / 3600000;
    if (h >= 24) return 'sla-late';
    if (h >= 18) return 'sla-warn';
    return 'sla-ok';
  };

  P.bmiBand = function (bmi) {
    if (!bmi) return '';
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Healthy';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  };

  P.qs = function (name) { return new URLSearchParams(location.search).get(name); };
  P.toast = function (msg, isErr) {
    var t = document.createElement('div');
    t.className = 'ptoast' + (isErr ? ' ptoast--err' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('is-on'); }, 10);
    setTimeout(function () { t.classList.remove('is-on'); setTimeout(function () { t.remove(); }, 300); }, 3200);
  };

  window.Portal = P;
})();
