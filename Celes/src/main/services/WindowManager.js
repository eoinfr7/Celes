const { app, BrowserWindow } = require('electron');
const path = require('path');

class WindowManager {
  constructor() {
    this.mainWindow = null;
    this.miniWindow = null;
  }

  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'Celes',
      icon: path.join(__dirname, '..', '..', '..', 'assets', 'icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '..', '..', '..', 'preload.js'),
        zoomFactor: 1.0
      },
      frame: false,
      titleBarStyle: 'hidden',
      show: false
    });

    const isDev = process.argv.includes('--development') || !app.isPackaged;
    if (isDev) {
      // Resolve Vite dev server dynamically (handles port auto-increment)
      this.resolveAndLoadDevServer();
    } else {
      const indexPath = path.join(__dirname, '..', '..', '..', 'app', 'dist', 'index.html');
      this.mainWindow.loadFile(indexPath);
    }
    
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      try {
        // Enforce zoom level at 0 for visual/layout and disable pinch zoom at the WebContents level
        this.mainWindow.webContents.setZoomFactor(1)
        this.mainWindow.webContents.setVisualZoomLevelLimits(1,1)
        this.mainWindow.webContents.setZoomLevel(0)
      } catch {}
    });

    // Open dev tools in development or for debugging production issues
    if (process.argv.includes('--development') || process.argv.includes('--debug')) {
      this.mainWindow.webContents.openDevTools();
    }

    return this.mainWindow;
  }

  async resolveAndLoadDevServer() {
    try {
      const defaultUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
      let urlObj;
      try { urlObj = new URL(defaultUrl); } catch { urlObj = new URL('http://localhost:5173'); }
      const startPort = Number(urlObj.port || 5173) || 5173;
      const candidates = [];
      for (let p = startPort; p < startPort + 11; p++) {
        candidates.push(`http://localhost:${p}`);
      }
      const resolved = await this.findFirstAlive(candidates);
      const toLoad = resolved || defaultUrl;
      this.mainWindow.loadURL(toLoad);
    } catch (err) {
      // Last resort: try default
      const fallback = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
      this.mainWindow.loadURL(fallback);
    }
  }

  async findFirstAlive(urls) {
    const http = require('http');
    const tryUrl = (u) => new Promise((resolve) => {
      try {
        const req = http.get(u, (res) => {
          // 200/301/302 are acceptable for index
          if ([200, 301, 302].includes(res.statusCode)) {
            resolve(u);
          } else {
            resolve(null);
          }
          res.resume();
        });
        req.on('error', () => resolve(null));
        req.setTimeout(500, () => { try { req.destroy(); } catch {} resolve(null); });
      } catch {
        resolve(null);
      }
    });
    for (const u of urls) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await tryUrl(u);
      if (ok) return ok;
    }
    return null;
  }

  getMainWindow() {
    return this.mainWindow;
  }

  getMiniWindow() {
    return this.miniWindow;
  }

  async createMiniWindow() {
    // Mini window disabled (using OS Now Playing only)
    return null;
  }

  closeMiniWindow() {
    if (this.miniWindow && !this.miniWindow.isDestroyed()) {
      this.miniWindow.close();
      this.miniWindow = null;
    }
  }

  closeWindow() {
    if (this.mainWindow) {
      this.mainWindow.close();
      this.mainWindow = null;
    }
  }
}

module.exports = WindowManager;