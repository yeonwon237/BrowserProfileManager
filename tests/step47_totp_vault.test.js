const assert = require('assert')
const path = require('path')
const os = require('os')

process.env.APPDATA = path.join(os.tmpdir(), `ynlogin-totp-test-${Date.now()}`)
process.env.NODE_ENV = 'test'

const totp = require('../src/main/security/totp')
const profiles = require('../src/main/database/profiles')
const { getDb, closeDb } = require('../src/main/database')

async function run() {
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
  const vector = totp.generateCode(rfcSecret, { digits: 8, period: 30, algorithm: 'SHA1' }, 59000)
  assert.strictEqual(vector.code, '94287082', 'RFC 6238 SHA1 vector at t=59 must match')

  const uri = totp.parseInput(`otpauth://totp/Example:alice%40example.com?secret=${rfcSecret}&issuer=Example&digits=8&period=30`)
  assert.strictEqual(uri.metadata.issuer, 'Example')
  assert.strictEqual(uri.metadata.account, 'alice@example.com')

  const profile = await profiles.createProfile({ name: '2FA Profile' })
  await totp.setTotp(profile.id, rfcSecret, { issuer: 'YNlogin Test', account: 'alice', digits: 8 })
  const status = await totp.status(profile.id)
  assert.strictEqual(status.configured, true)
  assert.strictEqual(status.metadata.issuer, 'YNlogin Test')
  const current = await totp.currentCode(profile.id, 59000)
  assert.strictEqual(current.code, '94287082')

  const db = await getDb()
  const stored = db.exec('SELECT encrypted_value FROM profile_secrets WHERE profile_id=?', [profile.id])[0].values[0][0]
  assert(!stored.includes(rfcSecret), 'TOTP secret must never be stored in plaintext')

  await totp.remove(profile.id)
  assert.strictEqual((await totp.status(profile.id)).configured, false)
  await profiles.deleteProfile(profile.id, { deleteData: true })
  closeDb()
  console.log('✓ RFC 6238 vectors, otpauth parsing, encrypted vault storage and removal verified')
}

run().catch((err) => { console.error(err); process.exit(1) })
