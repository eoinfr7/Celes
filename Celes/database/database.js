const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { parseFile } = require('music-metadata');

class MusicDatabase {
  constructor() {
    try {
      // Use userData directory instead of app directory for production
      const userDataPath = app.getPath('userData');
      console.log('Initializing database in userData path:', userDataPath);
      
      // Ensure the directory exists
      if (!fs.existsSync(userDataPath)) {
        console.log('Creating userData directory...');
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      
      const dbPath = path.join(userDataPath, 'music.db');
      console.log('Database path:', dbPath);
      
      // Initialize SQLite database
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          throw new Error(`Database initialization failed: ${err.message}`);
        }
        console.log('Database initialized successfully');
        this.init();
      });
      
    } catch (error) {
      console.error('Critical error initializing database:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      
      // Re-throw the error so the app can handle it gracefully
      throw new Error(`Database initialization failed: ${error.message}`);
    }
  }

  init() {
    // Create tables if they don't exist
    const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        artist TEXT,
        album TEXT,
        duration REAL,
        file_path TEXT UNIQUE,
        file_size INTEGER,
        album_art BLOB,
        album_art_format TEXT,
        date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
        play_count INTEGER DEFAULT 0,
        last_played DATETIME,
        is_liked INTEGER DEFAULT 0,
        liked_date DATETIME,
        type TEXT DEFAULT 'local',
        platform TEXT,
        stream_id TEXT,
        stream_url TEXT,
        thumbnail_url TEXT
      );

      CREATE TABLE IF NOT EXISTS playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        type TEXT DEFAULT 'user'
      );

      CREATE TABLE IF NOT EXISTS playlist_songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_id INTEGER,
        song_id INTEGER,
        position INTEGER,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
        FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE CASCADE,
        UNIQUE(playlist_id, song_id)
      );

      CREATE TABLE IF NOT EXISTS recently_played (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        song_id INTEGER,
        played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS followed_artists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artist_name TEXT NOT NULL UNIQUE,
        platform TEXT,
        followed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS streaming_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cache_key TEXT UNIQUE NOT NULL,
        cache_data TEXT,
        expires_at DATETIME
      );

      CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
      CREATE INDEX IF NOT EXISTS idx_songs_album ON songs(album);
      CREATE INDEX IF NOT EXISTS idx_songs_type ON songs(type);
      CREATE INDEX IF NOT EXISTS idx_songs_platform ON songs(platform);
      CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist ON playlist_songs(playlist_id);
      CREATE INDEX IF NOT EXISTS idx_recently_played_song ON recently_played(song_id);
      CREATE INDEX IF NOT EXISTS idx_recently_played_date ON recently_played(played_at);
      CREATE INDEX IF NOT EXISTS idx_followed_artists_name ON followed_artists(artist_name);
      CREATE INDEX IF NOT EXISTS idx_streaming_cache_key ON streaming_cache(cache_key);
    `;

    this.db.exec(createTablesSQL, (err) => {
      if (err) {
        console.error('Error creating tables:', err);
        return;
      }
      console.log('Database tables created/verified');
      this.migrateDatabase();
      this.createDefaultPlaylists();
    });
  }

  migrateDatabase() {
    try {
      // Check if the is_liked column exists
      this.db.all("PRAGMA table_info(songs)", (err, rows) => {
        if (err) {
          console.error('Error checking table info:', err);
          return;
        }
        
        const hasIsLiked = rows.some(column => column.name === 'is_liked');
        const hasLikedDate = rows.some(column => column.name === 'liked_date');
        const hasType = rows.some(column => column.name === 'type');
        const hasPlatform = rows.some(column => column.name === 'platform');
        const hasStreamId = rows.some(column => column.name === 'stream_id');
        const hasStreamUrl = rows.some(column => column.name === 'stream_url');
        const hasThumbnailUrl = rows.some(column => column.name === 'thumbnail_url');

        if (!hasIsLiked) {
          console.log('Adding is_liked column to songs table...');
          this.db.run('ALTER TABLE songs ADD COLUMN is_liked INTEGER DEFAULT 0');
        }

        if (!hasLikedDate) {
          console.log('Adding liked_date column to songs table...');
          this.db.run('ALTER TABLE songs ADD COLUMN liked_date DATETIME');
        }

        if (!hasType) {
          console.log('Adding type column to songs table...');
          this.db.run('ALTER TABLE songs ADD COLUMN type TEXT DEFAULT "local"');
        }

        if (!hasPlatform) {
          console.log('Adding platform column to songs table...');
          this.db.run('ALTER TABLE songs ADD COLUMN platform TEXT');
        }

        if (!hasStreamId) {
          console.log('Adding stream_id column to songs table...');
          this.db.run('ALTER TABLE songs ADD COLUMN stream_id TEXT');
        }

        if (!hasStreamUrl) {
          console.log('Adding stream_url column to songs table...');
          this.db.run('ALTER TABLE songs ADD COLUMN stream_url TEXT');
        }

        if (!hasThumbnailUrl) {
          console.log('Adding thumbnail_url column to songs table...');
          this.db.run('ALTER TABLE songs ADD COLUMN thumbnail_url TEXT');
        }

        console.log('Database migration completed successfully');
      });
    } catch (error) {
      console.error('Error during database migration:', error);
    }
  }

  createDefaultPlaylists() {
    const defaultPlaylists = [
      { name: 'All Songs', type: 'system' },
      { name: 'Release Radar', type: 'streaming' },
      { name: 'Followed Artists', type: 'streaming' },
      { name: 'Recently Played', type: 'system' },
      { name: 'Liked Songs', type: 'system' }
    ];

    defaultPlaylists.forEach(playlist => {
      this.db.get('SELECT id FROM playlists WHERE name = ?', [playlist.name], (err, row) => {
        if (err) {
          console.error('Error checking playlist:', err);
          return;
        }
        if (!row) {
          this.db.run('INSERT INTO playlists (name, type) VALUES (?, ?)', [playlist.name, playlist.type]);
        }
      });
    });
  }

  async addSong(filePath) {
    return new Promise((resolve, reject) => {
      try {
        // Check if song already exists
        this.db.get('SELECT id FROM songs WHERE file_path = ?', [filePath], async (err, row) => {
          if (err) {
            reject({ success: false, error: err.message });
            return;
          }
          
          if (row) {
            resolve({ success: false, duplicate: true });
            return;
          }

          // Extract metadata
          const metadata = await parseFile(filePath);
          const stats = fs.statSync(filePath);
          
          // Extract album art
          let albumArt = null;
          let albumArtFormat = null;
          
          if (metadata.common.picture && metadata.common.picture.length > 0) {
            const picture = metadata.common.picture[0];
            albumArt = picture.data;
            albumArtFormat = picture.format;
          }
          
          const songData = {
            title: metadata.common.title || path.basename(filePath, path.extname(filePath)),
            artist: metadata.common.artist || 'Unknown Artist',
            album: metadata.common.album || 'Unknown Album',
            duration: metadata.format.duration || 0,
            file_path: filePath,
            file_size: stats.size,
            album_art: albumArt,
            album_art_format: albumArtFormat,
            type: 'local'
          };

          // Insert song
          this.db.run(`
            INSERT INTO songs (title, artist, album, duration, file_path, file_size, album_art, album_art_format, type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [songData.title, songData.artist, songData.album, songData.duration, songData.file_path, songData.file_size, songData.album_art, songData.album_art_format, songData.type], function(err) {
            if (err) {
              reject({ success: false, error: err.message });
              return;
            }

            // Add to "All Songs" playlist
            this.db.get('SELECT id FROM playlists WHERE name = ?', ['All Songs'], (err, playlist) => {
              if (playlist) {
                this.db.run('INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)', 
                  [playlist.id, this.lastID, 1]);
              }
            });

            resolve({ success: true, songId: this.lastID });
          });
        });
      } catch (error) {
        reject({ success: false, error: error.message });
      }
    });
  }

  async addStreamingTrack(trackData) {
    return new Promise((resolve, reject) => {
      // Check if streaming track already exists
      this.db.get('SELECT id FROM songs WHERE stream_id = ? AND platform = ?', [trackData.stream_id, trackData.platform], (err, row) => {
        if (err) {
          reject({ success: false, error: err.message });
          return;
        }
        
        if (row) {
          resolve({ success: false, duplicate: true, songId: row.id });
          return;
        }

        this.db.run(`
          INSERT INTO songs (title, artist, album, duration, type, platform, stream_id, stream_url, thumbnail_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          trackData.title,
          trackData.artist,
          trackData.album || 'Streaming',
          trackData.duration,
          'stream',
          trackData.platform,
          trackData.stream_id,
          trackData.stream_url,
          trackData.thumbnail_url
        ], function(err) {
          if (err) {
            reject({ success: false, error: err.message });
          } else {
            resolve({ success: true, songId: this.lastID });
          }
        });
      });
    });
  }

  getAllSongs() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM songs 
        ORDER BY artist, album, title
      `, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  getLocalSongs() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM songs 
        WHERE type = 'local'
        ORDER BY artist, album, title
      `, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  getStreamingSongs() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM songs 
        WHERE type = 'stream'
        ORDER BY artist, album, title
      `, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  getSongsByPlatform(platform) {
    return this.db.prepare(`
      SELECT * FROM songs 
      WHERE platform = ?
      ORDER BY artist, album, title
    `).all(platform);
  }

  deleteSong(songId) {
    try {
      const result = this.db.prepare('DELETE FROM songs WHERE id = ?').run(songId);
      return { success: true, changes: result.changes };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getPlaylists() {
    const playlists = this.db.prepare('SELECT * FROM playlists ORDER BY name').all();
    
    return playlists.map(playlist => {
      if (!playlist || !playlist.id) {
        console.warn('Invalid playlist found:', playlist);
        return {
          ...playlist,
          songs: []
        };
      }
      return {
        ...playlist,
        songs: this.getPlaylistSongs(playlist.id)
      };
    });
  }

  getPlaylistSongs(playlistId) {
    return this.db.prepare(`
      SELECT s.*, ps.position 
      FROM songs s
      JOIN playlist_songs ps ON s.id = ps.song_id
      WHERE ps.playlist_id = ?
      ORDER BY ps.position
    `).all(playlistId);
  }

  createPlaylist(name, type = 'user') {
    try {
      const result = this.db.prepare('INSERT INTO playlists (name, type) VALUES (?, ?)').run(name, type);
      return { success: true, playlistId: result.lastInsertRowid };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  addSongToPlaylist(playlistId, songId) {
    try {
      const maxPosition = this.db.prepare('SELECT MAX(position) as max_pos FROM playlist_songs WHERE playlist_id = ?').get(playlistId);
      const newPosition = (maxPosition.max_pos || 0) + 1;
      
      this.db.prepare('INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)').run(
        playlistId, songId, newPosition
      );
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  updatePlayCount(songId) {
    this.db.prepare('UPDATE songs SET play_count = play_count + 1, last_played = CURRENT_TIMESTAMP WHERE id = ?').run(songId);
  }

  getAlbumArt(songId) {
    try {
      const result = this.db.prepare('SELECT album_art, album_art_format, thumbnail_url FROM songs WHERE id = ?').get(songId);
      if (result && result.album_art) {
        return {
          success: true,
          data: result.album_art,
          format: result.album_art_format
        };
      } else if (result && result.thumbnail_url) {
        return {
          success: true,
          thumbnailUrl: result.thumbnail_url
        };
      }
      return { success: false, error: 'No album art found' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  toggleLikeSong(songId) {
    try {
      const song = this.db.prepare('SELECT is_liked FROM songs WHERE id = ?').get(songId);
      if (!song) {
        return { success: false, error: 'Song not found' };
      }

      const newLikedState = song.is_liked ? 0 : 1;
      const likedDate = newLikedState ? new Date().toISOString() : null;

      this.db.prepare('UPDATE songs SET is_liked = ?, liked_date = ? WHERE id = ?')
        .run(newLikedState, likedDate, songId);

      return { 
        success: true, 
        isLiked: Boolean(newLikedState),
        likedDate: likedDate
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getLikedSongs() {
    try {
      const songs = this.db.prepare(`
        SELECT * FROM songs 
        WHERE is_liked = 1 
        ORDER BY liked_date DESC
      `).all();
      
      return songs;
    } catch (error) {
      console.error('Error getting liked songs:', error);
      return [];
    }
  }

  addToRecentlyPlayed(songId) {
    try {
      // Add to recently played
      this.db.prepare('INSERT INTO recently_played (song_id) VALUES (?)').run(songId);
      
      // Keep only the last 100 recently played songs
      this.db.prepare(`
        DELETE FROM recently_played 
        WHERE id NOT IN (
          SELECT id FROM recently_played 
          ORDER BY played_at DESC 
          LIMIT 100
        )
      `).run();
      
      return { success: true };
    } catch (error) {
      console.error('Error adding to recently played:', error);
      return { success: false, error: error.message };
    }
  }

  getRecentlyPlayed(limit = 50) {
    try {
      return this.db.prepare(`
        SELECT DISTINCT s.*, rp.played_at
        FROM songs s
        JOIN recently_played rp ON s.id = rp.song_id
        ORDER BY rp.played_at DESC
        LIMIT ?
      `).all(limit);
    } catch (error) {
      console.error('Error getting recently played:', error);
      return [];
    }
  }

  getRecentlyAdded(limit = 50) {
    try {
      return this.db.prepare(`
        SELECT * FROM songs 
        ORDER BY date_added DESC 
        LIMIT ?
      `).all(limit);
    } catch (error) {
      console.error('Error getting recently added:', error);
      return [];
    }
  }

  getMostPlayed(limit = 50) {
    try {
      return this.db.prepare(`
        SELECT * FROM songs 
        WHERE play_count > 0
        ORDER BY play_count DESC, last_played DESC
        LIMIT ?
      `).all(limit);
    } catch (error) {
      console.error('Error getting most played:', error);
      return [];
    }
  }

  deletePlaylist(playlistId) {
    try {
      // Don't allow deleting system playlists
      const playlist = this.db.prepare('SELECT name, type FROM playlists WHERE id = ?').get(playlistId);
      if (playlist && playlist.type === 'system') {
        return { success: false, error: 'Cannot delete system playlists' };
      }
      
      const result = this.db.prepare('DELETE FROM playlists WHERE id = ?').run(playlistId);
      return { success: true, changes: result.changes };
    } catch (error) {
      console.error('Error deleting playlist:', error);
      return { success: false, error: error.message };
    }
  }

  renamePlaylist(playlistId, newName) {
    try {
      // Don't allow renaming system playlists
      const playlist = this.db.prepare('SELECT name, type FROM playlists WHERE id = ?').get(playlistId);
      if (playlist && playlist.type === 'system') {
        return { success: false, error: 'Cannot rename system playlists' };
      }
      
      const result = this.db.prepare('UPDATE playlists SET name = ? WHERE id = ?').run(newName, playlistId);
      return { success: true, changes: result.changes };
    } catch (error) {
      console.error('Error renaming playlist:', error);
      return { success: false, error: error.message };
    }
  }

  // Artist following functionality
  followArtist(artistName, platform = null) {
    try {
      this.db.prepare('INSERT OR IGNORE INTO followed_artists (artist_name, platform) VALUES (?, ?)').run(artistName, platform);
      return { success: true, artistName };
    } catch (error) {
      console.error('Error following artist:', error);
      return { success: false, error: error.message };
    }
  }

  unfollowArtist(artistName) {
    try {
      const result = this.db.prepare('DELETE FROM followed_artists WHERE artist_name = ?').run(artistName);
      return { success: true, changes: result.changes };
    } catch (error) {
      console.error('Error unfollowing artist:', error);
      return { success: false, error: error.message };
    }
  }

  getFollowedArtists() {
    try {
      return this.db.prepare('SELECT * FROM followed_artists ORDER BY followed_at DESC').all();
    } catch (error) {
      console.error('Error getting followed artists:', error);
      return [];
    }
  }

  isArtistFollowed(artistName) {
    try {
      const result = this.db.prepare('SELECT id FROM followed_artists WHERE artist_name = ?').get(artistName);
      return !!result;
    } catch (error) {
      console.error('Error checking if artist is followed:', error);
      return false;
    }
  }

  // Streaming cache functionality
  setStreamingCache(key, data, expiresIn = 3600000) { // 1 hour default
    try {
      const expiresAt = new Date(Date.now() + expiresIn).toISOString();
      this.db.prepare(`
        INSERT OR REPLACE INTO streaming_cache (cache_key, cache_data, expires_at)
        VALUES (?, ?, ?)
      `).run(key, JSON.stringify(data), expiresAt);
      return { success: true };
    } catch (error) {
      console.error('Error setting streaming cache:', error);
      return { success: false, error: error.message };
    }
  }

  getStreamingCache(key) {
    try {
      const result = this.db.prepare(`
        SELECT cache_data, expires_at FROM streaming_cache 
        WHERE cache_key = ? AND expires_at > datetime('now')
      `).get(key);
      
      if (result) {
        return { success: true, data: JSON.parse(result.cache_data) };
      }
      return { success: false, error: 'Cache miss or expired' };
    } catch (error) {
      console.error('Error getting streaming cache:', error);
      return { success: false, error: error.message };
    }
  }

  clearStreamingCache() {
    try {
      this.db.prepare('DELETE FROM streaming_cache WHERE expires_at <= datetime("now")').run();
      return { success: true };
    } catch (error) {
      console.error('Error clearing streaming cache:', error);
      return { success: false, error: error.message };
    }
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = MusicDatabase;