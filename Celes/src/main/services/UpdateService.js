const { app, dialog, shell } = require('electron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class UpdateService {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.currentVersion = app.getVersion();
    this.updateCheckUrl = 'https://example.com/Celes/updates.json'; // Replace with your CDN URL
    this.lastCheckKey = 'lastUpdateCheck';
    this.skipVersionKey = 'skipVersion';
    this.checkInterval = 60 * 60 * 1000; // 1 hour
    this.reminderDelay = 7 * 24 * 60 * 60 * 1000; // 7 days before asking again
    
    this.updateTimer = null;
    this.isChecking = false;
  }

  // Initialize update service
  initialize() {
    // Check for updates on startup (after 30 seconds)
    setTimeout(() => {
      this.checkForUpdates(true);
    }, 30000);

    // Set up periodic checks
    this.startPeriodicChecks();
  }

  // Start periodic update checks
  startPeriodicChecks() {
    this.updateTimer = setInterval(() => {
      this.checkForUpdates(true);
    }, this.checkInterval);
  }

  // Stop periodic checks
  stopPeriodicChecks() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  // Check for updates
  async checkForUpdates(silent = false) {
    if (this.isChecking) return;
    
    try {
      this.isChecking = true;
      console.log('Checking for updates...');

      const updateInfo = await this.fetchUpdateInfo();
      
      if (!updateInfo) {
        if (!silent) {
          this.showNoUpdatesDialog();
        }
        return;
      }

      const hasUpdate = this.compareVersions(updateInfo.version, this.currentVersion) > 0;
      
      if (!hasUpdate) {
        if (!silent) {
          this.showNoUpdatesDialog();
        }
        return;
      }

      // Check if user previously skipped this version
      const settings = this.getSettings();
      const skipVersion = settings[this.skipVersionKey];
      const lastCheck = settings[this.lastCheckKey];
      const now = Date.now();

      if (skipVersion === updateInfo.version) {
        // Check if enough time has passed since skip
        if (lastCheck && (now - lastCheck) < this.reminderDelay) {
          console.log('Update available but user chose to skip, and not enough time passed');
          return;
        }
      }

      // Save last check time
      this.saveSettings({ ...settings, [this.lastCheckKey]: now });

      // Show update notification
      this.showUpdateNotification(updateInfo);

    } catch (error) {
      console.error('Error checking for updates:', error);
      if (!silent) {
        this.showUpdateError();
      }
    } finally {
      this.isChecking = false;
    }
  }

  // Fetch update information from CDN
  fetchUpdateInfo() {
    return new Promise((resolve, reject) => {
      const request = https.get(this.updateCheckUrl, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            const updateInfo = JSON.parse(data);
            resolve(updateInfo);
          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  // Compare version strings (semver-like)
  compareVersions(version1, version2) {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);
    
    const maxLength = Math.max(v1parts.length, v2parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;
      
      if (v1part > v2part) return 1;
      if (v1part < v2part) return -1;
    }
    
    return 0;
  }

  // Show update notification popup
  showUpdateNotification(updateInfo) {
    this.mainWindow.webContents.send('show-update-notification', {
      currentVersion: this.currentVersion,
      newVersion: updateInfo.version,
      releaseDate: updateInfo.releaseDate,
      changelog: updateInfo.changelog,
      downloadUrl: updateInfo.downloadUrl,
      size: updateInfo.size
    });
  }

  // Handle user's update decision
  async handleUpdateDecision(decision, updateInfo) {
    const settings = this.getSettings();

    switch (decision) {
      case 'install':
        await this.downloadAndInstallUpdate(updateInfo);
        break;
        
      case 'later':
        // Just close the notification, will check again next time
        console.log('User chose to update later');
        break;
        
      case 'skip':
        // Skip this version for a while
        this.saveSettings({
          ...settings,
          [this.skipVersionKey]: updateInfo.newVersion,
          [this.lastCheckKey]: Date.now()
        });
        console.log(`User chose to skip version ${updateInfo.newVersion}`);
        break;
    }
  }

  // Download and install update
  async downloadAndInstallUpdate(updateInfo) {
    try {
      console.log('Starting update download...');
      
      // Show download progress
      this.mainWindow.webContents.send('update-download-started');

      const downloadPath = await this.downloadUpdate(updateInfo.downloadUrl);
      
      // Show install prompt
      const result = await dialog.showMessageBox(this.mainWindow, {
        type: 'question',
        buttons: ['Install Now', 'Install on Next Restart', 'Cancel'],
        defaultId: 0,
        title: 'Update Downloaded',
        message: 'Celes update has been downloaded successfully.',
        detail: 'Would you like to install it now or on the next restart?'
      });

      if (result.response === 0) {
        // Install now
        this.installUpdate(downloadPath);
      } else if (result.response === 1) {
        // Install on restart
        this.scheduleUpdateOnRestart(downloadPath);
      }
      // Cancel = do nothing, delete download
      else {
        fs.unlinkSync(downloadPath);
      }

    } catch (error) {
      console.error('Error downloading update:', error);
      this.mainWindow.webContents.send('update-download-error', error.message);
    }
  }

  // Download update file
  downloadUpdate(downloadUrl) {
    return new Promise((resolve, reject) => {
      const fileName = `Celes-Update-${Date.now()}.exe`;
      const downloadPath = path.join(app.getPath('temp'), fileName);
      const file = fs.createWriteStream(downloadPath);

      const request = https.get(downloadUrl, (response) => {
        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;

        response.pipe(file);

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          const progress = Math.round((downloadedSize / totalSize) * 100);
          this.mainWindow.webContents.send('update-download-progress', {
            progress,
            downloadedSize,
            totalSize
          });
        });

        file.on('finish', () => {
          file.close();
          resolve(downloadPath);
        });
      });

      request.on('error', (error) => {
        fs.unlink(downloadPath, () => {}); // Delete partial file
        reject(error);
      });
    });
  }

  // Install update immediately
  installUpdate(updatePath) {
    console.log('Installing update:', updatePath);
    
    // Run the installer
    exec(`"${updatePath}" --force-run`, (error) => {
      if (error) {
        console.error('Error installing update:', error);
      }
    });

    // Close the current app
    setTimeout(() => {
      app.quit();
    }, 1000);
  }

  // Schedule update for next restart
  scheduleUpdateOnRestart(updatePath) {
    const settings = this.getSettings();
    this.saveSettings({
      ...settings,
      pendingUpdate: updatePath
    });

    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Scheduled',
      message: 'The update will be installed when you next restart Celes.',
      buttons: ['OK']
    });
  }

  // Check for pending updates on startup
  checkPendingUpdates() {
    const settings = this.getSettings();
    const pendingUpdate = settings.pendingUpdate;

    if (pendingUpdate && fs.existsSync(pendingUpdate)) {
      setTimeout(() => {
        this.installUpdate(pendingUpdate);
        // Clear the pending update
        const newSettings = { ...settings };
        delete newSettings.pendingUpdate;
        this.saveSettings(newSettings);
      }, 2000);
    }
  }

  // Show update history modal
  async showUpdateHistory() {
    try {
      const updateInfo = await this.fetchUpdateInfo();
      this.mainWindow.webContents.send('show-update-history', {
        currentVersion: this.currentVersion,
        history: updateInfo.history || []
      });
    } catch (error) {
      console.error('Error fetching update history:', error);
    }
  }

  // Dialog helpers
  showNoUpdatesDialog() {
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'No Updates Available',
      message: 'You are running the latest version of Celes.',
      detail: `Current version: ${this.currentVersion}`,
      buttons: ['OK']
    });
  }

  showUpdateError() {
    dialog.showMessageBox(this.mainWindow, {
      type: 'error',
      title: 'Update Check Failed',
      message: 'Unable to check for updates at this time.',
      detail: 'Please check your internet connection and try again later.',
      buttons: ['OK']
    });
  }

  // Settings helpers
  getSettings() {
    const settingsPath = path.join(app.getPath('userData'), 'update-settings.json');
    try {
      if (fs.existsSync(settingsPath)) {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      }
    } catch (error) {
      console.error('Error reading update settings:', error);
    }
    return {};
  }

  saveSettings(settings) {
    const settingsPath = path.join(app.getPath('userData'), 'update-settings.json');
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    } catch (error) {
      console.error('Error saving update settings:', error);
    }
  }

  // Cleanup
  destroy() {
    this.stopPeriodicChecks();
  }
}

module.exports = UpdateService;