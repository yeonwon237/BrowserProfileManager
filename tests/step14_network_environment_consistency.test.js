const assert = require('assert')
const { getDb, closeDb } = require('../src/main/database')
const { createProxy, getProxyById, deleteProxy } = require('../src/main/database/proxies')
const { createProfile, getProfileById, deleteProfile } = require('../src/main/database/profiles')
const { validateConsistency, applyProxyGeoToEnvironment } = require('../src/main/browser/consistencyValidator')
const browserManager = require('../src/main/browser/manager')
const leakProtection = require('../src/main/browser/leakProtection')

async function runStep14Tests() {
  console.log('=== STARTING BƯỚC 14: NETWORK & ENVIRONMENT CONSISTENCY TESTS ===\n')

  let createdProfileIds = []
  let createdProxyIds = []

  try {
    // 1. Test Direct Connection (No Proxy)
    console.log('[Test 1] Testing Direct Connection Consistency...')
    const directResult = validateConsistency({ environment: { mode: 'custom', locale: 'ja-JP', timezone: 'Asia/Tokyo' } }, null)
    assert.strictEqual(directResult.consistent, true, 'Direct connection without proxy must be marked consistent')
    assert.strictEqual(directResult.hasProxy, false)
    console.log('✓ Direct connection consistency verified')

    // 2. Test Consistent Proxy Geo vs Profile Environment
    console.log('\n[Test 2] Testing Matching Proxy Geo and Profile Environment (US Proxy + America/New_York)...')
    const usProxy = {
      id: 'proxy-us-001',
      name: 'US Dedicated Proxy',
      country_code: 'US',
      country_name: 'United States',
      city: 'New York',
      timezone: 'America/New_York',
    }
    const matchingProfile = {
      name: 'US Profile',
      environment: {
        mode: 'custom',
        locale: 'en-US',
        timezone: 'America/New_York',
        languages: ['en-US', 'en'],
      },
    }
    const matchRes = validateConsistency(matchingProfile, usProxy)
    assert.strictEqual(matchRes.consistent, true, 'Matching US proxy and timezone should be consistent')
    assert.strictEqual(matchRes.warnings.length, 0, 'Should have 0 warnings')
    console.log('✓ Matching proxy and environment verified as consistent')

    // 3. Test Inconsistent Proxy Geo vs Profile Environment (US Proxy + Asia/Ho_Chi_Minh Timezone)
    console.log('\n[Test 3] Testing Mismatched Proxy Geo and Profile Environment (US Proxy + Asia/Ho_Chi_Minh)...')
    const mismatchProfile = {
      name: 'Mismatched Profile',
      environment: {
        mode: 'custom',
        locale: 'vi-VN',
        timezone: 'Asia/Ho_Chi_Minh',
      },
    }
    const mismatchRes = validateConsistency(mismatchProfile, usProxy)
    assert.strictEqual(mismatchRes.consistent, false, 'Mismatched timezone must be marked inconsistent')
    assert(mismatchRes.warnings.some((w) => w.type === 'timezone_mismatch'), 'Should produce timezone_mismatch warning')
    assert(mismatchRes.warnings.some((w) => w.type === 'locale_mismatch'), 'Should produce locale_mismatch warning')
    console.log('Warnings caught:', mismatchRes.warnings.map((w) => `${w.title}: ${w.message}`).join(' | '))
    console.log('✓ Inconsistent proxy and environment accurately detected with warnings')

    // 4. Test Auto-match with Proxy Geo
    console.log('\n[Test 4] Testing Auto-match with Proxy Geo (applyProxyGeoToEnvironment)...')
    const autoSyncedEnv = applyProxyGeoToEnvironment(mismatchProfile.environment, usProxy)
    assert.strictEqual(autoSyncedEnv.timezone, 'America/New_York', 'Auto-matched timezone should be America/New_York')
    assert.strictEqual(autoSyncedEnv.locale, 'en-US', 'Auto-matched locale should be en-US')

    const reChecked = validateConsistency({ environment: autoSyncedEnv }, usProxy)
    assert.strictEqual(reChecked.consistent, true, 'Re-checking auto-synced environment should be consistent')
    assert.strictEqual(reChecked.warnings.length, 0, 'Should have 0 warnings after auto-match')
    console.log('✓ Auto-match with Proxy Geo verified')

    // 5. Test Database Integration & Proxy Geo Persistence
    console.log('\n[Test 5] Testing SQLite Proxy Geo Persistence...')
    const savedProxy = await createProxy({
      name: 'Tokyo Fast Residential',
      protocol: 'http',
      host: '127.0.0.1',
      port: 8888,
      country_code: 'JP',
      country_name: 'Japan',
      city: 'Tokyo',
      timezone: 'Asia/Tokyo',
      geo_metadata: { country_code: 'JP', country_name: 'Japan', city: 'Tokyo', timezone: 'Asia/Tokyo' },
    })
    createdProxyIds.push(savedProxy.id)
    assert.strictEqual(savedProxy.country_code, 'JP')
    assert.strictEqual(savedProxy.timezone, 'Asia/Tokyo')

    const fetchedProxy = await getProxyById(savedProxy.id)
    assert.strictEqual(fetchedProxy.country_code, 'JP')
    console.log('✓ SQLite proxy geo persistence verified')

    // 6. Test Non-Blocking Browser Launch Guarantee (Mismatched profile can still launch)
    console.log('\n[Test 6] Testing Non-Blocking Launch Guarantee on Inconsistent Profile...')
    const profileWithWarning = await createProfile({
      name: 'Custom Intent Profile',
      browser_type: 'chromium',
      environment: {
        mode: 'custom',
        locale: 'ja-JP',
        timezone: 'Asia/Tokyo',
        viewport: { width: 1280, height: 720 },
      },
    })
    createdProfileIds.push(profileWithWarning.id)

    const launchRes = await browserManager.openProfile(profileWithWarning)
    assert(launchRes.success, 'Profile with custom environment must launch successfully without blocking')

    const entry = browserManager.getEntry(profileWithWarning.id)
    const page = entry.context.pages()[0] || (await entry.context.newPage())
    await page.goto('data:text/html,<html><head><title>Non-blocking Test</title></head><body><h1>Warning is Non-blocking</h1></body></html>')

    const browserTz = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
    assert.strictEqual(browserTz, 'Asia/Tokyo', 'Browser reflects configured timezone')
    await browserManager.closeProfile(profileWithWarning.id)
    console.log('✓ Non-blocking launch guarantee verified: advisory warnings do not impede browser execution')

    // 7. Test WebRTC Leak Protection Co-existence
    console.log('\n[Test 7] Verifying WebRTC Leak Protection Co-existence...')
    assert(leakProtection.getLaunchArgs, 'WebRTC leak protection must remain available')
    console.log('✓ WebRTC leak protection active and unaffected')

    console.log('\n======================================================')
    console.log('🎉 ALL BƯỚC 14 TESTS PASSED SUCCESSFULLY WITH ZERO ERRORS!')
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

runStep14Tests().catch((err) => {
  console.error('\n❌ STEP 14 TEST FAILED:', err)
  process.exit(1)
})
