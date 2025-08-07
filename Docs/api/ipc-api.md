# IPC API Reference

Complete reference for all Inter-Process Communication (IPC) methods available in the Celes music player.

## Database Operations

### Songs

#### `getAllSongs()`
Retrieves all songs from the database.

**Usage:**
```javascript
const songs = await window.electronAPI.getAllSongs();
```

**Returns:**
```javascript
[
  {
    id: 1,
    title: "Song Title",
    artist: "Artist Name",
    album: "Album Name",
    duration: 180.5,           // Duration in seconds
    file_path: "/path/to/song.mp3",
    file_size: 5242880,        // Size in bytes
    date_added: "2024-01-01T10:30:00.000Z",
    play_count: 5,
    last_played: "2024-01-15T14:20:00.000Z",
    is_liked: 1,               // 0 or 1
    liked_date: "2024-01-10T09:15:00.000Z"
  }
]
```

#### `addSong(songData)`
Adds a single song to the database.

**Parameters:**
- `songData` (string): Absolute file path to the audio file

**Usage:**
```javascript
const result = await window.electronAPI.addSong("/path/to/song.mp3");
```

**Returns:**
```javascript
{
  success: true,
  songId: 42,
  duplicate: false
}
// or
{
  success: false,
  error: "Error message",
  duplicate: true
}
```

#### `deleteSong(songId)`
Removes a song from the database and all playlists.

**Parameters:**
- `songId` (number): Database ID of the song

**Usage:**
```javascript
const result = await window.electronAPI.deleteSong(42);
```

**Returns:**
```javascript
{
  success: true,
  changes: 1
}
```

#### `toggleLikeSong(songId)`
Toggles the liked status of a song.

**Parameters:**
- `songId` (number): Database ID of the song

**Usage:**
```javascript
const result = await window.electronAPI.toggleLikeSong(42);
```

**Returns:**
```javascript
{
  success: true,
  isLiked: true,
  likedDate: "2024-01-15T14:30:00.000Z"
}
```

#### `getLikedSongs()`
Retrieves all liked songs.

**Usage:**
```javascript
const likedSongs = await window.electronAPI.getLikedSongs();
```

**Returns:** Array of song objects (same format as `getAllSongs()`)

### Playlists

#### `getPlaylists()`
Retrieves all playlists with their songs.

**Usage:**
```javascript
const playlists = await window.electronAPI.getPlaylists();
```

**Returns:**
```javascript
[
  {
    id: 1,
    name: "My Playlist",
    created_at: "2024-01-01T10:00:00.000Z",
    songs: [
      // Array of song objects with position property
      {
        id: 1,
        title: "Song Title",
        // ... other song properties
        position: 1
      }
    ]
  }
]
```

#### `createPlaylist(name)`
Creates a new playlist.

**Parameters:**
- `name` (string): Name of the playlist

**Usage:**
```javascript
const result = await window.electronAPI.createPlaylist("My New Playlist");
```

**Returns:**
```javascript
{
  success: true,
  playlistId: 5
}
```

#### `addSongToPlaylist(playlistId, songId)`
Adds a song to a playlist.

**Parameters:**
- `playlistId` (number): Database ID of the playlist
- `songId` (number): Database ID of the song

**Usage:**
```javascript
const result = await window.electronAPI.addSongToPlaylist(5, 42);
```

**Returns:**
```javascript
{
  success: true
}
```

#### `deletePlaylist(playlistId)`
Deletes a playlist (cannot delete "All Songs" playlist).

**Parameters:**
- `playlistId` (number): Database ID of the playlist

**Usage:**
```javascript
const result = await window.electronAPI.deletePlaylist(5);
```

**Returns:**
```javascript
{
  success: true,
  changes: 1
}
```

#### `renamePlaylist(playlistId, newName)`
Renames a playlist (cannot rename "All Songs" playlist).

**Parameters:**
- `playlistId` (number): Database ID of the playlist
- `newName` (string): New name for the playlist

**Usage:**
```javascript
const result = await window.electronAPI.renamePlaylist(5, "Updated Name");
```

**Returns:**
```javascript
{
  success: true,
  changes: 1
}
```

### Album Art

#### `getAlbumArt(songId)`
Retrieves album art for a song.

**Parameters:**
- `songId` (number): Database ID of the song

**Usage:**
```javascript
const result = await window.electronAPI.getAlbumArt(42);
```

**Returns:**
```javascript
{
  success: true,
  data: "base64_encoded_image_data",
  format: "image/jpeg"
}
// or
{
  success: false,
  error: "No album art found"
}
```

