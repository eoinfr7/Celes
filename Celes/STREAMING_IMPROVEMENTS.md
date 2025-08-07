# Celes Streaming Improvements

## Overview

The Celes music player now features enhanced streaming functionality with automatic fallback from YouTube to SoundCloud when streams fail. This provides a more reliable streaming experience with better error handling and platform redundancy.

## Key Improvements

### 1. Enhanced YouTube Streaming
- **Invidious Integration**: Uses multiple Invidious instances for better reliability
- **Fallback to ytdl-core**: If Invidious fails, falls back to direct YouTube streaming
- **Rate Limiting Protection**: Intelligent request queuing to avoid rate limits
- **Better Error Handling**: Specific error messages for different failure types

### 2. SoundCloud Integration
- **Full SoundCloud Support**: Complete integration with soundcloud-downloader
- **Track Info Retrieval**: Gets detailed track information including duration, play count, likes
- **Stream URL Generation**: Direct streaming from SoundCloud URLs
- **Error Recovery**: Graceful handling of SoundCloud API failures

### 3. Automatic Fallback System
- **YouTube → SoundCloud**: When YouTube streams fail, automatically tries SoundCloud
- **Search Fallback**: If YouTube search fails, tries SoundCloud search
- **Configurable**: Fallback can be enabled/disabled via settings
- **Transparent**: Users see which platform is being used

### 4. Improved Error Handling
- **Detailed Error Messages**: Specific error types and recovery suggestions
- **Graceful Degradation**: App continues working even when streaming fails
- **User Notifications**: Clear feedback about streaming status
- **Health Monitoring**: System health checks and statistics

## New Features

### Enhanced Search
```javascript
// Search with automatic fallback
const results = await streamingService.searchMusicWithFallback('query', 'youtube', 20);
```

### Stream URL with Fallback
```javascript
// Get stream URL with automatic fallback
const streamResult = await streamingService.getStreamUrlWithFallback(trackId, 'youtube');
// Returns: { streamUrl: 'url', platform: 'youtube' | 'soundcloud' }
```

### Health Monitoring
```javascript
// Check streaming health
const health = await streamingService.healthCheck();
// Returns: { healthy: boolean, message: string }

// Get streaming statistics
const stats = streamingService.getStats();
// Returns: { streamCacheSize, searchCacheSize, currentRateLimit, queueLength }
```

## API Changes

### New IPC Handlers
- `search-music-with-fallback`: Enhanced search with automatic fallback
- `get-stream-url-with-fallback`: Stream URL with automatic fallback
- `set-fallback-enabled`: Enable/disable fallback functionality
- `get-fallback-enabled`: Get current fallback status

### New StreamingManager Methods
- `searchMusicWithFallback()`: Search with automatic fallback
- `getStreamUrlWithFallback()`: Stream URL with automatic fallback

## Configuration

### Fallback Settings
The fallback system can be configured through the settings:

```javascript
// Enable/disable fallback
await window.electronAPI.setFallbackEnabled(true);

// Check fallback status
const enabled = await window.electronAPI.getFallbackEnabled();
```

### Platform Priority
The system tries platforms in this order:
1. Primary platform (usually YouTube)
2. SoundCloud (if primary fails)
3. Mock data (if all platforms fail)

## Usage Examples

### Basic Search with Fallback
```javascript
// Search for music with automatic fallback
const results = await window.electronAPI.searchMusicWithFallback('popular songs', 'youtube', 10);
```

### Playing a Track with Fallback
```javascript
// Get stream URL with fallback
const streamResult = await window.electronAPI.getStreamUrlWithFallback(track.id, 'youtube');

if (streamResult && streamResult.streamUrl) {
  // Play the track
  audioPlayer.src = streamResult.streamUrl;
  audioPlayer.play();
  
  // Show which platform is being used
  console.log(`Playing via ${streamResult.platform}`);
}
```

### Health Monitoring
```javascript
// Check if streaming is healthy
const health = await window.electronAPI.streamingHealthCheck();
if (!health.healthy) {
  console.log('Streaming issues detected:', health.message);
}

// Get streaming statistics
const stats = await window.electronAPI.getStreamingStats();
console.log(`Cache size: ${stats.streamCacheSize} streams`);
```

## Error Handling

### Common Error Types
- **Rate Limited**: YouTube temporarily blocking requests
- **Video Unavailable**: Content not available for streaming
- **Network Error**: Connection issues
- **Platform Unavailable**: Service temporarily down

### Recovery Strategies
1. **Automatic Retry**: System retries failed requests with exponential backoff
2. **Platform Fallback**: Automatically tries alternative platforms
3. **Cache Usage**: Uses cached results when available
4. **Mock Data**: Provides demo content when all else fails

## Performance Optimizations

### Caching
- **Stream URLs**: Cached for 1 hour to avoid repeated requests
- **Search Results**: Cached for 5 minutes for faster subsequent searches
- **Track Info**: Cached to reduce API calls

### Rate Limiting
- **Request Queuing**: Prevents overwhelming APIs
- **Exponential Backoff**: Intelligent retry delays
- **Instance Rotation**: Uses multiple Invidious instances

## Troubleshooting

### Common Issues

1. **No Search Results**
   - Check internet connection
   - Try different search terms
   - Verify fallback is enabled

2. **Streaming Fails**
   - Check if video is available in your region
   - Try SoundCloud fallback
   - Clear streaming cache

3. **Rate Limited**
   - Wait a few minutes before trying again
   - Reduce search frequency
   - Check streaming statistics

### Debug Commands
```javascript
// Clear all caches
await window.electronAPI.clearStreamingCache();

// Check health status
const health = await window.electronAPI.streamingHealthCheck();

// Get detailed statistics
const stats = await window.electronAPI.getStreamingStats();
```

## Testing

### Manual Testing
1. Search for music on YouTube
2. Try playing a track
3. If YouTube fails, verify SoundCloud fallback works
4. Check that notifications show correct platform

### Automated Testing
Run the test script to verify functionality:
```bash
node test-streaming-simple.js
```

## Future Enhancements

### Planned Features
- **Spotify Integration**: Add Spotify as another fallback option
- **Bandcamp Support**: Integrate Bandcamp for indie music
- **Quality Selection**: Allow users to choose streaming quality
- **Offline Caching**: Cache streams for offline playback
- **Playlist Import**: Import playlists from streaming platforms

### Performance Improvements
- **Parallel Requests**: Request from multiple platforms simultaneously
- **Predictive Caching**: Pre-cache likely-to-be-played tracks
- **Adaptive Quality**: Automatically adjust quality based on connection

## Technical Details

### Dependencies
- `@distube/ytdl-core`: YouTube streaming
- `soundcloud-downloader`: SoundCloud integration
- `chokidar`: File watching for local music
- `sqlite3`: Database for track storage

### Architecture
- **Main Process**: Handles streaming logic and API calls
- **Renderer Process**: UI and user interactions
- **IPC Bridge**: Communication between processes
- **Cache Layer**: Reduces API calls and improves performance

### Security Considerations
- **No API Keys Required**: Uses public APIs only
- **Rate Limiting**: Prevents abuse of services
- **Error Sanitization**: Prevents information leakage
- **Secure Protocols**: Uses HTTPS for all requests

## Support

For issues or questions about the streaming functionality:
1. Check the troubleshooting section above
2. Run the health check to diagnose issues
3. Clear caches if experiencing problems
4. Check the console for detailed error messages

The streaming system is designed to be robust and user-friendly, providing a seamless music streaming experience with automatic fallback when needed.
