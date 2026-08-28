const path = require('path')
const os = require('os')

// When running inside Electron (dev or packaged), runtime data lives under the
// OS-appropriate userData directory resolved by app.getPath — never inside the
// source/project directory. In plain Node (tests) the same layout is derived
// from environment variables so behaviour stays identical.
let electronApp = null
try {
  const electron = require('electron')
  if (electron && electron.app && typeof electron.app.getPath === 'function') {
    electronApp = electron.app
  }
} catch {
  electronApp = null
}

function getAppDataPath() {
  if (electronApp) {
    try {
      return electronApp.getPath('userData')
    } catch {
      // fall through to env-based resolution
    }
  }

  const home = os.homedir()
  switch (process.platform) {
    case 'win32':
      return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'YNlogin')
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'YNlogin')
    case 'linux':
      return path.join(home, '.config', 'YNlogin')
    default:
      return path.join(home, '.ynlogin')
  }
}

function getProfilesPath() {
  return path.join(getAppDataPath(), 'profiles')
}

function getDatabasePath() {
  return path.join(getAppDataPath(), 'data.db')
}

function getProfileFolderPath(profileId) {
  return path.join(getProfilesPath(), profileId)
}

function getBrowserDataPath(profileId) {
  return path.join(getProfilesPath(), profileId, 'browser-data')
}

function getAutomationsPath() {
  return path.join(getAppDataPath(), 'automations')
}

function getDownloadsPath(profileId) {
  return path.join(getProfilesPath(), profileId || 'default', 'downloads')
}

function getProfileDownloadsPath(profileId) {
  return path.join(getProfilesPath(), profileId || 'default', 'downloads')
}

function getProfileTempPath(profileId) {
  return path.join(getProfilesPath(), profileId || 'default', 'temp')
}

function getRunsPath(runId) {
  return runId ? path.join(getAppDataPath(), 'runs', runId) : path.join(getAppDataPath(), 'runs')
}

function getBackupsPath() {
  return path.join(getAppDataPath(), 'backups')
}

function getLogsPath() {
  return path.join(getAppDataPath(), 'logs')
}

/**
 * The app data directory must never be inside the source/project directory.
 */
function isInsideProjectDir(testPath) {
  const resolved = path.resolve(testPath)
  const project = path.resolve(__dirname, '..', '..')
  const rel = path.relative(project, resolved)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

module.exports = {
  getAppDataPath,
  getProfilesPath,
  getDatabasePath,
  getProfileFolderPath,
  getBrowserDataPath,
  getAutomationsPath,
  getDownloadsPath,
  getProfileDownloadsPath,
  getProfileTempPath,
  getRunsPath,
  getBackupsPath,
  getLogsPath,
  isInsideProjectDir,
}