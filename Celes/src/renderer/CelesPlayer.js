class CelesPlayer {
  constructor() {
    this.currentView = 'home';
    this.currentSearchResults = [];
    this.currentPlatform = 'youtube';
    this.searchHistory = [];
    this.isPlaying = false;
    this.currentTrack = null;
    this.volume = 100;
    
    this.initializeElements();
    this.initializeServices();
    this.bindEvents();
    this.initializeDefaultContent();
  }

  initializeElements() {
    // Navigation
    this.navItems = document.querySelectorAll('.nav-item');
    this.viewContents = document.querySelectorAll('.view-content');
    
    // Search elements
    this.searchInput = document.getElementById('search-input');
    this.searchClear = document.getElementById('search-clear');
    this.searchResults = document.getElementById('search-results');
    this.browseCategories = document.getElementById('browse-categories');
    this.topResult = document.getElementById('top-result');
    this.searchSongList = document.getElementById('search-song-list');
    
    // Player controls
    this.playPauseBtn = document.getElementById('play-pause-btn');
    this.prevBtn = document.getElementById('previous-btn');
    this.nextBtn = document.getElementById('next-btn');
    this.shuffleBtn = document.getElementById('shuffle-btn');
    this.repeatBtn = document.getElementById('repeat-btn');
    
    // Player info
    this.currentTrackImage = document.getElementById('current-track-image');
    this.currentTrackName = document.getElementById('current-track-name');
    this.currentTrackArtist = document.getElementById('current-track-artist');
    
    // Progress and volume
    this.progressFill = document.getElementById('progress-fill');
    this.progressHandle = document.getElementById('progress-handle');
    this.timeElapsed = document.getElementById('time-elapsed');
    this.timeTotal = document.getElementById('time-total');
    this.volumeFill = document.getElementById('volume-fill');
    this.volumeHandle = document.getElementById('volume-handle');
    this.volumeBtn = document.getElementById('volume-btn');
    
    // Content grids
    this.recentlyPlayed = document.getElementById('recently-played');
    this.madeForYou = document.getElementById('made-for-you');
    this.popularPlaylists = document.getElementById('popular-playlists');
    
    // Library
    this.libraryFilters = document.querySelectorAll('.filter-pill');
    this.libraryList = document.getElementById('library-list');
    
    // Audio player - create dedicated streaming audio element
    this.audioPlayer = document.getElementById('audio-player');
    
    // Create a dedicated streaming audio element to avoid conflicts
    this.streamingAudio = new Audio();
    this.streamingAudio.id = 'streaming-audio';
    this.streamingAudio.preload = 'metadata';
    this.streamingAudio.crossOrigin = 'anonymous';
    
    console.log('CelesPlayer: Created dedicated streaming audio element');
    
    // User controls
    this.profileBtn = document.getElementById('profile-btn');
    this.backBtn = document.getElementById('back-btn');
    this.forwardBtn = document.getElementById('forward-btn');
    
    // Like button
    this.likeBtn = document.getElementById('like-track-btn');
  }

  initializeServices() {
    this.streamingManager = new StreamingManager();
    window.streamingManager = this.streamingManager; // Make it globally available for button clicks
    this.notificationService = window.notificationService || new NotificationService();
  }

  bindEvents() {
    // Navigation
    this.navItems.forEach(item => {
      item.addEventListener('click', () => this.switchView(item.dataset.view));
    });

    // Search functionality
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => this.handleSearchInput(e));
      this.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.performSearch(e.target.value);
      });
    }

    if (this.searchClear) {
      this.searchClear.addEventListener('click', () => this.clearSearch());
    }

    // Player controls
    if (this.playPauseBtn) {
      this.playPauseBtn.addEventListener('click', () => this.togglePlayback());
    }

    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => this.previousTrack());
    }

    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.nextTrack());
    }

    if (this.shuffleBtn) {
      this.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
    }

    if (this.repeatBtn) {
      this.repeatBtn.addEventListener('click', () => this.toggleRepeat());
    }

    if (this.likeBtn) {
      this.likeBtn.addEventListener('click', () => this.toggleLike());
    }

    // Volume controls
    if (this.volumeBtn) {
      this.volumeBtn.addEventListener('click', () => this.toggleMute());
    }

    // Library filters
    this.libraryFilters.forEach(filter => {
      filter.addEventListener('click', () => this.filterLibrary(filter.dataset.filter));
    });

    // Category cards
    const categoryCards = document.querySelectorAll('.category-card');
    categoryCards.forEach(card => {
      card.addEventListener('click', () => this.searchByCategory(card.querySelector('span').textContent));
    });

    // Quick access items
    const quickAccessItems = document.querySelectorAll('.quick-access-item');
    quickAccessItems.forEach(item => {
      item.addEventListener('click', () => this.openStellarCollection());
    });

    // Streaming audio events
    if (this.streamingAudio) {
      this.streamingAudio.addEventListener('timeupdate', () => this.updateProgress());
      this.streamingAudio.addEventListener('ended', () => this.nextTrack());
      this.streamingAudio.addEventListener('loadedmetadata', () => this.updateDuration());
      this.streamingAudio.addEventListener('pause', () => {
        this.isPlaying = false;
        this.updatePlayButton();
      });
      this.streamingAudio.addEventListener('play', () => {
        this.isPlaying = true;
        this.updatePlayButton();
      });
    }
  }

  switchView(viewName) {
    // Update navigation active state
    this.navItems.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.view === viewName) {
        item.classList.add('active');
      }
    });

    // Switch content views
    this.viewContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === `${viewName}-view`) {
        content.classList.add('active');
      }
    });

    this.currentView = viewName;

    // Load view-specific content
    switch (viewName) {
      case 'home':
        this.loadHomeContent();
        break;
      case 'search':
        this.focusSearch();
        break;
      case 'library':
        this.loadLibraryContent();
        break;
    }
  }

  handleSearchInput(e) {
    const query = e.target.value;
    
    if (query.length > 0) {
      this.searchClear.style.display = 'block';
      if (query.length > 2) {
        this.showSearchSuggestions(query);
      }
    } else {
      this.searchClear.style.display = 'none';
      this.showBrowseCategories();
    }
  }

  async performSearch(query) {
    if (!query.trim()) return;

    console.log('CelesPlayer: Starting search for:', query);
    this.hideSearchSuggestions();
    this.hideBrowseCategories();
    this.showSearchResults();

    try {
      // Show loading state
      this.showSearchLoading(true);
      
      // Perform actual search using streaming manager
      console.log('CelesPlayer: Calling streamingManager.searchMusic');
      const results = await this.streamingManager.searchMusic(query, this.currentPlatform, 20);
      console.log('CelesPlayer: Search results:', results);
      
      if (results.length > 0) {
        console.log('CelesPlayer: Displaying', results.length, 'results');
        this.displaySearchResults(results);
        this.addToSearchHistory(query);
      } else {
        console.log('CelesPlayer: No results found');
        this.showNoResults();
      }
    } catch (error) {
      console.error('CelesPlayer: Search error:', error);
      this.showNotification('Search failed. Please try again.', 'error');
    } finally {
      this.showSearchLoading(false);
    }
  }

  displaySearchResults(results) {
    console.log('CelesPlayer: displaySearchResults called with:', results);
    if (!results || results.length === 0) {
      console.log('CelesPlayer: No results to display');
      this.showNoResults();
      return;
    }
    
    // Log first few results to see extracted titles/artists
    console.log('CelesPlayer: First 3 results:');
    results.slice(0, 3).forEach((result, i) => {
      console.log(`  ${i + 1}: "${result.title}" by "${result.artist}" [${result.id}]`);
    });

    // Show top result
    if (this.topResult) {
      const topTrack = results[0];
      console.log('CelesPlayer: Creating top result for:', topTrack);
      this.topResult.innerHTML = this.createTopResultCard(topTrack);
      
      // Add event listener for top result play button
      const topPlayBtn = this.topResult.querySelector('.top-result-play-btn');
      if (topPlayBtn) {
        console.log('CelesPlayer: Adding event listener to top result play button');
        topPlayBtn.addEventListener('click', (e) => {
          console.log('CelesPlayer: Top result play button clicked!');
          e.stopPropagation();
          
          try {
            const trackData = JSON.parse(topPlayBtn.dataset.track);
            console.log('CelesPlayer: Top result track data:', trackData);
            this.playTrack(trackData);
          } catch (parseError) {
            console.error('CelesPlayer: Failed to parse top result track data:', parseError);
          }
        });
      }
    }

    // Show song list
    if (this.searchSongList) {
      console.log('CelesPlayer: Creating song list for', results.slice(0, 5).length, 'tracks');
      const songsHTML = results.slice(0, 5).map((track, index) => 
        this.createSongItem(track, index + 1)
      ).join('');
      console.log('CelesPlayer: Generated HTML length:', songsHTML.length);
      this.searchSongList.innerHTML = songsHTML;

      // Add click listeners for play buttons
      const playBtns = this.searchSongList.querySelectorAll('.play-track-btn');
      console.log('CelesPlayer: Found', playBtns.length, 'play buttons');
      playBtns.forEach((btn, index) => {
        console.log('CelesPlayer: Adding event listener to play button', index);
        btn.addEventListener('click', (e) => {
          console.log('CelesPlayer: Play button clicked!', e.target);
          console.log('CelesPlayer: Button dataset.track:', btn.dataset.track);
          e.stopPropagation(); // Prevent event bubbling
          
          try {
            const trackData = JSON.parse(btn.dataset.track);
            console.log('CelesPlayer: Parsed track data:', trackData);
            this.playTrack(trackData);
          } catch (parseError) {
            console.error('CelesPlayer: Failed to parse track data:', parseError);
            console.error('CelesPlayer: Raw track data:', btn.dataset.track);
          }
        });
      });

      // Add click listeners for add buttons
      const addBtns = this.searchSongList.querySelectorAll('.add-track-btn');
      console.log('CelesPlayer: Found', addBtns.length, 'add buttons');
      addBtns.forEach((btn, index) => {
        console.log('CelesPlayer: Adding event listener to add button', index);
        btn.addEventListener('click', (e) => {
          console.log('CelesPlayer: Add button clicked!', e.target);
          e.stopPropagation(); // Prevent event bubbling
          const trackData = JSON.parse(btn.dataset.track);
          this.addToPlaylist(trackData);
        });
      });

      // Keep the existing song item click listeners for backward compatibility
      const songItems = this.searchSongList.querySelectorAll('.song-item');
      console.log('CelesPlayer: Found', songItems.length, 'song items');
      songItems.forEach((item, index) => {
        item.addEventListener('click', (e) => {
          console.log('CelesPlayer: Song item clicked!', e.target);
          // Only trigger if not clicking on buttons
          if (!e.target.closest('.song-actions')) {
            this.playTrack(results[index]);
          }
        });
      });
    } else {
      console.log('CelesPlayer: searchSongList element not found!');
    }

    this.currentSearchResults = results;
  }

  createTopResultCard(track) {
    return `
      <div class="top-result-content" data-track-id="${track.id}">
        <img src="${track.thumbnail || 'https://via.placeholder.com/100x100/4a9eff/ffffff?text=♫'}" 
             alt="${track.title}" class="top-result-image">
        <div class="top-result-info">
          <h4 class="top-result-title">${track.title}</h4>
          <p class="top-result-artist">${track.artist}</p>
          <span class="top-result-type">${track.platform}</span>
        </div>
        <button class="play-btn-large top-result-play-btn" data-track='${JSON.stringify(track).replace(/'/g, "&#39;")}'>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="m7.4 5.65 8.15 5.35a1 1 0 0 1 0 1.7L7.4 18.05a1 1 0 0 1-1.55-.85V6.5a1 1 0 0 1 1.55-.85z"/>
          </svg>
        </button>
      </div>
    `;
  }

  createSongItem(track, index) {
    const duration = this.formatDuration(track.duration);
    const html = `
      <div class="song-item card card-hover" data-track-id="${track.id}">
        <div class="card-content" style="padding: var(--space-3);">
          <div class="flex items-center gap-3">
            <span class="song-index text-muted text-sm font-medium">${index}</span>
            <img src="${track.thumbnail || 'https://via.placeholder.com/48x48/4a9eff/ffffff?text=♫'}" 
                 alt="${track.title}" class="song-image rounded-md" style="width: 48px; height: 48px; object-fit: cover;">
            <div class="song-info flex-1">
              <div class="song-title text-sm font-medium text-primary">${track.title}</div>
              <div class="song-artist text-xs text-muted">${track.artist}</div>
            </div>
            <span class="song-duration text-xs text-muted">${duration}</span>
            <div class="song-actions flex gap-2">
              <button class="btn btn-primary btn-sm btn-icon-sm play-track-btn" title="Play" data-track='${JSON.stringify(track).replace(/'/g, "&#39;")}'>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="m7.4 5.65 8.15 5.35a1 1 0 0 1 0 1.7L7.4 18.05a1 1 0 0 1-1.55-.85V6.5a1 1 0 0 1 1.55-.85z"/>
                </svg>
              </button>
              <button class="btn btn-secondary btn-sm btn-icon-sm add-track-btn" title="Add to playlist" data-track='${JSON.stringify(track).replace(/'/g, "&#39;")}'>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2v20M2 12h20"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    console.log('CelesPlayer: createSongItem generated HTML for', track.title);
    return html;
  }

  async playTrack(track) {
    try {
      this.showNotification('Loading track...', 'info');
      
      // If this is a basic search result (placeholder title), get real track info first
      let actualTrack = track;
      if (track.title.includes('Track ') && track.title.includes('(') && track.platform === 'youtube') {
        try {
          console.log('CelesPlayer: Getting real track info for', track.id);
          const trackInfo = await window.electronAPI.getTrackInfo(track.id, track.platform);
          if (trackInfo) {
            actualTrack = trackInfo;
            console.log('CelesPlayer: Got real track info:', actualTrack.title);
          }
        } catch (infoError) {
          console.warn('CelesPlayer: Could not get track info, using basic info:', infoError);
        }
      }
      
      // Get stream URL
      console.log('CelesPlayer: Getting stream URL for', actualTrack.id, actualTrack.platform);
      const streamUrl = await this.streamingManager.getStreamUrl(actualTrack.id, actualTrack.platform);
      console.log('CelesPlayer: Stream URL received:', streamUrl ? 'SUCCESS' : 'FAILED');
      
      if (!streamUrl) {
        throw new Error('Could not get stream URL');
      }

      // Update player UI with actual track info
      this.updateNowPlaying(actualTrack);
      
      // Load and play audio with better error handling using dedicated streaming audio
      console.log('CelesPlayer: Setting audio source and attempting to play...');
      
      if (!this.streamingAudio) {
        console.error('CelesPlayer: Streaming audio element not found!');
        throw new Error('Streaming audio not available');
      }
      
      // Stop any existing playback
      if (!this.streamingAudio.paused) {
        this.streamingAudio.pause();
      }
      
      // Add event listeners for debugging
      const onCanPlay = () => {
        console.log('CelesPlayer: Streaming audio can play');
        this.streamingAudio.removeEventListener('canplay', onCanPlay);
      };
      
      const onError = (e) => {
        console.error('CelesPlayer: Streaming audio error:', e, this.streamingAudio.error);
        this.streamingAudio.removeEventListener('error', onError);
      };
      
      const onLoadStart = () => {
        console.log('CelesPlayer: Streaming audio load started');
        this.streamingAudio.removeEventListener('loadstart', onLoadStart);
      };
      
      this.streamingAudio.addEventListener('canplay', onCanPlay);
      this.streamingAudio.addEventListener('error', onError);
      this.streamingAudio.addEventListener('loadstart', onLoadStart);
      
      console.log('CelesPlayer: Setting stream URL:', streamUrl.substring(0, 100) + '...');
      this.streamingAudio.src = streamUrl;
      this.streamingAudio.load();
      
      try {
        console.log('CelesPlayer: About to call streamingAudio.play()');
        const playPromise = this.streamingAudio.play();
        console.log('CelesPlayer: play() returned promise:', playPromise);
        
        await playPromise;
        console.log('CelesPlayer: Streaming audio play() succeeded');
        console.log('CelesPlayer: Audio duration:', this.streamingAudio.duration);
        console.log('CelesPlayer: Audio current time:', this.streamingAudio.currentTime);
        console.log('CelesPlayer: Audio paused:', this.streamingAudio.paused);
        
        this.isPlaying = true;
        this.currentTrack = actualTrack;
        this.updatePlayButton();
        
        this.showNotification(`Now playing: ${actualTrack.title}`, 'success');
      } catch (playError) {
        console.error('CelesPlayer: Streaming audio play() failed:', playError);
        
        // Try to get more specific error information
        if (this.streamingAudio.error) {
          console.error('CelesPlayer: Streaming audio error code:', this.streamingAudio.error.code);
          console.error('CelesPlayer: Streaming audio error message:', this.streamingAudio.error.message);
        }
        
        throw new Error(`Audio playback failed: ${playError.message}`);
      }
    } catch (error) {
      console.error('Play error:', error);
      this.showNotification('Failed to play track', 'error');
    }
  }

  updateNowPlaying(track) {
    if (this.currentTrackImage) {
      this.currentTrackImage.src = track.thumbnail || 'https://via.placeholder.com/56x56/4a9eff/ffffff?text=♫';
    }
    if (this.currentTrackName) {
      this.currentTrackName.textContent = track.title;
    }
    if (this.currentTrackArtist) {
      this.currentTrackArtist.textContent = track.artist;
    }
  }

  togglePlayback() {
    if (!this.streamingAudio.src) {
      this.showNotification('Select a track to play', 'info');
      return;
    }

    if (this.isPlaying) {
      this.streamingAudio.pause();
      this.isPlaying = false;
    } else {
      this.streamingAudio.play();
      this.isPlaying = true;
    }
    
    this.updatePlayButton();
  }

  updatePlayButton() {
    const playIcon = this.playPauseBtn.querySelector('.play-icon');
    const pauseIcon = this.playPauseBtn.querySelector('.pause-icon');
    
    if (this.isPlaying) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
    } else {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
    }
  }

  clearSearch() {
    this.searchInput.value = '';
    this.searchClear.style.display = 'none';
    this.hideSearchResults();
    this.showBrowseCategories();
  }

  showSearchResults() {
    if (this.searchResults) this.searchResults.style.display = 'grid';
    if (this.browseCategories) this.browseCategories.style.display = 'none';
  }

  hideSearchResults() {
    if (this.searchResults) this.searchResults.style.display = 'none';
  }

  showBrowseCategories() {
    if (this.browseCategories) this.browseCategories.style.display = 'block';
  }

  hideBrowseCategories() {
    if (this.browseCategories) this.browseCategories.style.display = 'none';
  }

  showSearchLoading(show) {
    // Implementation for loading state
  }

  showNoResults() {
    if (this.searchSongList) {
      this.searchSongList.innerHTML = `
        <div class="no-results">
          <div class="no-results-icon">🔍</div>
          <h3>No results found</h3>
          <p>Try adjusting your search terms</p>
        </div>
      `;
    }
  }

  loadHomeContent() {
    // Load recently played, made for you, etc.
    this.loadRecentlyPlayed();
    this.loadMadeForYou();
    this.loadPopularPlaylists();
  }

  loadRecentlyPlayed() {
    // Mock implementation - replace with actual data
    const mockTracks = [
      { title: 'Stellar Journey', artist: 'Cosmic Artist', image: 'https://via.placeholder.com/180x180/4a9eff/ffffff?text=♫' },
      { title: 'Midnight Symphony', artist: 'Aurora Band', image: 'https://via.placeholder.com/180x180/1e1e3f/ffffff?text=♫' }
    ];

    if (this.recentlyPlayed) {
      this.recentlyPlayed.innerHTML = mockTracks.map(track => this.createContentCard(track)).join('');
    }
  }

  loadMadeForYou() {
    // Mock implementation
    const mockPlaylists = [
      { title: 'Cosmic Mix', subtitle: 'Made for you', image: 'https://via.placeholder.com/180x180/6b7ab8/ffffff?text=CM' },
      { title: 'Stellar Discoveries', subtitle: 'Your weekly mix', image: 'https://via.placeholder.com/180x180/4a9eff/ffffff?text=SD' }
    ];

    if (this.madeForYou) {
      this.madeForYou.innerHTML = mockPlaylists.map(playlist => this.createContentCard(playlist)).join('');
    }
  }

  loadPopularPlaylists() {
    // Mock implementation
    if (this.popularPlaylists) {
      this.popularPlaylists.innerHTML = '<div class="loading">Loading popular playlists...</div>';
    }
  }

  createContentCard(item) {
    return `
      <div class="content-card">
        <img src="${item.image}" alt="${item.title}" class="content-card-image">
        <div class="content-card-title">${item.title}</div>
        <div class="content-card-subtitle">${item.subtitle || item.artist}</div>
      </div>
    `;
  }

  focusSearch() {
    if (this.searchInput) {
      setTimeout(() => this.searchInput.focus(), 100);
    }
  }

  formatDuration(seconds) {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  showNotification(message, type = 'info') {
    if (this.notificationService) {
      this.notificationService.showNotification(message, type);
    } else {
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }

  async addToPlaylist(track) {
    try {
      // For now, just show a notification. In the future, this could open a playlist selector
      this.showNotification(`Added "${track.title}" to your library!`, 'success');
      
      // Optionally add the track to the database as a streaming track
      const trackData = {
        title: track.title,
        artist: track.artist,
        album: track.album || 'Streaming',
        duration: track.duration,
        platform: track.platform,
        stream_id: track.id,
        stream_url: null,
        thumbnail_url: track.thumbnail
      };
      
      await window.electronAPI.addStreamingTrack(trackData);
    } catch (error) {
      console.error('Error adding to playlist:', error);
      this.showNotification('Failed to add track', 'error');
    }
  }

  // Audio control methods
  updateProgress() {
    if (!this.streamingAudio || !this.progressFill || !this.timeElapsed) return;
    
    const currentTime = this.streamingAudio.currentTime;
    const duration = this.streamingAudio.duration;
    
    if (duration && !isNaN(duration)) {
      const progress = (currentTime / duration) * 100;
      this.progressFill.style.width = `${progress}%`;
      
      // Update progress handle position
      if (this.progressHandle) {
        this.progressHandle.style.left = `${progress}%`;
      }
      
      // Update time display
      this.timeElapsed.textContent = this.formatTime(currentTime);
    }
  }
  
  updateDuration() {
    if (!this.streamingAudio || !this.timeTotal) return;
    
    const duration = this.streamingAudio.duration;
    if (duration && !isNaN(duration)) {
      this.timeTotal.textContent = this.formatTime(duration);
    }
  }
  
  formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Placeholder methods for other functionality
  previousTrack() { console.log('Previous track'); }
  nextTrack() { console.log('Next track'); }
  toggleShuffle() { console.log('Toggle shuffle'); }
  toggleRepeat() { console.log('Toggle repeat'); }
  toggleLike() { console.log('Toggle like'); }
  toggleMute() { console.log('Toggle mute'); }
  filterLibrary(filter) { console.log('Filter library:', filter); }
  searchByCategory(category) { this.performSearch(category); }
  openStellarCollection() { console.log('Open stellar collection'); }
  loadLibraryContent() { console.log('Load library'); }
  showSearchSuggestions(query) { /* Show suggestions */ }
  hideSearchSuggestions() { /* Hide suggestions */ }
  addToSearchHistory(query) { this.searchHistory.unshift(query); }
  initializeDefaultContent() { this.loadHomeContent(); }
}

// Make it globally available
window.CelesPlayer = CelesPlayer;