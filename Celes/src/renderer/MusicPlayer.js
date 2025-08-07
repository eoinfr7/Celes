class MusicPlayer {
  constructor() {
    this.songs = [];
    this.likedSongs = [];
    this.playlists = [];
    this.recentlyPlayed = [];
    this.recentlyAdded = [];
    this.mostPlayed = [];
    this.currentView = 'all-songs';
    this.currentPlaylist = null;
    this.searchQuery = '';
    this.filteredSongs = [];
    this.contextMenuSong = null;
    
    this.initializeElements();
    this.initializeServices();
    this.bindEvents();
    this.loadAppVersion();
    this.loadData();
  }

  initializeElements() {
    this.songList = document.getElementById('song-list');
    this.songCount = document.getElementById('song-count');
    this.currentViewTitle = document.getElementById('current-view-title');
    this.playlistsList = document.getElementById('playlists-list');
    this.dropZone = document.getElementById('drop-zone');
    this.addMusicBtn = document.getElementById('add-music-btn');
    this.manageFoldersBtn = document.getElementById('manage-folders-btn');
    this.createPlaylistBtn = document.getElementById('create-playlist-btn');
    this.playAllBtn = document.getElementById('play-all-btn');
    this.playlistModal = document.getElementById('playlist-modal');
    this.playlistNameInput = document.getElementById('playlist-name-input');
    this.foldersModal = document.getElementById('folders-modal');
    this.watchedFoldersList = document.getElementById('watched-folders-list');
    this.searchInput = document.getElementById('search-input');
    this.clearSearchBtn = document.getElementById('clear-search-btn');
    this.contextMenu = document.getElementById('song-context-menu');
    this.contextArtistName = document.getElementById('context-artist-name');
    this.contextAlbumName = document.getElementById('context-album-name');
    this.contextLikeText = document.getElementById('context-like-text');
  }

  initializeServices() {
    this.notificationService = new NotificationService();
    this.progressService = new ProgressService();
    this.settingsManager = new SettingsManager();
    this.songRenderer = new SongRenderer(this.songList, this.songCount);
    this.playlistManager = new PlaylistManager(
      this.playlistsList, 
      this.playlistModal, 
      this.playlistNameInput
    );
    this.equalizerManager = new EqualizerManager();
    this.folderManager = new FolderManager(
      this.foldersModal, 
      this.watchedFoldersList, 
      this.notificationService
    );
    this.dragDropHandler = new DragDropHandler(this.dropZone, this);
    this.updateManager = new UpdateManager();
    this.streamingManager = new StreamingManager();
  }

  bindEvents() {
    this.addMusicBtn.addEventListener('click', () => this.showOpenDialog());
    this.manageFoldersBtn.addEventListener('click', () => this.folderManager.showFoldersModal());
    this.playAllBtn.addEventListener('click', () => this.playAllSongs());
    this.createPlaylistBtn.addEventListener('click', () => this.playlistManager.showPlaylistModal());
    
    // Search functionality
    this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    this.clearSearchBtn.addEventListener('click', () => this.clearSearch());
    
    // Context menu functionality
    this.setupContextMenu();
    
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => this.handleNavigation(e));
    });
  }

  async loadData() {
    await this.loadSongs();
    await this.loadLikedSongs();
    await this.loadPlaylists();
    await this.loadSmartPlaylists();
    this.renderCurrentView();
    this.setupEventListeners();
    this.setupMediaKeys();
  }

  async loadSongs() {
    try {
      this.songs = await window.electronAPI.getAllSongs();
      this.filteredSongs = [...this.songs];
    } catch (error) {
      console.error('Error loading songs:', error);
      this.songs = [];
      this.filteredSongs = [];
    }
  }

  async loadLocalSongs() {
    try {
      return await window.electronAPI.getLocalSongs();
    } catch (error) {
      console.error('Error loading local songs:', error);
      return [];
    }
  }

  async loadStreamingSongs() {
    try {
      return await window.electronAPI.getStreamingSongs();
    } catch (error) {
      console.error('Error loading streaming songs:', error);
      return [];
    }
  }

  async loadLikedSongs() {
    try {
      this.likedSongs = await window.electronAPI.getLikedSongs();
      console.log('Loaded liked songs:', this.likedSongs.length);
    } catch (error) {
      console.error('Error loading liked songs:', error);
      this.likedSongs = [];
    }
  }

  async loadPlaylists() {
    try {
      this.playlists = await window.electronAPI.getPlaylists();
      this.playlistManager.renderPlaylists(this.playlists);
      console.log('Loaded playlists:', this.playlists.length);
    } catch (error) {
      console.error('Error loading playlists:', error);
      this.playlists = [];
    }
  }

  async loadSmartPlaylists() {
    try {
      this.recentlyPlayed = await window.electronAPI.getRecentlyPlayed();
      const smartPlaylists = await window.electronAPI.getSmartPlaylists();
      this.recentlyAdded = smartPlaylists.recentlyAdded || [];
      this.mostPlayed = smartPlaylists.mostPlayed || [];
      console.log('Loaded smart playlists - Recently Played:', this.recentlyPlayed.length, 
                  'Recently Added:', this.recentlyAdded.length, 'Most Played:', this.mostPlayed.length);
    } catch (error) {
      console.error('Error loading smart playlists:', error);
      this.recentlyPlayed = [];
      this.recentlyAdded = [];
      this.mostPlayed = [];
    }
  }

  async getCurrentSongs() {
    let baseSongs;
    switch (this.currentView) {
      case 'all-songs':
        baseSongs = this.songs;
        break;
      case 'local-songs':
        baseSongs = await this.loadLocalSongs();
        break;
      case 'streaming-songs':
        baseSongs = await this.loadStreamingSongs();
        break;
      case 'liked-songs':
        baseSongs = this.likedSongs;
        break;
      case 'recently-played':
        baseSongs = this.recentlyPlayed;
        break;
      case 'recently-added':
        baseSongs = this.recentlyAdded;
        break;
      case 'most-played':
        baseSongs = this.mostPlayed;
        break;
      case 'artists':
        baseSongs = this.getArtistViewSongs();
        break;
      case 'albums':
        baseSongs = this.getAlbumViewSongs();
        break;
      default:
        if (this.currentPlaylist) {
          baseSongs = this.currentPlaylist.songs || [];
        } else {
          baseSongs = this.songs;
        }
    }
    
    // Apply search filter if there's a search query
    if (this.searchQuery) {
      return this.filterSongs(baseSongs, this.searchQuery);
    }
    
    return baseSongs;
  }

  async renderCurrentView() {
    // Hide equalizer view when switching to song list views
    this.hideEqualizerView();
    
    const songs = await this.getCurrentSongs();
    this.songRenderer.renderSongs(songs);
    this.songRenderer.updateSongCount(songs.length, songs);
  }

  showPlaylist(playlistId) {
    this.currentPlaylist = this.playlistManager.getPlaylistById(playlistId);
    if (this.currentPlaylist) {
      this.currentView = 'playlist';
      this.currentViewTitle.textContent = this.currentPlaylist.name;
      
      document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
      document.querySelector(`[data-playlist-id="${playlistId}"]`).classList.add('active');
      
      this.renderCurrentView();
    }
  }

  handleNavigation(e) {
    e.preventDefault();
    
    const navItem = e.currentTarget;
    const view = navItem.dataset.view;
    
    this.currentView = view;
    this.currentPlaylist = null;
    
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    navItem.classList.add('active');
    
    switch (view) {
      case 'all-songs':
        this.currentViewTitle.textContent = 'All Songs';
        break;
      case 'local-songs':
        this.currentViewTitle.textContent = 'Local Music';
        break;
      case 'streaming-songs':
        this.currentViewTitle.textContent = 'Streaming';
        break;
      case 'liked-songs':
        this.currentViewTitle.textContent = 'Liked Songs';
        break;
      case 'recently-played':
        this.currentViewTitle.textContent = 'Recently Played';
        break;
      case 'recently-added':
        this.currentViewTitle.textContent = 'Recently Added';
        break;
      case 'most-played':
        this.currentViewTitle.textContent = 'Most Played';
        break;
      case 'release-radar':
        this.currentViewTitle.textContent = 'Release Radar';
        this.streamingManager.showStreamingModal();
        return; // Don't call renderCurrentView for streaming modal
      case 'followed-artists':
        this.currentViewTitle.textContent = 'Followed Artists';
        this.streamingManager.showStreamingModal();
        return; // Don't call renderCurrentView for streaming modal
      case 'trending':
        this.currentViewTitle.textContent = 'Trending';
        this.streamingManager.showStreamingModal();
        return; // Don't call renderCurrentView for streaming modal
      case 'artists':
        this.currentViewTitle.textContent = 'Artists';
        break;
      case 'albums':
        this.currentViewTitle.textContent = 'Albums';
        break;
      case 'equalizer':
        this.showEqualizerView();
        return; // Don't call renderCurrentView for equalizer
    }
    
    this.renderCurrentView();
  }

  showEqualizerView() {
    // Hide song list container
    const songListContainer = document.getElementById('song-list-container');
    const equalizerContainer = document.getElementById('equalizer-container');
    
    if (songListContainer) {
      songListContainer.style.display = 'none';
    }
    
    if (equalizerContainer) {
      equalizerContainer.style.display = 'block';
    }
  }

  hideEqualizerView() {
    // Show song list container and hide equalizer
    const songListContainer = document.getElementById('song-list-container');
    const equalizerContainer = document.getElementById('equalizer-container');
    
    if (songListContainer) {
      songListContainer.style.display = 'block';
    }
    
    if (equalizerContainer) {
      equalizerContainer.style.display = 'none';
    }
  }

  async showOpenDialog() {
    try {
      const result = await window.electronAPI.showOpenDialog();
      if (!result.canceled && result.filePaths.length > 0) {
        await this.addSongs(result.filePaths);
      }
    } catch (error) {
      console.error('Error opening files:', error);
    }
  }

  async addSongs(filePaths) {
    const loadingEl = document.createElement('div');
    loadingEl.className = 'loading-message';
    loadingEl.textContent = 'Adding songs...';
    document.body.appendChild(loadingEl);

    let addedCount = 0;
    let errorCount = 0;

    for (const filePath of filePaths) {
      try {
        const result = await window.electronAPI.addSong(filePath);
        if (result.success) {
          addedCount++;
        } else {
          errorCount++;
          console.warn(`Failed to add ${filePath}:`, result.error);
        }
      } catch (error) {
        errorCount++;
        console.error(`Error adding ${filePath}:`, error);
      }
    }

    document.body.removeChild(loadingEl);

    if (addedCount > 0) {
      await this.loadData();
      console.log(`Added ${addedCount} song(s)`);
    }

    if (errorCount > 0) {
      console.warn(`Failed to add ${errorCount} song(s)`);
    }
  }

  playSong(songId) {
    const song = this.songs.find(s => s.id === songId);
    if (song) {
      const currentSongs = this.getCurrentSongs();
      const index = currentSongs.findIndex(s => s.id === songId);
      
      // Use playSingleSong to preserve history when clicking individual songs
      if (window.audioPlayer.currentSong) {
        window.audioPlayer.playSingleSong(song, currentSongs, index);
      } else {
        // If no song is currently playing, start fresh (clear history)
        window.audioPlayer.playPlaylist(currentSongs, index);
      }
    }
  }

  playAllSongs() {
    const songs = this.getCurrentSongs();
    if (songs.length > 0) {
      window.audioPlayer.playPlaylist(songs, 0);
    }
  }

  async deleteSong(songId) {
    if (!confirm('Are you sure you want to delete this song from your library?')) {
      return;
    }

    try {
      const result = await window.electronAPI.deleteSong(songId);
      if (result.success) {
        await this.loadData();
        this.renderCurrentView(); // Refresh the UI to show updated list
        // Also refresh playlists since the deleted song might be in playlists
        await this.playlistManager.loadPlaylists();
        console.log('Song deleted successfully');
      } else {
        console.error('Error deleting song:', result.error);
      }
    } catch (error) {
      console.error('Error deleting song:', error);
    }
  }

  async scanFolder(folderPath) {
    await this.folderManager.scanFolder(folderPath);
  }

  async toggleLikeSong(songId) {
    try {
      const result = await window.electronAPI.toggleLikeSong(songId);
      if (result.success) {
        // Update the song in the main songs array
        const songIndex = this.songs.findIndex(s => s.id === songId);
        if (songIndex !== -1) {
          this.songs[songIndex].is_liked = result.isLiked ? 1 : 0;
          this.songs[songIndex].liked_date = result.likedDate;
        }
        
        // Reload liked songs and refresh views
        await this.loadLikedSongs();
        this.renderCurrentView();
        
        const message = result.isLiked ? 'Song added to liked songs' : 'Song removed from liked songs';
        this.notificationService.showNotification(message, 'success');
      } else {
        this.notificationService.showNotification('Error updating song', 'error');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      this.notificationService.showNotification('Error updating song', 'error');
    }
  }

  handleSearch(query) {
    this.searchQuery = query.trim();
    this.updateSearchUI();
    this.renderCurrentView();
  }

  filterSongs(songs, query) {
    if (!query) return songs;
    
    const lowerQuery = query.toLowerCase();
    return songs.filter(song => {
      return (
        song.title.toLowerCase().includes(lowerQuery) ||
        song.artist.toLowerCase().includes(lowerQuery) ||
        song.album.toLowerCase().includes(lowerQuery)
      );
    });
  }

  clearSearch() {
    this.searchInput.value = '';
    this.searchQuery = '';
    this.updateSearchUI();
    this.renderCurrentView();
  }

  updateSearchUI() {
    if (this.searchQuery) {
      this.clearSearchBtn.classList.add('show');
    } else {
      this.clearSearchBtn.classList.remove('show');
    }
  }

  // Artists/Albums view methods
  getArtistViewSongs() {
    // Group songs by artist and return them in artist order
    const artistGroups = {};
    this.songs.forEach(song => {
      const artist = song.artist || 'Unknown Artist';
      if (!artistGroups[artist]) {
        artistGroups[artist] = [];
      }
      artistGroups[artist].push(song);
    });

    // Sort artists alphabetically and flatten songs
    const sortedArtists = Object.keys(artistGroups).sort();
    const result = [];
    sortedArtists.forEach(artist => {
      // Sort songs within each artist by album, then by title
      const artistSongs = artistGroups[artist].sort((a, b) => {
        const albumCompare = (a.album || '').localeCompare(b.album || '');
        if (albumCompare !== 0) return albumCompare;
        return (a.title || '').localeCompare(b.title || '');
      });
      result.push(...artistSongs);
    });

    return result;
  }

  getAlbumViewSongs() {
    // Group songs by album and return them in album order
    const albumGroups = {};
    this.songs.forEach(song => {
      const album = song.album || 'Unknown Album';
      if (!albumGroups[album]) {
        albumGroups[album] = [];
      }
      albumGroups[album].push(song);
    });

    // Sort albums alphabetically and flatten songs
    const sortedAlbums = Object.keys(albumGroups).sort();
    const result = [];
    sortedAlbums.forEach(album => {
      // Sort songs within each album by track number if available, then by title
      const albumSongs = albumGroups[album].sort((a, b) => {
        return (a.title || '').localeCompare(b.title || '');
      });
      result.push(...albumSongs);
    });

    return result;
  }

  // Context menu methods
  setupContextMenu() {
    // Hide context menu when clicking elsewhere
    document.addEventListener('click', (e) => {
      if (!this.contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
    });

    // Context menu event listeners
    document.getElementById('context-play-song').addEventListener('click', () => {
      if (this.contextMenuSong) {
        this.playSong(this.contextMenuSong.id);
        this.hideContextMenu();
      }
    });

    document.getElementById('context-play-next').addEventListener('click', () => {
      if (this.contextMenuSong) {
        window.audioPlayer.playNext(this.contextMenuSong);
        this.notificationService.showNotification(`"${this.contextMenuSong.title}" will play next`, 'success');
        this.hideContextMenu();
      }
    });

    document.getElementById('context-add-to-queue').addEventListener('click', () => {
      if (this.contextMenuSong) {
        window.audioPlayer.addToQueue(this.contextMenuSong);
        this.notificationService.showNotification(`"${this.contextMenuSong.title}" added to queue`, 'success');
        this.hideContextMenu();
      }
    });

    document.getElementById('context-search-artist').addEventListener('click', () => {
      if (this.contextMenuSong) {
        this.searchByArtist(this.contextMenuSong.artist);
        this.hideContextMenu();
      }
    });

    document.getElementById('context-search-album').addEventListener('click', () => {
      if (this.contextMenuSong) {
        this.searchByAlbum(this.contextMenuSong.album);
        this.hideContextMenu();
      }
    });

    document.getElementById('context-like-song').addEventListener('click', () => {
      if (this.contextMenuSong) {
        this.toggleLikeSong(this.contextMenuSong.id);
        this.hideContextMenu();
      }
    });

    document.getElementById('context-delete-song').addEventListener('click', () => {
      if (this.contextMenuSelectedSongs && this.contextMenuSelectedSongs.length > 1) {
        this.deleteMultipleSongs(this.contextMenuSelectedSongs);
      } else if (this.contextMenuSong) {
        this.deleteSong(this.contextMenuSong.id);
      }
      this.hideContextMenu();
    });

    // Multi-selection event handlers
    document.getElementById('context-add-selected-to-queue').addEventListener('click', () => {
      if (this.contextMenuSelectedSongs && this.contextMenuSelectedSongs.length > 0) {
        this.addMultipleSongsToQueue(this.contextMenuSelectedSongs);
        this.hideContextMenu();
      }
    });

    document.getElementById('context-deselect-all').addEventListener('click', () => {
      this.songRenderer.clearSelection();
      this.hideContextMenu();
    });

    // Prevent context menu from showing on right-click of context menu itself
    this.contextMenu.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  showContextMenu(e, song, selectedSongs = []) {
    e.preventDefault();
    this.contextMenuSong = song;
    this.contextMenuSelectedSongs = selectedSongs.length > 1 ? selectedSongs : [song];

    const isMultiSelect = selectedSongs.length > 1;
    
    // Show/hide appropriate menu sections
    const singleOptions = this.contextMenu.querySelector('.single-song-options');
    const multiOptions = this.contextMenu.querySelector('.multi-song-options');
    const singleOnly = this.contextMenu.querySelector('.single-song-only');
    
    if (singleOptions) singleOptions.style.display = isMultiSelect ? 'none' : 'block';
    if (multiOptions) multiOptions.style.display = isMultiSelect ? 'block' : 'none';
    if (singleOnly) singleOnly.style.display = isMultiSelect ? 'none' : 'block';

    // Update text content based on selection
    if (isMultiSelect) {
      const count = selectedSongs.length;
      document.getElementById('context-add-selected-queue-text').textContent = `Add ${count} Songs to Queue`;
      document.getElementById('context-add-playlist-text').textContent = `Add ${count} Songs to Playlist`;
      document.getElementById('context-delete-text').textContent = `Delete ${count} Songs from Library`;
    } else {
      // Single song content
      this.contextArtistName.textContent = song.artist || 'Unknown Artist';
      this.contextAlbumName.textContent = song.album || 'Unknown Album';
      this.contextLikeText.textContent = song.is_liked ? 'Unlike Song' : 'Like Song';
      document.getElementById('context-add-playlist-text').textContent = 'Add to Playlist';
      document.getElementById('context-delete-text').textContent = 'Delete from Library';
    }
    
    // Populate playlist submenu
    this.populatePlaylistSubmenu();

    // Temporarily show menu off-screen to measure its dimensions
    this.contextMenu.style.left = '-9999px';
    this.contextMenu.style.top = '-9999px';
    this.contextMenu.classList.add('show');
    
    // Get actual menu dimensions
    const menuRect = this.contextMenu.getBoundingClientRect();
    const menuWidth = menuRect.width;
    const menuHeight = menuRect.height;

    let x = e.clientX;
    let y = e.clientY;

    // Adjust position if menu would go off-screen horizontally
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    
    // Adjust position if menu would go off-screen vertically
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    // Ensure menu doesn't go above the top of the screen
    if (y < 10) {
      y = 10;
    }

    // Position the menu
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
  }

  hideContextMenu() {
    this.contextMenu.classList.remove('show');
    this.contextMenuSong = null;
  }

  populatePlaylistSubmenu() {
    const playlistSubmenu = document.getElementById('playlist-submenu');
    if (!playlistSubmenu) return;

    // Filter out "All Songs" playlist and get user-created playlists
    const userPlaylists = this.playlists.filter(playlist => playlist.name !== 'All Songs');
    
    playlistSubmenu.innerHTML = userPlaylists.map(playlist => `
      <div class="context-menu-item playlist-submenu-item" data-playlist-id="${playlist.id}">
        <i data-lucide="music"></i>
        ${playlist.name}
      </div>
    `).join('');

    // Add event listeners to playlist submenu items
    playlistSubmenu.querySelectorAll('.playlist-submenu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const playlistId = parseInt(item.dataset.playlistId);
        
        if (this.contextMenuSelectedSongs && this.contextMenuSelectedSongs.length > 1) {
          this.addMultipleSongsToPlaylist(this.contextMenuSelectedSongs, playlistId);
        } else {
          this.addSongToPlaylist(this.contextMenuSong.id, playlistId);
        }
        
        this.hideContextMenu();
      });
    });

    // Re-initialize Lucide icons for new elements
    if (typeof window.localIcons !== 'undefined') {
      window.localIcons.createIcons();
    }
  }

  async addSongToPlaylist(songId, playlistId) {
    try {
      const result = await window.electronAPI.addSongToPlaylist(playlistId, songId);
      if (result.success) {
        const playlist = this.playlists.find(p => p.id === playlistId);
        const playlistName = playlist ? playlist.name : 'playlist';
        this.notificationService.showNotification(`Song added to "${playlistName}"`, 'success');
        
        // Refresh playlists to update song counts
        await this.loadPlaylists();
      } else {
        this.notificationService.showNotification('Error adding song to playlist: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error adding song to playlist:', error);
      this.notificationService.showNotification('Error adding song to playlist', 'error');
    }
  }

  async addMultipleSongsToPlaylist(songs, playlistId) {
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const song of songs) {
        const result = await window.electronAPI.addSongToPlaylist(playlistId, song.id);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      const playlist = this.playlists.find(p => p.id === playlistId);
      const playlistName = playlist ? playlist.name : 'playlist';
      
      if (successCount > 0) {
        this.notificationService.showNotification(
          `${successCount} song${successCount === 1 ? '' : 's'} added to "${playlistName}"`,
          'success'
        );
      }
      
      if (errorCount > 0) {
        this.notificationService.showNotification(
          `${errorCount} song${errorCount === 1 ? '' : 's'} could not be added`,
          'warning'
        );
      }
      
      // Refresh playlists to update song counts
      await this.loadPlaylists();
    } catch (error) {
      console.error('Error adding songs to playlist:', error);
      this.notificationService.showNotification('Error adding songs to playlist', 'error');
    }
  }

  searchByArtist(artist) {
    if (!artist || artist === 'Unknown Artist') return;
    this.searchInput.value = artist;
    this.handleSearch(artist);
  }

  searchByAlbum(album) {
    if (!album || album === 'Unknown Album') return;
    this.searchInput.value = album;
    this.handleSearch(album);
  }

  playMultipleSongs(songs) {
    if (songs.length === 0) return;
    
    // Play the first song and set up the playlist
    window.audioPlayer.playPlaylist(songs, 0);
    this.notificationService.showNotification(`Playing ${songs.length} songs`, 'success');
  }

  addMultipleSongsToQueue(songs) {
    songs.forEach(song => {
      window.audioPlayer.addToQueue(song);
    });
    
    this.notificationService.showNotification(
      `${songs.length} song${songs.length === 1 ? '' : 's'} added to queue`,
      'success'
    );
  }

  async deleteMultipleSongs(songs) {
    const confirmDelete = confirm(`Are you sure you want to delete ${songs.length} songs from your library?\n\nThis action cannot be undone.`);
    
    if (confirmDelete) {
      let successCount = 0;
      let errorCount = 0;

      for (const song of songs) {
        try {
          const result = await window.electronAPI.deleteSong(song.id);
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error('Error deleting song:', error);
          errorCount++;
        }
      }

      // Show results
      if (successCount > 0) {
        this.notificationService.showNotification(
          `${successCount} song${successCount === 1 ? '' : 's'} deleted`,
          'success'
        );
      }
      
      if (errorCount > 0) {
        this.notificationService.showNotification(
          `${errorCount} song${errorCount === 1 ? '' : 's'} could not be deleted`,
          'error'
        );
      }

      // Refresh the UI
      await this.loadData();
      this.renderCurrentView();
      
      // Clear selection after delete
      if (this.songRenderer) {
        this.songRenderer.clearSelection();
      }
    }
  }

  setupMediaKeys() {
    // Register media keys
    window.electronAPI.registerMediaKeys();

    // Listen for media key events
    window.electronAPI.onMediaKeyPlayPause(() => {
      if (window.audioPlayer) {
        window.audioPlayer.togglePlayPause();
      }
    });

    window.electronAPI.onMediaKeyNext(() => {
      if (window.audioPlayer) {
        window.audioPlayer.nextTrack();
      }
    });

    window.electronAPI.onMediaKeyPrevious(() => {
      if (window.audioPlayer) {
        window.audioPlayer.previousTrack();
      }
    });

    console.log('Media keys setup complete');
  }

  async showOverlayNotification(song) {
    try {
      // Get album art data for the overlay
      let albumArtData = null;
      let albumArtFormat = null;

      try {
        const albumArtResult = await window.electronAPI.getAlbumArt(song.id);
        if (albumArtResult.success && albumArtResult.data) {
          albumArtData = Array.from(albumArtResult.data);
          albumArtFormat = albumArtResult.format;
        }
      } catch (albumArtError) {
        console.log('No album art available for overlay');
      }

      const songData = {
        title: song.title,
        artist: song.artist,
        album: song.album,
        albumArtData: albumArtData,
        albumArtFormat: albumArtFormat
      };

      await window.electronAPI.showOverlayNotification(songData);
    } catch (error) {
      console.error('Error showing overlay notification:', error);
    }
  }

  async trackSongPlay(songId) {
    try {
      await window.electronAPI.trackSongPlay(songId);
      // Reload recently played list
      this.recentlyPlayed = await window.electronAPI.getRecentlyPlayed();
    } catch (error) {
      console.error('Error tracking song play:', error);
    }
  }

  async loadAppVersion() {
    try {
      const versionInfo = await window.electronAPI.getAppVersion();
      const versionSpan = document.getElementById('app-version');
      if (versionSpan && versionInfo) {
        versionSpan.textContent = versionInfo.version;
      }
    } catch (error) {
      console.error('Error loading app version:', error);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MusicPlayer;
} else {
  window.MusicPlayer = MusicPlayer;
}