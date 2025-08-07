class DragDropHandler {
  constructor(dropZone, musicPlayer) {
    this.dropZone = dropZone;
    this.musicPlayer = musicPlayer;
    
    this.bindEvents();
  }

  bindEvents() {
    document.addEventListener('dragover', (e) => this.handleDragOver(e));
    document.addEventListener('drop', (e) => this.handleDrop(e));
    document.addEventListener('dragenter', (e) => this.handleDragEnter(e));
    document.addEventListener('dragleave', (e) => this.handleDragLeave(e));
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  handleDragEnter(e) {
    e.preventDefault();
    this.dropZone.classList.add('active');
  }

  handleDragLeave(e) {
    if (!e.relatedTarget || !document.contains(e.relatedTarget)) {
      this.dropZone.classList.remove('active');
    }
  }

  async handleDrop(e) {
    e.preventDefault();
    this.dropZone.classList.remove('active');

    const files = Array.from(e.dataTransfer.files);
    const audioFiles = files.filter(file => {
      const ext = file.name.toLowerCase().split('.').pop();
      return ['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg'].includes(ext);
    });

    if (audioFiles.length === 0) {
      alert('Please drop audio files (MP3, FLAC, WAV, M4A, AAC, OGG)');
      return;
    }

    const filePaths = audioFiles.map(file => file.path);
    await this.musicPlayer.addSongs(filePaths);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DragDropHandler;
} else {
  window.DragDropHandler = DragDropHandler;
}