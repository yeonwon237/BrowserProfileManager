const assert = require('assert')
const { getDb, closeDb } = require('../src/main/database')
const { createProfile, getProfileById, deleteProfile, updateProfile } = require('../src/main/database/profiles')
const browserManager = require('../src/main/browser/manager')
const { validateEnvironment } = require('../src/main/browser/environmentValidator')
const leakProtection = require('../src/main/browser/leakProtection')

async function runStep12Tests() {
  console.log('=== STARTING BƯỚC 12: BROWSER ENVIRONMENT PROFILE TESTS ===\n')

  let createdProfileIds = []

  try {
    // 1. Test Environment Validation
    console.log('[Test 1] Testing Environment Validator...')
    const validRes = validateEnvironment({
      mode: 'custom',
      locale: 'ja-JP',
      timezone: 'Asia/Tokyo',
      languages: ['ja-JP', 'ja', 'en-US'],
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1.5,
      colorScheme: 'dark',
      reducedMotion: 'reduce',
      geolocation: { latitude: 35.6762, longitude: 139.6503, accuracy: 10 },
      permissions: ['geolocation'],
    })
    assert.strictEqual(validRes.valid, true, 'Valid environment configuration should pass')
    assert.strictEqual(validRes.sanitized.locale, 'ja-JP', 'Sanitized locale must match')
    assert.strictEqual(validRes.sanitized.timezone, 'Asia/Tokyo', 'Sanitized timezone must match')

    // Test Invalid timezone
    const invalidTzRes = validateEnvironment({ mode: 'custom', timezone: 'Fake/Unknown_Timezone' })
    assert.strictEqual(invalidTzRes.valid, false, 'Invalid timezone must be rejected')
    assert(invalidTzRes.errors.some((e) => e.includes('Invalid timezone')), 'Should provide timezone error')

    // Test Invalid viewport
    const invalidVpRes = validateEnvironment({ mode: 'custom', viewport: { width: 50, height: 50 } })
    assert.strictEqual(invalidVpRes.valid, false, 'Out-of-bounds viewport must be rejected')

    console.log('✓ Environment validation correctly accepts valid configurations and rejects invalid values')

    // 2. Test Database Schema & Persistence
    console.log('\n[Test 2] Creating Profile with Custom Environment in SQLite...')
    const customEnv = {
      mode: 'custom',
      locale: 'ja-JP',
      timezone: 'Asia/Tokyo',
      languages: ['ja-JP', 'ja', 'en-US'],
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
      reducedMotion: 'reduce',
      geolocation: { latitude: 35.6762, longitude: 139.6503, accuracy: 10 },
      permissions: ['geolocation'],
    }

    const profile = await createProfile({
      name: 'Profile Tokyo - Custom Env',
      browser_type: 'chromium',
      environment: customEnv,
      tags: ['test', 'japan', 'env'],
    })
    assert(profile && profile.id, 'Profile should be created')
    createdProfileIds.push(profile.id)

    const fetched = await getProfileById(profile.id)
    assert.strictEqual(fetched.environment.mode, 'custom', 'Fetched environment mode must be custom')
    assert.strictEqual(fetched.environment.locale, 'ja-JP', 'Fetched environment locale must be ja-JP')
    assert.strictEqual(fetched.environment.timezone, 'Asia/Tokyo', 'Fetched environment timezone must be Asia/Tokyo')
    assert.strictEqual(fetched.environment.colorScheme, 'dark', 'Fetched colorScheme must be dark')
    assert.strictEqual(fetched.environment.viewport.width, 1280, 'Fetched viewport width must be 1280')
    console.log('✓ SQLite environment persistence verified')

    // 3. Test Launch Context with Custom Environment
    console.log('\n[Test 3] Launching Profile with Custom Environment in Browser...')
    const launchRes = await browserManager.openProfile(profile)
    assert(launchRes.success, 'Profile with custom environment must launch successfully')

    const entry = browserManager.getEntry(profile.id)
    assert(entry && entry.context, 'Context must exist')

    const page = entry.context.pages()[0] || (await entry.context.newPage())
    await page.goto('data:text/html,<html><head><title>Environment Test</title></head><body><h1>Environment Diagnostics</h1></body></html>')

    // 4. Verify in-browser execution properties
    console.log('\n[Test 4] Verifying In-Browser Environment Properties...')
    const browserLocale = await page.evaluate(() => navigator.language)
    const browserTimezone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
    const browserPrefersDark = await page.evaluate(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
    const browserPrefersReducedMotion = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    const browserViewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))

    console.log(`Browser detected -> Locale: ${browserLocale} | Timezone: ${browserTimezone} | Dark: ${browserPrefersDark} | Viewport: ${browserViewport.width}x${browserViewport.height}`)

    assert.strictEqual(browserLocale, 'ja-JP', `Browser navigator.language must be ja-JP (got ${browserLocale})`)
    assert.strictEqual(browserTimezone, 'Asia/Tokyo', `Browser timeZone must be Asia/Tokyo (got ${browserTimezone})`)
    assert.strictEqual(browserPrefersDark, true, 'Browser must reflect prefers-color-scheme: dark')
    assert.strictEqual(browserPrefersReducedMotion, true, 'Browser must reflect prefers-reduced-motion: reduce')
    assert.strictEqual(browserViewport.width, 1280, `Browser innerWidth must be 1280 (got ${browserViewport.width})`)
    assert.strictEqual(browserViewport.height, 720, `Browser innerHeight must be 720 (got ${browserViewport.height})`)

    console.log('✓ In-browser environment reflection verified: locale, timezone, colorScheme, reducedMotion, viewport')

    // 5. Test Environment Stability Across Launches (No Randomization)
    console.log('\n[Test 5] Verifying Environment Stability Across Multiple Launches...')
    await browserManager.closeProfile(profile.id)
    assert(!browserManager.isRunning(profile.id), 'Profile should be closed')

    console.log('-> Re-opening Profile Tokyo...')
    await browserManager.openProfile(profile)
    const reEntry = browserManager.getEntry(profile.id)
    const rePage = reEntry.context.pages()[0] || (await reEntry.context.newPage())
    await rePage.goto('data:text/html,<html><head><title>Re-open</title></head><body><h1>Re-opened</h1></body></html>')

    const reLocale = await rePage.evaluate(() => navigator.language)
    const reTimezone = await rePage.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
    const rePrefersDark = await rePage.evaluate(() => window.matchMedia('(prefers-color-scheme: dark)').matches)

    assert.strictEqual(reLocale, 'ja-JP', 'Reopened profile must retain exact same locale without random variation')
    assert.strictEqual(reTimezone, 'Asia/Tokyo', 'Reopened profile must retain exact same timezone without random variation')
    assert.strictEqual(rePrefersDark, true, 'Reopened profile must retain exact same colorScheme')
    console.log('✓ Environment stability verified: zero random drift between launches')

    await browserManager.closeAllProfiles()

    // 6. Test WebRTC Leak Protection Co-existence
    console.log('\n[Test 6] Verifying WebRTC Leak Protection Co-existence...')
    assert(leakProtection.getLaunchArgs, 'WebRTC leak protection getLaunchArgs must be available')
    const initScript = await leakProtection.getWebRtcInitScript()
    assert(initScript && initScript.includes('__ynloginWebRtcPatched'), 'WebRTC init script must remain active and unmodified')
    console.log('✓ WebRTC leak protection is active and fully co-exists with environment profiles')

    console.log('\n======================================================')
    console.log('🎉 ALL BƯỚC 12 TESTS PASSED SUCCESSFULLY WITH ZERO ERRORS!')
    console.log('======================================================\n')
  } finally {
    for (const id of createdProfileIds) {
      await deleteProfile(id, { deleteData: true }).catch(() => {})
    }
    closeDb()
  }
}

runStep12Tests().catch((err) => {
  console.error('\n❌ STEP 12 TEST FAILED:', err)
  process.exit(1)
})
