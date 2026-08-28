const os = require('os')
const { getSetting, setSetting } = require('../settings')

const DEFAULTS = {
  maxBrowsers: 5,
  maxAutomations: 3,
  memoryWarningThresholdPercent: 85,
  lowResourceMode: false,
}

const LOW_RESOURCE_BROWSER_CAP = 2
const LOW_RESOURCE_AUTOMATION_CAP = 1

let maxBrowsersCache = DEFAULTS.maxBrowsers
let maxAutomationsCache = DEFAULTS.maxAutomations

let listener = null

function setListener(fn) {
  listener = fn
}

function emit(event) {
  if (typeof listener === 'function') {
    listener(event)
  }
}

function clampInt(value, fallback, min, max) {
  const n = Number(value)
  if (!Number.isInteger(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

async function getMaxBrowsers() {
  const raw = await getSetting('resource.maxBrowsers', String(maxBrowsersCache))
  maxBrowsersCache = clampInt(raw, maxBrowsersCache, 1, 50)
  return maxBrowsersCache
}

async function setMaxBrowsers(n) {
  const value = clampInt(n, maxBrowsersCache, 1, 50)
  maxBrowsersCache = value
  await setSetting('resource.maxBrowsers', String(value))
  return value
}

// Synchronous cached accessors keep legacy synchronous callers working while
// the async variants remain the single source of truth for persistence.
function getSyncMaxBrowsers() {
  return maxBrowsersCache
}

function setSyncMaxBrowsers(n) {
  const value = clampInt(n, maxBrowsersCache, 1, 50)
  maxBrowsersCache = value
  setSetting('resource.maxBrowsers', String(value)).catch(() => {})
  return value
}

async function getMaxAutomations() {
  const raw = await getSetting('resource.maxAutomations', String(maxAutomationsCache))
  maxAutomationsCache = clampInt(raw, maxAutomationsCache, 1, 50)
  return maxAutomationsCache
}

async function setMaxAutomations(n) {
  const value = clampInt(n, maxAutomationsCache, 1, 50)
  maxAutomationsCache = value
  await setSetting('resource.maxAutomations', String(value))
  return value
}

async function getMemoryThresholdPercent() {
  const raw = await getSetting('resource.memoryWarningThresholdPercent', String(DEFAULTS.memoryWarningThresholdPercent))
  return clampInt(raw, DEFAULTS.memoryWarningThresholdPercent, 10, 100)
}

async function setMemoryThresholdPercent(n) {
  const value = clampInt(n, DEFAULTS.memoryWarningThresholdPercent, 10, 100)
  await setSetting('resource.memoryWarningThresholdPercent', String(value))
  return value
}

async function getLowResourceMode() {
  const raw = await getSetting('resource.lowResourceMode', String(DEFAULTS.lowResourceMode))
  return raw === 'true' || raw === '1'
}

async function setLowResourceMode(enabled) {
  await setSetting('resource.lowResourceMode', String(Boolean(enabled)))
  return Boolean(enabled)
}

/**
 * Effective limits honour Low Resource Mode (reduced concurrency, no browser
 * preload, limited background work). Profile data is never modified.
 */
async function getEffectiveBrowserLimit() {
  const max = await getMaxBrowsers()
  if (await getLowResourceMode()) return Math.max(1, Math.min(max, LOW_RESOURCE_BROWSER_CAP))
  return max
}

async function getEffectiveAutomationLimit() {
  const max = await getMaxAutomations()
  if (await getLowResourceMode()) return Math.max(1, Math.min(max, LOW_RESOURCE_AUTOMATION_CAP))
  return max
}

function getActiveBrowserCount() {
  try {
    const browserManager = require('./manager')
    return browserManager.getRunningIds().length
  } catch {
    return 0
  }
}

function getPendingBrowserCount() {
  try {
    const browserManager = require('./manager')
    return browserManager.getPendingCount()
  } catch {
    return 0
  }
}

function getActiveAutomationCount() {
  try {
    const queue = require('../automation/queue')
    return queue.getRunningCount()
  } catch {
    return 0
  }
}

async function getBrowserSlotAvailable() {
  const limit = await getEffectiveBrowserLimit()
  return getActiveBrowserCount() < limit
}

async function getAutomationSlotAvailable() {
  const limit = await getEffectiveAutomationLimit()
  return getActiveAutomationCount() < limit
}

function getMemoryUsageMB() {
  return Math.round(process.memoryUsage().rss / 1024 / 1024)
}

function getTotalMemoryMB() {
  return Math.round(os.totalmem() / 1024 / 1024)
}

async function getMemoryPercent() {
  const total = os.totalmem()
  if (!total) return 0
  const free = os.freemem()
  return Math.round(((total - free) / total) * 100)
}

async function getMemoryStatus() {
  const percent = await getMemoryPercent()
  const threshold = await getMemoryThresholdPercent()
  return {
    rssMB: getMemoryUsageMB(),
    totalMB: getTotalMemoryMB(),
    percent,
    thresholdPercent: threshold,
    warning: percent >= threshold,
  }
}

function getCpuUsage() {
  const load = os.loadavg()
  const cores = os.cpus().length
  return {
    load1: Number(load[0].toFixed(2)),
    load5: Number(load[1].toFixed(2)),
    load15: Number(load[2].toFixed(2)),
    cores,
  }
}

async function getStatus() {
  const memory = await getMemoryStatus()
  const lowResource = await getLowResourceMode()
  return {
    activeBrowsers: getActiveBrowserCount(),
    pendingBrowsers: getPendingBrowserCount(),
    activeAutomations: getActiveAutomationCount(),
    maxBrowsers: await getMaxBrowsers(),
    maxAutomations: await getMaxAutomations(),
    effectiveBrowserLimit: await getEffectiveBrowserLimit(),
    effectiveAutomationLimit: await getEffectiveAutomationLimit(),
    memory: { ...memory, rssMB: getMemoryUsageMB() },
    cpu: getCpuUsage(),
    lowResourceMode: lowResource,
    memoryWarningThresholdPercent: await getMemoryThresholdPercent(),
  }
}

let warned = false

/**
 * Emit a one-shot warning when memory crosses the threshold. Re-arms once the
 * usage drops back below the threshold.
 */
async function maybeNotifyMemoryWarning() {
  const memory = await getMemoryStatus()
  if (memory.warning && !warned) {
    warned = true
    emit({ type: 'memory-warning', ...memory })
    return true
  }
  if (!memory.warning && warned) {
    warned = false
  }
  return false
}

function resetMemoryWarningState() {
  warned = false
}

let monitorTimer = null

function startMonitoring(intervalMs = 30000) {
  if (monitorTimer) return
  monitorTimer = setInterval(() => {
    maybeNotifyMemoryWarning().catch(() => {})
  }, intervalMs)
  if (monitorTimer.unref) monitorTimer.unref()
}

function stopMonitoring() {
  if (monitorTimer) {
    clearInterval(monitorTimer)
    monitorTimer = null
  }
}

module.exports = {
  DEFAULTS,
  setListener,
  getMaxBrowsers,
  setMaxBrowsers,
  getSyncMaxBrowsers,
  setSyncMaxBrowsers,
  getMaxAutomations,
  setMaxAutomations,
  getMemoryThresholdPercent,
  setMemoryThresholdPercent,
  getLowResourceMode,
  setLowResourceMode,
  getEffectiveBrowserLimit,
  getEffectiveAutomationLimit,
  getActiveBrowserCount,
  getPendingBrowserCount,
  getActiveAutomationCount,
  getBrowserSlotAvailable,
  getAutomationSlotAvailable,
  getMemoryUsageMB,
  getTotalMemoryMB,
  getMemoryPercent,
  getMemoryStatus,
  getCpuUsage,
  getStatus,
  maybeNotifyMemoryWarning,
  resetMemoryWarningState,
  startMonitoring,
  stopMonitoring,
}