/* Document « Classes et Élèves » : gestion centralisée des classes et élèves. */
(() => {
  'use strict';

  const {
    $, pad, clamp, uid, plural, esc,
    setStatus, download
  } = PT;

  const KEY = 'classes-centrales.v1';
  const APP = 'classes-centrales';
  const DEFAULT_SCHOOL = 'Complexe Scolaire La Réussite Owendo – B.P. 46209';

  const say = (text, kind) => setStatus('cls-saved', text, kind);

  /* ---------- Données ---------- */

  let state = { classes: [], currentId: null };
  let booted = false;

  function newClass(base) {
    const now = new Date();
    const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return {
      id: uid(),
      name: '',
      year: `${y}-${y + 1}`,
      school: base && base.school ? base.school : (PT.getSchoolName ? PT.getSchoolName() : DEFAULT_SCHOOL),
      students: '',
      sort: false,
      createdAt: new Date().toISOString()
    };
  }

  function normalize(raw) {
    const base = newClass();
    const c = Object.assign({}, base, raw || {});
    if (!c.id) c.id = base.id;
    c.name = String(c.name || '');
    c.year = String(c.year || base.year);
    c.school = String(c.school || DEFAULT_SCHOOL);
    c.students = String(c.students || '');
    c.sort = !!c.sort;
    c.createdAt = c.createdAt || base.createdAt;
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
        .replace(/^\s*\d+\s*(?:[.)\-–:]|\t)\s*/, '')
        .replace(/\t+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim())
      .filter(Boolean);
    if (sort) list.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    return list;
  }

  /* ---------- Formulaire ---------- */

  function fillForm() {
    const c = current();
    if (!c) {
      $('cls-name').value = '';
      $('cls-year').value = '';
      $('cls-school').value = PT.getSchoolName ? PT.getSchoolName() : DEFAULT_SCHOOL;
      $('cls-students').value = '';
      $('cls-sort').checked = false;
      $('cls-add-name').value = '';
      $('cls-count').textContent = '';
      return;
    }
    $('cls-name').value = c.name;
    $('cls-year').value = c.year;
    $('cls-school').value = c.school;
    $('cls-students').value = c.students;
    $('cls-sort').checked = c.sort;
    $('cls-add-name').value = '';
    updateCount();
  }

  function readForm() {
    const c = current();
    c.name = $('cls-name').value;
    c.year = $('cls-year').value;
    c.school = $('cls-school').value;
    c.students = $('cls-students').value;
    c.sort = $('cls-sort').checked;
  }

  function updateCount() {
    const c = current();
    if (!c) {
      $('cls-count').textContent = '';
      return;
    }
    const students = parseStudents(c.students, c.sort);
    $('cls-count').textContent = students.length
      ? `${students.length} ${plural(students.length, 'élève', 'élèves')}`
      : '';
  }

  /* ---------- Liste des classes ---------- */

  function renderList() {
    const ul = $('cls-class-list');
    ul.innerHTML = '';
    state.classes.forEach((c) => {
      const n = parseStudents(c.students, false).length;
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.id = c.id;
      if (c.id === state.currentId) btn.setAttribute('aria-current', 'true');
      btn.innerHTML = `<span class="nm">${esc(c.name.trim() || 'Classe sans nom')}</span>` +
        `<span class="ct">${n} ${plural(n, 'élève', 'élèves')}</span>`;
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  /* ---------- Aperçu ---------- */

  function renderPreview() {
    const c = current();
    const students = parseStudents(c.students, c.sort);
    const sheets = $('cls-sheets');
    const summary = $('cls-summary');

    if (!students.length) {
      sheets.innerHTML = '<p class="empty">Aucun élève dans cette classe</p>';
      summary.textContent = '';
      return;
    }

    let html = '<div class="class-preview">';
    html += `<h3>${esc(c.name.trim() || 'Classe sans nom')}</h3>`;
    html += `<p><strong>Établissement :</strong> ${esc(c.school)}</p>`;
    html += `<p><strong>Année scolaire :</strong> ${esc(c.year)}</p>`;
    html += `<p><strong>Nombre d'élèves :</strong> ${students.length}</p>`;
    html += '<ul class="student-list">';
    students.forEach((s, i) => {
      html += `<li>${i + 1}. ${esc(s)}</li>`;
    });
    html += '</ul></div>';

    sheets.innerHTML = html;
    summary.textContent = `${students.length} ${plural(students.length, 'élève', 'élèves')} · ${c.year}`;
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

  $('cls-form').addEventListener('input', (e) => {
    if (e.target.id === 'cls-add-name') return;
    readForm();
    save();
    refresh();
  });
  $('cls-form').addEventListener('submit', (e) => e.preventDefault());

  $('cls-class-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id]');
    if (btn) select(btn.dataset.id);
  });

  $('cls-new').addEventListener('click', () => {
    const c = newClass(current());
    state.classes.push(c);
    select(c.id);
    $('cls-name').focus();
  });

  // Ajout rapide d'un élève
  function addStudent() {
    const input = $('cls-add-name');
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    const ta = $('cls-students');
    ta.value = ta.value.replace(/\s+$/, '') + (ta.value.trim() ? '\n' : '') + name;
    input.value = '';
    readForm();
    save();
    refresh();
    input.focus();
  }
  $('cls-add').addEventListener('click', addStudent);
  $('cls-add-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addStudent(); }
  });

  let armTimer = null;
  function disarmDelete() {
    const btn = $('cls-delete');
    clearTimeout(armTimer);
    btn.classList.remove('armed');
    btn.textContent = 'Supprimer cette classe';
  }

  $('cls-delete').addEventListener('click', () => {
    const btn = $('cls-delete');
    if (!btn.classList.contains('armed')) {
      btn.classList.add('armed');
      btn.textContent = 'Confirmer la suppression';
      armTimer = setTimeout(disarmDelete, 4000);
      return;
    }
    disarmDelete();
    state.classes = state.classes.filter((c) => c.id !== state.currentId);
    state.currentId = state.classes[0] ? state.classes[0].id : null;
    state.viewMode = 'list';
    state.showingStudents = false;
    state.viewMode = 'list';
    if (state.currentId && PT.setActiveClassId) PT.setActiveClassId(state.currentId);
    save();
    fillForm();
    refresh();
  });

  /* ---------- Sauvegarde dans un fichier ---------- */

  $('cls-export').addEventListener('click', () => {
    const data = { app: APP, version: 1, classes: state.classes };
    const filename = `pointage-scolaire-classes-complet-${new Date().toISOString().split('T')[0]}.json`;
    download(filename, JSON.stringify(data, null, 2));
    say(`${state.classes.length} ${plural(state.classes.length, 'classe exportée', 'classes exportées')} dans ${filename}`, 'ok');
  });

  $('cls-import').addEventListener('click', () => $('cls-file').click());

  $('cls-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        
        // Vérifier si c'est le format pointage-eleves (ancien format)
        if (data.app === 'pointage-eleves' && Array.isArray(data.classes)) {
          let importedCount = 0;
          data.classes.forEach((legacyClass) => {
            if (legacyClass.name && legacyClass.students) {
              const newClassData = {
                id: uid(),
                name: legacyClass.name,
                year: legacyClass.year || '2026-2027',
                school: legacyClass.school || DEFAULT_SCHOOL,
                students: legacyClass.students,
                sort: legacyClass.sort || false,
                createdAt: new Date().toISOString()
              };
              state.classes.push(normalize(newClassData));
              importedCount++;
            }
          });
          
          if (importedCount > 0) {
            save();
            refresh();
            select(state.classes[state.classes.length - importedCount].id);
            say(`${importedCount} ${plural(importedCount, 'classe importée', 'classes importées')} depuis pointage-eleves`, 'ok');
          } else {
            say('Aucune classe valide trouvée dans le fichier', 'bad');
          }
          return;
        }
        
        // Format classes-centrales (nouveau format)
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
        say('Ce fichier n\'est pas une sauvegarde des classes.', 'bad');
      }
    };
    reader.readAsText(file);
  });

  /* ---------- Démarrage ---------- */

  function boot() {
    booted = true;
    const loaded = load();
    if (loaded) {
      state = loaded;
      if (!state.classes.some((c) => c.id === state.currentId)) state.currentId = state.classes[0].id;
      const sharedId = PT.getActiveClassId ? PT.getActiveClassId() : null;
      if (sharedId && state.classes.some((c) => c.id === sharedId)) state.currentId = sharedId;
    } else {
      state = { classes: [], currentId: null, showingStudents: false, viewMode: 'list' };
    }
    state.showingStudents = false;
    if (state.currentId && PT.setActiveClassId) PT.setActiveClassId(state.currentId);
    fillForm();
    refresh();
    if (loaded) {
      const n = state.classes.length;
      say(`${n} ${plural(n, 'classe retrouvée', 'classes retrouvées')} sur cet appareil.`, 'ok');
    } else {
      save();
    }
  }

  PT.views.classes = {
    show() {
      if (!booted) boot(); else renderPreview();
    },
    
    // Fonction pour obtenir toutes les classes (utilisée par les autres modules)
    getAllClasses() {
      if (!booted) boot();
      return state.classes;
    },
    
    // Fonction pour obtenir une classe par ID
    getClassById(id) {
      if (!booted) boot();
      return state.classes.find((c) => c.id === id);
    },
    
    // Fonction pour obtenir les élèves d'une classe
    getStudents(classId) {
      if (!booted) boot();
      const cls = state.classes.find((c) => c.id === classId);
      if (!cls) return [];
      return parseStudents(cls.students, cls.sort);
    }
  };
})();
