const crypto = require('crypto')

const EXPECTED_DYNAMIC = new Set(['timestamp', 'publicIp', 'webrtcCandidates', 'battery', 'networkRtt'])

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

async function captureFingerprintSnapshot(page) {
  const value = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 120; canvas.height = 40
    const ctx = canvas.getContext('2d'); ctx.font = '14px Arial'; ctx.fillText('YNlogin persistence', 2, 20)
    const gl = document.createElement('canvas').getContext('webgl')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    return {
      userAgent: navigator.userAgent, platform: navigator.platform,
      language: navigator.language, languages: [...navigator.languages],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      hardwareConcurrency: navigator.hardwareConcurrency, deviceMemory: navigator.deviceMemory,
      screen: [screen.width, screen.height, screen.availWidth, screen.availHeight, devicePixelRatio],
      canvas: canvas.toDataURL(),
      webglVendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null,
      webglRenderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
      timestamp: Date.now(),
    }
  })
  return { ...value, hash: stableHash(Object.fromEntries(Object.entries(value).filter(([key]) => !EXPECTED_DYNAMIC.has(key)))) }
}

function compareFingerprintSnapshots(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const expectedStable = []
  const expectedDynamic = []
  const unexpectedChange = []
  for (const key of keys) {
    if (key === 'hash') continue
    const same = JSON.stringify(before[key]) === JSON.stringify(after[key])
    if (EXPECTED_DYNAMIC.has(key)) expectedDynamic.push({ field: key, changed: !same })
    else if (same) expectedStable.push(key)
    else unexpectedChange.push({ field: key, before: before[key], after: after[key] })
  }
  return { stable: unexpectedChange.length === 0, expectedStable, expectedDynamic, unexpectedChange }
}

module.exports = { captureFingerprintSnapshot, compareFingerprintSnapshots }
