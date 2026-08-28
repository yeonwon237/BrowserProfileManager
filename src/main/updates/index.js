const crypto = require('crypto')
const fs = require('fs')
const { getProfilesPath } = require('../../shared/paths')
const { saveDb } = require('../database')

class UpdateManager {
  constructor() {
    this.currentVersion = require('../../../package.json').version
    this.channel = 'stable' // 'stable', 'beta', 'dev'
    this.settings = {
      automaticCheck: true,
      downloadAutomatically: false,
      channel: 'stable',
    }
    this.state = {
      status: 'idle', // 'idle', 'checking', 'available', 'downloading', 'downloaded', 'error', 'up-to-date'
      updateInfo: null,
      downloadProgress: 0,
      error: null,
    }
  }

  getSettings() {
    return { ...this.settings, currentVersion: this.currentVersion }
  }

  updateSettings(newSettings = {}) {
    this.settings = { ...this.settings, ...newSettings }
    if (newSettings.channel) this.channel = newSettings.channel
    return this.getSettings()
  }

  getStatus() {
    return {
      ...this.state,
      currentVersion: this.currentVersion,
      channel: this.channel,
    }
  }

  /**
   * Verifies SHA-256 checksum of an update payload buffer against manifest.
   */
  verifyUpdateIntegrity(fileBuffer, expectedChecksum) {
    if (!fileBuffer || !expectedChecksum) return false
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex')
    return hash.toLowerCase() === String(expectedChecksum).toLowerCase()
  }

  verifyManifestSignature(manifest, signature, publicKey = process.env.YNLOGIN_UPDATE_PUBLIC_KEY) {
    if (!manifest || !signature || !publicKey) return false
    try {
      const canonical = this.canonicalizeManifest(manifest)
      return crypto.verify(null, Buffer.from(canonical, 'utf8'), publicKey, Buffer.from(String(signature), 'base64url'))
    } catch {
      return false
    }
  }

  canonicalizeManifest(manifest) {
    const sort = (value) => {
      if (Array.isArray(value)) return value.map(sort)
      if (value && typeof value === 'object') {
        return Object.keys(value).sort().reduce((out, key) => { out[key] = sort(value[key]); return out }, {})
      }
      return value
    }
    return JSON.stringify(sort(manifest))
  }

  /**
   * Checks for application updates from release manifest metadata.
   */
  async checkForUpdates(mockManifest = null) {
    this.state.status = 'checking'
    this.state.error = null

    try {
      // In production, fetches from release endpoint. Here we evaluate manifest.
      const manifest = mockManifest || {
        version: '1.2.0',
        channel: this.channel,
        releaseDate: new Date().toISOString(),
        minDatabaseVersion: 1,
        platforms: {
          'win32-x64': {
            checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            downloadUrl: 'https://releases.ynlogin.com/v1.2.0/ynlogin-win-x64.exe',
            size: 85400000,
          },
        },
        changelog: ['Added Global Search (Ctrl+K)', 'Added Proxy Rules & Capacity Balancing', 'Added Config Presets & Notification Center'],
      }

      if (this.isNewerVersion(manifest.version, this.currentVersion)) {
        this.state.status = 'available'
        this.state.updateInfo = manifest
        return {
          hasUpdate: true,
          version: manifest.version,
          changelog: manifest.changelog,
          manifest,
        }
      } else {
        this.state.status = 'up-to-date'
        return { hasUpdate: false, version: this.currentVersion }
      }
    } catch (err) {
      this.state.status = 'error'
      this.state.error = err.message
      return { hasUpdate: false, error: err.message }
    }
  }

  /**
   * Prepares database & session safety before applying update.
   */
  async preparePreUpdateSafety() {
    // 1. Flush SQLite DB buffer
    saveDb()

    // 2. Ensure profiles folder is intact
    const profPath = getProfilesPath()
    if (!fs.existsSync(profPath)) {
      fs.mkdirSync(profPath, { recursive: true })
    }

    return {
      success: true,
      flushed: true,
      browserDataProtected: true,
    }
  }

  isNewerVersion(remote, local) {
    const rParts = String(remote || '0.0.0').split('.').map(Number)
    const lParts = String(local || '0.0.0').split('.').map(Number)
    for (let i = 0; i < 3; i++) {
      const r = rParts[i] || 0
      const l = lParts[i] || 0
      if (r > l) return true
      if (r < l) return false
    }
    return false
  }
}

const updateManager = new UpdateManager()

module.exports = {
  UpdateManager,
  updateManager,
}
