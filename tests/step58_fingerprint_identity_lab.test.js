const assert = require('assert')
const crypto = require('crypto')
const { createIdentity, ensureIdentity, validateIdentity, IDENTITY_VERSION } = require('../src/main/browser/profileIdentity')
const { runIdentityLab, compareRuntimeSnapshots } = require('../src/main/browser/fingerprintLab')
const profiles = require('../src/main/database/profiles')
const database = require('../src/main/database')

async function run() {
  const profileId = crypto.randomUUID()
  const environment = { mode: 'custom', locale: 'vi-VN', timezone: 'Asia/Ho_Chi_Minh', viewport: { width: 1920, height: 1080 } }
  const first = createIdentity(profileId, environment, 'chromium')
  const second = createIdentity(profileId, environment, 'chromium')
  assert.deepStrictEqual(first, second, 'same profile must reproduce the same identity')
  assert.strictEqual(first.version, IDENTITY_VERSION)
  assert.strictEqual(validateIdentity(first).valid, true)
  assert(first.screen.width >= environment.viewport.width)
  assert(first.screen.height >= environment.viewport.height)

  const other = createIdentity(crypto.randomUUID(), environment, 'chromium')
  assert.notStrictEqual(first.profileKey, other.profileKey, 'different profiles need different identity keys')

  const labIds = Array.from({ length: 1000 }, () => crypto.randomUUID())
  const report = runIdentityLab({ profileIds: labIds, environment, browserType: 'chromium' })
  assert.strictEqual(report.passed, true)
  assert.strictEqual(report.stableCount, 1000)
  assert.strictEqual(report.uniqueHashCount, 1000)
  assert.strictEqual(report.keyCollisions, 0)

  const stored = await profiles.createProfile({ name: 'Identity Persistence Test', environment })
  assert(stored.environment.identity, 'new profiles must persist a versioned identity')
  assert.strictEqual(stored.environment.identity.profileKey, createIdentity(stored.id, environment).profileKey)
  const clonedEnvironment = ensureIdentity(crypto.randomUUID(), stored.environment, stored.browser_type)
  assert.notStrictEqual(clonedEnvironment.identity.profileKey, stored.environment.identity.profileKey, 'clones must not reuse identity keys')

  const runtime = { userAgent: 'A', platform: 'Win32', language: 'vi-VN', timezone: 'Asia/Ho_Chi_Minh', hardwareConcurrency: 8, deviceMemory: 8, webglRenderer: 'GPU' }
  assert.strictEqual(compareRuntimeSnapshots([runtime, { ...runtime }]).stable, true)
  const changed = compareRuntimeSnapshots([runtime, { ...runtime, timezone: 'UTC' }])
  assert.strictEqual(changed.stable, false)
  assert.strictEqual(changed.drift[0].field, 'timezone')

  database.closeDb()
  console.log('✓ Versioned profile identity and 1,000-profile stability/uniqueness lab passed')
}

run().catch((error) => { console.error(error); process.exit(1) })
