class SettingsManager {
  constructor() {
    this.settingsModal = document.getElementById('settings-modal');
    this.settingsBtn = document.getElementById('settings-btn');
    this.closeSettingsBtn = document.getElementById('close-settings-btn');
    this.resetSettingsBtn = document.getElementById('reset-settings-btn');
    this.settingsModalClose = document.getElementById('settings-modal-close');
    
    this.defaultTheme = {
      primaryBg: '#000000',
      secondaryBg: '#0a0a0a',
      tertiaryBg: '#1a1a1a',
      primaryText: '#ffffff',
      secondaryText: '#888888',
      accentColor: '#667eea',
      borderColor: '#333333',
      borderLight: '#666666',
      hoverBg: '#2a2a2a',
      successColor: '#48bb78',
      errorColor: '#ff4444',
      warningColor: '#ed8936'
    };
    
    this.themes = {
      default: this.defaultTheme,
      'dark-blue': {
        primaryBg: '#0f172a',
        secondaryBg: '#1e293b',
        tertiaryBg: '#334155',
        primaryText: '#f8fafc',
        secondaryText: '#94a3b8',
        accentColor: '#3b82f6',
        borderColor: '#475569',
        borderLight: '#64748b',
        hoverBg: '#293548',
        successColor: '#10b981',
        errorColor: '#ef4444',
        warningColor: '#f59e0b'
      },
      purple: {
        primaryBg: '#1a0b2e',
        secondaryBg: '#16213e',
        tertiaryBg: '#533483',
        primaryText: '#edf2f7',
        secondaryText: '#a0aec0',
        accentColor: '#9f7aea',
        borderColor: '#553c9a',
        borderLight: '#7c3aed',
        hoverBg: '#2d1b69',
        successColor: '#68d391',
        errorColor: '#fc8181',
        warningColor: '#f6ad55'
      },
      'dark-pink': {
        primaryBg: '#2d1b2e',
        secondaryBg: '#3a1e3c',
        tertiaryBg: '#4a2c4a',
        primaryText: '#fdf2f8',
        secondaryText: '#d8b4fe',
        accentColor: '#ec4899',
        borderColor: '#7c2d60',
        borderLight: '#be185d',
        hoverBg: '#4c2649',
        successColor: '#34d399',
        errorColor: '#f87171',
        warningColor: '#fbbf24'
      },
      green: {
        primaryBg: '#0c1618',
        secondaryBg: '#1a202c',
        tertiaryBg: '#2d3748',
        primaryText: '#f7fafc',
        secondaryText: '#a0aec0',
        accentColor: '#48bb78',
        borderColor: '#4a5568',
        borderLight: '#68d391',
        hoverBg: '#2d4739',
        successColor: '#68d391',
        errorColor: '#fc8181',
        warningColor: '#f6ad55'
      },
      red: {
        primaryBg: '#1a0e0e',
        secondaryBg: '#2d1b1b',
        tertiaryBg: '#4a2c2c',
        primaryText: '#fed7d7',
        secondaryText: '#feb2b2',
        accentColor: '#f56565',
        borderColor: '#742a2a',
        borderLight: '#9b2c2c',
        hoverBg: '#3d2020',
        successColor: '#68d391',
        errorColor: '#fc8181',
        warningColor: '#f6ad55'
      }
    };
    
    this.currentTheme = { ...this.defaultTheme };
    this.isApplyingTheme = false; // Prevent recursion and lag
    
    // Audio settings
    this.audioSettings = {
      crossfadeEnabled: false,
      crossfadeDuration: 3 // seconds
    };

    // General settings
    this.generalSettings = {
      minimizeToTray: false,
      startMinimized: false
    };
    
    this.bindEvents();
    this.initializeColorInputs();
    this.initializeAudioSettings();
    this.initializeGeneralSettings();
    this.loadSettings();
  }

