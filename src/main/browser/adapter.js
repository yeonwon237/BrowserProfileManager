const { chromium, firefox } = require('playwright')
const path = require('path')
const { execFileSync } = require('child_process')
const net = require('net')
const http = require('http')
const leakProtection = require('./leakProtection')
const { validateEnvironment } = require('./environmentValidator')
const binaryManager = require('./binaryManager')
const stealthProtection = require('./stealthProtection')
const { ensureIdentity } = require('./profileIdentity')
const { buildRuntimeIdentity, getIdentityInitScript } = require('./runtimeIdentity')

const SUPPORTED_ENGINES = [
  {
    id: 'chromium',
    name: 'Chromium',
    description: 'Playwright bundled Chromium (Isolated & Reliable)',
    engine: 'chromium',
    channel: null,
  },
  {
    id: 'chrome',
    name: 'Google Chrome',
    description: 'System-installed Google Chrome browser',
    engine: 'chromium',
    channel: 'chrome',
  },
  {
    id: 'msedge',
    name: 'Microsoft Edge',
    description: 'System-installed Microsoft Edge browser',
    engine: 'chromium',
    channel: 'msedge',
  },
  {
    id: 'firefox',
    name: 'Mozilla Firefox',
    description: 'Playwright Gecko engine (Architecture ready)',
    engine: 'firefox',
    channel: null,
  },
]

function reserveLoopbackPort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer()
    socket.unref()
    socket.once('error', reject)
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port
      socket.close((err) => err ? reject(err) : resolve(port))
    })
  })
}

function readDebuggerVersion(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/json/version', timeout: 1000 }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { resolve(null) }
      })
    })
    req.on('timeout', () => { req.destroy(); resolve(null) })
    req.on('error', () => resolve(null))
  })
}

async function waitForDebugger(port) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const version = await readDebuggerVersion(port)
    if (version?.webSocketDebuggerUrl) return version.webSocketDebuggerUrl
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return null
}

function snapshotProcessIds(executablePath, engine) {
  try {
    if (process.platform === 'win32') {
      const image = executablePath ? path.basename(executablePath) : (engine === 'firefox' ? 'firefox.exe' : 'chrome.exe')
      const output = execFileSync('tasklist.exe', ['/FI', `IMAGENAME eq ${image}`, '/FO', 'CSV', '/NH'], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000,
      })
      return new Set(output.split(/\r?\n/).map((line) => {
        const match = line.match(/^"[^"]+","(\d+)"/)
        return match ? Number(match[1]) : 0
      }).filter(Boolean))
    }
  } catch {
    // Process PID tracking is best effort; recovery still has platform fallbacks.
  }
  return new Set()
}

/**
 * Detect which browser engines are usable on this machine.
 * All resolution is delegated to BrowserBinaryManager — the adapter never
 * searches for executables on its own.
 */
async function detectInstalledEngines(forceRefresh = false) {
  let binaries = await binaryManager.getAllBinaries()
  if (forceRefresh || binaries.length === 0) {
    binaries = await binaryManager.scanBrowsers()
  }
  return SUPPORTED_ENGINES.map((item) => {
    const binary = binaries.find(
      (b) => b.browser_type === item.id && (b.channel || null) === (item.channel || null)
    )
    if (!binary) {
      return { ...item, available: false, version: null, error: 'Not registered' }
    }
    const available = binary.status === binaryManager.STATUS.AVAILABLE
    return {
      ...item,
      available,
      version: binary.version || null,
      executable_path: binary.executable_path || null,
      status: binary.status,
      error: available ? null : `Browser binary is ${binary.status}`,
    }
  })
}

/**
 * Resolve engine type and channel for a profile. Used only for metadata;
 * actual launching always goes through the resolved binary.
 */
function resolveEngine(profile) {
  const rawType = (profile && profile.browser_type ? profile.browser_type : 'chromium').toLowerCase()
  const rawChannel = profile && profile.browser_channel ? profile.browser_channel : null

  if (rawType === 'chrome') {
    return { engine: 'chromium', channel: rawChannel || 'chrome', name: 'Google Chrome' }
  }
  if (rawType === 'msedge' || rawType === 'edge') {
    return { engine: 'chromium', channel: rawChannel || 'msedge', name: 'Microsoft Edge' }
  }
  if (rawType === 'firefox') {
    return { engine: 'firefox', channel: null, name: 'Mozilla Firefox' }
  }
  return { engine: 'chromium', channel: rawChannel || null, name: 'Chromium' }
}

const { getProfileDownloadsPath } = require('../../shared/paths')

/**
 * Launch a persistent browser context for a profile with full abstraction.
 * The browser binary (path/engine/channel) is resolved exclusively through
 * BrowserBinaryManager.
 */
