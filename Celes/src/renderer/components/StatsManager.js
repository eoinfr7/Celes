class StatsManager {
  constructor() {
    this.stats = {
      totalSongs: 0,
      totalSize: 0,
      totalDuration: 0,
      totalArtists: 0,
      totalAlbums: 0,
      likedSongsCount: 0,
      playlistsCount: 0,
      mostPlayed: ''
    };
    
    this.isVisible = false;
  }

  async calculateStats() {
    try {
      // Get all songs from the database
      const songs = await window.electronAPI.invoke('get-all-songs');
      const playlists = await window.electronAPI.invoke('get-playlists');
      
      if (!songs || !Array.isArray(songs)) {
        console.error('No songs data available');
        return;
      }

      // Calculate basic stats
      this.stats.totalSongs = songs.length;
      this.stats.likedSongsCount = songs.filter(song => song.is_liked).length;
      this.stats.playlistsCount = playlists ? playlists.length : 0;

      // Calculate total size and duration
      let totalSizeBytes = 0;
      let totalDurationSeconds = 0;
      const artists = new Set();
      const albums = new Set();
      let mostPlayedSong = null;
      let maxPlayCount = 0;

      songs.forEach(song => {
        // Size calculation (if available)
        if (song.file_size) {
          totalSizeBytes += song.file_size;
        }

        // Duration calculation
        if (song.duration) {
          totalDurationSeconds += song.duration;
        }

        // Unique artists and albums
        if (song.artist && song.artist !== 'Unknown Artist') {
          artists.add(song.artist);
        }
        if (song.album && song.album !== 'Unknown Album') {
          albums.add(song.album);
        }

        // Most played song
        const playCount = song.play_count || 0;
        if (playCount > maxPlayCount) {
          maxPlayCount = playCount;
          mostPlayedSong = song;
        }
      });

      this.stats.totalSize = totalSizeBytes;
      this.stats.totalDuration = totalDurationSeconds;
      this.stats.totalArtists = artists.size;
      this.stats.totalAlbums = albums.size;
      this.stats.mostPlayed = mostPlayedSong 
        ? `${mostPlayedSong.title} (${maxPlayCount} plays)`
        : 'No plays yet';

      this.updateDisplay();
    } catch (error) {
      console.error('Error calculating stats:', error);
      this.displayError();
    }
  }

  updateDisplay() {
    // Update total songs
    const totalSongsEl = document.getElementById('total-songs');
    if (totalSongsEl) {
      totalSongsEl.textContent = this.formatNumber(this.stats.totalSongs);
    }

    // Update library size
    const totalSizeEl = document.getElementById('total-size');
    if (totalSizeEl) {
      totalSizeEl.textContent = this.formatFileSize(this.stats.totalSize);
    }

    // Update total duration
    const totalDurationEl = document.getElementById('total-duration');
    if (totalDurationEl) {
      totalDurationEl.textContent = this.formatDuration(this.stats.totalDuration);
    }

    // Update artists count
    const totalArtistsEl = document.getElementById('total-artists');
    if (totalArtistsEl) {
      totalArtistsEl.textContent = this.formatNumber(this.stats.totalArtists);
    }

    // Update albums count
    const totalAlbumsEl = document.getElementById('total-albums');
    if (totalAlbumsEl) {
      totalAlbumsEl.textContent = this.formatNumber(this.stats.totalAlbums);
    }

    // Update liked songs count
    const likedSongsEl = document.getElementById('liked-songs-count');
    if (likedSongsEl) {
      likedSongsEl.textContent = this.formatNumber(this.stats.likedSongsCount);
    }

    // Update playlists count
    const playlistsEl = document.getElementById('playlists-count');
    if (playlistsEl) {
      playlistsEl.textContent = this.formatNumber(this.stats.playlistsCount);
    }

    // Update most played
    const mostPlayedEl = document.getElementById('most-played');
    if (mostPlayedEl) {
      mostPlayedEl.textContent = this.stats.mostPlayed;
      mostPlayedEl.title = this.stats.mostPlayed; // Full text on hover
    }
  }

  displayError() {
    const statValues = document.querySelectorAll('.stat-value');
    statValues.forEach(el => {
      el.textContent = 'Error';
    });
  }

  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDuration(seconds) {
    if (seconds === 0) return '0m';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }

  // Method to refresh stats when library changes
  async refresh() {
    if (this.isVisible) {
      await this.calculateStats();
    }
  }

  // Method called when stats page becomes visible
  async show() {
    this.isVisible = true;
    await this.calculateStats();
  }

  // Method called when stats page becomes hidden
  hide() {
    this.isVisible = false;
  }

  // Add file size estimation for files without size data
  async estimateFileSizes() {
    try {
      const songs = await window.electronAPI.invoke('get-all-songs');
      let totalEstimatedSize = 0;
      
      songs.forEach(song => {
        if (!song.file_size && song.duration) {
          // Rough estimation: 128kbps average = 16KB/s = 16000 bytes/s
          const estimatedSize = song.duration * 16000;
          totalEstimatedSize += estimatedSize;
        }
      });

      return totalEstimatedSize;
    } catch (error) {
      console.error('Error estimating file sizes:', error);
      return 0;
    }
  }

  // Get detailed breakdown for tooltip or modal
  getDetailedStats() {
    return {
      ...this.stats,
      averageSongDuration: this.stats.totalSongs > 0 
        ? this.formatDuration(this.stats.totalDuration / this.stats.totalSongs)
        : '0s',
      averageFileSize: this.stats.totalSongs > 0
        ? this.formatFileSize(this.stats.totalSize / this.stats.totalSongs)
        : '0 B',
      likedPercentage: this.stats.totalSongs > 0
        ? Math.round((this.stats.likedSongsCount / this.stats.totalSongs) * 100)
        : 0
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StatsManager;
}