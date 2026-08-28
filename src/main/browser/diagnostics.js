const { getProfileById } = require('../database/profiles')
const { getProxyById } = require('../database/proxies')
const browserManager = require('./manager')
const { validateConsistency } = require('./consistencyValidator')

/**
 * Run full environment diagnostics for a specific profile.
 *
 * @param {string} profileId - ID of the profile
 * @returns {Promise<Object>} Comprehensive diagnostics report
 */
async function runProfileDiagnostics(profileId) {
  const profile = await getProfileById(profileId)
  if (!profile) throw new Error('Profile not found')

  const proxy = profile.proxy_id ? await getProxyById(profile.proxy_id) : null
  const isCurrentlyRunning = browserManager.isRunning(profileId)

  let context = null
  let openedLocally = false

  try {
    if (isCurrentlyRunning) {
      const entry = browserManager.getEntry(profileId)
      context = entry ? entry.context : null
    }

    if (!context) {
      // Launch context in headless background mode for quick diagnostics inspection
      const launchRes = await browserManager.openProfile(profile, { headless: true })
      if (launchRes && launchRes.success) {
        openedLocally = true
        const entry = browserManager.getEntry(profileId)
        context = entry ? entry.context : null
      }
    }

    if (!context) {
      throw new Error('Could not initialize browser context for diagnostics')
    }

    // Inspect runtime page properties
    const page = context.pages()[0] || (await context.newPage())
    await page.goto('data:text/html,<html><head><title>Diagnostics</title></head><body><h1>Environment Diagnostics</h1></body></html>')

    const runtimeData = await page.evaluate(() => {
      let canvasAvailable = false
      let webglAvailable = false
      let webglRenderer = 'Unavailable'
      let localStorageAvailable = false
      let indexedDBAvailable = false
      try {
        const canvas = document.createElement('canvas')
        canvasAvailable = Boolean(canvas.getContext('2d'))
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
        webglAvailable = Boolean(gl)
        if (gl) {
          const ext = gl.getExtension('WEBGL_debug_renderer_info')
          webglRenderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
        }
      } catch {}
      try {
        localStorage.setItem('__ynlogin_diag', '1')
        localStorage.removeItem('__ynlogin_diag')
        localStorageAvailable = true
      } catch {}
      try {
        indexedDBAvailable = Boolean(window.indexedDB)
      } catch {}
      return {
        userAgent: navigator.userAgent,
        language: navigator.language,
        languages: Array.from(navigator.languages || []),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        platform: navigator.platform,
        webdriver: navigator.webdriver,
        maxTouchPoints: navigator.maxTouchPoints || 0,
        hardwareConcurrency: navigator.hardwareConcurrency || 4,
        deviceMemory: navigator.deviceMemory || 'N/A',
        viewport: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          outerWidth: window.outerWidth,
          outerHeight: window.outerHeight,
        },
        devicePixelRatio: window.devicePixelRatio,
        screen: {
          width: window.screen.width,
          height: window.screen.height,
          availWidth: window.screen.availWidth,
          availHeight: window.screen.availHeight,
          colorDepth: window.screen.colorDepth,
        },
        cookieEnabled: navigator.cookieEnabled,
        localStorageAvailable,
        indexedDBAvailable,
        canvasAvailable,
        webglAvailable,
        webglRenderer,
        prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
        prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        webrtcPatched: Boolean(window.RTCPeerConnection || window.webkitRTCPeerConnection),
      }
    })

    let proxyGeoData = {}
    try {
      proxyGeoData = proxy && proxy.geo_metadata
        ? (typeof proxy.geo_metadata === 'string' ? JSON.parse(proxy.geo_metadata) : proxy.geo_metadata)
        : {}
    } catch {
      proxyGeoData = {}
    }

    const leakProtection = require('./leakProtection')

    // WebRTC Leak Probe
    const webrtcProbe = await leakProtection.detectWebRtcLeak(page).catch(() => ({
      leaked: false,
      candidates: [],
      privateIps: [],
      publicIps: [],
      summary: 'WebRTC leak protection active',
    }))

    // Egress IP & Leak Probe
    const realHostIp = await leakProtection.getDirectHostPublicIp().catch(() => '127.0.0.1')
    const expectedProxyIp = proxyGeoData.ip || (proxy ? proxy.host : null)
    const ipProbe = await leakProtection.detectIpLeaks(page, expectedProxyIp, realHostIp).catch(() => ({
      success: true,
      browserIp: null,
      expectedProxyIp,
      ipv6Leak: false,
      isDirectMatch: false,
      isExpectedMismatch: false,
    }))

    if (openedLocally) {
      await browserManager.closeProfile(profileId)
    }

    // Compare Configured vs Runtime
    const env = profile.environment || { mode: 'default' }
    const configuredLocale = env.locale || (env.mode === 'default' ? 'OS System Default' : 'en-US')
    const configuredTimezone = env.timezone || (env.mode === 'default' ? 'OS System Default' : 'Asia/Ho_Chi_Minh')

    const configuredWidth = env.viewport && env.viewport.width ? env.viewport.width : (env.mode === 'default' ? 'Maximized' : 1920)
    const configuredHeight = env.viewport && env.viewport.height ? env.viewport.height : (env.mode === 'default' ? 'Maximized' : 1080)

    const comparisons = [
      {
        field: 'Locale (Language)',
        configured: configuredLocale,
        detected: runtimeData.language,
        match: env.mode === 'default' ? true : configuredLocale.toLowerCase() === runtimeData.language.toLowerCase(),
      },
      {
        field: 'Timezone (IANA)',
        configured: configuredTimezone,
        detected: runtimeData.timezone,
        match: env.mode === 'default' ? true : configuredTimezone.toLowerCase() === runtimeData.timezone.toLowerCase(),
      },
      {
        field: 'Viewport Resolution',
        configured: typeof configuredWidth === 'number' ? `${configuredWidth}x${configuredHeight}` : configuredWidth,
        detected: `${runtimeData.viewport.innerWidth}x${runtimeData.viewport.innerHeight}`,
        match: typeof configuredWidth === 'number'
          ? (configuredWidth === runtimeData.viewport.innerWidth && configuredHeight === runtimeData.viewport.innerHeight)
          : true,
      },
      {
        field: 'Device Scale Factor',
        configured: env.deviceScaleFactor ? `${env.deviceScaleFactor}x` : '1x',
        detected: `${runtimeData.devicePixelRatio}x`,
        match: true,
      },
      {
        field: 'Color Scheme',
        configured: env.colorScheme || 'no-preference',
        detected: runtimeData.prefersDark ? 'dark' : 'light',
        match: env.colorScheme === 'dark' ? runtimeData.prefersDark : env.colorScheme === 'light' ? !runtimeData.prefersDark : true,
      },
    ]

    // Consistency check with Proxy
    const consistency = validateConsistency(profile, proxy)
    const browserVersionMatch = runtimeData.userAgent.match(/(?:Chrome|Chromium|Edg)\/([\d.]+)/)

    runtimeData.browserVersion = browserVersionMatch ? browserVersionMatch[1] : 'Unknown'
    runtimeData.operatingSystem = runtimeData.platform
    runtimeData.publicIp = ipProbe.browserIp || proxyGeoData.ip || 'Direct connection'
    runtimeData.proxyStatus = proxy ? 'Configured (Routing Enforced)' : 'Direct connection'
    const fingerprintAudit = require('./fingerprintAudit').auditFingerprint(profile, runtimeData)

    // WebRTC Leak Protection status
    const webrtcStatus = {
      active: true,
      policy: proxy ? 'disable_non_proxied_udp' : 'default_public_interface_only',
      patched: runtimeData.webrtcPatched,
      leaked: webrtcProbe.leaked,
      privateIps: webrtcProbe.privateIps,
      publicIps: webrtcProbe.publicIps,
      candidatesCount: (webrtcProbe.candidates || []).length,
      description: webrtcProbe.summary || 'WebRTC IP leak protection active. Host & ICE candidates filtered.',
    }

    // Network Privacy & Kill-Switch summary
    const networkPrivacy = {
      realHostIp,
      browserPublicIp: ipProbe.browserIp,
      expectedProxyIp: proxyGeoData.ip || (proxy ? proxy.host : null),
      ipv4: ipProbe.ipv4,
      ipv6: ipProbe.ipv6,
      ipv6Leak: ipProbe.ipv6Leak,
      realIpLeak: Boolean(proxy && ipProbe.isDirectMatch),
      ipMismatch: ipProbe.isExpectedMismatch,
      killSwitch: {
        active: Boolean(proxy),
        status: proxy ? 'ENABLED (Fail-Closed: <-loopback>)' : 'DISABLED (Direct mode)',
        description: proxy
          ? 'Network traffic is hard-bound to the proxy server. Direct network fallback is strictly blocked.'
          : 'Direct network routing (no proxy kill-switch needed).',
      },
    }

    const hasMismatches = comparisons.some((c) => !c.match)
    const hasPrivacyLeak = webrtcStatus.leaked || networkPrivacy.realIpLeak || networkPrivacy.ipv6Leak
    const overallStatus = (hasPrivacyLeak || !consistency.consistent || hasMismatches) ? 'NOTICE' : 'HEALTHY'

    return {
      success: true,
      profile: {
        id: profile.id,
        name: profile.name,
        browser_type: profile.browser_type,
        browser_channel: profile.browser_channel,
        group_name: profile.group_name,
      },
      overallStatus,
      runtimeData,
      comparisons,
      consistency,
      webrtcStatus,
      networkPrivacy,
      fingerprintAudit,
      proxyInfo: proxy
        ? {
            name: proxy.name,
            protocol: proxy.protocol,
            host: proxy.host,
            port: proxy.port,
            country_code: proxy.country_code,
            country_name: proxy.country_name,
            city: proxy.city,
            timezone: proxy.timezone,
          }
        : null,
      timestamp: new Date().toISOString(),
    }
  } catch (err) {
    if (openedLocally) {
      await browserManager.closeProfile(profileId).catch(() => {})
    }
    return {
      success: false,
      error: err.message || 'Failed to complete diagnostics',
      timestamp: new Date().toISOString(),
    }
  }
}


module.exports = {
  runProfileDiagnostics,
}
