# Renderer Process UI Architecture

The renderer process handles all user interface functionality using vanilla JavaScript with a component-based architecture.

## Entry Point

### `renderer/index.html`
Main HTML file loaded by the Electron window:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Celes Music Player</title>
    <link rel="stylesheet" href="styles.css">
    <!-- Component-specific stylesheets -->
    <link rel="stylesheet" href="sidebar.css">
    <link rel="stylesheet" href="header.css">
    <link rel="stylesheet" href="player-controls.css">
    <link rel="stylesheet" href="equalizer.css">
</head>
<body>
    <!-- UI structure -->
    <script src="../src/renderer/MusicPlayer.js"></script>
</body>
</html>
```

### `src/renderer/MusicPlayer.js`
Main controller class that orchestrates the entire frontend:

```javascript
class MusicPlayer {
  constructor() {
    this.songs = [];
    this.playlists = [];
    this.currentView = 'all-songs';
    this.currentPlaylist = null;
    this.searchQuery = '';
    this.filteredSongs = [];
    
    this.initializeElements();
    this.initializeServices();
    this.bindEvents();
    this.loadData();
  }
}
```

## Component Architecture

### Core Components

#### AudioPlayer (`src/renderer/components/AudioPlayer.js`)
Handles all audio playback functionality:

**Key Features:**
- HTML5 Audio API integration
- Crossfade support with dual audio elements
- Playback history tracking
- Shuffle and repeat modes
- Volume and progress control
- Queue management

**State Management:**
```javascript
constructor() {
  this.audio = document.getElementById('audio-player');
  this.currentSong = null;
  this.playlist = [];
  this.currentIndex = -1;
  this.isPlaying = false;
  this.isShuffle = false;
  this.isRepeat = false;
  this.volume = 1.0;
  this.queue = [];
  this.playbackHistory = [];
}
```

**Crossfade Implementation:**
```javascript
createSecondAudioElement() {
  this.nextAudio = document.createElement('audio');
  this.nextAudio.volume = 0;
  this.nextAudio.preload = 'auto';
  document.body.appendChild(this.nextAudio);
}
```

#### SongRenderer (`src/renderer/components/SongRenderer.js`)
Manages the display and interaction of song lists:

**Responsibilities:**
- Render song lists with virtual scrolling for performance
- Handle song selection and context menus
- Display album art, metadata, and play counts
- Search filtering and sorting
- Drag and drop reordering

#### PlaylistManager (`src/renderer/components/PlaylistManager.js`)
Handles playlist creation, management, and navigation:

**Features:**
- Create/delete/rename playlists
- Add/remove songs from playlists
- Smart playlist generation (Recently Played, Most Played, etc.)
- Playlist sidebar navigation

#### DragDropHandler (`src/renderer/components/DragDropHandler.js`)
Implements file drag-and-drop functionality:

**Supported Operations:**
- Drag audio files from file system
- Drag folders for bulk import
- Visual feedback during drag operations
- File type validation

```javascript
setupDropZone() {
  this.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    this.dropZone.classList.add('drag-over');
  });
  
  this.dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    await this.handleDroppedFiles(files);
  });
}
```

#### EqualizerManager (`src/renderer/components/EqualizerManager.js`)
Audio equalizer with preset and custom configurations:

**Features:**
- Multiple frequency bands (60Hz to 16kHz)
- Preset configurations (Rock, Jazz, Classical, etc.)
- Custom user presets
- Real-time audio processing
- Visual feedback with frequency response curve

#### SettingsManager (`src/renderer/components/SettingsManager.js`)
User preferences and configuration management:

**Settings Categories:**
- Audio settings (crossfade, equalizer)
- UI preferences (theme, notifications)
- System integration (tray, media keys)
- Folder watching configuration

#### TitleBarManager (`src/renderer/components/TitleBarManager.js`)
Custom title bar implementation for frameless window:

**Controls:**
- Minimize/Maximize/Close buttons
- Window drag functionality
- Double-click to maximize
- System integration styling

### Service Components

#### NotificationService (`src/renderer/services/NotificationService.js`)
In-app notification system:

**Features:**
- Toast notifications for user actions
- Import progress notifications
- Error message display
- Auto-dismiss timers
- Queue management for multiple notifications

#### ProgressService (`src/renderer/services/ProgressService.js`)
Progress indication for long-running operations:

**Use Cases:**
- Bulk music import progress
- Folder scanning progress
- Database operations
- File processing status

## UI Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Custom Title Bar (TitleBarManager)                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────┐ ┌─────────────────────────────────────────┐ │
│ │             │ │                                         │ │
│ │   Sidebar   │ │          Main Content Area              │ │
│ │             │ │                                         │ │
│ │ - Playlists │ │  ┌─────────────────────────────────────┐ │ │
│ │ - Smart     │ │  │        Song List                    │ │ │
│ │   Lists     │ │  │  (SongRenderer)                     │ │ │
│ │ - Folders   │ │  │                                     │ │ │
│ │             │ │  └─────────────────────────────────────┘ │ │
│ └─────────────┘ └─────────────────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Player Controls (AudioPlayer)                               │
│ [Prev] [Play/Pause] [Next] Progress Bar [Volume] [Options] │
└─────────────────────────────────────────────────────────────┘
```

