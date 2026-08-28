const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')
const { getAppDataPath } = require('../../shared/paths')
const { addLog } = require('../database/logs')

const RUNTIME_FILE = () => path.join(getAppDataPath(), 'runtime.json')
const MAX_RECORDS = 100
const SAFE_STARTUP_CRASH_THRESHOLD = 2

const STATUS = {
  RUNNING: 'running',
  CLOSED: 'closed',
  CRASHED: 'crashed',
  RECOVERED: 'recovered',
  ORPHANED: 'orphaned',
  LEFT_RUNNING: 'left-running',
}

function browserExecutableNames(browserType) {
  const type = String(browserType || '').toLowerCase()
  if (type === 'firefox') return process.platform === 'win32' ? ['firefox.exe'] : ['firefox']
  if (type === 'msedge' || type === 'edge') return process.platform === 'win32' ? ['msedge.exe'] : ['Microsoft Edge', 'msedge']
  return process.platform === 'win32' ? ['chrome.exe'] : ['Google Chrome', 'Chromium', 'chrome']
}

function loadRuntime() {
  try {
    const raw = fs.readFileSync(RUNTIME_FILE(), 'utf8')
    const parsed = JSON.parse(raw || '{}')
    if (!Array.isArray(parsed.records)) parsed.records = []
    if (typeof parsed.appCrashCount !== 'number') parsed.appCrashCount = 0
    return parsed
  } catch {
    return { records: [], appCrashCount: 0 }
  }
}

function saveRuntime(data) {
  fs.mkdirSync(path.dirname(RUNTIME_FILE()), { recursive: true })
  fs.writeFileSync(RUNTIME_FILE(), JSON.stringify(data, null, 2), 'utf8')
}

function pruneRecords(records) {
  return records.slice(-MAX_RECORDS)
}

/**
 * Best-effort process discovery. Returns an array of matching PIDs whose
 * command line references the given user data directory.
 */
function findBrowserProcesses(browserType, userDataDir) {
  const names = browserExecutableNames(browserType)
  const known = [...loadRuntime().records].reverse().find(
    (item) => item.userDataDir === userDataDir && item.processId &&
      [STATUS.RUNNING, STATUS.ORPHANED, STATUS.LEFT_RUNNING].includes(item.status)
  )
  if (known) {
    try {
      process.kill(Number(known.processId), 0)
      return [Number(known.processId)]
    } catch {
      // Stale runtime PID; continue with platform discovery.
    }
  }
  try {
    if (process.platform === 'win32') {
      const script =
        `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${userDataDir}*' } ` +
        `| Select-Object ProcessId,Name | ConvertTo-Json -Compress`
      const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        encoding: 'utf8',
        timeout: 15000,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      let parsed = null
      try { parsed = JSON.parse(out.trim()) } catch { parsed = null }
      const list = parsed ? (Array.isArray(parsed) ? parsed : [parsed]) : []
      return list
        .filter((p) => p && String(p.Name || '').toLowerCase() !== 'powershell.exe' && String(p.Name || '').toLowerCase() !== 'pwsh.exe')
        .filter((p) => names.some((n) => String(p.Name || '').toLowerCase() === n.toLowerCase()))
        .map((p) => Number(p.ProcessId))
        .filter((pid) => pid > 0)
    }
    if (process.platform === 'darwin') {
      const out = execFileSync('ps', ['ax', '-o', 'pid=,command='], { encoding: 'utf8', timeout: 15000 })
      const lines = out.split('\n')
      const pids = []
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const pid = Number(trimmed.split(/\s+/)[0])
        if (!pid) continue
        if (!trimmed.includes(userDataDir)) continue
        if (!names.some((n) => trimmed.includes(n))) continue
        pids.push(pid)
      }
      return pids
    }
    return []
  } catch {
    return []
  }
}

function recordIsAlive(record) {
  if (!record || !record.userDataDir) return false
  if (record.processId) {
    try {
      process.kill(Number(record.processId), 0)
      return true
    } catch {
      return false
    }
  }
  const pids = findBrowserProcesses(record.browser_type, record.userDataDir)
  return pids.length > 0
}

