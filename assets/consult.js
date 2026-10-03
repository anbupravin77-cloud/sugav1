/* ============================================================
   Suga.health — consultation intake wizard
   Vanilla JS, no dependencies, works from file://
   All state lives in one object; draft persisted to localStorage.
   ============================================================ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  var form = $('intakeForm');
  if (!form) { return; }

  /* ---------------- reference data ---------------- */

  var ICD10 = [
    { code: 'I10', name: 'High blood pressure (hypertension)' },
    { code: 'E11.9', name: 'Type 2 diabetes' },
    { code: 'E78.5', name: 'High cholesterol (dyslipidemia)' },
    { code: 'E66.9', name: 'Obesity' },
    { code: 'K21.9', name: 'Acid reflux (GERD)' },
    { code: 'E03.9', name: 'Underactive thyroid (hypothyroidism)' },
    { code: 'E05.90', name: 'Overactive thyroid (hyperthyroidism)' },
    { code: 'E28.2', name: 'PCOS' },
    { code: 'G47.33', name: 'Obstructive sleep apnea' },
    { code: 'F32.9', name: 'Depression' },
    { code: 'F41.9', name: 'Anxiety' },
    { code: 'J45.909', name: 'Asthma' },
    { code: 'M10.9', name: 'Gout' },
    { code: 'N18.9', name: 'Chronic kidney disease' },
    { code: 'K76.0', name: 'Fatty liver' },
    { code: 'I25.10', name: 'Coronary artery disease' },
    { code: 'I48.91', name: 'Atrial fibrillation' },
    { code: 'E55.9', name: 'Vitamin D deficiency' },
    { code: 'D50.9', name: 'Iron-deficiency anemia' },
    { code: 'L64.9', name: 'Pattern hair loss (androgenetic alopecia)' },
    { code: 'L63.9', name: 'Alopecia areata' },
    { code: 'L21.9', name: 'Seborrheic dermatitis' },
    { code: 'N52.9', name: 'Erectile dysfunction' },
    { code: 'F52.4', name: 'Premature ejaculation' },
    { code: 'E29.1', name: 'Low testosterone' },
    { code: 'N40.0', name: 'Enlarged prostate (BPH)' },
    { code: 'F51.01', name: 'Insomnia' },
    { code: 'G43.909', name: 'Migraine' },
    { code: 'M54.5', name: 'Low back pain' },
    { code: 'K58.9', name: 'Irritable bowel syndrome (IBS)' },
    { code: 'L40.9', name: 'Psoriasis' },
    { code: 'L20.9', name: 'Eczema (atopic dermatitis)' },
    { code: 'I63.9', name: 'Prior stroke' },
    { code: 'Z86.711', name: 'History of blood clots (DVT)' },
    { code: 'B18.2', name: 'Chronic hepatitis C' },
    { code: 'E10.9', name: 'Type 1 diabetes' }
  ];

  var MED_LIST = ['Metformin', 'Insulin', 'Atorvastatin', 'Rosuvastatin', 'Amlodipine',
    'Telmisartan', 'Losartan', 'Metoprolol', 'Aspirin', 'Levothyroxine', 'Sertraline',
    'Escitalopram', 'Omeprazole', 'Pantoprazole', 'Vitamin D3', 'Multivitamin',
    'Sildenafil', 'Tadalafil', 'Finasteride', 'Minoxidil (topical)'];

  var NO_ALLERGY = 'No known allergies';
  var ALLERGY_LIST = [NO_ALLERGY, 'Penicillin', 'Sulfa drugs', 'Aspirin',
    'NSAIDs (ibuprofen etc.)', 'Codeine or other opioids', 'Local anaesthetics',
    'Contrast dye', 'Latex', 'Eggs', 'Peanuts', 'Tree nuts', 'Shellfish', 'Soy',
    'Dairy (lactose)', 'Gluten', 'Dust mites', 'Pollen', 'Insect stings', 'Pet dander'];

  var GOAL_LABELS = {
    'weight-loss': 'Weight loss',
    'hair-growth': 'Hair growth',
    'sexual-health': 'Sexual health'
  };

  var DRAFT_KEY = 'suga_intake_draft';
  var SUBS_KEY = 'suga_submissions';
  var DASH = '———';

  /* ---------------- state ---------------- */

  var state = {
    goal: '',
    firstName: '',
    lastName: '',
    name: '',
    email: '',
    phone: '',
    dob: '',
    age: '',
    sex: '',
    sexOther: '',
    units: 'metric',
    hCm: null,
    wKg: null,
    /* clinical screening — protocol steps 3–5 */
    screening: {
      married: '', onOCP: '', pregnant: '',
      antiepileptics: '', pancreatitis: '',
      comorbid: [], diabetesComplications: [],
      familyMTC: ''
    },
    conditions: [],      // [{code, name}]
    noConditions: false,
    surgical: '',
    family: [],          // ['Diabetes', ...]
    famDetail: '',
    meds: [],            // [{code:'', name}]
    noMeds: false,
    allergies: [],       // [{code:'', name}]
    notes: '',
    c1: false, c2: false, c3: false
  };

  /* ---------------- storage (guarded, debounced) ---------------- */

  var saveTimer = null;
  function saveDraft() {
    if (saveTimer) { clearTimeout(saveTimer); }
    saveTimer = setTimeout(function () {
      saveTimer = null;
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
    }, 300);
  }
  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) { return; }
      var d = JSON.parse(raw);
      if (!d || typeof d !== 'object') { return; }
      for (var k in state) {
        if (Object.prototype.hasOwnProperty.call(d, k)) { state[k] = d[k]; }
      }
      if (state.units !== 'imperial') { state.units = 'metric'; }
      if (!state.screening || typeof state.screening !== 'object') {
        state.screening = { married: '', onOCP: '', pregnant: '', antiepileptics: '', pancreatitis: '', comorbid: [], diabetesComplications: [], familyMTC: '' };
      }
      if (!isArr(state.screening.comorbid)) { state.screening.comorbid = []; }
      if (!isArr(state.screening.diabetesComplications)) { state.screening.diabetesComplications = []; }
      if (!isArr(state.conditions)) { state.conditions = []; }
      if (!isArr(state.family)) { state.family = []; }
      if (!isArr(state.meds)) { state.meds = []; }
      if (!isArr(state.allergies)) { state.allergies = []; }
    } catch (e) { /* corrupted draft — start clean */ }
  }
  function clearDraft() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
  }
  function isArr(x) { return Object.prototype.toString.call(x) === '[object Array]'; }

  function touch() { saveDraft(); renderSidebar(); }

  /* ---------------- unit helpers ---------------- */

  var LB_PER_KG = 2.2046226;
  function kgToLb(kg) { return kg * LB_PER_KG; }
  function lbToKg(lb) { return lb / LB_PER_KG; }
  function cmToFtIn(cm) {
    var totalIn = cm / 2.54;
    var ft = Math.floor(totalIn / 12);
    var inch = Math.round(totalIn - ft * 12);
    if (inch === 12) { ft += 1; inch = 0; }
    return { ft: ft, inch: inch };
  }
  function round1(n) { return Math.round(n * 10) / 10; }

  function syncNameFromParts() {
    state.name = (state.firstName + ' ' + state.lastName).replace(/\s+/g, ' ').trim();
  }
  function ageFromDob(dobStr) {
    if (!dobStr) { return ''; }
    var d = new Date(dobStr + 'T00:00:00');
    if (isNaN(d.getTime())) { return ''; }
    var today = new Date();
    var years = today.getFullYear() - d.getFullYear();
    var m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) { years--; }
    return years;
  }
  function syncAgeFromDob() {
    var a = ageFromDob(state.dob);
    state.age = a === '' ? '' : String(a);
  }

  var H_MIN = 100, H_MAX = 250;   // cm
  var W_MIN = 30, W_MAX = 350;    // kg
  function heightValid() { return typeof state.hCm === 'number' && state.hCm >= H_MIN && state.hCm <= H_MAX; }
  function weightValid() { return typeof state.wKg === 'number' && state.wKg >= W_MIN && state.wKg <= W_MAX; }

  function bmiVal() {
    if (!heightValid() || !weightValid()) { return null; }
    var m = state.hCm / 100;
    return state.wKg / (m * m);
  }
  function bmiCategory(b) {
    if (b < 18.5) { return 'Underweight'; }
    if (b < 25) { return 'Healthy'; }
    if (b < 30) { return 'Overweight'; }
    return 'Obese';
  }

  function heightDisplay() {
    if (typeof state.hCm !== 'number') { return ''; }
    if (state.units === 'imperial') {
      var fi = cmToFtIn(state.hCm);
      return fi.ft + '′' + fi.inch + '″';
    }
    return round1(state.hCm) + ' cm';
  }
  function weightDisplay() {
    if (typeof state.wKg !== 'number') { return ''; }
    if (state.units === 'imperial') { return Math.round(kgToLb(state.wKg)) + ' lb'; }
    return round1(state.wKg) + ' kg';
  }

  /* ---------------- small DOM helpers ---------------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined && text !== null) { n.textContent = text; }
    return n;
  }
  function setErr(inputEl, errEl, msg) {
    if (!errEl) { return; }
    if (msg) {
      errEl.textContent = msg;
      errEl.hidden = false;
      if (inputEl) { inputEl.classList.add('input--err'); }
    } else {
      errEl.hidden = true;
      if (inputEl) { inputEl.classList.remove('input--err'); }
    }
  }

  /* ---------------- tag picker factory ---------------- */

  function tagPicker(cfg) {
    // cfg: { input, panel, list, suggestions [{code,name}], key, exclusiveName, ariaLabelPrefix }
    var input = $(cfg.input), panel = $(cfg.panel), list = $(cfg.list);
    if (!input || !panel || !list) { return null; }
    var items = [];
    var hl = -1;

    function tags() { return state[cfg.key]; }
    function hasName(name) {
      var ln = name.toLowerCase();
      for (var i = 0; i < tags().length; i++) {
        if (tags()[i].name.toLowerCase() === ln) { return true; }
      }
      return false;
    }
    function exactMatch(q) {
      var ql = q.toLowerCase();
      for (var i = 0; i < cfg.suggestions.length; i++) {
        if (cfg.suggestions[i].name.toLowerCase() === ql) { return cfg.suggestions[i]; }
      }
      return null;
    }
    function add(t) {
      var name = (t.name || '').replace(/\s+/g, ' ').trim();
      if (!name) { return; }
      if (!hasName(name)) {
        if (cfg.exclusiveName) {
          if (name.toLowerCase() === cfg.exclusiveName.toLowerCase()) {
            state[cfg.key] = [];
          } else {
            state[cfg.key] = tags().filter(function (x) {
              return x.name.toLowerCase() !== cfg.exclusiveName.toLowerCase();
            });
          }
        }
        state[cfg.key].push({ code: t.code || '', name: name });
      }
      input.value = '';
      close();
      renderTags();
      touch();
    }
    function removeAt(i) {
      state[cfg.key].splice(i, 1);
      renderTags();
      touch();
      input.focus();
    }
    function renderTags() {
      list.innerHTML = '';
      tags().forEach(function (t, i) {
        var li = el('li', 'tag');
        li.appendChild(el('span', null, t.name));
        if (t.code) { li.appendChild(el('span', 'code', t.code)); }
        var rm = el('button', null, '×');
        rm.type = 'button';
        rm.setAttribute('aria-label', 'Remove ' + t.name);
        rm.addEventListener('click', function () { removeAt(i); });
        li.appendChild(rm);
        list.appendChild(li);
      });
    }
    function filter(q) {
      var ql = q.toLowerCase();
      return cfg.suggestions.filter(function (s) {
        if (hasName(s.name)) { return false; }
        return s.name.toLowerCase().indexOf(ql) > -1 ||
          (s.code && s.code.toLowerCase().indexOf(ql) > -1);
      }).slice(0, 8);
    }
    function open(q) {
      items = filter(q);
      hl = -1;
      panel.innerHTML = '';
      if (!items.length) { close(); return; }
      items.forEach(function (s, i) {
        var b = el('button', 'ac-item');
        b.type = 'button';
        b.setAttribute('role', 'option');
        b.appendChild(el('span', null, s.name));
        if (s.code) { b.appendChild(el('span', 'code', s.code)); }
        b.addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep input focus
        b.addEventListener('click', function () { add(s); input.focus(); });
        panel.appendChild(b);
      });
      panel.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }
    function close() {
      panel.hidden = true;
      panel.innerHTML = '';
      items = [];
      hl = -1;
      input.setAttribute('aria-expanded', 'false');
    }
    function highlight() {
      var kids = panel.children;
      for (var i = 0; i < kids.length; i++) {
        if (i === hl) {
          kids[i].classList.add('is-hl');
          if (kids[i].scrollIntoView) { kids[i].scrollIntoView({ block: 'nearest' }); }
        } else {
          kids[i].classList.remove('is-hl');
        }
      }
    }

    input.addEventListener('input', function () {
      var q = input.value.trim();
      if (q.length >= 1) { open(q); } else { close(); }
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (panel.hidden && input.value.trim()) { open(input.value.trim()); }
        if (!items.length) { return; }
        e.preventDefault();
        if (e.key === 'ArrowDown') { hl = (hl + 1) % items.length; }
        else { hl = hl <= 0 ? items.length - 1 : hl - 1; }
        highlight();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (hl >= 0 && items[hl]) {
          add(items[hl]);
        } else {
          var q = input.value.trim();
          if (q) { add(exactMatch(q) || { code: '', name: q }); }
        }
      } else if (e.key === 'Escape') {
        if (!panel.hidden) {
          e.stopPropagation();
          close();
        }
      }
    });
    input.addEventListener('blur', function () { setTimeout(close, 150); });

    renderTags();
    return {
      renderTags: renderTags,
      setDisabled: function (d, keepTags) {
        input.disabled = d;
        if (d && !keepTags) {
          state[cfg.key] = [];
          input.value = '';
          close();
          renderTags();
        }
      }
    };
  }

  /* ---------------- element handles ---------------- */

  var btnSubmit = $('btnSubmit');
  var inFirstName = $('inFirstName'), inLastName = $('inLastName'), inDob = $('inDob'), inSexOther = $('inSexOther');
  var inEmail = $('inEmail'), inPhone = $('inPhone');
  var sexOtherField = $('sexOtherField');
  var inHcm = $('inHcm'), inHft = $('inHft'), inHin = $('inHin'), inW = $('inW');
  var hMetricField = $('hMetricField'), hImperialField = $('hImperialField');
  var wLabelTxt = $('wLabelTxt');
  var bmiWrap = $('bmiWrap'), bmiCallout = $('bmiCallout');
  var noConditions = $('noConditions'), noMeds = $('noMeds');
  var inSurgical = $('inSurgical'), inFamDetail = $('inFamDetail'), inNotes = $('inNotes');
  var condNudge = $('condNudge');
  var consent1 = $('consent1'), consent2 = $('consent2'), consent3 = $('consent3');

  var condPicker = tagPicker({
    input: 'condInput', panel: 'condPanel', list: 'condTags',
    suggestions: ICD10, key: 'conditions'
  });
  var medPicker = tagPicker({
    input: 'medInput', panel: 'medPanel', list: 'medTags',
    suggestions: MED_LIST.map(function (n) { return { code: '', name: n }; }),
    key: 'meds'
  });
  var algPicker = tagPicker({
    input: 'algInput', panel: 'algPanel', list: 'algTags',
    suggestions: ALLERGY_LIST.map(function (n) { return { code: '', name: n }; }),
    key: 'allergies', exclusiveName: NO_ALLERGY
  });

  /* ---------------- sidebar ---------------- */

  function setSb(id, text) {
    var node = $(id);
    if (!node) { return; }
    if (text) {
      node.textContent = text;
      node.classList.remove('pg-empty');
    } else {
      node.textContent = DASH;
      node.classList.add('pg-empty');
    }
  }
  function listSummary(arr, noneFlag, noneText) {
    if (noneFlag) { return noneText; }
    if (!arr.length) { return ''; }
    var names = arr.map(function (t) { return t.name; });
    if (names.length <= 2) { return names.join(', '); }
    return names[0] + ', ' + names[1] + ' +' + (names.length - 2) + ' more';
  }
  function renderSidebar() {
    setSb('sbGoal', state.goal ? GOAL_LABELS[state.goal] : '');
    setSb('sbName', state.name.replace(/\s+/g, ' ').trim());
    var contact = [];
    if (state.email.trim()) { contact.push(state.email.trim()); }
    if (state.phone.trim()) { contact.push(state.phone.trim()); }
    setSb('sbContact', contact.join(' · '));
    var as = [];
    if (state.age !== '' && state.age !== null && !isNaN(parseInt(state.age, 10))) { as.push(parseInt(state.age, 10)); }
    if (state.sex) { as.push(state.sex); }
    setSb('sbAgeSex', as.join(' · '));
    var hw = [];
    if (heightValid()) { hw.push(heightDisplay()); }
    if (weightValid()) { hw.push(weightDisplay()); }
    setSb('sbBody', hw.join(' · '));
    var b = bmiVal();
    setSb('sbBmi', b ? b.toFixed(1) + ' · ' + bmiCategory(b) : '');
    setSb('sbCond', listSummary(state.conditions, state.noConditions, 'None reported'));
    setSb('sbMeds', listSummary(state.meds, state.noMeds, 'None'));
    setSb('sbAlg', listSummary(state.allergies, false, ''));
  }

  /* ---------------- BMI callout ---------------- */

  function renderBmi() {
    if (!bmiWrap || !bmiCallout) { return; }
    var b = bmiVal();
    if (!b) {
      bmiWrap.hidden = true;
      bmiCallout.innerHTML = '';
      return;
    }
    var cat = bmiCategory(b);
    var imperial = state.units === 'imperial';
    bmiCallout.innerHTML = '';
    bmiCallout.className = 'callout' + (cat === 'Healthy' ? ' callout--vital' : '');

    var line = el('p', 'pg-bmi-line');
    var strong = el('strong', null, 'BMI ' + b.toFixed(1));
    line.appendChild(strong);
    line.appendChild(document.createTextNode(' · ' + (cat === 'Healthy' ? 'Healthy range' : cat)));
    bmiCallout.appendChild(line);

    if (b >= 25) {
      var kg = state.wKg, m = state.hCm / 100;
      var low = Math.round(0.10 * kg);
      var high = Math.round(Math.min(0.18 * kg, kg - 21 * m * m));
      if (high <= low) { high = low + 2; }
      var lowD = low, highD = high, unit = 'kg';
      if (imperial) { lowD = Math.round(kgToLb(low)); highD = Math.round(kgToLb(high)); unit = 'lb'; }
      bmiCallout.appendChild(el('p', 'pen-note', 'your potential'));
      var p = el('p');
      p.appendChild(document.createTextNode('Patients starting where you are typically lose '));
      p.appendChild(el('strong', null, lowD + '–' + highD + ' ' + unit));
      p.appendChild(document.createTextNode(' (10–18% of body weight) over 6–12 months with medical support.'));
      p.style.margin = '0 0 8px';
      bmiCallout.appendChild(p);
      var d = el('p', 'small', 'An estimate, not a promise — your doctor will set a personal target.');
      d.style.margin = '0';
      bmiCallout.appendChild(d);
    } else if (cat === 'Healthy') {
      var hp = el('p', null, 'You are in a healthy weight range. Your doctor will focus on your specific goals — energy, strength, or maintenance.');
      hp.style.margin = '0';
      bmiCallout.appendChild(hp);
    } else {
      var up = el('p', null, 'Your BMI is below the healthy range, so no weight-loss estimate applies. Your doctor will talk through safe options with you — gently and without judgment.');
      up.style.margin = '0';
      bmiCallout.appendChild(up);
    }
    bmiWrap.hidden = false;
  }

  /* ---------------- body inputs (units) ---------------- */

  function renderBodyInputs() {
    var imperial = state.units === 'imperial';
    if (hMetricField) { hMetricField.hidden = imperial; }
    if (hImperialField) { hImperialField.hidden = !imperial; }
    if (wLabelTxt) { wLabelTxt.textContent = imperial ? 'Weight (lb)' : 'Weight (kg)'; }
    if (inW) { inW.placeholder = imperial ? 'e.g. 185' : 'e.g. 84'; }
    var segBtns = form.querySelectorAll('[data-units]');
    for (var i = 0; i < segBtns.length; i++) {
      segBtns[i].setAttribute('aria-pressed', segBtns[i].getAttribute('data-units') === state.units ? 'true' : 'false');
    }
    if (typeof state.hCm === 'number') {
      if (imperial) {
        var fi = cmToFtIn(state.hCm);
        if (inHft) { inHft.value = fi.ft; }
        if (inHin) { inHin.value = fi.inch; }
      } else if (inHcm) {
        inHcm.value = round1(state.hCm);
      }
    } else {
      if (inHcm) { inHcm.value = ''; }
      if (inHft) { inHft.value = ''; }
      if (inHin) { inHin.value = ''; }
    }
    if (inW) {
      if (typeof state.wKg === 'number') {
        inW.value = imperial ? Math.round(kgToLb(state.wKg)) : round1(state.wKg);
      } else {
        inW.value = '';
      }
    }
    renderBmi();
  }

  function readHeightFromInputs() {
    if (state.units === 'imperial') {
      var ft = parseFloat(inHft && inHft.value);
      var inch = parseFloat(inHin && inHin.value);
      if (!isFinite(inch)) { inch = 0; }
      if (isFinite(ft) && ft > 0) {
        state.hCm = round1((ft * 12 + inch) * 2.54);
      } else {
        state.hCm = null;
      }
    } else {
      var cm = parseFloat(inHcm && inHcm.value);
      state.hCm = isFinite(cm) && cm > 0 ? cm : null;
    }
  }
  function readWeightFromInputs() {
    var v = parseFloat(inW && inW.value);
    if (isFinite(v) && v > 0) {
      state.wKg = state.units === 'imperial' ? round1(lbToKg(v)) : v;
    } else {
      state.wKg = null;
    }
  }

  /* ---------------- validation (single page: everything at once) ---------------- */

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  /* Returns the first invalid element (to scroll to), or null when the form is valid. */
  function validateAll() {
    var firstBad = null;
    function fail(node) { if (!firstBad) { firstBad = node; } }

    var gErr = $('errGoal');
    if (!state.goal) {
      if (gErr) { gErr.hidden = false; }
      fail($('sec1'));
    } else if (gErr) { gErr.hidden = true; }

    var firstName = state.firstName.trim();
    if (firstName.length < 1) { setErr(inFirstName, $('errFirstName'), 'Please enter your first name.'); fail(inFirstName); }
    else { setErr(inFirstName, $('errFirstName'), null); }

    var lastName = state.lastName.trim();
    if (lastName.length < 1) { setErr(inLastName, $('errLastName'), 'Please enter your last name.'); fail(inLastName); }
    else { setErr(inLastName, $('errLastName'), null); }

    var email = state.email.trim();
    if (!email) { setErr(inEmail, $('errEmail'), 'Please enter your email address.'); fail(inEmail); }
    else if (!EMAIL_RE.test(email) || email.length > 254) {
      setErr(inEmail, $('errEmail'), 'That email doesn’t look right — please check it.');
      fail(inEmail);
    } else { setErr(inEmail, $('errEmail'), null); }

    var phoneDigits = state.phone.replace(/[^\d]/g, '');
    if (!state.phone.trim()) { setErr(inPhone, $('errPhone'), 'Please enter your phone number.'); fail(inPhone); }
    else if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      setErr(inPhone, $('errPhone'), 'Please enter a valid phone number, including the country code.');
      fail(inPhone);
    } else { setErr(inPhone, $('errPhone'), null); }

    var dobRaw = inDob ? inDob.value.trim() : '';
    var age = ageFromDob(dobRaw);
    if (dobRaw === '' || age === '') { setErr(inDob, $('errDob'), 'Please enter your date of birth.'); fail(inDob); }
    else if (age < 18) { setErr(inDob, $('errDob'), 'Suga.health treats adults 18 and over.'); fail(inDob); }
    else if (age > 100) { setErr(inDob, $('errDob'), 'That date of birth doesn’t look right — please double-check.'); fail(inDob); }
    else { setErr(inDob, $('errDob'), null); }

    var sErr = $('errSex');
    if (!state.sex) { if (sErr) { sErr.hidden = false; } fail(sErr); }
    else if (sErr) { sErr.hidden = true; }

    var imperial = state.units === 'imperial';
    var hErrEl = imperial ? $('errHI') : $('errHM');
    var hInputEl = imperial ? inHft : inHcm;
    setErr(inHcm, $('errHM'), null);
    setErr(inHft, $('errHI'), null);
    if (inHin) { inHin.classList.remove('input--err'); }
    if (state.hCm === null) {
      setErr(hInputEl, hErrEl, 'Please enter your height.');
      fail(hInputEl);
    } else if (!heightValid()) {
      setErr(hInputEl, hErrEl, imperial
        ? 'Enter a height between 3′3″ and 8′2″.'
        : 'Enter a height between 100 and 250 cm.');
      fail(hInputEl);
    }
    if (state.wKg === null) {
      setErr(inW, $('errW'), 'Please enter your weight.');
      fail(inW);
    } else if (!weightValid()) {
      setErr(inW, $('errW'), imperial
        ? 'Enter a weight between 66 and 770 lb.'
        : 'Enter a weight between 30 and 350 kg.');
      fail(inW);
    } else {
      setErr(inW, $('errW'), null);
    }

    // clinical screening — every red-flag question must be answered
    var required = ['antiepileptics', 'pancreatitis', 'familyMTC'];
    if (state.sex === 'Female') { required = required.concat(['married', 'onOCP', 'pregnant']); }
    required.forEach(function (k) {
      var e = $(ERR_ID[k]);
      if (!state.screening[k]) {
        if (e) { e.hidden = false; }
        fail(e || null);
      } else if (e) { e.hidden = true; }
    });

    // conditions stay optional — show the hint, never block the submit
    if (condNudge) { condNudge.hidden = !!(state.conditions.length || state.noConditions); }

    return firstBad;
  }

  function focusFirstError(node) {
    if (!node) { return; }
    if (node.scrollIntoView) { node.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    if (node.focus) { try { node.focus({ preventScroll: true }); } catch (e) { node.focus(); } }
  }

  /* ---------------- submit + success view ---------------- */

  function consentsOk() { return state.c1 && state.c2 && state.c3; }
  var submitInFlight = false;
  var submitLabel = btnSubmit ? btnSubmit.textContent : '';
  function refreshSubmit() { if (btnSubmit) { btnSubmit.disabled = submitInFlight || !consentsOk(); } }

  function submitError(msg) {
    var e = $('submitErr');
    if (!e && btnSubmit) {
      e = el('p', 'err-msg');
      e.id = 'submitErr';
      e.setAttribute('role', 'alert');
      e.style.margin = '0 0 12px';
      var row = btnSubmit.parentNode;
      if (row && row.parentNode) { row.parentNode.insertBefore(e, row); }
      else if (row) { row.insertBefore(e, btnSubmit); }
    }
    if (!e) { return; }
    if (msg) { e.textContent = msg; e.hidden = false; }
    else { e.textContent = ''; e.hidden = true; }
  }

  function buildRecord() {
    var b = bmiVal();
    return {
      id: 'SH-' + Date.now().toString(36).toUpperCase(),
      submittedAt: new Date().toISOString(),
      goal: state.goal,
      goalLabel: GOAL_LABELS[state.goal] || '',
      name: state.name.replace(/\s+/g, ' ').trim(),
      email: state.email.trim(),
      phone: state.phone.trim(),
      age: parseInt(state.age, 10),
      sex: state.sex,
      sexDescription: state.sex === 'Other' ? state.sexOther.trim() : '',
      units: state.units,
      heightCm: state.hCm,
      weightKg: state.wKg,
      bmi: b ? Math.round(b * 10) / 10 : null,
      bmiCategory: b ? bmiCategory(b) : '',
      conditions: state.conditions.slice(),
      noConditions: state.noConditions,
      surgicalHistory: state.surgical.trim(),
      familyHistory: state.family.slice(),
      familyDetail: state.famDetail.trim(),
      medications: state.meds.map(function (t) { return t.name; }),
      noMedications: state.noMeds,
      allergies: state.allergies.map(function (t) { return t.name; }),
      notes: state.notes.trim(),
      consents: { accurate: state.c1, telehealth: state.c2, privacy: state.c3 }
    };
  }

  function buildIntakePayload() {
    return {
      goal: state.goal,
      name: state.name.replace(/\s+/g, ' ').trim(),
      email: state.email.trim(),
      phone: state.phone.trim(),
      age: parseInt(state.age, 10),
      sex: state.sex,
      sexDetail: state.sex === 'Other' ? state.sexOther.trim() : '',
      height: { cm: Number(state.hCm) },
      weight: { kg: Number(state.wKg) },
      screening: {
        married: state.screening.married,
        onOCP: state.screening.onOCP,
        pregnant: state.screening.pregnant,
        antiepileptics: state.screening.antiepileptics,
        pancreatitis: state.screening.pancreatitis,
        comorbid: state.screening.comorbid.slice(),
        diabetesComplications: state.screening.diabetesComplications.slice(),
        familyMTC: state.screening.familyMTC
      },
      conditions: state.conditions.map(function (t) { return { code: t.code || null, name: t.name }; }),
      noConditions: state.noConditions,
      surgical: state.surgical.trim(),
      family: state.family.slice(),
      familyDetail: state.famDetail.trim(),
      medications: state.meds.map(function (t) { return t.name; }),
      noMedications: state.noMeds,
      allergies: state.allergies.map(function (t) { return t.name; }),
      otherInfo: state.notes.trim(),
      consents: {
        accuracy: state.c1 === true,
        telehealth: state.c2 === true,
        privacy: state.c3 === true
      }
    };
  }

  function saveBackup(rec) {
    try {
      var arr = [];
      var raw = localStorage.getItem(SUBS_KEY);
      if (raw) { arr = JSON.parse(raw); }
      if (!isArr(arr)) { arr = []; }
      arr.push(rec);
      localStorage.setItem(SUBS_KEY, JSON.stringify(arr));
    } catch (e) { /* storage unavailable — still show success */ }
  }

  function doSubmit() {
    if (submitInFlight) { return; }
    if (!consentsOk()) { refreshSubmit(); return; }
    var firstBad = validateAll();
    if (firstBad) {
      submitError('Please check the highlighted answers above, then send again.');
      focusFirstError(firstBad);
      return;
    }

    var rec = buildRecord();
    var payload = buildIntakePayload();

    submitInFlight = true;
    submitError(null);
    if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'Sending to your doctor…'; }

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 15000) : null;

    function finish() {
      if (timer) { clearTimeout(timer); timer = null; }
      submitInFlight = false;
      if (btnSubmit) { btnSubmit.textContent = submitLabel; }
      refreshSubmit();
    }
    function fail(msg) {
      finish();
      submitError((typeof msg === 'string' && msg)
        ? msg + ' Your answers are saved on this device.'
        : 'We could not reach the clinic just now — your answers are saved on this device. Please try again in a moment.');
    }
    function succeed(ref) {
      finish();
      rec.id = ref;
      rec.syncedRef = ref;
      saveBackup(rec);
      clearDraft();
      renderSuccess(rec);
    }

    var opts = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    };
    if (controller) { opts.signal = controller.signal; }

    try {
      fetch('/api/intake', opts).then(function (res) {
        if (!res || res.status !== 201) {
          // Surface the server's own message (400 validation / 429 rate-limit) when present.
          if (res && typeof res.json === 'function') {
            res.json().then(function (data) {
              fail(data && typeof data.error === 'string' ? data.error : null);
            }, function () { fail(); });
          } else {
            fail();
          }
          return;
        }
        res.json().then(function (data) {
          succeed(data && data.ref ? data.ref : rec.id);
        }, function () {
          succeed(rec.id); // stored server-side; ref parse failed — fall back to local ref
        });
      }, function () { fail(); });
    } catch (e) {
      fail();
    }
  }

  function summaryRow(k, v) {
    var row = el('div', 'chart-row');
    row.appendChild(el('span', 'k', k));
    row.appendChild(el('span', 'v', v || '—'));
    return row;
  }

  function renderSuccess(rec) {
    var layout = $('pgLayout'), sidebar = $('pgSidebar'), formCol = $('pgFormCol'), intro = $('pgIntro');
    if (sidebar) { sidebar.hidden = true; }
    if (intro) { intro.hidden = true; }
    if (layout) { layout.classList.add('pg-layout--done'); }
    if (!formCol) { return; }
    formCol.innerHTML = '';

    var wrap = el('div', 'pg-success');
    wrap.appendChild(el('span', 'stamp', 'Received'));

    var first = (rec.name.split(' ')[0] || 'you');
    var h = el('h2', 'display', 'Thank you, ' + first + '.');
    h.setAttribute('tabindex', '-1');
    wrap.appendChild(h);

    wrap.appendChild(el('p', 'pg-success-line', 'A doctor will review this and get back to you soon.'));

    var card = el('div', 'chart-card pg-summary');
    var head = el('div', 'chart-card__head');
    head.appendChild(el('span', null, 'Intake summary — ' + rec.id));
    var dot = el('span', 'dot');
    dot.setAttribute('aria-hidden', 'true');
    head.appendChild(dot);
    card.appendChild(head);

    var body = el('div', 'chart-card__body');
    body.appendChild(summaryRow('Goal', rec.goalLabel));
    body.appendChild(summaryRow('Name', rec.name));
    body.appendChild(summaryRow('Email', rec.email));
    body.appendChild(summaryRow('Phone', rec.phone));
    body.appendChild(summaryRow('Age', String(rec.age)));
    body.appendChild(summaryRow('Sex at birth', rec.sex + (rec.sexDescription ? ' — ' + rec.sexDescription : '')));
    body.appendChild(summaryRow('Height', heightDisplay()));
    body.appendChild(summaryRow('Weight', weightDisplay()));
    body.appendChild(summaryRow('BMI', rec.bmi ? rec.bmi.toFixed(1) + ' · ' + rec.bmiCategory : ''));
    body.appendChild(summaryRow('Conditions', rec.noConditions ? 'None reported'
      : rec.conditions.map(function (c) { return c.code ? c.name + ' (' + c.code + ')' : c.name; }).join(', ')));
    body.appendChild(summaryRow('Surgical history', rec.surgicalHistory));
    body.appendChild(summaryRow('Family history',
      rec.familyHistory.join(', ') + (rec.familyDetail ? (rec.familyHistory.length ? ' — ' : '') + rec.familyDetail : '')));
    body.appendChild(summaryRow('Medications', rec.noMedications ? 'None' : rec.medications.join(', ')));
    body.appendChild(summaryRow('Allergies', rec.allergies.join(', ')));
    body.appendChild(summaryRow('Notes for the doctor', rec.notes));
    card.appendChild(body);
    wrap.appendChild(card);

    var ref = el('p', 'small', 'Reference: ' + rec.id + ' · Submitted ' + new Date(rec.submittedAt).toLocaleString());
    wrap.appendChild(ref);

    wrap.appendChild(el('p', 'pen-note pen-note--flat', '— we’ll take it from here'));

    var back = el('p');
    var a = el('a', null, 'Back to home');
    a.href = 'index.html';
    back.appendChild(a);
    wrap.appendChild(back);

    formCol.appendChild(wrap);
    if (h.focus) { h.focus(); }
    if (window.scrollTo) { window.scrollTo(0, 0); }
  }

  /* ---------------- wiring ---------------- */

  // step 1 — goal cards
  var goalBtns = form.querySelectorAll('[data-goal]');
  function renderGoal() {
    for (var i = 0; i < goalBtns.length; i++) {
      goalBtns[i].setAttribute('aria-pressed',
        goalBtns[i].getAttribute('data-goal') === state.goal ? 'true' : 'false');
    }
  }
  Array.prototype.forEach.call(goalBtns, function (b) {
    b.addEventListener('click', function () {
      state.goal = b.getAttribute('data-goal');
      var gErr = $('errGoal');
      if (gErr) { gErr.hidden = true; }
      renderGoal();
      touch();
    });
  });

  // step 2
  if (inFirstName) {
    inFirstName.addEventListener('input', function () {
      state.firstName = inFirstName.value;
      syncNameFromParts();
      if (state.firstName.trim().length >= 1) { setErr(inFirstName, $('errFirstName'), null); }
      touch();
    });
  }
  if (inLastName) {
    inLastName.addEventListener('input', function () {
      state.lastName = inLastName.value;
      syncNameFromParts();
      if (state.lastName.trim().length >= 1) { setErr(inLastName, $('errLastName'), null); }
      touch();
    });
  }
  if (inEmail) {
    inEmail.addEventListener('input', function () {
      state.email = inEmail.value;
      if (EMAIL_RE.test(state.email.trim())) { setErr(inEmail, $('errEmail'), null); }
      touch();
    });
  }
  if (inPhone) {
    inPhone.addEventListener('input', function () {
      state.phone = inPhone.value;
      if (state.phone.replace(/[^\d]/g, '').length >= 7) { setErr(inPhone, $('errPhone'), null); }
      touch();
    });
  }
  if (inDob) {
    inDob.addEventListener('input', function () {
      state.dob = inDob.value;
      syncAgeFromDob();
      if (state.dob) { setErr(inDob, $('errDob'), null); }
      touch();
    });
  }
  var sexBtns = form.querySelectorAll('[data-sex]');
  function renderSex() {
    for (var i = 0; i < sexBtns.length; i++) {
      sexBtns[i].setAttribute('aria-pressed',
        sexBtns[i].getAttribute('data-sex') === state.sex ? 'true' : 'false');
    }
    if (sexOtherField) { sexOtherField.hidden = state.sex !== 'Other'; }
  }
  Array.prototype.forEach.call(sexBtns, function (b) {
    b.addEventListener('click', function () {
      state.sex = b.getAttribute('data-sex');
      var sErr = $('errSex');
      if (sErr) { sErr.hidden = true; }
      if (state.sex !== 'Female') {
        // the female-only branch no longer applies — clear it so stale answers never submit
        state.screening.married = '';
        state.screening.onOCP = '';
        state.screening.pregnant = '';
      }
      renderSex();
      renderScreening();
      touch();
    });
  });
  if (inSexOther) {
    inSexOther.addEventListener('input', function () { state.sexOther = inSexOther.value; touch(); });
  }

  /* ---- clinical screening: yes/no segments, comorbid + complication chips ---- */
  var ERR_ID = {
    married: 'errMarried', onOCP: 'errOnOCP', pregnant: 'errPregnant',
    antiepileptics: 'errAntiepileptics', pancreatitis: 'errPancreatitis', familyMTC: 'errFamilyMTC'
  };
  var scrBtns = form.querySelectorAll('[data-scr]');
  function renderScreening() {
    Array.prototype.forEach.call(scrBtns, function (b) {
      var k = b.getAttribute('data-scr');
      b.setAttribute('aria-pressed', state.screening[k] === b.getAttribute('data-val') ? 'true' : 'false');
    });
    var femaleBlock = $('femaleBlock');
    if (femaleBlock) { femaleBlock.hidden = state.sex !== 'Female'; }
    var complic = $('diabetesComplications');
    if (complic) { complic.hidden = state.screening.comorbid.indexOf('type2-diabetes') === -1; }
    Array.prototype.forEach.call(form.querySelectorAll('[data-comorbid]'), function (b) {
      var on = state.screening.comorbid.indexOf(b.getAttribute('data-comorbid')) > -1;
      b.classList.toggle('chip--on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    Array.prototype.forEach.call(form.querySelectorAll('[data-complic]'), function (b) {
      var on = state.screening.diabetesComplications.indexOf(b.getAttribute('data-complic')) > -1;
      b.classList.toggle('chip--on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  Array.prototype.forEach.call(scrBtns, function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-scr');
      state.screening[k] = b.getAttribute('data-val');
      var e = $(ERR_ID[k]);
      if (e) { e.hidden = true; }
      renderScreening();
      touch();
    });
  });
  function toggleIn(arr, v) {
    var i = arr.indexOf(v);
    if (i > -1) { arr.splice(i, 1); } else { arr.push(v); }
  }
  Array.prototype.forEach.call(form.querySelectorAll('[data-comorbid]'), function (b) {
    b.addEventListener('click', function () {
      toggleIn(state.screening.comorbid, b.getAttribute('data-comorbid'));
      if (state.screening.comorbid.indexOf('type2-diabetes') === -1) {
        state.screening.diabetesComplications = [];
      }
      renderScreening();
      touch();
    });
  });
  Array.prototype.forEach.call(form.querySelectorAll('[data-complic]'), function (b) {
    b.addEventListener('click', function () {
      toggleIn(state.screening.diabetesComplications, b.getAttribute('data-complic'));
      renderScreening();
      touch();
    });
  });

  // step 3 — units + body
  var unitBtns = form.querySelectorAll('[data-units]');
  Array.prototype.forEach.call(unitBtns, function (b) {
    b.addEventListener('click', function () {
      var u = b.getAttribute('data-units');
      if (u === state.units) { return; }
      state.units = u; // canonical cm/kg values stay; inputs re-render converted
      renderBodyInputs();
      touch();
    });
  });
  function onHeightInput() { readHeightFromInputs(); renderBmi(); touch(); }
  function onWeightInput() { readWeightFromInputs(); renderBmi(); touch(); }
  if (inHcm) { inHcm.addEventListener('input', onHeightInput); }
  if (inHft) { inHft.addEventListener('input', onHeightInput); }
  if (inHin) { inHin.addEventListener('input', onHeightInput); }
  if (inW) { inW.addEventListener('input', onWeightInput); }

  // step 4 — checkboxes, family chips, textareas
  if (noConditions && condPicker) {
    noConditions.addEventListener('change', function () {
      state.noConditions = noConditions.checked;
      condPicker.setDisabled(noConditions.checked);
      if (condNudge) { condNudge.hidden = true; }
      touch();
    });
  }
  if (inSurgical) { inSurgical.addEventListener('input', function () { state.surgical = inSurgical.value; touch(); }); }
  if (inFamDetail) { inFamDetail.addEventListener('input', function () { state.famDetail = inFamDetail.value; touch(); }); }

  var famBtns = form.querySelectorAll('[data-fam]');
  function renderFam() {
    for (var i = 0; i < famBtns.length; i++) {
      var on = state.family.indexOf(famBtns[i].getAttribute('data-fam')) > -1;
      famBtns[i].classList.toggle('chip--on', on);
      famBtns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
  Array.prototype.forEach.call(famBtns, function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-fam');
      var i = state.family.indexOf(v);
      if (i > -1) {
        state.family.splice(i, 1);
      } else {
        if (v === 'None of these') {
          state.family = ['None of these'];
        } else {
          var ni = state.family.indexOf('None of these');
          if (ni > -1) { state.family.splice(ni, 1); }
          state.family.push(v);
        }
      }
      renderFam();
      touch();
    });
  });

  // step 5 — meds checkbox
  if (noMeds && medPicker) {
    noMeds.addEventListener('change', function () {
      state.noMeds = noMeds.checked;
      medPicker.setDisabled(noMeds.checked);
      touch();
    });
  }

  // step 6 — notes + consents
  if (inNotes) { inNotes.addEventListener('input', function () { state.notes = inNotes.value; touch(); }); }
  function wireConsent(box, key) {
    if (!box) { return; }
    box.addEventListener('change', function () {
      state[key] = box.checked;
      refreshSubmit();
      saveDraft();
    });
  }
  wireConsent(consent1, 'c1');
  wireConsent(consent2, 'c2');
  wireConsent(consent3, 'c3');

  // submit
  if (btnSubmit) { btnSubmit.addEventListener('click', doSubmit); }

  form.addEventListener('submit', function (e) { e.preventDefault(); });
  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') { return; }
    var t = e.target;
    var tag = t.tagName;
    if (tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A') { return; }
    if (tag === 'INPUT' && t.type === 'checkbox') { return; }
    // One long form: Enter must never fire a half-filled submission.
    // (tag-picker inputs handle their own Enter and stop propagation before this.)
    e.preventDefault();
  });

  /* ---------------- restore + init ---------------- */

  loadDraft();

  // URL ?goal= wins over any drafted goal (user clicked a specific CTA)
  var qs = window.location.search || '';
  var m = qs.match(/[?&]goal=(weight-loss|hair-growth|sexual-health)\b/);
  if (m) { state.goal = m[1]; }

  function syncUI() {
    renderGoal();
    syncNameFromParts();
    syncAgeFromDob();
    if (inFirstName) { inFirstName.value = state.firstName; }
    if (inLastName) { inLastName.value = state.lastName; }
    if (inEmail) { inEmail.value = state.email; }
    if (inPhone) { inPhone.value = state.phone; }
    if (inDob) { inDob.value = state.dob; }
    renderSex();
    renderScreening();
    if (inSexOther) { inSexOther.value = state.sexOther; }
    renderBodyInputs();
    if (condPicker) { condPicker.renderTags(); condPicker.setDisabled(state.noConditions, true); }
    if (noConditions) { noConditions.checked = state.noConditions; }
    if (inSurgical) { inSurgical.value = state.surgical; }
    if (inFamDetail) { inFamDetail.value = state.famDetail; }
    renderFam();
    if (medPicker) { medPicker.renderTags(); medPicker.setDisabled(state.noMeds, true); }
    if (noMeds) { noMeds.checked = state.noMeds; }
    if (algPicker) { algPicker.renderTags(); }
    if (inNotes) { inNotes.value = state.notes; }
    if (consent1) { consent1.checked = !!state.c1; }
    if (consent2) { consent2.checked = !!state.c2; }
    if (consent3) { consent3.checked = !!state.c3; }
    refreshSubmit();
    renderSidebar();
  }

  syncUI();

  // optional debug handle (the only global)
  window.SugaIntake = { state: state };
})();
