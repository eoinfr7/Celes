class UpdateManager {
  constructor() {
    this.initializeElements();
    this.bindEvents();
    this.setupIpcListeners();
  }

  initializeElements() {
    // Update notification elements
    this.updateNotification = document.getElementById('update-notification');
    this.updateVersion = document.getElementById('update-version');
    this.updateDate = document.getElementById('update-date');
    this.updateSize = document.getElementById('update-size');
    this.updateSummary = document.getElementById('update-summary');
    
    // Button elements
    this.closeUpdateBtn = document.getElementById('close-update-btn');
    this.updateLaterBtn = document.getElementById('update-later-btn');
    this.updateSkipBtn = document.getElementById('update-skip-btn');
    this.updateInstallBtn = document.getElementById('update-install-btn');
    this.updateHistoryBtn = document.getElementById('update-history-btn');
    
    // History modal elements
    this.updateHistoryModal = document.getElementById('update-history-modal');
    this.closeHistoryModalBtn = document.getElementById('close-history-modal-btn');
    this.currentVersionNumber = document.getElementById('current-version-number');
    this.versionHistory = document.getElementById('version-history');
    
    // Progress elements
    this.updateProgress = document.getElementById('update-progress');
    this.progressText = document.getElementById('progress-text');
    this.downloadProgressBar = document.getElementById('download-progress-bar');
    
    this.currentUpdateInfo = null;
  }

  bindEvents() {
    // Update notification events
    this.closeUpdateBtn.addEventListener('click', () => this.hideUpdateNotification());
    this.updateLaterBtn.addEventListener('click', () => this.handleUpdateDecision('later'));
    this.updateSkipBtn.addEventListener('click', () => this.handleUpdateDecision('skip'));
    this.updateInstallBtn.addEventListener('click', () => this.handleUpdateDecision('install'));
    this.updateHistoryBtn.addEventListener('click', () => this.showUpdateHistory());
    
    // History modal events
    this.closeHistoryModalBtn.addEventListener('click', () => this.hideUpdateHistory());
    
    // Close modal when clicking outside
    this.updateHistoryModal.addEventListener('click', (e) => {
      if (e.target === this.updateHistoryModal) {
        this.hideUpdateHistory();
      }
    });
    
    // Close notification when clicking outside
    document.addEventListener('click', (e) => {
      if (this.updateNotification.classList.contains('show') && 
          !this.updateNotification.contains(e.target)) {
        // Don't auto-close, let user decide
      }
    });
  }

  setupIpcListeners() {
    // Listen for update notifications from main process
    window.electronAPI.onUpdateNotification((event, updateInfo) => {
      this.showUpdateNotification(updateInfo);
    });
    
    // Listen for update history
    window.electronAPI.onUpdateHistory((event, historyData) => {
      this.displayUpdateHistory(historyData);
    });
    
    // Listen for download progress
    window.electronAPI.onUpdateDownloadProgress((event, progressData) => {
      this.updateDownloadProgress(progressData);
    });
    
    // Listen for download started
    window.electronAPI.onUpdateDownloadStarted(() => {
      this.showDownloadProgress();
    });
    
    // Listen for download error
    window.electronAPI.onUpdateDownloadError((event, error) => {
      this.showDownloadError(error);
    });
  }

  showUpdateNotification(updateInfo) {
    this.currentUpdateInfo = updateInfo;
    
    // Update notification content
    this.updateVersion.textContent = updateInfo.newVersion;
    this.updateDate.textContent = this.formatDate(updateInfo.releaseDate);
    this.updateSize.textContent = this.formatFileSize(updateInfo.size);
    this.updateSummary.textContent = updateInfo.changelog.summary || 'New features and improvements';
    
    // Show notification with animation
    this.updateNotification.classList.add('show');
    
    // Auto-hide after 30 seconds if no interaction
    setTimeout(() => {
      if (this.updateNotification.classList.contains('show')) {
        this.hideUpdateNotification();
      }
    }, 30000);
  }

  hideUpdateNotification() {
    this.updateNotification.classList.remove('show');
    this.currentUpdateInfo = null;
  }

  handleUpdateDecision(decision) {
    if (!this.currentUpdateInfo) return;
    
    // Send decision to main process
    window.electronAPI.handleUpdateDecision(decision, this.currentUpdateInfo);
    
    // Hide notification
    this.hideUpdateNotification();
    
    // Show feedback based on decision
    if (decision === 'later') {
      this.showUpdateMessage('Update postponed', 'We\'ll remind you again later.');
    } else if (decision === 'skip') {
      this.showUpdateMessage('Update skipped', 'We won\'t ask about this version for a while.');
    }
  }

  showUpdateHistory() {
    // Request history from main process
    window.electronAPI.requestUpdateHistory();
  }

  hideUpdateHistory() {
    this.updateHistoryModal.classList.remove('show');
  }

  displayUpdateHistory(historyData) {
    // Update current version
    this.currentVersionNumber.textContent = `v${historyData.currentVersion}`;
    
    // Clear and populate history
    this.versionHistory.innerHTML = '';
    
    if (historyData.history && historyData.history.length > 0) {
      historyData.history.forEach(version => {
        const versionElement = this.createVersionElement(version);
        this.versionHistory.appendChild(versionElement);
      });
    } else {
      this.versionHistory.innerHTML = `
        <div class="version-item">
          <div class="version-info">
            <p style="text-align: center; color: var(--secondary-text);">
              No update history available
            </p>
          </div>
        </div>
      `;
    }
    
    // Show modal
    this.updateHistoryModal.classList.add('show');
    
    // Re-initialize icons
    if (typeof window.localIcons !== 'undefined') {
      window.localIcons.createIcons();
    }
  }

  createVersionElement(version) {
    const element = document.createElement('div');
    element.className = 'version-item';
    
    const changesHtml = version.changes ? 
      `<ul>${version.changes.map(change => `<li>${change}</li>`).join('')}</ul>` : 
      '<p>No changes listed</p>';
    
    element.innerHTML = `
      <div class="version-header">
        <div class="version-number">v${version.version}</div>
        <div class="version-date">${this.formatDate(version.releaseDate)}</div>
      </div>
      <div class="version-changes">
        <p><strong>${version.title || 'Update'}</strong></p>
        ${changesHtml}
      </div>
    `;
    
    return element;
  }

  showDownloadProgress() {
    this.updateProgress.classList.add('show');
    this.progressText.textContent = 'Starting download...';
    this.downloadProgressBar.style.width = '0%';
  }

  updateDownloadProgress(progressData) {
    if (!this.updateProgress.classList.contains('show')) {
      this.showDownloadProgress();
    }
    
    this.downloadProgressBar.style.width = `${progressData.progress}%`;
    this.progressText.textContent = 
      `${progressData.progress}% - ${this.formatFileSize(progressData.downloadedSize)} of ${this.formatFileSize(progressData.totalSize)}`;
  }

  showDownloadError(error) {
    this.hideDownloadProgress();
    this.showUpdateMessage('Download Failed', `Failed to download update: ${error}`);
  }

  hideDownloadProgress() {
    this.updateProgress.classList.remove('show');
  }

  showUpdateMessage(title, message) {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.className = 'update-notification show';
    notification.style.top = '120px'; // Below the main update notification
    
    notification.innerHTML = `
      <div class="update-header">
        <div class="update-icon">
          <i data-lucide="info"></i>
        </div>
        <div class="update-title">
          <h4>${title}</h4>
          <p>${message}</p>
        </div>
        <button class="update-close-btn" onclick="this.parentElement.parentElement.remove()">
          <i data-lucide="x"></i>
        </button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Re-initialize icons
    if (typeof window.localIcons !== 'undefined') {
      window.localIcons.createIcons();
    }
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  // Utility methods
  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  // Public methods for manual checks
  checkForUpdates() {
    window.electronAPI.checkForUpdates();
  }

  showHistory() {
    this.showUpdateHistory();
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UpdateManager;
} else {
  window.UpdateManager = UpdateManager;
}