# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository for **Celes** — named after the FFIX character and reflecting a love of astronomy.

## Development Commands

- `npm install` - Install dependencies
- `npm start` - Start the application
- `npm run dev` - Start in development mode with DevTools enabled
- `npm run build` - Build production distributable for current platform
- `npm run build:win` - Build Windows installer (.exe)
- `npm run build:mac` - Build macOS DMG
- `npm run build:linux` - Build Linux AppImage
- `npm run pack` - Pack for development testing (creates unpacked build)
- `npm run rebuild` - Rebuild native modules if compilation errors occur
- `npm run clean` - Remove node_modules and package-lock.json
- `npm run clean-build` - Clean, install, and rebuild before building

## Application Architecture

**Celes** is an Electron-based cross-platform music streaming player with a celestial midnight theme and clean separation between main and renderer processes. Features streaming from YouTube and SoundCloud with a Spotify-like interface redesigned with midnight blue aesthetics.

### Main Process Structure
- **Entry Point**: `main.js` bootstraps the application by initializing `MusicPlayerApp`
- **Core App**: `src/main/MusicPlayerApp.js` manages application lifecycle and coordinates services
- **Services**:
  - `WindowManager.js` - Creates and manages application windows
  - `TrayService.js` - System tray functionality and minimize-to-tray
  - `SettingsManager.js` - User preferences and configuration
  - `FolderWatcher.js` - Monitors folders for new music files
- **IPC**: `src/main/ipc/IPCHandlers.js` handles secure communication between main and renderer processes

### Renderer Process Structure
- **Core**: `src/renderer/MusicPlayer.js` is the main frontend controller
- **Components**: Modular UI components in `src/renderer/components/`
  - `AudioPlayer.js` - Audio playback engine using HTML5 Audio API
  - `DragDropHandler.js` - File drag and drop functionality
  - `PlaylistManager.js` - Playlist creation and management
  - `SongRenderer.js` - Song list display and interaction
  - `TitleBarManager.js` - Custom title bar controls
- **Services**: Frontend services in `src/renderer/services/`
  - `NotificationService.js` - In-app notifications
  - `ProgressService.js` - Progress indicators for bulk operations

### Database Architecture
- **Database**: `database/database.js` uses Better-SQLite3 for fast, synchronous operations
- **Schema**: Three main tables - `songs` (music metadata), `playlists`, and `playlist_songs` (many-to-many relationship)
- **Features**: Automatic metadata extraction using `music-metadata` library, album art storage as BLOB, play counts, and liked songs

### Key Technologies
- **Electron**: Cross-platform desktop framework
- **Better-SQLite3**: Fast synchronous SQLite database
- **music-metadata**: Audio file metadata parsing
- **chokidar**: File system watching for auto-import
- **HTML5 Audio API**: Audio playback functionality

### Audio File Support
Supports MP3, FLAC, WAV, M4A, AAC, and OGG formats with automatic metadata extraction and album art display.

### IPC Communication Pattern
All database operations and file system access go through secure IPC handlers to maintain Electron's security model. The preload script (`preload.js`) exposes a safe API to the renderer process.

## Important Development Notes

### Streaming Service Enhancements (2025-01-08)
The streaming integration has been significantly improved with:\n\n**YouTube Improvements:**
- **Enhanced Error Handling**: Better rate limiting protection and exponential backoff
- **Improved Search**: More robust video ID extraction with multiple regex patterns
- **Quality Selection**: Smart audio format selection prioritizing opus/aac codecs
- **Request Queuing**: Prevents API rate limiting with intelligent request batching
- **Health Monitoring**: Added health check and statistics monitoring
- **Caching Optimization**: Improved stream URL and search result caching

**SoundCloud Integration:**
- **Basic Framework**: Added SoundCloud platform support with search functionality
- **Mock Data System**: Provides fallback results when API issues occur
- **URL-based Tracking**: Uses full SoundCloud URLs for track identification
- **Platform Detection**: Automatic platform recognition in search results
- **Future-Ready**: Structure ready for full API integration when needed

**Enhanced Search Interface (2025-08-06):**
- **Platform Tabs**: Interactive tabs for easy switching between YouTube, SoundCloud, and other platforms
- **Advanced Filters**: Duration filters (short, medium, long), date filters, and sorting options
- **Search Suggestions**: Auto-complete suggestions based on search history and common patterns
- **Grid/List Views**: Toggle between visual grid layout and detailed list view
- **Real-time Filtering**: Instant results filtering without re-querying the API
- **Search History**: Maintains recent searches for quick access
- **Play All**: Batch playback of all search results with queueing support

**Celes Celestial Rebrand (2025-08-06):**
- **Midnight Theme**: Complete redesign with midnight blue (#0f0f23), black, white, and celestial blue (#4a9eff) color palette
- **Celestial UI Elements**: Star icons, constellation backgrounds, aurora gradients, and marimba-inspired progress bars
- **Stellar Collection**: Replaces "Liked Songs" with celestial-themed "Stellar Collection" using star icons
- **Cosmic Categories**: Browse categories renamed to cosmic themes (Stellar Pop, Cosmic Beats, Aurora Electronic, etc.)
- **Enhanced Animations**: Stellar glow effects, rotating cosmic gradients, drifting constellation backgrounds
- **Typography**: Changed to Inter font family for modern, clean celestial aesthetic

### Database Error Handling
The app includes robust fallback mechanisms for database failures. If Better-SQLite3 fails to initialize (common in production builds with missing native dependencies), the app creates a fallback database object with no-op methods to prevent crashes while maintaining basic functionality.

### Single Instance Lock
The application enforces single instance mode - attempting to launch a second instance will focus the existing window instead of creating a new one.

### Logging System
Comprehensive logging is set up in `main.js` that creates daily log files in the user data directory. All console.log and console.error calls are automatically written to timestamped log files for debugging production issues.

### Build System
Uses electron-builder with platform-specific configurations. The build process includes native module rebuilding via electron-rebuild, which is critical for Better-SQLite3 compatibility across platforms.

### File Structure Note
The project has two main directories: 
- Root repository contains this README and project documentation
- `Celes/` subdirectory contains the actual application code and should be the working directory for development