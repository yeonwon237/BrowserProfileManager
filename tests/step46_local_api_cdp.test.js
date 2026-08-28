const assert = require('assert')
const path = require('path')
const os = require('os')
const { chromium } = require('playwright')

process.env.APPDATA = path.join(os.tmpdir(), `ynlogin-cdp-test-${Date.now()}`)
process.env.NODE_ENV = 'test'

const localApi = require('../src/main/api/server')
const profiles = require('../src/main/database/profiles')
const binaryManager = require('../src/main/browser/binaryManager')
const browserManager = require('../src/main/browser/manager')
const { closeDb } = require('../src/main/database')

async function run() {
  await binaryManager.scanBrowsers({ probeVersions: false })
  const profile = await profiles.createProfile({ name: 'API CDP Profile', browser_type: 'chromium' })
  const status = await localApi.start({ port: 53146 })
  const token = await localApi.revealToken()
  const response = await fetch(`http://127.0.0.1:${status.port}/api/v1/profiles/${profile.id}/start`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ headless: true, automation: true }),
  })
  const started = await response.json()
  assert.strictEqual(response.status, 200, JSON.stringify(started))
  assert(started.connection?.webSocketDebuggerUrl)
  assert(started.connection.webSocketDebuggerUrl.startsWith('ws://127.0.0.1:'))

  const client = await chromium.connectOverCDP(started.connection.webSocketDebuggerUrl)
  assert(client.contexts().length >= 1)
  await client.close()

  await browserManager.closeProfile(profile.id).catch(() => {})
  await profiles.deleteProfile(profile.id, { deleteData: true })
  await localApi.stop()
  closeDb()
  console.log('✓ REST profile start returns a working loopback CDP WebSocket endpoint')
}

run().catch(async (err) => {
  await browserManager.closeAllProfiles().catch(() => {})
  await localApi.stop().catch(() => {})
  closeDb()
  console.error(err)
  process.exit(1)
})
