const BaseStreamingService = require('./StreamingService.js.backup');
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

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

  async fetchText(url, timeoutMs = 12000) {
    const https = require('https');
    return new Promise((resolve, reject) => {
      try {
        const req = https.get(url, { timeout: timeoutMs, headers: { 'user-agent': 'Mozilla/5.0 Celes' } }, (res) => {
          let data = '';
          res.on('data', c => { data += c; });
          res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.on('timeout', () => { try { req.destroy(); } catch {} reject(new Error('timeout')); });
      } catch (e) { reject(e); }
    });
  }

  // --- Simple disk cache for artist overviews
  getArtistCachePath(artistName) {
    try {
      const dir = path.join(app.getPath('userData'), 'artist-cache');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const slug = String(artistName || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '') || 'unknown';
      return path.join(dir, `${slug}.json`);
    } catch {
      return null;
    }
  }

  readArtistCache(artistName, ttlMs = 24*60*60*1000) {
    try {
      const p = this.getArtistCachePath(artistName);
      if (!p || !fs.existsSync(p)) return null;
      const json = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (json && Number.isFinite(json.ts) && (Date.now() - json.ts) < ttlMs) {
        return json.data || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  writeArtistCache(artistName, data) {
    try {
      const p = this.getArtistCachePath(artistName);
      if (!p) return;
      fs.writeFileSync(p, JSON.stringify({ ts: Date.now(), data }, null, 2));
    } catch { /* ignore */ }
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

  // Loudness analysis placeholder (EBU R128 / ReplayGain style)
  async analyzeLoudnessPlaceholder(streamUrl) {
    // TODO: integrate real analysis (e.g., ffmpeg/ebur128)
    return { integratedLufs: -14, peakDb: -1.0 }; // neutral defaults
  }

  getLoudnessCachePath(trackId, platform) {
    try {
      const dir = path.join(app.getPath('userData'), 'loudness-cache');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const slug = `${String(platform||'').toLowerCase()}_${String(trackId).replace(/[^a-z0-9_-]+/gi,'')}`;
      return path.join(dir, `${slug}.json`);
    } catch { return null; }
  }

  async analyzeLoudnessFfmpeg(streamUrl) {
    try {
      const ffmpegPath = (()=>{ try { return require('ffmpeg-static'); } catch { return null } })();
      if (!ffmpegPath) return this.analyzeLoudnessPlaceholder(streamUrl);
      const { spawn } = require('child_process');
      return await new Promise((resolve) => {
        const args = ['-hide_banner','-nostats','-i', streamUrl, '-filter_complex','ebur128','-f','null','-'];
        const proc = spawn(ffmpegPath, args, { stdio: ['ignore','ignore','pipe'] });
        let stderr = '';
        proc.stderr.on('data', (d)=>{ stderr += d.toString() });
        proc.on('close', () => {
          const mI = stderr.match(/Integrated loudness:\s*(-?[0-9.]+)\s*LUFS/i);
          const mP = stderr.match(/True peak:\s*(-?[0-9.]+)\s*dBFS/i) || stderr.match(/Peak:\s*(-?[0-9.]+)\s*dB/i);
          const integratedLufs = mI ? parseFloat(mI[1]) : -14;
          const peakDb = mP ? parseFloat(mP[1]) : -1.0;
          resolve({ integratedLufs, peakDb });
        });
        proc.on('error', () => resolve(this.analyzeLoudnessPlaceholder(streamUrl)));
      });
    } catch { return this.analyzeLoudnessPlaceholder(streamUrl); }
  }

  async getTrackLoudness(trackId, platform = 'youtube', { force = false, ttlMs = 14*24*60*60*1000 } = {}) {
    try {
      const cachePath = this.getLoudnessCachePath(trackId, platform);
      if (!force && cachePath && fs.existsSync(cachePath)) {
        try {
          const json = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
          if (json && Number.isFinite(json.ts) && (Date.now() - json.ts) < ttlMs) return json.data;
        } catch {}
      }
      const res = await this.getStreamUrlWithFallback(trackId, platform);
      const url = res?.streamUrl;
      if (!url) return this.analyzeLoudnessPlaceholder(null);
      const data = await this.analyzeLoudnessFfmpeg(url);
      if (cachePath) {
        try { fs.writeFileSync(cachePath, JSON.stringify({ ts: Date.now(), data }, null, 2)); } catch {}
      }
      return data;
    } catch { return this.analyzeLoudnessPlaceholder(null); }
  }

  // --- Playlist importers ---
  async importSpotifyPlaylist(url) {
    try {
      const html = await this.fetchText(url, 15000).catch(()=>null);
      if (!html) return null;
      let name = (html.match(/<title>([^<]+)<\/title>/i)?.[1] || '').replace(/\s*-\s*playlist\s*\|\s*spotify.*/i,'').trim();
      const items = [];
      // Try hydration JSON
      const hydra = html.match(/__sc_hydration\s*=\s*(\[\{[\s\S]*?\}\]);/);
      if (hydra && hydra[1]) {
        try {
          const arr = JSON.parse(hydra[1]);
          const collect = (o)=>{ if(!o||typeof o!=='object') return; if (Array.isArray(o)) { o.forEach(collect); return; } for (const k of Object.keys(o)) { const v=o[k]; if (k==='track' && v && typeof v==='object') {
              const title = v.name || v.title; const artist = (v.artists&&v.artists[0]&&v.artists[0].name)||''; if(title&&artist) items.push({ title, artist });
            } collect(v);
          } };
          arr.forEach(collect);
        } catch {}
      }
      // Regex fallback
      if (items.length === 0) {
        const re = /"track"\s*:\s*\{[\s\S]*?"name"\s*:\s*"([^"]+)"[\s\S]*?"artists"\s*:\s*\[[\s\S]*?"name"\s*:\s*"([^"]+)"/g;
        let m; while ((m = re.exec(html))) { const title=m[1]; const artist=m[2]; if (title && artist) items.push({ title, artist }); }
      }
      if (!name) name = 'Imported from Spotify';
      return { name, items };
    } catch { return null; }
  }

  async importAppleMusicPlaylist(url) {
    try {
      const html = await this.fetchText(url, 15000).catch(()=>null);
      if (!html) return null;
      let name = (html.match(/<title>([^<]+)<\/title>/i)?.[1] || '').replace(/on Apple Music.*/i,'').trim();
      const items = [];
      const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      if (ld && ld[1]) {
        try {
          const obj = JSON.parse(ld[1]);
          const tracks = obj?.track?.itemListElement || obj?.tracks || [];
          for (const it of tracks) {
            const item = it.item || it;
            const title = item?.name || item?.trackName;
            const artist = (item?.byArtist && (item.byArtist.name || (Array.isArray(item.byArtist)&&item.byArtist[0]?.name))) || '';
            if (title && artist) items.push({ title, artist });
          }
        } catch {}
      }
      if (!name) name = 'Imported from Apple Music';
      return { name, items };
    } catch { return null; }
  }

  async importPlaylistFromUrl(url) {
    try {
      const u = new URL(url);
      if (/spotify\.com/.test(u.hostname)) return this.importSpotifyPlaylist(url);
      if (/music\.apple\.com/.test(u.hostname) || /itunes\.apple\.com/.test(u.hostname)) return this.importAppleMusicPlaylist(url);
      return null;
    } catch { return null; }
  }

  // --- Lyrics (LRCLIB) ---
  getLyricsCachePath(artist, title) {
    try {
      const dir = path.join(app.getPath('userData'), 'lyrics-cache');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const slug = `${String(artist||'').toLowerCase().replace(/[^a-z0-9]+/gi,'-')}_${String(title||'').toLowerCase().replace(/[^a-z0-9]+/gi,'-')}`.replace(/^-+|-+$/g,'');
      return path.join(dir, `${slug}.json`);
    } catch { return null; }
  }

  async searchLyricsLrclib(artist, title, durationSec) {
    try {
      const base = 'https://lrclib.net/api/search';
      const params = new URLSearchParams();
      if (title) params.set('track_name', title);
      if (artist) params.set('artist_name', artist);
      if (Number.isFinite(durationSec)) params.set('duration', String(Math.round(durationSec)));
      const url = `${base}?${params.toString()}`;
      const res = await this.doJsonGet(url, 12000).catch(()=>null);
      if (!res) return null;
      const list = Array.isArray(res) ? res : [];
      if (list.length === 0) return null;
      // choose best by closest duration
      let best = list[0];
      if (Number.isFinite(durationSec)) {
        best = list.slice().sort((a,b)=> Math.abs((a.duration||0)-durationSec) - Math.abs((b.duration||0)-durationSec))[0] || list[0];
      }
      return {
        source: 'lrclib',
        syncedLyrics: best.syncedLyrics || null,
        plainLyrics: best.plainLyrics || null,
        trackName: best.trackName,
        artistName: best.artistName,
        duration: best.duration || null,
      };
    } catch { return null; }
  }

  async getLyricsForTrack(meta) {
    try {
      const artist = (meta && meta.artist) || '';
      const title = (meta && meta.title) || '';
      const duration = (meta && Number(meta.duration)) || null;
      const cachePath = this.getLyricsCachePath(artist, title);
      if (cachePath && fs.existsSync(cachePath)) {
        try { return JSON.parse(fs.readFileSync(cachePath,'utf8')); } catch {}
      }
      const lrclib = await this.searchLyricsLrclib(artist, title, duration);
      if (lrclib) {
        if (cachePath) { try { fs.writeFileSync(cachePath, JSON.stringify(lrclib, null, 2)); } catch {} }
        return lrclib;
      }
      return null;
    } catch { return null; }
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

  // --- Offline download helpers ---
  async downloadTrackToFile(track, targetDir) {
    try {
      const { net } = require('electron');
      const fs = require('fs');
      const path = require('path');
      const toProxy = (u) => `celes-stream://proxy?u=${encodeURIComponent(u)}`;
      let streamUrl = track.streamUrl;
      if (!streamUrl) {
        const res = await this.getStreamUrlWithFallback(track.id, track.platform||'youtube');
        streamUrl = res?.streamUrl || null;
      }
      if (!streamUrl) throw new Error('No stream URL');
      const finalUrl = toProxy(streamUrl);
      const safe = (s)=> String(s||'').replace(/[^a-z0-9\-_. ]+/gi,'').slice(0,80);
      const filename = `${safe(track.artist)} - ${safe(track.title)}.m4a`;
      const outPath = path.join(targetDir, filename);
      const response = await net.fetch(finalUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || 'audio/m4a';
      const file = fs.createWriteStream(outPath);
      const reader = response.body.getReader();
      let written = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        file.write(Buffer.from(value));
        written += value.length;
      }
      file.end();
      return { path: outPath, bytes: written, contentType };
    } catch (e) {
      console.error('Download failed:', e);
      throw e;
    }
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

  // --- Artist helpers ---
  normalizeArtistName(name) {
    try {
      let n = String(name || '').trim();
      n = n.replace(/\b-\s*Topic\b/gi, '').replace(/\bVEVO\b/gi, '').replace(/\s*\(official.*?\)/gi, '').trim();
      n = n.replace(/feat\.|ft\.|featuring/gi, ',');
      // keep first primary credit
      n = n.split(',')[0].split('&')[0].split(' x ')[0].trim();
      return n;
    } catch { return String(name || '').trim(); }
  }

  async getSimilarArtists(artistName, limit = 12) {
    try {
      const baseName = this.normalizeArtistName(artistName);
      const queries = [
        `${baseName} similar artists`,
        `${baseName} fans also like`,
        `${baseName} related artists`,
        `artists like ${baseName}`
      ];
      const counts = new Map();
      const sample = new Map();
      for (const q of queries) {
        const list = await this.searchMusicWithFallback(q, 'youtube', 30).catch(() => []);
        for (const t of list || []) {
          const a = this.normalizeArtistName(t.artist || '');
          if (!a || a.toLowerCase() === baseName.toLowerCase()) continue;
          counts.set(a, (counts.get(a) || 0) + 1);
          if (!sample.has(a)) sample.set(a, t);
        }
      }
      const ranked = [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0, Math.max(limit*2, limit));
      const out = ranked.map(([name]) => {
        const t = sample.get(name) || {};
        return { name, thumbnail: t.thumbnail || '', sampleTrack: t };
      }).slice(0, limit);
      return out;
    } catch (e) {
      console.error('Error getting similar artists:', e);
      return [];
    }
  }

  async getArtistTopTracks(artistName, limit = 10) {
    try {
      const base = this.normalizeArtistName(artistName);
      const queries = [
        `${base} top songs`,
        `best of ${base}`,
        `${base} popular tracks`,
        `${base}`
      ];
      const seen = new Set();
      const out = [];
      for (const q of queries) {
        const res = await this.searchMusicWithFallback(q, 'youtube', 40).catch(()=>[]);
        for (const t of res) {
          const a = this.normalizeArtistName(t.artist || '');
          if (!a || a.toLowerCase() !== base.toLowerCase()) continue;
          const key = `${t.platform}:${t.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(t);
          if (out.length >= limit) break;
        }
        if (out.length >= limit) break;
      }
      return out.slice(0, limit);
    } catch (e) {
      console.error('Error getting artist top tracks:', e);
      return [];
    }
  }

  async getWikipediaSummary(artistName) {
    try {
      const searchUrl = `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(artistName)}&limit=1`;
      const search = await this.doJsonGet(searchUrl, 12000).catch(() => null);
      const page = (search && search.pages && search.pages[0]) || null;
      const title = page?.title || artistName;
      const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const summary = await this.doJsonGet(sumUrl, 12000).catch(() => null);
      if (!summary) return null;
      return {
        title: summary.title || title,
        extract: summary.extract || '',
        thumbnail: (summary.thumbnail && summary.thumbnail.source) || '',
        source: 'wikipedia'
      };
    } catch { return null; }
  }

  async getSpotifyBioUnofficial(artistName) {
    try {
      // Use DuckDuckGo to find the Spotify artist URL
      const ddg = await this.fetchText(`https://duckduckgo.com/html/?q=${encodeURIComponent(artistName + ' spotify artist')}`, 12000).catch(()=>null);
      let url = null;
      if (ddg) {
        const m = ddg.match(/https?:\/\/open\.spotify\.com\/artist\/([a-zA-Z0-9]+)/);
        if (m) url = `https://open.spotify.com/artist/${m[1]}`;
      }
      if (!url) return null;
      const html = await this.fetchText(url, 12000).catch(()=>null);
      if (!html) return null;
      // Spotify artist pages embed JSON in a script tag window.__sc_hydration or application/ld+json sometimes contains description
      const hydra = html.match(/__sc_hydration\s*=\s*(\[\{[\s\S]*?\}\]);/);
      if (hydra && hydra[1]) {
        try {
          const arr = JSON.parse(hydra[1]);
          const jsons = [];
          const drill = (o)=>{ if(!o||typeof o!=='object') return; for(const k of Object.keys(o)){ const v=o[k]; if(k==='data'&&v&&typeof v==='object') jsons.push(v); drill(v);} };
          arr.forEach(x=>drill(x));
          let desc = null;
          for (const j of jsons){ if (j && typeof j.description === 'string' && j.description.length > 40){ desc = j.description; break; } }
          if (desc) return { source: 'spotify', extract: desc };
        } catch { /* ignore */ }
      }
      // fallback: try ld+json
      const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      if (ld && ld[1]) {
        try {
          const obj = JSON.parse(ld[1]);
          const desc = obj?.description || null;
          if (desc) return { source: 'spotify', extract: desc };
        } catch {}
      }
      return null;
    } catch { return null; }
  }

  async getYouTubeSubscribersEstimate(artistName) {
    try {
      const instances = [
        'https://pipedapi.kavin.rocks',
        'https://piped.video',
        'https://piped.projectsegfau.lt',
      ];
      for (const base of instances) {
        try {
          const json = await this.doJsonGet(`${base}/search?q=${encodeURIComponent(artistName)}`, 12000);
          const items = Array.isArray(json) ? json : (json && json.items) || [];
          const channels = items.filter(it => it.type === 'channel' || it?.uploaderUrl);
          if (!channels.length) continue;
          const ch = channels[0];
          const subStr = ch?.subscribers || ch?.subscriberCount || '';
          if (!subStr) continue;
          // Parse like "1.2M subscribers"
          const num = String(subStr).toLowerCase().replace(/[^0-9\.km]/g,'');
          const toNum = (s)=> s.endsWith('m')? Math.round(parseFloat(s)*1_000_000): s.endsWith('k')? Math.round(parseFloat(s)*1_000): Math.round(parseFloat(s));
          const parsed = toNum(num);
          if (Number.isFinite(parsed)) return parsed;
        } catch { /* try next */ }
      }
      return null;
    } catch { return null; }
  }

  parseHumanNumber(text) {
    try {
      const s = String(text || '').trim().toLowerCase().replace(/[,\s]/g, '');
      if (!s) return null;
      if (s.endsWith('m')) return Math.round(parseFloat(s) * 1_000_000);
      if (s.endsWith('k')) return Math.round(parseFloat(s) * 1_000);
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : null;
    } catch { return null; }
  }

  async getSoundCloudFollowers(artistName) {
    try {
      // Heuristic: find a track by the artist, derive the user slug, open the profile HTML and parse followers_count
      const tracks = await this.searchMusicWithFallback(artistName, 'soundcloud', 5).catch(()=>[]);
      const first = (tracks || []).find(t => (t.platform === 'soundcloud') && t.url);
      if (!first) return null;
      const u = new URL(first.url);
      const parts = u.pathname.split('/').filter(Boolean);
      const userSlug = parts[0];
      if (!userSlug) return null;
      const html = await this.fetchText(`https://soundcloud.com/${userSlug}`).catch(()=>null);
      if (!html) return null;
      const mJson = html.match(/\"followers_count\"\s*:\s*(\d+)/);
      if (mJson && mJson[1]) return parseInt(mJson[1], 10);
      const mTxt = html.match(/([0-9.,]+)\s*followers/i);
      if (mTxt && mTxt[1]) return this.parseHumanNumber(mTxt[1]);
      return null;
    } catch { return null; }
  }

  async getArtistOverview(artistName, limits = { top: 10, similar: 12 }, options = {}) {
    try {
      const { force = false, ttlMs = 24*60*60*1000 } = options || {};
      if (!force) {
        const cached = this.readArtistCache(artistName, ttlMs);
        if (cached) return cached;
      }
      const [topTracks, similarArtists, wiki, ytSubs, scFollows, spotBio] = await Promise.all([
        this.getArtistTopTracks(artistName, limits.top || 10),
        this.getSimilarArtists(artistName, limits.similar || 12),
        this.getWikipediaSummary(artistName),
        this.getYouTubeSubscribersEstimate(artistName),
        this.getSoundCloudFollowers(artistName),
        this.getSpotifyBioUnofficial(artistName)
      ]);
      const headerImage = (topTracks[0] && (topTracks[0].thumbnail || '')) || (wiki?.thumbnail || '');
      const about = spotBio || wiki || null;
      const followers = (ytSubs || 0) + (scFollows || 0) || null;
      const followersBreakdown = { youtube: ytSubs || null, soundcloud: scFollows || null };
      const overview = { artist: artistName, headerImage, topTracks, similarArtists, about, followers, followersBreakdown };
      this.writeArtistCache(artistName, overview);
      return overview;
    } catch (e) {
      console.error('Error getting artist overview:', e);
      return { artist: artistName, headerImage: '', topTracks: [], similarArtists: [], about: null, followers: null, followersBreakdown: {} };
    }
  }
}

module.exports = StreamingService;