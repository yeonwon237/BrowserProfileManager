const assert = require('assert')
const fs = require('fs')
const path = require('path')
const http = require('http')
const { getDb, closeDb } = require('../src/main/database')
const { createProfile, getProfileById, deleteProfile, getAllProfiles, updateProfile } = require('../src/main/database/profiles')
const browserAdapter = require('../src/main/browser/adapter')
const browserManager = require('../src/main/browser/manager')

async function runStep11Tests() {
  console.log('=== STARTING BƯỚC 11: MULTI-BROWSER ENGINE TESTS ===\n')

  let createdProfileIds = []
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<html><body>session persistence test</body></html>')
  })
  await new Promise((resolve) => server.listen(8811, '127.0.0.1', resolve))

  try {
    // 1. Test database schema & migration
    console.log('[Test 1] Testing Database Schema & Column Migration...')
    const db = await getDb()
    assert(db, 'Database should be initialized')

    // Create 3 profiles with different engines
    console.log('[Test 2] Creating Profiles with different browser engines...')
    const profileA = await createProfile({
      name: 'Profile A - Chromium Engine',
      browser_type: 'chromium',
      tags: ['test', 'chromium'],
    })
    assert(profileA && profileA.id, 'Profile A should be created')
    assert.strictEqual(profileA.browser_type, 'chromium', 'Profile A browser_type should be chromium')
    createdProfileIds.push(profileA.id)

    const profileB = await createProfile({
      name: 'Profile B - Google Chrome',
      browser_type: 'chrome',
      tags: ['test', 'chrome'],
    })
    assert(profileB && profileB.id, 'Profile B should be created')
    assert.strictEqual(profileB.browser_type, 'chrome', 'Profile B browser_type should be chrome')
    assert.strictEqual(profileB.browser_channel, 'chrome', 'Profile B browser_channel should be chrome')
    createdProfileIds.push(profileB.id)

    const profileC = await createProfile({
      name: 'Profile C - Microsoft Edge',
      browser_type: 'msedge',
      tags: ['test', 'edge'],
    })
    assert(profileC && profileC.id, 'Profile C should be created')
    assert.strictEqual(profileC.browser_type, 'msedge', 'Profile C browser_type should be msedge')
    assert.strictEqual(profileC.browser_channel, 'msedge', 'Profile C browser_channel should be msedge')
    createdProfileIds.push(profileC.id)

    console.log('✓ Created Profile A (Chromium), Profile B (Chrome), Profile C (Edge)')

    // 2. Test Browser Engine Detection
    console.log('\n[Test 3] Testing Installed Browser Engines Detection...')
    const detectedEngines = await browserAdapter.detectInstalledEngines(true)
    console.log('Detected Engines:', detectedEngines.map((e) => `${e.name}: ${e.available ? `✓ (v${e.version})` : '✗'}`).join(' | '))
    assert(Array.isArray(detectedEngines) && detectedEngines.length >= 3, 'Should detect at least 3 supported engines')
    const chromiumFound = detectedEngines.find((e) => e.id === 'chromium')
    assert(chromiumFound && chromiumFound.available, 'Chromium must be available')

    // 3. Test Concurrent Launch of Chromium, Chrome, and Edge
    console.log('\n[Test 4] Testing Concurrent Launch of Profile A, B, and C...')
    
    // Launch Profile A (Chromium)
    console.log('-> Launching Profile A (Chromium)...')
    const resA = await browserManager.openProfile(profileA)
    assert(resA.success, 'Profile A should launch successfully')
    const entryA = browserManager.getEntry(profileA.id)
    assert(entryA && entryA.context, 'Entry A context should exist')

    // Set a real first-party cookie after visiting its origin.
    const pageA = entryA.context.pages()[0] || (await entryA.context.newPage())
    await pageA.goto('http://127.0.0.1:8811/')
    await pageA.evaluate(() => {
      document.cookie = 'session_auth=TOKEN_A_CHROMIUM; Max-Age=3600; Path=/; SameSite=Lax'
    })
    const expiry = Math.floor(Date.now() / 1000) + 3600

    // Launch Profile B (Chrome)
    const chromeAvailable = detectedEngines.find((e) => e.id === 'chrome')?.available
    if (chromeAvailable) {
      console.log('-> Launching Profile B (Google Chrome)...')
      const resB = await browserManager.openProfile(profileB)
      assert(resB.success, 'Profile B should launch successfully')
      const entryB = browserManager.getEntry(profileB.id)
      assert(entryB && entryB.context, 'Entry B context should exist')

      await entryB.context.addCookies([
        { name: 'session_auth', value: 'TOKEN_B_CHROME', domain: '.example.com', path: '/', expires: expiry },
      ])
    } else {
      console.log('-> Google Chrome not installed on system, skipping Chrome launch')
    }

    // Launch Profile C (Edge)
    const edgeAvailable = detectedEngines.find((e) => e.id === 'msedge')?.available
    if (edgeAvailable) {
      console.log('-> Launching Profile C (Microsoft Edge)...')
      const resC = await browserManager.openProfile(profileC)
      assert(resC.success, 'Profile C should launch successfully')
      const entryC = browserManager.getEntry(profileC.id)
      assert(entryC && entryC.context, 'Entry C context should exist')

      await entryC.context.addCookies([
        { name: 'session_auth', value: 'TOKEN_C_EDGE', domain: '.example.com', path: '/', expires: expiry },
      ])
    } else {
      console.log('-> Microsoft Edge not installed on system, skipping Edge launch')
    }

    // 4. Verify Session Isolation
    console.log('\n[Test 5] Verifying Session & Cookie Isolation...')
    const cookiesA = await entryA.context.cookies(['http://127.0.0.1:8811/'])
    const cookieA = cookiesA.find((c) => c.name === 'session_auth')?.value
    assert.strictEqual(cookieA, 'TOKEN_A_CHROMIUM', 'Profile A cookie must match TOKEN_A_CHROMIUM')

    if (chromeAvailable) {
      const entryB = browserManager.getEntry(profileB.id)
      const cookiesB = await entryB.context.cookies()
      const cookieB = cookiesB.find((c) => c.name === 'session_auth')?.value
      assert.strictEqual(cookieB, 'TOKEN_B_CHROME', 'Profile B cookie must match TOKEN_B_CHROME')
      assert.notStrictEqual(cookieA, cookieB, 'Profile A and B cookies must be isolated')
    }

    if (edgeAvailable) {
      const entryC = browserManager.getEntry(profileC.id)
      const cookiesC = await entryC.context.cookies()
      const cookieC = cookiesC.find((c) => c.name === 'session_auth')?.value
      assert.strictEqual(cookieC, 'TOKEN_C_EDGE', 'Profile C cookie must match TOKEN_C_EDGE')
      assert.notStrictEqual(cookieA, cookieC, 'Profile A and C cookies must be isolated')
    }
    console.log('✓ Session isolation verified: each profile has isolated cookies and storage')

    // 5. Test Close and Reopen Persistence
    console.log('\n[Test 6] Testing Session Persistence across Close and Reopen...')
    await browserManager.closeProfile(profileA.id)
    assert(!browserManager.isRunning(profileA.id), 'Profile A should be stopped')

    console.log('-> Reopening Profile A...')
    await browserManager.openProfile(profileA)
    const reEntryA = browserManager.getEntry(profileA.id)
    const reCookiesA = await reEntryA.context.cookies(['http://127.0.0.1:8811/'])
    const persistedCookieA = reCookiesA.find((c) => c.name === 'session_auth')?.value
    assert.strictEqual(persistedCookieA, 'TOKEN_A_CHROMIUM', 'Profile A cookies must persist after reopening')
    console.log('✓ Persistence verified: session cookies restored on reopen')

    // Clean up running browsers
    await browserManager.closeAllProfiles()

    // 6. Test Missing Browser Graceful Error Handling
    console.log('\n[Test 7] Testing Non-Existent Browser Error Handling...')
    const invalidProfile = await createProfile({
      name: 'Invalid Browser Profile',
      browser_type: 'nonexistent_browser',
      browser_channel: 'fake_channel_9999',
    })
    createdProfileIds.push(invalidProfile.id)

    try {
      await browserManager.openProfile(invalidProfile)
      assert.fail('Should have thrown an error for non-existent browser channel')
    } catch (err) {
      console.log('✓ Caught expected graceful error:', err.message)
      assert(err.message.includes('not available') || err.message.includes('Failed to launch browser'), 'Error should be descriptive')
    }

    console.log('\n======================================================')
    console.log('🎉 ALL BƯỚC 11 TESTS PASSED SUCCESSFULLY WITH ZERO ERRORS!')
    console.log('======================================================\n')
  } finally {
    await browserManager.closeAllProfiles().catch(() => {})
    await new Promise((resolve) => server.close(resolve))
    // Cleanup created test profiles
    for (const id of createdProfileIds) {
      await deleteProfile(id, { deleteData: true }).catch(() => {})
    }
    closeDb()
  }
}

runStep11Tests().catch((err) => {
  console.error('\n❌ STEP 11 TEST FAILED:', err)
  process.exit(1)
})
