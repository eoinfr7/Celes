class EqualizerManager {
  constructor() {
    this.audioContext = null;
    this.filters = [];
    this.gainNodes = [];
    this.sourceNode = null;
    this.currentAudioElement = null;
    this.isEnabled = false;
    this.presets = this.getPresets();
    
    // Frequency bands (Hz)
    this.frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
    
    this.initializeEqualizer();
    this.setupEventListeners();
    this.loadSettings();
  }

  getPresets() {
    return {
      flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      rock: [4, 3, -2, -3, -1, 2, 5, 6, 6, 6],
      pop: [-1, 2, 4, 4, 0, -1, -1, -1, -1, -1],
      jazz: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
      classical: [4, 3, 2, 1, -1, -2, -2, -1, 2, 3],
      electronic: [3, 2, 0, -1, -2, 1, 0, 1, 3, 4],
      'bass-boost': [6, 4, 2, 1, -1, -2, -2, -1, 1, 2]
    };
  }

  async initializeEqualizer() {
    try {
      // Create audio context if it doesn't exist
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // Create filter nodes for each frequency band
      this.filters = [];
      this.gainNodes = [];
      
      this.frequencies.forEach((freq, index) => {
        const filter = this.audioContext.createBiquadFilter();
        const gainNode = this.audioContext.createGain();
        
        if (index === 0) {
          // First band - highpass
          filter.type = 'highpass';
          filter.frequency.setValueAtTime(freq, this.audioContext.currentTime);
        } else if (index === this.frequencies.length - 1) {
          // Last band - lowpass
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(freq, this.audioContext.currentTime);
        } else {
          // Middle bands - peaking
          filter.type = 'peaking';
          filter.frequency.setValueAtTime(freq, this.audioContext.currentTime);
          filter.Q.setValueAtTime(1, this.audioContext.currentTime);
        }
        
        gainNode.gain.setValueAtTime(1, this.audioContext.currentTime);
        
        this.filters.push(filter);
        this.gainNodes.push(gainNode);
      });

      console.log('Equalizer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize equalizer:', error);
    }
  }

  connectToAudio(audioElement) {
    if (!this.audioContext || !audioElement) return;

    try {
      // Only create MediaElementSource if this is a new audio element
      if (this.currentAudioElement !== audioElement) {
        // Disconnect existing source if it exists
        if (this.sourceNode) {
          this.sourceNode.disconnect();
        }
        
        // Create new source from audio element
        this.sourceNode = this.audioContext.createMediaElementSource(audioElement);
        this.currentAudioElement = audioElement;
        
        // Connect source through filters and gain nodes
        this.connectAudioChain();
        
        console.log('Audio connected to equalizer');
      } else {
        // Same audio element, just ensure connections are intact
        if (this.sourceNode && !this.sourceNode.context) {
          // Source got disconnected somehow, reconnect the chain
          this.connectAudioChain();
        }
        console.log('Audio equalizer connection verified');
      }
    } catch (error) {
      console.error('Failed to connect audio to equalizer:', error);
      // Fallback: try to connect audio directly to destination
      if (this.sourceNode) {
        try {
          this.sourceNode.connect(this.audioContext.destination);
        } catch (fallbackError) {
          console.error('Fallback connection also failed:', fallbackError);
        }
      }
    }
  }

  connectAudioChain() {
    if (!this.sourceNode || !this.filters.length || !this.gainNodes.length) return;

    try {
      // Connect source through filters and gain nodes
      let currentNode = this.sourceNode;
      
      this.filters.forEach((filter, index) => {
        currentNode.connect(filter);
        filter.connect(this.gainNodes[index]);
        currentNode = this.gainNodes[index];
      });
      
      // Connect final output to destination
      currentNode.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Failed to connect audio chain:', error);
      // Try direct connection as fallback
      if (this.sourceNode) {
        this.sourceNode.connect(this.audioContext.destination);
      }
    }
  }

  setupEventListeners() {
    // EQ slider changes
    document.querySelectorAll('.eq-slider').forEach((slider, index) => {
      slider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        this.updateBand(index, value);
        this.updateValueDisplay(index, value);
        this.saveSettings();
      });
    });

    // Preset selector
    const presetSelector = document.getElementById('eq-preset');
    if (presetSelector) {
      presetSelector.addEventListener('change', (e) => {
        this.applyPreset(e.target.value);
        this.saveSettings();
      });
    }

    // Enable/disable button
    const enableBtn = document.getElementById('eq-enable');
    if (enableBtn) {
      enableBtn.addEventListener('click', () => {
        this.toggleEqualizer();
      });
    }

    // Reset button
    const resetBtn = document.getElementById('eq-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetEqualizer();
      });
    }
  }

  updateBand(bandIndex, gainValue) {
    if (!this.filters[bandIndex] || !this.isEnabled) return;

    try {
      if (this.filters[bandIndex].type === 'peaking') {
        this.filters[bandIndex].gain.setValueAtTime(
          gainValue, 
          this.audioContext.currentTime
        );
      } else {
        // For highpass/lowpass, adjust the gain node instead
        const linearGain = Math.pow(10, gainValue / 20); // Convert dB to linear
        this.gainNodes[bandIndex].gain.setValueAtTime(
          linearGain,
          this.audioContext.currentTime
        );
      }
    } catch (error) {
      console.error('Error updating EQ band:', error);
    }
  }

  updateValueDisplay(bandIndex, value) {
    const valueSpan = document.querySelector(`#eq-${this.frequencies[bandIndex]} + .eq-value`);
    if (valueSpan) {
      valueSpan.textContent = `${value > 0 ? '+' : ''}${value}dB`;
    }
  }

  applyPreset(presetName) {
    const preset = this.presets[presetName];
    if (!preset) return;

    const presetSelector = document.getElementById('eq-preset');
    if (presetSelector) {
      presetSelector.value = presetName;
    }

    preset.forEach((value, index) => {
      const slider = document.getElementById(`eq-${this.frequencies[index]}`);
      if (slider) {
        slider.value = value;
        this.updateBand(index, value);
        this.updateValueDisplay(index, value);
      }
    });
  }

  toggleEqualizer() {
    this.isEnabled = !this.isEnabled;
    const enableBtn = document.getElementById('eq-enable');
    
    if (enableBtn) {
      enableBtn.textContent = this.isEnabled ? 'Disable EQ' : 'Enable EQ';
      enableBtn.className = this.isEnabled ? 'btn btn-success' : 'btn btn-primary';
    }

    if (!this.isEnabled) {
      // Reset all bands to 0 when disabled
      this.filters.forEach((filter, index) => {
        if (filter.type === 'peaking') {
          filter.gain.setValueAtTime(0, this.audioContext.currentTime);
        } else {
          this.gainNodes[index].gain.setValueAtTime(1, this.audioContext.currentTime);
        }
      });
    } else {
      // Reapply current settings when enabled
      document.querySelectorAll('.eq-slider').forEach((slider, index) => {
        this.updateBand(index, parseFloat(slider.value));
      });
    }

    this.saveSettings();
  }

  resetEqualizer() {
    this.applyPreset('flat');
    const presetSelector = document.getElementById('eq-preset');
    if (presetSelector) {
      presetSelector.value = 'flat';
    }
    this.saveSettings();
  }

  saveSettings() {
    const settings = {
      enabled: this.isEnabled,
      preset: document.getElementById('eq-preset')?.value || 'flat',
      customValues: []
    };

    document.querySelectorAll('.eq-slider').forEach(slider => {
      settings.customValues.push(parseFloat(slider.value));
    });

    localStorage.setItem('equalizerSettings', JSON.stringify(settings));
  }

  loadSettings() {
    try {
      const savedSettings = localStorage.getItem('equalizerSettings');
      if (!savedSettings) return;

      const settings = JSON.parse(savedSettings);
      
      // Apply saved enabled state
      this.isEnabled = settings.enabled || false;
      const enableBtn = document.getElementById('eq-enable');
      if (enableBtn) {
        enableBtn.textContent = this.isEnabled ? 'Disable EQ' : 'Enable EQ';
        enableBtn.className = this.isEnabled ? 'btn btn-success' : 'btn btn-primary';
      }

      // Apply saved preset or custom values
      if (settings.preset && settings.preset !== 'custom') {
        this.applyPreset(settings.preset);
      } else if (settings.customValues && settings.customValues.length === this.frequencies.length) {
        settings.customValues.forEach((value, index) => {
          const slider = document.getElementById(`eq-${this.frequencies[index]}`);
          if (slider) {
            slider.value = value;
            this.updateBand(index, value);
            this.updateValueDisplay(index, value);
          }
        });
        
        const presetSelector = document.getElementById('eq-preset');
        if (presetSelector) {
          presetSelector.value = 'custom';
        }
      }
    } catch (error) {
      console.error('Error loading equalizer settings:', error);
    }
  }

  // Method to be called when audio changes
  onAudioChange(audioElement) {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    this.connectToAudio(audioElement);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EqualizerManager;
}