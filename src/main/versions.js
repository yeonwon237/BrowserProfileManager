const pkg = require('../../package.json')

const APP_VERSION = pkg.version || '1.0.0'
const AUTOMATION_API_VERSION = 1

function parseVersion(v) {
  const m = String(v || '')
    .trim()
    .match(/^(\d+)\.(\d+)(?:\.(\d+))?/)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3] || 0)]
}

function compareVersions(a, b) {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa || !pb) return 0
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1
    if (pa[i] < pb[i]) return -1
  }
  return 0
}

/**
 * Check whether an automation manifest is compatible with this app build.
 * Returns { compatible, reason }.
 */
function checkManifestCompatibility(manifest = {}) {
  if (manifest.automation_api_version !== undefined) {
    const api = Number(manifest.automation_api_version)
    if (!Number.isInteger(api) || api !== AUTOMATION_API_VERSION) {
      return { compatible: false, reason: `Automation API version ${manifest.automation_api_version} is not supported (requires ${AUTOMATION_API_VERSION})` }
    }
  }
  if (manifest.minimum_app_version && compareVersions(APP_VERSION, manifest.minimum_app_version) < 0) {
    return { compatible: false, reason: `Requires app ${manifest.minimum_app_version}+ (installed ${APP_VERSION})` }
  }
  if (manifest.maximum_app_version && compareVersions(APP_VERSION, manifest.maximum_app_version) > 0) {
    return { compatible: false, reason: `Requires app ≤ ${manifest.maximum_app_version} (installed ${APP_VERSION})` }
  }
  return { compatible: true, reason: null }
}

function getVersions(dbSchemaVersion) {
  return {
    app: APP_VERSION,
    appName: pkg.productName || pkg.name,
    database: Number(dbSchemaVersion) || 1,
    automationApi: AUTOMATION_API_VERSION,
    electron: process.versions.electron || null,
    node: process.versions.node || null,
  }
}

module.exports = { APP_VERSION, AUTOMATION_API_VERSION, parseVersion, compareVersions, checkManifestCompatibility, getVersions }