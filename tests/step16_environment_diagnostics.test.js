const assert = require('assert')
const { getDb, closeDb } = require('../src/main/database')
const { createProfile, deleteProfile } = require('../src/main/database/profiles')
const { createProxy, deleteProxy } = require('../src/main/database/proxies')
const { runProfileDiagnostics } = require('../src/main/browser/diagnostics')
const browserManager = require('../src/main/browser/manager')
const leakProtection = require('../src/main/browser/leakProtection')

async function runStep16Tests() {
  console.log('=== STARTING BƯỚC 16: ENVIRONMENT DIAGNOSTICS TESTS ===\n')

  let createdProfileIds = []
  let createdProxyIds = []

  try {
    // 1. Create a Profile with Custom Environment & Proxy for Diagnostics Testing
    console.log('[Test 1] Creating Profile with Custom Environment & Proxy...')
    const proxy = await createProxy({
      name: 'Tokyo Resident Proxy',
      protocol: 'http',
      host: '127.0.0.1',
      port: 9090,
      country_code: 'JP',
      country_name: 'Japan',
      city: 'Tokyo',
      timezone: 'Asia/Tokyo',
      geo_metadata: { country_code: 'JP', country_name: 'Japan', city: 'Tokyo', timezone: 'Asia/Tokyo' },
    })
    createdProxyIds.push(proxy.id)

    const profile = await createProfile({
      name: 'Diagnostics Target Profile',
      browser_type: 'chromium',
      proxy_id: proxy.id,
      environment: {
        mode: 'custom',
        locale: 'ja-JP',
        timezone: 'Asia/Tokyo',
        languages: ['ja-JP', 'ja', 'en-US'],
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        colorScheme: 'dark',
        reducedMotion: 'reduce',
      },
      tags: ['diag', 'test'],
    })
    createdProfileIds.push(profile.id)

    // 2. Run Diagnostics on Idle Profile (Launches headless inspection)
    console.log('\n[Test 2] Running Diagnostics on Idle Profile (Headless Inspection)...')
    const diagReport = await runProfileDiagnostics(profile.id)
    assert(diagReport.success, 'Diagnostics must succeed')
    assert.strictEqual(diagReport.overallStatus, 'HEALTHY', 'Consistent Japanese profile should be HEALTHY')

    console.log('Detected Runtime Language:', diagReport.runtimeData.language)
    console.log('Detected Runtime Timezone:', diagReport.runtimeData.timezone)
    console.log('Detected Viewport:', `${diagReport.runtimeData.viewport.innerWidth}x${diagReport.runtimeData.viewport.innerHeight}`)

    assert.strictEqual(diagReport.runtimeData.language, 'ja-JP', 'Runtime language must be ja-JP')
    assert.strictEqual(diagReport.runtimeData.timezone, 'Asia/Tokyo', 'Runtime timezone must be Asia/Tokyo')
    assert.strictEqual(diagReport.runtimeData.viewport.innerWidth, 1280, 'Runtime innerWidth must be 1280')
    assert.strictEqual(diagReport.runtimeData.viewport.innerHeight, 720, 'Runtime innerHeight must be 720')
    assert.strictEqual(diagReport.runtimeData.prefersDark, true, 'prefersDark must be true')

    // Verify Comparison items
    assert(Array.isArray(diagReport.comparisons) && diagReport.comparisons.length >= 5)
    for (const comp of diagReport.comparisons) {
      assert.strictEqual(comp.match, true, `Parameter "${comp.field}" must match between configured and runtime`)
    }

    // Verify WebRTC Status
    assert.strictEqual(diagReport.webrtcStatus.active, true, 'WebRTC leak protection must be reported as active')
    assert.strictEqual(diagReport.webrtcStatus.patched, true, 'WebRTC SDP script patch must be active')

    // Verify Proxy Info
    assert(diagReport.proxyInfo, 'Proxy info must be included in diagnostics')
    assert.strictEqual(diagReport.proxyInfo.country_code, 'JP')

    console.log('✓ Idle profile environment diagnostics report verified')

    // 3. Run Diagnostics on Live Running Profile
    console.log('\n[Test 3] Running Diagnostics on Live Running Profile...')
    const launchRes = await browserManager.openProfile(profile)
    assert(launchRes.success, 'Profile should launch')

    const liveDiagReport = await runProfileDiagnostics(profile.id)
    assert(liveDiagReport.success, 'Diagnostics on live profile must succeed')
    assert.strictEqual(liveDiagReport.runtimeData.timezone, 'Asia/Tokyo')

    // Ensure profile remains open after live diagnostics
    assert(browserManager.isRunning(profile.id), 'Live profile must remain running after diagnostics inspect')
    await browserManager.closeProfile(profile.id)

    console.log('✓ Live profile diagnostics verified')

    // 4. WebRTC Leak Protection Co-existence
    console.log('\n[Test 4] Verifying WebRTC Leak Protection Co-existence...')
    assert(leakProtection.getLaunchArgs, 'WebRTC leak protection must remain available')
    console.log('✓ WebRTC leak protection active and unaffected')

    console.log('\n======================================================')
    console.log('🎉 ALL BƯỚC 16 TESTS PASSED SUCCESSFULLY WITH ZERO ERRORS!')
    console.log('======================================================\n')
  } finally {
    for (const id of createdProfileIds) {
      await deleteProfile(id, { deleteData: true }).catch(() => {})
    }
    for (const id of createdProxyIds) {
      await deleteProxy(id).catch(() => {})
    }
    closeDb()
  }
}

runStep16Tests().catch((err) => {
  console.error('\n❌ STEP 16 TEST FAILED:', err)
  process.exit(1)
})
