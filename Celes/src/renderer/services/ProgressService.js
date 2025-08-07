class ProgressService {
  constructor() {
    this.bulkImportProgress = document.getElementById('bulk-import-progress');
    this.progressTitle = document.getElementById('progress-title');
    this.progressText = document.getElementById('progress-text');
    this.progressNumbers = document.getElementById('progress-numbers');
    this.importProgressBar = document.getElementById('import-progress-bar');
    this.progressClose = document.getElementById('progress-close');
    
    this.bindEvents();
  }

  bindEvents() {
    this.progressClose.addEventListener('click', () => {
      this.hideBulkImportProgress();
    });
  }

  showBulkImportProgress(data) {
    const title = data.isInitialScan ? 'Scanning folder...' : 'Importing music files...';
    this.progressTitle.textContent = title;
    this.progressText.textContent = 'Starting import...';
    this.progressNumbers.textContent = `0 / ${data.total}`;
    this.importProgressBar.style.width = '0%';
    this.bulkImportProgress.classList.add('show');
  }

  updateBulkImportProgress(data) {
    const progress = (data.processed / data.total) * 100;
    this.importProgressBar.style.width = `${progress}%`;
    this.progressNumbers.textContent = `${data.processed} / ${data.total}`;
    
    let statusText = [];
    if (data.added > 0) statusText.push(`${data.added} new`);
    if (data.duplicates > 0) statusText.push(`${data.duplicates} existing`);
    if (data.errors > 0) statusText.push(`${data.errors} error${data.errors !== 1 ? 's' : ''}`);
    
    this.progressText.textContent = statusText.length > 0 ? statusText.join(', ') : 'Processing...';
  }

  completeBulkImport(data) {
    this.importProgressBar.style.width = '100%';
    this.progressText.textContent = 'Import complete!';
    
    setTimeout(() => {
      this.hideBulkImportProgress();
    }, 2000);
  }

  hideBulkImportProgress() {
    this.bulkImportProgress.classList.remove('show');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressService;
} else {
  window.ProgressService = ProgressService;
}