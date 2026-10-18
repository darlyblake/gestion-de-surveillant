/* Document « Exclusions » : gestion des exclusions temporaires et définitives des élèves. */
(() => {
  'use strict';

  const {
    $, pad, clamp, uid, plural, esc,
    parseISO, toISO, addDays, fmt, setStatus, download
  } = PT;

  const KEY = 'exclusions-eleves.v1';
  const APP = 'exclusions-eleves';
  const DEFAULT_SCHOOL = 'Complexe Scolaire La Réussite Owendo – B.P. 46209';

  const say = (text, kind) => setStatus('e-saved', text, kind);

  /* ---------- Données ---------- */

  let state = { classes: [], currentId: null };
  let booted = false;

  function newClass(base) {
    return {
      id: uid(),
      linkedClassId: PT.getActiveClassId ? PT.getActiveClassId() : null, // classe partagée
      exclusions: []
    };
  }

  function normalize(raw) {
    const base = newClass();
    const c = Object.assign({}, base, raw || {});
    if (!c.id) c.id = base.id;
    if (!Array.isArray(c.exclusions)) c.exclusions = [];
    c.linkedClassId = c.linkedClassId || null;
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
    if (c && !c.linkedClassId && PT.getActiveClassId) c.linkedClassId = PT.getActiveClassId();
    const centralClasses = PT.views.classes ? PT.views.classes.getAllClasses() : [];
    
    // Remplir le sélecteur de classes
    const classSelect = $('e-class-select');
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
        $('e-name').value = linkedClass.name || '';
        $('e-school').value = linkedClass.school || '';
      }
    } else {
      $('e-name').value = '';
      $('e-school').value = '';
    }
    
    updateStudentSelect();
    renderHistory();
  }

  function readForm() {
    const c = current();
    c.linkedClassId = $('e-class-select').value || null;
  }

  function updateStudentSelect() {
    const students = getStudentsFromLinkedClass();
    const select = $('e-student-select');
    select.innerHTML = '<option value="">-- Sélectionner un élève --</option>';
    students.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      select.appendChild(opt);
    });
    $('e-count').textContent = students.length
      ? `${students.length} ${plural(students.length, 'élève', 'élèves')}`
      : '';
  }

  /* ---------- Liste des classes ---------- */

  function renderList() {
    const ul = $('e-class-list');
    ul.innerHTML = '';
    const centralClasses = PT.views.classes ? PT.views.classes.getAllClasses() : [];
    
    state.classes.forEach((c) => {
      const e = c.exclusions ? c.exclusions.length : 0;
      const linkedClass = centralClasses.find((cls) => cls.id === c.linkedClassId);
      const className = linkedClass ? linkedClass.name.trim() : 'Classe non liée';
      const studentCount = linkedClass ? parseStudents(linkedClass.students, false).length : 0;
      
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.id = c.id;
      if (c.id === state.currentId) btn.setAttribute('aria-current', 'true');
      btn.innerHTML = `<span class="nm">${esc(className)}</span>` +
        `<span class="ct">${studentCount} ${plural(studentCount, 'élève', 'élèves')} · ${e} ${plural(e, 'exclusion', 'exclusions')}</span>`;
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  /* ---------- Génération de la décision d'exclusion imprimable ---------- */

  function generateExclusionSheet(exclusion, school) {
    const typeLabel = exclusion.type === 'temporaire' ? 'EXCLUSION TEMPORAIRE' : 'EXCLUSION DÉFINITIVE';
    const typeColor = exclusion.type === 'temporaire' ? '#f59e0b' : '#b3261e';
    
    return `<section class="sheet exclusion">
  <h2 style="color: ${typeColor};">${typeLabel}</h2>
  <p class="sheet-school">${esc(school)}</p>
  <div class="exclusion-content">
    <div class="exclusion-row">
      <span class="exclusion-label">Élève :</span>
      <span class="exclusion-value"><strong>${esc(exclusion.student)}</strong></span>
    </div>
    <div class="exclusion-row">
      <span class="exclusion-label">Type d'exclusion :</span>
      <span class="exclusion-value">${typeLabel}</span>
    </div>
    <div class="exclusion-row">
      <span class="exclusion-label">Date de début :</span>
      <span class="exclusion-value">${fmt(parseISO(exclusion.startDate))}</span>
    </div>
    ${exclusion.endDate ? `
    <div class="exclusion-row">
      <span class="exclusion-label">Date de fin :</span>
      <span class="exclusion-value">${fmt(parseISO(exclusion.endDate))}</span>
    </div>` : ''}
    ${exclusion.duration ? `
    <div class="exclusion-row">
      <span class="exclusion-label">Durée :</span>
      <span class="exclusion-value">${exclusion.duration} jour(s)</span>
    </div>` : ''}
    ${exclusion.motif ? `
    <div class="exclusion-row">
      <span class="exclusion-label">Motif :</span>
      <span class="exclusion-value">${esc(exclusion.motif)}</span>
    </div>` : ''}
  </div>
  <div class="exclusion-footer">
    <div class="exclusion-notice">
      <strong>NOTICE :</strong> Cette décision d'exclusion doit être signée par le responsable de l'établissement et notifiée aux parents de l'élève.
    </div>
    <div class="signature-block">
      <span class="signature-line">Signature du chef d'établissement :</span>
    </div>
    <div class="signature-block">
      <span class="signature-line">Signature des parents :</span>
    </div>
    <div class="signature-block">
      <span class="signature-line">Cachet de l'établissement :</span>
    </div>
  </div>
  <div class="sheet-page">Décision prise le ${fmt(parseISO(exclusion.createdAt))}</div>
</section>`;
  }

  function printExclusion(index) {
    const c = current();
    const exclusion = c.exclusions[index];
    if (!exclusion) return;
    
    const centralClasses = PT.views.classes ? PT.views.classes.getAllClasses() : [];
    const linkedClass = centralClasses.find((cls) => cls.id === c.linkedClassId);
    const school = linkedClass ? linkedClass.school : DEFAULT_SCHOOL;
    
    const printArea = $('e-print-area');
    printArea.innerHTML = generateExclusionSheet(exclusion, school);
    window.print();
  }

  /* ---------- Historique des exclusions ---------- */

  function renderHistory() {
    const c = current();
    const history = $('e-history');
    history.innerHTML = '';
    
    if (!c.exclusions || c.exclusions.length === 0) {
      history.innerHTML = '<p class="empty">Aucune exclusion enregistrée</p>';
      return;
    }

    const list = document.createElement('ul');
    list.className = 'history-items';
    
    c.exclusions.forEach((exc, index) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      const typeLabel = exc.type === 'temporaire' ? 'Temporaire' : 'Définitive';
      const typeClass = exc.type === 'temporaire' ? 'temporaire' : 'definitive';
      li.innerHTML = `
        <div class="history-info">
          <strong>${esc(exc.student)}</strong> - 
          <span class="${typeClass}">${typeLabel}</span>
          <br>
          <small>Du ${fmt(parseISO(exc.startDate))}</small>
          ${exc.endDate ? `<small> au ${fmt(parseISO(exc.endDate))}</small>` : ''}
          ${exc.duration ? `<small> (${exc.duration} jours)</small>` : ''}
          ${exc.motif ? `<br><small>Motif: ${esc(exc.motif)}</small>` : ''}
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
    const chosen = current();
    if (chosen && chosen.linkedClassId && PT.setActiveClassId) PT.setActiveClassId(chosen.linkedClassId);
    save();
    disarmDelete();
    fillForm();
    refresh();
  }

  $('e-form').addEventListener('input', (e) => {
    if (e.target.id === 'e-student-select' || e.target.id === 'e-type' || 
        e.target.id === 'e-start-date' || e.target.id === 'e-end-date' || 
        e.target.id === 'e-duration' || e.target.id === 'e-motif') return;
    readForm();
    save();
    refresh();
  });
  $('e-form').addEventListener('submit', (e) => e.preventDefault());

  $('e-class-select').addEventListener('change', () => {
    readForm();
    if (PT.setActiveClassId) PT.setActiveClassId(current().linkedClassId);
    save();
    fillForm();
  });

  $('e-class-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id]');
    if (btn) select(btn.dataset.id);
  });

  $('e-new').addEventListener('click', () => {
    const c = newClass(current());
    state.classes.push(c);
    select(c.id);
  });

  $('e-add').addEventListener('click', () => {
    const c = current();
    const student = $('e-student-select').value;
    const type = $('e-type').value;
    const startDate = $('e-start-date').value;
    const endDate = $('e-end-date').value;
    const duration = $('e-duration').value;
    const motif = $('e-motif').value.trim();

    if (!student) {
      say('Veuillez sélectionner un élève', 'bad');
      return;
    }
    if (!startDate) {
      say('Veuillez sélectionner une date de début', 'bad');
      return;
    }

    if (!c.exclusions) c.exclusions = [];
    c.exclusions.push({
      id: uid(),
      student,
      type,
      startDate,
      endDate: endDate || null,
      duration: duration ? parseInt(duration, 10) : null,
      motif,
      createdAt: new Date().toISOString()
    });

    save();
    refresh();
    say('Exclusion ajoutée avec succès', 'ok');

    // Reset form
    $('e-student-select').value = '';
    $('e-type').value = 'temporaire';
    $('e-start-date').value = '';
    $('e-end-date').value = '';
    $('e-duration').value = '';
    $('e-motif').value = '';
  });

  $('e-history').addEventListener('click', (e) => {
    if (e.target.classList.contains('danger') && e.target.dataset.action === 'delete' && e.target.dataset.index !== undefined) {
      const c = current();
      const index = parseInt(e.target.dataset.index, 10);
      c.exclusions.splice(index, 1);
      save();
      refresh();
      say('Exclusion supprimée', 'ok');
    } else if (e.target.dataset.action === 'print' && e.target.dataset.index !== undefined) {
      const index = parseInt(e.target.dataset.index, 10);
      printExclusion(index);
    }
  });

  let armTimer = null;
  function disarmDelete() {
    const btn = $('e-delete');
    clearTimeout(armTimer);
    btn.classList.remove('armed');
    btn.textContent = 'Supprimer cette classe';
  }

  $('e-delete').addEventListener('click', () => {
    const btn = $('e-delete');
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

  $('e-export').addEventListener('click', () => {
    const data = { app: APP, version: 1, classes: state.classes };
    download(`${APP}-${toISO(new Date())}.json`, JSON.stringify(data, null, 2));
  });

  $('e-import').addEventListener('click', () => $('e-file').click());

  $('e-file').addEventListener('change', (e) => {
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
        say('Ce fichier n\'est pas une sauvegarde des exclusions.', 'bad');
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
      state.currentId = matching.id;
    } else {
      const active = current();
      if (active && !active.linkedClassId) {
        active.linkedClassId = classId;
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

  PT.views.exclusions = {
    show() {
      if (!booted) boot();
      syncActiveClass();
    }
  };
})();
