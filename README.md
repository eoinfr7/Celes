# Celes

An open-source, Spotify-like desktop music app built with Electron + React (Vite) + Tailwind. Streams free/open sources (e.g., Internet Archive, YouTube, SoundCloud) without login.

<img width="1804" height="974" alt="image" src="https://github.com/user-attachments/assets/f83cda6b-b3fe-48e1-92e5-4832b5939ee0" />

## Features

### Core Functionality
- **Local Music Library** - Import and organize your music files locally
- **Smart Playback History** - Navigate through previously played songs with intelligent history tracking
- **Queue Management** - Add songs to queue or play next with right-click context menus
- **Search & Filter** - Real-time search across songs, artists, and albums
- **Playlist Management** - Create and manage custom playlists

### Audio Controls
- **Standard Playback** - Play, pause, skip, previous with keyboard shortcuts
- **Shuffle & Repeat** - Randomize playback or repeat current track
- **Volume Control** - Smooth volume adjustment with visual feedback
- **Progress Seeking** - Click anywhere on the progress bar to jump to that position

### Smart Features
- **Custom Notifications** - Clean overlay notifications when window is minimized
- **Folder Watching** - Automatically detect new music files in watched directories
- **Recently Played** - Auto-generated smart playlist of recent tracks
- **Most Played** - Track and display your most frequently played songs
- **Media Key Support** - Control playback with system media keys

### Interface
- **Wireframe Design** - Clean, minimal interface with subtle borders and typography
- **Dark Theme** - Easy on the eyes with carefully chosen color palette
- **Context Menus** - Right-click songs for quick actions and navigation
- **System Tray** - Minimize to system tray for background playback
- **Responsive Layout** - Adapts to different window sizes

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup
```bash
# Clone the repository
git clone https://github.com/eoinfr7/Celes.git
cd Celes

# Install dependencies
npm install

# Start the application in dev (Vite + Electron)
npm run dev
```

### Build
```bash
# Build for your current platform
npm run build

# Build for specific platforms
npm run build:win
npm run build:mac
npm run build:linux
```

## Usage

### Getting Started
1. Launch Celes
2. Click "Add Music" or "Import Folders" to add your music library
3. Use the search bar to find specific tracks
4. Click any song to start playing

### Keyboard Shortcuts
- `Space` - Play/Pause
- `Left Arrow` - Previous track
- `Right Arrow` - Next track
- `Up Arrow` - Volume up
- `Down Arrow` - Volume down

### Right-Click Actions
- **Play Song** - Start playing immediately
- **Play Next** - Add to front of queue
- **Add to Queue** - Add to end of queue
- **Search by Artist** - Filter by the song's artist
- **Search by Album** - Filter by the song's album
- **Like/Unlike** - Add to or remove from liked songs
- **Delete** - Remove from library

## Technology Stack

- **Electron** - Cross-platform desktop framework
- **SQLite3** - Local database for music metadata
- **Node.js** - Backend runtime
- **HTML/CSS/JavaScript** - Frontend interface
- **Lucide Icons** - Clean, minimal iconography

## Architecture

### Main Process
- **Database Management** - SQLite database for music metadata and playlists
- **File System Operations** - Music file importing and folder watching
- **IPC Handlers** - Communication between main and renderer processes
- **System Integration** - Media keys, notifications, and tray functionality

### Renderer Process
- **Audio Player** - Core playback engine with crossfade support
- **UI Components** - Modular interface components
- **Music Library** - Song list rendering and management
- **Search & Navigation** - Real-time filtering and view switching

## File Structure

```
Celes/
├── src/
│   ├── main/               # Main process
│   │   ├── services/       # Core services
│   │   └── ipc/            # IPC handlers
│   ├── renderer/           # Renderer process
│   │   ├── components/     # UI components
│   │   └── services/       # Frontend services
│   └── overlay/            # Notification overlay
├── database/               # Database schema and operations
├── renderer/               # Main UI files
└── package.json
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with Electron for cross-platform compatibility
- Icons provided by Lucide
- Inspired by minimal design principles and modern music players
