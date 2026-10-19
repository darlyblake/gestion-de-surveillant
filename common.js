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

  /*
   * Charge le jeu de classes livré avec l'application sur chaque appareil.
   * Au premier lancement (ou lors d'une nouvelle version du jeu), les classes
   * intégrées sont ajoutées aux classes locales sans dupliquer les mêmes classe/année.
   */
  // Référence intégrée au code : les classes restent disponibles même si le JSON
  // externe ne se charge pas (mode hors ligne / cache / réseau).
  const DEFAULT_CLASSES_DATA = {
  "app": "classes-centrales",
  "version": 3,
  "classes": [
    {
      "id": "cmv4uhh7zkyom",
      "name": "5eme",
      "year": "2026-2027",
      "school": "Complexe Scolaire La Réussite Owendo – B.P. 46209",
      "students": "MAROUNDOU NYAVABA Krys-el Harmonie\nANAGONOU-KOUASSI -Akoua Hortense\nMANFOUMBI ELLA LAFOU Joe\nNGOULOU ASSECO ESSON David\nMBIRA ARVANG GAD\nMBINI MARIVOU Elie Daniel Seth\nOTEKPOLA IMOURANE Adewale Oriyomi\nOBAME-SOSSA Justin-Clemont\nONTSIA ANGOUE Prince Nathan\nMOUSSAVOU OUROU AKONDAN MARZOUK\nABESSOLO Esai\nGNONDO NTOUTOUME Christ\nBOUCAVEL MAKAYA Marie P\nMBIBA ONGOUA GERMANY D\nOWONO Dorego\nMAROUNDOU ITOM Esther",
      "sort": true,
      "createdAt": "2026-10-12T00:00:00.000Z"
    },
    {
      "id": "cmv4zdbdqdehy",
      "name": "4eme",
      "year": "2026-2027",
      "school": "Complexe Scolaire La Réussite Owendo – B.P. 46209",
      "students": "OFOUNDA Isaac\nBOULINGUI MOUSSODJI Van Aroih\nNZE MOUBOGHA Laurel Josue\nEYAMANE NDOUNGA Samuel T\nMOUBOHA BINGOUMOU Precieux R\nNTSEMENA Marc Elie M\nMAVOUNGOU Ysmael Jacob\nBEKALE MBONE Cedrick\nDUABA SOSSA Laurel Axelle\nMOUVANGUI KOUMBA BOUASSA\nMAKANGA Alix\nKEBGUE Zita Esther\nMAGNAHOU IBALA Jhon\nNDOUME NKOGHE PATRICK\nNZOUA ESTHER BRISCA\nALI EMIALYAKA Hectore",
      "sort": true,
      "createdAt": "2026-10-12T00:00:00.000Z"
    },
    {
      "id": "cmv4zdh1kt9bw",
      "name": "3eme",
      "year": "2026-2027",
      "school": "Complexe Scolaire La Réussite Owendo – B.P. 46209",
      "students": "NGUEMA MINTOGO Manasse\nNZEGUE MAKONDJO Esekiel\nMAKAYA BOUYEKI Aime E\nONGOUARI Sadia Esther\nNINGONOTALIO NGOMA Evangegeline\nMONDJOT MOUIRI Djeddah\nMAVANDJI ANGOUORI Abraham W\nNZIGOUNZIGOU Kedhy F\nOUANGO Eurielle L\nSEMBAT MOUTSINGA Tony\nNDZOBANI ABAGASSELIGUI Esther\nGUEBOKO Sermel Abigael\nNDZOBANI MBELEYOUELE Esther\nMABIALA MONBO Chris Sergenis",
      "sort": true,
      "createdAt": "2026-10-12T00:00:00.000Z"
    },
    {
      "id": "cmv4zdq5m328t",
      "name": "2 end",
      "year": "2026-2027",
      "school": "Complexe Scolaire La Réussite Owendo – B.P. 46209",
      "students": "MOUELE ABAGASSELIGUI Darcia\nNGABI MOHAMED\nSOSSY Karl Patrick\nMENGUE MEBIAME Marvine Daniel\nNGAMBA OPAPE Ericka G\nBISSALOU MOUGHENE GRACE M\nNZUE NKENSA Emmanuel Junior\nMAHOMBO ITSETSAME Lesly P\nTANGA DIKALIMAMBO Stescy E",
      "sort": true,
      "createdAt": "2026-10-12T00:00:00.000Z"
    },
    {
      "id": "cmv4zdvd875pe",
      "name": "1er B",
      "year": "2026-2027",
      "school": "Complexe Scolaire La Réussite Owendo – B.P. 46209",
      "students": "NGOUALI ABAGUA Divine Olivia\nNGOMBI Princesse Priscille\nNGOMBI Prince Noe\nMAKAYA Crhys Mathys\nOWPURI JUNIOR\nMAGNAMABANI NEKE Firmin Wham\nTCHICAYA Preson Armel",
      "sort": true,
      "createdAt": "2026-10-12T00:00:00.000Z"
    },
    {
      "id": "cmv4zoymeltth",
      "name": "Tle A1",
      "year": "2026-2027",
      "school": "Complexe Scolaire La Réussite Owendo – B.P. 46209",
      "students": "NTSEMENA Gloria Christie L\nMAILA Rodney\nLEBANDA ONITSA Pressy Fred\nPOPONA AMAVI Anita\nACHA TCHADEU Bil Jessica",
      "sort": false,
      "createdAt": "2026-10-12T00:00:00.000Z"
    },
    {
      "id": "cmv52modlkp2u",
      "name": "Tle B",
      "year": "2026-2027",
      "school": "Complexe Scolaire La Réussite Owendo – B.P. 46209",
      "students": "NTSEMENA Noelly Sharon D",
      "sort": true,
      "createdAt": "2026-10-12T00:00:00.000Z"
    },
    {
      "id": "cmv53qikuwexj",
      "name": "6eme B",
      "year": "2026-2027",
      "school": "Complexe Scolaire La Réussite Owendo – B.P. 46209",
      "students": "OBAME N'NANG Andre Paul\nFOMOTSA NKOMO Asaph\nYOUBI THINY Gaston Valery\nKASSA SOSSA Yvette Keimie\nBEKALE ABOGHE Viguy Ephraim\nMINKO SINGA Jessie\nELISHA JOACHIME EPANGUE Moses\nLEKELE Noe\nMOUNGUENGUI Joel\nPOPONA Marie Clair M\nWISSY TENDA UN Aimée Christ\nBENGONE OWONA Marrion\nTCHINGA BIGNOUMBA Serelia\nZONG ALLOGO Thionne H\nATAYI NDONG Emmanuella\nNDJIMBI FRANCKY\nBEANG NINGONE Diamanda\nOGYABIE MINKO Elie\nBETHOLE ADA\nBENGA BENGOME Kendra\nNGOUA Elisée Geremie\nMBILA THINY Gaston Valery",
      "sort": true,
      "createdAt": "2026-10-12T00:00:00.000Z"
    }
  ]
};

  const CLASSES_KEY = 'classes-centrales.v1';
  const CLASSES_SEED_VERSION_KEY = 'classes-centrales.seed-version.v1';
  const classesReady = Promise.resolve(DEFAULT_CLASSES_DATA)
    .then((seed) => {
      if (!seed || !Array.isArray(seed.classes) || !seed.classes.length) return false;
      const seedVersion = String(seed.version || 1);
      let installedVersion = '';
      let stored = null;
      try {
        installedVersion = localStorage.getItem(CLASSES_SEED_VERSION_KEY) || '';
        stored = JSON.parse(localStorage.getItem(CLASSES_KEY) || 'null');
      } catch (e) {
        return false;
      }
      const localClasses = stored && Array.isArray(stored.classes) ? stored.classes : [];
      const bundledClasses = seed.classes.filter((c) => c && c.id && c.name);
      const sameClass = (a, b) => String(a.id || '') === String(b.id || '')
        || (String(a.name || '').trim().toLocaleLowerCase('fr') === String(b.name || '').trim().toLocaleLowerCase('fr')
          && String(a.year || '') === String(b.year || ''));
      const studentCount = (value) => String(value || '').split(/\r?\n/)
        .map((line) => line.replace(/^\s*\d+\s*(?:[.)\-–:]|\t)\s*/, '').replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean).length;
      const isLocalStudentListComplete = (base, local) => {
        if (!local) return false;
        const expected = studentCount(base.students);
        const actual = studentCount(local.students);
        // Une liste très courte par rapport à la liste intégrée est considérée
        // comme tronquée/corrompue et doit être restaurée depuis le fichier livré.
        const minimumExpected = expected <= 2 ? expected : Math.ceil(expected * 0.7);
        return actual >= minimumExpected;
      };
      // Le marqueur de version ne suffit pas : vérifier aussi que chaque classe
      // contient une liste d'élèves d'une taille cohérente avec la référence.
      const hasCompleteBundledClasses = bundledClasses.every((base) => {
        const local = localClasses.find((item) => item && sameClass(base, item));
        return isLocalStudentListComplete(base, local);
      });
      if (installedVersion === seedVersion && localClasses.length && hasCompleteBundledClasses) return true;

      // Répare les listes vides ou manifestement tronquées. Les listes locales
      // suffisamment complètes sont conservées, ainsi que les classes personnalisées.
      const merged = bundledClasses.map((base) => {
        const local = localClasses.find((item) => item && sameClass(base, item));
        if (!local) return Object.assign({}, base);
        return Object.assign({}, base, local, {
          students: isLocalStudentListComplete(base, local) ? local.students : base.students
        });
      });
      localClasses.forEach((item) => {
        if (item && item.id && !merged.some((base) => sameClass(base, item))) merged.push(item);
      });
      let currentId = stored && stored.currentId;
      const current = localClasses.find((item) => item.id === currentId);
      if (current) {
        const equivalent = merged.find((item) => sameClass(item, current));
        if (equivalent) currentId = equivalent.id;
      }
      if (!merged.some((item) => item.id === currentId)) currentId = merged[0].id;
      localStorage.setItem(CLASSES_KEY, JSON.stringify({ classes: merged, currentId }));
      localStorage.setItem(CLASSES_SEED_VERSION_KEY, seedVersion);
      return true;
    })
    .catch((error) => {
      console.warn('Les classes intégrées ne sont pas disponibles ; conservation des données locales.', error);
      return false;
    });

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
    classesReady, views: {}
  };
})();
