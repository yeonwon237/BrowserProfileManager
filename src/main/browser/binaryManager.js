const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { chromium, firefox } = require('playwright')
const { getDb, saveDb } = require('../database')
const { addLog } = require('../database/logs')

const SOURCE = {
  BUNDLED: 'bundled',
  SYSTEM: 'system',
  CUSTOM: 'custom',
}

const STATUS = {
  AVAILABLE: 'available',
  MISSING: 'missing',
  UNSUPPORTED: 'unsupported',
  NEEDS_UPDATE: 'needs-update',
}

const SOURCE_LABEL = {
  [SOURCE.BUNDLED]: 'Bundled',
  [SOURCE.SYSTEM]: 'System',
  [SOURCE.CUSTOM]: 'Custom',
}

const STATUS_LABEL = {
  [STATUS.AVAILABLE]: 'Available',
  [STATUS.MISSING]: 'Missing',
  [STATUS.UNSUPPORTED]: 'Unsupported',
  [STATUS.NEEDS_UPDATE]: 'Needs Update',
}

// Cross-platform system browser definitions. Suffixes are resolved against
// environment-derived roots (LOCALAPPDATA/PROGRAMFILES on win32, /Applications
// on darwin) so no absolute OS path is hard-coded in this application.
const SYSTEM_DEFS = [
  {
    browser_type: 'chrome',
    channel: 'chrome',
    name: 'Google Chrome',
    suffixes: {
      win32: [path.join('Google', 'Chrome', 'Application', 'chrome.exe')],
      darwin: [path.join('Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome')],
      linux: [path.join('opt', 'google', 'chrome', 'chrome')],
    },
  },
  {
    browser_type: 'msedge',
    channel: 'msedge',
    name: 'Microsoft Edge',
    suffixes: {
      win32: [path.join('Microsoft', 'Edge', 'Application', 'msedge.exe')],
      darwin: [path.join('Microsoft Edge.app', 'Contents', 'MacOS', 'Microsoft Edge')],
      linux: [path.join('opt', 'microsoft', 'msedge', 'msedge')],
    },
  },
]

const BUNDLED_DEFS = [
  { browser_type: 'chromium', channel: null, name: 'Chromium', getPath: () => chromium.executablePath() },
  { browser_type: 'firefox', channel: null, name: 'Mozilla Firefox', getPath: () => firefox.executablePath() },
]

function getPlatformRoots() {
  if (process.platform === 'win32') {
    return [
      process.env.LOCALAPPDATA,
      process.env.PROGRAMFILES,
      process.env['PROGRAMFILES(X86)'],
      process.env.HOMEDRIVE ? path.join(process.env.HOMEDRIVE, 'Program Files') : null,
      process.env.HOMEDRIVE ? path.join(process.env.HOMEDRIVE, 'Program Files (x86)') : null,
    ].filter(Boolean)
  }
  if (process.platform === 'darwin') {
    return ['/Applications', process.env.HOME ? path.join(process.env.HOME, 'Applications') : null].filter(Boolean)
  }
  return ['/usr/bin', '/opt', '/usr/local/bin']
}

function resolveSystemPath(def) {
  const suffixes = def.suffixes[process.platform]
  if (!suffixes) return null
  const roots = getPlatformRoots()
  for (const root of roots) {
    for (const suffix of suffixes) {
      const candidate = path.join(root, suffix)
      if (fs.existsSync(candidate)) return candidate
    }
  }
  return null
}

function normalizeType(type) {
  const lower = String(type || 'chromium').toLowerCase()
  if (lower === 'edge') return 'msedge'
  return lower
}

function toArray(result) {
  if (!result || result.length === 0) return []
  const cols = result[0].columns
  return result[0].values.map((row) => {
    const obj = {}
    cols.forEach((col, i) => { obj[col] = row[i] })
    return obj
  })
}

function binariesFromDb(db) {
  return toArray(db.exec('SELECT * FROM browser_binaries ORDER BY source, name'))
}

