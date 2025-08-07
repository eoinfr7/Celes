# Build System Configuration

Celes uses electron-builder for creating distributable packages across Windows, macOS, and Linux platforms.

## Package.json Build Configuration

### Build Scripts
```json
{
  "scripts": {
    "start": "electron .",
    "dev": "electron . --development",
    "build": "npm run clean-build && electron-builder",
    "build:win": "npm run clean-build && npm install rimraf && electron-builder --win",
    "build:mac": "npm run clean-build && electron-builder --mac",
    "build:linux": "npm run clean-build && electron-builder --linux",
    "pack": "electron-builder --dir",
    "rebuild": "electron-rebuild",
    "clean-build": "npm run clean && npm install && npm run rebuild",
    "clean": "rimraf node_modules package-lock.json",
    "postinstall": "electron-rebuild"
  }
}
```

### Build Configuration
```json
{
  "build": {
    "appId": "app.celes.player",
    "productName": "Celes",
    "directories": {
      "output": "dist"
    },
    "files": [
      "**/*",
      "!node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}",
      "!node_modules/*/{test,__tests__,tests,powered-test,example,examples}",
      "!node_modules/*.d.ts",
      "!node_modules/.bin",
      "!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}",
      "!.editorconfig",
      "!**/._*",
      "!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}",
      "!**/{__pycache__,thumbs.db,.flowconfig,.idea,.vs,.nyc_output}",
      "!**/{appveyor.yml,.travis.yml,circle.yml}",
      "!**/{npm-debug.log,yarn.lock,.yarn-integrity,.yarn-metadata.json}"
    ]
  }
}
```

## Platform-Specific Configurations

### Windows Configuration
```json
{
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      }
    ],
    "icon": "assets/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "perMachine": false,
    "allowToChangeInstallationDirectory": true,
    "deleteAppDataOnUninstall": false
  }
}
```

**Windows Features:**
- NSIS installer for Windows
- User-level installation (not system-wide)
- Customizable installation directory
- Preserves user data on uninstall
- 64-bit architecture support

### macOS Configuration
```json
{
  "mac": {
    "target": "dmg",
    "icon": "assets/icon.icns"
  }
}
```

**macOS Features:**
- DMG disk image distribution
- Native macOS icon format (.icns)
- Code signing ready (requires developer certificate)
- App Store submission ready

### Linux Configuration
```json
{
  "linux": {
    "target": "AppImage",
    "icon": "assets/icon.png"
  }
}
```

**Linux Features:**
- AppImage format for universal compatibility
- No installation required (portable)
- Works across different Linux distributions
- PNG icon format

## Dependencies and Native Modules

### Production Dependencies
```json
{
  "dependencies": {
    "better-sqlite3": "^12.2.0",    // Native SQLite database
    "chokidar": "^4.0.3",           // File system watching
    "music-metadata": "^7.14.0"     // Audio metadata extraction
  }
}
```

### Development Dependencies
```json
{
  "devDependencies": {
    "electron": "^27.0.0",          // Electron framework
    "electron-builder": "^24.6.4",  // Build system
    "electron-rebuild": "^3.2.9",   // Native module rebuilding
    "rimraf": "^5.0.10"             // Cross-platform rm -rf
  }
}
```

## Native Module Handling

### electron-rebuild
Critical for Better-SQLite3 compatibility:

```bash
# Automatic rebuild after install
npm run postinstall  # Runs electron-rebuild

# Manual rebuild if needed
npm run rebuild
```

### Build Process Flow
1. **Clean**: Remove node_modules and package-lock.json
2. **Install**: Fresh npm install
3. **Rebuild**: Compile native modules for Electron
4. **Package**: Create platform-specific distributables

```bash
# Complete build process
npm run clean-build  # Clean + Install + Rebuild
electron-builder     # Package application
```

## Asset Management

### Application Icons
Required icon formats for each platform:

```
assets/
├── icon.ico     # Windows (256x256, 16/32/48/64/128/256 sizes)
├── icon.icns    # macOS (512x512 and 1024x1024)
└── icon.png     # Linux (512x512)
```

### File Inclusion Rules
The build configuration uses glob patterns to include/exclude files:

**Included Files:**
- All source files (`**/*`)
- Dependencies from node_modules
- Static assets (icons, CSS, HTML)

**Excluded Files:**
- Documentation files from dependencies
- Test files and directories
- TypeScript definitions
- Development tools and configs
- OS-specific temporary files

## Build Output Structure

### Distribution Directory (`dist/`)
```
dist/
├── win-unpacked/           # Windows unpacked (for testing)
├── linux-unpacked/         # Linux unpacked (for testing)
├── Celes Setup 1.0.5.exe    # Windows installer
├── Celes-1.0.5.dmg          # macOS disk image
├── Celes-1.0.5.AppImage     # Linux AppImage
├── latest.yml              # Windows update info
├── latest-mac.yml          # macOS update info
└── latest-linux.yml        # Linux update info
```

## Build Environment Requirements

### System Requirements
- **Node.js**: v16 or higher
- **Python**: Required for node-gyp (native modules)
- **Build tools**: Platform-specific compilers

### Windows Build Environment
```bash
# Install Windows build tools
npm install --global windows-build-tools
# or
npm install --global @microsoft/rush-stack-compiler-3.9
```

### macOS Build Environment
```bash
# Install Xcode command line tools
xcode-select --install
```

### Linux Build Environment
```bash
# Ubuntu/Debian
sudo apt-get install build-essential libnss3-dev libatk-bridge2.0-dev \
  libdrm2 libxss1 libgtk-3-dev libxrandr2 libasound2-dev

# CentOS/RHEL
sudo yum groupinstall "Development Tools"
sudo yum install nss-devel atk-devel gtk3-devel libXrandr-devel alsa-lib-devel
```

## Code Signing and Notarization

### Windows Code Signing
```json
{
  "win": {
    "certificateFile": "path/to/certificate.p12",
    "certificatePassword": "certificate_password",
    "publisherName": "Publisher Name"
  }
}
```

### macOS Code Signing and Notarization
```json
{
  "mac": {
    "identity": "Developer ID Application: Your Name (TEAM_ID)",
    "hardenedRuntime": true,
    "entitlements": "build/entitlements.mac.plist",
    "gatekeeperAssess": false
  },
  "afterSign": "build/notarize.js"
}
```

### Entitlements File (`build/entitlements.mac.plist`)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
</dict>
</plist>
```

## Troubleshooting Build Issues

### Common Build Problems

**Native Module Compilation Errors:**
```bash
# Clear everything and rebuild
npm run clean
npm install
npm run rebuild
```

**Better-SQLite3 Issues:**
```bash
# Rebuild specifically for Electron
npx electron-rebuild -m better-sqlite3
```

**Windows Build Errors:**
```bash
# Install Windows build tools
npm install --global windows-build-tools --vs2017
```

**Permission Errors on macOS:**
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
```

### Build Debugging
```bash
# Enable verbose logging
DEBUG=electron-builder npm run build

# Test unpacked build
npm run pack
```

## Continuous Integration

### GitHub Actions Example
```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    
    steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-node@v2
      with:
        node-version: '16'
    
    - name: Install dependencies
      run: npm ci
      
    - name: Build application
      run: npm run build
      env:
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

This build system configuration ensures reliable, cross-platform distribution of the Celes music player while handling the complexities of native module compilation and platform-specific packaging requirements.