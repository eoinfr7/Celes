class AudioPlayer {
  constructor() {
    this.audio = document.getElementById('audio-player');
    this.currentSong = null;
    this.playlist = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.isShuffle = false;
    this.isRepeat = false;
    this.volume = 1.0;
    this.currentAlbumArtUrl = null;
    this.isHoveringProgress = false;
    this.queue = [];
    this.originalPlaylist = [];
    this.playbackHistory = []; // Track actual playback order for proper previous functionality
    
    // Crossfade functionality
    this.nextAudio = null; // Second audio element for crossfading
    this.crossfadeSettings = {
      enabled: false,
      duration: 3 // seconds
    };
    this.isCrossfading = false;
    this.crossfadeTimeout = null;
    this.crossfadeInterval = null;
    
    this.initializeElements();
    this.createSecondAudioElement();
    this.bindEvents();
  }

  initializeElements() {
    this.playPauseBtn = document.getElementById('play-pause-btn');
    this.prevBtn = document.getElementById('prev-btn');
    this.nextBtn = document.getElementById('next-btn');
    this.progressBarContainer = document.querySelector('.progress-bar-container');
    this.progressBarFill = document.getElementById('progress-bar-fill');
    this.progressBarThumb = document.getElementById('progress-bar-thumb');
    this.volumeBar = document.getElementById('volume-bar');
    this.muteBtn = document.getElementById('mute-btn');
    this.volumePercentageEl = document.getElementById('volume-percentage');
    this.currentTimeEl = document.getElementById('current-time');
    this.totalTimeEl = document.getElementById('total-time');
    this.currentTitleEl = document.getElementById('current-title');
    this.currentArtistEl = document.getElementById('current-artist');
    this.shuffleBtn = document.getElementById('shuffle-btn');
    this.likeCurrentBtn = document.getElementById('like-current-btn');
    this.historyBtn = document.getElementById('history-btn');
    this.historyPopup = document.getElementById('history-popup');
    this.historyList = document.getElementById('history-list');
    this.closeHistoryBtn = document.getElementById('close-history-btn');
  }

  createSecondAudioElement() {
    // Create a second hidden audio element for crossfading
    this.nextAudio = document.createElement('audio');
    this.nextAudio.preload = 'metadata';
    this.nextAudio.volume = 0; // Start at 0 volume for crossfade
    document.body.appendChild(this.nextAudio);
  }

  updateCrossfadeSettings(settings) {
    this.crossfadeSettings = { ...this.crossfadeSettings, ...settings };
  }

  bindEvents() {
    // Playback controls
    this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
    this.prevBtn.addEventListener('click', () => this.previousTrack());
    this.nextBtn.addEventListener('click', () => this.nextTrack());
    
    // Progress and volume
    this.progressBarContainer.addEventListener('click', (e) => this.handleProgressClick(e));
    this.progressBarContainer.addEventListener('mousemove', (e) => this.handleProgressHover(e));
    this.progressBarContainer.addEventListener('mouseenter', () => this.isHoveringProgress = true);
    this.progressBarContainer.addEventListener('mouseleave', () => {
      this.isHoveringProgress = false;
      // Reset thumb to actual progress when mouse leaves
      if (this.audio.duration) {
        const progress = (this.audio.currentTime / this.audio.duration) * 100;
        this.updateProgressBar(progress);
      }
    });
    this.volumeBar.addEventListener('input', (e) => this.setVolume(e.target.value / 100));
    this.muteBtn.addEventListener('click', () => this.toggleMute());
    
    // Shuffle, like, and history controls
    this.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
    this.likeCurrentBtn.addEventListener('click', () => this.toggleCurrentSongLike());
    this.historyBtn.addEventListener('click', () => this.showHistory());
    this.closeHistoryBtn.addEventListener('click', () => this.hideHistory());
    
    // Audio events
    this.audio.addEventListener('loadedmetadata', () => this.onLoadedMetadata());
    this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.audio.addEventListener('ended', () => this.onTrackEnded());
    this.audio.addEventListener('error', (e) => this.onError(e));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }

  loadSong(song, playlist = [], index = -1, addToHistory = true) {
    // Add current song to history before switching (but not if it's the same song)
    if (addToHistory && this.currentSong && this.currentSong.id !== song.id) {
      this.playbackHistory.push({
        song: this.currentSong,
        playlist: this.playlist,
        index: this.currentIndex
      });
      
      // Limit history to prevent memory issues (keep last 50 songs)
      if (this.playbackHistory.length > 50) {
        this.playbackHistory.shift();
      }
    }
    
    this.currentSong = song;
    this.playlist = playlist;
    this.currentIndex = index;
    
    // Handle streaming URLs vs local file paths
    if (song.file_path.startsWith('http')) {
      // Direct streaming URL from YouTube
      this.audio.src = song.file_path;
      this.audio.crossOrigin = "anonymous"; // Handle CORS
      console.log('🎵 STREAMING: Loading direct stream URL:', song.file_path.substring(0, 100) + '...');
      
      // Add event listeners to debug what's happening
      this.audio.addEventListener('loadstart', () => console.log('🎵 STREAMING: Load started'));
      this.audio.addEventListener('error', (e) => console.error('🎵 STREAMING: Audio error:', e.target.error));
      this.audio.addEventListener('canplay', () => console.log('🎵 STREAMING: Can play - ready to stream!'));
      this.audio.addEventListener('loadeddata', () => console.log('🎵 STREAMING: Data loaded'));
      
    } else {
      // Local file
      this.audio.src = `file://${song.file_path}`;
      console.log('🎵 LOCAL: Loading local file:', song.file_path);
    }
    
    this.updateNowPlaying();
    this.updatePlayingState();
  }

  async updateNowPlaying() {
    if (this.currentSong) {
      this.currentTitleEl.textContent = this.currentSong.title;
      this.currentArtistEl.textContent = this.currentSong.artist;
      await this.updateAlbumArt();
      this.updateLikeButtonState();
    } else {
      this.currentTitleEl.textContent = 'No song selected';
      this.currentArtistEl.textContent = '-';
      this.clearAlbumArt();
      this.updateLikeButtonState();
    }
  }

  async updateAlbumArt() {
    const albumArtEl = document.querySelector('.album-placeholder');
    if (!albumArtEl) return;

    try {
      const result = await window.electronAPI.getAlbumArt(this.currentSong.id);
      if (result.success && result.data) {
        const blob = new Blob([result.data], { type: result.format });
        const imageUrl = URL.createObjectURL(blob);
        
        albumArtEl.style.backgroundImage = `url(${imageUrl})`;
        albumArtEl.style.backgroundSize = 'cover';
        albumArtEl.style.backgroundPosition = 'center';
        albumArtEl.style.backgroundRepeat = 'no-repeat';
        
        // Clean up previous URL if exists
        if (this.currentAlbumArtUrl) {
          URL.revokeObjectURL(this.currentAlbumArtUrl);
        }
        this.currentAlbumArtUrl = imageUrl;
      } else {
        this.clearAlbumArt();
      }
    } catch (error) {
      console.error('Error loading album art:', error);
      this.clearAlbumArt();
    }
  }

  clearAlbumArt() {
    const albumArtEl = document.querySelector('.album-placeholder');
    if (albumArtEl) {
      albumArtEl.style.backgroundImage = '';
      albumArtEl.style.backgroundSize = '';
      albumArtEl.style.backgroundPosition = '';
      albumArtEl.style.backgroundRepeat = '';
    }
    
    if (this.currentAlbumArtUrl) {
      URL.revokeObjectURL(this.currentAlbumArtUrl);
      this.currentAlbumArtUrl = null;
    }
  }

  updatePlayingState() {
    // Update all song items in the list
    document.querySelectorAll('.song-item').forEach(item => {
      item.classList.remove('playing');
      if (this.currentSong && item.dataset.songId == this.currentSong.id) {
        item.classList.add('playing');
      }
    });
  }

  async togglePlayPause() {
    if (!this.currentSong) return;

    try {
      if (this.isPlaying) {
        await this.pause();
      } else {
        await this.play();
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  }

  async play() {
    try {
      await this.audio.play();
      this.isPlaying = true;
      this.playPauseBtn.className = 'control-btn play-btn';
      this.playPauseBtn.innerHTML = '<i data-lucide="pause"></i>';
      window.localIcons.createIcons();
      
      // Connect to equalizer
      if (window.musicPlayer && window.musicPlayer.equalizerManager) {
        window.musicPlayer.equalizerManager.onAudioChange(this.audio);
      }
      
      // Track song play and show notification
      if (this.currentSong && window.musicPlayer) {
        window.musicPlayer.trackSongPlay(this.currentSong.id);
        window.musicPlayer.showOverlayNotification(this.currentSong);
        console.log(`Playing: ${this.currentSong.title}`);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      this.isPlaying = false;
      this.playPauseBtn.className = 'control-btn play-btn';
      this.playPauseBtn.innerHTML = '<i data-lucide="play"></i>';
      window.localIcons.createIcons();
    }
  }

  async pause() {
    this.audio.pause();
    this.isPlaying = false;
    this.playPauseBtn.className = 'control-btn play-btn';
    this.playPauseBtn.innerHTML = '<i data-lucide="play"></i>';
    window.localIcons.createIcons();
  }

  previousTrack() {
    // Check if we have playback history first
    if (this.playbackHistory.length > 0) {
      // Get the last song from history
      const previousEntry = this.playbackHistory.pop();
      
      // Load the previous song without adding current song to history (to avoid infinite loop)
      this.loadSong(previousEntry.song, previousEntry.playlist, previousEntry.index, false);
      
      if (this.isPlaying) {
        this.play();
      }
      return;
    }
    
    // Fallback to old behavior if no history
    if (this.playlist.length === 0) return;
    
    let newIndex;
    if (this.isShuffle) {
      newIndex = Math.floor(Math.random() * this.playlist.length);
    } else {
      newIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.playlist.length - 1;
    }
    
    const song = this.playlist[newIndex];
    this.loadSong(song, this.playlist, newIndex);
    
    if (this.isPlaying) {
      this.play();
    }
  }

  nextTrack() {
    // Check if there's a song in the queue first
    if (this.queue.length > 0) {
      const nextSong = this.queue.shift(); // Remove and get first song from queue
      // Find the song's index in the original playlist for proper context
      const songIndex = this.originalPlaylist.findIndex(s => s.id === nextSong.id);
      this.currentIndex = songIndex >= 0 ? songIndex : this.currentIndex;
      this.loadSong(nextSong, this.originalPlaylist, this.currentIndex);
      
      if (this.isPlaying) {
        this.play();
      }
      return;
    }

    // No queue, proceed with normal playlist logic
    if (this.playlist.length === 0) return;
    
    let newIndex;
    if (this.isShuffle) {
      newIndex = Math.floor(Math.random() * this.playlist.length);
    } else {
      newIndex = this.currentIndex < this.playlist.length - 1 ? this.currentIndex + 1 : 0;
    }
    
    const song = this.playlist[newIndex];
    this.loadSong(song, this.playlist, newIndex);
    
    if (this.isPlaying) {
      this.play();
    }
  }

  handleProgressClick(e) {
    if (!this.audio.duration) return;
    
    const rect = this.progressBarContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    
    this.audio.currentTime = (clampedPercentage / 100) * this.audio.duration;
    this.updateProgressBar(clampedPercentage);
  }

  handleProgressHover(e) {
    if (!this.audio.duration) return;
    
    const rect = this.progressBarContainer.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const percentage = (hoverX / rect.width) * 100;
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    
    // Update thumb position on hover
    this.progressBarThumb.style.left = `${clampedPercentage}%`;
  }

  updateProgressBar(percentage) {
    this.progressBarFill.style.width = `${percentage}%`;
    // Only update thumb position if not hovering (to prevent glitching)
    if (!this.isHoveringProgress) {
      this.progressBarThumb.style.left = `${percentage}%`;
    }
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    
    // Set volume for main audio
    this.audio.volume = this.volume;
    
    // If not crossfading, ensure nextAudio is silent
    if (this.nextAudio && !this.isCrossfading) {
      this.nextAudio.volume = 0;
    }
    
    this.volumeBar.value = this.volume * 100;
    this.volumePercentageEl.textContent = Math.round(this.volume * 100) + '%';
    
    // Update mute button icon based on volume level
    const muteIcon = this.muteBtn?.querySelector('i');
    if (muteIcon && typeof window.localIcons !== 'undefined') {
      if (this.volume === 0) {
        window.localIcons.setIcon(muteIcon, 'volume-x');
      } else if (this.volume < 0.5) {
        window.localIcons.setIcon(muteIcon, 'volume-1');
      } else {
        window.localIcons.setIcon(muteIcon, 'volume-2');
      }
    } else if (muteIcon) {
      // Fallback for when localIcons isn't available
      if (this.volume === 0) {
        muteIcon.setAttribute('data-lucide', 'volume-x');
      } else if (this.volume < 0.5) {
        muteIcon.setAttribute('data-lucide', 'volume-1');
      } else {
        muteIcon.setAttribute('data-lucide', 'volume-2');
      }
      window.localIcons.createIcons();
    }
  }

  toggleMute() {
    if (this.audio.volume === 0) {
      this.setVolume(this.volume > 0 ? this.volume : 0.5);
    } else {
      this.audio.volume = 0;
    }
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    this.shuffleBtn.classList.toggle('active', this.isShuffle);
    this.shuffleBtn.style.color = this.isShuffle ? '#667eea' : '#718096';
  }

  onLoadedMetadata() {
    if (this.audio.duration) {
      this.totalTimeEl.textContent = this.formatTime(this.audio.duration);
      this.updateProgressBar(0);
    }
  }

  onTimeUpdate() {
    if (this.audio.duration) {
      const progress = (this.audio.currentTime / this.audio.duration) * 100;
      this.updateProgressBar(progress);
      this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
      
      // Check if we should start crossfading
      this.checkCrossfadeStart();
    }
  }

  checkCrossfadeStart() {
    if (!this.crossfadeSettings.enabled || this.isCrossfading || this.isRepeat) {
      return;
    }

    const timeLeft = this.audio.duration - this.audio.currentTime;
    
    // Start crossfade when we reach the crossfade duration before the end
    if (timeLeft <= this.crossfadeSettings.duration && timeLeft > 0) {
      this.startCrossfade();
    }
  }

  startCrossfade() {
    if (this.isCrossfading || !this.hasNextTrack()) {
      return;
    }

    this.isCrossfading = true;
    
    // Calculate next track index and song at the start
    this.nextTrackIndex = this.getNextTrackIndex();
    const nextSong = this.playlist[this.nextTrackIndex];
    
    if (!nextSong) {
      this.isCrossfading = false;
      return;
    }

    // Load next song in the second audio element
    this.nextAudio.src = `file://${nextSong.file_path}`;
    this.nextAudio.volume = 0; // Start silent
    this.nextAudio.currentTime = 0;
    
    // Start playing the next song immediately (both songs will play simultaneously)
    this.nextAudio.play().then(() => {
      // Begin crossfade - both songs are now playing
      this.performCrossfade();
    }).catch(error => {
      console.error('Error starting next track for crossfade:', error);
      this.isCrossfading = false;
    });
  }

  performCrossfade() {
    const duration = this.crossfadeSettings.duration * 1000; // Convert to milliseconds
    const steps = 100; // More steps for smoother crossfade
    const stepTime = duration / steps;
    
    let step = 0;
    const originalVolume = this.volume;
    
    this.crossfadeInterval = setInterval(() => {
      step++;
      const progress = step / steps;
      
      // Both tracks are playing simultaneously
      // Current track: fade out from full volume to 0
      this.audio.volume = originalVolume * (1 - progress);
      
      // Next track: fade in from 0 to full volume  
      this.nextAudio.volume = originalVolume * progress;
      
      if (step >= steps) {
        // Crossfade complete - both tracks were playing, now switch
        this.completeCrossfade();
      }
    }, stepTime);
  }

  completeCrossfade() {
    // Clear the crossfade interval
    if (this.crossfadeInterval) {
      clearInterval(this.crossfadeInterval);
      this.crossfadeInterval = null;
    }
    
    // Stop and reset the old current track (it was faded out)
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.volume = 0;
    
    // Swap the audio elements - nextAudio becomes the new current audio
    const tempAudio = this.audio;
    this.audio = this.nextAudio;
    this.nextAudio = tempAudio;
    
    // Update current song info to the song that's now playing
    this.currentIndex = this.nextTrackIndex;
    this.currentSong = this.playlist[this.currentIndex];
    
    // Set proper volumes
    this.audio.volume = this.volume; // The new current track at full volume
    this.nextAudio.volume = 0; // The old track (now nextAudio) is silent
    
    // Update UI to reflect the new current song
    this.updateNowPlaying();
    this.updatePlayingState();
    
    // Add event listeners to the new current audio element
    this.bindAudioEvents();
    
    this.isCrossfading = false;
  }

  bindAudioEvents() {
    // Remove old event listeners to prevent duplicates
    this.audio.removeEventListener('loadedmetadata', this.onLoadedMetadata);
    this.audio.removeEventListener('timeupdate', this.onTimeUpdate);
    this.audio.removeEventListener('ended', this.onTrackEnded);
    this.audio.removeEventListener('error', this.onError);
    
    // Add event listeners to current audio element
    this.audio.addEventListener('loadedmetadata', () => this.onLoadedMetadata());
    this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.audio.addEventListener('ended', () => this.onTrackEnded());
    this.audio.addEventListener('error', (e) => this.onError(e));
  }

  hasNextTrack() {
    if (this.playlist.length === 0) return false;
    
    if (this.isShuffle) {
      return true; // With shuffle, there's always a next track (could be random)
    }
    
    return this.currentIndex < this.playlist.length - 1;
  }

  getNextTrackIndex() {
    if (this.playlist.length === 0) return -1;
    
    if (this.isShuffle) {
      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * this.playlist.length);
      } while (nextIndex === this.currentIndex && this.playlist.length > 1);
      return nextIndex;
    }
    
    return (this.currentIndex + 1) % this.playlist.length;
  }

  getNextSong() {
    const nextIndex = this.getNextTrackIndex();
    return nextIndex >= 0 ? this.playlist[nextIndex] : null;
  }

  onTrackEnded() {
    // If we're crossfading, the track end is handled by completeCrossfade
    if (this.isCrossfading) {
      return;
    }
    
    if (this.isRepeat) {
      this.audio.currentTime = 0;
      this.play();
    } else {
      this.nextTrack();
    }
  }

  onError(error) {
    console.error('Audio error:', error);
    this.isPlaying = false;
    this.playPauseBtn.className = 'control-btn play-btn';
    this.playPauseBtn.innerHTML = '<i data-lucide="play"></i>';
    window.localIcons.createIcons();
    
    // Show error message to user
    const errorMsg = 'Error playing audio file. The file may be corrupted or in an unsupported format.';
    // You could implement a toast notification here
    console.error(errorMsg);
  }

  handleKeyboard(event) {
    // Only handle keyboard shortcuts when not typing in an input
    if (event.target.tagName === 'INPUT') return;
    
    switch (event.code) {
      case 'Space':
        event.preventDefault();
        this.togglePlayPause();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.previousTrack();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.nextTrack();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.setVolume(Math.min(1, this.volume + 0.1));
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.setVolume(Math.max(0, this.volume - 0.1));
        break;
    }
  }

  formatTime(seconds) {
    if (!seconds || !isFinite(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Public methods for external control
  playPlaylist(songs, startIndex = 0) {
    if (songs.length === 0) return;
    
    this.originalPlaylist = [...songs];
    this.playlist = [...songs];
    this.queue = []; // Clear queue when starting new playlist
    this.playbackHistory = []; // Clear history when starting new playlist
    this.currentIndex = startIndex;
    this.loadSong(songs[startIndex], songs, startIndex);
    this.play();
  }

  // Play a single song while preserving history
  playSingleSong(song, playlist, index) {
    if (!song) return;
    
    // Update playlist context but preserve history
    this.originalPlaylist = [...playlist];
    this.playlist = [...playlist];
    this.currentIndex = index;
    
    // This will add current song to history before switching
    this.loadSong(song, playlist, index, true);
    this.play();
  }

  getCurrentSong() {
    return this.currentSong;
  }

  getPlaylist() {
    return this.playlist;
  }

  getCurrentIndex() {
    return this.currentIndex;
  }

  isCurrentlyPlaying() {
    return this.isPlaying;
  }

  async toggleCurrentSongLike() {
    if (!this.currentSong) {
      console.log('No current song to like');
      return;
    }

    try {
      // Use the music player's toggle like method if available
      if (window.musicPlayer && typeof window.musicPlayer.toggleLikeSong === 'function') {
        await window.musicPlayer.toggleLikeSong(this.currentSong.id);
        // The music player will handle updating the song data
        // We just need to update our button state
        setTimeout(() => this.updateLikeButtonState(), 100);
      } else {
        // Fallback: direct API call
        const result = await window.electronAPI.toggleLikeSong(this.currentSong.id);
        if (result.success) {
          // Update the current song's like status
          this.currentSong.is_liked = result.isLiked ? 1 : 0;
          this.updateLikeButtonState();
        }
      }
    } catch (error) {
      console.error('Error toggling like for current song:', error);
    }
  }

  updateLikeButtonState() {
    if (!this.likeCurrentBtn) return;

    if (this.currentSong && this.currentSong.is_liked) {
      this.likeCurrentBtn.classList.add('btn-liked');
      this.likeCurrentBtn.title = 'Unlike current song';
    } else {
      this.likeCurrentBtn.classList.remove('btn-liked');
      this.likeCurrentBtn.title = 'Like current song';
    }

    // Enable/disable button based on whether there's a current song
    this.likeCurrentBtn.disabled = !this.currentSong;
  }

  // Queue management methods
  addToQueue(song) {
    if (!song) return;
    this.queue.push(song);
    console.log(`Added "${song.title}" to queue. Queue length: ${this.queue.length}`);
  }

  playNext(song) {
    if (!song) return;
    this.queue.unshift(song); // Add to beginning of queue
    console.log(`Added "${song.title}" to play next. Queue length: ${this.queue.length}`);
  }

  getQueue() {
    return [...this.queue];
  }

  clearQueue() {
    this.queue = [];
    console.log('Queue cleared');
  }

  removeFromQueue(songId) {
    const index = this.queue.findIndex(song => song.id === songId);
    if (index >= 0) {
      const removed = this.queue.splice(index, 1)[0];
      console.log(`Removed "${removed.title}" from queue`);
      return removed;
    }
    return null;
  }

  // History popup methods
  showHistory() {
    // Prevent multiple rapid clicks
    if (this.historyPopup.classList.contains('show')) {
      return;
    }
    
    // Render first, then show
    this.renderHistory();
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      this.historyPopup.classList.add('show');
      
      // Add outside click handler after a small delay to prevent immediate closing
      setTimeout(() => {
        this.outsideClickHandler = this.handleHistoryOutsideClick.bind(this);
        document.addEventListener('click', this.outsideClickHandler);
      }, 100);
    });
  }

  hideHistory() {
    if (!this.historyPopup.classList.contains('show')) {
      return;
    }
    
    this.historyPopup.classList.remove('show');
    
    // Clean up event listener
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
  }

  handleHistoryOutsideClick(e) {
    // Make sure the popup is still shown and the click is outside
    if (this.historyPopup.classList.contains('show') && 
        !this.historyPopup.contains(e.target) && 
        !this.historyBtn.contains(e.target)) {
      this.hideHistory();
    }
  }

  renderHistory() {
    const historyWithCurrent = [...this.playbackHistory];
    
    // Add current song at the end if it exists
    if (this.currentSong) {
      historyWithCurrent.push({
        song: this.currentSong,
        playlist: this.playlist,
        index: this.currentIndex,
        isCurrent: true
      });
    }

    if (historyWithCurrent.length === 0) {
      this.historyList.innerHTML = `
        <div class="history-empty">
          <i data-lucide="clock"></i>
          <p>No playback history yet</p>
        </div>
      `;
    } else {
      // Reverse to show most recent first
      const reversedHistory = [...historyWithCurrent].reverse();
      
      this.historyList.innerHTML = reversedHistory.map((entry, index) => {
        const isCurrentSong = entry.isCurrent;
        const timeAgo = isCurrentSong ? 'Now playing' : `${reversedHistory.length - index} song${reversedHistory.length - index === 1 ? '' : 's'} ago`;
        
        return `
          <div class="history-item ${isCurrentSong ? 'current' : ''}" data-song-id="${entry.song.id}">
            <div class="history-number">${index + 1}</div>
            <div class="history-song-info">
              <div class="history-song-title">${entry.song.title}</div>
              <div class="history-song-artist">${entry.song.artist || 'Unknown Artist'}</div>
            </div>
            <div class="history-time">${timeAgo}</div>
          </div>
        `;
      }).join('');

      // Add click handlers for history items
      this.historyList.querySelectorAll('.history-item:not(.current)').forEach(item => {
        item.addEventListener('click', (e) => {
          const songId = parseInt(item.dataset.songId);
          this.playFromHistory(songId);
          this.hideHistory();
        });
      });
    }

    // Re-initialize lucide icons after a short delay to ensure DOM is ready
    setTimeout(() => {
      if (typeof window.localIcons !== 'undefined') {
        window.localIcons.createIcons();
      }
    }, 10);
  }

  playFromHistory(songId) {
    // Find the song in history
    const historyEntry = this.playbackHistory.find(entry => entry.song.id === songId);
    if (historyEntry) {
      // Don't modify history when playing from history - just jump to the song
      // This preserves the full history for display
      this.loadSong(historyEntry.song, historyEntry.playlist, historyEntry.index, false);
      this.play();
    }
  }
}

// Initialize the audio player
window.audioPlayer = new AudioPlayer();