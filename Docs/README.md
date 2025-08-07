# Celes Music Player Documentation

This documentation provides comprehensive information about the Celes music player application architecture, components, and development guidelines.

## Documentation Structure

### Architecture Overview
- [Application Architecture](./architecture/overview.md) - High-level application structure and design patterns

### Main Process
- [Services](./main-process/services.md) - Core services (Tray, Settings, Folder Watching, etc.)
- [IPC Handlers](./main-process/ipc-handlers.md) - Inter-process communication handlers

### Renderer Process
- [UI Architecture](./renderer-process/ui-architecture.md) - Frontend structure and components

### Database
- [Schema Design](./database/schema.md) - Database tables and relationships


### API Reference
- [IPC API](./api/ipc-api.md) - Complete IPC API reference

### Build System
- [Build Configuration](./build-system/configuration.md) - Electron Builder setup

## Key Technologies

- **Electron 27.0.0** - Cross-platform desktop framework
- **Better-SQLite3 12.2.0** - Synchronous SQLite database
- **music-metadata 7.14.0** - Audio metadata extraction
- **chokidar 4.0.3** - File system watching
- **HTML5 Audio API** - Audio playback

## Supported Audio Formats

Celes supports the following audio formats:
- MP3 (.mp3)
- FLAC (.flac)
- WAV (.wav)
- M4A (.m4a)
- AAC (.aac)
- OGG (.ogg)

All formats include automatic metadata extraction and album art display.

## Development Quick Start

1. Navigate to the Celes directory: `cd Celes/`
2. Install dependencies: `npm install`
3. Start in development mode: `npm run dev`
4. Build for production: `npm run build`

For detailed development information, see the individual documentation files.