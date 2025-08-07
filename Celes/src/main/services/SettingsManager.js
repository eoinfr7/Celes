const fs = require('fs');
const path = require('path');
const os = require('os');

class SettingsManager {
  constructor() {
    this.settingsPath = path.join(os.homedir(), '.music-player-settings.json');
  }

  loadSettings() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
        return settings;
      }
      return {};
    } catch (error) {
      console.error('Error loading settings:', error);
      return {};
    }
  }

  saveSettings(settings) {
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  }

  getSettingsPath() {
    return this.settingsPath;
  }
}

module.exports = SettingsManager;