class SongRenderer {
  constructor(songList, songCount) {
    this.songList = songList;
    this.songCount = songCount;
    this.selectedSongs = new Set();
  }

  renderSongs(songs) {
    if (songs.length === 0) {
      this.renderEmptyState();
      return;
    }

    this.songList.innerHTML = songs.map(song => this.createSongItemHTML(song)).join('');
    this.bindSongEvents();
    this.loadAlbumThumbnails(songs);
  }

  renderEmptyState() {
    this.songList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"></div>
        <h3>No songs found</h3>
        <p>Add some music to get started!</p>
        <button class="btn btn-primary" onclick="musicPlayer.showOpenDialog()">Add Music</button>
      </div>
    `;
  }

  createSongItemHTML(song) {
    const heartClass = song.is_liked ? 'liked' : '';
    const heartIcon = song.is_liked ? '♥' : '♡';
    const isSelected = this.selectedSongs.has(song.id);
    
    return `
      <div class="song-item ${isSelected ? 'selected' : ''}" data-song-id="${song.id}">
        <div class="song-checkbox">
          <input type="checkbox" class="song-select-checkbox" data-song-id="${song.id}" ${isSelected ? 'checked' : ''}>
        </div>
        <div class="song-thumbnail">
          <div class="album-thumbnail" data-song-id="${song.id}">
            <i data-lucide="music" class="thumbnail-placeholder"></i>
          </div>
        </div>
        <div class="song-info">
          <div class="song-title" title="${song.title}">${song.title}</div>
          <div class="song-artist" title="${song.artist}">${song.artist}</div>
        </div>
        <div class="song-album" title="${song.album}">${song.album}</div>
        <div class="song-duration">${window.Formatters.formatDuration(song.duration)}</div>
        <div class="song-actions">
          <div class="song-like ${heartClass}" data-action="like" data-song-id="${song.id}" title="${song.is_liked ? 'Unlike' : 'Like'}">
            ${heartIcon}
          </div>
          <button class="action-btn delete-btn" data-action="delete" data-song-id="${song.id}" title="Delete">
            ×
          </button>
        </div>
      </div>
    `;
  }

  bindSongEvents() {
    // Handle checkbox changes
    document.querySelectorAll('.song-select-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        const songId = parseInt(checkbox.dataset.songId);
        this.toggleSongSelection(songId);
      });
    });

    // Handle double-click to play
    document.querySelectorAll('.song-item').forEach(item => {
      item.addEventListener('dblclick', (e) => {
        if (e.target.closest('.song-select-checkbox')) return;
        const songId = parseInt(item.dataset.songId);
        window.musicPlayer.playSong(songId);
      });

      // Handle click for selection (Ctrl+click for multi-select)
      item.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]') || e.target.closest('.song-select-checkbox')) return;
        
        const songId = parseInt(item.dataset.songId);
        
        if (e.ctrlKey || e.metaKey) {
          // Multi-select with Ctrl/Cmd
          this.toggleSongSelection(songId);
          this.lastSelectedSong = songId;
        } else if (e.shiftKey && this.lastSelectedSong) {
          // Range select with Shift
          this.selectSongRange(this.lastSelectedSong, songId);
          this.lastSelectedSong = songId;
        }
        // Note: Removed single select behavior - checkboxes are only controlled by checkbox clicks now
      });

      // Handle right-click for context menu
      item.addEventListener('contextmenu', (e) => {
        const songId = parseInt(item.dataset.songId);
        
        // If right-clicking on an unselected song, select it
        if (!this.selectedSongs.has(songId)) {
          this.clearSelection();
          this.toggleSongSelection(songId);
        }
        
        const song = window.musicPlayer.songs.find(s => s.id === songId) || 
                     window.musicPlayer.likedSongs.find(s => s.id === songId);
        if (song) {
          const selectedSongs = this.getSelectedSongs();
          window.musicPlayer.showContextMenu(e, song, selectedSongs);
        }
      });
    });

    // Handle clicks on song items using event delegation
    document.querySelectorAll('.song-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        e.stopPropagation();
        
        const action = target.dataset.action;
        const songId = parseInt(target.dataset.songId);
        
        switch (action) {
          case 'like':
            window.musicPlayer.toggleLikeSong(songId);
            break;
          case 'play':
            window.musicPlayer.playSong(songId);
            break;
          case 'delete':
            window.musicPlayer.deleteSong(songId);
            break;
        }
      });
    });
  }

  updateSongCount(count, songs = []) {
    let totalSize = 0;
    
    // Calculate total size if songs are provided
    if (songs && songs.length > 0) {
      totalSize = songs.reduce((sum, song) => {
        return sum + (song.file_size || this.estimateFileSize(song));
      }, 0);
    }
    
    const sizeText = totalSize > 0 ? ` • ${this.formatFileSize(totalSize)}` : '';
    this.songCount.textContent = `${count} song${count !== 1 ? 's' : ''}${sizeText}`;
  }

  estimateFileSize(song) {
    // Rough estimation: 128kbps average = 16KB/s = 16000 bytes/s
    if (song.duration) {
      return song.duration * 16000;
    }
    return 0;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async loadAlbumThumbnails(songs) {
    // Load thumbnails in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < songs.length; i += batchSize) {
      const batch = songs.slice(i, i + batchSize);
      
      // Process batch with small delay to prevent UI blocking
      setTimeout(async () => {
        await Promise.all(batch.map(song => this.loadSingleThumbnail(song)));
      }, Math.floor(i / batchSize) * 50); // 50ms delay between batches
    }
  }

  async loadSingleThumbnail(song) {
    try {
      const thumbnailEl = document.querySelector(`.album-thumbnail[data-song-id="${song.id}"]`);
      if (!thumbnailEl) return;

      const result = await window.electronAPI.getAlbumArt(song.id);
      if (result.success && result.data) {
        const blob = new Blob([result.data], { type: result.format });
        const imageUrl = URL.createObjectURL(blob);
        
        // Create image element and handle loading
        const img = new Image();
        img.onload = () => {
          thumbnailEl.style.backgroundImage = `url(${imageUrl})`;
          thumbnailEl.style.backgroundSize = 'cover';
          thumbnailEl.style.backgroundPosition = 'center';
          thumbnailEl.style.backgroundRepeat = 'no-repeat';
          
          // Hide the placeholder icon
          const placeholder = thumbnailEl.querySelector('.thumbnail-placeholder');
          if (placeholder) {
            placeholder.style.display = 'none';
          }
        };
        
        img.onerror = () => {
          // Clean up the blob URL if image fails to load
          URL.revokeObjectURL(imageUrl);
        };
        
        img.src = imageUrl;
      }
    } catch (error) {
      console.error('Error loading album thumbnail:', error);
    }
  }

  toggleSongSelection(songId) {
    if (this.selectedSongs.has(songId)) {
      this.selectedSongs.delete(songId);
    } else {
      this.selectedSongs.add(songId);
    }
    this.updateSongVisualState(songId);
    this.updateSelectionUI();
  }

  clearSelection() {
    const previouslySelected = Array.from(this.selectedSongs);
    this.selectedSongs.clear();
    
    // Update visual state for previously selected songs
    previouslySelected.forEach(songId => {
      this.updateSongVisualState(songId);
    });
    
    this.updateSelectionUI();
  }

  selectSongRange(startSongId, endSongId) {
    const songItems = Array.from(document.querySelectorAll('.song-item'));
    const startIndex = songItems.findIndex(item => parseInt(item.dataset.songId) === startSongId);
    const endIndex = songItems.findIndex(item => parseInt(item.dataset.songId) === endSongId);
    
    if (startIndex === -1 || endIndex === -1) return;
    
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    
    for (let i = minIndex; i <= maxIndex; i++) {
      const songId = parseInt(songItems[i].dataset.songId);
      this.selectedSongs.add(songId);
      this.updateSongVisualState(songId);
    }
    
    this.updateSelectionUI();
  }

  updateSongVisualState(songId) {
    const songItem = document.querySelector(`.song-item[data-song-id="${songId}"]`);
    const checkbox = document.querySelector(`.song-select-checkbox[data-song-id="${songId}"]`);
    
    if (songItem && checkbox) {
      const isSelected = this.selectedSongs.has(songId);
      songItem.classList.toggle('selected', isSelected);
      checkbox.checked = isSelected;
    }
  }

  updateSelectionUI() {
    const selectedCount = this.selectedSongs.size;
    
    // Update song count to show selection info
    if (selectedCount > 0) {
      this.songCount.textContent = `${selectedCount} song${selectedCount === 1 ? '' : 's'} selected`;
    } else {
      // Reset to normal count - this will be updated by the parent component
      const totalSongs = document.querySelectorAll('.song-item').length;
      this.songCount.textContent = `${totalSongs} song${totalSongs === 1 ? '' : 's'}`;
    }
  }

  getSelectedSongs() {
    const allSongs = [...(window.musicPlayer.songs || []), ...(window.musicPlayer.likedSongs || [])];
    return Array.from(this.selectedSongs).map(songId => 
      allSongs.find(song => song.id === songId)
    ).filter(Boolean);
  }

  hasSelectedSongs() {
    return this.selectedSongs.size > 0;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SongRenderer;
} else {
  window.SongRenderer = SongRenderer;
}