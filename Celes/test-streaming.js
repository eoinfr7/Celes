// Mock Electron app for testing
const { app } = require('electron');
if (!app) {
  // Mock app for standalone testing
  global.app = {
    getPath: (name) => {
      if (name === 'userData') {
        return './test-user-data';
      }
      return './test-data';
    }
  };
}

const StreamingService = require('./src/main/services/StreamingService');

async function testStreaming() {
  console.log('Testing Celes Streaming Service...\n');
  
  const streamingService = new StreamingService();
  
  try {
    // Test 1: YouTube Search
    console.log('1. Testing YouTube Search...');
    const youtubeResults = await streamingService.searchMusic('test music', 'youtube', 3);
    console.log(`Found ${youtubeResults.length} YouTube results`);
    youtubeResults.forEach((track, i) => {
      console.log(`  ${i + 1}. ${track.title} - ${track.artist}`);
    });
    
    // Test 2: SoundCloud Search
    console.log('\n2. Testing SoundCloud Search...');
    const soundcloudResults = await streamingService.searchMusic('electronic', 'soundcloud', 3);
    console.log(`Found ${soundcloudResults.length} SoundCloud results`);
    soundcloudResults.forEach((track, i) => {
      console.log(`  ${i + 1}. ${track.title} - ${track.artist}`);
    });
    
    // Test 3: Search with Fallback
    console.log('\n3. Testing Search with Fallback...');
    const fallbackResults = await streamingService.searchMusicWithFallback('popular music', 'youtube', 3);
    console.log(`Found ${fallbackResults.length} results with fallback`);
    fallbackResults.forEach((track, i) => {
      console.log(`  ${i + 1}. ${track.title} - ${track.artist} (${track.platform})`);
    });
    
    // Test 4: Stream URL with Fallback
    if (youtubeResults.length > 0) {
      console.log('\n4. Testing Stream URL with Fallback...');
      const firstTrack = youtubeResults[0];
      console.log(`Testing stream for: ${firstTrack.title}`);
      
      try {
        const streamResult = await streamingService.getStreamUrlWithFallback(firstTrack.id, 'youtube');
        console.log(`Stream URL obtained: ${streamResult.streamUrl ? 'Yes' : 'No'}`);
        console.log(`Platform used: ${streamResult.platform}`);
      } catch (error) {
        console.log(`Stream URL failed: ${error.message}`);
      }
    }
    
    // Test 5: Health Check
    console.log('\n5. Testing Health Check...');
    const health = await streamingService.healthCheck();
    console.log(`Health status: ${health.healthy ? 'Healthy' : 'Unhealthy'}`);
    console.log(`Message: ${health.message}`);
    
    // Test 6: Statistics
    console.log('\n6. Testing Statistics...');
    const stats = streamingService.getStats();
    console.log(`Cache sizes: Stream=${stats.streamCacheSize}, Search=${stats.searchCacheSize}`);
    console.log(`Rate limit delay: ${stats.currentRateLimit}ms`);
    console.log(`Queue length: ${stats.queueLength}`);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testStreaming().catch(console.error);
