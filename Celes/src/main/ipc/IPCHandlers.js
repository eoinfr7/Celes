const { ipcMain, dialog, Notification, app } = require('electron');

class IPCHandlers {
  constructor(database, folderWatcher, mainWindow, trayService, overlayService, updateService, streamingService, windowManager) {
    this.database = database;
    this.folderWatcher = folderWatcher;
    this.mainWindow = mainWindow;
    this.trayService = trayService;
    this.overlayService = overlayService;
    this.updateService = updateService;
    this.streamingService = streamingService;
    this.windowManager = windowManager;
    // Downloads queue
    this.downloadQueue = [];
    this.downloadPaused = false;
    this.currentDownload = null; // { controller, track, targetDir, written, total, filePath }
  }

  setupHandlers() {
    this.setupDatabaseHandlers();
    this.setupDialogHandlers();
    this.setupFolderHandlers();
    this.setupTrayHandlers();
    this.setupWindowHandlers();
    this.setupMediaHandlers();
    this.setupNotificationHandlers();
    this.setupUpdateHandlers();
    this.setupStreamingHandlers();

    // Notify renderer once handlers are ready
    try {
      const sendReady = () => { try { this.mainWindow?.webContents?.send('handlers-ready'); } catch {}
      };
      this.mainWindow?.webContents?.once('dom-ready', sendReady);
      // Also try sending immediately and after a short delay to cover races
      sendReady(); setTimeout(sendReady, 500);
    } catch {}

    // Periodically forward now playing info to the mini player (if open)
    const forwardNowPlaying = async () => {
      try {
        const track = await this.streamingService.getCurrentTrack();
        const win = this.windowManager?.getMiniWindow?.();
        if (win && !win.isDestroyed()) {
          win.webContents.send('mini-now-playing', track || null);
        }
      } catch {}
    };
    setInterval(forwardNowPlaying, 2000);
  }

  setupSettingsHandlers() {
    const settingsManager = this.trayService?.settingsManager || this.settingsManager || null;
    const sm = settingsManager || { loadSettings: ()=> ({}), saveSettings: ()=> false };
    ipcMain.handle('get-settings', async () => {
      try { return sm.loadSettings(); } catch { return {} }
    });
    ipcMain.handle('save-settings', async (event, settings) => {
      try { sm.saveSettings(settings||{}); return { success:true } } catch (e) { return { success:false, error:e.message } }
    });
  }

  setupDatabaseHandlers() {
    ipcMain.handle('get-all-songs', async () => {
      return this.database.getAllSongs();
    });

    ipcMain.handle('get-local-songs', async () => {
      return this.database.getLocalSongs();
    });

    ipcMain.handle('get-streaming-songs', async () => {
      return this.database.getStreamingSongs();
    });

    ipcMain.handle('add-song', async (event, songData) => {
      return this.database.addSong(songData);
    });

    ipcMain.handle('add-streaming-track', async (event, trackData) => {
      return this.database.addStreamingTrack(trackData);
    });

    ipcMain.handle('delete-song', async (event, songId) => {
      return this.database.deleteSong(songId);
    });

    ipcMain.handle('get-playlists', async () => {
      return this.database.getPlaylists();
    });

    ipcMain.handle('create-playlist', async (event, name) => {
      return this.database.createPlaylist(name);
    });

    ipcMain.handle('add-song-to-playlist', async (event, playlistId, songId) => {
      return this.database.addSongToPlaylist(playlistId, songId);
    });

    ipcMain.handle('get-album-art', async (event, songId) => {
      return this.database.getAlbumArt(songId);
    });

    ipcMain.handle('toggle-like-song', async (event, songId) => {
      return this.database.toggleLikeSong(songId);
    });

    ipcMain.handle('get-liked-songs', async () => {
      return this.database.getLikedSongs();
    });

    ipcMain.handle('delete-playlist', async (event, playlistId) => {
      return this.database.deletePlaylist(playlistId);
    });

    ipcMain.handle('rename-playlist', async (event, playlistId, newName) => {
      return this.database.renamePlaylist(playlistId, newName);
    });

    // Playlist cover image upload
    ipcMain.handle('update-playlist-cover', async (event, playlistId, imageDataUrl) => {
      try {
        // imageDataUrl is expected as a data URL (e.g., data:image/png;base64,....)
        if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:')) {
          return { success: false, error: 'Invalid image data' };
        }
        const [meta, b64] = imageDataUrl.split(',');
        const mimeMatch = /^data:([^;]+);base64$/i.exec(meta || '');
        const mime = (mimeMatch && mimeMatch[1]) || 'image/png';
        const buffer = Buffer.from(b64, 'base64');
        return this.database.updatePlaylistCover(playlistId, buffer, mime);
      } catch (error) {
        console.error('Error updating playlist cover:', error);
        return { success: false, error: error.message };
      }
    });

