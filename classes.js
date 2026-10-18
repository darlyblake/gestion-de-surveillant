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

  let state = { classes: [], currentId: null, showingStudents: false };
  let booted = false;

  function newClass(base) {
    const now = new Date();
    const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return {
      id: uid(),
      name: '',
      year: `${y}-${y + 1}`,
      school: base && base.school ? base.school : DEFAULT_SCHOOL,
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
      $('cls-school').value = DEFAULT_SCHOOL;
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

  /* ---------- Vue principale : liste des classes puis liste des élèves ---------- */

  function renderPreview() {
    const sheets = $('cls-sheets');
    const summary = $('cls-summary');

    if (!state.showingStudents) {
      summary.textContent = `${state.classes.length} ${plural(state.classes.length, 'classe', 'classes')}`;
      let html = '<div class="classes-main-list">';
      html += '<div class="classes-main-toolbar"><h3>Liste des classes</h3><button type="button" class="btn primary" data-class-action="new">+ Ajouter une classe</button></div>';
      if (!state.classes.length) {
        html += '<p class="empty">Aucune classe enregistrée. Ajoutez votre première classe.</p>';
      } else {
        html += '<div class="classes-table-wrap"><table class="classes-table"><thead><tr><th>Classe</th><th>Année scolaire</th><th>Effectif</th><th>Action</th></tr></thead><tbody>';
        state.classes.forEach((cls) => {
          const count = parseStudents(cls.students, false).length;
          html += `<tr><td><strong>${esc(cls.name.trim() || 'Classe sans nom')}</strong></td><td>${esc(cls.year)}</td><td>${count} ${plural(count, 'élève', 'élèves')}</td><td><button type="button" class="btn" data-class-action="open" data-id="${esc(cls.id)}">Voir les élèves</button></td></tr>`;
        });
        html += '</tbody></table></div>';
      }
      html += '</div>';
      sheets.innerHTML = html;
      return;
    }

    const c = current();
    if (!c) {
      state.showingStudents = false;
      renderPreview();
      return;
    }
    const students = parseStudents(c.students, c.sort);
    summary.textContent = `${students.length} ${plural(students.length, 'élève', 'élèves')} · ${c.year}`;

    let html = '<div class="class-preview">';
    html += '<div class="classes-main-toolbar"><button type="button" class="btn" data-class-action="back">← Toutes les classes</button><button type="button" class="btn primary" data-class-action="add-student">+ Ajouter des élèves</button></div>';
    html += `<h3>${esc(c.name.trim() || 'Classe sans nom')}</h3>`;
    html += `<p><strong>Établissement :</strong> ${esc(c.school)}</p>`;
    html += `<p><strong>Année scolaire :</strong> ${esc(c.year)}</p>`;
    html += `<p><strong>Effectif :</strong> ${students.length} ${plural(students.length, 'élève', 'élèves')}</p>`;
    html += '<h4>Liste des élèves</h4>';
    if (!students.length) {
      html += '<p class="empty">Aucun élève dans cette classe. Cliquez sur « Ajouter des élèves » pour commencer.</p>';
    } else {
      html += '<ol class="student-list">';
      students.forEach((student) => { html += `<li>${esc(student)}</li>`; });
      html += '</ol>';
    }
    html += '</div>';
    sheets.innerHTML = html;
  }

  $('cls-sheets').addEventListener('click', (event) => {
    const button = event.target.closest('[data-class-action]');
    if (!button) return;
    const action = button.dataset.classAction;
    if (action === 'new') {
      $('cls-new').click();
    } else if (action === 'open') {
      select(button.dataset.id);
    } else if (action === 'back') {
      state.showingStudents = false;
      refresh();
    } else if (action === 'add-student') {
      const form = $('cls-form');
      const dialog = form.dataset.actionDialog ? document.getElementById(form.dataset.actionDialog) : null;
      if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
      else if (dialog) dialog.setAttribute('open', '');
      $('cls-add-name').focus();
    }
  });

  /* ---------- Actions ---------- */

  function refresh() {
    renderList();
    renderPreview();
  }

  function select(id) {
    state.currentId = id;
    state.showingStudents = true;
    save();
    if (PT.setActiveClassId) PT.setActiveClassId(id);
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
    if (!state.classes.length) state.classes.push(newClass());
    select(state.classes[0].id);
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
    } else {
      state = { classes: [], currentId: null, showingStudents: false };
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