function upsertBinary(db, record) {
  db.run(
    `INSERT INTO browser_binaries (id, browser_type, channel, name, version, executable_path, source, status, detected_at, last_checked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       browser_type = excluded.browser_type,
       channel = excluded.channel,
       name = excluded.name,
       version = excluded.version,
       executable_path = excluded.executable_path,
       source = excluded.source,
       status = excluded.status,
       detected_at = excluded.detected_at,
       last_checked_at = excluded.last_checked_at`,
    [
      record.id,
      record.browser_type,
      record.channel,
      record.name,
      record.version,
      record.executable_path,
      record.source,
      record.status,
      record.detected_at,
      record.last_checked_at,
    ]
  )
  return record
}

/**
 * Read the version of an executable by launching it headless through the
 * matching Playwright engine. Returns null when the binary cannot be launched.
 */
async function probeVersion(record) {
  const engine = record.browser_type === 'firefox' ? firefox : chromium
  let browser
  try {
    const launchOptions = { headless: true }
    if (record.executable_path) {
      launchOptions.executablePath = record.executable_path
    } else if (record.channel) {
      launchOptions.channel = record.channel
    }
    browser = await engine.launch(launchOptions)
    const version = browser.version()
    return version || null
  } catch {
    return null
  } finally {
    if (browser) {
      try { await browser.close() } catch { /* ignore */ }
    }
  }
}

function toStatus(exists, source, version, probed) {
  if (source === SOURCE.BUNDLED) {
    return exists ? STATUS.AVAILABLE : STATUS.NEEDS_UPDATE
  }
  if (!exists) return STATUS.MISSING
  if (probed) return version ? STATUS.AVAILABLE : STATUS.UNSUPPORTED
  return STATUS.AVAILABLE
}

function buildRecord(base, extra) {
  const now = new Date().toISOString()
  return {
    ...base,
    ...extra,
    detected_at: now,
    last_checked_at: now,
  }
}

/**
 * Detect bundled + system browsers and (re)store them in the database.
 */
async function scanBrowsers(options = {}) {
  const probeVersions = options.probeVersions !== false
  const db = await getDb()
  const results = []

  for (const def of BUNDLED_DEFS) {
    let executablePath = null
    try {
      executablePath = def.getPath() || null
    } catch {
      executablePath = null
    }
    const exists = Boolean(executablePath) && fs.existsSync(executablePath)
    let version = null
    if (exists && probeVersions) {
      version = await probeVersion({ browser_type: def.browser_type, executable_path: executablePath, source: SOURCE.BUNDLED })
    }
    const record = upsertBinary(db, buildRecord({
      id: `bundled-${def.browser_type}`,
      browser_type: def.browser_type,
      channel: def.channel,
      name: def.name,
      version,
      executable_path: executablePath,
      source: SOURCE.BUNDLED,
      status: toStatus(exists, SOURCE.BUNDLED, version),
    }))
    results.push(record)
  }

  for (const def of SYSTEM_DEFS) {
    const executablePath = resolveSystemPath(def)
    const exists = Boolean(executablePath)
    let version = null
    if (exists && probeVersions) {
      version = await probeVersion({ browser_type: def.browser_type, channel: def.channel, executable_path: executablePath, source: SOURCE.SYSTEM })
    }
    const record = upsertBinary(db, buildRecord({
      id: `system-${def.browser_type}`,
      browser_type: def.browser_type,
      channel: def.channel,
      name: def.name,
      version,
      executable_path: executablePath,
      source: SOURCE.SYSTEM,
      status: toStatus(exists, SOURCE.SYSTEM, version, probeVersions),
    }))
    results.push(record)
  }

  // Re-probe custom binaries registered by the user.
  const customRows = binariesFromDb(db).filter((b) => b.source === SOURCE.CUSTOM)
  for (const custom of customRows) {
    const refreshed = await checkBinary(custom.id)
    results.push(refreshed)
  }

  saveDb()
  return results
}

/**
 * Re-check a single stored binary: existence, version and status.
 */
