const assert = require('assert')
const os = require('os')
const path = require('path')
const fs = require('fs')

process.env.APPDATA = path.join(os.tmpdir(), `ynlogin-runtime-lease-${Date.now()}`)
process.env.NODE_ENV = 'test'

const profiles = require('../src/main/database/profiles')
const browserManager = require('../src/main/browser/manager')
const { ProfileLeaseService } = require('../src/main/sync/profileLeases')
const { closeDb } = require('../src/main/database')

async function run() {
  const profile = await profiles.createProfile({ name: 'Runtime Lease Profile' })
  const leases = new ProfileLeaseService()
  const opened = await browserManager.openProfile(profile, { headless: true, skipPrivacyValidation: true })
  assert.strictEqual(opened.success, true)
  const active = await leases.inspect(profile.id)
  assert(active && active.ownerId.startsWith('installation:'), 'runtime launch must acquire a profile lease')
  const conflict = await leases.acquire(profile.id, 'installation:other-device')
  assert.strictEqual(conflict.conflict, true, 'another device must not acquire a live profile')
  await browserManager.closeProfile(profile.id)
  assert.strictEqual(await leases.inspect(profile.id), null, 'normal close must release the lease')

  await browserManager.openProfile(profile, { headless: true, skipPrivacyValidation: true })
  await browserManager.getEntry(profile.id).context.close()
  const deadline = Date.now() + 5_000
  while (await leases.inspect(profile.id)) {
    if (Date.now() > deadline) throw new Error('crash/exit lease was not released')
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert.strictEqual(browserManager.isRunning(profile.id), false, 'unexpected browser exit must clear runtime state')
  await profiles.deleteProfile(profile.id, { deleteData: true })
  closeDb()
  fs.rmSync(process.env.APPDATA, { recursive: true, force: true })
  console.log('✓ Browser runtime acquires, enforces and releases profile leases')
}

run().catch(async (error) => {
  await browserManager.closeAllProfiles().catch(() => {})
  closeDb()
  console.error(error)
  process.exit(1)
})
