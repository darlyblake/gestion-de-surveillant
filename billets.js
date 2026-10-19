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
  const centralClasses = () => PT.getCentralClasses ? PT.getCentralClasses() : [];
  function parseStudents(text) {
    const list = String(text || '').split(/\r?\n/).map(line => line.replace(/^\s*\d+\s*(?:[.)\-–:]|\t)\s*/, '').replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
    return list;
  }
  function getLinkedClass(record) { return centralClasses().find(cls => cls.id === record.linkedClassId) || null; }
  function getStudents(classId) { const cls = centralClasses().find(item => item.id === classId); return cls ? parseStudents(cls.students) : []; }
  function fillClassSelect() {
    const select = $('b-class-select'), filter = $('b-filter-class'), classes = centralClasses();
    const selected = select.value || (current() && current().linkedClassId) || (PT.getActiveClassId && PT.getActiveClassId()) || '';
    select.innerHTML = '<option value="">Sélectionner une classe</option>';
    filter.innerHTML = '<option value="">Toutes les classes</option>';
    classes.forEach(cls => {
      const name = String(cls.name || 'Classe sans nom').trim();
      select.add(new Option(name, cls.id));
      filter.add(new Option(name, cls.id));
    });
    if (classes.some(cls => cls.id === selected)) select.value = selected;
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
      const cls = classes.find(item => item.id === record.linkedClassId);
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
    const address = [cfg.address, cfg.city].filter(Boolean).join(' · ');
    const contact = [cfg.phone, cfg.email].filter(Boolean).join(' · ');
    return '<header class="billet-paper-header">' + (PT.getSchoolLogoHtml ? PT.getSchoolLogoHtml() : '') + '<h2>' + esc(name) + '</h2>' + (address ? '<p>' + esc(address) + '</p>' : '') + (contact ? '<p>' + esc(contact) + '</p>' : '') + (cfg.academicYear ? '<p>Année scolaire : ' + esc(cfg.academicYear) + '</p>' : '') + '</header>';
  }
  function billetMarkup(b) {
    const isEntry = b.type === 'entree';
    return '<article class="billet-paper ' + (isEntry ? 'billet-paper-entry' : 'billet-paper-exit') + '">' + schoolHeader() +
      '<div class="billet-paper-title"><span>' + (isEntry ? 'BILLET D’ENTRÉE' : 'BILLET DE SORTIE') + '</span><small>' + (isEntry ? 'AUTORISATION D’ACCÈS À L’ÉTABLISSEMENT' : 'AUTORISATION DE SORTIE') + '</small></div>' +
      '<div class="billet-paper-body"><div class="billet-paper-row"><span>Nom de l’élève</span><strong>' + esc(b.student) + '</strong></div>' +
      '<div class="billet-paper-row"><span>Classe</span><strong>' + esc(b.className || '—') + '</strong></div>' +
      '<div class="billet-paper-row"><span>Date</span><strong>' + dateLabel(b.date) + '</strong></div>' +
      '<div class="billet-paper-row"><span>Heure</span><strong>' + esc(b.time || '—') + '</strong></div>' +
      '<div class="billet-paper-motif"><span>Motif</span><p>' + esc(b.motif || 'Non précisé') + '</p></div></div>' +
      '<div class="billet-paper-signatures"><div>Le surveillant / responsable<span></span></div><div>Signature / cachet<span></span></div></div>' +
      '<footer>Document scolaire officiel · Émis le ' + dateLabel(String(b.createdAt || b.date).slice(0,10)) + '</footer></article>';
  }
  function findBillet(recordId, billetId) {
    const record = state.classes.find(c => c.id === recordId);
    if (!record) return null;
    const index = record.billets.findIndex(b => b.id === billetId);
    if (index < 0) return null;
    const cls = centralClasses().find(c => c.id === record.linkedClassId);
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
      @page{size:A4 portrait;margin:14mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#172b45;background:#fff}
      .billet-paper{width:100%;max-width:180mm;margin:0 auto;padding:12mm;border:2px solid #17365d;border-radius:8px;position:relative}
      .billet-paper-header{text-align:center;border-bottom:2px solid #d7e1ed;padding-bottom:8mm;margin-bottom:8mm}
      .billet-paper-header h2{font-size:18pt;color:#17365d;margin:4mm 0 2mm}.billet-paper-header p{margin:1.5mm 0;font-size:9pt;color:#52657d}
      .sheet-school-logo img{max-width:22mm;max-height:22mm;object-fit:contain}.billet-paper-title{text-align:center;margin:8mm 0;padding:6mm;background:#f0f5fb;border-radius:5px;color:${b.type==='entree'?'#14745d':'#b3261e'}}
      .billet-paper-title span{display:block;font-size:19pt;font-weight:800;letter-spacing:.06em}.billet-paper-title small{display:block;margin-top:2mm;font-size:8pt;letter-spacing:.04em}
      .billet-paper-body{margin:8mm 0}.billet-paper-row{display:flex;justify-content:space-between;gap:8mm;padding:4mm 2mm;border-bottom:1px solid #dce4ee}.billet-paper-row span,.billet-paper-motif>span{font-size:10pt;color:#617188}.billet-paper-row strong{font-size:11pt;text-align:right}
      .billet-paper-motif{margin-top:7mm;padding:5mm;background:#f8fafc;border:1px solid #dce4ee;border-radius:5px}.billet-paper-motif p{margin:3mm 0 0;font-size:11pt;white-space:pre-wrap;overflow-wrap:anywhere}
      .billet-paper-signatures{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin-top:18mm}.billet-paper-signatures div{font-size:9pt;font-weight:700}.billet-paper-signatures span{display:block;height:18mm;border-bottom:1px solid #617188}
      .billet-paper footer{margin-top:8mm;padding-top:3mm;border-top:1px solid #dce4ee;text-align:center;font-size:8pt;color:#617188}
      @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.billet-paper{break-inside:avoid}}
    </style>`;
    printWindow.onload = () => setTimeout(() => { printWindow.focus(); printWindow.print(); }, 300);
    printWindow.document.open();
    printWindow.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Billet scolaire</title>' + css + '</head><body>' + billetMarkup(b) + '</body></html>');
    printWindow.document.close();
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
    if (!classId) { say('Sélectionnez une classe.', 'bad'); return; }
    if (!student) { say('Sélectionnez un élève de la classe choisie.', 'bad'); return; }
    if (!date || !time || !motif) { say('Renseignez la date, l’heure et le motif du billet.', 'bad'); return; }
    let record = state.classes.find(c => c.linkedClassId === classId);
    if (!record) { record = { id: uid(), linkedClassId: classId, billets: [] }; state.classes.push(record); }
    record.billets.push({ id: uid(), student, type, date, time, motif, createdAt: new Date().toISOString() });
    state.currentId = record.id;
    if (!save()) return;
    refresh(); say('Billet enregistré. Vous pouvez le consulter avec le bouton « Voir ».', 'ok');
    $('b-student-select').value = ''; $('b-type').value = 'entree'; $('b-date').value = today(); $('b-time').value = ''; $('b-motif').value = '';
    const dialog = $('b-form').closest('dialog');
    if (dialog && dialog.open) dialog.close();
  }
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
