/* Document « Pointage des enseignants » : feuille de pointage des professeurs d'une classe. */
(() => {
  'use strict';

  const {
    $, pad, clamp, uid, plural, esc,
    parseISO, toISO, addDays, mondayOf, fmt, setStatus, download
  } = PT;

  const KEY = 'pointage-enseignants.v1';
  const APP = 'pointage-enseignants';
  const DEFAULT_SCHOOL = 'Complexe Scolaire La Réussite Owendo – B.P. 46209';

  const say = (text, kind) => setStatus('t-saved', text, kind);

  /* ---------- Données ---------- */

  let state = { classes: [], currentId: null };
  let booted = false;

  function newClass(base) {
    return {
      id: uid(),
      name: '',
      school: base && base.school ? base.school : DEFAULT_SCHOOL,
      start: toISO(mondayOf(new Date())),
      saturday: false,
      weeks: 1,
      perPage: 20,
      pad: true
    };
  }

  function normalize(raw) {
    const base = newClass();
    const c = Object.assign({}, base, raw || {});
    if (!c.id) c.id = base.id;
    c.name = String(c.name || '');
    c.school = String(c.school || DEFAULT_SCHOOL);
    c.saturday = !!c.saturday;
    c.pad = c.pad !== false;
    c.weeks = clamp(parseInt(c.weeks, 10) || 1, 1, 40);
    c.perPage = clamp(parseInt(c.perPage, 10) || 20, 10, 30);
    return c;
  }

  function sampleClass() {
    return newClass();
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.classes) && s.classes.length) {
        // Supprime les anciennes données de démonstration sans toucher aux classes réelles.
        const classes = s.classes.filter((c) => String(c.name || '').trim().toLowerCase() !== 'classe exemple');
        if (classes.length) {
          const currentId = classes.some((c) => c.id === s.currentId) ? s.currentId : classes[0].id;
          return { classes: classes.map(normalize), currentId };
        }
      }
    } catch (e) { /* stockage indisponible ou illisible */ }
    return null;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      const d = new Date();
      say(`Enregistré sur cet appareil à ${pad(d.getHours())}:${pad(d.getMinutes())}`, 'ok');
      return true;
    } catch (e) {
      say('Non enregistré : le navigateur bloque le stockage. Utilisez « Sauvegarder dans un fichier ».', 'bad');
      return false;
    }
  }

  const current = () => state.classes.find((c) => c.id === state.currentId) || state.classes[0];

  /* ---------- Liste d'enseignants ---------- */

  // Une ligne = un enseignant : « NOM Prénom ; Matière ».
  // Le séparateur peut être « ; », « | » ou une tabulation (colonnes copiées depuis Excel).
  // Avec trois colonnes (Nom ; Prénom ; Matière), nom et prénom sont réunis.
  function parseTeachers(text, sort) {
    const list = String(text || '')
      .split(/\r?\n/)
      .map((line) => {
        const parts = line
          .replace(/^\s*\d+\s*(?:[.)\-–:]|\t)\s*/, '') // numéro en début de ligne
          .split(/\t|;|\|/)
          .map((p) => p.replace(/\s+/g, ' ').trim());
        while (parts.length && !parts[parts.length - 1]) parts.pop();
        if (!parts.length || !parts[0]) return null;
        if (parts.length >= 3) return { name: `${parts[0]} ${parts[1]}`.trim(), subject: parts.slice(2).join(' ') };
        return { name: parts[0], subject: parts[1] || '' };
      })
      .filter(Boolean);
    if (sort) list.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
    return list;
  }

  /* ---------- Formulaire ---------- */

  function fillForm() {
    const c = current();
    $('t-name').value = c.name;
    $('t-school').value = c.school;
    $('t-start').value = c.start;
    $('t-saturday').checked = c.saturday;
    $('t-perpage').value = c.perPage;
    $('t-pad').checked = c.pad;
    $('t-weeks').value = c.weeks;
  }

  function readForm() {
    const c = current();
    c.name = $('t-name').value;
    c.school = $('t-school').value;
    c.start = $('t-start').value;
    c.saturday = $('t-saturday').checked;
    c.perPage = clamp(parseInt($('t-perpage').value, 10) || 20, 10, 30);
    c.pad = $('t-pad').checked;
    c.weeks = clamp(parseInt($('t-weeks').value, 10) || 1, 1, 40);
  }

  /* ---------- Liste des classes ---------- */

  function renderList() {
    const ul = $('t-class-list');
    ul.innerHTML = '';
    state.classes.forEach((c) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.id = c.id;
      if (c.id === state.currentId) b.setAttribute('aria-current', 'true');
      b.innerHTML = `<span class="nm">${esc(c.name.trim() || 'Classe sans nom')}</span>` +
        `<span class="ct">${c.perPage} lignes · ${c.weeks} ${plural(c.weeks, 'semaine', 'semaines')}</span>`;
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  /* ---------- Feuilles ---------- */

  // Fabrique les feuilles de `weeksCount` semaines à partir du lundi donné
  function buildSheets(c, firstMonday, weeksCount) {
    const per = c.perPage;
    const fillRows = c.pad;
    const pagesPerWeek = Math.max(1, Math.ceil(per / per));
    const totalPages = pagesPerWeek * weeksCount;
    const rowMm = Math.round(Math.min(9, 127 / per) * 10) / 10;
    const school = esc(c.school);
    const footName = esc(c.school.split(' – ')[0] || c.school);
    const className = esc(c.name.trim() || '________________________');
    const lastDay = c.saturday ? 5 : 4;
    let page = 0;
    let html = '';

    for (let w = 0; w < weeksCount; w++) {
      const monday = addDays(firstMonday, 7 * w);
      const from = fmt(monday);
      const to = fmt(addDays(monday, lastDay));
      
      const rows = fillRows ? per : per;
      let body = '';
      for (let i = 0; i < rows; i++) {
        body += `<tr><td class="n">${i + 1}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
      }
      
      page++;
      html += `<section class="sheet prof" style="--row:${rowMm}mm">
  <h2>LISTE DE POINTAGE – PROF</h2>
  <p class="sheet-school">${school}</p>
  <div class="prof-meta">
    <span>Classe : <b>${className}</b></span>
    <span class="horaires">HORAIRES</span>
    <span>Semaine du <b>${from}</b> au <b>${to}</b></span>
  </div>
  <table class="pt ptp">
    <colgroup><col style="width:4.5%"><col style="width:8.7%"><col style="width:25.3%"><col style="width:13.2%"><col style="width:6.4%"><col style="width:6.2%"><col style="width:13.8%"><col style="width:21.9%"></colgroup>
    <thead><tr><th>N°</th><th>Date</th><th>Noms et prénoms<br>de l'enseignant</th><th>Matières</th><th>Début</th><th>Fin</th><th>Signature</th><th>Nbre d'h et<br>observations</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="sheet-foot">
    <span>Visa du Responsable : _______________________________</span>
    <span>Date : ____ / ____ / ________</span>
  </div>
  <div class="sheet-page">${footName} | Page ${page} / ${totalPages}</div>
</section>`;
    }
    return html;
  }

  function renderPreview() {
    const c = current();
    const start = parseISO(c.start);
    const sheets = $('t-sheets');
    const printArea = $('t-print-area');
    const empty = $('t-empty');

    $('page-style').textContent = '@page { size: A4 landscape; margin: 10mm; }';
    $('t-hint').textContent = start
      ? `Cette semaine commence le lundi ${fmt(mondayOf(start))}.`
      : 'Choisissez une date pour afficher la semaine.';

    $('btn-print').textContent = c.weeks > 1 ? `Imprimer ${c.weeks} semaines` : 'Imprimer cette semaine';

    if (!start) {
      sheets.innerHTML = '';
      printArea.innerHTML = '';
      empty.textContent = 'Choisissez une date pour afficher la semaine.';
      empty.hidden = false;
      $('t-summary').textContent = '';
      $('btn-print').disabled = true;
      return;
    }

    $('btn-print').disabled = false;
    const monday = mondayOf(start);

    // À l'écran : une seule semaine. Pour l'impression : toutes les semaines demandées.
    sheets.innerHTML = buildSheets(c, monday, 1);
    printArea.innerHTML = buildSheets(c, monday, c.weeks);

    empty.hidden = true;

    $('t-summary').textContent =
      `Semaine du ${fmt(monday)} au ${fmt(addDays(monday, c.saturday ? 5 : 4))} · ` +
      `${c.perPage} lignes · ` +
      `${c.weeks} ${plural(c.weeks, 'feuille', 'feuilles')} A4 paysage`;

    fit();
  }

  // Réduit l'aperçu pour que la feuille entière tienne dans la largeur de l'écran
  function fit() {
    const el = $('t-sheets');
    el.style.zoom = '';
    const px = 297 * 96 / 25.4;
    const avail = $('t-preview').clientWidth;
    if (avail > 0 && avail < px) el.style.zoom = (avail / px).toFixed(4);
  }

  /* ---------- Actions ---------- */

  function refresh() {
    renderList();
    renderPreview();
  }

  function select(id) {
    state.currentId = id;
    save();
    disarmDelete();
    fillForm();
    refresh();
  }

  $('t-form').addEventListener('input', (e) => {
    readForm();
    save();
    refresh();
  });
  $('t-form').addEventListener('submit', (e) => e.preventDefault());

  $('t-class-list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (b) select(b.dataset.id);
  });

  $('t-new').addEventListener('click', () => {
    const c = newClass(current());
    state.classes.push(c);
    select(c.id);
  });

  // Passage d'une semaine à l'autre
  function shiftWeek(n) {
    const c = current();
    const d = parseISO(c.start) || new Date();
    c.start = toISO(addDays(mondayOf(d), 7 * n));
    $('t-start').value = c.start;
    save();
    refresh();
  }
  $('t-prev').addEventListener('click', () => shiftWeek(-1));
  $('t-next').addEventListener('click', () => shiftWeek(1));

  let armTimer = null;
  function disarmDelete() {
    const b = $('t-delete');
    clearTimeout(armTimer);
    b.classList.remove('armed');
    b.textContent = 'Supprimer cette classe';
  }

  $('t-delete').addEventListener('click', () => {
    const b = $('t-delete');
    if (!b.classList.contains('armed')) {
      b.classList.add('armed');
      b.textContent = 'Confirmer la suppression';
      armTimer = setTimeout(disarmDelete, 4000);
      return;
    }
    disarmDelete();
    state.classes = state.classes.filter((c) => c.id !== state.currentId);
    if (!state.classes.length) state.classes.push(newClass());
    select(state.classes[0].id);
  });

  /* ---------- Sauvegarde dans un fichier ---------- */

  $('t-export').addEventListener('click', () => {
    const data = { app: APP, version: 1, classes: state.classes };
    download(`${APP}-${toISO(new Date())}.json`, JSON.stringify(data, null, 2));
  });

  $('t-import').addEventListener('click', () => $('t-file').click());

  $('t-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data && data.app && data.app !== APP) throw new Error('autre document');
        const list = Array.isArray(data) ? data : data.classes;
        if (!Array.isArray(list) || !list.length) throw new Error('vide');
        let last = null;
        list.forEach((raw) => {
          const c = normalize(raw);
          const i = state.classes.findIndex((x) => x.id === c.id);
          if (i >= 0) state.classes[i] = c; else state.classes.push(c);
          last = c;
        });
        select(last.id);
        say(`${list.length} ${plural(list.length, 'classe restaurée', 'classes restaurées')}.`, 'ok');
      } catch (err) {
        say('Ce fichier n\'est pas une sauvegarde du pointage des enseignants.', 'bad');
      }
    };
    reader.readAsText(file);
  });

  window.addEventListener('resize', fit);

  /* ---------- Démarrage (à la première ouverture de la page) ---------- */

  function boot() {
    booted = true;
    const loaded = load();
    if (loaded) {
      state = loaded;
      if (!state.classes.some((c) => c.id === state.currentId)) state.currentId = state.classes[0].id;
    } else {
      const c = sampleClass();
      state = { classes: [c], currentId: c.id };
    }
    fillForm();
    refresh();
    if (loaded) {
      const n = state.classes.length;
      say(`${n} ${plural(n, 'classe retrouvée', 'classes retrouvées')} sur cet appareil.`, 'ok');
    } else {
      save();
    }
  }

  PT.views.enseignants = {
    show() {
      if (!booted) boot(); else renderPreview();
    }
  };
})();
