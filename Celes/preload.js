const { contextBridge, ipcRenderer } = require('electron');

// Add error handling for preload script
process.on('uncaughtException', (error) => {
  console.error('Preload uncaught exception:', error);
});

contextBridge.exposeInMainWorld('electronAPI', {
  // Database operations
  getAllSongs: () => ipcRenderer.invoke('get-all-songs'),
  addSong: (songData) => ipcRenderer.invoke('add-song', songData),
  deleteSong: (songId) => ipcRenderer.invoke('delete-song', songId),
  
  // Playlist operations
  getPlaylists: () => ipcRenderer.invoke('get-playlists'),
  createPlaylist: (name) => ipcRenderer.invoke('create-playlist', name),
  addSongToPlaylist: (playlistId, songId) => ipcRenderer.invoke('add-song-to-playlist', playlistId, songId),
  deletePlaylist: (playlistId) => ipcRenderer.invoke('delete-playlist', playlistId),
  renamePlaylist: (playlistId, newName) => ipcRenderer.invoke('rename-playlist', playlistId, newName),
  updatePlaylistCover: (playlistId, imageDataUrl) => ipcRenderer.invoke('update-playlist-cover', playlistId, imageDataUrl),
  
  // Album art
  getAlbumArt: (songId) => ipcRenderer.invoke('get-album-art', songId),
  
  // Liked songs
  toggleLikeSong: (songId) => ipcRenderer.invoke('toggle-like-song', songId),
  getLikedSongs: () => ipcRenderer.invoke('get-liked-songs'),
  
  // File operations
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  showFolderDialog: () => ipcRenderer.invoke('show-folder-dialog'),
  
  // Folder watching
  addWatchedFolder: (folderPath) => ipcRenderer.invoke('add-watched-folder', folderPath),
  removeWatchedFolder: (folderPath) => ipcRenderer.invoke('remove-watched-folder', folderPath),
  getWatchedFolders: () => ipcRenderer.invoke('get-watched-folders'),
  scanFolder: (folderPath) => ipcRenderer.invoke('scan-folder', folderPath),

  // Tray operations
  updateMinimizeToTray: (enabled) => ipcRenderer.invoke('update-minimize-to-tray', enabled),
  
  // Window operations
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  // mini window removed; use in-app dock instead
  
  // Custom overlay notifications
  showOverlayNotification: (songData) => ipcRenderer.invoke('show-overlay-notification', songData),
  hideOverlayNotification: () => ipcRenderer.invoke('hide-overlay-notification'),
  
  // Recently played and smart playlists
  trackSongPlay: (songId) => ipcRenderer.invoke('track-song-play', songId),
  getRecentlyPlayed: () => ipcRenderer.invoke('get-recently-played'),
  getSmartPlaylists: () => ipcRenderer.invoke('get-smart-playlists'),
  
  // Media keys
  registerMediaKeys: () => ipcRenderer.send('register-media-keys'),
  unregisterMediaKeys: () => ipcRenderer.send('unregister-media-keys'),
  
  // Listen for events
  onSongAdded: (callback) => ipcRenderer.on('song-added', callback),
  onSongsBatchAdded: (callback) => ipcRenderer.on('songs-batch-added', callback),
  onNotification: (callback) => ipcRenderer.on('show-notification', callback),
  onBulkImportStart: (callback) => ipcRenderer.on('bulk-import-start', callback),
  onBulkImportProgress: (callback) => ipcRenderer.on('bulk-import-progress', callback),
  onBulkImportComplete: (callback) => ipcRenderer.on('bulk-import-complete', callback),
  onOpenSettingsModal: (callback) => ipcRenderer.on('open-settings-modal', callback),
  
  // Media key events
  onMediaKeyPlayPause: (callback) => ipcRenderer.on('media-key-play-pause', callback),
  onMediaKeyNext: (callback) => ipcRenderer.on('media-key-next', callback),
  onMediaKeyPrevious: (callback) => ipcRenderer.on('media-key-previous', callback),
  
  // Update system
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  handleUpdateDecision: (decision, updateInfo) => ipcRenderer.invoke('handle-update-decision', decision, updateInfo),
  requestUpdateHistory: () => ipcRenderer.invoke('request-update-history'),
  
  // Update event listeners
  onUpdateNotification: (callback) => ipcRenderer.on('show-update-notification', callback),
  onUpdateHistory: (callback) => ipcRenderer.on('show-update-history', callback),
  onUpdateDownloadStarted: (callback) => ipcRenderer.on('update-download-started', callback),
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', callback),
  onUpdateDownloadError: (callback) => ipcRenderer.on('update-download-error', callback),

  // Streaming functionality
  searchMusic: (query, platform, limit) => ipcRenderer.invoke('search-music', query, platform, limit),
  searchMusicWithFallback: (query, primaryPlatform, limit) => ipcRenderer.invoke('search-music-with-fallback', query, primaryPlatform, limit),
  getStreamUrl: (trackId, platform) => ipcRenderer.invoke('get-stream-url', trackId, platform),
  getStreamUrlWithFallback: (trackId, primaryPlatform) => ipcRenderer.invoke('get-stream-url-with-fallback', trackId, primaryPlatform),
  // Playback controls exposed for mini and renderer
  nextTrack: () => ipcRenderer.invoke('next-track'),
  previousTrack: () => ipcRenderer.invoke('previous-track'),
  togglePlay: () => ipcRenderer.invoke('toggle-play'),
  downloadTrack: (track, targetDir) => ipcRenderer.invoke('download-track', track, targetDir),
  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  deleteDownload: (downloadId, removeFile) => ipcRenderer.invoke('delete-download', downloadId, removeFile),
  // Download queue controls
  downloadQueueAdd: (items, targetDir) => ipcRenderer.invoke('download-queue-add', items, targetDir),
  downloadQueueStatus: () => ipcRenderer.invoke('download-queue-status'),
  downloadQueuePause: () => ipcRenderer.invoke('download-queue-pause'),
  downloadQueueResume: () => ipcRenderer.invoke('download-queue-resume'),
  downloadQueueCancel: () => ipcRenderer.invoke('download-queue-cancel'),
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_e, data)=> cb?.(data)),
  getTrackInfo: (trackId, platform) => ipcRenderer.invoke('get-track-info', trackId, platform),
  getTrackLoudness: (trackId, platform, options) => ipcRenderer.invoke('get-track-loudness', trackId, platform, options),
  getReleaseRadar: (limit) => ipcRenderer.invoke('get-release-radar', limit),
  getTopCharts: (platform, limit) => ipcRenderer.invoke('get-top-charts', platform, limit),
  getArtistTracks: (artistName, limit) => ipcRenderer.invoke('get-artist-tracks', artistName, limit),
  getArtistOverview: (artistName, limits, options) => ipcRenderer.invoke('get-artist-overview', artistName, limits, options),
  getSimilarArtists: (artistName, limit) => ipcRenderer.invoke('get-similar-artists', artistName, limit),
  importPlaylistUrl: (url) => ipcRenderer.invoke('import-playlist-url', url),
  getLyricsForTrack: (meta) => ipcRenderer.invoke('get-lyrics-for-track', meta),
  getYouTubeVideoStream: (videoId) => ipcRenderer.invoke('get-youtube-video-stream', videoId),
  // Mini/renderer control bridge
  sendRendererCommand: (cmd, args) => ipcRenderer.invoke('renderer-command', cmd, args),
  reportNowPlaying: (data) => ipcRenderer.send('report-now-playing', data),
  onMiniNowPlaying: (cb) => ipcRenderer.on('mini-now-playing', (_e, data)=> cb?.(data)),
  onRendererCommand: (cb) => ipcRenderer.on('renderer-command', (_e, payload)=> cb?.(payload)),
  getSimilarTracks: (trackId, platform, limit) => ipcRenderer.invoke('get-similar-tracks', trackId, platform, limit),
  followArtistStreaming: (artistName) => ipcRenderer.invoke('follow-artist-streaming', artistName),
  unfollowArtistStreaming: (artistName) => ipcRenderer.invoke('unfollow-artist-streaming', artistName),
  getFollowedArtistsTracks: (limit) => ipcRenderer.invoke('get-followed-artists-tracks', limit),
  getSupportedPlatforms: () => ipcRenderer.invoke('get-supported-platforms'),
  isPlatformSupported: (platform) => ipcRenderer.invoke('is-platform-supported', platform),
  clearStreamingCache: () => ipcRenderer.invoke('clear-streaming-cache'),
  streamingHealthCheck: () => ipcRenderer.invoke('streaming-health-check'),
  getStreamingStats: () => ipcRenderer.invoke('get-streaming-stats'),
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // Fallback settings
  setFallbackEnabled: (enabled) => ipcRenderer.invoke('set-fallback-enabled', enabled),
  getFallbackEnabled: () => ipcRenderer.invoke('get-fallback-enabled'),
  
  // Streaming database operations
  getLocalSongs: () => ipcRenderer.invoke('get-local-songs'),
  getStreamingSongs: () => ipcRenderer.invoke('get-streaming-songs'),
  addStreamingTrack: (trackData) => ipcRenderer.invoke('add-streaming-track', trackData),
  
  // Node.js path utilities for file handling
  path: {
    basename: (filepath) => {
      const parts = filepath.replace(/\\/g, '/').split('/');
      return parts[parts.length - 1];
    },
    dirname: (filepath) => {
      const parts = filepath.replace(/\\/g, '/').split('/');
      parts.pop();
      return parts.join('/');
    },
    extname: (filepath) => {
      const basename = filepath.replace(/\\/g, '/').split('/').pop();
      const dotIndex = basename.lastIndexOf('.');
      return dotIndex !== -1 ? basename.substring(dotIndex) : '';
    }
  }
});