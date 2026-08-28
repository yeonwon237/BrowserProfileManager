const fs = require('fs')
const path = require('path')
const { setProfileStatus } = require('../database/profiles')
const { getProxyConfig } = require('../database/proxies')
const { encryptSecret, decryptSecret } = require('../security/crypto')
const browserAdapter = require('./adapter')
const windowLayout = require('./windowLayout')
const { ProfileLeaseService } = require('../sync/profileLeases')
const { getInstallationId } = require('../licensing')
const accountSafety = require('./accountSafety')
const binaryManager = require('./binaryManager')
const profileHealth = require('./profileHealth')

const runningProfiles = new Map()
const pendingLaunches = []
const launchingProfiles = new Set()
const windowSlots = new Map()
let statusListener = null
let leaseService = new ProfileLeaseService()
const leaseOwnerId = `installation:${getInstallationId()}`
const LEASE_TTL_MS = 60_000
const LEASE_RENEW_MS = 20_000

function configureLeaseService(service) {
  leaseService = service || new ProfileLeaseService()
}

function startLeaseRenewal(profileId, token) {
  const timer = setInterval(async () => {
    try {
      const result = await leaseService.renew(profileId, token, LEASE_TTL_MS)
      if (!result.renewed) {
        await addLog({ profile_id: profileId, action: 'profile:lease-lost', status: 'error', message: 'Profile lease was lost; closing the browser to prevent concurrent use' }).catch(() => {})
        await closeProfile(profileId)
      }
    } catch (error) {
      await addLog({ profile_id: profileId, action: 'profile:lease-renewal', status: 'warn', message: `Lease renewal failed: ${error.message}` }).catch(() => {})
    }
  }, LEASE_RENEW_MS)
  if (typeof timer.unref === 'function') timer.unref()
  return timer
}

async function releaseEntryLease(entry) {
  if (!entry?.leaseToken) return
  if (entry.leaseTimer) clearInterval(entry.leaseTimer)
  await leaseService.release(entry.profileId, entry.leaseToken).catch(() => {})
  entry.leaseToken = null
}

function getSessionStatePath(browserDataPath) {
  return path.join(path.dirname(browserDataPath), 'session-state.enc')
}

async function restoreCookieState(context, browserDataPath) {
  const statePath = getSessionStatePath(browserDataPath)
  if (!fs.existsSync(statePath)) return
  try {
    const decoded = decryptSecret(fs.readFileSync(statePath, 'utf8'))
    const state = JSON.parse(decoded || '{}')
    if (Array.isArray(state.cookies) && state.cookies.length > 0) {
      await context.addCookies(state.cookies)
    }
  } catch (err) {
    console.warn(`[session] Could not restore cookie state: ${err.message}`)
  }
}

async function persistCookieState(context, browserDataPath) {
  try {
    const state = await context.storageState()
    const encrypted = encryptSecret(JSON.stringify({ cookies: state.cookies || [] }))
    if (encrypted) fs.writeFileSync(getSessionStatePath(browserDataPath), encrypted, 'utf8')
  } catch (err) {
    console.warn(`[session] Could not persist cookie state: ${err.message}`)
  }
}

function setStatusListener(listener) {
  statusListener = listener
}

function notify(profileId, status) {
  if (typeof statusListener === 'function') {
    statusListener(profileId, status)
  }
}

function isRunning(profileId) {
  return runningProfiles.has(profileId)
}

function getRunningIds() {
  return [...runningProfiles.keys()]
}

function getRunningProfiles() {
  return [...runningProfiles.values()].map((entry) => ({
    id: entry.profileId,
    name: entry.profileName,
    browserName: entry.browserName,
    status: 'running',
  }))
}

function getEntry(profileId) {
  return runningProfiles.get(profileId) || null
}

function getMaxConcurrency() {
  return resourceManager.getSyncMaxBrowsers()
}

function setMaxConcurrency(limit) {
  return resourceManager.setSyncMaxBrowsers(limit)
}

function getPendingCount() {
  return pendingLaunches.length
}

