const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

class FolderWatcher {
  constructor(database, settingsManager, mainWindow) {
    this.database = database;
    this.settingsManager = settingsManager;
    this.mainWindow = mainWindow;
    this.watchers = new Map();
    this.watchedFolders = new Set();
    this.importQueue = [];
    this.isProcessingQueue = false;
    this.batchStats = { added: 0, duplicates: 0, errors: 0 };
    
    // Enhanced queue management
    this.queueProcessingTimer = null;
    this.debounceDelay = 3000; // 3 seconds to wait for more files
    this.maxQueueSize = 100; // Limit queue size to prevent memory issues
    this.processingBatchSize = 8; // Smaller batch size for smoother processing
    this.processingDelay = 250; // Delay between batches (250ms)
  }

  initialize() {
    this.loadWatchedFolders();
  }

  loadWatchedFolders() {
    try {
      const settings = this.settingsManager.loadSettings();
      
      if (settings.watchedFolders && Array.isArray(settings.watchedFolders)) {
        settings.watchedFolders.forEach(folderPath => {
          const normalizedPath = path.normalize(folderPath);
          if (fs.existsSync(normalizedPath)) {
            this.addWatchedFolder(normalizedPath, false);
          }
        });
      }
      
      console.log(`Restored ${settings.watchedFolders?.length || 0} watched folders`);
    } catch (error) {
      console.error('Error loading watched folders:', error);
    }
  }

  saveWatchedFolders() {
    const settings = this.settingsManager.loadSettings();
    settings.watchedFolders = Array.from(this.watchedFolders);
    settings.version = '1.0.0';
    this.settingsManager.saveSettings(settings);
  }

  addWatchedFolder(folderPath, saveSettings = true) {
    try {
      // Normalize the path to ensure consistent handling
      const normalizedPath = path.normalize(folderPath);
      
      if (this.watchedFolders.has(normalizedPath)) {
        return { success: false, error: 'Folder is already being watched' };
      }

      this.scanFolder(normalizedPath);

      const watcher = chokidar.watch(normalizedPath, {
        ignored: /^\./,
        persistent: true,
        depth: 99,
        ignoreInitial: true
      });

      watcher
        .on('add', (filePath) => this.handleFileAdded(filePath))
        .on('unlink', (filePath) => this.handleFileRemoved(filePath))
        .on('error', (error) => console.error('Watcher error:', error));

      this.watchers.set(normalizedPath, watcher);
      this.watchedFolders.add(normalizedPath);

      if (saveSettings) {
        this.saveWatchedFolders();
      }

      console.log(`Started watching folder: ${normalizedPath}`);
      return { success: true };
    } catch (error) {
      console.error('Error adding watched folder:', error);
      return { success: false, error: error.message };
    }
  }

  removeWatchedFolder(folderPath) {
    try {
      const normalizedPath = path.normalize(folderPath);
      const watcher = this.watchers.get(normalizedPath);
      if (watcher) {
        watcher.close();
        this.watchers.delete(normalizedPath);
      }
      this.watchedFolders.delete(normalizedPath);
      
      this.saveWatchedFolders();
      
      console.log(`Stopped watching folder: ${normalizedPath}`);
      return { success: true };
    } catch (error) {
      console.error('Error removing watched folder:', error);
      return { success: false, error: error.message };
    }
  }

