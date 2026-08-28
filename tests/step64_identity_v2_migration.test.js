const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const appData = fs.mkdtempSync(path.join(os.tmpdir(), 'ynlogin-step64-'))
process.env.APPDATA = appData
process.env.NODE_ENV = 'test'

const profiles = require('../src/main/database/profiles')
const { getDb, saveDb, closeDb } = require('../src/main/database')
const { migrateLegacyProfileIdentities } = require('../src/main/browser/identityMigration')
const { IDENTITY_VERSION } = require('../src/main/browser/profileIdentity')

async function run() {
  const profile = await profiles.createProfile({ name: 'Legacy identity', browser_type: 'chrome' })
  const db = await getDb()
  db.run('UPDATE profiles SET environment = ? WHERE id = ?', [JSON.stringify({ mode: 'custom', locale: 'vi-VN', timezone: 'Asia/Ho_Chi_Minh' }), profile.id])
  saveDb()
  const migrated = await migrateLegacyProfileIdentities()
  assert.strictEqual(migrated.migrated, 1)
  assert(fs.existsSync(migrated.backupPath), 'legacy configuration backup must exist before migration')
  const updated = await profiles.getProfileById(profile.id)
  assert.strictEqual(updated.environment.identity.version, IDENTITY_VERSION)
  assert.strictEqual(updated.environment.identity.locale, 'vi-VN')
  assert.strictEqual(updated.environment.identity.timezone, 'Asia/Ho_Chi_Minh')
  const repeated = await migrateLegacyProfileIdentities()
  assert.strictEqual(repeated.migrated, 0, 'migration must be idempotent')
  closeDb()
  fs.rmSync(appData, { recursive: true, force: true })
  console.log('✓ Legacy profiles migrate to persistent Identity V2 with backup and idempotency')
}

run().catch((error) => { console.error(error); closeDb(); fs.rmSync(appData, { recursive: true, force: true }); process.exit(1) })
