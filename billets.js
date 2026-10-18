/* Document « Billets d'entrée/sortie » : gestion des billets des élèves. */
(() => {
  'use strict';

  const {
    $, pad, clamp, uid, plural, esc,
    parseISO, toISO, addDays, fmt, setStatus, download
  } = PT;

  const KEY = 'billets-eleves.v1';
  const APP = 'billets-eleves';
  const DEFAULT_SCHOOL = 'Complexe Scolaire La Réussite Owendo – B.P. 46209';

  const say = (text, kind) => setStatus('b-saved', text, kind);

  /* ---------- Données ---------- */

  let state = { classes: [], currentId: null };
  let booted = false;

  function newClass(base) {
    return {
      id: uid(),
      linkedClassId: null, // ID de la classe depuis Classes centralisées
      billets: []
    };
  }

  function normalize(raw) {
    const base = newClass();
    const c = Object.assign({}, base, raw || {});
    if (!c.id) c.id = base.id;
    if (!Array.isArray(c.billets)) c.billets = [];
    c.linkedClassId = c.linkedClassId || null;
    return c;
  }

  function sampleClass() {
    const c = newClass();
    return c;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.classes) && s.classes.length) {
        return { classes: s.classes.map(normalize), currentId: s.currentId };
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

  /* ---------- Formulaire ---------- */

  function fillForm() {
    const c = current();
    const centralClasses = PT.views.classes ? PT.views.classes.getAllClasses() : [];
    
    // Remplir le sélecteur de classes
    const classSelect = $('b-class-select');
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
        $('b-name').value = linkedClass.name || '';
        $('b-school').value = linkedClass.school || '';
      }
    } else {
      $('b-name').value = '';
      $('b-school').value = '';
    }
    
    updateStudentSelect();
    renderHistory();
  }

  function readForm() {
    const c = current();
    c.linkedClassId = $('b-class-select').value || null;
  }

  function updateStudentSelect() {
    const students = getStudentsFromLinkedClass();
    const select = $('b-student-select');
    select.innerHTML = '<option value="">-- Sélectionner un élève --</option>';
    students.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      select.appendChild(opt);
    });
    $('b-count').textContent = students.length
      ? `${students.length} ${plural(students.length, 'élève', 'élèves')}`
      : '';
  }

  /* ---------- Liste des classes ---------- */

  function renderList() {
    const ul = $('b-class-list');
    ul.innerHTML = '';
    const centralClasses = PT.views.classes ? PT.views.classes.getAllClasses() : [];
    
    state.classes.forEach((c) => {
      const b = c.billets ? c.billets.length : 0;
      const linkedClass = centralClasses.find((cls) => cls.id === c.linkedClassId);
      const className = linkedClass ? linkedClass.name.trim() : 'Classe non liée';
      const studentCount = linkedClass ? parseStudents(linkedClass.students, false).length : 0;
      
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.id = c.id;
      if (c.id === state.currentId) btn.setAttribute('aria-current', 'true');
      btn.innerHTML = `<span class="nm">${esc(className)}</span>` +
        `<span class="ct">${studentCount} ${plural(studentCount, 'élève', 'élèves')} · ${b} ${plural(b, 'billet', 'billets')}</span>`;
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  /* ---------- Génération du billet imprimable ---------- */

  function generateBilletSheet(billet, school) {
    const typeLabel = billet.type === 'entree' ? 'BILLET D\'ENTRÉE' : 'BILLET DE SORTIE';
    const typeColor = billet.type === 'entree' ? '#0e6a5b' : '#b3261e';
    
    return `<section class="sheet billet">
  <h2 style="color: ${typeColor};">${typeLabel}</h2>
  <p class="sheet-school">${esc(school)}</p>
  <div class="billet-content">
    <div class="billet-row">
      <span class="billet-label">Élève :</span>
      <span class="billet-value"><strong>${esc(billet.student)}</strong></span>
    </div>
    <div class="billet-row">
      <span class="billet-label">Date :</span>
      <span class="billet-value">${fmt(parseISO(billet.date))}</span>
    </div>
    <div class="billet-row">
      <span class="billet-label">Heure :</span>
      <span class="billet-value">${billet.time}</span>
    </div>
    ${billet.motif ? `
    <div class="billet-row">
      <span class="billet-label">Motif :</span>
      <span class="billet-value">${esc(billet.motif)}</span>
    </div>` : ''}
  </div>
  <div class="billet-footer">
    <div class="signature-block">
      <span class="signature-line">Signature de l'élève :</span>
    </div>
    <div class="signature-block">
      <span class="signature-line">Signature du responsable :</span>
    </div>
    <div class="signature-block">
      <span class="signature-line">Cachet de l'établissement :</span>
    </div>
  </div>
  <div class="sheet-page">Émis le ${fmt(parseISO(billet.createdAt))}</div>
</section>`;
  }

  function printBillet(index) {
    const c = current();
    const billet = c.billets[index];
    if (!billet) return;
    
    const centralClasses = PT.views.classes ? PT.views.classes.getAllClasses() : [];
    const linkedClass = centralClasses.find((cls) => cls.id === c.linkedClassId);
    const school = linkedClass ? linkedClass.school : DEFAULT_SCHOOL;
    
    const printArea = $('b-print-area');
    printArea.innerHTML = generateBilletSheet(billet, school);
    window.print();
  }

  /* ---------- Historique des billets ---------- */

  function renderHistory() {
    const c = current();
    const history = $('b-history');
    history.innerHTML = '';
    
    if (!c.billets || c.billets.length === 0) {
      history.innerHTML = '<p class="empty">Aucun billet enregistré</p>';
      return;
    }

    const list = document.createElement('ul');
    list.className = 'history-items';
    
    c.billets.forEach((b, index) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <div class="history-info">
          <strong>${esc(b.student)}</strong> - 
          <span class="${b.type === 'entree' ? 'entree' : 'sortie'}">${b.type === 'entree' ? 'Entrée' : 'Sortie'}</span>
          <br>
          <small>${fmt(parseISO(b.date))} à ${b.time}</small>
          ${b.motif ? `<br><small>Motif: ${esc(b.motif)}</small>` : ''}
        </div>
        <div class="history-actions">
          <button type="button" class="btn small" data-index="${index}" data-action="print">Imprimer</button>
          <button type="button" class="btn danger small" data-index="${index}" data-action="delete">Supprimer</button>
        </div>
      `;
      list.appendChild(li);
    });
    
    history.appendChild(list);
  }

  /* ---------- Actions ---------- */

  function refresh() {
    renderList();
    renderHistory();
  }

  function select(id) {
    state.currentId = id;
    save();
    disarmDelete();
    fillForm();
    refresh();
  }

  $('b-form').addEventListener('input', (e) => {
    if (e.target.id === 'b-student-select' || e.target.id === 'b-type' || 
        e.target.id === 'b-date' || e.target.id === 'b-time' || e.target.id === 'b-motif') return;
    readForm();
    save();
    refresh();
  });
  $('b-form').addEventListener('submit', (e) => e.preventDefault());

  $('b-class-select').addEventListener('change', () => {
    readForm();
    save();
    fillForm();
  });

  $('b-class-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id]');
    if (btn) select(btn.dataset.id);
  });

  $('b-new').addEventListener('click', () => {
    const c = newClass(current());
    state.classes.push(c);
    select(c.id);
  });

  $('b-add').addEventListener('click', () => {
    const c = current();
    const student = $('b-student-select').value;
    const type = $('b-type').value;
    const date = $('b-date').value;
    const time = $('b-time').value;
    const motif = $('b-motif').value.trim();

    if (!student) {
      say('Veuillez sélectionner un élève', 'bad');
      return;
    }
    if (!date) {
      say('Veuillez sélectionner une date', 'bad');
      return;
    }
    if (!time) {
      say('Veuillez sélectionner une heure', 'bad');
      return;
    }

    if (!c.billets) c.billets = [];
    c.billets.push({
      id: uid(),
      student,
      type,
      date,
      time,
      motif,
      createdAt: new Date().toISOString()
    });

    save();
    refresh();
    say('Billet ajouté avec succès', 'ok');

    // Reset form
    $('b-student-select').value = '';
    $('b-type').value = 'entree';
    $('b-date').value = '';
    $('b-time').value = '';
    $('b-motif').value = '';
  });

  $('b-history').addEventListener('click', (e) => {
    if (e.target.classList.contains('danger') && e.target.dataset.action === 'delete' && e.target.dataset.index !== undefined) {
      const c = current();
      const index = parseInt(e.target.dataset.index, 10);
      c.billets.splice(index, 1);
      save();
      refresh();
      say('Billet supprimé', 'ok');
    } else if (e.target.dataset.action === 'print' && e.target.dataset.index !== undefined) {
      const index = parseInt(e.target.dataset.index, 10);
      printBillet(index);
    }
  });

  let armTimer = null;
  function disarmDelete() {
    const btn = $('b-delete');
    clearTimeout(armTimer);
    btn.classList.remove('armed');
    btn.textContent = 'Supprimer cette classe';
  }

  $('b-delete').addEventListener('click', () => {
    const btn = $('b-delete');
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

  $('b-export').addEventListener('click', () => {
    const data = { app: APP, version: 1, classes: state.classes };
    download(`${APP}-${toISO(new Date())}.json`, JSON.stringify(data, null, 2));
  });

  $('b-import').addEventListener('click', () => $('b-file').click());

  $('b-file').addEventListener('change', (e) => {
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
        say('Ce fichier n\'est pas une sauvegarde des billets.', 'bad');
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

  PT.views.billets = {
    show() {
      if (!booted) boot(); else renderHistory();
    }
  };
})();