function killBrowserProcesses(browserType, userDataDir, pid) {
  let knownPid = Number(pid) || null
  if (!knownPid && userDataDir) {
    const record = [...loadRuntime().records].reverse().find(
      (item) => item.userDataDir === userDataDir && item.processId &&
        [STATUS.RUNNING, STATUS.ORPHANED, STATUS.LEFT_RUNNING].includes(item.status)
    )
    knownPid = record ? Number(record.processId) : null
  }
  const pids = knownPid ? [knownPid] : findBrowserProcesses(browserType, userDataDir)
  let killed = 0
  for (const target of pids) {
    try {
      if (process.platform === 'win32') {
        execFileSync('taskkill', ['/PID', String(target), '/T', '/F'], { stdio: 'ignore', timeout: 15000 })
      } else {
        execFileSync('kill', [String(target)], { stdio: 'ignore', timeout: 15000 })
      }
      killed++
    } catch {
      // taskkill/WMI can be restricted by policy. Terminate the recorded root
      // process directly; Chromium children exit when their IPC parent closes.
      try {
        process.kill(Number(target), 'SIGTERM')
        killed++
      } catch {
        // best effort
      }
    }
  }
  return killed
}

/**
 * Register a browser launch and persist a runtime record so a later app start
 * can reconcile crashes / orphans.
 */