    // Artist following handlers
    ipcMain.handle('follow-artist', async (event, artistName, platform) => {
      return this.database.followArtist(artistName, platform);
    });

    ipcMain.handle('unfollow-artist', async (event, artistName) => {
      return this.database.unfollowArtist(artistName);
    });

    ipcMain.handle('get-followed-artists', async () => {
      return this.database.getFollowedArtists();
    });

    ipcMain.handle('is-artist-followed', async (event, artistName) => {
      return this.database.isArtistFollowed(artistName);
    });
  }

  setupDialogHandlers() {
    ipcMain.handle('show-open-dialog', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Audio Files', extensions: ['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg'] }
        ]
      });
      return result;
    });

    ipcMain.handle('show-folder-dialog', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory']
      });
      return result;
    });
  }

  setupFolderHandlers() {
    ipcMain.handle('add-watched-folder', async (event, folderPath) => {
      return this.folderWatcher.addWatchedFolder(folderPath);
    });

    ipcMain.handle('remove-watched-folder', async (event, folderPath) => {
      return this.folderWatcher.removeWatchedFolder(folderPath);
    });

    ipcMain.handle('get-watched-folders', async () => {
      return this.folderWatcher.getWatchedFolders();
    });

    ipcMain.handle('scan-folder', async (event, folderPath) => {
      return this.folderWatcher.scanFolder(folderPath);
    });

    ipcMain.handle('get-folder-watcher-status', async () => {
      return this.folderWatcher.getQueueStatus();
    });
  }

  setupTrayHandlers() {
    ipcMain.handle('update-minimize-to-tray', async (event, enabled) => {
      this.trayService.updateMinimizeToTrayEnabled(enabled);
      return { success: true };
    });

    ipcMain.on('open-settings', () => {
      // This is handled by the tray service to open settings from tray menu
      this.mainWindow.webContents.send('open-settings-modal');
    });
  }

  setupWindowHandlers() {
    ipcMain.handle('window-minimize', () => {
      this.mainWindow.minimize();
    });

    ipcMain.handle('window-maximize', () => {
      if (this.mainWindow.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow.maximize();
      }
      return this.mainWindow.isMaximized();
    });

    ipcMain.handle('window-close', () => {
      this.mainWindow.close();
    });

    ipcMain.handle('window-is-maximized', () => {
      return this.mainWindow.isMaximized();
    });

    // Mini player
    // mini window removed; using in-app dock

    // Bridge generic commands from mini → main renderer
    ipcMain.handle('renderer-command', async (_event, cmd, args) => {
      try {
        this.mainWindow?.webContents?.send('renderer-command', { type: cmd, args });
        return { success: true };
      } catch (e) { return { success:false, error: e.message } }
    });
  }

  setupMediaHandlers() {
    // Set up global media key listeners
    ipcMain.on('register-media-keys', () => {
      this.mainWindow.webContents.setWindowOpenHandler = null; // Clear any existing handlers
      
      // Register global shortcuts for media keys
      const { globalShortcut } = require('electron');
      
      // Clear existing shortcuts
      globalShortcut.unregisterAll();
      
      // Register media key shortcuts
      globalShortcut.register('MediaPlayPause', () => {
        this.mainWindow.webContents.send('media-key-play-pause');
      });
      
      globalShortcut.register('MediaNextTrack', () => {
        this.mainWindow.webContents.send('media-key-next');
      });
      
      globalShortcut.register('MediaPreviousTrack', () => {
        this.mainWindow.webContents.send('media-key-previous');
      });
      
      console.log('Media keys registered');
    });

    ipcMain.on('unregister-media-keys', () => {
      const { globalShortcut } = require('electron');
      globalShortcut.unregisterAll();
      console.log('Media keys unregistered');
    });
  }

  setupNotificationHandlers() {
    ipcMain.handle('show-overlay-notification', async (event, songData) => {
      try {
        // Show overlay if main window is not focused, minimized, or not visible
        if (!this.mainWindow.isFocused() || this.mainWindow.isMinimized() || !this.mainWindow.isVisible()) {
          await this.overlayService.showSongNotification(songData);
        }
        return { success: true };
      } catch (error) {
        console.error('Error showing overlay notification:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('hide-overlay-notification', async () => {
      try {
        this.overlayService.hideOverlay();
        return { success: true };
      } catch (error) {
        console.error('Error hiding overlay notification:', error);
        return { success: false, error: error.message };
      }
    });

    // Track recently played songs
    ipcMain.handle('track-song-play', async (event, songId) => {
      try {
        // Add to recently played table
        this.database.addToRecentlyPlayed(songId);
        return { success: true };
      } catch (error) {
        console.error('Error tracking song play:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('get-recently-played', async () => {
      try {
        return this.database.getRecentlyPlayed();
      } catch (error) {
        console.error('Error getting recently played:', error);
        return [];
      }
    });

    ipcMain.handle('get-smart-playlists', async () => {
      try {
        return {
          recentlyAdded: this.database.getRecentlyAdded(),
          mostPlayed: this.database.getMostPlayed()
        };
      } catch (error) {
        console.error('Error getting smart playlists:', error);
        return { recentlyAdded: [], mostPlayed: [] };
      }
    });
  }

  setupUpdateHandlers() {
    ipcMain.handle('get-app-version', () => {
      return { version: app.getVersion() };
    });
    
    ipcMain.handle('check-for-updates', async () => {
      try {
        await this.updateService.checkForUpdates(false);
        return { success: true };
      } catch (error) {
        console.error('Error checking for updates:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('handle-update-decision', async (event, decision, updateInfo) => {
      try {
        await this.updateService.handleUpdateDecision(decision, updateInfo);
        return { success: true };
      } catch (error) {
        console.error('Error handling update decision:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('request-update-history', async () => {
      try {
        await this.updateService.showUpdateHistory();
        return { success: true };
      } catch (error) {
        console.error('Error requesting update history:', error);
        return { success: false, error: error.message };
      }
    });
  }

  setupStreamingHandlers() {
    // Search functionality
    ipcMain.handle('search-music', async (event, query, platform, limit) => {
      try {
        return await this.streamingService.searchMusic(query, platform, limit);
      } catch (error) {
        console.error('Error searching music:', error);
        return [];
      }
    });

    // Enhanced search with fallback
    ipcMain.handle('search-music-with-fallback', async (event, query, primaryPlatform, limit) => {
      try {
        return await this.streamingService.searchMusicWithFallback(query, primaryPlatform, limit);
      } catch (error) {
        console.error('Error searching music with fallback:', error);
        return [];
      }
    });

    ipcMain.handle('get-release-radar', async (event, limit) => {
      try {
        return await this.streamingService.getReleaseRadar(limit);
      } catch (error) {
        console.error('Error getting release radar:', error);
        return [];
      }
    });

    ipcMain.handle('get-top-charts', async (event, platform, limit) => {
      try {
        return await this.streamingService.getTopCharts(platform, limit);
      } catch (error) {
        console.error('Error getting top charts:', error);
        return [];
      }
    });

    ipcMain.handle('get-explore-sections', async () => {
      try {
        const base = await this.streamingService.getExploreSections();
        const historyBuckets = this.streamingService.buildSearchHistoryBuckets(3, 12);
        return { ...base, historyBuckets };
      } catch (error) {
        console.error('Error getting explore sections:', error);
        return { historyBuckets: [] };
      }
    });

    ipcMain.handle('get-search-history', async () => {
      try {
        const cache = this.streamingService.searchCache || new Map();
        const out = [];
        for (const [key, entry] of cache.entries()) {
          try {
            const [platform, query] = (key || '').split(':').slice(0,2);
            if (platform === 'youtube' && query && entry && Array.isArray(entry.results)) {
              out.push({ query, results: entry.results.slice(0, 12) });
            }
          } catch {}
        }
        return out.slice(-10); // latest ~10 buckets
      } catch (e) {
        return [];
      }
    });

    ipcMain.handle('get-artist-tracks', async (event, artistName, limit) => {
      try {
        return await this.streamingService.getArtistTracks(artistName, limit);
      } catch (error) {
        console.error('Error getting artist tracks:', error);
        return [];
      }
    });

    ipcMain.handle('get-similar-tracks', async (event, trackId, platform, limit) => {
      try {
        return await this.streamingService.getSimilarTracks(trackId, platform, limit);
      } catch (error) {
        console.error('Error getting similar tracks:', error);
        return [];
      }
    });

    ipcMain.handle('get-followed-artists-tracks', async (event, limit) => {
      try {
        return await this.streamingService.getFollowedArtistsTracks(limit);
      } catch (error) {
        console.error('Error getting followed artists tracks:', error);
        return [];
      }
    });

    ipcMain.handle('get-artist-overview', async (event, artistName, limits, options) => {
      try {
        return await this.streamingService.getArtistOverview(artistName, limits, options);
      } catch (error) {
        console.error('Error getting artist overview:', error);
        return { artist: artistName, headerImage: '', topTracks: [], similarArtists: [], about: null };
      }
    });

    ipcMain.handle('get-similar-artists', async (event, artistName, limit) => {
      try {
        return await this.streamingService.getSimilarArtists(artistName, limit);
      } catch (error) {
        console.error('Error getting similar artists:', error);
        return [];
      }
    });

    // Platform functionality
    ipcMain.handle('get-supported-platforms', async () => {
      return this.streamingService.getSupportedPlatforms();
    });

    ipcMain.handle('is-platform-supported', async (event, platform) => {
      return this.streamingService.isPlatformSupported(platform);
    });

    // Stream URL functionality
    ipcMain.handle('get-stream-url', async (event, trackId, platform) => {
      try {
        return await this.streamingService.getStreamUrl(trackId, platform);
      } catch (error) {
        console.error('Error getting stream URL:', error);
        return null;
      }
    });

    // Enhanced stream URL with fallback
    ipcMain.handle('get-stream-url-with-fallback', async (event, trackId, primaryPlatform) => {
      try {
        return await this.streamingService.getStreamUrlWithFallback(trackId, primaryPlatform);
      } catch (error) {
        console.error('Error getting stream URL with fallback:', error);
        return null;
      }
    });

    // Loudness analysis
    ipcMain.handle('get-track-loudness', async (event, trackId, platform, options) => {
      try {
        return await this.streamingService.getTrackLoudness(trackId, platform, options);
      } catch (error) {
        console.error('Error analyzing loudness:', error);
        return null;
      }
    });

    // Playlist import
    ipcMain.handle('import-playlist-url', async (event, url) => {
      try {
        return await this.streamingService.importPlaylistFromUrl(url);
      } catch (error) {
        console.error('Error importing playlist:', error);
        return null;
      }
    });

    // Lyrics
    ipcMain.handle('get-lyrics-for-track', async (event, meta) => {
      try {
        return await this.streamingService.getLyricsForTrack(meta);
      } catch (error) {
        console.error('Error getting lyrics:', error);
        return null;
      }
    });

    // YouTube video stream (ad-free via Piped) for Theater mode
    ipcMain.handle('get-youtube-video-stream', async (event, videoId) => {
      try {
        return await this.streamingService.getYouTubeVideoStream(videoId);
      } catch (error) {
        console.error('Error getting YouTube video stream:', error);
        return null;
      }
    });
    // Offline downloads
    ipcMain.handle('download-track', async (event, track, targetDir) => {
      try {
        const res = await this.streamingService.downloadTrackToFile(track, targetDir);
        // If DB is available and track exists, record download
        try {
          if (this.database && track && track.stream_id) {
            const song = this.database.db.prepare('SELECT id FROM songs WHERE stream_id = ? AND platform = ?').get(String(track.stream_id||track.id), track.platform||'youtube');
            if (song && song.id) {
              this.database.db.prepare('INSERT OR REPLACE INTO downloads (song_id, file_path, bytes, content_type) VALUES (?, ?, ?, ?)').run(song.id, res.path, res.bytes, res.contentType || null);
            }
          }
        } catch {}
        return res;
      } catch (error) {
        console.error('Error downloading track:', error);
        return { error: error.message };
      }
    });

    // Download queue
    const safeName = (s)=> String(s||'').replace(/[^a-z0-9\-_. ]+/gi,'').slice(0,80);
    const getDefaultDownloadDir = () => {
      try {
        const s = this.trayService?.settingsManager?.loadSettings?.();
        return (s && s.downloadDir) || require('os').homedir();
      } catch { return require('os').homedir(); }
    };

    const processNext = async () => {
      if (this.downloadPaused || this.currentDownload || this.downloadQueue.length===0) return;
      const job = this.downloadQueue.shift();
      if (!job) return;
      const { track, targetDir } = job;
      const dir = targetDir || getDefaultDownloadDir();
      const { net } = require('electron');
      const fs = require('fs');
      const path = require('path');
      try {
        const res = await this.streamingService.getStreamUrlWithFallback(track.id, track.platform||'youtube');
        const toProxy = (u)=> `celes-stream://proxy?u=${encodeURIComponent(u)}`;
        const finalUrl = toProxy(res?.streamUrl || track.streamUrl);
        if (!finalUrl) throw new Error('No stream URL');
        const controller = new AbortController();
        const response = await net.fetch(finalUrl, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const total = Number(response.headers.get('content-length')) || null;
        const filePath = path.join(dir, `${safeName(track.artist)} - ${safeName(track.title)}.m4a`);
        const file = fs.createWriteStream(filePath);
        const reader = response.body.getReader();
        this.currentDownload = { controller, track, targetDir: dir, written: 0, total, filePath };
        const send = (payload)=>{ try { this.mainWindow?.webContents?.send('download-progress', payload) } catch {} };
        send({ state:'start', track, total, filePath });
        while (true) {
          if (this.downloadPaused) { await new Promise(r=>setTimeout(r,200)); continue; }
          const { done, value } = await reader.read();
          if (done) break;
          if (value) { file.write(Buffer.from(value)); this.currentDownload.written += value.length; send({ state:'progress', written: this.currentDownload.written, total, track }); }
        }
        file.end();
        // record in DB
        try {
          const idRow = this.database.db.prepare('SELECT id FROM songs WHERE stream_id = ? AND platform = ?').get(String(track.stream_id||track.id), track.platform||'youtube');
          if (idRow && idRow.id) {
            this.database.db.prepare('INSERT OR REPLACE INTO downloads (song_id, file_path, bytes, content_type) VALUES (?, ?, ?, ?)').run(idRow.id, filePath, this.currentDownload.written, response.headers.get('content-type')||null);
          }
        } catch {}
        send({ state:'done', filePath, track });
      } catch (error) {
        try { this.mainWindow?.webContents?.send('download-progress', { state:'error', error: error.message, track }) } catch {}
      } finally {
        this.currentDownload = null;
        setImmediate(processNext);
      }
    };

    ipcMain.handle('download-queue-add', async (event, items, targetDir) => {
      try {
        const list = Array.isArray(items) ? items : [items];
        for (const t of list) this.downloadQueue.push({ track: t, targetDir });
        setImmediate(processNext);
        return { success:true, queued: list.length };
      } catch (e) { return { success:false, error:e.message } }
    });
    ipcMain.handle('download-queue-status', async () => {
      return {
        paused: this.downloadPaused,
        queueLength: this.downloadQueue.length,
        current: this.currentDownload ? { track: this.currentDownload.track, written: this.currentDownload.written, total: this.currentDownload.total, filePath: this.currentDownload.filePath } : null
      };
    });
    ipcMain.handle('download-queue-pause', async () => { this.downloadPaused = true; return { success:true } });
    ipcMain.handle('download-queue-resume', async () => { this.downloadPaused = false; setImmediate(processNext); return { success:true } });
    ipcMain.handle('download-queue-cancel', async () => { try { this.currentDownload?.controller?.abort(); } catch {} this.currentDownload=null; return { success:true } });

    ipcMain.handle('get-downloads', async () => {
      try { return await this.database.getDownloads(); } catch (e) { return [] }
    });
    ipcMain.handle('delete-download', async (event, downloadId, removeFile) => {
      try { return await this.database.deleteDownload(downloadId, !!removeFile); } catch (e) { return { success:false, error:e.message } }
    });

    ipcMain.handle('get-track-info', async (event, trackId, platform) => {
      try {
        return await this.streamingService.getTrackInfo(trackId, platform);
      } catch (error) {
        console.error('Error getting track info:', error);
        return null;
      }
    });

    // Artist following functionality
    ipcMain.handle('follow-artist-streaming', async (event, artistName) => {
      try {
        return await this.streamingService.followArtist(artistName);
      } catch (error) {
        console.error('Error following artist:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('unfollow-artist-streaming', async (event, artistName) => {
      try {
        return await this.streamingService.unfollowArtist(artistName);
      } catch (error) {
        console.error('Error unfollowing artist:', error);
        return { success: false, error: error.message };
      }
    });

    // Cache functionality
    ipcMain.handle('clear-streaming-cache', async () => {
      try {
        return await this.streamingService.clearCache();
      } catch (error) {
        console.error('Error clearing streaming cache:', error);
        return { success: false, error: error.message };
      }
    });

    // System health and monitoring
    ipcMain.handle('streaming-health-check', async () => {
      try {
        return await this.streamingService.healthCheck();
      } catch (error) {
        console.error('Error in streaming health check:', error);
        return { healthy: false, message: error.message };
      }
    });

    ipcMain.handle('get-streaming-stats', async () => {
      return this.streamingService.getStats();
    });

    // Fallback settings
    ipcMain.handle('set-fallback-enabled', async (event, enabled) => {
      try {
        this.streamingService.fallbackEnabled = enabled;
        return { success: true };
      } catch (error) {
        console.error('Error setting fallback enabled:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('get-fallback-enabled', async () => {
      return this.streamingService.fallbackEnabled;
    });

    // Playback control
    ipcMain.handle('toggle-play', async () => {
      try {
        this.mainWindow.webContents.send('renderer-command', { type: 'toggle-play' });
        return { success: true };
      } catch (error) { return { success:false, error: error.message } }
    });
    ipcMain.handle('start-streaming', async (event, streamUrl) => {
      try {
        await this.streamingService.startStreaming(streamUrl);
        return { success: true };
      } catch (error) {
        console.error('Error starting streaming:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('stop-streaming', async () => {
      try {
        await this.streamingService.stopStreaming();
        return { success: true };
      } catch (error) {
        console.error('Error stopping streaming:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('is-streaming', async () => {
      return this.streamingService.isStreaming();
    });

    ipcMain.handle('get-current-track', async () => {
      return this.streamingService.getCurrentTrack();
    });

    ipcMain.handle('get-volume', async () => {
      return this.streamingService.getVolume();
    });

    ipcMain.handle('set-volume', async (event, volume) => {
      try {
        await this.streamingService.setVolume(volume);
        return { success: true };
      } catch (error) {
        console.error('Error setting volume:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('next-track', async () => {
      try {
        await this.streamingService.nextTrack();
        return { success: true };
      } catch (error) {
        console.error('Error next track:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('previous-track', async () => {
      try {
        await this.streamingService.previousTrack();
        return { success: true };
      } catch (error) {
        console.error('Error previous track:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('toggle-shuffle', async () => {
      try {
        await this.streamingService.toggleShuffle();
        return { success: true };
      } catch (error) {
        console.error('Error toggling shuffle:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('is-shuffle-on', async () => {
      return this.streamingService.isShuffleOn();
    });

    ipcMain.handle('toggle-repeat', async () => {
      try {
        await this.streamingService.toggleRepeat();
        return { success: true };
      } catch (error) {
        console.error('Error toggling repeat:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('is-repeat-on', async () => {
      return this.streamingService.isRepeatOn();
    });
  }
}

module.exports = IPCHandlers;