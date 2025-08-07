class StreamingManager {
  constructor() {
    this.currentSearchResults = [];
    this.currentPlatform = 'youtube';
    this.isStreaming = false;
    this.currentTrack = null;
    this.searchHistory = [];
    this.currentFilters = {
      duration: 'all',
      date: 'all',
      sort: 'relevance'
    };
    
    // NO MOCK DATA - All music will come from real APIs
    
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // Streaming button
    const streamingBtn = document.getElementById('streaming-btn');
    if (streamingBtn) {
      streamingBtn.addEventListener('click', () => this.showStreamingModal());
    }

    // Enhanced search functionality with platform tabs
    const searchInput = document.getElementById('search-input');
    console.log('🎵 INIT: Looking for search-input element:', searchInput);
    
    if (searchInput) {
      console.log('🎵 INIT: Found search-input element, adding event listeners');
      searchInput.addEventListener('keypress', (e) => {
        console.log('🎵 INPUT: Key pressed:', e.key);
        if (e.key === 'Enter') {
          console.log('🎵 INPUT: Enter pressed, calling performSearch with value:', searchInput.value);
          this.performSearch(searchInput.value, this.currentPlatform);
        }
      });
      
      // Add search suggestions functionality
      searchInput.addEventListener('input', (e) => {
        console.log('🎵 INPUT: Input changed:', e.target.value);
        this.showSearchSuggestions(e.target.value);
      });
      
      // Hide suggestions when clicking outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
          this.hideSearchSuggestions();
        }
      });
    } else {
      console.error('🎵 INIT: search-input element not found in DOM!');
    }

    // Platform tabs functionality
    const platformTabs = document.querySelectorAll('.platform-tab');
    platformTabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchPlatform(tab.dataset.platform));
    });

    // Advanced filters toggle
    const advancedFiltersToggle = document.getElementById('advanced-filters-toggle');
    if (advancedFiltersToggle) {
      advancedFiltersToggle.addEventListener('click', () => this.toggleAdvancedFilters());
    }

    // Duration filter buttons
    const durationBtns = document.querySelectorAll('.duration-btn');
    durationBtns.forEach(btn => {
      btn.addEventListener('click', () => this.setDurationFilter(btn.dataset.duration));
    });

    // Date filter buttons
    const dateBtns = document.querySelectorAll('.date-btn');
    dateBtns.forEach(btn => {
      btn.addEventListener('click', () => this.setDateFilter(btn.dataset.date));
    });

    // Sort selector
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => this.setSortOption(sortSelect.value));
    }

    // View toggle buttons
    const gridViewBtn = document.getElementById('grid-view-btn');
    const listViewBtn = document.getElementById('list-view-btn');
    
    if (gridViewBtn && listViewBtn) {
      gridViewBtn.addEventListener('click', () => this.switchView('grid'));
      listViewBtn.addEventListener('click', () => this.switchView('list'));
    }

    // Play all search button
    const playAllSearchBtn = document.getElementById('play-all-search-btn');
    if (playAllSearchBtn) {
      playAllSearchBtn.addEventListener('click', () => this.playAllSearchResults());
    }

    // Streaming modal
    const streamingModal = document.getElementById('streaming-modal');
    const streamingModalClose = document.getElementById('streaming-modal-close');
    
    if (streamingModalClose) {
      streamingModalClose.addEventListener('click', () => this.hideStreamingModal());
    }

    // Streaming search
    const streamingSearchBtn = document.getElementById('streaming-search-btn');
    const streamingSearchInput = document.getElementById('streaming-search-input');
    const streamingPlatformSelect = document.getElementById('streaming-platform-select');
    
    if (streamingSearchBtn && streamingSearchInput) {
      streamingSearchBtn.addEventListener('click', () => {
        this.performStreamingSearch(streamingSearchInput.value, streamingPlatformSelect.value);
      });
    }

    // Streaming tabs
    const streamingTabs = document.querySelectorAll('.streaming-tab');
    streamingTabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchStreamingTab(tab.dataset.tab));
    });

    // Search results filter
    const searchFilterPlatform = document.getElementById('search-filter-platform');
    if (searchFilterPlatform) {
      searchFilterPlatform.addEventListener('change', () => this.filterSearchResults());
    }
  }

  // Enhanced search interface methods
  switchPlatform(platform) {
    this.currentPlatform = platform;
    
    // Update active tab
    const platformTabs = document.querySelectorAll('.platform-tab');
    platformTabs.forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.platform === platform) {
        tab.classList.add('active');
      }
    });
    
    // Re-search if there's a current query
    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value.trim()) {
      this.performSearch(searchInput.value, platform);
    }
  }

  toggleAdvancedFilters() {
    const filtersContainer = document.getElementById('advanced-filters');
    const toggleBtn = document.getElementById('advanced-filters-toggle');
    
    if (filtersContainer.style.display === 'block') {
      filtersContainer.style.display = 'none';
      toggleBtn.innerHTML = '<i data-lucide="chevron-down"></i><span>Show Filters</span>';
    } else {
      filtersContainer.style.display = 'block';
      toggleBtn.innerHTML = '<i data-lucide="chevron-up"></i><span>Hide Filters</span>';
    }
  }

  setDurationFilter(duration) {
    // Update active button
    const durationBtns = document.querySelectorAll('.duration-btn');
    durationBtns.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.duration === duration) {
        btn.classList.add('active');
      }
    });
    
    this.currentFilters = { ...this.currentFilters, duration };
    this.applyFilters();
  }

  setDateFilter(date) {
    // Update active button
    const dateBtns = document.querySelectorAll('.date-btn');
    dateBtns.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.date === date) {
        btn.classList.add('active');
      }
    });
    
    this.currentFilters = { ...this.currentFilters, date };
    this.applyFilters();
  }

  setSortOption(sort) {
    this.currentFilters = { ...this.currentFilters, sort };
    this.applyFilters();
  }

  switchView(viewType) {
    const searchResults = document.getElementById('search-results');
    const gridViewBtn = document.getElementById('grid-view-btn');
    const listViewBtn = document.getElementById('list-view-btn');
    
    if (viewType === 'grid') {
      searchResults.classList.add('grid-view');
      searchResults.classList.remove('list-view');
      gridViewBtn.classList.add('active');
      listViewBtn.classList.remove('active');
    } else {
      searchResults.classList.add('list-view');
      searchResults.classList.remove('grid-view');
      listViewBtn.classList.add('active');
      gridViewBtn.classList.remove('active');
    }
  }

  applyFilters() {
    // Filter and sort current search results
    let filteredResults = [...this.currentSearchResults];
    
    // Apply duration filter
    if (this.currentFilters.duration !== 'all') {
      filteredResults = filteredResults.filter(track => {
        const duration = track.duration;
        switch (this.currentFilters.duration) {
          case 'short': return duration < 240; // Under 4 minutes
          case 'medium': return duration >= 240 && duration < 1200; // 4-20 minutes
          case 'long': return duration >= 1200; // Over 20 minutes
          default: return true;
        }
      });
    }
    
    // Apply sort option
    switch (this.currentFilters.sort) {
      case 'date':
        filteredResults.sort((a, b) => (b.year || 0) - (a.year || 0));
        break;
      case 'views':
        filteredResults.sort((a, b) => (b.viewCount || b.playCount || 0) - (a.viewCount || a.playCount || 0));
        break;
      case 'duration':
        filteredResults.sort((a, b) => (a.duration || 0) - (b.duration || 0));
        break;
      case 'title':
        filteredResults.sort((a, b) => a.title.localeCompare(b.title));
        break;
      default: // relevance - keep original order
        break;
    }
    
    this.displaySearchResults(filteredResults);
    this.updateSearchResultsCount(filteredResults.length);
  }

  playAllSearchResults() {
    if (this.currentSearchResults && this.currentSearchResults.length > 0) {
      // Play the first track and queue the rest
      this.playSearchResult(this.currentSearchResults[0]);
      
      // Add remaining tracks to queue
      for (let i = 1; i < this.currentSearchResults.length; i++) {
        // Queue functionality would need to be implemented in the main player
        console.log('Queueing track:', this.currentSearchResults[i].title);
      }
      
      this.showNotification(`Playing all ${this.currentSearchResults.length} search results`, 'success');
    }
  }

  showSearchSuggestions(query) {
    if (!query.trim() || query.length < 2) {
      this.hideSearchSuggestions();
      return;
    }
    
    const suggestions = this.generateSearchSuggestions(query);
    const suggestionsContainer = document.getElementById('search-suggestions');
    
    if (suggestions.length > 0) {
      suggestionsContainer.innerHTML = suggestions.map(suggestion => `
        <div class="search-suggestion" data-query="${suggestion}">
          <i data-lucide="search"></i>
          <span>${suggestion}</span>
        </div>
      `).join('');
      
      suggestionsContainer.style.display = 'block';
      
      // Add click listeners
      const suggestionItems = suggestionsContainer.querySelectorAll('.search-suggestion');
      suggestionItems.forEach(item => {
        item.addEventListener('click', () => {
          const searchInput = document.getElementById('search-input');
          searchInput.value = item.dataset.query;
          this.performSearch(item.dataset.query, this.currentPlatform);
          this.hideSearchSuggestions();
        });
      });
    } else {
      this.hideSearchSuggestions();
    }
  }

  hideSearchSuggestions() {
    const suggestionsContainer = document.getElementById('search-suggestions');
    if (suggestionsContainer) {
      suggestionsContainer.style.display = 'none';
    }
  }

  generateSearchSuggestions(query) {
    // Generate suggestions based on search history and common patterns
    const suggestions = [];
    
    // Add matching items from search history
    const historyMatches = this.searchHistory
      .filter(item => item.query.toLowerCase().includes(query.toLowerCase()))
      .map(item => item.query)
      .slice(0, 3);
    
    suggestions.push(...historyMatches);
    
    // Add common music search patterns
    const patterns = [
      `${query} acoustic`,
      `${query} remix`,
      `${query} cover`,
      `${query} live`,
      `${query} lyrics`
    ];
    
    patterns.forEach(pattern => {
      if (!suggestions.includes(pattern) && suggestions.length < 5) {
        suggestions.push(pattern);
      }
    });
    
    return suggestions.slice(0, 5);
  }

  updateSearchResultsCount(count) {
    const countElement = document.getElementById('search-results-count');
    if (countElement) {
      countElement.textContent = `${count} result${count !== 1 ? 's' : ''}`;
    }
    
    // Show/hide play all button based on results count
    const playAllBtn = document.getElementById('play-all-search-btn');
    if (playAllBtn) {
      playAllBtn.style.display = count > 0 ? 'block' : 'none';
    }
  }

  async searchMusic(query, platform = 'youtube', limit = 20) {
    if (!query.trim()) return [];

    try {
      const results = await window.electronAPI.searchMusic(query, platform, limit);
      return results || [];
    } catch (error) {
      console.error('StreamingManager search error:', error);
      throw error;
    }
  }

  async searchMusicWithFallback(query, primaryPlatform = 'youtube', limit = 20) {
    if (!query.trim()) return [];

    try {
      const results = await window.electronAPI.searchMusicWithFallback(query, primaryPlatform, limit);
      return results || [];
    } catch (error) {
      console.error('StreamingManager search with fallback error:', error);
      throw error;
    }
  }

  async getStreamUrl(trackId, platform) {
    try {
      const streamUrl = await window.electronAPI.getStreamUrl(trackId, platform);
      return streamUrl;
    } catch (error) {
      console.error('StreamingManager getStreamUrl error:', error);
      throw error;
    }
  }

  async getStreamUrlWithFallback(trackId, primaryPlatform = 'youtube') {
    try {
      const result = await window.electronAPI.getStreamUrlWithFallback(trackId, primaryPlatform);
      return result;
    } catch (error) {
      console.error('StreamingManager getStreamUrlWithFallback error:', error);
      throw error;
    }
  }

  async performSearch(query, platform = 'youtube') {
    console.log('🎵 SEARCH: performSearch called with query:', query, 'platform:', platform);
    if (!query.trim()) return;

    // Initialize filters if not set
    if (!this.currentFilters) {
      this.currentFilters = {
        duration: 'all',
        date: 'all',
        sort: 'relevance'
      };
    }

    try {
      console.log('🎵 SEARCH: Starting search...');
      this.showSearchResults();
      this.updateSearchResultsTitle(`Searching for "${query}"...`);
      this.updateSearchResultsCount(0);
      
      // Use fallback search for better reliability
      console.log('🎵 SEARCH: Calling searchMusicWithFallback...');
      const results = await this.searchMusicWithFallback(query, platform, 20);
      console.log('🎵 SEARCH: Got', results.length, 'results from searchMusicWithFallback');
      this.currentSearchResults = results;
      
      console.log('🎵 SEARCH: Calling applyFilters...');
      this.applyFilters(); // This will call displaySearchResults with filtered results
      console.log('🎵 SEARCH: applyFilters completed');
      
      this.updateSearchResultsTitle(`Search Results for "${query}"`);
      
      // Add to search history
      this.addToSearchHistory(query, platform);
      console.log('🎵 SEARCH: Search completed successfully');
      
    } catch (error) {
      console.error('🎵 SEARCH: Search error:', error);
      this.showNotification('Search failed. Please try again.', 'error');
    }
  }

  async performStreamingSearch(query, platform = 'youtube') {
    if (!query.trim()) return;

    try {
      // Use fallback search for better reliability
      const results = await this.searchMusicWithFallback(query, platform, 20);
      this.displayStreamingSearchResults(results);
      
    } catch (error) {
      console.error('Streaming search error:', error);
      this.showNotification('Search failed. Please try again.', 'error');
    }
  }

  displaySearchResults(results) {
    console.log('🎵 DISPLAY: displaySearchResults called with', results.length, 'results');
    
    const searchResults = document.getElementById('search-results');
    if (!searchResults) {
      console.error('🎵 DISPLAY: search-results element not found!');
      return;
    }
    
    console.log('🎵 DISPLAY: Found search-results element');

    if (results.length === 0) {
      searchResults.innerHTML = `
        <div class="empty-state">
          <i data-lucide="search" class="empty-state-icon"></i>
          <h3>No results found</h3>
          <p>Try a different search term or platform</p>
        </div>
      `;
      return;
    }

    // Generate HTML and set it
    const html = results.map(track => this.createSearchResultCard(track)).join('');
    console.log('🎵 DISPLAY: Generated HTML length:', html.length);
    searchResults.innerHTML = html;
    
    // Add click listeners for play buttons
    const playButtons = searchResults.querySelectorAll('.play-track-btn');
    console.log('🎵 DISPLAY: Found', playButtons.length, 'play buttons');
    
    playButtons.forEach((btn, index) => {
      console.log('🎵 DISPLAY: Adding click listener to play button', index);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🎵 CLICK: Play button clicked!', btn);
        alert('Play button clicked! Check console.');
        try {
          const trackData = JSON.parse(btn.closest('.search-result-item').dataset.trackData);
          console.log('🎵 CLICK: Track data:', trackData);
          this.playSearchResult(trackData);
        } catch (error) {
          console.error('🎵 CLICK: Error parsing track data:', error);
        }
      });
    });
    
    // Add click listeners for add buttons
    const addButtons = searchResults.querySelectorAll('.add-track-btn');
    console.log('🎵 DISPLAY: Found', addButtons.length, 'add buttons');
    
    addButtons.forEach((btn, index) => {
      console.log('🎵 DISPLAY: Adding click listener to add button', index);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🎵 CLICK: Add button clicked!', btn);
        alert('Add button clicked! Check console.');
        try {
          const trackData = JSON.parse(btn.closest('.search-result-item').dataset.trackData);
          console.log('🎵 CLICK: Track data:', trackData);
          this.addToPlaylist(trackData);
        } catch (error) {
          console.error('🎵 CLICK: Error parsing track data:', error);
        }
      });
    });
    
    console.log('🎵 DISPLAY: Event listeners attached');
    
    // Store results for later use
    this.lastSearchResults = results;
  }

  displayStreamingSearchResults(results) {
    const streamingSearchResults = document.getElementById('streaming-search-results');
    if (!streamingSearchResults) return;

    if (results.length === 0) {
      streamingSearchResults.innerHTML = `
        <div class="empty-state">
          <i data-lucide="search" class="empty-state-icon"></i>
          <h3>No results found</h3>
          <p>Try a different search term or platform</p>
        </div>
      `;
      return;
    }

    streamingSearchResults.innerHTML = results.map(track => this.createSearchResultCard(track)).join('');
    
    // Add click listeners for play buttons
    const playButtons = streamingSearchResults.querySelectorAll('.play-track-btn');
    playButtons.forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('🎵 CLICK: Streaming play button clicked!');
        const trackData = JSON.parse(btn.closest('.search-result-item').dataset.trackData);
        this.playSearchResult(trackData);
      });
    });
    
    // Add click listeners for add buttons
    const addButtons = streamingSearchResults.querySelectorAll('.add-track-btn');
    addButtons.forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('🎵 CLICK: Streaming add button clicked!');
        const trackData = JSON.parse(btn.closest('.search-result-item').dataset.trackData);
        this.addToPlaylist(trackData);
      });
    });
  }

  createSearchResultCard(track) {
    const platformClass = `platform-${track.platform}`;
    const duration = this.formatDuration(track.duration);
    
    return `
      <div class="search-result-item" data-track-id="${track.id}" data-platform="${track.platform}" data-track-data='${JSON.stringify(track).replace(/'/g, "&#39;")}'>
        <img src="${track.thumbnail || '../assets/icons/music.svg'}" alt="${track.title}" class="search-result-thumbnail">
        <div class="search-result-title">${track.title}</div>
        <div class="search-result-artist">${track.artist}</div>
        <div class="search-result-platform ${platformClass}">${track.platform}</div>
        <div class="search-result-duration">${duration}</div>
        <div class="search-result-actions">
          <button class="btn btn-primary btn-small play-track-btn" data-track-id="${track.id}">
            <i data-lucide="play"></i> Play
          </button>
          <button class="btn btn-secondary btn-small add-track-btn" data-track-id="${track.id}">
            <i data-lucide="plus"></i> Add
          </button>
        </div>
      </div>
    `;
  }

  async playSearchResult(track) {
    console.log('🎵 BUTTON CLICKED: Play button was clicked!', track);
    try {
      console.log('🎵 PLAY: Playing track:', track.title, 'by', track.artist);
      this.showNotification('Loading track...', 'info');
      
      // Get the stream URL (tracks from our service already have streamUrl)
      const streamUrl = track.streamUrl;
      
      if (!streamUrl) {
        this.showNotification('No stream URL available', 'error');
        console.error('🎵 PLAY: No stream URL in track data');
        return;
      }

      console.log('🎵 PLAY: Using stream URL:', streamUrl);

      // DIRECT approach - find the HTML5 audio element and play it directly
      const audioElement = document.getElementById('audio-player');
      if (audioElement) {
        console.log('🎵 PLAY: Found HTML5 audio element, setting source directly');
        
        // Update the bottom bar UI elements directly
        const currentTitle = document.getElementById('current-title');
        const currentArtist = document.getElementById('current-artist');
        const trackImage = document.getElementById('current-track-image');
        
        if (currentTitle) currentTitle.textContent = track.title;
        if (currentArtist) currentArtist.textContent = track.artist;
        if (trackImage && track.thumbnail) trackImage.src = track.thumbnail;
        
        // Set the audio source and play
        audioElement.src = streamUrl;
        audioElement.crossOrigin = "anonymous"; // Handle CORS
        
        // Add event listeners for this play
        const onCanPlay = () => {
          console.log('🎵 PLAY: Audio can play, starting playback');
          audioElement.play().then(() => {
            console.log('🎵 PLAY: Audio playing successfully!');
            this.showNotification(`Now playing: ${track.title}`, 'success');
          }).catch(err => {
            console.error('🎵 PLAY: Play failed:', err);
            this.showNotification('Playback failed', 'error');
          });
          audioElement.removeEventListener('canplay', onCanPlay);
        };
        
        const onError = (e) => {
          console.error('🎵 PLAY: Audio error:', e, audioElement.error);
          this.showNotification('Audio error - trying different URL', 'error');
          audioElement.removeEventListener('error', onError);
        };
        
        audioElement.addEventListener('canplay', onCanPlay);
        audioElement.addEventListener('error', onError);
        
        console.log('🎵 PLAY: Loading audio...');
        audioElement.load();
        
      } else {
        console.error('🎵 PLAY: Could not find audio-player element');
        this.showNotification('Audio player element not found', 'error');
      }

    } catch (error) {
      console.error('🎵 PLAY: Error playing track:', error);
      this.showNotification(`Failed to play: ${error.message}`, 'error');
    }
  }

  async playStreamingTrack(trackData, streamUrl) {
    try {
      const audioPlayer = document.getElementById('audio-player');
      if (!audioPlayer) return;

      // Update player UI
      document.getElementById('current-title').textContent = trackData.title;
      document.getElementById('current-artist').textContent = trackData.artist;
      document.getElementById('current-platform').textContent = trackData.platform;
      
      // Set audio source
      audioPlayer.src = streamUrl;
      audioPlayer.load();
      
      // Play the track
      await audioPlayer.play();
      
      this.isStreaming = true;
      this.currentTrack = trackData;
      
      // Update play button
      const playPauseBtn = document.getElementById('play-pause-btn');
      if (playPauseBtn) {
        playPauseBtn.innerHTML = '<i data-lucide="pause"></i>';
      }

    } catch (error) {
      console.error('Error playing streaming track:', error);
      this.showNotification('Failed to play track', 'error');
    }
  }

  async loadReleaseRadar() {
    try {
      const results = await window.electronAPI.getReleaseRadar(20);
      this.displayReleaseRadar(results);
    } catch (error) {
      console.error('Error loading release radar:', error);
    }
  }

  displayReleaseRadar(tracks) {
    const releaseRadarContent = document.getElementById('release-radar-content');
    if (!releaseRadarContent) return;

    if (tracks.length === 0) {
      releaseRadarContent.innerHTML = `
        <div class="empty-state">
          <i data-lucide="radio" class="empty-state-icon"></i>
          <h3>No new releases</h3>
          <p>Check back later for new music</p>
        </div>
      `;
      return;
    }

    releaseRadarContent.innerHTML = tracks.map(track => this.createSearchResultCard(track)).join('');
  }

  async loadFollowedArtists() {
    try {
      const artists = await window.electronAPI.getFollowedArtists();
      this.displayFollowedArtists(artists);
    } catch (error) {
      console.error('Error loading followed artists:', error);
    }
  }

  displayFollowedArtists(artists) {
    const followedArtistsContent = document.getElementById('followed-artists-content');
    if (!followedArtistsContent) return;

    if (artists.length === 0) {
      followedArtistsContent.innerHTML = `
        <div class="empty-state">
          <i data-lucide="users" class="empty-state-icon"></i>
          <h3>No followed artists</h3>
          <p>Follow artists to see their latest releases</p>
        </div>
      `;
      return;
    }

    followedArtistsContent.innerHTML = artists.map(artist => `
      <div class="artist-card">
        <div class="artist-name">${artist.artist_name}</div>
        <div class="artist-platform">${artist.platform || 'Unknown'}</div>
        <button class="btn btn-secondary btn-small" onclick="window.streamingManager.unfollowArtist('${artist.artist_name}')">
          Unfollow
        </button>
      </div>
    `).join('');
  }

  async followArtist(artistName, platform = null) {
    try {
      const result = await window.electronAPI.followArtist(artistName, platform);
      if (result.success) {
        this.showNotification(`Now following ${artistName}`, 'success');
        this.loadFollowedArtists(); // Refresh the list
      } else {
        this.showNotification('Failed to follow artist', 'error');
      }
    } catch (error) {
      console.error('Error following artist:', error);
      this.showNotification('Failed to follow artist', 'error');
    }
  }

  async unfollowArtist(artistName) {
    try {
      const result = await window.electronAPI.unfollowArtist(artistName);
      if (result.success) {
        this.showNotification(`Unfollowed ${artistName}`, 'success');
        this.loadFollowedArtists(); // Refresh the list
      } else {
        this.showNotification('Failed to unfollow artist', 'error');
      }
    } catch (error) {
      console.error('Error unfollowing artist:', error);
      this.showNotification('Failed to unfollow artist', 'error');
    }
  }

  showStreamingModal() {
    const streamingModal = document.getElementById('streaming-modal');
    if (streamingModal) {
      streamingModal.classList.add('active');
      this.loadReleaseRadar();
      this.loadFollowedArtists();
    }
  }

  hideStreamingModal() {
    const streamingModal = document.getElementById('streaming-modal');
    if (streamingModal) {
      streamingModal.classList.remove('active');
    }
  }

  switchStreamingTab(tabName) {
    // Update tab buttons
    const tabs = document.querySelectorAll('.streaming-tab');
    tabs.forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      }
    });

    // Update tab content
    const tabContents = document.querySelectorAll('.streaming-tab-content');
    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.dataset.tabContent === tabName) {
        content.classList.add('active');
      }
    });

    // Load content based on tab
    switch (tabName) {
      case 'discover':
        this.loadReleaseRadar();
        break;
      case 'artists':
        this.loadFollowedArtists();
        break;
    }
  }

  showSearchResults() {
    const searchContainer = document.getElementById('streaming-search-container');
    const songListContainer = document.getElementById('song-list-container');
    const dropZone = document.getElementById('drop-zone');
    
    if (searchContainer) searchContainer.style.display = 'block';
    if (songListContainer) songListContainer.style.display = 'none';
    if (dropZone) dropZone.style.display = 'none';
  }

  hideSearchResults() {
    const searchContainer = document.getElementById('streaming-search-container');
    const songListContainer = document.getElementById('song-list-container');
    const dropZone = document.getElementById('drop-zone');
    
    if (searchContainer) searchContainer.style.display = 'none';
    if (songListContainer) songListContainer.style.display = 'block';
    if (dropZone) dropZone.style.display = 'block';
  }

  updateSearchResultsTitle(title) {
    const titleElement = document.getElementById('search-results-title');
    if (titleElement) {
      titleElement.textContent = title;
    }
  }

  filterSearchResults() {
    const filterPlatform = document.getElementById('search-filter-platform').value;
    const searchResultItems = document.querySelectorAll('.search-result-item');
    
    searchResultItems.forEach(item => {
      const platform = item.dataset.platform;
      if (filterPlatform === 'all' || platform === filterPlatform) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    });
  }

  addToSearchHistory(query, platform) {
    const historyItem = { query, platform, timestamp: Date.now() };
    this.searchHistory.unshift(historyItem);
    
    // Keep only last 10 searches
    if (this.searchHistory.length > 10) {
      this.searchHistory = this.searchHistory.slice(0, 10);
    }
  }

  formatDuration(seconds) {
    if (!seconds) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  async addToPlaylist(track) {
    console.log('🎵 BUTTON CLICKED: Add button was clicked!', track);
    try {
      console.log('🎵 ADD: Adding track to queue:', track.title, 'by', track.artist);
      
      // Check if track already has a working stream URL
      let streamUrl = track.streamUrl;
      
      if (!streamUrl) {
        console.log('🎵 ADD: No direct stream URL, trying to get one...');
        const streamResult = await this.getStreamUrlWithFallback(track.id, track.platform);
        
        if (!streamResult || !streamResult.streamUrl) {
          this.showNotification('Unable to get stream URL for track', 'error');
          console.error('🎵 ADD: No stream URL received');
          return;
        }
        
        streamUrl = streamResult.streamUrl;
      }

      console.log('🎵 ADD: Using stream URL for queue:', streamUrl.substring(0, 80) + '...');

      // Create queue track object
      const queueTrack = {
        id: `queue_${Date.now()}`, // Generate unique ID for queue tracks
        title: track.title,
        artist: track.artist,
        album: track.album || 'Creative Commons Music',
        duration: track.duration,
        file_path: streamUrl, // Direct streaming URL
        platform: track.platform,
        stream_id: track.id,
        thumbnail_url: track.thumbnail,
        type: 'stream',
        is_liked: 0
      };
      
      // Add to queue
      if (window.audioPlayer) {
        console.log('🎵 ADD: Adding to audioPlayer queue');
        window.audioPlayer.addToQueue(queueTrack);
        this.showNotification(`Added \"${track.title}\" to queue`, 'success');
      } else {
        console.error('🎵 ADD: No audioPlayer found on window');
        this.showNotification('Audio player not available', 'error');
      }

    } catch (error) {
      console.error('Error adding to playlist:', error);
      this.showNotification('Failed to add track', 'error');
    }
  }

  showNotification(message, type = 'info') {
    if (window.notificationService) {
      window.notificationService.showNotification(message, type);
    } else {
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }
}

// Make it globally available
window.StreamingManager = StreamingManager; 