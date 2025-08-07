const BaseStreamingService = require('./StreamingService.js.backup');

class StreamingService extends BaseStreamingService {
  constructor() {
    super();
    this.fallbackEnabled = true;
  }

  findCachedTrack(trackId) {
    try {
      if (!this.searchCache || this.searchCache.size === 0) return null;
      for (const [, entry] of this.searchCache.entries()) {
        const list = (entry && entry.results) || [];
        const found = list.find(t => String(t.id) === String(trackId));
        if (found) return found;
      }
    } catch {
      // ignore
    }
    return null;
  }

  async doJsonGet(url, timeoutMs = 10000) {
    const https = require('https');
    return new Promise((resolve, reject) => {
      try {
        const req = https.get(url, { timeout: timeoutMs, headers: { 'user-agent': 'Mozilla/5.0 Celes' } }, (res) => {
          let data = '';
          res.on('data', c => { data += c; });
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
          });
        });
        req.on('error', reject);
        req.on('timeout', () => { try { req.destroy(); } catch {} reject(new Error('timeout')); });
      } catch (e) { reject(e); }
    });
  }

  async searchYouTubePiped(query, limit = 20) {
    const instances = [
      'https://pipedapi.kavin.rocks',
      'https://piped.video',
      'https://piped.projectsegfau.lt',
    ];
    let lastErr = null;
    for (const base of instances) {
      try {
        const url = `${base}/search?q=${encodeURIComponent(query)}`;
        const json = await this.doJsonGet(url, 12000);
        const items = Array.isArray(json) ? json : (json && json.items) || [];
        const results = [];
        for (const it of items) {
          const isVideo = (it.type === 'video') || (it.duration != null && (it.url || it.url.endsWith && it.url.endsWith(it.id)));
          const vid = it.id || (it.url && it.url.split('watch?v=')[1]) || it.url || null;
          if (!isVideo || !vid || String(vid).length !== 11) continue;
          results.push({
            id: vid,
            title: it.title || 'YouTube',
            artist: (it.uploaderName || it.uploader || 'YouTube'),
            duration: Number(it.duration) || 0,
            thumbnail: (it.thumbnail || (it.thumbnails && it.thumbnails[0])) || '',
            url: `https://www.youtube.com/watch?v=${vid}`,
            platform: 'youtube',
            type: 'stream',
            streamUrl: null,
            album: 'YouTube Music',
            year: new Date().getFullYear(),
          });
          if (results.length >= limit) break;
        }
        if (results.length) return results;
      } catch (e) {
        lastErr = e;
        continue;
      }
    }
    if (lastErr) throw lastErr;
    return [];
  }

  async getYouTubeStreamUrlViaPiped(videoId) {
    const instances = [
      'https://pipedapi.kavin.rocks',
      'https://piped.video',
      'https://piped.projectsegfau.lt',
    ];
    for (const base of instances) {
      try {
        const url = `${base}/streams/${encodeURIComponent(videoId)}`;
        const json = await this.doJsonGet(url, 12000);
        const audios = json && (json.audioStreams || json.audio) || [];
        if (!Array.isArray(audios) || audios.length === 0) continue;
        // Prefer opus > m4a and highest bitrate
        const sorted = [...audios].sort((a, b) => {
          const codecScore = (s) => /opus/i.test(s || '') ? 3 : (/m4a|mp4a/i.test(s || '') ? 2 : 1);
          const ac = codecScore(a.codec || a.mimeType);
          const bc = codecScore(b.codec || b.mimeType);
          if (ac !== bc) return bc - ac;
          return (Number(b.bitrate) || Number(b.quality) || 0) - (Number(a.bitrate) || Number(a.quality) || 0);
        });
        const best = sorted[0];
        if (best && (best.url || best.link)) return best.url || best.link;
      } catch {
        // try next instance
      }
    }
    return null;
  }

  async searchMusic(query, platform = 'youtube', limit = 20) {
    // Internet Archive handled here
    if (platform === 'internetarchive') {
      const cacheKey = `${platform}:${query}:${limit}`;
      if (this.searchCache && this.searchCache.has(cacheKey)) {
        const cached = this.searchCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 300000) return cached.results;
      }
      const results = await this.searchInternetArchive(query, limit);
      if (this.searchCache) this.searchCache.set(cacheKey, { results, timestamp: Date.now() });
      return results;
    }

    // Prefer Piped for stable YouTube search
    if (platform === 'youtube') {
      try {
        const results = await this.searchYouTubePiped(query, limit);
        if (results && results.length) return results;
      } catch {
        // fall back to base search
      }
    }

    return super.searchMusic(query, platform, limit);
  }

  async getSoundCloudStreamUrl(trackIdOrUrl) {
    try {
      let permalink = null;
      if (typeof trackIdOrUrl === 'string' && trackIdOrUrl.startsWith('http')) {
        permalink = trackIdOrUrl;
      } else {
        const cached = this.findCachedTrack(trackIdOrUrl);
        if (cached && cached.url) permalink = cached.url;
      }
      if (!permalink) return null;
      const mod = (require('soundcloud-downloader') || {}).default || require('soundcloud-downloader');
      if (!mod || !mod.getAudioUrl) return null;
      const url = await mod.getAudioUrl(permalink).catch(() => null);
      return url;
    } catch {
      return null;
    }
  }

  async getStreamUrl(trackId, platform = 'internetarchive') {
    // Internet Archive: return pre-resolved URL if present
    if (platform === 'internetarchive') {
      const cached = this.findCachedTrack(trackId);
      return cached?.streamUrl || null;
    }
    if (platform === 'soundcloud') {
      return this.getSoundCloudStreamUrl(trackId);
    }
    if (platform === 'youtube' || (typeof trackId === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(trackId))) {
      // Try Piped first, then base (ytdl)
      const vid = typeof trackId === 'string' && trackId.length === 11 ? trackId : String(trackId);
      const viaPiped = await this.getYouTubeStreamUrlViaPiped(vid);
      if (viaPiped) return viaPiped;
      return super.getStreamUrl(vid, 'youtube');
    }
    return null;
  }

  // Prefer real Internet Archive search over static items
  async searchInternetArchive(query, limit = 20) {
    const https = require('https');
    const doGet = (url) => new Promise((resolve, reject) => {
      try {
        https.get(url, { timeout: 10000 }, (res) => {
          let data = '';
          res.on('data', (c) => { data += c; });
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
          });
        }).on('error', reject).on('timeout', function () { try { this.destroy(); } catch {} reject(new Error('timeout')); });
      } catch (e) { reject(e); }
    });

    const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}%20AND%20mediatype%3A(audio)&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=year&rows=${Math.min(50, Math.max(limit * 2, 10))}&page=1&output=json`;
    const search = await doGet(searchUrl).catch(() => ({ response: { docs: [] } }));
    const docs = (search?.response?.docs || []).slice(0, Math.max(limit * 2, limit));

    const results = [];
    for (const d of docs) {
      if (!d?.identifier) continue;
      const metaUrl = `https://archive.org/metadata/${encodeURIComponent(d.identifier)}`;
      const meta = await doGet(metaUrl).catch(() => null);
      const files = meta?.files || [];
      const mp3 = files.find(f => (f.format || '').toLowerCase().includes('mp3')) || files.find(f => (f.name || '').toLowerCase().endsWith('.mp3'));
      if (!mp3) continue;
      const streamUrl = `https://archive.org/download/${encodeURIComponent(d.identifier)}/${encodeURIComponent(mp3.name)}`;
      results.push({
        id: `ia_${d.identifier}`,
        title: d.title || mp3.name,
        artist: Array.isArray(d.creator) ? d.creator.join(', ') : (d.creator || 'Unknown'),
        duration: mp3.length ? Math.floor(parseFloat(mp3.length) * 60) : 0,
        thumbnail: `https://archive.org/services/img/${encodeURIComponent(d.identifier)}`,
        url: `https://archive.org/details/${encodeURIComponent(d.identifier)}`,
        streamUrl,
        platform: 'internetarchive',
        type: 'stream',
        album: 'Internet Archive',
        year: d.year || null,
        license: 'Open'
      });
      if (results.length >= limit) break;
    }

    return results;
  }

  async searchMusic(query, platform = 'youtube', limit = 20) {
    if (platform === 'internetarchive') {
      const cacheKey = `${platform}:${query}:${limit}`;
      if (this.searchCache && this.searchCache.has(cacheKey)) {
        const cached = this.searchCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 300000) {
          return cached.results;
        }
      }
      const results = await this.searchInternetArchive(query, limit);
      if (this.searchCache) {
        this.searchCache.set(cacheKey, { results, timestamp: Date.now() });
      }
      return results;
    }

    return super.searchMusic(query, platform, limit);
  }

  async searchMusicWithFallback(query, primaryPlatform = 'youtube', limit = 20) {
    const tried = new Set();
    const tryOrder = [];
    if (primaryPlatform) tryOrder.push(primaryPlatform);
    // Prefer large catalog first, then SC, then IA
    ['youtube', 'soundcloud', 'internetarchive'].forEach(p => { if (!tryOrder.includes(p)) tryOrder.push(p); });

    let lastError = null;
    for (const platform of tryOrder) {
      if (tried.has(platform)) continue;
      tried.add(platform);
      try {
        const res = await this.searchMusic(query, platform, limit);
        if (Array.isArray(res) && res.length > 0) return res;
      } catch (err) {
        lastError = err;
        continue;
      }
    }
    if (lastError) throw lastError;
    return [];
  }

  async getStreamUrl(trackId, platform = 'internetarchive') {
    // Fast path for Internet Archive: use cached track's streamUrl
    if (platform === 'internetarchive') {
      const cached = this.findCachedTrack(trackId);
      return cached?.streamUrl || null;
    }

    if (platform === 'soundcloud') {
      try {
        const cached = this.findCachedTrack(trackId);
        const permalink = (cached && cached.url) || (typeof trackId === 'string' && trackId.startsWith('http') ? trackId : null);
        if (!permalink) return null;
        const scdl = (require('soundcloud-downloader') || {}).default || require('soundcloud-downloader');
        if (!scdl || !scdl.getAudioUrl) return null;
        const audioUrl = await scdl.getAudioUrl(permalink).catch(() => null);
        return audioUrl;
      } catch (e) {
        return null;
      }
    }

    // If it looks like a YouTube video id, defer to base implementation
    const isYouTubeId = typeof trackId === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(trackId);
    if (platform === 'youtube' || isYouTubeId) {
      return super.getStreamUrl(trackId, 'youtube');
    }

    // SoundCloud and others not enabled in this build
    return null;
  }

  async getStreamUrlWithFallback(trackId, primaryPlatform = 'youtube') {
    try {
      const url = await this.getStreamUrl(trackId, primaryPlatform);
      if (url) return { streamUrl: url, platform: primaryPlatform };
    } catch (primaryError) {
      if (!this.fallbackEnabled) throw primaryError;
      // continue to fallbacks below
    }
    const order = ['youtube', 'soundcloud', 'internetarchive'];
    for (const p of order) {
      try {
        const url = await this.getStreamUrl(trackId, p);
        if (url) return { streamUrl: url, platform: p };
      } catch { /* next */ }
    }
    return null;
  }

  getSupportedPlatforms() {
    const base = super.getSupportedPlatforms ? super.getSupportedPlatforms() : {};
    return {
      ...base,
      youtube: { name: 'YouTube', searchUrl: 'https://www.youtube.com', supportsDirectPay: false },
      soundcloud: { name: 'SoundCloud', searchUrl: 'https://soundcloud.com', supportsDirectPay: false },
      internetarchive: { name: 'Internet Archive', searchUrl: 'https://archive.org', supportsDirectPay: true }
    };
  }

  // Top charts helpers
  async getYouTubeTop(limit = 50) {
    const instances = [
      'https://pipedapi.kavin.rocks',
      'https://piped.video',
      'https://piped.projectsegfau.lt',
    ];
    for (const base of instances) {
      try {
        const json = await this.doJsonGet(`${base}/trending`, 12000);
        const items = Array.isArray(json) ? json : (json && (json.items || json.videos)) || [];
        const results = [];
        for (const it of items) {
          const vid = it.id || it.url || it.videoId || null;
          const id = typeof vid === 'string' && vid.length === 11 ? vid : (it?.url?.split('watch?v=')[1] || null);
          if (!id) continue;
          results.push({
            id,
            title: it.title || 'YouTube',
            artist: it.uploaderName || it.uploader || 'YouTube',
            duration: Number(it.duration) || 0,
            thumbnail: it.thumbnail || (it.thumbnails && it.thumbnails[0]) || '',
            url: `https://www.youtube.com/watch?v=${id}`,
            platform: 'youtube',
            type: 'stream',
            streamUrl: null,
            album: 'YouTube Music',
            year: new Date().getFullYear(),
          });
          if (results.length >= limit) break;
        }
        if (results.length) return results;
      } catch { /* try next instance */ }
    }
    // Fallback: broad trending queries
    const fallbacks = ['top hits', 'trending songs', 'hot 50 songs', 'music chart'];
    for (const q of fallbacks) {
      try {
        const r = await this.searchYouTubePiped(q, limit);
        if (r && r.length) return r.slice(0, limit);
      } catch { /* next */ }
    }
    return [];
  }

  async getSoundCloudTop(limit = 50) {
    // Heuristic: run a few popular queries and merge unique
    const queries = ['soundcloud top 50', 'charts', 'popular tracks', 'hot 100'];
    const seen = new Set();
    const out = [];
    for (const q of queries) {
      try {
        const res = await super.searchMusic(q, 'soundcloud', limit);
        for (const t of res || []) {
          const key = `${t.platform}:${t.id}`;
          if (!seen.has(key)) { seen.add(key); out.push(t); if (out.length >= limit) break; }
        }
        if (out.length >= limit) break;
      } catch { /* continue */ }
    }
    return out.slice(0, limit);
  }

  async getTopCharts(platform = 'youtube', limit = 50) {
    if (platform === 'youtube') return this.getYouTubeTop(limit);
    if (platform === 'soundcloud') return this.getSoundCloudTop(limit);
    return [];
  }
}

module.exports = StreamingService;