  bindEvents() {
    // Modal controls
    this.settingsBtn.addEventListener('click', () => this.showSettings());
    this.closeSettingsBtn.addEventListener('click', () => this.hideSettings());
    this.resetSettingsBtn.addEventListener('click', () => this.resetToDefault());
    this.settingsModalClose.addEventListener('click', () => this.hideSettings());
    
    // Tab switching
    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });
    
    // Preset theme buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.applyPresetTheme(e.target.dataset.theme));
    });
    
    // Modal outside click
    this.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.settingsModal) {
        this.hideSettings();
      }
    });
    
    // Update buttons
    const checkUpdatesBtn = document.getElementById('check-updates-btn');
    const showUpdateHistoryBtn = document.getElementById('show-update-history-btn');
    
    if (checkUpdatesBtn) {
      checkUpdatesBtn.addEventListener('click', () => {
        console.log('Manual update check requested');
        if (window.electronAPI && window.electronAPI.checkForUpdates) {
          window.electronAPI.checkForUpdates();
        }
      });
    }
    
    if (showUpdateHistoryBtn) {
      showUpdateHistoryBtn.addEventListener('click', () => {
        console.log('Update history requested');
        if (window.electronAPI && window.electronAPI.requestUpdateHistory) {
          window.electronAPI.requestUpdateHistory();
        }
      });
    }
  }

  initializeColorInputs() {
    // Color picker and text input synchronization with debouncing
    const colorInputs = [
      { color: 'primary-bg-color', text: 'primary-bg-text', property: 'primaryBg' },
      { color: 'accent-color-picker', text: 'accent-color-text', property: 'accentColor' },
      { color: 'text-color-picker', text: 'text-color-text', property: 'primaryText' },
      { color: 'border-color-picker', text: 'border-color-text', property: 'borderColor' }
    ];

    colorInputs.forEach(({ color, text, property }) => {
      const colorInput = document.getElementById(color);
      const textInput = document.getElementById(text);
      
      if (colorInput && textInput) {
        // Debounced update function
        let updateTimeout;
        const debouncedUpdate = (value) => {
          clearTimeout(updateTimeout);
          updateTimeout = setTimeout(() => {
            this.updateThemeProperty(property, value);
          }, 100); // 100ms debounce
        };

        colorInput.addEventListener('input', (e) => {
          if (this.isApplyingTheme) return; // Prevent recursion
          const value = e.target.value;
          textInput.value = value;
          debouncedUpdate(value);
        });
        
        textInput.addEventListener('input', (e) => {
          if (this.isApplyingTheme) return; // Prevent recursion
          const value = e.target.value;
          if (this.isValidHexColor(value)) {
            colorInput.value = value;
            debouncedUpdate(value);
          }
        });
      }
    });
  }

  initializeAudioSettings() {
    const crossfadeCheckbox = document.getElementById('crossfade-enabled');
    const crossfadeDurationSlider = document.getElementById('crossfade-duration');
    const crossfadeDurationValue = document.getElementById('crossfade-duration-value');
    const crossfadeDurationSetting = document.getElementById('crossfade-duration-setting');

    if (crossfadeCheckbox) {
      crossfadeCheckbox.addEventListener('change', (e) => {
        this.audioSettings.crossfadeEnabled = e.target.checked;
        crossfadeDurationSetting.style.display = e.target.checked ? 'block' : 'none';
        this.saveSettings();
        this.notifyCrossfadeChange();
      });
    }

    if (crossfadeDurationSlider && crossfadeDurationValue) {
      crossfadeDurationSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        this.audioSettings.crossfadeDuration = value;
        crossfadeDurationValue.textContent = `${value} second${value !== 1 ? 's' : ''}`;
        this.saveSettings();
        this.notifyCrossfadeChange();
      });
    }
  }

  notifyCrossfadeChange() {
    // Notify audio player about crossfade settings change
    if (window.audioPlayer && window.audioPlayer.updateCrossfadeSettings) {
      // Map the settings to match what AudioPlayer expects
      const crossfadeSettings = {
        enabled: this.audioSettings.crossfadeEnabled,
        duration: this.audioSettings.crossfadeDuration
      };
      window.audioPlayer.updateCrossfadeSettings(crossfadeSettings);
    }
  }

  isValidHexColor(hex) {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
  }

  updateThemeProperty(property, value) {
    if (this.isApplyingTheme) return; // Prevent infinite loops
    
    this.currentTheme[property] = value;
    this.calculateDerivedColors(); // Calculate secondary/tertiary colors
    this.applyTheme(this.currentTheme);
    this.saveSettings();
  }

  calculateDerivedColors() {
    // Auto-calculate secondary and tertiary backgrounds based on primary
    if (this.currentTheme.primaryBg) {
      this.currentTheme.secondaryBg = this.adjustBrightness(this.currentTheme.primaryBg, 4);
      this.currentTheme.tertiaryBg = this.adjustBrightness(this.currentTheme.primaryBg, 10);
      this.currentTheme.hoverBg = this.adjustBrightness(this.currentTheme.primaryBg, 16);
    }
    
    // Auto-calculate border colors based on tertiary background
    if (this.currentTheme.tertiaryBg) {
      this.currentTheme.borderColor = this.adjustBrightness(this.currentTheme.tertiaryBg, 10);
      this.currentTheme.borderLight = this.adjustBrightness(this.currentTheme.tertiaryBg, 20);
    }
  }

  applyTheme(theme) {
    if (this.isApplyingTheme) return; // Prevent recursion
    this.isApplyingTheme = true;
    
    const root = document.documentElement;
    
    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
      root.style.setProperty('--primary-bg', theme.primaryBg);
      root.style.setProperty('--secondary-bg', theme.secondaryBg);
      root.style.setProperty('--tertiary-bg', theme.tertiaryBg);
      root.style.setProperty('--primary-text', theme.primaryText);
      root.style.setProperty('--secondary-text', theme.secondaryText);
      root.style.setProperty('--accent-color', theme.accentColor);
      root.style.setProperty('--accent-hover', this.adjustBrightness(theme.accentColor, -10));
      root.style.setProperty('--border-color', theme.borderColor);
      root.style.setProperty('--border-light', theme.borderLight);
      root.style.setProperty('--hover-bg', theme.hoverBg);
      root.style.setProperty('--success-color', theme.successColor);
      root.style.setProperty('--error-color', theme.errorColor);
      root.style.setProperty('--warning-color', theme.warningColor);
      
      // Update derived colors
      root.style.setProperty('--progress-fill', theme.accentColor);
      root.style.setProperty('--slider-thumb', theme.accentColor);
      root.style.setProperty('--progress-bg', theme.tertiaryBg);
      root.style.setProperty('--slider-track', theme.tertiaryBg);
      
      this.isApplyingTheme = false;
    });
  }

  adjustBrightness(hex, percent) {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16).slice(1);
  }

  applyPresetTheme(themeName) {
    if (this.themes[themeName] && !this.isApplyingTheme) {
      this.isApplyingTheme = true;
      
      // Update theme instantly without debouncing
      this.currentTheme = { ...this.themes[themeName] };
      
      // Apply theme immediately
      const root = document.documentElement;
      root.style.setProperty('--primary-bg', this.currentTheme.primaryBg);
      root.style.setProperty('--secondary-bg', this.currentTheme.secondaryBg);
      root.style.setProperty('--tertiary-bg', this.currentTheme.tertiaryBg);
      root.style.setProperty('--primary-text', this.currentTheme.primaryText);
      root.style.setProperty('--secondary-text', this.currentTheme.secondaryText);
      root.style.setProperty('--accent-color', this.currentTheme.accentColor);
      root.style.setProperty('--accent-hover', this.adjustBrightness(this.currentTheme.accentColor, -10));
      root.style.setProperty('--border-color', this.currentTheme.borderColor);
      root.style.setProperty('--border-light', this.currentTheme.borderLight);
      root.style.setProperty('--hover-bg', this.currentTheme.hoverBg);
      root.style.setProperty('--success-color', this.currentTheme.successColor);
      root.style.setProperty('--error-color', this.currentTheme.errorColor);
      root.style.setProperty('--warning-color', this.currentTheme.warningColor);
      root.style.setProperty('--progress-fill', this.currentTheme.accentColor);
      root.style.setProperty('--slider-thumb', this.currentTheme.accentColor);
      root.style.setProperty('--progress-bg', this.currentTheme.tertiaryBg);
      root.style.setProperty('--slider-track', this.currentTheme.tertiaryBg);
      
      // Update inputs after a brief delay
      setTimeout(() => {
        this.updateColorInputsFromTheme();
        this.saveSettings();
        this.isApplyingTheme = false;
      }, 50);
    }
  }

  updateColorInputsFromTheme() {
    if (this.isApplyingTheme) return;
    
    const inputs = [
      { color: 'primary-bg-color', text: 'primary-bg-text', value: this.currentTheme.primaryBg },
      { color: 'accent-color-picker', text: 'accent-color-text', value: this.currentTheme.accentColor },
      { color: 'text-color-picker', text: 'text-color-text', value: this.currentTheme.primaryText },
      { color: 'border-color-picker', text: 'border-color-text', value: this.currentTheme.borderColor }
    ];

    inputs.forEach(({ color, text, value }) => {
      const colorInput = document.getElementById(color);
      const textInput = document.getElementById(text);
      if (colorInput && textInput && value) {
        colorInput.value = value;
        textInput.value = value;
      }
    });
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.settings-tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.querySelector(`[data-tab-content="${tabName}"]`).classList.add('active');
  }

  async showSettings() {
    this.settingsModal.classList.add('active');
    
    // Update app version display
    try {
      const versionInfo = await window.electronAPI.getAppVersion();
      const versionSpan = document.getElementById('app-version');
      if (versionSpan && versionInfo) {
        versionSpan.textContent = versionInfo.version;
      }
    } catch (error) {
      console.error('Error getting app version:', error);
    }
    
    // Initialize Lucide icons for the new elements
    if (typeof window.localIcons !== 'undefined') {
      window.localIcons.createIcons();
    }
  }

  hideSettings() {
    this.settingsModal.classList.remove('active');
  }

  resetToDefault() {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      this.currentTheme = { ...this.defaultTheme };
      this.applyTheme(this.currentTheme);
      this.updateColorInputsFromTheme();
      this.saveSettings();
    }
  }

  saveSettings() {
    const settings = {
      theme: this.currentTheme,
      audio: this.audioSettings,
      general: this.generalSettings,
      version: '1.0.0'
    };
    localStorage.setItem('music-player-settings', JSON.stringify(settings));
  }

  loadSettings() {
    try {
      const savedSettings = localStorage.getItem('music-player-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        
        // Load theme settings
        if (settings.theme) {
          this.currentTheme = { ...this.defaultTheme, ...settings.theme };
          this.applyTheme(this.currentTheme);
          this.updateColorInputsFromTheme();
        }
        
        // Load audio settings
        if (settings.audio) {
          this.audioSettings = { ...this.audioSettings, ...settings.audio };
          this.updateAudioInputsFromSettings();
        }

        // Load general settings
        if (settings.general) {
          this.generalSettings = { ...this.generalSettings, ...settings.general };
          this.updateGeneralInputsFromSettings();
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  updateAudioInputsFromSettings() {
    const crossfadeCheckbox = document.getElementById('crossfade-enabled');
    const crossfadeDurationSlider = document.getElementById('crossfade-duration');
    const crossfadeDurationValue = document.getElementById('crossfade-duration-value');
    const crossfadeDurationSetting = document.getElementById('crossfade-duration-setting');

    if (crossfadeCheckbox) {
      crossfadeCheckbox.checked = this.audioSettings.crossfadeEnabled;
      crossfadeDurationSetting.style.display = this.audioSettings.crossfadeEnabled ? 'block' : 'none';
    }

    if (crossfadeDurationSlider && crossfadeDurationValue) {
      crossfadeDurationSlider.value = this.audioSettings.crossfadeDuration;
      crossfadeDurationValue.textContent = `${this.audioSettings.crossfadeDuration} second${this.audioSettings.crossfadeDuration !== 1 ? 's' : ''}`;
    }
    
    // Notify audio player of loaded settings
    this.notifyCrossfadeChange();
  }

  updateGeneralInputsFromSettings() {
    const minimizeToTrayCheckbox = document.getElementById('minimize-to-tray');
    const startMinimizedCheckbox = document.getElementById('start-minimized');

    if (minimizeToTrayCheckbox) {
      minimizeToTrayCheckbox.checked = this.generalSettings.minimizeToTray;
    }

    if (startMinimizedCheckbox) {
      startMinimizedCheckbox.checked = this.generalSettings.startMinimized;
    }

    // Notify tray service of loaded settings
    this.notifyTraySettingsChange();
  }

  initializeGeneralSettings() {
    const minimizeToTrayCheckbox = document.getElementById('minimize-to-tray');
    const startMinimizedCheckbox = document.getElementById('start-minimized');

    if (minimizeToTrayCheckbox) {
      minimizeToTrayCheckbox.addEventListener('change', (e) => {
        this.generalSettings.minimizeToTray = e.target.checked;
        this.saveSettings();
        this.notifyTraySettingsChange();
      });
    }

    if (startMinimizedCheckbox) {
      startMinimizedCheckbox.addEventListener('change', (e) => {
        this.generalSettings.startMinimized = e.target.checked;
        this.saveSettings();
      });
    }

    // Listen for settings modal open from tray
    if (window.electronAPI && window.electronAPI.onOpenSettingsModal) {
      window.electronAPI.onOpenSettingsModal(() => {
        this.showSettings();
      });
    }
  }

  async notifyTraySettingsChange() {
    // Notify main process about tray settings change
    try {
      if (window.electronAPI && window.electronAPI.updateMinimizeToTray) {
        await window.electronAPI.updateMinimizeToTray(this.generalSettings.minimizeToTray);
      }
    } catch (error) {
      console.error('Error updating minimize to tray setting:', error);
    }
  }

  // Add streaming settings to the existing SettingsManager
  // This is a partial update to add streaming functionality

  constructor() {
    this.settings = {
      // ... existing settings ...
      
      // Streaming settings
      streaming: {
        fallbackEnabled: true,
        defaultPlatform: 'youtube',
        cacheEnabled: true,
        maxCacheSize: 100,
        rateLimitDelay: 1000
      }
    };
    
    this.loadSettings();
    this.initializeStreamingSettings();
  }

  initializeStreamingSettings() {
    // Initialize streaming settings if they don't exist
    if (!this.settings.streaming) {
      this.settings.streaming = {
        fallbackEnabled: true,
        defaultPlatform: 'youtube',
        cacheEnabled: true,
        maxCacheSize: 100,
        rateLimitDelay: 1000
      };
    }
  }

  async loadStreamingSettings() {
    try {
      // Load fallback setting from main process
      const fallbackEnabled = await window.electronAPI.getFallbackEnabled();
      this.settings.streaming.fallbackEnabled = fallbackEnabled;
    } catch (error) {
      console.error('Error loading streaming settings:', error);
    }
  }

  async saveStreamingSettings() {
    try {
      // Save fallback setting to main process
      await window.electronAPI.setFallbackEnabled(this.settings.streaming.fallbackEnabled);
    } catch (error) {
      console.error('Error saving streaming settings:', error);
    }
  }

  createStreamingSettingsUI() {
    return `
      <div class="settings-section">
        <h3>Streaming Settings</h3>
        
        <div class="setting-item">
          <label for="fallback-enabled">
            <input type="checkbox" id="fallback-enabled" ${this.settings.streaming.fallbackEnabled ? 'checked' : ''}>
            Enable SoundCloud Fallback
          </label>
          <p class="setting-description">
            Automatically try SoundCloud when YouTube streams fail
          </p>
        </div>
        
        <div class="setting-item">
          <label for="default-platform">Default Platform:</label>
          <select id="default-platform">
            <option value="youtube" ${this.settings.streaming.defaultPlatform === 'youtube' ? 'selected' : ''}>YouTube</option>
            <option value="soundcloud" ${this.settings.streaming.defaultPlatform === 'soundcloud' ? 'selected' : ''}>SoundCloud</option>
          </select>
          <p class="setting-description">
            Primary platform for music searches
          </p>
        </div>
        
        <div class="setting-item">
          <label for="cache-enabled">
            <input type="checkbox" id="cache-enabled" ${this.settings.streaming.cacheEnabled ? 'checked' : ''}>
            Enable Streaming Cache
          </label>
          <p class="setting-description">
            Cache stream URLs for faster playback
          </p>
        </div>
        
        <div class="setting-item">
          <label for="max-cache-size">Max Cache Size:</label>
          <input type="number" id="max-cache-size" value="${this.settings.streaming.maxCacheSize}" min="10" max="1000">
          <p class="setting-description">
            Maximum number of cached streams
          </p>
        </div>
        
        <div class="setting-item">
          <button id="clear-streaming-cache" class="btn btn-secondary">
            Clear Streaming Cache
          </button>
          <p class="setting-description">
            Clear all cached stream URLs
          </p>
        </div>
        
        <div class="setting-item">
          <button id="streaming-health-check" class="btn btn-secondary">
            Check Streaming Health
          </button>
          <p class="setting-description">
            Test streaming functionality
          </p>
        </div>
      </div>
    `;
  }

  setupStreamingSettingsListeners() {
    // Fallback enabled toggle
    const fallbackEnabled = document.getElementById('fallback-enabled');
    if (fallbackEnabled) {
      fallbackEnabled.addEventListener('change', async (e) => {
        this.settings.streaming.fallbackEnabled = e.target.checked;
        await this.saveStreamingSettings();
        this.showNotification(`Fallback ${e.target.checked ? 'enabled' : 'disabled'}`, 'success');
      });
    }

    // Default platform selector
    const defaultPlatform = document.getElementById('default-platform');
    if (defaultPlatform) {
      defaultPlatform.addEventListener('change', (e) => {
        this.settings.streaming.defaultPlatform = e.target.value;
        this.saveSettings();
        this.showNotification(`Default platform set to ${e.target.value}`, 'success');
      });
    }

    // Cache enabled toggle
    const cacheEnabled = document.getElementById('cache-enabled');
    if (cacheEnabled) {
      cacheEnabled.addEventListener('change', (e) => {
        this.settings.streaming.cacheEnabled = e.target.checked;
        this.saveSettings();
        this.showNotification(`Cache ${e.target.checked ? 'enabled' : 'disabled'}`, 'success');
      });
    }

    // Max cache size input
    const maxCacheSize = document.getElementById('max-cache-size');
    if (maxCacheSize) {
      maxCacheSize.addEventListener('change', (e) => {
        this.settings.streaming.maxCacheSize = parseInt(e.target.value);
        this.saveSettings();
        this.showNotification(`Max cache size set to ${e.target.value}`, 'success');
      });
    }

    // Clear streaming cache button
    const clearStreamingCache = document.getElementById('clear-streaming-cache');
    if (clearStreamingCache) {
      clearStreamingCache.addEventListener('click', async () => {
        try {
          const result = await window.electronAPI.clearStreamingCache();
          if (result.success) {
            this.showNotification('Streaming cache cleared', 'success');
          } else {
            this.showNotification('Failed to clear cache', 'error');
          }
        } catch (error) {
          console.error('Error clearing streaming cache:', error);
          this.showNotification('Error clearing cache', 'error');
        }
      });
    }

    // Streaming health check button
    const streamingHealthCheck = document.getElementById('streaming-health-check');
    if (streamingHealthCheck) {
      streamingHealthCheck.addEventListener('click', async () => {
        try {
          const health = await window.electronAPI.streamingHealthCheck();
          if (health.healthy) {
            this.showNotification('Streaming is healthy', 'success');
          } else {
            this.showNotification(`Streaming issues: ${health.message}`, 'error');
          }
        } catch (error) {
          console.error('Error checking streaming health:', error);
          this.showNotification('Error checking health', 'error');
        }
      });
    }
  }

  async getStreamingStats() {
    try {
      const stats = await window.electronAPI.getStreamingStats();
      return {
        streamCacheSize: stats.streamCacheSize,
        searchCacheSize: stats.searchCacheSize,
        currentRateLimit: stats.currentRateLimit,
        queueLength: stats.queueLength,
        isProcessingQueue: stats.isProcessingQueue
      };
    } catch (error) {
      console.error('Error getting streaming stats:', error);
      return null;
    }
  }

  showNotification(message, type = 'info') {
    // Implementation depends on your notification system
    console.log(`${type.toUpperCase()}: ${message}`);
  }
}

// Make it globally available
window.SettingsManager = SettingsManager;