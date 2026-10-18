/* Gestion du stockage local avec File System Access API */
(() => {
  'use strict';

  const { $, setStatus } = PT;

  let dataDirHandle = null;
  const DATA_DIR_NAME = 'Pointage Scolaire';

  // Vérifier si la File System Access API est disponible
  function isSupported() {
    return 'showDirectoryPicker' in window;
  }

  // Sélectionner ou créer le dossier de données
  async function selectDataDirectory() {
    if (!isSupported()) {
      alert('Votre navigateur ne supporte pas l\'accès au système de fichiers. Veuillez utiliser Chrome, Edge ou Opera.');
      return false;
    }

    try {
      dataDirHandle = await window.showDirectoryPicker({
        id: 'pointage-scolaire-data',
        mode: 'readwrite',
        startIn: 'documents'
      });
      setStatus('storage-status', `Dossier sélectionné : ${dataDirHandle.name}`, 'ok');
      return true;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Erreur lors de la sélection du dossier:', err);
        setStatus('storage-status', 'Erreur lors de la sélection du dossier', 'bad');
      }
      return false;
    }
  }

  // Créer automatiquement le dossier de données
  async function createDataDirectory() {
    if (!isSupported()) {
      return false;
    }

    try {
      // Essayer de créer le dossier dans Documents
      const rootHandle = await navigator.storage.getDirectory();
      dataDirHandle = await rootHandle.getDirectoryHandle(DATA_DIR_NAME, { create: true });
      setStatus('storage-status', `Dossier créé : ${DATA_DIR_NAME}`, 'ok');
      return true;
    } catch (err) {
      console.error('Erreur lors de la création du dossier:', err);
      setStatus('storage-status', 'Erreur lors de la création du dossier', 'bad');
      return false;
    }
  }

  // Sauvegarder un fichier dans le dossier de données
  async function saveFile(filename, content) {
    if (!dataDirHandle) {
      console.warn('Aucun dossier de données sélectionné');
      return false;
    }

    try {
      const fileHandle = await dataDirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      console.log(`Fichier ${filename} sauvegardé avec succès`);
      return true;
    } catch (err) {
      console.error(`Erreur lors de la sauvegarde de ${filename}:`, err);
      return false;
    }
  }

  // Lire un fichier depuis le dossier de données
  async function readFile(filename) {
    if (!dataDirHandle) {
      console.warn('Aucun dossier de données sélectionné');
      return null;
    }

    try {
      const fileHandle = await dataDirHandle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      const content = await file.text();
      return content;
    } catch (err) {
      if (err.name === 'NotFoundError') {
        console.log(`Fichier ${filename} non trouvé`);
        return null;
      }
      console.error(`Erreur lors de la lecture de ${filename}:`, err);
      return null;
    }
  }

  // Lister tous les fichiers dans le dossier de données
  async function listFiles() {
    if (!dataDirHandle) {
      return [];
    }

    try {
      const files = [];
      for await (const entry of dataDirHandle.values()) {
        if (entry.kind === 'file') {
          files.push(entry.name);
        }
      }
      return files;
    } catch (err) {
      console.error('Erreur lors de la liste des fichiers:', err);
      return [];
    }
  }

  // Supprimer un fichier
  async function deleteFile(filename) {
    if (!dataDirHandle) {
      return false;
    }

    try {
      await dataDirHandle.removeEntry(filename);
      console.log(`Fichier ${filename} supprimé`);
      return true;
    } catch (err) {
      console.error(`Erreur lors de la suppression de ${filename}:`, err);
      return false;
    }
  }

  // Sauvegarder toutes les données de l'application
  async function saveAllData() {
    if (!dataDirHandle) {
      setStatus('storage-status', 'Sélectionnez d\'abord un dossier de données', 'bad');
      return false;
    }

    const keys = [
      'classes-centrales.v1',
      'pointage-eleves.v1',
      'pointage-enseignants.v1',
      'billets-eleves.v1',
      'exclusions-eleves.v1'
    ];

    let successCount = 0;
    for (const key of keys) {
      const data = localStorage.getItem(key);
      if (data) {
        const filename = key.replace('.v1', '.json');
        if (await saveFile(filename, data)) {
          successCount++;
        }
      }
    }

    setStatus('storage-status', `${successCount}/${keys.length} fichiers sauvegardés`, successCount === keys.length ? 'ok' : 'bad');
    return successCount === keys.length;
  }

  // Restaurer toutes les données depuis le dossier
  async function restoreAllData() {
    if (!dataDirHandle) {
      setStatus('storage-status', 'Sélectionnez d\'abord un dossier de données', 'bad');
      return false;
    }

    const files = await listFiles();
    let successCount = 0;

    for (const filename of files) {
      const content = await readFile(filename);
      if (content) {
        try {
          const data = JSON.parse(content);
          const key = filename.replace('.json', '.v1');
          localStorage.setItem(key, JSON.stringify(data));
          successCount++;
        } catch (err) {
          console.error(`Erreur lors de la lecture de ${filename}:`, err);
        }
      }
    }

    setStatus('storage-status', `${successCount}/${files.length} fichiers restaurés`, successCount === files.length ? 'ok' : 'bad');
    
    // Recharger la page pour appliquer les changements
    if (successCount > 0) {
      setTimeout(() => location.reload(), 1000);
    }
    
    return successCount > 0;
  }

  // Exporter l'API de stockage
  PT.storage = {
    isSupported,
    selectDataDirectory,
    createDataDirectory,
    saveFile,
    readFile,
    listFiles,
    deleteFile,
    saveAllData,
    restoreAllData,
    get dataDirHandle() { return dataDirHandle; }
  };

  // Ajouter des boutons de gestion du stockage sur l'accueil
  function addStorageButtons() {
    const homeInner = document.querySelector('.home-inner');
    if (!homeInner) return;

    const storageSection = document.createElement('section');
    storageSection.className = 'card';
    storageSection.style.marginTop = '30px';
    storageSection.innerHTML = `
      <div class="card-head">
        <h2>Stockage des données</h2>
      </div>
      <p class="hint">Sauvegardez vos données dans un dossier sur votre ordinateur pour les conevenir en sécurité.</p>
      <div class="row-btns">
        <button type="button" id="storage-select-dir" class="btn">Sélectionner un dossier</button>
        <button type="button" id="storage-save-all" class="btn primary" disabled>Sauvegarder tout</button>
        <button type="button" id="storage-restore-all" class="btn" disabled>Restaurer tout</button>
      </div>
      <p id="storage-status" class="saved" role="status"></p>
    `;

    homeInner.appendChild(storageSection);

    // Event listeners
    document.getElementById('storage-select-dir').addEventListener('click', async () => {
      const success = await selectDataDirectory();
      if (success) {
        document.getElementById('storage-save-all').disabled = false;
        document.getElementById('storage-restore-all').disabled = false;
      }
    });

    document.getElementById('storage-save-all').addEventListener('click', saveAllData);
    document.getElementById('storage-restore-all').addEventListener('click', restoreAllData);
  }

  // Initialiser quand le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addStorageButtons);
  } else {
    addStorageButtons();
  }
})();
