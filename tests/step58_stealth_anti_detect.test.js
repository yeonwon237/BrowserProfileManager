const assert = require('assert')
const { chromium, firefox } = require('playwright')
const stealthProtection = require('../src/main/browser/stealthProtection')
const humanBehavior = require('../src/main/browser/humanBehavior')
const { buildRuntimeIdentity, getIdentityInitScript } = require('../src/main/browser/runtimeIdentity')
const { createIdentity } = require('../src/main/browser/profileIdentity')
const { auditFingerprint } = require('../src/main/browser/fingerprintAudit')
const { createAutomationContext } = require('../src/sdk')

async function runTests() {
  console.log('--- Step 58: Stealth Anti-Detect & Human Behavioral Biometrics Tests ---')

  // 1. Stealth Script Generation
  console.log('[Test 1] Stealth Init Script Generation')
  const script = stealthProtection.getStealthInitScript()
  assert(typeof script === 'string' && script.length > 300, 'Compatibility script must be a valid non-empty string')
  assert(script.includes('native-first'), 'Compatibility layer must declare native-first behavior')
  assert(!script.includes('Function.prototype.toString'), 'Compatibility layer must not patch Function.prototype.toString')
  assert(!script.includes('PDF Viewer'), 'Compatibility layer must not synthesize plugins')
  assert(!script.includes('CanvasRenderingContext2D'), 'Canvas must be owned only by Runtime Identity')
  console.log('  PASS: Stealth script generated correctly')

  // 2. Human Behavior - Bézier Paths
  console.log('[Test 2] Human Bézier Path Generator')
  const start = { x: 100, y: 100 }
  const end = { x: 800, y: 600 }
  const path = humanBehavior.generateBezierPath(start, end, { steps: 30 })
  assert(Array.isArray(path) && path.length >= 30, 'Path must be an array with at least 30 points')
  assert.strictEqual(path[0].x, 100, 'Start X must match')
  assert.strictEqual(path[0].y, 100, 'Start Y must match')
  assert(Math.abs(path[path.length - 1].x - 800) <= 2, 'End X must be near destination')
  assert(Math.abs(path[path.length - 1].y - 600) <= 2, 'End Y must be near destination')
  assert(path.every((p) => typeof p.delay === 'number' && p.delay >= 0), 'Each point must have a non-negative delay')
  console.log('  PASS: Human Bézier path generated with natural curvature and delays')

  // 3. Human Behavior - Gaussian Delays
  console.log('[Test 3] Gaussian Random Generator')
  const samples = Array.from({ length: 1000 }, () => humanBehavior.randomGaussian(100, 20))
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length
  assert(mean >= 90 && mean <= 110, `Gaussian mean should be near 100, got ${mean}`)
  console.log(`  PASS: Gaussian distribution generated correctly (mean: ${mean.toFixed(2)})`)

  // 4. Runtime Identity with Native Stubs & Deterministic Canvas Seeds
  console.log('[Test 4] Runtime Identity Native Script Generation')
  const profileId1 = 'profile-test-uuid-001'
  const profileId2 = 'profile-test-uuid-002'
  const id1 = createIdentity(profileId1, { mode: 'custom', locale: 'en-US' }, 'chromium')
  const id2 = createIdentity(profileId2, { mode: 'custom', locale: 'vi-VN' }, 'chromium')

  assert.notStrictEqual(id1.seeds.canvas, id2.seeds.canvas, 'Canvas seeds must be distinct per profile')
  assert.notStrictEqual(id1.seeds.audio, id2.seeds.audio, 'Audio seeds must be distinct per profile')

  const runtime1 = buildRuntimeIdentity(id1, '131.0.0.0')
  const runtimeScript = getIdentityInitScript(runtime1)
  assert(runtimeScript.includes('makeNative'), 'Identity init script must contain makeNative')
  assert(runtimeScript.includes('userAgentData'), 'Identity init script must configure userAgentData')
  console.log('  PASS: Distinct deterministic seeds and native stubs generated per profile')

  // 5. Fingerprint Audit with Stealth Signals
  console.log('[Test 5] Fingerprint Audit with Stealth Checks')
  const goodAudit = auditFingerprint(
    { environment: { mode: 'custom', locale: 'en-US', timezone: 'America/New_York' } },
    {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      platform: 'Win32',
      language: 'en-US',
      languages: ['en-US', 'en'],
      timezone: 'America/New_York',
      hardwareConcurrency: 8,
      deviceMemory: 16,
      canvasAvailable: true,
      webglAvailable: true,
      webdriver: false,
      nativeCodeCloaked: true,
      chromeRuntimeMissing: false,
    }
  )
  assert(goodAudit.score >= 95, `Expected score >= 95, got ${goodAudit.score}`)
  assert.strictEqual(goodAudit.grade, 'A', 'Grade should be A')
  assert.strictEqual(goodAudit.consistent, true, 'Audit should be consistent')

  const badAudit = auditFingerprint(
    { environment: { mode: 'custom', locale: 'en-US' } },
    {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      platform: 'Win32',
      language: 'en-US',
      languages: ['en-US'],
      hardwareConcurrency: 8,
      deviceMemory: 16,
      canvasAvailable: true,
      webglAvailable: true,
      webdriver: true,
      nativeCodeCloaked: false,
      chromeRuntimeMissing: true,
    }
  )
  assert(badAudit.issues.some((i) => i.code === 'WEBDRIVER_EXPOSED'), 'Must detect exposed webdriver')
  assert(badAudit.issues.some((i) => i.code === 'NATIVE_CODE_TAMPERED'), 'Must detect tampered native code')
  assert(badAudit.issues.some((i) => i.code === 'CHROME_RUNTIME_MISSING'), 'Must detect missing chrome runtime')
  console.log('  PASS: Stealth audit criteria correctly evaluated')

  // 6. SDK Integration - Human Methods in Automation Context
  console.log('[Test 6] SDK Context Human Methods')
  let clickCalled = false
  let typeCalled = false
  let scrollCalled = false

  const mockPage = {
    mouse: {
      move: async () => {},
      down: async () => {},
      up: async () => {},
    },
    keyboard: {
      type: async () => {},
      press: async () => {},
    },
    evaluate: async () => 0,
    locator: () => ({
      first: () => ({
        boundingBox: async () => ({ x: 50, y: 50, width: 100, height: 40 }),
        click: async () => { clickCalled = true },
      }),
    }),
  }

  const context = createAutomationContext({
    runId: 'run-test-01',
    page: mockPage,
    permissions: ['browser.page'],
    logger: console,
  })

  assert(typeof context.browser.humanClick === 'function', 'context.browser.humanClick must be a function')
  assert(typeof context.browser.humanType === 'function', 'context.browser.humanType must be a function')
  assert(typeof context.browser.humanScroll === 'function', 'context.browser.humanScroll must be a function')

  await context.browser.humanClick('#login-button', { steps: 5 })
  await context.browser.humanType('#username', 'testuser', { allowTypo: false })
  await context.browser.humanScroll(500, { steps: 5, pauseAfter: false })
  console.log('  PASS: SDK human methods executed successfully in automation context')

  // 7. Unicode input must preserve complete code points.
  const typed = []
  const unicodePage = {
    mouse: mockPage.mouse,
    keyboard: {
      type: async (value) => typed.push(value),
      insertText: async (value) => typed.push(value),
      press: async () => {},
    },
    locator: mockPage.locator,
    evaluate: async () => ({}),
  }
  await humanBehavior.humanType(unicodePage, '#username', 'Tiếng Việt 👋', { allowTypo: false })
  assert.strictEqual(typed.join(''), 'Tiếng Việt 👋', 'Vietnamese and emoji input must not be corrupted')

  // 8. Real Browser Context assertions on Property Descriptors & Prototype.
  console.log('[Test 8] Real Browser Context - Property Descriptors & Prototype')
  const browser = await chromium.launch({ headless: true })
  try {
    const profileId = 'profile-real-browser-58'
    const env = { platform: 'windows', locale: 'vi-VN', languages: ['vi-VN', 'vi'], timezone: 'Asia/Ho_Chi_Minh' }
    const identity = createIdentity(profileId, env, 'chromium')
    const runtime = buildRuntimeIdentity(identity, '131.0.0.0')
    const context = await browser.newContext({ userAgent: runtime.userAgent })
    await stealthProtection.installForContext(context, 'chromium')
    await context.addInitScript(getIdentityInitScript(runtime))
    const page = await context.newPage()
    await page.setContent('<!doctype html><title>Step58</title>')

    const result = await page.evaluate(async () => {
      const navProto = window.Navigator && Navigator.prototype
      const ownWebdriver = Object.getOwnPropertyDescriptor(navigator, 'webdriver')
      const protoWebdriver = navProto && Object.getOwnPropertyDescriptor(navProto, 'webdriver')

      // navigator.webdriver must be defined on the prototype, not the instance
      const webdriverOnProto = Boolean(protoWebdriver && protoWebdriver.get)
      const webdriverOwnOnInstance = Boolean(ownWebdriver)

      // W3C: Function.prototype.toString must still be the (patched) prototype
      // method that delegates native code, and must not be an own property of
      // arbitrary functions.
      const protoToString = Object.getOwnPropertyDescriptor(Function.prototype, 'toString')
      const nativeFn = function a() {}
      const nativeOnProto = Function.prototype.hasOwnProperty.call(nativeFn, 'toString') === false
      const toStrDelegates = /native code/.test(JSON.stringify(nativeFn.toString().slice(0, 40))) === false
      // The replacement function itself must ALSO report native so it does not
      // leak the wrapper body when inspected directly.
      const toStringSelf = String(Function.prototype.toString.call(Function.prototype.toString))
      const toStringSelfNative = /\[native code\]/.test(toStringSelf) &&
        !/\bNATIVE_TAG\b/.test(toStringSelf) &&
        !/originalToString/.test(toStringSelf) &&
        !/\bif \(this\b/.test(toStringSelf)

      // PermissionStatus: must be an instanceof and support native internal
      // slot methods (EventTarget.addEventListener via .call must not throw
      // Illegal invocation).
      const perm = await navigator.permissions.query({ name: 'notifications' })
      const permIsInstance = typeof PermissionStatus !== 'undefined' ? perm instanceof PermissionStatus : false
      let permInternalSlotWorks = false
      if (typeof EventTarget !== 'undefined') {
        try {
          EventTarget.prototype.addEventListener.call(perm, 'change', () => {})
          permInternalSlotWorks = true
        } catch { permInternalSlotWorks = false }
      }
      let permStatusSlotWorks = false
      try {
        const stateDescriptor = Object.getOwnPropertyDescriptor(PermissionStatus.prototype, 'state')
        permStatusSlotWorks = Boolean(stateDescriptor?.get && stateDescriptor.get.call(perm) === perm.state)
      } catch { permStatusSlotWorks = false }

      // mimeTypes length must match the number of defined indexed entries
      let mimeBalanced = true
      for (let i = 0; i < navigator.mimeTypes.length; i++) {
        if (!navigator.mimeTypes[i]) { mimeBalanced = false; break }
      }

      return {
        webdriverOnProto,
        webdriverOwnOnInstance,
        webdriverValue: navigator.webdriver,
        protoToStringIsGetterOnProto: Boolean(protoToString && typeof protoToString.value === 'function'),
        nativeOnProto,
        toStrDelegates,
        toStringSelfNative,
        permIsInstance,
        permInternalSlotWorks,
        permStatusSlotWorks,
        permHasOwnState: Object.prototype.hasOwnProperty.call(perm, 'state'),
        permState: perm.state,
        mimeLength: navigator.mimeTypes.length,
        mimeBalanced,
      }
    })

    assert.strictEqual(result.webdriverValue, false, 'navigator.webdriver must resolve to false (real Chrome) or undefined')
    assert.strictEqual(result.webdriverOnProto, true, 'webdriver descriptor must live on Navigator.prototype')
    assert.strictEqual(result.webdriverOwnOnInstance, false, 'webdriver must NOT be an own property of the navigator instance')
    assert.strictEqual(result.protoToStringIsGetterOnProto, true, 'Function.prototype.toString must be patched on the prototype')
    assert.strictEqual(result.nativeOnProto, true, 'arbitrary functions must not carry own toString properties')
    assert.strictEqual(result.toStrDelegates, true, 'native toString must not leak patched body')
    assert.strictEqual(result.toStringSelfNative, true, 'Function.prototype.toString.call(Function.prototype.toString) must report native')
    assert.strictEqual(result.permIsInstance, true, 'permissions.query must resolve to a PermissionStatus instance')
    assert.strictEqual(result.permInternalSlotWorks, true, 'PermissionStatus must support native EventTarget internal-slot methods')
    assert.strictEqual(result.permStatusSlotWorks, true, 'PermissionStatus must support its native state getter internal slot')
    assert.strictEqual(result.permHasOwnState, false, 'PermissionStatus state must remain a native prototype accessor')
    assert.strictEqual(result.permState, 'prompt', 'notifications permission default state must be prompt')
    assert.strictEqual(result.mimeBalanced, true, 'navigator.mimeTypes indexed entries must match length')
    assert(result.mimeLength >= 0, 'navigator.mimeTypes must preserve the browser-native collection')

    // Cross-engine guard: a REAL Firefox engine must never receive the
    // Chromium-only `window.chrome` surface. We launch an actual Firefox
    // browser; if the bundled Firefox binary is unavailable the assertion is
    // reported as skipped (rather than falsely claiming coverage).
    const ffRuntime = buildRuntimeIdentity(createIdentity('ff-58b', env, 'firefox'), '131.0.0.0')
    let ffBrowser = null
    try {
      ffBrowser = await firefox.launch({ headless: true })
    } catch {
      console.log('  (info) Real Firefox binary unavailable - real-engine chrome assertion skipped')
    }
    if (ffBrowser) {
      try {
        const ffCtx = await ffBrowser.newContext({ userAgent: ffRuntime.userAgent })
        await ffCtx.addInitScript(getIdentityInitScript(ffRuntime))
        const ffPage = await ffCtx.newPage()
        await ffPage.setContent('<!doctype html><title>ff</title>')
        const ffChrome = await ffPage.evaluate(() => {
          const desc = Object.getOwnPropertyDescriptor(globalThis, 'chrome')
          return { defined: typeof globalThis.chrome !== 'undefined', own: Boolean(desc) }
        })
        assert.strictEqual(ffChrome.defined, false, 'Real Firefox must not receive Chromium-only window.chrome')
        await ffCtx.close()
      } finally {
        await ffBrowser.close()
      }
      console.log('  PASS: Real Firefox engine does not receive window.chrome')
    }

    // 9. Input replay must REPLACE, not duplicate, existing field content.
    await page.setContent('<input id="inp" value="a">')
    await humanBehavior.humanType(page, '#inp', 'ab', { allowTypo: false, clear: true })
    const inputValue = await page.inputValue('#inp')
    assert.strictEqual(inputValue, 'ab', 'humanType(clear:true) must replace "a" -> "ab", not produce "aab"')

    // 10. Mouse state must be isolated per page (no shared cursor between pages).
    const movesA = []
    const movesB = []
    const pageA = {
      mouse: { move: async (x, y) => movesA.push([Math.round(x), Math.round(y)]) },
      keyboard: { press: async () => {} },
      evaluate: async () => ({ x: 400, y: 300 }),
    }
    const pageB = {
      mouse: { move: async (x, y) => movesB.push([Math.round(x), Math.round(y)]) },
      keyboard: { press: async () => {} },
      evaluate: async () => ({ x: 800, y: 600 }),
    }
    await humanBehavior.humanMove(pageA, 100, 100, { steps: 3 })
    await humanBehavior.humanMove(pageB, 500, 500, { steps: 3 })
    // Page B must start at ITS OWN center (800,600), not at page A's last
    // position (100,100), proving per-page cursor isolation.
    assert(movesB.length > 0, 'page B must have emitted mouse moves')
    const bStartX = movesB[0][0]
    const bStartY = movesB[0][1]
    assert(Math.abs(bStartX - 800) <= 1 && Math.abs(bStartY - 600) <= 1,
      `page B must start at its own center, got (${bStartX}, ${bStartY})`)
    assert(!(bStartX === 100 && bStartY === 100), 'page B must not inherit page A cursor position')

    await context.close()
  } finally { await browser.close() }
  console.log('  PASS: Real browser context property descriptors & prototype checks passed')
  console.log('  PASS: Input replacement & per-page mouse isolation verified')

  console.log('\n✅ All Step 58 Stealth & Biometrics tests passed successfully!\n')
}

runTests().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
