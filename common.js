/* Fonctions partagées par les deux documents (élèves et enseignants). */
window.PT = (() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const uid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const plural = (n, one, many) => (n > 1 ? many : one);
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

  /* Dates : calcul en heure locale, sans décalage de fuseau */
  function parseISO(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
  const fmt = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const fmtShort = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

  /* Message d'état (« Enregistré à 07:12 », erreurs de sauvegarde…) */
  function setStatus(id, text, kind) {
    const el = $(id);
    el.textContent = text;
    el.className = 'saved' + (kind ? ' ' + kind : '');
  }

  /* Télécharge un fichier texte (sauvegarde JSON) */
  function download(filename, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* Contexte partagé : une seule classe active pour toutes les fonctionnalités. */
  const CONTEXT_KEY = 'gestion-surveillant.context.v1';
  function getCentralClasses() {
    try {
      const data = JSON.parse(localStorage.getItem('classes-centrales.v1'));
      return data && Array.isArray(data.classes) ? data.classes : [];
    } catch (e) { return []; }
  }
  function getActiveClassId() {
    try {
      const data = JSON.parse(localStorage.getItem(CONTEXT_KEY));
      const classes = getCentralClasses();
      return data && classes.some((c) => c.id === data.activeClassId) ? data.activeClassId : (classes[0] ? classes[0].id : null);
    } catch (e) {
      const classes = getCentralClasses();
      return classes[0] ? classes[0].id : null;
    }
  }
  function setActiveClassId(id) {
    if (!getCentralClasses().some((c) => c.id === id)) return false;
    try { localStorage.setItem(CONTEXT_KEY, JSON.stringify({ activeClassId: id })); } catch (e) {}
    window.dispatchEvent(new CustomEvent('pt:active-class-changed', { detail: { classId: id } }));
    return true;
  }
  function getActiveClass() {
    const id = getActiveClassId();
    return getCentralClasses().find((c) => c.id === id) || null;
  }
  function getStudentsForClass(classId) {
    const cls = getCentralClasses().find((c) => c.id === classId);
    if (!cls) return [];
    const list = String(cls.students || '').split(/\r?\n/)
      .map((line) => line.replace(/^\s*\d+\s*(?:[.)\-–:]|\t)\s*/, '').replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (cls.sort) list.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    return list;
  }

  /* Lit la liste des classes enregistrées sous une clé (sert à l'accueil) */
  function readClasses(key) {
    try {
      const s = JSON.parse(localStorage.getItem(key));
      return s && Array.isArray(s.classes) ? s.classes : [];
    } catch (e) {
      return [];
    }
  }

  return {
    $, pad, clamp, uid, plural, esc,
    parseISO, toISO, addDays, mondayOf, fmt, fmtShort,
    setStatus, download, readClasses, getCentralClasses, getActiveClassId, setActiveClassId, getActiveClass, getStudentsForClass,
    views: {}
  };
})();
