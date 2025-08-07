class FolderManager {
  constructor(foldersModal, watchedFoldersList, notificationService) {
    this.foldersModal = foldersModal;
    this.watchedFoldersList = watchedFoldersList;
    this.notificationService = notificationService;
    
    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('folders-modal-close').addEventListener('click', () => this.hideFoldersModal());
    document.getElementById('close-folders-btn').addEventListener('click', () => this.hideFoldersModal());
    document.getElementById('add-folder-from-modal-btn').addEventListener('click', () => this.showFolderDialog());
    
    
    this.foldersModal.addEventListener('click', (e) => {
      if (e.target === this.foldersModal) {
        this.hideFoldersModal();
      }
    });
  }

  async showFolderDialog() {
    try {
      const result = await window.electronAPI.showFolderDialog();
      if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        await this.addWatchedFolder(folderPath);
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
      this.notificationService.showNotification('Error selecting folder', 'error');
    }
  }

  async addWatchedFolder(folderPath) {
    try {
      this.notificationService.showNotification('Scanning folder...', 'info');
      
      const result = await window.electronAPI.addWatchedFolder(folderPath);
      if (result.success) {
        this.notificationService.showNotification(`Started watching folder: ${folderPath}`, 'success');
        await window.musicPlayer.loadData();
        this.renderWatchedFolders();
      } else {
        this.notificationService.showNotification(`Error: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error adding watched folder:', error);
      this.notificationService.showNotification('Error adding watched folder', 'error');
    }
  }

  async removeWatchedFolder(folderPath) {
    try {
      const result = await window.electronAPI.removeWatchedFolder(folderPath);
      if (result.success) {
        this.notificationService.showNotification(`Stopped watching folder: ${folderPath}`, 'info');
        this.renderWatchedFolders();
      } else {
        this.notificationService.showNotification(`Error: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error removing watched folder:', error);
      this.notificationService.showNotification('Error removing watched folder', 'error');
    }
  }

  async showFoldersModal() {
    this.foldersModal.classList.add('active');
    await this.renderWatchedFolders();
  }

  hideFoldersModal() {
    this.foldersModal.classList.remove('active');
  }

  async renderWatchedFolders() {
    try {
      const watchedFolders = await window.electronAPI.getWatchedFolders();
      
      if (watchedFolders.length === 0) {
        this.watchedFoldersList.innerHTML = `
          <div class="empty-folders">
            <div class="empty-folders-icon"></div>
            <h4>No folders being watched</h4>
            <p>Click "Add Folder" to start monitoring a music folder</p>
          </div>
        `;
        return;
      }

      this.watchedFoldersList.innerHTML = watchedFolders.map((folder, index) => `
        <div class="folder-item">
          <div class="folder-path" title="${folder}">${folder}</div>
          <div class="folder-actions">
            <button class="btn btn-icon btn-secondary" data-folder-index="${index}" data-action="scan" title="Rescan">
              <i data-lucide="refresh-ccw"></i>
            </button>
            <button class="btn btn-icon btn-danger" data-folder-index="${index}" data-action="remove" title="Remove">
              <i data-lucide="x"></i>
            </button>
          </div>
        </div>
      `).join('');
      
      // Initialize Lucide icons for the new elements
      if (typeof window.localIcons !== 'undefined') {
        window.localIcons.createIcons();
      }
      
      // Add event listeners for the action buttons
      this.watchedFoldersList.querySelectorAll('button[data-action]').forEach(button => {
        button.addEventListener('click', (e) => {
          const folderIndex = parseInt(e.target.closest('button').dataset.folderIndex);
          const action = e.target.closest('button').dataset.action;
          const folderPath = watchedFolders[folderIndex];
          
          if (action === 'scan') {
            this.scanFolder(folderPath);
          } else if (action === 'remove') {
            this.removeWatchedFolder(folderPath);
          }
        });
      });
    } catch (error) {
      console.error('Error loading watched folders:', error);
      this.notificationService.showNotification('Error loading watched folders', 'error');
    }
  }

  async scanFolder(folderPath) {
    try {
      this.notificationService.showNotification('Scanning folder...', 'info');
      const result = await window.electronAPI.scanFolder(folderPath);
      
      if (result.success) {
        const message = `Scan complete: ${result.added} songs added${result.errors > 0 ? `, ${result.errors} errors` : ''}`;
        this.notificationService.showNotification(message, 'success');
        await window.musicPlayer.loadData();
      } else {
        this.notificationService.showNotification(`Scan error: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error scanning folder:', error);
      this.notificationService.showNotification('Error scanning folder', 'error');
    }
  }

}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FolderManager;
} else {
  window.FolderManager = FolderManager;
}