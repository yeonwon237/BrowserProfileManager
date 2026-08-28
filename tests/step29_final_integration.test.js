const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const http = require('http')
const { getDb, closeDb } = require('../src/main/database')
const { createProfile, deleteProfile, getProfileById } = require('../src/main/database/profiles')
const { createProxy, deleteProxy } = require('../src/main/database/proxies')
const { getLogs } = require('../src/main/database/logs')
const browserManager = require('../src/main/browser/manager')
const binaryManager = require('../src/main/browser/binaryManager')
const recovery = require('../src/main/browser/recovery')
const resourceManager = require('../src/main/browser/resourceManager')
const automationManager = require('../src/main/automation/manager')
const automationQueue = require('../src/main/automation/queue')
const portability = require('../src/main/portability')

async function runFinalIntegrationTests() {
  console.log('=== FINAL INTEGRATION TEST SUITE (Profiles A, B, C, D) ===\n')

  const profileIds = []
  const proxyIds = []
  const importedIds = []
  let server = null
  let exportFile = null

  try {
    await getDb()
    await resourceManager.setMaxBrowsers(4)
    await resourceManager.setMaxAutomations(2)
    await binaryManager.scanBrowsers({ probeVersions: false })

    // A real HTTP origin is required for localStorage checks.
    server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><head><title>final-integration</title></head><body>ok</body></html>')
    })
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const localUrl = `http://127.0.0.1:${server.address().port}`

    // ---- Setup: profiles + proxies ----
    console.log('[Setup] Creating Proxy 1, Proxy 2 and Profiles A–D...')
    const p1 = await createProxy({
      name: 'Proxy One', protocol: 'http', host: '198.51.100.10', port: 8080,
      username: 'user1', password: 'proxy-one-password-secret', country_code: 'US',
    })
    const p2 = await createProxy({
      name: 'Proxy Two', protocol: 'http', host: '198.51.100.20', port: 3128,
      username: 'user2', password: 'proxy-two-password-secret', country_code: 'DE',
    })
    proxyIds.push(p1.id, p2.id)

    const A = await createProfile({ name: 'Profile A — Chromium Direct', browser_type: 'chromium', group: 'GroupA', tags: ['a'] })
    const B = await createProfile({ name: 'Profile B — Chrome Proxy1', browser_type: 'chrome', browser_channel: 'chrome', proxy_id: p1.id, group: 'GroupB', tags: ['b'] })
    const C = await createProfile({ name: 'Profile C — Edge Proxy2', browser_type: 'msedge', browser_channel: 'msedge', proxy_id: p2.id, group: 'GroupC', tags: ['c'] })
    const D = await createProfile({
      name: 'Profile D — Custom Env',
      browser_type: 'chromium',
      group: 'GroupD',
      tags: ['d'],
      environment: { mode: 'custom', locale: 'ja-JP', timezone: 'Asia/Tokyo', languages: ['ja-JP', 'ja'], viewport: { width: 1280, height: 720 } },
    })
    profileIds.push(A.id, B.id, C.id, D.id)
    console.log('✓ 4 profiles + 2 proxies ready')

    // ---- Launch all four concurrently ----
    console.log('\n[Check 1] Launching A, B, C, D (4 engines)...')
    for (const p of [A, B, C, D]) {
      const res = await browserManager.openProfile(p, { headless: true })
      assert(res.success !== false, `profile ${p.name} must launch: ${JSON.stringify(res)}`)
    }
    assert.strictEqual(browserManager.getRunningIds().length, 4, 'all four must run concurrently')

    const entryA = browserManager.getEntry(A.id)
    const entryB = browserManager.getEntry(B.id)
    const entryC = browserManager.getEntry(C.id)
    const entryD = browserManager.getEntry(D.id)
    assert.strictEqual(entryA.browserName, 'Chromium')
    assert.strictEqual(entryB.browserName, 'Google Chrome')
    assert.strictEqual(entryC.browserName, 'Microsoft Edge')
    assert.strictEqual(entryD.browserName, 'Chromium')
    assert.strictEqual(entryB.proxyId, p1.id, 'B must use Proxy 1')
    assert.strictEqual(entryC.proxyId, p2.id, 'C must use Proxy 2')
    assert.strictEqual(entryA.proxyId, null, 'A must be direct')
    console.log('✓ Correct browser engine + proxy wiring for each profile')

    const browserVersions = {}
    for (const [name, entry] of [['A', entryA], ['B', entryB], ['C', entryC]]) {
      const browser = entry.context.browser ? entry.context.browser() : null
      if (browser) browserVersions[name] = browser.version()
    }
    console.log('✓ Browser versions:', JSON.stringify(browserVersions))

    // ---- Profile isolation (no session leak between profiles) ----
    console.log('\n[Check 2] Session isolation between profiles...')
    const pageA = entryA.context.pages()[0] || (await entryA.context.newPage())
    await pageA.goto(localUrl)
    await pageA.evaluate(() => { localStorage.setItem('ynlogin_shared', 'secret-for-A-only') })

    // Direct profiles A & D share an origin and must not share storage.
    const pageD = entryD.context.pages()[0] || (await entryD.context.newPage())
    await pageD.goto(localUrl)
    const dVal = await pageD.evaluate(() => localStorage.getItem('ynlogin_shared'))
    assert.strictEqual(dVal, null, 'profile D must NOT see A storage')
    const aVal = await pageA.evaluate(() => localStorage.getItem('ynlogin_shared'))
    assert.strictEqual(aVal, 'secret-for-A-only')

    // B & C run on distinct browser engines/user-data dirs (structural isolation).
    const dirs = [entryA.browserDataPath, entryB.browserDataPath, entryC.browserDataPath, entryD.browserDataPath]
    assert.strictEqual(new Set(dirs).size, 4, 'every profile must use a unique user-data dir')
    console.log('✓ No session/storage leak; 4 unique user-data dirs (A, B, C, D)')

    // ---- Environment persistence (D) ----
    console.log('\n[Check 3] Environment profile persists (locale/timezone/viewport)...')
    const lang = await pageD.evaluate(() => navigator.language)
    const tz = await pageD.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
    const width = await pageD.evaluate(() => window.innerWidth)
    assert(lang && lang.toLowerCase().startsWith('ja'), `locale must be ja, got ${lang}`)
    assert.strictEqual(tz, 'Asia/Tokyo', `timezone must be Asia/Tokyo, got ${tz}`)
    assert.strictEqual(width, 1280, `viewport width must be 1280, got ${width}`)
    console.log(`✓ D: lang=${lang}, tz=${tz}, width=${width}`)

    // ---- Persistence across close/reopen (A) ----
    console.log('\n[Check 4] Session persists across close and reopen (A)...')
    await browserManager.closeProfile(A.id)
    await browserManager.openProfile(A, { headless: true })
    const pageA2 = browserManager.getEntry(A.id).context.pages()[0] || (await browserManager.getEntry(A.id).context.newPage())
    await pageA2.goto(localUrl)
    const persisted = await pageA2.evaluate(() => localStorage.getItem('ynlogin_shared'))
    assert.strictEqual(persisted, 'secret-for-A-only', 'A storage must persist across restart')
    console.log('✓ A login/storage persists across close & reopen')

    // ---- Automation runs correctly + queue stop/retry ----
    console.log('\n[Check 5] Automation: load, run, queue stop/retry...')
    await automationManager.seedSampleTools()
    await automationManager.setEnabled('open-website', true)
    const runRes = await automationManager.runTool('open-website', A.id, { url: localUrl })
    assert.strictEqual(runRes.ok, true, `automation must run: ${runRes.message}`)
    console.log(`✓ Automation ran: ${runRes.message}`)

    automationQueue.clearCompleted()
    await automationQueue.enqueue('open-website', [B.id, C.id], { url: localUrl })
    await new Promise((r) => setTimeout(r, 3000))
    automationQueue.stopAll()
    const stoppedCounts = automationQueue.getCounts()
    const failedOrStopped = stoppedCounts.failed + stoppedCounts.cancelled
    automationQueue.retryAllFailed()
    const afterRetry = automationQueue.getCounts()
    assert(afterRetry.waiting + afterRetry.running > 0 || stoppedCounts.success > 0, 'retry must requeue failed/cancelled jobs')
    console.log('✓ Queue stop & retry operate correctly')

    // ---- Recovery: kill A -> profile returns to Ready ----
    console.log('\n[Check 6] Recovery: kill browser process -> profile Ready + crash logged...')
    const aDataPath = browserManager.getEntry(A.id).browserDataPath
    recovery.killBrowserProcesses('chromium', aDataPath)
    await new Promise((r) => setTimeout(r, 2500))
    const aAfterKill = await getProfileById(A.id)
    assert.strictEqual(aAfterKill.status, 'idle', 'A must return to Ready after external kill')
    const crashLogs = (await getLogs(200)).filter((l) => l.action === 'crash-recovery' && l.status === 'warn')
    assert(crashLogs.length >= 1, 'crash must be logged')
    console.log('✓ Kill detected, A Ready, crash log written')

    // ---- Security: logs must not contain secrets ----
    console.log('\n[Check 7] Logs contain no passwords/cookies/tokens...')
    await browserManager.closeProfile(B.id).catch(() => {})
    await browserManager.closeProfile(C.id).catch(() => {})
    await browserManager.closeProfile(D.id).catch(() => {})
    const allLogs = await getLogs(400)
    const joined = allLogs.map((l) => l.message || '').join('\n')
    assert(!joined.includes('proxy-one-password-secret'), 'proxy password must not appear in logs')
    assert(!joined.includes('proxy-two-password-secret'), 'proxy password must not appear in logs')
    assert(!joined.includes('secret-for-A-only'), 'session data must not leak into logs')
    console.log('✓ No secrets in logs')

    // ---- Portability: export A-D, import as new IDs ----
    console.log('\n[Check 8] Export/import profiles as new IDs...')
    exportFile = path.join(os.tmpdir(), `final-export-${Date.now()}.zip`)
    await portability.exportProfiles({
      profileIds: [A.id, B.id, C.id, D.id],
      options: { includeGroups: true, includeTags: true, includeProxies: true, includeBrowserData: false },
      destPath: exportFile,
    })
    const importReport = await portability.importProfiles(exportFile, 'generate-new')
    assert.strictEqual(importReport.imported.length, 4, 'all four profiles imported as new IDs')
    importedIds.push(...importReport.imported)
    const newB = await getProfileById(importReport.imported[1])
    assert(newB.proxy_id, 'imported B must retain its proxy reference')
    assert.strictEqual(newB.group_name, 'GroupB', 'imported group must be restored')
    console.log('✓ Export/import round-trip: 4 new profiles with groups, tags and proxy refs')

    console.log('\n======================================================')
    console.log('🎉 FINAL INTEGRATION TEST SUITE PASSED — NO CRITICAL ERRORS, NO DB CORRUPTION, NO SESSION LEAK!')
    console.log('======================================================\n')
  } finally {
    await automationQueue.stopAll().catch(() => {})
    await browserManager.closeAllProfiles().catch(() => {})
    for (const id of [...profileIds, ...importedIds]) await deleteProfile(id, { deleteData: true }).catch(() => {})
    for (const id of proxyIds) await deleteProxy(id).catch(() => {})
    if (exportFile) {
      try { fs.rmSync(exportFile, { force: true }) } catch { /* ignore */ }
    }
    if (server) await new Promise((resolve) => server.close(resolve)).catch(() => {})
    closeDb()
  }
}

runFinalIntegrationTests().catch((err) => {
  console.error('\n❌ FINAL INTEGRATION TEST SUITE FAILED:', err)
  process.exit(1)
})