function cancelPendingLaunch(profileId) {
  const idx = pendingLaunches.findIndex((p) => p.profile.id === profileId)
  if (idx === -1) return false
  pendingLaunches.splice(idx, 1)
  setProfileStatus(profileId, 'idle').catch(() => {})
  notify(profileId, 'idle')
  return true
}

async function processPendingLaunches() {
  while (pendingLaunches.length > 0) {
    if (getRunningIds().length + launchingProfiles.size >= (await resourceManager.getEffectiveBrowserLimit())) break
    const { profile, customOptions } = pendingLaunches.shift()
    openProfile(profile, customOptions).catch(() => {
      notify(profile.id, 'error')
      setProfileStatus(profile.id, 'idle').catch(() => {})
    })
  }
}

const { getProfileDownloadsPath, getProfileTempPath } = require('../../shared/paths')
const { addLog } = require('../database/logs')
const { getSetting } = require('../settings')
const leakProtection = require('./leakProtection')
const recovery = require('./recovery')
const resourceManager = require('./resourceManager')

async function openProfile(profile, customOptions = {}) {
  if (runningProfiles.has(profile.id) || launchingProfiles.has(profile.id)) {
    throw new Error(`Profile "${profile.name}" is already running`)
  }

  if (pendingLaunches.some((p) => p.profile.id === profile.id)) {
    return { success: false, queued: true, message: 'Already waiting for a browser slot' }
  }

  // Reserve the slot synchronously so concurrent processPendingLaunches calls
  // cannot launch more browsers than the resource limit allows.
  launchingProfiles.add(profile.id)
  try {
    if (!(await resourceManager.getBrowserSlotAvailable())) {
      pendingLaunches.push({ profile, customOptions })
      await setProfileStatus(profile.id, 'queued').catch(() => {})
      notify(profile.id, 'queued')
      return { success: false, queued: true, message: 'Waiting for slot' }
    }
    return await launchProfile(profile, customOptions)
  } finally {
    launchingProfiles.delete(profile.id)
  }
}

