/* Document « Liste de présence » : feuille d'appel des élèves. */
(() => {
  'use strict';

  const {
    $, pad, clamp, uid, plural, esc,
    parseISO, toISO, addDays, mondayOf, fmt, fmtShort, setStatus, download
  } = PT;

  const KEY = 'pointage-eleves.v1';
  const APP = 'pointage-eleves';
  const DEFAULT_SCHOOL = 'Complexe Scolaire La Réussite Owendo – B.P. 46209';
  const DAYS = [
    { n: 1, short: 'Lun' }, { n: 2, short: 'Mar' }, { n: 3, short: 'Mer' },
    { n: 4, short: 'Jeu' }, { n: 5, short: 'Ven' }, { n: 6, short: 'Sam' }
  ];

  const say = (text, kind) => setStatus('saved', text, kind);

  /* ---------- Données ---------- */

  let state = { classes: [], currentId: null };
  let booted = false;

  function newClass(base) {
    return {
      id: uid(),
      linkedClassId: PT.getActiveClassId ? PT.getActiveClassId() : null, // classe partagée
      start: toISO(mondayOf(new Date())),
      weeks: 1,
      days: [1, 2, 3, 4, 5],
      hours: 3,
      orient: 'portrait',
      perPage: 30
    };
  }

  // Complète une classe enregistrée (ou importée) avec les réglages manquants
  function normalize(raw) {
    const base = newClass();
    const c = Object.assign({}, base, raw || {});
    if (!c.id) c.id = base.id;
    if (!Array.isArray(c.days)) c.days = base.days;
    c.days = c.days.map(Number).filter((n) => n >= 1 && n <= 6);
    // Anciennes données : « matin / après-midi » et plusieurs semaines affichées
    if (!raw || raw.hours === undefined) { c.hours = 3; c.weeks = 1; }
    c.hours = clamp(parseInt(c.hours, 10) || 3, 1, 8);
    c.weeks = clamp(parseInt(c.weeks, 10) || 1, 1, 40);
    c.perPage = clamp(parseInt(c.perPage, 10) || 30, 5, 60);
    c.orient = c.orient === 'landscape' ? 'landscape' : 'portrait';
    c.linkedClassId = c.linkedClassId || null;
    c.start = c.start || base.start;
    return c;
  }

  function createInitialClass() {
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

  /* ---------- Liste d'élèves ---------- */

  function parseStudents(text, sort) {
    const list = String(text || '')
      .split(/\r?\n/)
      .map((line) => line
        .replace(/^\s*\d+\s*(?:[.)\-–:]|\t)\s*/, '') // numéro en début de ligne (1. / 1) / 1 tab)
        .replace(/\t+/g, ' ')                         // colonnes Excel : nom et prénom côte à côte
        .replace(/\s+/g, ' ')
        .trim())
      .filter(Boolean);
    if (sort) list.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    return list;
  }

  /* ---------- Formulaire ---------- */

  function fillForm() {
    const c = current();
    if (c && !c.linkedClassId && PT.getActiveClassId) c.linkedClassId = PT.getActiveClassId();
    const centralClasses = PT.views.classes ? PT.views.classes.getAllClasses() : [];
    
    // Remplir le sélecteur de classes
    const classSelect = $('c-class-select');
    classSelect.innerHTML = '<option value="">-- Sélectionner une classe --</option>';
    centralClasses.forEach((cls) => {
      const opt = document.createElement('option');
      opt.value = cls.id;
      opt.textContent = cls.name.trim() || 'Classe sans nom';
      opt.selected = cls.id === c.linkedClassId;
      classSelect.appendChild(opt);
    });
    
    // Afficher les infos de la classe liée
    if (c.linkedClassId) {
      const linkedClass = centralClasses.find((cls) => cls.id === c.linkedClassId);
      if (linkedClass) {
        $('c-name').value = linkedClass.name || '';
        $('c-year').value = linkedClass.year || '';
        $('c-school').value = linkedClass.school || '';
      }
    } else {
      $('c-name').value = '';
      $('c-year').value = '';
      $('c-school').value = '';
    }
    
    $('c-start').value = c.start;
    $('c-hours').value = c.hours;
    $('c-weeks').value = c.weeks;
    $('c-orient').value = c.orient;
    $('c-perpage').value = c.perPage;
    document.querySelectorAll('#view-eleves input[name="day"]').forEach((el) => {
      el.checked = c.days.includes(+el.value);
    });
    
    updateCount();
  }

  function readForm() {
    const c = current();
    c.linkedClassId = $('c-class-select').value || null;
    c.start = $('c-start').value;
    c.hours = clamp(parseInt($('c-hours').value, 10) || 1, 1, 8);
    c.weeks = clamp(parseInt($('c-weeks').value, 10) || 1, 1, 40);
    c.orient = $('c-orient').value;
    c.perPage = clamp(parseInt($('c-perpage').value, 10) || 30, 5, 60);
    c.days = [...document.querySelectorAll('#view-eleves input[name="day"]:checked')].map((el) => +el.value);
  }

  function updateCount() {
    const c = current();
    const students = getStudentsFromLinkedClass();
    $('count').textContent = students.length
      ? `${students.length} ${plural(students.length, 'élève', 'élèves')}`
      : '';
  }

  function getStudentsFromLinkedClass() {
    const c = current();
    if (!c.linkedClassId) return [];
    
    const centralClasses = PT.views.classes ? PT.views.classes.getAllClasses() : [];
    const linkedClass = centralClasses.find((cls) => cls.id === c.linkedClassId);
    if (!linkedClass) return [];
    
    const list = String(linkedClass.students || '')
      .split(/\r?\n/)
      .map((line) => line
        .replace(/^\s*\d+\s*(?:[.)\-–:]|\t)\s*/, '')
        .replace(/\t+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim())
      .filter(Boolean);
    if (linkedClass.sort) list.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    return list;
  }

  /* ---------- Liste des classes ---------- */

  function renderList() {
    const ul = $('class-list');
    ul.innerHTML = '';
    const centralClasses = PT.views.classes ? PT.views.classes.getAllClasses() : [];
    
    state.classes.forEach((c) => {
      const linkedClass = centralClasses.find((cls) => cls.id === c.linkedClassId);
      const className = linkedClass ? linkedClass.name.trim() : 'Classe non liée';
      const studentCount = linkedClass ? parseStudents(linkedClass.students, false).length : 0;
      
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.id = c.id;
      if (c.id === state.currentId) b.setAttribute('aria-current', 'true');
      b.innerHTML = `<span class="nm">${esc(className)}</span>` +
        `<span class="ct">${studentCount} ${plural(studentCount, 'élève', 'élèves')}</span>`;
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  /* ---------- Feuilles ---------- */

  // Largeur des colonnes d'heures selon le format de page
  function layout(c, nDays) {
    const H = c.hours;
    const usable = c.orient === 'portrait' ? 190 : 277;
    const obs = c.orient === 'portrait' ? 24 : 36;
    const raw = (usable - 7 - obs - 50) / (nDays * H); // on garde au moins 50 mm pour le nom
    const max = H === 1 ? 22 : 16;
    let cell;
    let fits = true;
    if (raw >= 6) {
      cell = clamp(raw, 6, max);
    } else {
      fits = false;
      cell = Math.max(4, (usable - 7 - obs - 35) / (nDays * H));
    }
    return { obs, cell: Math.round(cell * 10) / 10, fits };
  }

  const hourLabel = (i, narrow) => (narrow ? String(i + 1) : (i === 0 ? '1re h' : `${i + 1}e h`));

  function tableHtml(c, chunk, offset, monday, days) {
    const H = c.hours;
    const { obs, cell } = layout(c, days.length);
    const rows = H > 1 ? 2 : 1;

    const cols = '<col style="width:7mm"><col>' +
      days.map(() => `<col style="width:${cell}mm">`.repeat(H)).join('') +
      `<col style="width:${obs}mm">`;

    const head1 = `<tr><th rowspan="${rows}">N°</th><th rowspan="${rows}">Noms et prénoms</th>` +
      days.map((d) => `<th colspan="${H}">${d.short} ${fmtShort(addDays(monday, d.n - 1))}</th>`).join('') +
      `<th rowspan="${rows}">Observations</th></tr>`;

    let head2 = '';
    if (H > 1) {
      let labels = '';
      for (let i = 0; i < H; i++) labels += `<th class="sub">${hourLabel(i, cell < 6)}</th>`;
      head2 = `<tr>${days.map(() => labels).join('')}</tr>`;
    }

    const blanks = '<td></td>'.repeat(days.length * H);
    const body = chunk.map((name, i) =>
      `<tr><td class="n">${offset + i + 1}</td><td class="name">${esc(name)}</td>${blanks}<td></td></tr>`
    ).join('');

    return `<table class="pt"><colgroup>${cols}</colgroup><thead>${head1}${head2}</thead><tbody>${body}</tbody></table>`;
  }

  // Fabrique les feuilles de `weeksCount` semaines à partir du lundi donné
  function buildSheets(c, students, days, firstMonday, weeksCount) {
    const pagesPerWeek = Math.ceil(students.length / c.perPage);
    const totalPages = pagesPerWeek * weeksCount;
    const minDay = days[0].n;
    const maxDay = days[days.length - 1];
    
    const linkedClass = PT.views.classes ? PT.views.classes.getClassById(c.linkedClassId) : null;
    const school = PT.getSchoolName ? PT.getSchoolName() : (linkedClass ? linkedClass.school : DEFAULT_SCHOOL);
    const footName = PT.getSchoolName ? PT.getSchoolName() : (linkedClass ? linkedClass.school.split(' – ')[0] || linkedClass.school : DEFAULT_SCHOOL);
    const className = linkedClass ? linkedClass.name : '________________';
    const classYear = linkedClass ? linkedClass.year : '____________';
    
    let page = 0;
    let html = '';

    for (let w = 0; w < weeksCount; w++) {
      const monday = addDays(firstMonday, 7 * w);
      const from = fmt(addDays(monday, minDay - 1));
      const to = fmt(addDays(monday, maxDay - 1));
      for (let p = 0; p < pagesPerWeek; p++) {
        const offset = p * c.perPage;
        const chunk = students.slice(offset, offset + c.perPage);
        page++;
        html += `<section class="sheet">
  ${PT.getSchoolLogoHtml()}\n  <h2>Fiche d’appel des élèves</h2>
  <p class="sheet-school">${esc(school)}</p>\n  ${PT.getSchoolContactHtml()}
  <div class="sheet-meta">
    <span>Classe : <b>${esc(className)}</b></span>
    <span>Année scolaire : <b>${esc(classYear)}</b></span>
    <span>Semaine du <b>${from}</b> au <b>${to}</b></span>
  </div>
  ${tableHtml(c, chunk, offset, monday, days)}
  <div class="sheet-foot">
    <span>Visa du Responsable : _______________________________</span>
    <span>Date : ____ / ____ / ________</span>
  </div>
  <div class="sheet-page">${footName} | Page ${page} / ${totalPages}</div>
</section>`;
      }
    }
    return html;
  }

  function renderPreview() {
    const c = current();
    const students = getStudentsFromLinkedClass();
    const start = parseISO(c.start);
    const days = DAYS.filter((d) => c.days.includes(d.n));
    const sheets = $('sheets');
    const printArea = $('print-area');
    const empty = $('empty');
    const warn = $('warn');
    const landscape = c.orient === 'landscape';

    $('count').textContent = students.length
      ? `${students.length} ${plural(students.length, 'élève', 'élèves')}`
      : '';

    // Format de page pour l'impression
    $('page-style').textContent = `@page { size: A4 ${c.orient}; margin: 10mm; }`;
    sheets.classList.toggle('landscape', landscape);
    printArea.classList.toggle('landscape', landscape);

    $('week-hint').textContent = start
      ? `Cette semaine commence le lundi ${fmt(mondayOf(start))}.`
      : 'Choisissez une date pour afficher la semaine.';

    $('btn-print').textContent = c.weeks > 1 ? `Imprimer ${c.weeks} semaines` : 'Imprimer cette semaine';

    let message = '';
    if (!students.length) message = 'Sélectionnez une classe pour générer la feuille.';
    else if (!start) message = 'Choisissez une date pour afficher la semaine.';
    else if (!days.length) message = 'Choisissez au moins un jour à pointer.';

    if (message) {
      sheets.innerHTML = '';
      printArea.innerHTML = '';
      empty.textContent = message;
      empty.hidden = false;
      warn.hidden = true;
      $('summary').textContent = '';
      $('btn-print').disabled = true;
      return;
    }

    empty.hidden = true;
    $('btn-print').disabled = false;

    const monday = mondayOf(start);
    const minDay = days[0].n;
    const maxDay = days[days.length - 1].n;
    const pagesPerWeek = Math.ceil(students.length / c.perPage);

    // À l'écran : une seule semaine. Pour l'impression : toutes les semaines demandées.
    sheets.innerHTML = buildSheets(c, students, days, monday, 1);
    printArea.innerHTML = buildSheets(c, students, days, monday, c.weeks);

    const linkedClass = PT.views.classes ? PT.views.classes.getClassById(c.linkedClassId) : null;
    const school = linkedClass ? linkedClass.school : DEFAULT_SCHOOL;
    const className = linkedClass ? linkedClass.name : '________________';
    const classYear = linkedClass ? linkedClass.year : '____________';

    $('summary').textContent =
      `Semaine du ${fmt(addDays(monday, minDay - 1))} au ${fmt(addDays(monday, maxDay - 1))} · ` +
      `${students.length} ${plural(students.length, 'élève', 'élèves')} · ` +
      `${pagesPerWeek} ${plural(pagesPerWeek, 'feuille', 'feuilles')} A4 ${landscape ? 'paysage' : 'portrait'}`;

    if (layout(c, days.length).fits) {
      warn.hidden = true;
    } else {
      warn.textContent = 'Il y a trop de colonnes pour ce format. Passez en A4 paysage, ou réduisez le nombre d\'heures ou de jours.';
      warn.hidden = false;
    }

    fit();
  }

  // Réduit l'aperçu pour que la feuille entière tienne dans la largeur de l'écran
  function fit() {
    const el = $('sheets');
    if (!state.classes.length) return;
    const c = current();
    el.style.zoom = '';
    const px = (c.orient === 'landscape' ? 297 : 210) * 96 / 25.4;
    const avail = $('preview').clientWidth;
    if (avail > 0 && avail < px) el.style.zoom = (avail / px).toFixed(4);
  }

  /* ---------- Actions ---------- */

  function refresh() {
    renderList();
    renderPreview();
  }

  function select(id) {
    state.currentId = id;
    const chosen = current();
    if (chosen && chosen.linkedClassId && PT.setActiveClassId) PT.setActiveClassId(chosen.linkedClassId);
    save();
    disarmDelete();
    fillForm();
    refresh();
  }

  $('class-form').addEventListener('input', (e) => {
    if (e.target.id === 'c-class-select') return;
    readForm();
    save();
    refresh();
  });
  $('class-form').addEventListener('submit', (e) => e.preventDefault());

  $('c-class-select').addEventListener('change', () => {
    readForm();
    if (PT.setActiveClassId) PT.setActiveClassId(current().linkedClassId);
    save();
    fillForm();
    refresh();
  });

  $('class-list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (b) select(b.dataset.id);
  });

  $('btn-new').addEventListener('click', () => {
    const c = newClass(current());
    state.classes.push(c);
    select(c.id);
  });

  // Passage d'une semaine à l'autre
  function shiftWeek(n) {
    const c = current();
    const d = parseISO(c.start) || new Date();
    c.start = toISO(addDays(mondayOf(d), 7 * n));
    $('c-start').value = c.start;
    save();
    refresh();
  }
  $('wk-prev').addEventListener('click', () => shiftWeek(-1));
  $('wk-next').addEventListener('click', () => shiftWeek(1));

  let armTimer = null;
  function disarmDelete() {
    const b = $('btn-delete');
    clearTimeout(armTimer);
    b.classList.remove('armed');
    b.textContent = 'Supprimer cette fiche';
  }

  $('btn-delete').addEventListener('click', () => {
    const b = $('btn-delete');
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

  $('btn-export').addEventListener('click', () => {
    const data = { app: APP, version: 1, classes: state.classes };
    download(`${APP}-${toISO(new Date())}.json`, JSON.stringify(data, null, 2));
  });

  $('btn-import').addEventListener('click', () => $('file-import').click());

  $('file-import').addEventListener('change', (e) => {
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
        say('Ce fichier n\'est pas une sauvegarde de la liste de présence des élèves.', 'bad');
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
      const c = createInitialClass();
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

  function syncActiveClass() {
    const classId = PT.getActiveClassId ? PT.getActiveClassId() : null;
    if (!classId) return;
    const records = state.classes;
    const matching = records.find((item) => item.linkedClassId === classId);
    if (matching) {
      const changed = state.currentId !== matching.id;
      state.currentId = matching.id;
      if (changed) save();
    } else {
      const active = current();
      const centralClasses = PT.getCentralClasses ? PT.getCentralClasses() : [];
      const linkIsStale = active && active.linkedClassId &&
        !centralClasses.some((cls) => cls.id === active.linkedClassId);
      if (active && (!active.linkedClassId || linkIsStale)) {
        // Répare une ancienne liaison devenue invalide au lieu d'afficher « Classe non liée ».
        active.linkedClassId = classId;
        state.currentId = active.id;
      } else {
        const next = newClass(active);
        next.linkedClassId = classId;
        records.push(next);
        state.currentId = next.id;
      }
      save();
    }
    fillForm();
    refresh();
  }

  PT.views.eleves = {
    show() {
      if (!booted) boot();
      syncActiveClass();
    }
  };
})();
