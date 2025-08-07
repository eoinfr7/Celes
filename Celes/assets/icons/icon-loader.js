// Local icon loader to replace Lucide icons
class LocalIconLoader {
  constructor() {
    this.iconCache = new Map();
    this.basePath = '../assets/icons/';
  }

  async loadIcon(iconName) {
    if (this.iconCache.has(iconName)) {
      return this.iconCache.get(iconName);
    }

    try {
      const response = await fetch(`${this.basePath}${iconName}.svg`);
      if (!response.ok) {
        console.warn(`Icon ${iconName} not found, using placeholder`);
        return this.getPlaceholderIcon();
      }
      
      const svgContent = await response.text();
      this.iconCache.set(iconName, svgContent);
      return svgContent;
    } catch (error) {
      console.error(`Error loading icon ${iconName}:`, error);
      return this.getPlaceholderIcon();
    }
  }

  getPlaceholderIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`;
  }

  async createIcons() {
    const iconElements = document.querySelectorAll('[data-lucide]');
    
    for (const element of iconElements) {
      const iconName = element.getAttribute('data-lucide');
      if (iconName) {
        const svgContent = await this.loadIcon(iconName);
        element.innerHTML = svgContent;
        
        // Copy classes from the original element to the SVG
        const svg = element.querySelector('svg');
        if (svg && element.className) {
          svg.className.baseVal = element.className;
        }
      }
    }
  }

  // Method to set an icon programmatically (replaces setAttribute('data-lucide', iconName))
  async setIcon(element, iconName) {
    const svgContent = await this.loadIcon(iconName);
    element.innerHTML = svgContent;
    
    // Copy classes from the original element to the SVG
    const svg = element.querySelector('svg');
    if (svg && element.className) {
      svg.className.baseVal = element.className;
    }
  }
}

// Create global instance to replace lucide
window.localIcons = new LocalIconLoader();

// Provide compatibility with existing lucide.createIcons() calls
window.lucide = {
  createIcons: () => window.localIcons.createIcons()
};