async function checkBinary(id) {
  const db = await getDb()
  const rows = binariesFromDb(db).filter((b) => b.id === id)
  if (rows.length === 0) return null
  const existing = rows[0]
  const exists = Boolean(existing.executable_path) && fs.existsSync(existing.executable_path)
  let version = existing.version
  if (exists) {
    version = await probeVersion(existing)
  }
  const record = {
    ...existing,
    version,
    status: toStatus(exists, existing.source, version, true),
    last_checked_at: new Date().toISOString(),
  }
  const updated = upsertBinary(db, record)
  saveDb()
  return updated
}

/**
 * Register a custom browser executable provided by the user.
 */
async function addCustomBrowser(data = {}) {
  const executablePath = (data.executable_path || '').trim()
  if (!executablePath) throw new Error('Executable path is required')
  if (!fs.existsSync(executablePath)) throw new Error(`Executable not found at path: ${executablePath}`)
  const browserType = normalizeType(data.browser_type || 'chromium')
  const channel = data.channel || null

  const db = await getDb()
  const now = new Date().toISOString()
  const record = {
    id: `custom-${crypto.randomUUID()}`,
    browser_type: browserType,
    channel,
    name: (data.name || executablePath.split(path.sep).pop()).trim(),
    version: null,
    executable_path: executablePath,
    source: SOURCE.CUSTOM,
    status: STATUS.UNSUPPORTED,
    detected_at: now,
    last_checked_at: now,
  }
  upsertBinary(db, record)
  saveDb()
  const checked = await checkBinary(record.id)
  const finalRecord = {
    ...record,
    version: checked ? checked.version : null,
    status: checked ? checked.status : STATUS.UNSUPPORTED,
  }
  upsertBinary(db, finalRecord)
  saveDb()
  await addLog({ action: 'browser-binary', status: 'info', message: `Added custom browser "${finalRecord.name}" at ${executablePath}` }).catch(() => {})
  return finalRecord
}

/**
 * Remove a custom browser record. System/bundled records can never be removed;
 * only their configuration inside the app can be deleted, never the executable.
 */
async function removeCustomBrowser(id) {
  const db = await getDb()
  const rows = binariesFromDb(db).filter((b) => b.id === id)
  if (rows.length === 0) return { success: false, error: 'Browser binary not found' }
  if (rows[0].source !== SOURCE.CUSTOM) {
    return { success: false, error: 'Only custom browser records can be removed' }
  }
  db.run('DELETE FROM browser_binaries WHERE id = ?', [id])
  saveDb()
  await addLog({ action: 'browser-binary', status: 'info', message: `Removed custom browser "${rows[0].name}"` }).catch(() => {})
  return { success: true }
}

async function getAllBinaries() {
  const db = await getDb()
  return binariesFromDb(db).map((b) => ({ ...b, source_label: SOURCE_LABEL[b.source] || b.source, status_label: STATUS_LABEL[b.status] || b.status }))
}

async function getBinaryById(id) {
  const db = await getDb()
  const rows = binariesFromDb(db).filter((b) => b.id === id)
  return rows.length > 0 ? rows[0] : null
}

/**
 * Register a known browser type on demand (fast path, no version probe) so a
 * profile can always be resolved without a manual scan. Only BrowserBinaryManager
 * performs detection — nothing else searches for executables.
 */
async function ensureRegistered(type) {
  const db = await getDb()
  const now = new Date().toISOString()

  const bundledDef = BUNDLED_DEFS.find((d) => d.browser_type === type)
  if (bundledDef) {
    let executablePath = null
    try {
      executablePath = bundledDef.getPath() || null
    } catch {
      executablePath = null
    }
    const exists = Boolean(executablePath) && fs.existsSync(executablePath)
    return upsertBinary(db, {
      id: `bundled-${type}`,
      browser_type: type,
      channel: null,
      name: bundledDef.name,
      version: null,
      executable_path: executablePath,
      source: SOURCE.BUNDLED,
      status: exists ? STATUS.AVAILABLE : STATUS.NEEDS_UPDATE,
      detected_at: now,
      last_checked_at: now,
    })
  }

  const systemDef = SYSTEM_DEFS.find((d) => d.browser_type === type)
  if (systemDef) {
    const executablePath = resolveSystemPath(systemDef)
    const exists = Boolean(executablePath)
    return upsertBinary(db, {
      id: `system-${type}`,
      browser_type: type,
      channel: systemDef.channel,
      name: systemDef.name,
      version: null,
      executable_path: executablePath,
      source: SOURCE.SYSTEM,
      status: exists ? STATUS.AVAILABLE : STATUS.MISSING,
      detected_at: now,
      last_checked_at: now,
    })
  }

  return null
}