## State Management

### Application State
```javascript
// MusicPlayer.js - Central state
{
  songs: [],              // All imported songs
  likedSongs: [],         // User favorites
  playlists: [],          // User and system playlists
  recentlyPlayed: [],     // Playback history
  currentView: 'all-songs', // Active view
  currentPlaylist: null,  // Selected playlist
  searchQuery: '',        // Search filter
  filteredSongs: []       // Filtered results
}
```

### Component Communication
Components communicate through:

1. **Direct method calls** for parent-child relationships
2. **Custom events** for decoupled communication
3. **Shared state** through the main MusicPlayer instance
4. **IPC events** for main process communication

### Event Handling Pattern
```javascript
// Event emission
this.dispatchEvent(new CustomEvent('song-selected', {
  detail: { song: selectedSong }
}));

// Event listening
document.addEventListener('song-selected', (event) => {
  this.handleSongSelection(event.detail.song);
});
```

## Styling Architecture

### CSS Organization
```
renderer/
├── styles.css          # Global styles and variables
├── sidebar.css         # Sidebar component styles
├── header.css          # Header and search styles
├── player-controls.css # Audio player controls
├── equalizer.css       # Equalizer component
└── styles/
    ├── components/     # Individual component styles
    ├── themes/         # Theme variations
    └── utilities/      # Utility classes
```

### CSS Custom Properties
```css
:root {
  --primary-color: #333;
  --secondary-color: #666;
  --accent-color: #007acc;
  --background-color: #f5f5f5;
  --border-color: #ddd;
  --text-color: #333;
  --success-color: #28a745;
  --error-color: #dc3545;
}
```

### Wireframe Design System
Celes uses a clean, minimal wireframe-inspired design:

```css
/* Consistent border style */
.wireframe-border {
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

/* Button styles */
.btn {
  background: transparent;
  border: 1px solid var(--border-color);
  padding: 8px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:hover {
  background: var(--accent-color);
  color: white;
}
```

## Performance Optimizations

### Virtual Scrolling
For large music libraries, the SongRenderer implements virtual scrolling:

```javascript
updateVisibleSongs() {
  const containerHeight = this.songList.clientHeight;
  const itemHeight = 60; // Fixed row height
  const startIndex = Math.floor(this.scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + Math.ceil(containerHeight / itemHeight) + 1, this.songs.length);
  
  this.renderSongs(this.songs.slice(startIndex, endIndex), startIndex);
}
```

### Debounced Search
Search input is debounced to prevent excessive filtering:

```javascript
setupSearch() {
  let searchTimeout;
  this.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      this.performSearch(e.target.value);
    }, 300);
  });
}
```

### Image Loading Optimization
Album art loading is optimized with lazy loading and caching:

```javascript
async loadAlbumArt(songId) {
  if (this.albumArtCache.has(songId)) {
    return this.albumArtCache.get(songId);
  }
  
  const result = await window.electronAPI.getAlbumArt(songId);
  if (result.success) {
    const url = `data:${result.format};base64,${result.data}`;
    this.albumArtCache.set(songId, url);
    return url;
  }
  
  return null;
}
```

## Error Handling

### Component Error Boundaries
```javascript
class Component {
  constructor() {
    this.handleError = this.handleError.bind(this);
    window.addEventListener('error', this.handleError);
  }
  
  handleError(error) {
    console.error('Component error:', error);
    this.notificationService.showError('An error occurred in the interface');
  }
}
```

### Graceful Degradation
```javascript
async loadSongs() {
  try {
    this.songs = await window.electronAPI.getAllSongs();
    this.renderSongs();
  } catch (error) {
    console.error('Failed to load songs:', error);
    this.showEmptyState('Unable to load music library');
  }
}
```

This architecture provides a clean separation of concerns, efficient performance, and maintainable code structure while delivering a responsive and intuitive user experience.