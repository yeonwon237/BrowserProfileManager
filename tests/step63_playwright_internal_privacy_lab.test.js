const assert = require('assert')
const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')

const appData = fs.mkdtempSync(path.join(os.tmpdir(), 'ynlogin-step63-'))
process.env.APPDATA = appData
process.env.NODE_ENV = 'test'

const profiles = require('../src/main/database/profiles')
const adapter = require('../src/main/browser/adapter')
const { captureFingerprintSnapshot, compareFingerprintSnapshots } = require('../src/main/browser/persistenceAudit')
const { auditCrossProfileCollisions } = require('../src/main/browser/collisionAudit')
const { closeDb } = require('../src/main/database')

function startFixture() {
  const server = http.createServer((req, res) => {
    if (req.url === '/sw.js') {
      res.writeHead(200, { 'content-type': 'application/javascript', 'service-worker-allowed': '/' })
      return res.end("self.addEventListener('install', event => self.skipWaiting()); self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));")
    }
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end('<!doctype html><title>YNlogin Internal Privacy Lab</title><canvas id="canvas" width="160" height="60"></canvas>')
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

async function seedStorage(page, value) {
  await page.evaluate(async (input) => {
    localStorage.setItem('owner', input)
    const cache = await caches.open('profile-private-cache')
    await cache.put('/private-value', new Response(input))
    await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
  }, value)
}

async function readStorage(page) {
  return page.evaluate(async () => {
    const cache = await caches.open('profile-private-cache')
    const cached = await cache.match('/private-value')
    return {
      local: localStorage.getItem('owner'),
      cached: cached ? await cached.text() : null,
      workers: (await navigator.serviceWorker.getRegistrations()).length,
    }
  })
}

async function run() {
  const server = await startFixture()
  const origin = `http://127.0.0.1:${server.address().port}`
  const a = await profiles.createProfile({ name: 'Privacy Lab A', browser_type: 'chromium', environment: { mode: 'custom', locale: 'en-US', timezone: 'America/New_York' } })
  const b = await profiles.createProfile({ name: 'Privacy Lab B', browser_type: 'chromium', environment: { mode: 'custom', locale: 'ja-JP', timezone: 'Asia/Tokyo' } })
  let launchA = await adapter.launchContext(a, { headless: true })
  let launchB = await adapter.launchContext(b, { headless: true })
  try {
    const collision = auditCrossProfileCollisions([a, b], [{ profileId: a.id, context: launchA.context }, { profileId: b.id, context: launchB.context }])
    assert.strictEqual(collision.status, 'Healthy')
    const pageA = launchA.context.pages()[0] || await launchA.context.newPage()
    const pageB = launchB.context.pages()[0] || await launchB.context.newPage()
    await Promise.all([pageA.goto(origin), pageB.goto(origin)])
    await seedStorage(pageA, 'A-only')
    const bBefore = await readStorage(pageB)
    assert.strictEqual(bBefore.local, null)
    assert.strictEqual(bBefore.cached, null)
    assert.strictEqual(bBefore.workers, 0)
    await seedStorage(pageB, 'B-only')
    assert.deepStrictEqual(await readStorage(pageA), { local: 'A-only', cached: 'A-only', workers: 1 })
    assert.deepStrictEqual(await readStorage(pageB), { local: 'B-only', cached: 'B-only', workers: 1 })

    const first = await captureFingerprintSnapshot(pageA)
    await launchA.context.close()
    launchA = null
    const reopened = await adapter.launchContext(a, { headless: true })
    try {
      const reopenedPage = reopened.context.pages()[0] || await reopened.context.newPage()
      await reopenedPage.goto(origin)
      const second = await captureFingerprintSnapshot(reopenedPage)
      assert.strictEqual(compareFingerprintSnapshots(first, second).stable, true)
      assert.deepStrictEqual(await readStorage(reopenedPage), { local: 'A-only', cached: 'A-only', workers: 1 })
    } finally { await reopened.context.close() }
  } finally {
    if (launchA) await launchA.context.close().catch(() => {})
    await launchB.context.close().catch(() => {})
    server.close()
    closeDb()
    fs.rmSync(appData, { recursive: true, force: true })
  }
  console.log('✓ Playwright internal privacy lab verified profile isolation, Cache Storage, Service Worker and restart fingerprint stability')
}

run().catch((error) => { console.error(error); closeDb(); fs.rmSync(appData, { recursive: true, force: true }); process.exit(1) })
