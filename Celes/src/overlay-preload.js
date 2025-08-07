const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
  onShowSong: (callback) => ipcRenderer.on('show-song', callback),
});