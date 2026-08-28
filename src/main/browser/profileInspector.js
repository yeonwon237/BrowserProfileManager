const browserManager = require('./manager')

/**
 * Inspects a RUNNING profile's real exposed fingerprint & network identity.
 *
 * Opens a fresh page inside the profile's own browser context so that:
 *  - the public IP / country comes from the profile's actual proxy (ipinfo.io),
 *  - navigator / screen / locale / canvas / WebGL values reflect the profile's
 *    runtime identity and environment.
 *
 * This lets the user verify that profiles differ in IP, browser info, locale,
 * and environment instead of trusting labels.
 */
async function inspectProfileFingerprint(profileId) {
  const entry = browserManager.getEntry(profileId)
  if (!entry || !entry.context) {
    return { success: false, error: 'Profile is not running. Open the profile first, then inspect it.' }
  }

  const page = await entry.context.newPage()
  try {
    let ipInfo = null
    try {
      const resp = await page.goto('https://ipinfo.io/json', { timeout: 20000, waitUntil: 'domcontentloaded' })
      if (resp && resp.ok()) {
        ipInfo = await page.evaluate(() => {
          try {
            const parsed = JSON.parse(document.body.innerText.trim())
            return {
              ip: parsed.ip || null,
              city: parsed.city || null,
              region: parsed.region || null,
              country: parsed.country || null,
              org: parsed.org || null,
              timezone: parsed.timezone || null,
            }
          } catch {
            return null
          }
        })
      }
    } catch {
      ipInfo = { error: 'Không thể lấy IP (proxy chết hoặc không kết nối được ipinfo.io)' }
    }

    const fingerprint = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 240
      canvas.height = 60
      const ctx = canvas.getContext('2d')
      ctx.textBaseline = 'top'
      ctx.font = '16px Arial'
      ctx.fillStyle = '#123456'
      ctx.fillRect(0, 0, 60, 60)
      ctx.fillText('YNlogin fingerprint 0987654321', 2, 2)
      let dataUrl = ''
      try { dataUrl = canvas.toDataURL() } catch {}
      let hash = 0
      for (let i = 0; i < dataUrl.length; i++) hash = ((hash << 5) - hash + dataUrl.charCodeAt(i)) | 0

      const glCanvas = document.createElement('canvas')
      const gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl')
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info')

      return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        languages: Array.isArray(navigator.languages) ? [...navigator.languages] : [],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        screen: { width: screen.width, height: screen.height, colorDepth: screen.colorDepth },
        devicePixelRatio,
        cores: navigator.hardwareConcurrency,
        memory: navigator.deviceMemory,
        webdriver: navigator.webdriver,
        canvasHash: (hash >>> 0).toString(16),
        webglVendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null,
        webglRenderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
      }
    })

    return {
      success: true,
      profileId,
      profileName: entry.profileName || profileId,
      proxyId: entry.proxyId || null,
      ip: ipInfo,
      fingerprint,
    }
  } finally {
    try { await page.close() } catch {}
  }
}

module.exports = { inspectProfileFingerprint }