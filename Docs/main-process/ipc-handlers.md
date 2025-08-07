# IPC Handlers

Inter-Process Communication (IPC) in Celes is managed through the `IPCHandlers` class, which provides a secure bridge between the main process and renderer process.

## Architecture

### Security Model
```javascript
// Window configuration enforces security
webPreferences: {
  nodeIntegration: false,        // No Node.js access in renderer
  contextIsolation: true,        // Isolate contexts
  preload: path.join(__dirname, 'preload.js')  // Controlled API exposure
}
```

### Preload Script (`preload.js`)
The preload script uses `contextBridge` to expose a safe API:

```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  // Database operations
  getAllSongs: () => ipcRenderer.invoke('get-all-songs'),
  addSong: (songData) => ipcRenderer.invoke('add-song', songData),
  // ... other methods
});
```

## Handler Categories

### Database Handlers (`setupDatabaseHandlers()`)

**Song Operations:**
- `get-all-songs` → `database.getAllSongs()`
- `add-song` → `database.addSong(songData)`
- `delete-song` → `database.deleteSong(songId)`
- `toggle-like-song` → `database.toggleLikeSong(songId)`
- `get-liked-songs` → `database.getLikedSongs()`

**Playlist Operations:**
- `get-playlists` → `database.getPlaylists()`
- `create-playlist` → `database.createPlaylist(name)`
- `add-song-to-playlist` → `database.addSongToPlaylist(playlistId, songId)`
- `delete-playlist` → `database.deletePlaylist(playlistId)`
- `rename-playlist` → `database.renamePlaylist(playlistId, newName)`

**Album Art:**
- `get-album-art` → `database.getAlbumArt(songId)`

### Dialog Handlers (`setupDialogHandlers()`)

**File Selection:**
```javascript
ipcMain.handle('show-open-dialog', async () => {
  const result = await dialog.showOpenDialog(this.mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg'] }
    ]
  });
  return result;
});
```

**Folder Selection:**
```javascript
ipcMain.handle('show-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(this.mainWindow, {
    properties: ['openDirectory']
  });
  return result;
});
```

### Folder Watching Handlers (`setupFolderHandlers()`)

**Folder Management:**
- `add-watched-folder` → `folderWatcher.addWatchedFolder(folderPath)`
- `remove-watched-folder` → `folderWatcher.removeWatchedFolder(folderPath)`
- `get-watched-folders` → `folderWatcher.getWatchedFolders()`
- `scan-folder` → `folderWatcher.importFilesFromFolder(folderPath)`

### Tray Handlers (`setupTrayHandlers()`)

**Tray Configuration:**
- `update-minimize-to-tray` → `trayService.updateMinimizeToTrayEnabled(enabled)`

### Window Handlers (`setupWindowHandlers()`)

**Window Controls:**
```javascript
ipcMain.handle('window-minimize', () => {
  this.mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (this.mainWindow.isMaximized()) {
    this.mainWindow.unmaximize();
  } else {
    this.mainWindow.maximize();
  }
});

ipcMain.handle('window-close', () => {
  this.mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
  return this.mainWindow.isMaximized();
});
```

### Media Key Handlers (`setupMediaHandlers()`)

**Media Key Registration:**
```javascript
ipcMain.on('register-media-keys', () => {
  globalShortcut.register('MediaPlayPause', () => {
    this.mainWindow.webContents.send('media-key-play-pause');
  });
  
  globalShortcut.register('MediaNextTrack', () => {
    this.mainWindow.webContents.send('media-key-next');
  });
  
  globalShortcut.register('MediaPreviousTrack', () => {
    this.mainWindow.webContents.send('media-key-previous');
  });
});
```

### Notification Handlers (`setupNotificationHandlers()`)

**Custom Overlays:**
- `show-overlay-notification` → `overlayService.showNotification(songData)`
- `hide-overlay-notification` → `overlayService.hideNotification()`

**System Notifications:**
```javascript
ipcMain.handle('show-notification', async (event, options) => {
  const notification = new Notification({
    title: options.title || 'Music Player',
    body: options.body || '',
    icon: options.icon || null
  });
  
  notification.show();
  return { success: true };
});
```

### Update Handlers (`setupUpdateHandlers()`)

