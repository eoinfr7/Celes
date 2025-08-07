class PlaylistManager {
  constructor(playlistsList, playlistModal, playlistNameInput) {
    this.playlistsList = playlistsList;
    this.playlistModal = playlistModal;
    this.playlistNameInput = playlistNameInput;
    this.playlists = [];
    this.playlistSettingsModal = document.getElementById('playlist-settings-modal');
    this.currentPlaylistForSettings = null;
    
    this.bindEvents();
    this.setupPlaylistSettingsModal();
  }

  bindEvents() {
    document.getElementById('create-playlist-confirm-btn').addEventListener('click', () => this.createPlaylist());
    document.getElementById('cancel-playlist-btn').addEventListener('click', () => this.hidePlaylistModal());
    document.querySelector('.modal-close').addEventListener('click', () => this.hidePlaylistModal());
    
    this.playlistModal.addEventListener('click', (e) => {
      if (e.target === this.playlistModal) {
        this.hidePlaylistModal();
      }
    });
    
    this.playlistNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.createPlaylist();
      }
    });
  }

  renderPlaylists(playlists) {
    this.playlists = playlists;
    this.playlistsList.innerHTML = playlists.map(playlist => `
      <li class="playlist-item">
        <a href="#" class="playlist-link nav-item" data-playlist-id="${playlist.id}">
          ${playlist.name} (${playlist.songs ? playlist.songs.length : 0})
        </a>
        ${playlist.name !== 'All Songs' ? `
          <button class="playlist-settings-btn" data-playlist-id="${playlist.id}" title="Playlist settings">
            <i data-lucide="settings"></i>
          </button>
        ` : ''}
      </li>
    `).join('');

    // Add click handlers for playlist links
    document.querySelectorAll('.playlist-link[data-playlist-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const playlistId = parseInt(item.dataset.playlistId);
        window.musicPlayer.showPlaylist(playlistId);
      });
    });

    // Add click handlers for settings buttons
    document.querySelectorAll('.playlist-settings-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const playlistId = parseInt(btn.dataset.playlistId);
        const playlist = this.playlists.find(p => p.id === playlistId);
        if (playlist) {
          this.showPlaylistSettingsModal(playlist);
        }
      });
    });

    // Re-initialize Lucide icons
    if (typeof window.localIcons !== 'undefined') {
      window.localIcons.createIcons();
    }
  }

  showPlaylistModal() {
    this.playlistModal.classList.add('active');
    this.playlistNameInput.value = '';
    this.playlistNameInput.focus();
  }

  hidePlaylistModal() {
    this.playlistModal.classList.remove('active');
  }

  async createPlaylist() {
    const name = this.playlistNameInput.value.trim();
    if (!name) {
      alert('Please enter a playlist name');
      return;
    }

    try {
      const result = await window.electronAPI.createPlaylist(name);
      if (result.success) {
        await window.musicPlayer.loadPlaylists();
        this.hidePlaylistModal();
        console.log('Playlist created successfully');
      } else {
        alert('Error creating playlist: ' + result.error);
      }
    } catch (error) {
      console.error('Error creating playlist:', error);
      alert('Error creating playlist');
    }
  }

  getPlaylistById(id) {
    return this.playlists.find(p => p.id === id);
  }

  setupPlaylistSettingsModal() {
    // Close modal events
    document.getElementById('playlist-settings-modal-close').addEventListener('click', () => {
      this.hidePlaylistSettingsModal();
    });

    this.playlistSettingsModal.addEventListener('click', (e) => {
      if (e.target === this.playlistSettingsModal) {
        this.hidePlaylistSettingsModal();
      }
    });

    // Rename playlist button
    document.getElementById('rename-playlist-btn').addEventListener('click', () => {
      this.handlePlaylistRename();
    });

    // Delete playlist button
    document.getElementById('delete-playlist-btn').addEventListener('click', () => {
      this.handlePlaylistDelete();
    });

    // Enter key in rename input
    document.getElementById('playlist-rename-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handlePlaylistRename();
      }
    });
  }

  showPlaylistSettingsModal(playlist) {
    this.currentPlaylistForSettings = playlist;
    
    // Update modal content
    document.getElementById('current-playlist-name').textContent = playlist.name;
    document.getElementById('playlist-rename-input').value = playlist.name;
    
    // Show modal
    this.playlistSettingsModal.classList.add('active');
    
    // Focus the input
    setTimeout(() => {
      document.getElementById('playlist-rename-input').focus();
      document.getElementById('playlist-rename-input').select();
    }, 100);
  }

  hidePlaylistSettingsModal() {
    this.playlistSettingsModal.classList.remove('active');
    this.currentPlaylistForSettings = null;
    
    // Clear the input
    document.getElementById('playlist-rename-input').value = '';
  }

  async handlePlaylistRename() {
    if (!this.currentPlaylistForSettings) return;
    
    const newName = document.getElementById('playlist-rename-input').value.trim();
    if (!newName || newName === this.currentPlaylistForSettings.name) {
      return;
    }

    try {
      const result = await window.electronAPI.renamePlaylist(this.currentPlaylistForSettings.id, newName);
      if (result.success) {
        await this.loadPlaylists();
        this.hidePlaylistSettingsModal();
        
        // Show success notification
        if (window.musicPlayer && window.musicPlayer.notificationService) {
          window.musicPlayer.notificationService.showNotification(`Playlist renamed to "${newName}"`, 'success');
        }
        
        console.log('Playlist renamed successfully');
      } else {
        alert('Error renaming playlist: ' + result.error);
      }
    } catch (error) {
      console.error('Error renaming playlist:', error);
      alert('Error renaming playlist');
    }
  }

  async handlePlaylistDelete() {
    if (!this.currentPlaylistForSettings) return;
    
    const playlist = this.currentPlaylistForSettings;
    const confirmDelete = confirm(`Are you sure you want to delete the playlist "${playlist.name}"?\n\nThis action cannot be undone.`);
    
    if (confirmDelete) {
      try {
        const result = await window.electronAPI.deletePlaylist(playlist.id);
        if (result.success) {
          await this.loadPlaylists();
          this.hidePlaylistSettingsModal();
          
          // If we're currently viewing this playlist, switch to All Songs
          if (window.musicPlayer.currentView === 'playlist' && window.musicPlayer.currentPlaylistId === playlist.id) {
            window.musicPlayer.showAllSongs();
          }
          
          // Show success notification
          if (window.musicPlayer && window.musicPlayer.notificationService) {
            window.musicPlayer.notificationService.showNotification(`Playlist "${playlist.name}" deleted`, 'success');
          }
          
          console.log('Playlist deleted successfully');
        } else {
          alert('Error deleting playlist: ' + result.error);
        }
      } catch (error) {
        console.error('Error deleting playlist:', error);
        alert('Error deleting playlist');
      }
    }
  }

  async loadPlaylists() {
    await window.musicPlayer.loadPlaylists();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlaylistManager;
} else {
  window.PlaylistManager = PlaylistManager;
}