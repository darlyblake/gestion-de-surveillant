/* Document « Billets d'entrée/sortie » : gestion des billets des élèves. */
(() => {
  'use strict';

  const {
    $, pad, clamp, uid, plural, esc,
    parseISO, toISO, addDays, fmt, setStatus, download
  } = PT;

  const KEY = 'billets-eleves.v1';
  const APP = 'billets-eleves';
  const say = (text, kind) => setStatus('b-saved', text, kind);
  const today = () => toISO(new Date());
  let state = { classes: [], currentId: null };
  let booted = false;
  let viewedBillet = null;

  function newClass() { return { id: uid(), linkedClassId: PT.getActiveClassId ? PT.getActiveClassId() : null, billets: [] }; }
  function normalize(raw) {
    const base = newClass(), c = Object.assign({}, base, raw || {});
    if (!c.id) c.id = base.id;
    if (!Array.isArray(c.billets)) c.billets = [];
    c.linkedClassId = c.linkedClassId || null;
    return c;
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.classes) && s.classes.length) {
        const classes = s.classes.filter(c => String(c.name || '').trim().toLowerCase() !== 'classe exemple');
        if (classes.length) return { classes: classes.map(normalize), currentId: classes.some(c => c.id === s.currentId) ? s.currentId : classes[0].id };
      }
    } catch (_) {}
    return null;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (_) { say('Enregistrement impossible : le stockage du navigateur est indisponible.', 'bad'); return false; }
  }
  const current = () => state.classes.find(c => c.id === state.currentId) || state.classes[0];
  // Utilise d'abord le module central des classes : il charge et normalise ses données
  // depuis le stockage partagé avant que les billets ne les consomment.
  function centralClasses() {
    try {
      if (PT.views && PT.views.classes && typeof PT.views.classes.getAllClasses === 'function') {
        const classes = PT.views.classes.getAllClasses();
        if (Array.isArray(classes)) return classes;
      }
    } catch (_) {}
    try {
      const classes = PT.getCentralClasses ? PT.getCentralClasses() : [];
      return Array.isArray(classes) ? classes : [];
    } catch (_) { return []; }
  }
  function parseStudents(text) {
    const list = String(text || '').split(/\r?\n/).map(line => line.replace(/^\s*\d+\s*(?:[.)\-–:]|\t)\s*/, '').replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
    return list;
  }
  function getLinkedClass(record) { return centralClasses().find(cls => cls.id === record.linkedClassId) || null; }
  function getStudents(classId) {
    if (PT.getStudentsForClass) {
      try {
        const students = PT.getStudentsForClass(classId);
        if (Array.isArray(students) && students.length) return students;
      } catch (_) {}
    }
    const cls = centralClasses().find(item => String(item.id) === String(classId));
    if (!cls) return [];
    const raw = Array.isArray(cls.students) ? cls.students.join('\\n') : cls.students;
    return parseStudents(raw);
  }
  function fillClassSelect() {
    const select = $('b-class-select'), filter = $('b-filter-class'), classes = centralClasses();
    const selected = select.value || (current() && current().linkedClassId) || (PT.getActiveClassId && PT.getActiveClassId()) || '';
    select.innerHTML = '<option value="">Sélectionner une classe</option>';
    filter.innerHTML = '<option value="">Toutes les classes</option>';
    classes.filter(cls => cls && cls.id).forEach(cls => {
      const name = String(cls.name || 'Classe sans nom').trim();
      select.add(new Option(name, cls.id));
      filter.add(new Option(name, cls.id));
    });
    if (classes.some(cls => String(cls.id) === String(selected))) select.value = selected;
    else if (classes[0]) select.value = classes[0].id;
    updateStudentSelect();
  }
  function updateStudentSelect() {
    const select = $('b-student-select'), students = getStudents($('b-class-select').value);
    select.innerHTML = '<option value="">Sélectionner un élève</option>';
    students.forEach(name => select.add(new Option(name, name)));
    $('b-count').textContent = students.length ? students.length + (students.length === 1 ? ' élève dans cette classe' : ' élèves dans cette classe') : 'Aucun élève trouvé dans cette classe.';
  }
  function allBillets() {
    const classes = centralClasses(), rows = [];
    state.classes.forEach(record => {
      const cls = classes.find(item => String(item.id) === String(record.linkedClassId));
      (record.billets || []).forEach((billet, index) => rows.push({ ...billet, recordId: record.id, recordIndex: index, classId: record.linkedClassId || '', className: cls ? String(cls.name || '').trim() : 'Classe non liée' }));
    });
    return rows.sort((a,b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));
  }
  function dateLabel(value) { const date = parseISO(String(value || '').slice(0,10)); return date ? fmt(date) : '—'; }
  function renderTable() {
    const search = $('b-search').value.trim().toLocaleLowerCase('fr');
    const classId = $('b-filter-class').value, type = $('b-filter-type').value;
    const rows = allBillets().filter(b => (!search || b.student.toLocaleLowerCase('fr').includes(search)) && (!classId || b.classId === classId) && (!type || b.type === type));
    const body = $('b-table-body'); body.innerHTML = '';
    rows.forEach(b => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td><strong>' + esc(b.student) + '</strong></td><td>' + esc(b.className) + '</td><td><span class="billet-type ' + (b.type === 'entree' ? 'entree' : 'sortie') + '">' + (b.type === 'entree' ? 'Entrée' : 'Sortie') + '</span></td><td>' + esc(b.motif || '—') + '</td><td>' + dateLabel(b.date) + '</td><td>' + esc(b.time || '—') + '</td><td><button type="button" class="btn small primary" data-view-id="' + esc(b.id) + '" data-record-id="' + esc(b.recordId) + '">Voir</button></td>';
      body.appendChild(tr);
    });
    $('b-empty').hidden = rows.length > 0;
    $('b-summary').textContent = rows.length + (rows.length === 1 ? ' billet enregistré' : ' billets enregistrés') + (search || classId || type ? ' — résultats filtrés' : '');
  }
  function schoolHeader() {
    const cfg = PT.getSchoolConfig ? PT.getSchoolConfig() : {};
    const name = cfg.name || (PT.getSchoolName ? PT.getSchoolName() : 'Établissement scolaire');
    const phone = cfg.phone ? 'TÉLÉPHONE : ' + cfg.phone : '';
    const address = [cfg.address, cfg.city].filter(Boolean).join(' · ');
    return '<header class="billet-paper-header">' +
      '<h2>LYCEE BILINGUE DE NGONG</h2>' +
      '<p class="billet-phone">TÉLÉPHONE : 242 16 75 02</p>' +
      '</header>';
  }
  function billetMarkup(b) {
    const isEntry = b.type === 'entree';
    const title = isEntry ? 'BILLET D’ENTRÉE' : 'BILLET DE SORTIE';
    const action = isEntry ? 'est autorisé à entrer dans l’établissement' : 'est autorisé à sortir de l’établissement';
    const date = dateLabel(b.date);
    const time = b.time || '…………………';
    const reason = b.motif || '……………………………………………………';
    const className = b.className || '…………';
    const student = b.student || '…………………………………………';
    const returnDate = b.returnDate ? dateLabel(b.returnDate) : '…………………';
    const returnTime = b.returnTime || '…………………';
    return '<article class="billet-paper ' + (isEntry ? 'billet-paper-entry' : 'billet-paper-exit') + '">' +
      '<div class="billet-paper-frame">' +
      schoolHeader() +
      '<h1 class="billet-paper-title">' + title + '</h1>' +
      '<div class="billet-paper-text">' +
      '<p class="billet-document-line">Nom de l’élève : <span class="billet-fill">' + esc(student) + '</span></p>' +
      '<p class="billet-document-line">Classe : <span class="billet-fill">' + esc(className) + '</span>, ' + action + ' le <span class="billet-fill">' + esc(date) + '</span>.</p>' +
      '<p class="billet-document-line">Raison : <span class="billet-fill">' + esc(reason) + '</span></p>' +
      (isEntry
        ? '<p class="billet-document-line">Heure d’entrée : <span class="billet-fill">' + esc(time) + '</span></p>'
        : '<p class="billet-document-line">Retour le : <span class="billet-fill">' + esc(returnDate) + '</span> à <span class="billet-fill">' + esc(returnTime) + '</span>.</p>') +
      '</div>' +
      '<div class="billet-paper-footer"><p class="billet-paper-place">Ngong, le <span class="billet-fill">' + esc(date) + '</span></p>' +
      '<div class="billet-paper-signature"><span>Le Surveillant Général,</span><div class="billet-paper-signature-space"></div></div></div>' +
      '</div></article>';
  }
  function findBillet(recordId, billetId) {
    const record = state.classes.find(c => c.id === recordId);
    if (!record) return null;
    const index = record.billets.findIndex(b => b.id === billetId);
    if (index < 0) return null;
    const cls = centralClasses().find(c => String(c.id) === String(record.linkedClassId));
    return { ...record.billets[index], recordId, recordIndex: index, classId: record.linkedClassId || '', className: cls ? String(cls.name || '').trim() : 'Classe non liée' };
  }
  function showBillet(recordId, billetId) {
    viewedBillet = { recordId, billetId };
    const b = findBillet(recordId, billetId);
    if (!b) return;
    $('b-view-content').innerHTML = billetMarkup(b);
    const dialog = $('b-view-dialog');
    if (!dialog.open) dialog.showModal();
  }
  function printViewedBillet() {
    if (!viewedBillet) return;
    const b = findBillet(viewedBillet.recordId, viewedBillet.billetId);
    if (!b) return;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) { say('Autorisez les fenêtres contextuelles pour imprimer le billet.', 'bad'); return; }
    const css = `<style>
      @page { size: A4 portrait; margin: 18mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: #111; }
      body { font-family: "Times New Roman", Times, serif; }
      .billet-paper { width: 100%; margin: 0 auto; padding: 0; border: 0; background: #fff; color: #111; }
      .billet-paper-frame { min-height: 100mm; border: 0; padding: 0; }
      .billet-paper-header { text-align: center; margin: 0 0 28px; padding: 0; border: 0; }
      .billet-paper-header h2 { margin: 0 0 5px; font-size: 13pt; font-weight: 700; text-transform: uppercase; color: #111; }
      .billet-paper-header p { margin: 0; font-size: 10pt; color: #111; }
      .billet-paper-title { margin: 0 0 26px; padding: 0; text-align: center; font-size: 16pt; line-height: 1.2; font-weight: 700; color: #111; }
      .billet-paper-text p { margin: 0 0 11pt; font-size: 12pt; line-height: 1.8; overflow-wrap: anywhere; }
      .billet-fill { text-decoration: underline; text-underline-offset: 2pt; }
      .billet-paper-footer { display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; margin-top: 26pt; }
      .billet-paper-place { margin: 0; font-size: 10pt; }
      .billet-paper-signature { min-width: 45mm; text-align: center; font-size: 10pt; }
      .billet-paper-signature-space { height: 16mm; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .billet-paper-frame { break-inside: avoid; } }
    </style>`
    printWindow.document.open();
    printWindow.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + (b.type === 'entree' ? 'Billet d’entrée' : 'Billet de sortie') + '</title>' + css + '</head><body>' + billetMarkup(b) + '</body></html>');
    printWindow.document.close();
    // Déclencher l’impression après l’écriture du document évite la fenêtre blanche.
    printWindow.setTimeout(() => {
      try { printWindow.focus(); printWindow.print(); }
      catch (_) { say('Impossible de lancer l’impression. Réessayez depuis la fenêtre du billet.', 'bad'); }
    }, 500);
  }
  function renderList() {
    const list = $('b-class-list');
    if (!list) return;
    list.innerHTML = '';
    centralClasses().forEach(cls => {
      const opt = document.createElement('option'); opt.value = cls.id; opt.textContent = cls.name || 'Classe sans nom';
    });
  }
  function refresh() { fillClassSelect(); renderTable(); }
  function readForm() { const c = current(); if (c) c.linkedClassId = $('b-class-select').value || null; }
  function addBillet() {
    const classId = $('b-class-select').value, student = $('b-student-select').value;
    const type = $('b-type').value, date = $('b-date').value, time = $('b-time').value, motif = $('b-motif').value.trim();
    const returnDate = $('b-return-date').value, returnTime = $('b-return-time').value;
    if (!classId) { say('Sélectionnez une classe.', 'bad'); return; }
    if (!student) { say('Sélectionnez un élève de la classe choisie.', 'bad'); return; }
    if (!date || !time || !motif) { say('Renseignez la date, l’heure et le motif du billet.', 'bad'); return; }
    let record = state.classes.find(c => c.linkedClassId === classId);
    if (!record) { record = { id: uid(), linkedClassId: classId, billets: [] }; state.classes.push(record); }
    record.billets.push({ id: uid(), student, type, date, time, motif, returnDate: type === 'sortie' ? returnDate : '', returnTime: type === 'sortie' ? returnTime : '', createdAt: new Date().toISOString() });
    state.currentId = record.id;
    if (!save()) return;
    refresh(); say('Billet enregistré. Vous pouvez le consulter avec le bouton « Voir ».', 'ok');
    $('b-student-select').value = ''; $('b-type').value = 'entree'; $('b-date').value = today(); $('b-time').value = ''; $('b-motif').value = ''; $('b-return-date').value = ''; $('b-return-time').value = ''; updateReturnFields();
    const dialog = $('b-form').closest('dialog');
    if (dialog && dialog.open) dialog.close();
  }
  function updateReturnFields() {
    const isExit = $('b-type').value === 'sortie';
    $('b-return-date-field').hidden = !isExit;
    $('b-return-time-field').hidden = !isExit;
  }
  $('b-type').addEventListener('change', updateReturnFields);
  $('b-class-select').addEventListener('change', updateStudentSelect);
  $('b-new').addEventListener('click', () => {
    $('b-date').value = $('b-date').value || today();
    $('b-time').value = $('b-time').value || (String(new Date().getHours()).padStart(2,'0') + ':' + String(new Date().getMinutes()).padStart(2,'0'));
    fillClassSelect();
    const form = $('b-form');
    const dialog = form.closest('dialog');
    if (dialog && !dialog.open) dialog.showModal();
    else if (!dialog) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('b-add').addEventListener('click', addBillet);
  ['b-search','b-filter-class','b-filter-type'].forEach(id => $(id).addEventListener(id === 'b-search' ? 'input' : 'change', renderTable));
  $('b-table-body').addEventListener('click', e => {
    const button = e.target.closest('button[data-view-id]');
    if (button) showBillet(button.dataset.recordId, button.dataset.viewId);
  });
  $('b-view-close').addEventListener('click', () => $('b-view-dialog').close());
  $('b-view-print').addEventListener('click', printViewedBillet);
  $('b-export').addEventListener('click', () => download('billets-eleves-' + today() + '.json', JSON.stringify({ app: APP, version: 1, classes: state.classes }, null, 2)));
  $('b-import').addEventListener('click', () => $('b-file').click());
  $('b-file').addEventListener('change', e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try {
      const data = JSON.parse(reader.result), list = Array.isArray(data) ? data : data.classes;
      if (!Array.isArray(list)) throw new Error('invalid');
      list.forEach(raw => { const c = normalize(raw), i = state.classes.findIndex(x => x.id === c.id); if (i >= 0) state.classes[i] = c; else state.classes.push(c); });
      save(); refresh(); say('Sauvegarde restaurée.', 'ok');
    } catch (_) { say('Ce fichier ne contient pas une sauvegarde valide des billets.', 'bad'); } };
    reader.readAsText(file);
  });
  function boot() {
    booted = true; const loaded = load();
    if (loaded) state = loaded;
    else { const c = newClass(); state = { classes: [c], currentId: c.id }; }
    fillClassSelect();
    updateReturnFields();
    $('b-date').value = today();
    const now = new Date(); $('b-time').value = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    refresh();
    if (!loaded) save();
  }
  function syncActiveClass() {
    if (!booted) boot();
    const activeId = PT.getActiveClassId ? PT.getActiveClassId() : null;
    if (activeId && !$('b-class-select').value) $('b-class-select').value = activeId;
    fillClassSelect(); renderTable();
  }
  PT.views.billets = { show() { if (!booted) boot(); syncActiveClass(); } };
})();
