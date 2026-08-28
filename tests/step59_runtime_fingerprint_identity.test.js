const assert = require('assert')
const crypto = require('crypto')
const { chromium } = require('playwright')
const { createIdentity, runtimeUserAgent, validateIdentity } = require('../src/main/browser/profileIdentity')
const { buildRuntimeIdentity, getIdentityInitScript } = require('../src/main/browser/runtimeIdentity')

async function snapshot(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 80; canvas.height = 30
    const ctx = canvas.getContext('2d'); ctx.fillText('YNlogin', 4, 18)
    const glCanvas = document.createElement('canvas')
    const gl = glCanvas.getContext('webgl')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    return {
      platform: navigator.platform, cores: navigator.hardwareConcurrency, memory: navigator.deviceMemory,
      language: navigator.language, languages: [...navigator.languages], userAgent: navigator.userAgent,
      screen: [screen.width, screen.height, screen.colorDepth, devicePixelRatio], canvas: canvas.toDataURL(), canvasAgain: canvas.toDataURL(),
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null,
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
      identityVersion: globalThis.__ynloginIdentityVersion,
    }
  })
}

async function run() {
  const environment = { platform: 'windows', locale: 'vi-VN', languages: ['vi-VN', 'vi'], timezone: 'Asia/Ho_Chi_Minh' }
  const a = createIdentity(crypto.randomUUID(), environment, 'chromium')
  const b = createIdentity(crypto.randomUUID(), environment, 'chromium')
  assert.strictEqual(validateIdentity(a).valid, true)
  assert.match(runtimeUserAgent(a, '151.2.3.4'), /Windows NT 10\.0.*Chrome\/151\.0\.7922\.34/)
  assert.notStrictEqual(a.profileKey, b.profileKey)
  assert.notStrictEqual(a.seeds.canvas, b.seeds.canvas)

  const browser = await chromium.launch({ headless: true })
  try {
    const runtime = buildRuntimeIdentity(a, '151.2.3.4')
    const context = await browser.newContext({ userAgent: runtime.userAgent })
    await context.addInitScript(getIdentityInitScript(runtime))
    const page = await context.newPage()
    await page.setContent('<!doctype html><title>Phòng kiểm thử</title>')
    const first = await snapshot(page)
    await page.reload()
    const second = await snapshot(page)
    assert.deepStrictEqual(first, second, 'runtime identity must remain stable across navigation')
    assert.strictEqual(first.platform, a.navigatorPlatform)
    assert.strictEqual(first.cores, a.hardwareConcurrency)
    assert.strictEqual(first.memory, a.deviceMemory)
    assert.strictEqual(first.vendor, a.gpu.vendor)
    assert.strictEqual(first.renderer, a.gpu.renderer)
    assert.strictEqual(first.identityVersion, a.version)
    assert.strictEqual(first.canvas, first.canvasAgain, 'repeated canvas reads must not accumulate noise')
    await context.close()
  } finally { await browser.close() }
  console.log('✓ Runtime identity remains coherent and stable across browser navigations')
}

run().catch((error) => { console.error(error); process.exit(1) })
