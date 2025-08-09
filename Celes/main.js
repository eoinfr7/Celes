const { app, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const MusicPlayerApp = require('./src/main/MusicPlayerApp');

// Create logs directory in userData
const setupLogging = () => {
  try {
    const userDataPath = app.getPath('userData');
    const logsDir = path.join(userDataPath, 'logs');
    
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const logFile = path.join(logsDir, `celes-${new Date().toISOString().split('T')[0]}.log`);
    
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    
    console.log = (...args) => {
      const timestamp = new Date().toISOString();
      const message = `[${timestamp}] LOG: ${args.join(' ')}\n`;
      originalConsoleLog(...args);
      try {
        fs.appendFileSync(logFile, message);
      } catch (e) {}
    };
    
    console.error = (...args) => {
      const timestamp = new Date().toISOString();
      const message = `[${timestamp}] ERROR: ${args.join(' ')}\n`;
      originalConsoleError(...args);
      try {
        fs.appendFileSync(logFile, message);
      } catch (e) {}
    };
    
    console.log('Celes starting...');
    console.log('App version:', app.getVersion());
    console.log('Electron version:', process.versions.electron);
    console.log('Node version:', process.versions.node);
    console.log('Platform:', process.platform);
    console.log('User data path:', userDataPath);
    
  } catch (error) {
    console.error('Failed to setup logging:', error);
  }
};

// Register custom scheme privileges before app ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'celes-stream',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    }
  }
]);

// Setup logging as early as possible and disable pinch-zoom globally
app.commandLine.appendSwitch('disable-pinch');
// (Optional) disable smooth scrolling acceleration that can trigger zoom-like behavior
app.whenReady().then(() => {
  try { setupLogging(); } catch {}
});

// Handle uncaught exceptions in production
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  
  // Show error dialog in production
  if (!app.isPackaged) return;
  
  dialog.showErrorBox('Fatal Error', 
    `Celes has encountered a fatal error and needs to close.\n\nError: ${error.message}\n\nCheck logs in: ${app.getPath('userData')}/logs/`
  );
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  console.error('Stack:', error.stack);
});

const musicPlayer = new MusicPlayerApp();

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (musicPlayer.mainWindow) {
      if (musicPlayer.mainWindow.isMinimized()) musicPlayer.mainWindow.restore();
      musicPlayer.mainWindow.focus();
    }
  });

  musicPlayer.init().catch(console.error);
}