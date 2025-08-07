const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

class TrayService {
  constructor(mainWindow, settingsManager) {
    this.mainWindow = mainWindow;
    this.settingsManager = settingsManager;
    this.tray = null;
    this.isMinimizeToTrayEnabled = false;
  }

  createTray() {
    // Create a simple music note icon for the tray
    const iconData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAE/SURBVDiNpZM9SwNBEIafgwQLwcJCG1sLwcJCsVGwsLGwsLaxsLBQsLCwsLGwsLCwsLGwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsARUAAAtNJSUhZUgAAAABJRU5ErkJggg==';
    const icon = nativeImage.createFromDataURL(iconData);
    
    this.tray = new Tray(icon);
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Music Player',
        click: () => {
          this.showWindow();
        }
      },
      {
        label: 'Hide Music Player',
        click: () => {
          this.hideWindow();
        }
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => {
          this.showWindow();
          // Send event to renderer to open settings
          this.mainWindow.webContents.send('open-settings-modal');
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          this.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
    this.tray.setToolTip('Music Player');
    
    // Double-click to show/hide window
    this.tray.on('double-click', () => {
      if (this.mainWindow.isVisible()) {
        this.hideWindow();
      } else {
        this.showWindow();
      }
    });
  }

  updateMinimizeToTrayEnabled(enabled) {
    this.isMinimizeToTrayEnabled = enabled;
    
    if (enabled && !this.tray) {
      this.createTray();
    } else if (!enabled && this.tray) {
      this.destroyTray();
    }
  }

  showWindow() {
    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  hideWindow() {
    if (this.mainWindow) {
      this.mainWindow.hide();
    }
  }

  handleWindowClose(event) {
    if (this.isMinimizeToTrayEnabled && this.tray) {
      event.preventDefault();
      this.hideWindow();
      return false; // Prevent default close behavior
    }
    return true; // Allow default close behavior
  }

  destroyTray() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  quit() {
    this.destroyTray();
    require('electron').app.quit();
  }
}

module.exports = TrayService;