async function launchProfile(profile, customOptions = {}) {
  const userDataDir = profile.browser_data_path
  if (!userDataDir) {
    throw new Error(`Profile "${profile.name}" has no browser data path`)
  }

  // Before launch: if profile has a proxy, align timezone/locale to proxy geo to avoid scanbrowser/IPhey mismatch
  // Always attempt align when proxy present - custom timezone that doesn't match proxy IP is flagged as unreliable
  if (profile.proxy_id && !customOptions.skipEnvironmentAlign) {
    try {
      const aligned = await require('./environmentAlign').alignEnvironmentToProxy(profile.id)
      if (aligned && aligned.success && aligned.environment) {
        profile = { ...profile, environment: aligned.environment }
      }
    } catch {
      // non-blocking — launch continues with existing environment
    }
  }

  const safety = await accountSafety.evaluateProfileSafety(profile)
  if (safety.blocked) {
    const reasons = safety.risks.filter((item) => item.severity === 'critical').map((item) => item.message).join(' ')
    await addLog({ profile_id: profile.id, action: 'account-safety-block', status: 'error', message: reasons }).catch(() => {})
    throw new Error(`Kiểm tra an toàn đã chặn mở hồ sơ: ${reasons}`)
  }

  const downloadsPath = getProfileDownloadsPath(profile.id)
  const tempPath = getProfileTempPath(profile.id)

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true })
  }
  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true })
  }
  if (!fs.existsSync(tempPath)) {
    fs.mkdirSync(tempPath, { recursive: true })
  }

  // One pre-launch gate owns identity, browser compatibility, display and
  // fail-closed proxy configuration checks. It reports instead of silently
  // regenerating an existing identity.
  const resolvedBrowser = await binaryManager.resolveForProfile(profile)
  if (!resolvedBrowser || resolvedBrowser.status !== binaryManager.STATUS.AVAILABLE) {
    throw new Error(`Browser "${profile.browser_type}" is not available (${resolvedBrowser?.status || 'not registered'}). Please scan browsers in Settings and choose an available browser.`)
  }
  const configuredProxy = profile.proxy_id ? await getProxyConfig(profile.proxy_id) : null
  const health = profileHealth.validateProfile(profile, resolvedBrowser?.version || '', {
    proxyResolvable: !profile.proxy_id || Boolean(configuredProxy?.server),
  })
  if (!health.valid) {
    const codes = health.findings.filter((item) => item.severity === 'invalid').map((item) => item.code)
    await addLog({ profile_id: profile.id, action: 'profile-health-block', status: 'error', message: `Profile launch blocked: ${codes.join(', ')}` }).catch(() => {})
    throw new Error(`Profile Health is Invalid: ${codes.join(', ')}`)
  }

  const lease = await leaseService.acquire(profile.id, leaseOwnerId, { ttlMs: LEASE_TTL_MS, metadata: { profileName: profile.name } })
  if (!lease.acquired) {
    throw new Error(`Profile is locked by ${lease.ownerId || 'another device'} until ${lease.expiresAt || 'the lease expires'}`)
  }

  let contextResult
  let layoutSlot = null
  try {
    const launchOptions = {
      headless: customOptions.headless || false,
      viewport: customOptions.viewport !== undefined ? customOptions.viewport : null,
      args: ['--start-maximized'],
      ...customOptions,
    }
    // App-only layout metadata must never be forwarded to Playwright.
    delete launchOptions.workArea
    delete launchOptions.windowLayout

    if (!launchOptions.headless && customOptions.windowLayout !== false) {
      const layout = await windowLayout.getWindowLayout()
      if (layout.enabled) {
        const usedSlots = new Set(windowSlots.values())
        layoutSlot = 0
        while (usedSlots.has(layoutSlot)) layoutSlot += 1
        windowSlots.set(profile.id, layoutSlot)
        const openingCount = getRunningIds().length + launchingProfiles.size + pendingLaunches.length
        const bounds = windowLayout.calculateWindowBounds(layout, layoutSlot, customOptions.workArea, Math.max(openingCount, layoutSlot + 1))
        launchOptions.args = (launchOptions.args || []).filter((arg) => arg !== '--start-maximized')
        launchOptions.args.push(`--window-position=${bounds.x},${bounds.y}`)
        launchOptions.args.push(`--window-size=${bounds.width},${bounds.height}`)
      }
    }

    if (profile.proxy_id) {
      const proxyConfig = await getProxyConfig(profile.proxy_id)
      if (!proxyConfig || !proxyConfig.server) {
        throw new Error('Proxy configuration is missing or invalid. Launch blocked to prevent direct-IP fallback.')
      }
      launchOptions.proxy = proxyConfig
    }

    contextResult = await browserAdapter.launchContext(profile, launchOptions)
  } catch (err) {
    await leaseService.release(profile.id, lease.token).catch(() => {})
    windowSlots.delete(profile.id)
    const binaryMissing = /is not available|not registered|not registered|not installed/i.test(err.message)
    const status = binaryMissing ? 'warning' : 'error'
    await setProfileStatus(profile.id, status).catch(() => {})
    notify(profile.id, status)
    throw err
  }

  const { context, browserName, processId, debuggerPort, debuggerUrl } = contextResult
  await restoreCookieState(context, userDataDir)

  // Open the configured homepage as the first page so every profile
  // immediately shows its IP / browser fingerprint instead of a blank tab.
  // Default is IPhey — a one-stop anti-detect check site (Fingerprint, IP,
  // VPN, Bot, DNS Leak, IP Blacklist).
  try {
    const homepageEnabled = await getSetting('browser.homepageEnabled', 'true')
    if (homepageEnabled !== 'false') {
      const homepageUrl = await getSetting('browser.homepageUrl', 'https://iphey.com/')
      if (homepageUrl) {
        const target = context.pages()[0] || (await context.newPage())
        target.goto(homepageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
      }
    }
  } catch {
    // homepage navigation is non-blocking; the profile still opens
  }
  const browser = context.browser ? context.browser() : null
  const sessionId = await recovery.registerLaunch(profile.id, profile.browser_type, userDataDir, processId)
  const entry = {
    context,
    browser,
    browserName,
    browserDataPath: userDataDir,
    downloadsPath,
    tempPath,
    profileId: profile.id,
    profileName: profile.name,
    proxyId: profile.proxy_id || null,
    sessionId,
    processId,
    layoutSlot,
    debuggerPort: debuggerPort || null,
    debuggerUrl: debuggerUrl || null,
    leaseToken: lease.token,
    leaseTimer: null,
  }
  entry.leaseTimer = startLeaseRenewal(profile.id, lease.token)
  runningProfiles.set(profile.id, entry)

  await setProfileStatus(profile.id, 'running')
  notify(profile.id, 'running')
  addLog({ profile_id: profile.id, action: 'profile:open', status: 'info', message: `Profile "${profile.name}" opened` }).catch(() => {})

  // Post-launch background privacy & IP mismatch verification
  if (profile.proxy_id && !customOptions.skipPrivacyValidation) {
    Promise.resolve().then(async () => {
      try {
        const validation = await leakProtection.validateProfileNetworkPrivacy(profile, context)
        if (!validation.safe) {
          await addLog({
            profile_id: profile.id,
            action: 'privacy-guard',
            status: 'warn',
            message: `Network Privacy Warning: ${validation.error || 'Potential IP leak detected'}`,
          }).catch(() => {})
        } else if (validation.warnings && validation.warnings.length > 0) {
          await addLog({
            profile_id: profile.id,
            action: 'privacy-guard',
            status: 'warn',
            message: `IP notice: ${validation.warnings.join('; ')}`,
          }).catch(() => {})
        }
      } catch {
        // non-blocking
      }
    })
  }

  context.on('page', (page) => {
    page.on('close', () => {
      const current = runningProfiles.get(profile.id)
      if (current && current.context && current.context.pages().length === 0) {
        handleExited(profile.id)
      }
    })
  })

  if (browser) {
    browser.on('disconnected', () => {
      handleExited(profile.id)
    })
  }

  return {
    success: true,
    id: profile.id,
    connection: debuggerUrl ? { type: 'cdp', host: '127.0.0.1', port: debuggerPort, webSocketDebuggerUrl: debuggerUrl } : null,
  }
}