**Display Usage:**
```javascript
if (result.success) {
  const imageUrl = `data:${result.format};base64,${result.data}`;
  imgElement.src = imageUrl;
}
```

## File Operations

### File Dialogs

#### `showOpenDialog()`
Opens a file selection dialog for audio files.

**Usage:**
```javascript
const result = await window.electronAPI.showOpenDialog();
```

**Returns:**
```javascript
{
  canceled: false,
  filePaths: [
    "/path/to/song1.mp3",
    "/path/to/song2.flac"
  ]
}
```

#### `showFolderDialog()`
Opens a folder selection dialog.

**Usage:**
```javascript
const result = await window.electronAPI.showFolderDialog();
```

**Returns:**
```javascript
{
  canceled: false,
  filePaths: [
    "/path/to/music/folder"
  ]
}
```

## Folder Watching

#### `addWatchedFolder(folderPath)`
Adds a folder to the watch list for automatic music importing.

**Parameters:**
- `folderPath` (string): Absolute path to the folder

**Usage:**
```javascript
const result = await window.electronAPI.addWatchedFolder("/path/to/music");
```

**Returns:**
```javascript
{
  success: true
}
```

#### `removeWatchedFolder(folderPath)`
Removes a folder from the watch list.

**Parameters:**
- `folderPath` (string): Absolute path to the folder

**Usage:**
```javascript
const result = await window.electronAPI.removeWatchedFolder("/path/to/music");
```

**Returns:**
```javascript
{
  success: true
}
```

#### `getWatchedFolders()`
Retrieves all currently watched folders.

**Usage:**
```javascript
const folders = await window.electronAPI.getWatchedFolders();
```

**Returns:**
```javascript
[
  "/path/to/music/folder1",
  "/path/to/music/folder2"
]
```

#### `scanFolder(folderPath)`
Manual scan and import of a folder.

**Parameters:**
- `folderPath` (string): Absolute path to the folder

**Usage:**
```javascript
const result = await window.electronAPI.scanFolder("/path/to/music");
```

**Returns:**
```javascript
{
  success: true,
  stats: {
    added: 15,
    duplicates: 3,
    errors: 0
  }
}
```

## Window Operations

#### `windowMinimize()`
Minimizes the application window.

**Usage:**
```javascript
await window.electronAPI.windowMinimize();
```

#### `windowMaximize()`
Toggles window maximize/restore state.

**Usage:**
```javascript
await window.electronAPI.windowMaximize();
```

#### `windowClose()`
Closes the application window.

**Usage:**
```javascript
await window.electronAPI.windowClose();
```

#### `windowIsMaximized()`
Checks if window is currently maximized.

**Usage:**
```javascript
const isMaximized = await window.electronAPI.windowIsMaximized();
```

**Returns:** `true` or `false`

## System Integration

### Tray Operations

#### `updateMinimizeToTray(enabled)`
Enables or disables minimize-to-tray functionality.

**Parameters:**
- `enabled` (boolean): Whether to enable tray functionality

**Usage:**
```javascript
await window.electronAPI.updateMinimizeToTray(true);
```

### Media Keys

#### `registerMediaKeys()`
Registers system media key handlers.

**Usage:**
```javascript
window.electronAPI.registerMediaKeys();
```

#### `unregisterMediaKeys()`
Unregisters system media key handlers.

**Usage:**
```javascript
window.electronAPI.unregisterMediaKeys();
```

### Notifications

#### `showOverlayNotification(songData)`
Shows a custom overlay notification.

**Parameters:**
- `songData` (object): Song information to display

**Usage:**
```javascript
await window.electronAPI.showOverlayNotification({
  title: "Now Playing",
  artist: "Artist Name",
  album: "Album Name"
});
```

#### `hideOverlayNotification()`
Hides the current overlay notification.

**Usage:**
```javascript
await window.electronAPI.hideOverlayNotification();
```

## Smart Playlists

#### `trackSongPlay(songId)`
Records a song play for statistics and recently played tracking.

**Parameters:**
- `songId` (number): Database ID of the song

**Usage:**
```javascript
await window.electronAPI.trackSongPlay(42);
```

#### `getRecentlyPlayed()`
Gets recently played songs.

**Usage:**
```javascript
const recentSongs = await window.electronAPI.getRecentlyPlayed();
```

**Returns:** Array of song objects with `played_at` timestamp

#### `getSmartPlaylists()`
Gets all smart playlists (Recently Played, Recently Added, Most Played).

**Usage:**
```javascript
const smartPlaylists = await window.electronAPI.getSmartPlaylists();
```