  async scanFolder(folderPath) {
    try {
      // Normalize the path to handle any encoding issues
      const normalizedPath = path.normalize(folderPath);
      
      // Check if the directory exists
      if (!fs.existsSync(normalizedPath)) {
        return { success: false, error: `Directory does not exist: ${normalizedPath}` };
      }

      const audioExtensions = ['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg'];
      const filesToProcess = [];

      const scanDirectory = (dirPath) => {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isDirectory()) {
            scanDirectory(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (audioExtensions.includes(ext)) {
              filesToProcess.push(fullPath);
            }
          }
        }
      };

      scanDirectory(normalizedPath);
      
      return await this.processBulkImport(filesToProcess, true);
    } catch (error) {
      console.error('Error scanning folder:', error);
      return { success: false, error: error.message };
    }
  }

  async processBulkImport(filePaths, isInitialScan = false) {
    if (filePaths.length === 0) {
      return { success: true, added: 0, duplicates: 0, errors: 0 };
    }

    this.batchStats = { added: 0, duplicates: 0, errors: 0 };
    
    if (this.mainWindow) {
      this.mainWindow.webContents.send('bulk-import-start', { 
        total: filePaths.length,
        isInitialScan 
      });
    }

    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < filePaths.length; i += batchSize) {
      batches.push(filePaths.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      await this.processBatch(batch);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      if (this.mainWindow) {
        const processed = this.batchStats.added + this.batchStats.duplicates + this.batchStats.errors;
        this.mainWindow.webContents.send('bulk-import-progress', {
          processed,
          total: filePaths.length,
          ...this.batchStats
        });
      }
    }

    if (this.mainWindow) {
      this.mainWindow.webContents.send('bulk-import-complete', {
        ...this.batchStats,
        total: filePaths.length
      });
    }

    return { success: true, ...this.batchStats };
  }

  async processBulkImportEnhanced(filePaths) {
    if (filePaths.length === 0) {
      return { success: true, added: 0, duplicates: 0, errors: 0 };
    }

    const stats = { added: 0, duplicates: 0, errors: 0 };
    
    if (this.mainWindow) {
      this.mainWindow.webContents.send('bulk-import-start', { 
        total: filePaths.length,
        isInitialScan: false 
      });
    }

    // Use smaller batches for better performance during real-time imports
    const batches = [];
    for (let i = 0; i < filePaths.length; i += this.processingBatchSize) {
      batches.push(filePaths.slice(i, i + this.processingBatchSize));
    }

    console.log(`Processing ${batches.length} batches of ${this.processingBatchSize} files each`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} files)`);
      
      await this.processBatchEnhanced(batch, stats);
      
      // Longer delay between batches to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, this.processingDelay));
      
      if (this.mainWindow) {
        const processed = stats.added + stats.duplicates + stats.errors;
        this.mainWindow.webContents.send('bulk-import-progress', {
          processed,
          total: filePaths.length,
          currentBatch: i + 1,
          totalBatches: batches.length,
          ...stats
        });
      }
    }

    if (this.mainWindow) {
      this.mainWindow.webContents.send('bulk-import-complete', {
        ...stats,
        total: filePaths.length
      });
    }

    console.log(`Enhanced bulk import completed: ${stats.added} added, ${stats.duplicates} duplicates, ${stats.errors} errors`);
    return { success: true, ...stats };
  }

  async processBatchEnhanced(filePaths, stats) {
    for (const filePath of filePaths) {
      try {
        // Add a small delay between individual files to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const result = await this.database.addSong(filePath);
        
        if (result.success) {
          stats.added++;
          console.log(`✓ Added: ${path.basename(filePath)}`);
        } else if (result.duplicate) {
          stats.duplicates++;
          console.log(`- Duplicate: ${path.basename(filePath)}`);
        } else {
          stats.errors++;
          console.error(`✗ Error adding ${path.basename(filePath)}:`, result.error);
        }
      } catch (error) {
        console.error(`✗ Exception processing ${path.basename(filePath)}:`, error);
        stats.errors++;
      }
    }
  }

  async processBatch(filePaths) {
    for (const filePath of filePaths) {
      try {
        const result = await this.database.addSong(filePath);
        
        if (result.success) {
          this.batchStats.added++;
        } else if (result.duplicate) {
          this.batchStats.duplicates++;
        } else {
          this.batchStats.errors++;
        }
      } catch (error) {
        console.error(`Error processing ${filePath}:`, error);
        this.batchStats.errors++;
      }
    }
  }

  async handleFileAdded(filePath) {
    const audioExtensions = ['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg'];
    const ext = path.extname(filePath).toLowerCase();
    
    if (audioExtensions.includes(ext)) {
      console.log(`New audio file detected: ${filePath}`);
      
      // Check if file already exists in queue to prevent duplicates
      if (!this.importQueue.includes(filePath)) {
        // Manage queue size to prevent memory issues
        if (this.importQueue.length >= this.maxQueueSize) {
          console.warn(`Import queue is full (${this.maxQueueSize} files). Processing current queue before adding more.`);
          if (!this.isProcessingQueue) {
            this.processImportQueue();
          }
          return;
        }
        
        this.importQueue.push(filePath);
        console.log(`Added to queue: ${path.basename(filePath)} (${this.importQueue.length} files queued)`);
      }
      
      // Use debounced processing to handle bulk file additions
      this.scheduleQueueProcessing();
    }
  }

  scheduleQueueProcessing() {
    // Clear existing timer to debounce rapid file additions
    if (this.queueProcessingTimer) {
      clearTimeout(this.queueProcessingTimer);
    }
    
    // Schedule processing after debounce delay
    this.queueProcessingTimer = setTimeout(() => {
      if (!this.isProcessingQueue && this.importQueue.length > 0) {
        console.log(`Starting debounced processing of ${this.importQueue.length} queued files`);
        this.processImportQueue();
      }
    }, this.debounceDelay);
    
    console.log(`Processing scheduled for ${this.debounceDelay}ms from now (${this.importQueue.length} files queued)`);
  }

  async processImportQueue() {
    if (this.isProcessingQueue || this.importQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    console.log(`Starting import queue processing: ${this.importQueue.length} files`);
    
    // Clear the timer since we're processing now
    if (this.queueProcessingTimer) {
      clearTimeout(this.queueProcessingTimer);
      this.queueProcessingTimer = null;
    }
    
    const filesToProcess = [...this.importQueue];
    this.importQueue = [];
    
    try {
      if (filesToProcess.length === 1) {
        // Single file - process immediately with notification
        const filePath = filesToProcess[0];
        console.log(`Processing single file: ${path.basename(filePath)}`);
        
        const result = await this.database.addSong(filePath);
        
        if (result.success && this.mainWindow) {
          this.mainWindow.webContents.send('song-added', filePath);
          this.mainWindow.webContents.send('show-notification', {
            type: 'success',
            message: `New song added: ${path.basename(filePath)}`
          });
        } else if (!result.success && !result.duplicate) {
          console.error(`Failed to add ${filePath}:`, result.error);
        }
      } else {
        // Multiple files - use enhanced bulk processing
        console.log(`Processing ${filesToProcess.length} files in smaller batches`);
        const results = await this.processBulkImportEnhanced(filesToProcess);
        
        if (this.mainWindow && results.added > 0) {
          this.mainWindow.webContents.send('songs-batch-added', filesToProcess);
          this.mainWindow.webContents.send('show-notification', {
            type: 'success',
            message: `Added ${results.added} new songs${results.duplicates > 0 ? ` (${results.duplicates} duplicates skipped)` : ''}`
          });
        }
      }
    } catch (error) {
      console.error('Error processing import queue:', error);
      if (this.mainWindow) {
        this.mainWindow.webContents.send('show-notification', {
          type: 'error',
          message: 'Error importing some files. Check console for details.'
        });
      }
    } finally {
      this.isProcessingQueue = false;
      console.log('Import queue processing completed');
      
      // Check if more files were added while processing
      if (this.importQueue.length > 0) {
        console.log(`${this.importQueue.length} more files were added during processing. Scheduling next batch.`);
        this.scheduleQueueProcessing();
      }
    }
  }

  async handleFileRemoved(filePath) {
    console.log(`File removed: ${filePath}`);
  }

  getWatchedFolders() {
    return Array.from(this.watchedFolders);
  }

  // Cleanup method to be called when shutting down
  cleanup() {
    console.log('Cleaning up FolderWatcher...');
    
    // Clear any pending processing timer
    if (this.queueProcessingTimer) {
      clearTimeout(this.queueProcessingTimer);
      this.queueProcessingTimer = null;
    }
    
    // Close all file watchers
    for (const [folderPath, watcher] of this.watchers) {
      try {
        watcher.close();
        console.log(`Closed watcher for: ${folderPath}`);
      } catch (error) {
        console.error(`Error closing watcher for ${folderPath}:`, error);
      }
    }
    
    this.watchers.clear();
    this.watchedFolders.clear();
    this.importQueue = [];
    
    console.log('FolderWatcher cleanup completed');
  }

  // Get current queue status for debugging
  getQueueStatus() {
    return {
      queueLength: this.importQueue.length,
      isProcessing: this.isProcessingQueue,
      hasScheduledProcessing: !!this.queueProcessingTimer,
      debounceDelay: this.debounceDelay,
      maxQueueSize: this.maxQueueSize,
      processingBatchSize: this.processingBatchSize
    };
  }
}

module.exports = FolderWatcher;