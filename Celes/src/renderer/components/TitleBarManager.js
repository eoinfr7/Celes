class TitleBarManager {
  constructor() {
    this.isMaximized = false;
    this.bindEvents();
    this.initializeState();
  }

  bindEvents() {
    // Window control buttons
    const minimizeBtn = document.getElementById('minimize-btn');
    const maximizeBtn = document.getElementById('maximize-btn');
    const closeBtn = document.getElementById('close-btn');

    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => this.minimizeWindow());
    }

    if (maximizeBtn) {
      maximizeBtn.addEventListener('click', () => this.toggleMaximize());
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeWindow());
    }

    // Double-click on drag region to maximize/restore
    const dragRegion = document.querySelector('.title-bar-drag-region');
    if (dragRegion) {
      dragRegion.addEventListener('dblclick', () => this.toggleMaximize());
    }
  }

  async initializeState() {
    // Check if window is already maximized
    try {
      this.isMaximized = await window.electronAPI.windowIsMaximized();
      this.updateMaximizeButton();
    } catch (error) {
      console.error('Error checking window maximized state:', error);
    }
  }

  async minimizeWindow() {
    try {
      await window.electronAPI.windowMinimize();
    } catch (error) {
      console.error('Error minimizing window:', error);
    }
  }

  async toggleMaximize() {
    try {
      this.isMaximized = await window.electronAPI.windowMaximize();
      this.updateMaximizeButton();
    } catch (error) {
      console.error('Error toggling window maximize:', error);
    }
  }

  async closeWindow() {
    try {
      await window.electronAPI.windowClose();
    } catch (error) {
      console.error('Error closing window:', error);
    }
  }

  updateMaximizeButton() {
    const maximizeBtn = document.getElementById('maximize-btn');
    const icon = maximizeBtn?.querySelector('i');
    
    if (icon) {
      if (this.isMaximized) {
        // Show restore icon
        if (typeof window.localIcons !== 'undefined') {
          window.localIcons.setIcon(icon, 'copy');
        } else {
          icon.setAttribute('data-lucide', 'copy');
        }
        maximizeBtn.title = 'Restore';
      } else {
        // Show maximize icon
        if (typeof window.localIcons !== 'undefined') {
          window.localIcons.setIcon(icon, 'square');
        } else {
          icon.setAttribute('data-lucide', 'square');
        }
        maximizeBtn.title = 'Maximize';
      }
    }
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TitleBarManager;
} else {
  window.TitleBarManager = TitleBarManager;
}