**Returns:**
```javascript
{
  "Recently Played": [...songs],
  "Recently Added": [...songs],
  "Most Played": [...songs]
}
```

## Update System

#### `getAppVersion()`
Gets the current application version.

**Usage:**
```javascript
const version = await window.electronAPI.getAppVersion();
```

**Returns:** Version string (e.g., "1.0.5")

#### `checkForUpdates()`
Manually checks for application updates.

**Usage:**
```javascript
const updateInfo = await window.electronAPI.checkForUpdates();
```

**Returns:**
```javascript
{
  hasUpdate: true,
  version: "1.0.6",
  releaseNotes: "Bug fixes and improvements"
}
```

#### `handleUpdateDecision(decision, updateInfo)`
Handles user's update decision.

**Parameters:**
- `decision` (string): "install", "later", or "skip"
- `updateInfo` (object): Update information object

**Usage:**
```javascript
await window.electronAPI.handleUpdateDecision("install", updateInfo);
```

## Event Listeners

### Database Events

#### `onSongAdded(callback)`
Listens for single song additions.

**Usage:**
```javascript
window.electronAPI.onSongAdded((event, songData) => {
  console.log('Song added:', songData);
});
```

#### `onSongsBatchAdded(callback)`
Listens for batch song additions.

**Usage:**
```javascript
window.electronAPI.onSongsBatchAdded((event, songs) => {
  console.log('Songs added:', songs.length);
});
```

### Import Progress Events

#### `onBulkImportStart(callback)`
Listens for bulk import start.

**Usage:**
```javascript
window.electronAPI.onBulkImportStart((event, data) => {
  console.log('Import started:', data.totalFiles, 'files');
});
```

#### `onBulkImportProgress(callback)`
Listens for bulk import progress updates.

**Usage:**
```javascript
window.electronAPI.onBulkImportProgress((event, data) => {
  console.log(`Progress: ${data.processed}/${data.total}`);
  console.log('Stats:', data.stats);
});
```

#### `onBulkImportComplete(callback)`
Listens for bulk import completion.

**Usage:**
```javascript
window.electronAPI.onBulkImportComplete((event, stats) => {
  console.log('Import complete:', stats);
});
```

### Media Key Events

#### `onMediaKeyPlayPause(callback)`
Listens for media key play/pause events.

**Usage:**
```javascript
window.electronAPI.onMediaKeyPlayPause(() => {
  audioPlayer.togglePlayPause();
});
```

#### `onMediaKeyNext(callback)`
Listens for media key next track events.

**Usage:**
```javascript
window.electronAPI.onMediaKeyNext(() => {
  audioPlayer.nextSong();
});
```

#### `onMediaKeyPrevious(callback)`
Listens for media key previous track events.

**Usage:**
```javascript
window.electronAPI.onMediaKeyPrevious(() => {
  audioPlayer.previousSong();
});
```

### Update Events

#### `onUpdateNotification(callback)`
Listens for update notifications.

**Usage:**
```javascript
window.electronAPI.onUpdateNotification((event, updateInfo) => {
  showUpdateDialog(updateInfo);
});
```

#### `onUpdateDownloadProgress(callback)`
Listens for update download progress.

**Usage:**
```javascript
window.electronAPI.onUpdateDownloadProgress((event, progress) => {
  updateProgressBar(progress.percent);
});
```

## Utility Functions

### Path Utilities

#### `window.electronAPI.path.basename(filepath)`
Gets the base name of a file path.

**Usage:**
```javascript
const filename = window.electronAPI.path.basename("/path/to/song.mp3");
// Returns: "song.mp3"
```

#### `window.electronAPI.path.dirname(filepath)`
Gets the directory name of a file path.

**Usage:**
```javascript
const dirname = window.electronAPI.path.dirname("/path/to/song.mp3");
// Returns: "/path/to"
```

#### `window.electronAPI.path.extname(filepath)`
Gets the file extension.

**Usage:**
```javascript
const ext = window.electronAPI.path.extname("/path/to/song.mp3");
// Returns: ".mp3"
```

## Error Handling

All IPC methods that can fail return objects with a `success` property:

```javascript
const result = await window.electronAPI.addSong(filePath);
if (!result.success) {
  console.error('Error:', result.error);
  // Handle error appropriately
}
```

For methods that throw exceptions, wrap in try-catch blocks:

```javascript
try {
  const songs = await window.electronAPI.getAllSongs();
} catch (error) {
  console.error('IPC Error:', error);
  // Handle communication error
}
```

This API provides comprehensive access to all application functionality while maintaining security through the controlled preload script interface.