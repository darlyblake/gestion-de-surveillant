/* Fenêtres modales pour les formulaires d'action.
   Le contenu principal reste visible ; les formulaires s'ouvrent à la demande. */
(() => {
  'use strict';

  const modalCss = `
    .layout { grid-template-columns: minmax(0, 1fr) !important; align-items: start; }
    .layout > .preview { grid-column: 1; grid-row: 1; min-width: 0; }
    .layout > .panel { grid-column: 1; grid-row: 2; display: flex; flex-direction: row; flex-wrap: wrap; align-items: flex-start; gap: 12px; }
    .layout > .panel > .card { flex: 1 1 280px; min-width: 0; }
    .layout > .panel > form.card { display: none !important; }
    .modal-action-trigger { margin-left: auto; white-space: nowrap; }
    .preview-head { display: flex; align-items: center; gap: 10px; }
    .preview-head > h2 { margin-right: auto; }
    .action-dialog {
      width: min(760px, calc(100vw - 28px)); max-width: 760px;
      max-height: min(88dvh, 900px); padding: 0;
      border: 1px solid #dce3ec; border-radius: 10px;
      background: #fff; color: #1b2738;
      box-shadow: 0 24px 70px rgba(15, 35, 60, .25); overflow: auto;
    }
    .action-dialog::backdrop { background: rgba(15, 29, 48, .56); backdrop-filter: blur(2px); }
    .action-dialog-head {
      position: sticky; top: 0; z-index: 2; display: flex; align-items: center;
      justify-content: space-between; gap: 16px; padding: 16px 20px;
      background: #fff; border-bottom: 1px solid #dce3ec;
    }
    .action-dialog-head h2 { margin: 0; font-size: 1.05rem; color: #17365d; }
    .action-dialog-close {
      display: inline-grid; place-items: center; width: 36px; height: 36px;
      border: 1px solid #dce3ec; border-radius: 6px; background: #fff;
      color: #17365d; font-size: 1.35rem; cursor: pointer;
    }
    .action-dialog > form.card {
      display: flex !important; gap: 14px; border: 0; border-radius: 0;
      box-shadow: none; padding: 20px; max-height: none; overflow: visible;
    }
    .action-dialog .btn.primary { background: #17365d; border-color: #17365d; color: #fff; }
    .action-dialog input, .action-dialog select, .action-dialog textarea { max-width: 100%; }
    @media (max-width: 640px) {
      .layout > .panel { flex-direction: column; }
      .layout > .panel > .card { width: 100%; }
      .preview-head { flex-wrap: wrap; }
      .modal-action-trigger { margin-left: 0; width: 100%; }
      .action-dialog { width: calc(100vw - 16px); max-height: 92dvh; border-radius: 8px; }
      .action-dialog-head, .action-dialog > form.card { padding: 14px; }
    }
    @media print {
      .modal-action-trigger, .action-dialog { display: none !important; }
      .layout { display: block !important; }
      .layout > .preview { display: none !important; }
    }
  `;

  function addStyles() {
    if (document.getElementById('modal-actions-style')) return;
    const style = document.createElement('style');
    style.id = 'modal-actions-style';
    style.textContent = modalCss;
    document.head.appendChild(style);
  }

  function createDialog(layout, form, index) {
    const dialog = document.createElement('dialog');
    dialog.className = 'action-dialog';
    dialog.id = `action-dialog-${index}`;
    const header = document.createElement('div');
    header.className = 'action-dialog-head';
    const title = document.createElement('h2');
    title.id = `${dialog.id}-title`;
    title.textContent = 'Actions et paramètres';
    dialog.setAttribute('aria-labelledby', title.id);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'action-dialog-close';
    close.setAttribute('aria-label', 'Fermer la fenêtre');
    close.textContent = '×';
    close.addEventListener('click', () => dialog.close());
    header.append(title, close);
    dialog.appendChild(header);
    form.dataset.actionDialog = dialog.id;
    dialog.appendChild(form);
    document.body.appendChild(dialog);

    const open = () => {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    };
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    // La page Classes possède ses propres boutons explicites (« Ajouter une classe »
    // et « Ajouter des élèves ») : pas de bouton générique supplémentaire.
    if (layout.id !== 'view-classes') {
      const previewHead = layout.querySelector('.preview-head');
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'btn primary modal-action-trigger';
      trigger.textContent = 'Actions et paramètres';
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-controls', dialog.id);
      trigger.addEventListener('click', open);
      if (previewHead) previewHead.appendChild(trigger);
      else layout.prepend(trigger);
    }

    layout.querySelectorAll('.panel .card-head button').forEach((button) => {
      button.addEventListener('click', open);
    });
    window.addEventListener('hashchange', () => {
      if (dialog.open) dialog.close();
    });
  }

  function init() {
    addStyles();
    let index = 0;
    document.querySelectorAll('.layout').forEach((layout) => {
      Array.from(layout.querySelectorAll('.panel form.card'))
        .forEach((form) => createDialog(layout, form, ++index));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
