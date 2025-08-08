# Celes — a beautiful, privacy‑minded desktop music player

Play the internet your way. Celes pairs a drop‑dead‑gorgeous interface with fast, reliable streaming and playlists that stay relevant. No accounts, no trackers, just press play.

<p align="center">
  <img alt="Celes hero" src="docs/hero.gif" width="820" />
  <br/>
<img width="1710" height="1069" alt="Screenshot 2025-08-08 at 5 59 25 AM" src="https://github.com/user-attachments/assets/86d32106-1941-476c-af6b-2c6cbd999cba" />
  <br/>
  <sub>Explore, queue, and fall into the music.</sub>
  <br/>
</p>

## Why it slaps

- Stunning, themeable UI: modern tokens, smooth micro‑interactions, focus rings, and accessible contrast. Make it yours.
- Instant search and playback: tight debounced search, snappy seek, proper previous, keyboard shortcuts (Space/K, J/L/←/→, ↑/↓).
- Explore that actually helps you discover: New Releases + Trending, refined to avoid tacky mixes and ultra‑long videos.
- Playlists that scale: unlimited tracks, rename, covers, reorder, remove, Play All/Queue All, export/import JSON.
- Liked Songs that stick: one heart adds to your library and the `Liked Songs` playlist.
- Ad‑free video in Theater mode: full‑screen Now Playing with optional video or a silky visualizer.
- Reliable streaming: hardened proxy, smart headers, instance rotation, strict YouTube playback with Internet Archive fallback.
- Local + downloads: save streams to disk, manage a download queue, and keep listening offline.

## What you get

- Explore: New Releases and Trending powered by YouTube, filtered for quality.
- Powerful queue: Play Next, drag/move (basic up/down today), radio‑style auto‑queue similar tracks.
- Dual‑audio crossfade engine for fast, gapless track changes.
- Lyrics: synced where available, plain‑text fallbacks, smooth highlighting, mini lyric line.
- Theming: Solarized-by-default plus presets (Light Green, Coral Blue, Silver, Midnight, Lilac). Tweak HSL live.
- Mini Dock: an in‑app mini player with video/visualizer toggles.

## Quick start

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

## Use it like a pro

- Space/K: Play/Pause • J/←: -5s • L/→: +5–10s • ↑/↓: volume
- Click heart to add to `Liked Songs` (and your library)
- Add to playlist from the card’s action row; create‑and‑add in one step
- Open any playlist to Play All or Queue All instantly

## Tech

- **Electron** - Cross-platform desktop framework
- **SQLite3** - Local database for music metadata
- **Node.js** - Backend runtime
- **HTML/CSS/JavaScript** - Frontend interface
- **Lucide Icons** - Clean, minimal iconography

## Architecture

- Main: Electron services (streaming proxy, updates, tray, settings), IPC, SQLite.
- Renderer: React + Tailwind tokens, dual‑audio player, lyrics, downloads, playlists.

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

 
