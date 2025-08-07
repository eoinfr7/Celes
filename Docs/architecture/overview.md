# Application Architecture

Celes is built using Electron's multi-process architecture with clear separation between main and renderer processes.

## High-Level Architecture

```
┌─────────────────────┐
│    Main Process     │
│  (Node.js Runtime)  │
├─────────────────────┤
│ • Application Core  │
│ • Database Access   │
│ • File Operations   │
│ • System Integration│
│ • IPC Handlers      │
└─────────────────────┘
         │ IPC
         ▼
┌─────────────────────┐
│  Renderer Process   │
│ (Chromium Runtime)  │
├─────────────────────┤
│ • User Interface    │
│ • Audio Playback    │
│ • Event Handling    │
│ • UI Components     │
└─────────────────────┘
```

## Process Separation

### Main Process (`main.js`)
- **Entry Point**: Bootstraps the application
- **Responsibilities**:
  - Create and manage application windows
  - Handle database operations
  - Manage file system access
  - System tray integration
  - Auto-updater functionality
  - Folder watching for new music files

### Renderer Process (`renderer/`)
- **Entry Point**: `renderer/index.html` loaded by main window
- **Responsibilities**:
  - Render user interface
  - Handle user interactions
  - Audio playback using HTML5 Audio API
  - Display music library and playlists
  - Implement drag-and-drop functionality

## Core Components

### 1. Application Bootstrap (`main.js`)
- Sets up comprehensive logging system
- Handles uncaught exceptions
- Enforces single instance lock
- Initializes `MusicPlayerApp` class

### 2. Application Core (`src/main/MusicPlayerApp.js`)
- Orchestrates all main process services
- Manages application lifecycle
- Coordinates database initialization
- Sets up service dependencies

### 3. Services Layer (`src/main/services/`)
- **WindowManager**: Creates and manages BrowserWindow instances
- **SettingsManager**: Handles user preferences and configuration
- **TrayService**: System tray functionality and minimize-to-tray
- **FolderWatcher**: Monitors directories for new music files
- **OverlayService**: Custom notification overlays
- **UpdateService**: Automatic update checking and installation

### 4. Database Layer (`database/database.js`)
- **Technology**: Better-SQLite3 for synchronous operations
- **Location**: User data directory (`app.getPath('userData')`)
- **Features**: Automatic metadata extraction, album art storage, play tracking
- **Fallback**: Graceful degradation when SQLite fails to initialize

### 5. IPC Communication (`src/main/ipc/IPCHandlers.js`)
- Secure communication bridge between processes
- Handles all database operations from renderer
- Manages file dialogs and system interactions
- Implements media key support

### 6. Frontend Architecture (`src/renderer/`)
- **MusicPlayer.js**: Main frontend controller
- **Components**: Modular UI components for specific functionality
- **Services**: Frontend-specific services (notifications, progress)
- **Utils**: Utility functions for formatting and helpers

## Security Model

### Context Isolation
```javascript
webPreferences: {
  nodeIntegration: false,        // Disable Node.js in renderer
  contextIsolation: true,        // Enable context isolation
  preload: path.join(__dirname, 'preload.js')  // Safe API exposure
}
```

### Preload Script (`preload.js`)
Exposes a controlled API to the renderer process:
```javascript
window.electronAPI = {
  // Database operations
  getAllSongs: () => ipcRenderer.invoke('get-all-songs'),
  addSong: (songData) => ipcRenderer.invoke('add-song', songData),
  
  // File operations
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  
  // System integration
  showNotification: (options) => ipcRenderer.invoke('show-notification', options)
}
```

## Data Flow

### Music Import Flow
1. User selects files/folders via file dialog (Renderer → Main)
2. Main process validates and processes files
3. Metadata extracted using `music-metadata` library
4. Song data stored in SQLite database
5. Frontend notified of new songs via IPC
6. UI updates to display new music

### Playback Flow
1. User clicks play button (Renderer)
2. Audio element loads file path
3. Playback starts using HTML5 Audio API
4. Play count updated via IPC to main process
5. Recently played list updated in database
6. System media keys registered for control

## Error Handling Strategy

### Database Failures
- Primary: Better-SQLite3 with full functionality
- Fallback: No-op database object to prevent crashes
- Graceful degradation with user notification

### File System Errors
- Robust path validation
- Cross-platform path handling
- Permission error handling
- Missing file detection and cleanup

### Audio Playback Errors
- Format support detection
- Corrupted file handling
- Hardware audio device failures
- Network drive access issues

## Performance Considerations

### Database Performance
- Synchronous SQLite operations (no async overhead)
- Indexed queries for fast searching
- Bulk insert operations for folder imports
- Connection pooling not needed (single connection)

### UI Performance
- Virtual scrolling for large music libraries
- Lazy loading of album art
- Debounced search input
- Efficient DOM updates

### Memory Management
- Album art stored as BLOB in database (not in memory)
- Audio buffer management for crossfade
- Component cleanup on view changes
- Event listener cleanup

## Development Patterns

### Service Pattern
All main process functionality is organized into service classes with clear responsibilities and dependency injection.

### Component Pattern
UI functionality is broken into reusable components with defined interfaces and event handling.

### Observer Pattern
Events are used extensively for loose coupling between components and services.

### Singleton Pattern
Database connection and core services use singleton pattern for shared state management.