async function registerLaunch(profileId, browserType, userDataDir, knownProcessId = null) {
  const data = loadRuntime()
  const sessionId = crypto.randomUUID()
  let processId = Number(knownProcessId) || null
  for (let i = 0; !processId && i < 3; i++) {
    const pids = findBrowserProcesses(browserType, userDataDir)
    if (pids.length > 0) {
      processId = pids[0]
      break
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  data.records.push({
    sessionId,
    profileId,
    browser_type: browserType,
    userDataDir,
    processId,
    startedAt: new Date().toISOString(),
    status: STATUS.RUNNING,
    endedAt: null,
    note: null,
  })
  data.records = pruneRecords(data.records)
  saveRuntime(data)
  return sessionId
}

async function completeRun(sessionId) {
  const data = loadRuntime()
  const record = data.records.find((r) => r.sessionId === sessionId)
  if (record && record.status === STATUS.RUNNING) {
    record.status = STATUS.CLOSED
    record.endedAt = new Date().toISOString()
    record.note = 'closed normally'
    saveRuntime(data)
  }
  return record || null
}

async function onBrowserExited(sessionId, reason = 'crashed') {
  const data = loadRuntime()
  const record = data.records.find((r) => r.sessionId === sessionId)
  if (!record) return null
  if (record.status === STATUS.RUNNING) {
    record.status = reason === 'closed' ? STATUS.CLOSED : STATUS.CRASHED
    record.endedAt = new Date().toISOString()
    record.note = reason === 'closed' ? 'closed normally' : `browser exited unexpectedly: ${reason}`
    saveRuntime(data)
    if (reason !== 'closed') {
      await addLog({
        profile_id: record.profileId,
        action: 'crash-recovery',
        status: 'warn',
        message: `Browser crashed for profile (session ${sessionId.slice(0, 8)}…)`,
      }).catch(() => {})
    }
  }
  return record
}

/**
 * Reconcile runtime records at app startup.
 *  - running record whose browser process is gone  -> RECOVERED, profile Ready
 *  - running record whose browser process is alive -> ORPHANED (user decides)
 */
async function scanAtStartup() {
  const data = loadRuntime()
  const recovered = []
  const orphans = []
  let hadRunningRecords = false

  const { getAllProfiles, setProfileStatus } = require('../database/profiles')
  const profiles = await getAllProfiles()
  const nameById = new Map(profiles.map((p) => [p.id, p.name]))

  for (const record of data.records) {
    if (record.status !== STATUS.RUNNING) continue
    hadRunningRecords = true
    const alive = recordIsAlive(record)
    if (!alive) {
      record.status = STATUS.RECOVERED
      record.endedAt = new Date().toISOString()
      record.note = 'recovered at startup (browser process no longer exists)'
      recovered.push(record)
      if (nameById.has(record.profileId)) {
        await setProfileStatus(record.profileId, 'idle').catch(() => {})
      }
      await addLog({
        profile_id: record.profileId,
        action: 'crash-recovery',
        status: 'info',
        message: `Recovered stale running status for profile "${nameById.get(record.profileId) || record.profileId}"`,
      }).catch(() => {})
    } else {
      record.status = STATUS.ORPHANED
      record.note = 'orphan browser detected at startup'
      orphans.push({
        sessionId: record.sessionId,
        profileId: record.profileId,
        profileName: nameById.get(record.profileId) || record.profileId,
        browserType: record.browser_type,
        startedAt: record.startedAt,
        processId: record.processId,
        userDataDir: record.userDataDir,
      })
    }
  }

  saveRuntime(data)
  return { recovered, orphans, hadRunningRecords }
}

function getActiveOrphans() {
  const data = loadRuntime()
  return data.records
    .filter((r) => r.status === STATUS.ORPHANED)
    .map((r) => ({
      sessionId: r.sessionId,
      profileId: r.profileId,
      browserType: r.browser_type,
      startedAt: r.startedAt,
      processId: r.processId,
      userDataDir: r.userDataDir,
    }))
}

function reconnectFeasibility() {
  return {
    feasible: false,
    reason:
      'Reconnecting to an orphaned browser is not supported by the current architecture. ' +
      'You can close the browser, or leave it running and continue using it outside YNlogin.',
  }
}

/**
 * User decision for an orphaned browser.
 * decision: 'close' | 'leave' | 'reconnect'
 */
async function decideOrphan(sessionId, decision) {
  const data = loadRuntime()
  const record = data.records.find((r) => r.sessionId === sessionId)
  if (!record || record.status !== STATUS.ORPHANED) {
    return { success: false, error: 'No orphaned browser found for this session' }
  }

  if (decision === 'close') {
    const killed = killBrowserProcesses(record.browser_type, record.userDataDir, record.processId)
    record.status = STATUS.CLOSED
    record.endedAt = new Date().toISOString()
    record.note = `orphan browser closed by user (${killed} process(es) terminated)`
    saveRuntime(data)
    const { setProfileStatus } = require('../database/profiles')
    await setProfileStatus(record.profileId, 'idle').catch(() => {})
    await addLog({
      profile_id: record.profileId,
      action: 'crash-recovery',
      status: 'info',
      message: `Orphan browser closed by user (${killed} process(es) terminated)`,
    }).catch(() => {})
    return { success: true, killed }
  }

  if (decision === 'leave') {
    record.status = STATUS.LEFT_RUNNING
    record.note = 'left running by user'
    saveRuntime(data)
    await addLog({
      profile_id: record.profileId,
      action: 'crash-recovery',
      status: 'info',
      message: 'Orphan browser left running by user',
    }).catch(() => {})
    return { success: true }
  }

  if (decision === 'reconnect') {
    return { success: false, ...reconnectFeasibility() }
  }

  return { success: false, error: 'Unknown decision' }
}

/**
 * Safe Startup Mode: enabled manually or automatically after repeated crashes.
 * In safe mode the app starts without auto-resuming automation/launches.
 */
async function noteStartupOutcome(hadRunningRecords) {
  const data = loadRuntime()
  if (hadRunningRecords) {
    data.appCrashCount = (data.appCrashCount || 0) + 1
  } else {
    data.appCrashCount = 0
  }
  saveRuntime(data)
  return data.appCrashCount
}

function getCrashCount() {
  return loadRuntime().appCrashCount || 0
}

async function isSafeStartupMode() {
  const { getSetting } = require('../settings')
  const manual = await getSetting('safeStartupMode', 'false')
  if (manual === 'true' || manual === '1') return true
  return getCrashCount() >= SAFE_STARTUP_CRASH_THRESHOLD
}

async function setSafeStartupMode(enabled) {
  const { setSetting } = require('../settings')
  await setSetting('safeStartupMode', String(Boolean(enabled)))
  return Boolean(enabled)
}

module.exports = {
  STATUS,
  RUNTIME_FILE,
  registerLaunch,
  completeRun,
  onBrowserExited,
  scanAtStartup,
  getActiveOrphans,
  decideOrphan,
  reconnectFeasibility,
  findBrowserProcesses,
  killBrowserProcesses,
  noteStartupOutcome,
  getCrashCount,
  isSafeStartupMode,
  setSafeStartupMode,
  SAFE_STARTUP_CRASH_THRESHOLD,
}
