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
    setStatus, download, readClasses,
    views: {}
  };
})();