/**
 * Resolve the binary a profile should launch with. All browser resolution is
 * routed through this manager — no other module searches for executables.
 */
async function resolveForProfile(profile) {
  const db = await getDb()
  const type = normalizeType(profile.browser_type)
  const channel = profile.browser_channel || (type === 'chrome' ? 'chrome' : type === 'msedge' ? 'msedge' : null)
  let binaries = binariesFromDb(db)

  let binary = binaries.find((b) => b.browser_type === type && (b.channel || null) === channel)
  if (!binary) binary = binaries.find((b) => b.browser_type === type)
  if (!binary) {
    binary = await ensureRegistered(type)
    if (binary) {
      saveDb()
      binaries = binariesFromDb(db)
    }
  }
  if (!binary) return null

  // Fast registration only discovers the executable path. Probe its real
  // version before building the runtime identity; otherwise a first-run
  // profile falls back to a stale Chrome 131 User-Agent even when a much newer
  // browser binary is actually launched, which fingerprint checkers flag as a
  // network/JavaScript version contradiction.
  if (!binary.version && binary.executable_path) {
    binary = (await checkBinary(binary.id)) || binary
  }

  return {
    id: binary.id,
    name: binary.name,
    browser_type: type,
    channel: binary.channel,
    engine: type === 'firefox' ? 'firefox' : 'chromium',
    executable_path: binary.executable_path,
    version: binary.version,
    status: binary.status,
    source: binary.source,
  }
}

const UNAVAILABLE_STATUSES = new Set([STATUS.MISSING, STATUS.UNSUPPORTED, STATUS.NEEDS_UPDATE])

function isResolvable(resolved) {
  return Boolean(resolved) && !UNAVAILABLE_STATUSES.has(resolved.status)
}

/**
 * Mark profiles whose configured browser binary is no longer usable as
 * "warning" (profile is never deleted). Restores "idle" once the browser is
 * available again and the profile is not actively running or in error.
 */
async function refreshProfileBrowserStatuses() {
  const { getAllProfiles, setProfileStatus } = require('../database/profiles')
  const profiles = await getAllProfiles()
  const changes = []

  for (const profile of profiles) {
    const resolved = await resolveForProfile(profile)
    const usable = isResolvable(resolved)
    if (!usable && profile.status !== 'running') {
      const updated = await setProfileStatus(profile.id, 'warning')
      if (updated) changes.push({ id: profile.id, status: 'warning' })
    } else if (usable && profile.status === 'warning') {
      const updated = await setProfileStatus(profile.id, 'idle')
      if (updated) changes.push({ id: profile.id, status: 'idle' })
    }
  }
  return changes
}

async function resetTransientBrowserStatuses() {
  const { getAllProfiles, setProfileStatus } = require('../database/profiles')
  const profiles = await getAllProfiles()
  for (const profile of profiles) {
    if (profile.status === 'warning') {
      await setProfileStatus(profile.id, 'idle').catch(() => {})
    }
  }
  return { success: true }
}

module.exports = {
  SOURCE,
  STATUS,
  SOURCE_LABEL,
  STATUS_LABEL,
  SYSTEM_DEFS,
  BUNDLED_DEFS,
  scanBrowsers,
  checkBinary,
  getAllBinaries,
  getBinaryById,
  addCustomBrowser,
  removeCustomBrowser,
  resolveForProfile,
  isResolvable,
  refreshProfileBrowserStatuses,
  resetTransientBrowserStatuses,
}