function handleExited(profileId, reason = 'crashed') {
  const entry = runningProfiles.get(profileId)
  if (!entry) return

  runningProfiles.delete(profileId)
  windowSlots.delete(profileId)
  releaseEntryLease(entry).catch(() => {})

  if (entry.sessionId) {
    recovery.onBrowserExited(entry.sessionId, reason).catch(() => {})
  }
  if (reason === 'crashed') {
    addLog({ profile_id: profileId, action: 'browser:crash', status: 'error', message: `Browser for "${entry.profileName}" crashed or closed unexpectedly` }).catch(() => {})
  }
  const status = 'idle'
  setProfileStatus(profileId, status).catch(() => {})
  notify(profileId, status)
  processPendingLaunches().catch(() => {})
}

async function closeProfile(profileId) {
  const entry = runningProfiles.get(profileId)
  if (!entry) {
    return { success: false, error: 'Profile is not running' }
  }

  if (entry.sessionId) {
    await recovery.completeRun(entry.sessionId).catch(() => {})
  }

  try {
    // Force Chromium to materialize pending cookie/storage changes before the
    // persistent context is closed. This avoids losing very recent login state.
    await persistCookieState(entry.context, entry.browserDataPath)
    await entry.context.close()
  } catch (err) {
    // context may already be gone; cleanup below still applies
  }

  runningProfiles.delete(profileId)
  windowSlots.delete(profileId)
  await releaseEntryLease(entry)
  addLog({ profile_id: profileId, action: 'profile:close', status: 'info', message: `Profile "${entry.profileName}" closed` }).catch(() => {})
  await setProfileStatus(profileId, 'idle')
  notify(profileId, 'idle')
  processPendingLaunches().catch(() => {})

  return { success: true }
}

async function closeAllProfiles() {
  const ids = getRunningIds()
  const promises = ids.map((id) =>
    Promise.race([
      closeProfile(id),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ])
  )
  await Promise.allSettled(promises)
}

module.exports = {
  setStatusListener,
  openProfile,
  closeProfile,
  closeAllProfiles,
  isRunning,
  getRunningIds,
  getRunningProfiles,
  getEntry,
  getMaxConcurrency,
  setMaxConcurrency,
  getPendingCount,
  cancelPendingLaunch,
  configureLeaseService,
}