async function launchContext(profile, customOptions = {}) {
  const resolved = await binaryManager.resolveForProfile(profile)
  if (!resolved) {
    throw new Error(
      `Browser "${profile.browser_type}" is not available (not registered). Please scan browsers in Settings and choose an available browser for this profile.`
    )
  }
  if (resolved.status !== binaryManager.STATUS.AVAILABLE) {
    throw new Error(
      `Browser "${resolved.name}" is not available (${resolved.status}). ` +
      `Please install it or choose another browser in Edit Profile.`
    )
  }

  const engine = resolved.engine === 'firefox' ? 'firefox' : 'chromium'
  const name = resolved.name
  const driver = engine === 'firefox' ? firefox : chromium

  const envConfig = profile && profile.environment ? profile.environment : { mode: 'default' }
  const { sanitized: env } = validateEnvironment(envConfig)
  const identityEnvironment = ensureIdentity(profile.id, envConfig, profile.browser_type)
  const runtimeIdentity = buildRuntimeIdentity(identityEnvironment.identity, resolved.version)

  const profileDownloads = profile && profile.id ? getProfileDownloadsPath(profile.id) : undefined

  const launchOptions = {
    headless: false,
    viewport: null,
    downloadsPath: profileDownloads,
    args: ['--start-maximized'],
    ...customOptions,
  }
  launchOptions.userAgent = runtimeIdentity.userAgent
  if (engine === 'chromium') {
    const major = runtimeIdentity.browserMajor
    const fullVersion = runtimeIdentity.browserFullVersion
    // Client-Hints headers MUST exactly match navigator.userAgentData in runtimeIdentity.js
    // Order: Not_A Brand, Chromium, Google Chrome (per spec and Browserforge)
    const brandVersion = `"${fullVersion}"`
    const brandMajor = `"${major}"`
    const notABrandVersion = '"99.0.0.0"'
    const notABrandMajor = '"99"'
    const platformVersion = runtimeIdentity.platformFamily === 'windows' ? '"10.0.0"' : runtimeIdentity.platformFamily === 'macos' ? '"15.0.0"' : '"6.5.0"'
    const uaFullVersion = fullVersion
    const arch = `"${runtimeIdentity.architecture || 'x86'}"`
    const bitness = `"${runtimeIdentity.bitness || '64'}"`
    const model = '""'
    const platform = `"${runtimeIdentity.uaPlatform}"`
    const wow64 = '?0'
    const mobile = '?0'
    
    // Build sec-ch-ua-full-version-list exactly as it appears in navigator.userAgentData
    const fullVersionList = `"Not_A Brand";v=${notABrandVersion}, "Chromium";v=${brandVersion}, "Google Chrome";v=${brandVersion}`
    const uaBrands = `"Not_A Brand";v=${notABrandMajor}, "Chromium";v=${brandMajor}, "Google Chrome";v=${brandMajor}`
    
    launchOptions.extraHTTPHeaders = {
      ...(launchOptions.extraHTTPHeaders || {}),
      'sec-ch-ua': uaBrands,
      'sec-ch-ua-mobile': mobile,
      'sec-ch-ua-platform': platform,
      'sec-ch-ua-full-version-list': fullVersionList,
      'sec-ch-ua-arch': arch,
      'sec-ch-ua-bitness': bitness,
      'sec-ch-ua-model': model,
      'sec-ch-ua-platform-version': platformVersion,
      'sec-ch-ua-wow64': wow64,
      'sec-ch-ua-form-factors': '""',
      'Accept-Language': (runtimeIdentity.languages || ['en-US']).join(','),
    }
    // Drop Playwright's --enable-automation and disable Blink's
    // AutomationControlled so navigator.webdriver stays false at the C++ layer.
    const ignoreArgs = new Set([
      ...(Array.isArray(launchOptions.ignoreDefaultArgs) ? launchOptions.ignoreDefaultArgs : []),
      '--enable-automation',
    ])
    launchOptions.ignoreDefaultArgs = [...ignoreArgs]
    const stealthArgs = ['--disable-blink-features=AutomationControlled']
    launchOptions.args = [...(launchOptions.args || []), ...stealthArgs.filter((a) => !(launchOptions.args || []).includes(a))]
  }
  const exposeDebugger = Boolean(launchOptions.exposeDebugger)
  delete launchOptions.exposeDebugger
  let debuggerPort = null
  if (exposeDebugger) {
    if (engine !== 'chromium') throw new Error('CDP debugger access is only supported for Chromium profiles')
    debuggerPort = await reserveLoopbackPort()
    launchOptions.args.push('--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${debuggerPort}`)
  }

  if (engine === 'chromium') {
    const extensions = await require('../extensions/manager').getForProfile(profile)
    if (extensions.length > 0) {
      const extensionPaths = extensions.map((item) => item.source_path).join(',')
      launchOptions.args.push(`--disable-extensions-except=${extensionPaths}`, `--load-extension=${extensionPaths}`)
      const ignoreArgs = new Set([
        ...(Array.isArray(launchOptions.ignoreDefaultArgs) ? launchOptions.ignoreDefaultArgs : []),
        '--disable-extensions',
      ])
      launchOptions.ignoreDefaultArgs = [...ignoreArgs]
    }
  }

  if (resolved.executable_path) {
    launchOptions.executablePath = resolved.executable_path
  } else if (resolved.channel) {
    launchOptions.channel = resolved.channel
  }

  // Apply environment configuration if mode is custom
  if (env.mode === 'custom') {
    if (env.locale) {
      launchOptions.locale = env.locale
    }
    if (env.timezone) {
      launchOptions.timezoneId = env.timezone
    }
    if (env.viewport && env.viewport.width && env.viewport.height) {
      launchOptions.viewport = env.viewport
      launchOptions.args = (launchOptions.args || []).filter((a) => a !== '--start-maximized')
    }
    if (env.deviceScaleFactor) {
      launchOptions.deviceScaleFactor = env.deviceScaleFactor
    }
    if (env.colorScheme) {
      launchOptions.colorScheme = env.colorScheme
    }
    if (env.reducedMotion) {
      launchOptions.reducedMotion = env.reducedMotion
    }
    if (env.geolocation) {
      launchOptions.geolocation = env.geolocation
    }
    if (env.permissions && Array.isArray(env.permissions)) {
      launchOptions.permissions = env.permissions
    }
    if (env.languages && Array.isArray(env.languages)) {
      launchOptions.extraHTTPHeaders = {
        ...(launchOptions.extraHTTPHeaders || {}),
        'Accept-Language': env.languages.join(','),
      }
    }
  }

  const proxyActive = Boolean(launchOptions.proxy && launchOptions.proxy.server)
  const leakArgs = leakProtection.getLaunchArgs({ proxyActive, disableIpv6: true, killSwitch: true })
  launchOptions.args = [...(launchOptions.args || []), ...leakArgs]
  const pidsBeforeLaunch = snapshotProcessIds(resolved.executable_path, engine)

  try {
    const context = await driver.launchPersistentContext(profile.browser_data_path, launchOptions)
    // Chromium-only APIs (window.chrome, PluginArray and UA-CH) must never be
    // injected into Firefox, where they would create a contradictory runtime.
    await stealthProtection.installForContext(context, engine, { engine, profile })
    await context.addInitScript(getIdentityInitScript(runtimeIdentity))
    const initScript = await leakProtection.getWebRtcInitScript()
    if (initScript && engine === 'chromium') {
      await context.addInitScript(initScript)
    }
    const browser = (typeof context.browser === 'function' && context.browser()) || context._browser || null
    const transport = browser && browser._connection && browser._connection._transport
    let processId = Number(
      (transport && transport._proc && transport._proc.pid) ||
      (transport && transport._process && transport._process.pid) ||
      0
    ) || null
    if (!processId && engine === 'chromium' && browser && typeof browser.newBrowserCDPSession === 'function') {
      try {
        const cdp = await browser.newBrowserCDPSession()
        const info = await cdp.send('SystemInfo.getProcessInfo')
        const browserProcess = Array.isArray(info.processInfo)
          ? info.processInfo.find((item) => item.type === 'browser')
          : null
        processId = browserProcess ? Number(browserProcess.id) || null : null
        await cdp.detach().catch(() => {})
      } catch {
        // Older Chromium builds may not expose SystemInfo; use process snapshots below.
      }
    }
    if (!processId) {
      const newPids = [...snapshotProcessIds(resolved.executable_path, engine)]
        .filter((pid) => !pidsBeforeLaunch.has(pid))
        .sort((a, b) => a - b)
      processId = newPids[0] || null
    }
    const debuggerUrl = debuggerPort ? await waitForDebugger(debuggerPort) : null
    if (exposeDebugger && !debuggerUrl) {
      await context.close().catch(() => {})
      throw new Error('Chromium started but its loopback debugger endpoint was unavailable')
    }
    return { context, engine, channel: resolved.channel, browserName: name, processId, debuggerPort, debuggerUrl }

  } catch (err) {
    const msg = err.message || ''
    if (
      msg.includes('Executable doesn\'t exist') ||
      msg.includes('channel') ||
      msg.includes('spawn') ||
      msg.includes('not found') ||
      msg.includes('Failed to launch')
    ) {
      throw new Error(
        `Browser "${name}" could not be launched (${resolved.executable_path || resolved.channel || 'bundled'}). ` +
        `Please install ${name} or edit profile "${profile.name}" to use another browser. (Details: ${msg})`
      )
    }
    throw err
  }
}

module.exports = {
  SUPPORTED_ENGINES,
  detectInstalledEngines,
  resolveEngine,
  launchContext,
}
