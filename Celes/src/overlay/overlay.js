class OverlayController {
  constructor() {
    this.songTitle = document.getElementById('song-title');
    this.songArtist = document.getElementById('song-artist');
    this.container = document.querySelector('.overlay-container');
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    window.overlayAPI.onShowSong((event, songData) => {
      this.showSong(songData);
    });
  }

  showSong(songData) {
    // Update text content
    this.songTitle.textContent = songData.title || 'Unknown Title';
    this.songArtist.textContent = songData.artist || 'Unknown Artist';

    // Trigger show animation
    this.container.classList.remove('hide');
    this.container.classList.add('show');
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OverlayController();
});