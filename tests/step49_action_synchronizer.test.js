const assert = require('assert')
const path = require('path')
const os = require('os')

process.env.APPDATA = path.join(os.tmpdir(), `ynlogin-action-sync-${Date.now()}`)
process.env.NODE_ENV = 'test'

const sync = require('../src/main/browser/actionSynchronizer')
const browserManager = require('../src/main/browser/manager')
const binaryManager = require('../src/main/browser/binaryManager')
const profiles = require('../src/main/database/profiles')
const settings = require('../src/main/settings')
const { closeDb } = require('../src/main/database')

async function run() {
  assert.strictEqual(sync.isSensitiveDescriptor({ type: 'password' }), true)
  assert.strictEqual(sync.isSensitiveDescriptor({ name: 'otp_code' }), true)
  assert.strictEqual(sync.validateEvent({ type: 'input', selector: '#password', value: 'secret', descriptor: { id: 'password' } }), false)
  assert.strictEqual(sync.validateEvent({ type: 'input', selector: '#search', value: 'hello', descriptor: { id: 'search' } }), true)

  const applied = []
  const fakePage = {
    mouse: {
      move: async (x, y) => applied.push(['mouseMove', Math.round(x), Math.round(y)]),
      down: async () => applied.push(['mouseDown']),
      up: async () => applied.push(['mouseUp']),
    },
    keyboard: {
      type: async (value) => applied.push(['type', value]),
      press: async () => {},
    },
    locator: (_selector) => ({ first: () => ({
      boundingBox: async () => ({ x: 10, y: 10, width: 100, height: 30 }),
    }) }),
    evaluate: async (fn, event) => {
      const fnStr = String(fn)
      if (fnStr.includes('innerWidth')) return { x: 400, y: 300 }
      if (fnStr.includes('scrollY')) return 0
      applied.push(['scroll', event && event.x, event && event.y])
      return 0
    },
  }
  await sync.applyEvent(fakePage, { type: 'click', selector: '#go' })
  await sync.applyEvent(fakePage, { type: 'input', selector: '#search', value: 'query', descriptor: {} })
  await sync.applyEvent(fakePage, { type: 'scroll', x: 0, y: 300 })
  // Actions must now be replayed through the Human Behavioral engine rather
  // than raw DOM calls: mouse kinematics for clicks, keyboard cadence for input.
  assert(applied.some((entry) => entry[0] === 'mouseMove'), 'click must be replayed via humanized mouse movement')
  assert(applied.some((entry) => entry[0] === 'mouseDown') && applied.some((entry) => entry[0] === 'mouseUp'), 'click must dispatch humanized mouse down/up')
  assert(applied.filter((entry) => entry[0] === 'type').map((entry) => entry[1]).join('') === 'query', 'input must be replayed via human keyboard typing')
  assert(applied.some((entry) => entry[0] === 'scroll'), 'scroll must be replayed through the human scroll engine')

  await binaryManager.scanBrowsers({ probeVersions: false })
  // This test owns the document contents. Disable the normal IPhey homepage so
  // its asynchronous first navigation cannot destroy the setContent context.
  await settings.setSetting('browser.homepageEnabled', 'false')
  const master = await profiles.createProfile({ name: 'Sync Master', browser_type: 'chromium' })
  const worker = await profiles.createProfile({ name: 'Sync Worker', browser_type: 'chromium' })
  await browserManager.openProfile(master, { headless: true, windowLayout: false })
  await browserManager.openProfile(worker, { headless: true, windowLayout: false })
  const masterPage = browserManager.getEntry(master.id).context.pages()[0]
  const workerPage = browserManager.getEntry(worker.id).context.pages()[0]
  const html = '<input id="search"><input id="password" type="password"><button id="go" onclick="document.body.dataset.clicked=\'yes\'">Go</button>'
  await masterPage.setContent(html); await workerPage.setContent(html)
  const session = await sync.start(master.id, [worker.id])
  await masterPage.click('#go')
  await workerPage.waitForFunction(() => document.body.dataset.clicked === 'yes')
  await masterPage.fill('#search', 'semantic sync')
  await workerPage.waitForFunction(() => document.querySelector('#search').value === 'semantic sync')
  await masterPage.fill('#password', 'must-not-sync')
  await new Promise((resolve) => setTimeout(resolve, 250))
  assert.strictEqual(await workerPage.inputValue('#password'), '')
  assert((sync.status(session.id)?.eventCount || 0) >= 2)
  sync.stopAll()

  await browserManager.closeAllProfiles()
  await profiles.deleteProfile(master.id, { deleteData: true })
  await profiles.deleteProfile(worker.id, { deleteData: true })
  closeDb()
  console.log('✓ Semantic click/input sync works end-to-end and sensitive fields are excluded')
}

run().catch(async (err) => { sync.stopAll(); await browserManager.closeAllProfiles().catch(() => {}); closeDb(); console.error(err); process.exit(1) })
