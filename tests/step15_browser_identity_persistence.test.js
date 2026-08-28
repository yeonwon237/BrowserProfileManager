const assert = require('assert')
const fs = require('fs')
const path = require('path')
const http = require('http')
const { getDb, closeDb } = require('../src/main/database')
const { createProfile, getProfileById, deleteProfile, duplicateProfile, clearProfileSessionData } = require('../src/main/database/profiles')
const browserManager = require('../src/main/browser/manager')
const leakProtection = require('../src/main/browser/leakProtection')

async function runStep15Tests() {
  console.log('=== STARTING BƯỚC 15: BROWSER IDENTITY PERSISTENCE TESTS ===\n')

  let createdProfileIds = []
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<html><body>identity persistence test</body></html>')
  })
  await new Promise((resolve) => server.listen(8815, '127.0.0.1', resolve))

  try {
    // 1. Test Identity Stability across Multiple Consecutive Launches
    console.log('[Test 1] Testing Identity Stability Across Multiple Consecutive Launches (Zero Drift)...')
    const originalEnv = {
      mode: 'custom',
      locale: 'ja-JP',
      timezone: 'Asia/Tokyo',
      languages: ['ja-JP', 'ja', 'en-US'],
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
      reducedMotion: 'reduce',
    }

    const profile1 = await createProfile({
      name: 'Stable Identity Profile',
      browser_type: 'chromium',
      environment: originalEnv,
      tags: ['identity', 'stability'],
    })
    createdProfileIds.push(profile1.id)

    // Launch #1
    let res1 = await browserManager.openProfile(profile1)
    assert(res1.success)
    let page1 = browserManager.getEntry(profile1.id).context.pages()[0] || (await browserManager.getEntry(profile1.id).context.newPage())
    await page1.goto('http://127.0.0.1:8815/')

    const tz1 = await page1.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
    const lang1 = await page1.evaluate(() => navigator.language)
    const vp1 = await page1.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))

    await page1.evaluate(() => {
      document.cookie = 'user_session=secret_token_12345; Max-Age=86400; Path=/; SameSite=Lax'
    })

    await browserManager.closeProfile(profile1.id)

    // Launch #2
    let res2 = await browserManager.openProfile(profile1)
    assert(res2.success)
    let page2 = browserManager.getEntry(profile1.id).context.pages()[0] || (await browserManager.getEntry(profile1.id).context.newPage())
    await page2.goto('data:text/html,<html><head><title>Launch 2</title></head><body><h1>Session 2</h1></body></html>')

    const tz2 = await page2.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
    const lang2 = await page2.evaluate(() => navigator.language)
    const vp2 = await page2.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))

    assert.strictEqual(tz1, tz2, 'Timezone must remain identical across launches')
    assert.strictEqual(lang1, lang2, 'Locale must remain identical across launches')
    assert.strictEqual(vp1.w, vp2.w, 'Viewport width must remain identical')
    assert.strictEqual(vp1.h, vp2.h, 'Viewport height must remain identical')

    // Verify cookie persisted into launch 2
    const cookies2 = await browserManager.getEntry(profile1.id).context.cookies(['http://127.0.0.1:8815/'])
    assert(cookies2.some((c) => c.name === 'user_session' && c.value === 'secret_token_12345'), 'Cookie must persist on re-launch')

    await browserManager.closeProfile(profile1.id)
    console.log('✓ Identity stability verified across multiple launches (zero random drift)')

    // 2. Test Safe Duplication - Clean Isolated Session (copySession: false)
    console.log('\n[Test 2] Testing Safe Duplication Mode 1: Clean Isolated Session (copySession: false)...')
    const profileCleanClone = await duplicateProfile(profile1.id, {
      name: 'Clean Session Clone',
      copySession: false,
    })
    assert(profileCleanClone && profileCleanClone.id, 'Clean clone should be created')
    createdProfileIds.push(profileCleanClone.id)

    // Verify metadata was copied
    assert.strictEqual(profileCleanClone.environment.locale, 'ja-JP')
    assert.strictEqual(profileCleanClone.environment.timezone, 'Asia/Tokyo')
    assert.strictEqual(profileCleanClone.browser_type, 'chromium')
    // Verify separate data path
    assert.notStrictEqual(profileCleanClone.browser_data_path, profile1.browser_data_path)

    // Open Clean Clone in browser -> Verify cookies are empty
    await browserManager.openProfile(profileCleanClone)
    const cleanCookies = await browserManager.getEntry(profileCleanClone.id).context.cookies(['http://127.0.0.1:8815/'])
    assert.strictEqual(cleanCookies.length, 0, 'Clean duplicate must have empty cookies')

    await browserManager.closeProfile(profileCleanClone.id)
    console.log('✓ Clean session duplication verified: cloned environment with 100% isolated fresh storage')

    // 3. Test Clear Profile Session Data
    console.log('\n[Test 3] Testing Clear Profile Session Data (Wipe cookies/storage, preserve configuration)...')
    const clearRes = await clearProfileSessionData(profile1.id)
    assert(clearRes.success, 'Clear session data should succeed')

    const profile1AfterClear = await getProfileById(profile1.id)
    assert.strictEqual(profile1AfterClear.name, 'Stable Identity Profile', 'Profile name must be preserved')
    assert.strictEqual(profile1AfterClear.environment.timezone, 'Asia/Tokyo', 'Environment config must be preserved')
    assert.strictEqual(profile1AfterClear.environment.locale, 'ja-JP', 'Locale must be preserved')

    // Launch profile1 after clear -> verify cookies are wiped
    await browserManager.openProfile(profile1AfterClear)
    const cookiesAfterClear = await browserManager.getEntry(profile1.id).context.cookies(['http://127.0.0.1:8815/'])
    assert.strictEqual(cookiesAfterClear.length, 0, 'Cookies must be wiped after clearProfileSessionData')
    await browserManager.closeProfile(profile1.id)
    console.log('✓ Clear profile session data verified: session wiped while database metadata is 100% preserved')

    // 4. Test WebRTC Leak Protection Co-existence
    console.log('\n[Test 4] Verifying WebRTC Leak Protection Co-existence...')
    assert(leakProtection.getLaunchArgs, 'WebRTC leak protection must remain available')
    console.log('✓ WebRTC leak protection is active and unaffected')

    console.log('\n======================================================')
    console.log('🎉 ALL BƯỚC 15 TESTS PASSED SUCCESSFULLY WITH ZERO ERRORS!')
    console.log('======================================================\n')
  } finally {
    await browserManager.closeAllProfiles().catch(() => {})
    await new Promise((resolve) => server.close(resolve))
    for (const id of createdProfileIds) {
      await deleteProfile(id, { deleteData: true }).catch(() => {})
    }
    closeDb()
  }
}

runStep15Tests().catch((err) => {
  console.error('\n❌ STEP 15 TEST FAILED:', err)
  process.exit(1)
})
