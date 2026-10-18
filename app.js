/* Page d'accueil et navigation : #eleves, #enseignants, sinon l'accueil. */
(() => {
  'use strict';

  const { $, plural, readClasses } = PT;

  const VIEWS = { classes: 'view-classes', eleves: 'view-eleves', enseignants: 'view-enseignants', billets: 'view-billets', exclusions: 'view-exclusions', notes: 'view-notes' };
  const TITLES = { classes: 'Classes et Élèves', eleves: 'Liste de présence', enseignants: 'Pointage des enseignants', billets: 'Billets d\'entrée/sortie', exclusions: 'Exclusions', notes: 'Relevés de notes' };
  const KEYS = { classes: 'classes-centrales.v1', eleves: 'pointage-eleves.v1', enseignants: 'pointage-enseignants.v1', billets: 'billets-eleves.v1', exclusions: 'exclusions-eleves.v1', notes: 'releves-notes.v1' };

  // Sur l'accueil : combien de classes sont déjà enregistrées pour chaque document
  function updateHome() {
    Object.keys(KEYS).forEach((k) => {
      const n = readClasses(KEYS[k]).length;
      $('home-' + k).textContent = n
        ? `${n} ${plural(n, 'classe enregistrée', 'classes enregistrées')}`
        : 'Aucune classe pour le moment';
    });
  }

  function route() {
    const name = (location.hash || '').replace(/^#\/?/, '');
    const key = VIEWS[name] ? name : 'home';

    $('home').hidden = key !== 'home';
    Object.keys(VIEWS).forEach((k) => { $(VIEWS[k]).hidden = k !== key; });
    $('btn-print').hidden = key === 'home';
    $('view-title').textContent = TITLES[key] || '';
    document.title = key === 'home' ? 'Pointage scolaire' : `${TITLES[key]} – Pointage scolaire`;

    if (key === 'home') {
      $('page-style').textContent = '';
      updateHome();
    } else {
      PT.views[key].show();
    }
    window.scrollTo(0, 0);
  }

  $('btn-print').addEventListener('click', () => window.print());
  window.addEventListener('hashchange', route);
  route();
})();
