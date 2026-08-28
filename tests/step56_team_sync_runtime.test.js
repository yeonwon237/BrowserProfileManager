const assert = require('assert')
const os = require('os')
const path = require('path')
const fs = require('fs')

process.env.APPDATA = path.join(os.tmpdir(), `ynlogin-team-sync-runtime-${Date.now()}`)
process.env.NODE_ENV = 'test'

const settings = require('../src/main/settings')
const profiles = require('../src/main/database/profiles')
const { TeamSyncRuntime } = require('../src/main/sync/runtime')
const { closeDb } = require('../src/main/database')

async function run() {
  const local = await profiles.createProfile({ name: 'Local Sync Profile', workspace_id: 'default' })
  let receivedOptions
  const runtime = new TeamSyncRuntime({ providerFactory: (options) => {
    receivedOptions = options
    return { async syncConfigurations(records) {
      assert.strictEqual(records.length, 1)
      return { success: true, mode: 'encrypted-cloud', syncedCount: 1, receivedCount: 2, cursor: 'cursor-2', conflicts: [], records: [
        { ...records[0], name: 'Remote Updated', revision: 2 },
        { id: 'remote-new', name: 'Remote New', workspace_id: 'default', revision: 1, tags: [] },
      ] }
    } }
  } })
  await assert.rejects(() => runtime.configure({ endpoint: 'http://insecure.test', secret: '1234567890123456' }), /HTTPS/)
  const configured = await runtime.configure({ endpoint: 'https://sync.example.test/exchange', secret: '1234567890123456', bearerToken: 'service-token' })
  assert.strictEqual(configured.configured, true)
  const storedSecret = await settings.getSetting('teamSync.default.secret')
  assert(!storedSecret.includes('1234567890123456'), 'workspace secret must not be stored in plaintext')
  const result = await runtime.syncNow('default')
  assert.strictEqual(result.appliedCount, 2)
  assert.strictEqual(receivedOptions.secret, '1234567890123456')
  assert.strictEqual((await profiles.getProfileById(local.id)).name, 'Remote Updated')
  assert.strictEqual((await profiles.getProfileById('remote-new')).name, 'Remote New')
  const status = await runtime.getStatus('default')
  assert(status.hasCursor && status.lastSyncAt)
  closeDb(); fs.rmSync(process.env.APPDATA, { recursive: true, force: true })
  console.log('✓ Runtime Team Sync securely configures, reconciles revisions and persists cursor without exposing secrets')
}

run().catch((error) => { closeDb(); console.error(error); process.exit(1) })
