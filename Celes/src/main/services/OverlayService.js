const { BrowserWindow, screen } = require('electron');
const path = require('path');

class OverlayService {
  constructor() {
    this.overlayWindow = null;
    this.hideTimer = null;
  }

  createOverlayWindow() {
    if (this.overlayWindow) {
      return this.overlayWindow;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    this.overlayWindow = new BrowserWindow({
      width: 320,
      height: 80,
      x: screenWidth - 340, // 20px margin from right edge
      y: 20, // 20px from top
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      focusable: false,
      show: false,
      transparent: false,
      backgroundColor: '#000000',
      hasShadow: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../../overlay-preload.js')
      }
    });

    // Load the overlay HTML
    this.overlayWindow.loadFile(path.join(__dirname, '../../overlay/overlay.html'));

    // Handle window closed
    this.overlayWindow.on('closed', () => {
      this.overlayWindow = null;
      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }
    });

    // Prevent focus
    this.overlayWindow.on('focus', () => {
      this.overlayWindow.blur();
    });

    return this.overlayWindow;
  }

  async showSongNotification(songData) {
    if (!this.overlayWindow) {
      this.createOverlayWindow();
    }

    // Clear existing timer
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    // Send song data to overlay
    this.overlayWindow.webContents.send('show-song', songData);

    // Show the overlay with animation
    this.overlayWindow.show();
    this.overlayWindow.setOpacity(0);
    
    // Fade in animation
    let opacity = 0;
    const fadeIn = setInterval(() => {
      opacity += 0.1;
      if (opacity >= 1) {
        opacity = 1;
        clearInterval(fadeIn);
      }
      this.overlayWindow.setOpacity(opacity);
    }, 30);

    // Auto-hide after 4 seconds
    this.hideTimer = setTimeout(() => {
      this.hideOverlay();
    }, 4000);
  }

  hideOverlay() {
    if (!this.overlayWindow || !this.overlayWindow.isVisible()) {
      return;
    }

    // Clear timer
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    // Fade out animation
    let opacity = 1;
    const fadeOut = setInterval(() => {
      opacity -= 0.1;
      if (opacity <= 0) {
        opacity = 0;
        clearInterval(fadeOut);
        this.overlayWindow.hide();
      }
      this.overlayWindow.setOpacity(opacity);
    }, 30);
  }

  destroy() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    if (this.overlayWindow) {
      this.overlayWindow.close();
      this.overlayWindow = null;
    }
  }
}

module.exports = OverlayService;