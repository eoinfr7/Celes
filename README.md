# Celes

An open‑source desktop music player named after the FFIX character Celes and inspired by astronomy. Play local files and stream from YouTube and SoundCloud — no login.

<img width="1450" height="1068" alt="Screenshot 2025-08-07 at 11 57 48 PM" src="https://github.com/user-attachments/assets/d06c701a-3c0a-4589-8b00-5fc14251a065" />


## Features

- Local library and playlists
- Streaming from YouTube and SoundCloud (no login)
- Fast search, queue, and context actions
- Keyboard controls, shuffle/repeat, seek and volume
- Smart history: Recently/Most played
- Tray + notifications when minimized
- Minimal dark UI that adapts to any window size

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

 