**Update System:**
- `get-app-version` → `app.getVersion()`
- `check-for-updates` → `updateService.checkForUpdates()`
- `handle-update-decision` → `updateService.handleUpdateDecision(decision, updateInfo)`
- `request-update-history` → `updateService.getUpdateHistory()`

## Event Communication Patterns

### Invoke/Handle Pattern (Request-Response)
```javascript
// Renderer process
const songs = await window.electronAPI.getAllSongs();

// Main process
ipcMain.handle('get-all-songs', async () => {
  return this.database.getAllSongs();
});
```

### Send/On Pattern (Fire-and-Forget)
```javascript
// Renderer process
window.electronAPI.registerMediaKeys();

// Main process
ipcMain.on('register-media-keys', () => {
  // Register shortcuts
});
```

### Bidirectional Events
```javascript
// Main to Renderer
this.mainWindow.webContents.send('song-added', songData);

// Renderer listens
window.electronAPI.onSongAdded((event, songData) => {
  // Update UI
});
```

## Smart Playlist Handlers

**Recently Played:**
```javascript
ipcMain.handle('track-song-play', async (event, songId) => {
  await this.database.updatePlayCount(songId);
  await this.database.addToRecentlyPlayed(songId);
  return { success: true };
});

ipcMain.handle('get-recently-played', async () => {
  return this.database.getRecentlyPlayed();
});
```

**Smart Playlists Generation:**
```javascript
ipcMain.handle('get-smart-playlists', async () => {
  return {
    'Recently Played': this.database.getRecentlyPlayed(50),
    'Recently Added': this.database.getRecentlyAdded(50),
    'Most Played': this.database.getMostPlayed(50)
  };
});
```

## Bulk Import Progress

**Progress Tracking:**
```javascript
// FolderWatcher sends progress updates
this.mainWindow.webContents.send('bulk-import-start', { totalFiles });
this.mainWindow.webContents.send('bulk-import-progress', { 
  processed, 
  total, 
  currentFile,
  stats: { added, duplicates, errors }
});
this.mainWindow.webContents.send('bulk-import-complete', { stats });
```

**Renderer Listening:**
```javascript
window.electronAPI.onBulkImportProgress((event, data) => {
  progressService.updateProgress(data.processed, data.total);
  progressService.setCurrentFile(data.currentFile);
  progressService.updateStats(data.stats);
});
```

## Error Handling

### Handler Error Handling
```javascript
ipcMain.handle('add-song', async (event, songData) => {
  try {
    const result = await this.database.addSong(songData);
    return { success: true, ...result };
  } catch (error) {
    console.error('Error adding song:', error);
    return { success: false, error: error.message };
  }
});
```

### Renderer Error Handling
```javascript
try {
  const result = await window.electronAPI.addSong(songData);
  if (!result.success) {
    console.error('Failed to add song:', result.error);
    this.showErrorNotification(result.error);
  }
} catch (error) {
  console.error('IPC communication error:', error);
}
```

## Security Considerations

### Input Validation
```javascript
ipcMain.handle('create-playlist', async (event, name) => {
  // Validate input
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { success: false, error: 'Invalid playlist name' };
  }
  
  // Sanitize input
  const sanitizedName = name.trim().substring(0, 100);
  return this.database.createPlaylist(sanitizedName);
});
```

### Path Validation
```javascript
ipcMain.handle('add-watched-folder', async (event, folderPath) => {
  try {
    // Validate and normalize path
    const normalizedPath = path.resolve(folderPath);
    
    // Check if path exists and is accessible
    if (!fs.existsSync(normalizedPath)) {
      return { success: false, error: 'Folder does not exist' };
    }
    
    return this.folderWatcher.addWatchedFolder(normalizedPath);
  } catch (error) {
    return { success: false, error: 'Invalid folder path' };
  }
});
```

### API Surface Control
The preload script carefully controls what APIs are exposed:

```javascript
// Safe utilities exposed
path: {
  basename: (filepath) => { /* safe implementation */ },
  dirname: (filepath) => { /* safe implementation */ },
  extname: (filepath) => { /* safe implementation */ }
}

// Dangerous APIs NOT exposed:
// - fs (file system access)
// - child_process (process spawning)
// - require (module loading)
```

This IPC architecture ensures secure, efficient communication between processes while maintaining clear separation of concerns and providing comprehensive error handling.