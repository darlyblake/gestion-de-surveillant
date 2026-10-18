/* Document « Relevés de notes » : génération des relevés de notes par matière. */
(() => {
  'use strict';

  const {
    $, pad, clamp, uid, plural, esc,
    setStatus, download
  } = PT;

  const KEY = 'releves-notes.v1';
  const APP = 'releves-notes';
  const DEFAULT_SCHOOL = 'Complexe Scolaire La Réussite Owendo – B.P. 46209';

  const say = (text, kind) => setStatus('n-saved', text, kind);

  /* ---------- Données ---------- */

  let state = { relevés: [], currentId: null };
  let booted = false;

  function newReleve(base) {
    return {
      id: uid(),
      linkedClassId: PT.getActiveClassId ? PT.getActiveClassId() : null,
      subject: '',
      trimester: '1er',
      notes: {}, // { studentName: { int: [6, 7, 8], devoirs: [12, 14, 15], moyenne: 13 } }
      createdAt: new Date().toISOString()
    };
  }

  function normalize(raw) {
    const base = newReleve();
    const r = Object.assign({}, base, raw || {});
    if (!r.id) r.id = base.id;
    r.subject = String(r.subject || '');
    r.trimester = String(r.trimester || '1er');
    r.linkedClassId = r.linkedClassId || null;
    r.notes = r.notes || {};
    r.createdAt = r.createdAt || base.createdAt;
    return r;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.relevés) && s.relevés.length) {
        return { relevés: s.relevés.map(normalize), currentId: s.currentId };
      }
    } catch (e) { /* stockage indisponible ou illisible */ }
    return null;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      const d = new Date();
      say(`Enregistré à ${pad(d.getHours())}:${pad(d.getMinutes())}`, 'ok');
      return true;
    } catch (e) {
      say('Non enregistré : le navigateur bloque le stockage.', 'bad');
      return false;
    }
  }

  const current = () => state.relevés.find((r) => r.id === state.currentId) || state.relevés[0];

  /* ---------- Liste d'élèves ---------- */

  function getStudentsFromLinkedClass() {
    const r = current();
    if (!r.linkedClassId) return [];
    
    const centralClasses = PT.views.classes ? PT.views.classes.getAllClasses() : [];
    const linkedClass = centralClasses.find((cls) => cls.id === r.linkedClassId);
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
    const r = current();
    if (r && !r.linkedClassId && PT.getActiveClassId) r.linkedClassId = PT.getActiveClassId();
    const centralClasses = PT.views.classes ? PT.views.classes.getAllClasses() : [];
    
    // Remplir le sélecteur de classes
    const classSelect = $('n-class-select');
    classSelect.innerHTML = '<option value="">-- Sélectionner une classe --</option>';
    centralClasses.forEach((cls) => {
      const opt = document.createElement('option');
      opt.value = cls.id;
      opt.textContent = cls.name.trim() || 'Classe sans nom';
      opt.selected = cls.id === r.linkedClassId;
      classSelect.appendChild(opt);
    });
    
    // Afficher les infos de la classe liée
    if (r.linkedClassId) {
      const linkedClass = centralClasses.find((cls) => cls.id === r.linkedClassId);
      if (linkedClass) {
        $('n-class-name').value = linkedClass.name || '';
      }
    } else {
      $('n-class-name').value = '';
    }
    
    $('n-subject').value = r.subject;
    $('n-trimester').value = r.trimester;
    updateCount();
  }

  function readForm() {
    const r = current();
    r.linkedClassId = $('n-class-select').value || null;
    r.subject = $('n-subject').value;
    r.trimester = $('n-trimester').value;
  }

  function updateCount() {
    const students = getStudentsFromLinkedClass();
    $('n-count').textContent = students.length
      ? `${students.length} ${plural(students.length, 'élève', 'élèves')}`
      : '';
  }

  /* ---------- Liste des relevés ---------- */

  function renderList() {
    const ul = $('n-class-list');
    ul.innerHTML = '';
    const centralClasses = PT.views.classes ? PT.views.classes.getAllClasses() : [];
    
    state.relevés.forEach((r) => {
      const linkedClass = centralClasses.find((cls) => cls.id === r.linkedClassId);
      const className = linkedClass ? linkedClass.name.trim() : 'Classe non liée';
      const studentCount = linkedClass ? linkedClass.students.split('\n').filter(Boolean).length : 0;
      
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.id = r.id;
      if (r.id === state.currentId) btn.setAttribute('aria-current', 'true');
      btn.innerHTML = `<span class="nm">${esc(r.subject || 'Sans matière')} - ${esc(className)}</span>` +
        `<span class="ct">${r.trimester} · ${studentCount} ${plural(studentCount, 'élève', 'élèves')}</span>`;
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  /* ---------- Génération du relevé imprimable ---------- */

  function generateReleveSheet(releve) {
    const students = getStudentsFromLinkedClass();
    const className = $('n-class-name').value || 'Classe';
    
    let html = `<div class="releve-container">
      <div class="releve-header">RELEVE DES NOTES</div>
      <div class="releve-subtitle">${esc(className)}</div>
      
      <table class="releve-table">
        <thead>
          <tr>
            <th rowspan="2" class="num">N°</th>
            <th rowspan="2" class="noms">NOMS ET PRENOMS</th>
            <th colspan="3">INT. /10</th>
            <th colspan="3">MOY/ Devoirs /20</th>
            <th rowspan="2" class="moyt">Moy T</th>
            <th rowspan="2" class="signature">SIGNATURE</th>
          </tr>
          <tr>
            <th class="note"></th>
            <th class="note"></th>
            <th class="note"></th>
            <th class="note"></th>
            <th class="note"></th>
            <th class="note"></th>
          </tr>
        </thead>
        <tbody>`;
    
    students.forEach((student, i) => {
      const notes = releve.notes[student] || { int: ['', '', ''], devoirs: ['', '', ''], moyenne: '' };
      const studentName = student.replace(/(.{20})/g, '$1<br>');
      
      html += `<tr>
        <td class="num">${i + 1}</td>
        <td class="noms">${esc(studentName)}</td>
        <td class="note">${notes.int[0] || ''}</td>
        <td class="note">${notes.int[1] || ''}</td>
        <td class="note">${notes.int[2] || ''}</td>
        <td class="note">${notes.devoirs[0] || ''}</td>
        <td class="note">${notes.devoirs[1] || ''}</td>
        <td class="note">${notes.devoirs[2] || ''}</td>
        <td class="moyt">${notes.moyenne || ''}</td>
        <td class="signature"></td>
      </tr>`;
    });
    
    // Lignes vides pour compléter jusqu'à 16
    for (let i = students.length; i < 16; i++) {
      html += `<tr>
        <td class="num">${i + 1}</td>
        <td class="noms"></td>
        <td class="note"></td>
        <td class="note"></td>
        <td class="note"></td>
        <td class="note"></td>
        <td class="note"></td>
        <td class="note"></td>
        <td class="moyt"></td>
        <td class="signature"></td>
      </tr>`;
    }
    
    html += `</tbody>
      </table>
    </div>`;
    
    return html;
  }

  function renderPreview() {
    const r = current();
    const sheets = $('n-sheets');
    const summary = $('n-summary');
    
    if (!r.linkedClassId) {
      sheets.innerHTML = '<p class="empty">Sélectionnez une classe pour générer le relevé</p>';
      summary.textContent = '';
      return;
    }
    
    const students = getStudentsFromLinkedClass();
    if (!students.length) {
      sheets.innerHTML = '<p class="empty">Aucun élève dans cette classe</p>';
      summary.textContent = '';
      return;
    }
    
    sheets.innerHTML = generateReleveSheet(r);
    summary.textContent = `${r.subject || 'Sans matière'} · ${r.trimester} · ${students.length} ${plural(students.length, 'élève', 'élèves')}`;
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
    fillForm();
    refresh();
  }

  $('n-form').addEventListener('input', (e) => {
    if (e.target.id === 'n-class-select') return;
    readForm();
    save();
    refresh();
  });
  $('n-form').addEventListener('submit', (e) => e.preventDefault());

  $('n-class-select').addEventListener('change', () => {
    readForm();
    if (PT.setActiveClassId) PT.setActiveClassId(current().linkedClassId);
    save();
    fillForm();
  });

  $('n-class-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id]');
    if (btn) select(btn.dataset.id);
  });

  $('n-new').addEventListener('click', () => {
    const r = newReleve(current());
    state.relevés.push(r);
    select(r.id);
  });

  $('n-generate').addEventListener('click', () => {
    const r = current();
    if (!r.linkedClassId) {
      say('Sélectionnez d\'abord une classe', 'bad');
      return;
    }
    
    const printArea = $('n-print-area');
    printArea.innerHTML = generateReleveSheet(r);
    window.print();
  });

  /* ---------- Sauvegarde dans un fichier ---------- */

  $('n-export').addEventListener('click', () => {
    const data = { app: APP, version: 1, relevés: state.relevés };
    const filename = `releves-notes-${new Date().toISOString().split('T')[0]}.json`;
    download(filename, JSON.stringify(data, null, 2));
    say(`${state.relevés.length} ${plural(state.relevés.length, 'relevé exporté', 'relevés exportés')} dans ${filename}`, 'ok');
  });

  $('n-import').addEventListener('click', () => $('n-file').click());

  $('n-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data && data.app && data.app !== APP) throw new Error('autre document');
        const list = Array.isArray(data) ? data : data.relevés;
        if (!Array.isArray(list) || !list.length) throw new Error('vide');
        let last = null;
        list.forEach((raw) => {
          const r = normalize(raw);
          const i = state.relevés.findIndex((x) => x.id === r.id);
          if (i >= 0) state.relevés[i] = r; else state.relevés.push(r);
          last = r;
        });
        select(last.id);
        say(`${list.length} ${plural(list.length, 'relevé restauré', 'relevés restaurés')}.`, 'ok');
      } catch (err) {
        say('Ce fichier n\'est pas une sauvegarde des relevés.', 'bad');
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
      if (!state.relevés.some((r) => r.id === state.currentId)) state.currentId = state.relevés[0].id;
    } else {
      const r = newReleve();
      state = { relevés: [r], currentId: r.id };
    }
    fillForm();
    refresh();
    if (loaded) {
      const n = state.relevés.length;
      say(`${n} ${plural(n, 'relevé retrouvé', 'relevés retrouvés')} sur cet appareil.`, 'ok');
    } else {
      save();
    }
  }

  function syncActiveClass() {
    const classId = PT.getActiveClassId ? PT.getActiveClassId() : null;
    if (!classId) return;
    const records = state.relevés;
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
        const next = newReleve(active);
        next.linkedClassId = classId;
        records.push(next);
        state.currentId = next.id;
      }
      save();
    }
    fillForm();
    refresh();
  }

  PT.views.notes = {
    show() {
      if (!booted) boot();
      syncActiveClass();
    },
    
    getAllReleves() {
      return state.relevés;
    },
    
    getReleveById(id) {
      return state.relevés.find((r) => r.id === id);
    }
  };
})();
