const assert = require('assert')
const fs = require('fs')
const path = require('path')
const http = require('http')
const { getDb, closeDb } = require('../src/main/database')
const { createProfile, getProfileById, deleteProfile } = require('../src/main/database/profiles')
const browserManager = require('../src/main/browser/manager')
const { createProxy, deleteProxy, getProxyConfig } = require('../src/main/database/proxies')
const { getProfileDownloadsPath, getProfileTempPath } = require('../src/shared/paths')

async function runStep20Tests() {
  console.log('=== STARTING BƯỚC 20: STRICT PROFILE ISOLATION TESTS ===\n')

  let createdProfileIds = []
  let createdProxyIds = []
  let server = null
  let cacheRequestCount = 0

  try {
    // 1. Create Profile Alpha & Profile Beta with Distinct Custom Environments
    console.log('[Test 1] Creating Profile Alpha & Profile Beta...')
    const alphaProfile = await createProfile({
      name: 'Isolation Profile Alpha',
      browser_type: 'chromium',
      environment: {
        mode: 'custom',
        locale: 'ja-JP',
        timezone: 'Asia/Tokyo',
        colorScheme: 'dark',
        viewport: { width: 1280, height: 720 },
      },
    })

    const betaProfile = await createProfile({
      name: 'Isolation Profile Beta',
      browser_type: 'chromium',
      environment: {
        mode: 'custom',
        locale: 'fr-FR',
        timezone: 'Europe/Paris',
        colorScheme: 'light',
        viewport: { width: 1024, height: 768 },
      },
    })

    createdProfileIds.push(alphaProfile.id, betaProfile.id)

    assert.notStrictEqual(alphaProfile.id, betaProfile.id, 'Profiles must have distinct IDs')
    assert.notStrictEqual(
      alphaProfile.browser_data_path,
      betaProfile.browser_data_path,
      'Profiles must have strictly partitioned user_data_dir paths'
    )
    console.log('Alpha UserDataDir:', alphaProfile.browser_data_path)
    console.log('Beta UserDataDir:', betaProfile.browser_data_path)
    console.log('✓ Distinct user-data-dir storage paths verified')

    // 2. Test Parallel Launch of Multiple Profiles
    console.log('\n[Test 2] Launching Profile Alpha & Profile Beta concurrently...')
    await browserManager.openProfile(alphaProfile, { headless: true })
    await browserManager.openProfile(betaProfile, { headless: true })

    const alphaEntry = browserManager.getEntry(alphaProfile.id)
    const betaEntry = browserManager.getEntry(betaProfile.id)

    assert(alphaEntry && alphaEntry.context, 'Profile Alpha context must be running')
    assert(betaEntry && betaEntry.context, 'Profile Beta context must be running')
    assert.strictEqual(browserManager.getRunningIds().length, 2, 'Both profiles must run concurrently')
    console.log('✓ Multiple profiles launched and running in parallel')

    // 3. Test Storage, Cookies, LocalStorage, and IndexedDB Partitioning
    console.log('\n[Test 3] Testing Cookies, LocalStorage & IndexedDB Isolation...')
    const alphaPage = alphaEntry.context.pages()[0] || (await alphaEntry.context.newPage())
    const betaPage = betaEntry.context.pages()[0] || (await betaEntry.context.newPage())

    server = http.createServer((req, res) => {
      if (req.url === '/sw.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript', 'Service-Worker-Allowed': '/' })
        res.end("self.addEventListener('install', () => self.skipWaiting()); self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))")
        return
      }
      if (req.url === '/download') {
        res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Disposition': 'attachment; filename="isolation.txt"' })
        res.end('isolated download')
        return
      }
      if (req.url === '/cached-resource') {
        cacheRequestCount += 1
        res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=3600' })
        res.end(`cache-value-${cacheRequestCount}`)
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body>Isolation test</body></html>')
    })
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    // Chromium treats localhost as a trustworthy origin for Cache API and
    // service workers; an arbitrary loopback IP is not consistent across channels.
    const origin = `http://localhost:${server.address().port}`

    // Populate storage in Profile Alpha
    await alphaPage.goto(origin)
    await alphaPage.evaluate(async () => {
      localStorage.setItem('auth_session_token', 'alpha_secret_token_11111')
      localStorage.setItem('profile_owner', 'Alpha User')
      sessionStorage.setItem('temp_state', 'alpha_temp_state')
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('profile-private-db', 1)
        request.onupgradeneeded = () => request.result.createObjectStore('secrets')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      await new Promise((resolve, reject) => {
        const tx = db.transaction('secrets', 'readwrite')
        tx.objectStore('secrets').put('alpha_indexeddb_secret', 'owner')
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
      })
      await navigator.serviceWorker.register('/sw.js')
    })
    await alphaEntry.context.addCookies([
      { name: 'session_cookie', value: 'alpha_cookie_value_123', url: origin },
    ])

    // Populate storage in Profile Beta
    await betaPage.goto(origin)
    const betaBefore = await betaPage.evaluate(async () => ({
      dbs: (await indexedDB.databases()).map((item) => item.name),
      workers: (await navigator.serviceWorker.getRegistrations()).length,
    }))
    assert(!betaBefore.dbs.includes('profile-private-db'), 'Beta must not see Alpha IndexedDB')
    assert.strictEqual(betaBefore.workers, 0, 'Beta must not see Alpha service worker')

    await betaPage.evaluate(async () => {
      localStorage.setItem('auth_session_token', 'beta_secret_token_99999')
      localStorage.setItem('profile_owner', 'Beta User')
      sessionStorage.setItem('temp_state', 'beta_temp_state')
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('profile-private-db', 1)
        request.onupgradeneeded = () => request.result.createObjectStore('secrets')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      await new Promise((resolve, reject) => {
        const tx = db.transaction('secrets', 'readwrite')
        tx.objectStore('secrets').put('beta_indexeddb_secret', 'owner')
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
      })
      await navigator.serviceWorker.register('/sw.js')
    })
    await betaEntry.context.addCookies([
      { name: 'session_cookie', value: 'beta_cookie_value_789', url: origin },
    ])


    // Verify storage in Profile Alpha
    const alphaStorage = await alphaPage.evaluate(() => ({
      token: localStorage.getItem('auth_session_token'),
      owner: localStorage.getItem('profile_owner'),
      temp: sessionStorage.getItem('temp_state'),
    }))
    const alphaCookies = await alphaEntry.context.cookies()
    const alphaSessionCookie = alphaCookies.find((c) => c.name === 'session_cookie')

    assert.strictEqual(alphaStorage.token, 'alpha_secret_token_11111')
    assert.strictEqual(alphaStorage.owner, 'Alpha User')
    assert.strictEqual(alphaSessionCookie?.value, 'alpha_cookie_value_123')

    // Verify storage in Profile Beta
    const betaStorage = await betaPage.evaluate(() => ({
      token: localStorage.getItem('auth_session_token'),
      owner: localStorage.getItem('profile_owner'),
      temp: sessionStorage.getItem('temp_state'),
    }))
    const betaCookies = await betaEntry.context.cookies()
    const betaSessionCookie = betaCookies.find((c) => c.name === 'session_cookie')

    assert.strictEqual(betaStorage.token, 'beta_secret_token_99999')
    assert.strictEqual(betaStorage.owner, 'Beta User')
    assert.strictEqual(betaSessionCookie?.value, 'beta_cookie_value_789')

    // Strict Partition assertion: neither can see the other's storage
    assert.notStrictEqual(alphaStorage.token, betaStorage.token)
    assert.notStrictEqual(alphaSessionCookie.value, betaSessionCookie.value)
    const advancedStorage = async (page) => page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('profile-private-db', 1)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const indexedValue = await new Promise((resolve, reject) => {
        const request = db.transaction('secrets').objectStore('secrets').get('owner')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      return { indexedValue, workers: (await navigator.serviceWorker.getRegistrations()).length }
    })
    const alphaAdvanced = await advancedStorage(alphaPage)
    const betaAdvanced = await advancedStorage(betaPage)
    assert.strictEqual(alphaAdvanced.indexedValue, 'alpha_indexeddb_secret')
    assert.strictEqual(betaAdvanced.indexedValue, 'beta_indexeddb_secret')
    assert.strictEqual(alphaAdvanced.workers, 1)
    assert.strictEqual(betaAdvanced.workers, 1)
    const alphaCacheFirst = await alphaPage.evaluate(() => fetch('/cached-resource').then((r) => r.text()))
    const alphaCacheSecond = await alphaPage.evaluate(() => fetch('/cached-resource').then((r) => r.text()))
    assert.strictEqual(alphaCacheSecond, alphaCacheFirst, 'Alpha must reuse its own HTTP cache')
    assert.strictEqual(cacheRequestCount, 1, 'Alpha second request must be served from its cache')
    const betaCacheFirst = await betaPage.evaluate(() => fetch('/cached-resource').then((r) => r.text()))
    assert.notStrictEqual(betaCacheFirst, alphaCacheFirst, 'Beta must not reuse Alpha HTTP cache')
    assert.strictEqual(cacheRequestCount, 2, 'Beta must create an independent cache entry')
    console.log('✓ 100% strict storage & cookie partition confirmed (Zero data leak between Profile Alpha & Beta)')

    // 4. Test Downloads and Temp Directories Isolation
    console.log('\n[Test 4] Testing Downloads & Temp Directories Isolation...')
    const alphaDownloads = getProfileDownloadsPath(alphaProfile.id)
    const betaDownloads = getProfileDownloadsPath(betaProfile.id)
    const alphaTemp = getProfileTempPath(alphaProfile.id)
    const betaTemp = getProfileTempPath(betaProfile.id)

    assert.notStrictEqual(alphaDownloads, betaDownloads, 'Downloads paths must be separate')
    assert.notStrictEqual(alphaTemp, betaTemp, 'Temp paths must be separate')

    // Write artifact to Alpha Temp
    const alphaTempFile = path.join(alphaTemp, 'alpha_private_file.txt')
    fs.writeFileSync(alphaTempFile, 'private alpha content', 'utf8')

    // Assert Beta Temp does not have it
    const betaTempFile = path.join(betaTemp, 'alpha_private_file.txt')
    assert.strictEqual(fs.existsSync(betaTempFile), false, 'Beta temp directory must not contain Alpha private files')

    const [alphaDownload] = await Promise.all([
      alphaPage.waitForEvent('download'),
      alphaPage.evaluate((url) => {
        const link = document.createElement('a')
        link.href = url
        link.click()
      }, `${origin}/download`),
    ])
    const alphaDownloadPath = await alphaDownload.path()
    assert(alphaDownloadPath && path.resolve(alphaDownloadPath).startsWith(path.resolve(alphaDownloads)), 'Alpha download must stay in Alpha directory')
    assert.strictEqual(fs.readdirSync(betaDownloads).length, 0, 'Beta downloads must remain untouched')

    // Clean up temp file
    if (fs.existsSync(alphaTempFile)) fs.unlinkSync(alphaTempFile)
    console.log('✓ Downloads and temp directories strict isolation confirmed')

    // 5. Test Runtime Environment & Identity Isolation Across Parallel Contexts
    console.log('\n[Test 5] Testing Runtime Environment Isolation in Parallel...')
    const alphaRuntime = await alphaPage.evaluate(() => ({
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
    }))

    const betaRuntime = await betaPage.evaluate(() => ({
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
    }))

    console.log('Alpha Runtime -> Lang:', alphaRuntime.language, '| Timezone:', alphaRuntime.timezone, '| Dark:', alphaRuntime.isDark)
    console.log('Beta Runtime  -> Lang:', betaRuntime.language, '| Timezone:', betaRuntime.timezone, '| Dark:', betaRuntime.isDark)

    assert.strictEqual(alphaRuntime.language, 'ja-JP', 'Alpha must have Japanese locale')
    assert.strictEqual(alphaRuntime.timezone, 'Asia/Tokyo', 'Alpha must have Tokyo timezone')
    assert.strictEqual(alphaRuntime.isDark, true, 'Alpha must have dark colorScheme')

    assert.strictEqual(betaRuntime.language, 'fr-FR', 'Beta must have French locale')
    assert.strictEqual(betaRuntime.timezone, 'Europe/Paris', 'Beta must have Paris timezone')
    assert.strictEqual(betaRuntime.isDark, false, 'Beta must have light colorScheme')

    console.log('✓ Parallel environment isolation confirmed: zero cross-contamination')

    // 6. Test Parallel Clean Shutdown & Session Persistence
    console.log('\n[Test 6] Testing Parallel Clean Shutdown & Session Persistence...')
    // Closing Alpha must not terminate or corrupt Beta's independent process/context.
    await browserManager.closeProfile(alphaProfile.id)
    assert(browserManager.isRunning(betaProfile.id), 'Beta must remain running after Alpha closes')
    assert.strictEqual(await betaPage.evaluate(() => localStorage.getItem('profile_owner')), 'Beta User')
    await browserManager.closeProfile(betaProfile.id)
    assert.strictEqual(browserManager.getRunningIds().length, 0, 'All profiles must be closed')

    // Reopen Profile Alpha and verify cookie persistence
    await browserManager.openProfile(alphaProfile, { headless: true })
    const alphaReopenEntry = browserManager.getEntry(alphaProfile.id)
    const reopenedCookies = await alphaReopenEntry.context.cookies()
    const reopenedCookie = reopenedCookies.find((c) => c.name === 'session_cookie')

    assert(reopenedCookie, 'Profile Alpha session cookie must persist across reopen')
    assert.strictEqual(reopenedCookie.value, 'alpha_cookie_value_123', 'Cookie value must match')
    await browserManager.closeProfile(alphaProfile.id)
    console.log('✓ Session persistence on clean shutdown & reopen verified')

    // 7. Proxy credentials/config must remain scoped to their own profile.
    console.log('\n[Test 7] Testing Proxy Credential Isolation...')
    const proxyA = await createProxy({ name: 'Proxy A', host: '127.0.0.1', port: 19001, username: 'alpha-user', password: 'alpha-password' })
    const proxyB = await createProxy({ name: 'Proxy B', host: '127.0.0.1', port: 19002, username: 'beta-user', password: 'beta-password' })
    createdProxyIds.push(proxyA.id, proxyB.id)
    const configA = await getProxyConfig(proxyA.id)
    const configB = await getProxyConfig(proxyB.id)
    assert.strictEqual(configA.username, 'alpha-user')
    assert.strictEqual(configA.password, 'alpha-password')
    assert.strictEqual(configB.username, 'beta-user')
    assert.strictEqual(configB.password, 'beta-password')
    assert(!JSON.stringify(proxyA).includes('alpha-password'), 'Public proxy model must not expose decrypted password')
    assert.notDeepStrictEqual(configA, configB, 'Proxy runtime configurations must be independent')
    console.log('✓ Proxy credential and runtime configuration isolation confirmed')

    console.log('\n======================================================')
    console.log('🎉 ALL BƯỚC 20 TESTS PASSED SUCCESSFULLY WITH ZERO ERRORS!')
    console.log('======================================================\n')
  } finally {
    await browserManager.closeAllProfiles().catch(() => {})
    for (const id of createdProfileIds) {
      await deleteProfile(id, { deleteData: true }).catch(() => {})
    }
    for (const id of createdProxyIds) await deleteProxy(id).catch(() => {})
    if (server) await new Promise((resolve) => server.close(resolve))
    closeDb()
  }
}

runStep20Tests().catch((err) => {
  console.error('\n❌ STEP 20 TEST FAILED:', err)
  process.exit(1)
})
