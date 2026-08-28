const assert = require('assert')
const fs = require('fs')
const path = require('path')
const os = require('os')

process.env.APPDATA = path.join(os.tmpdir(), `ynlogin-cookie-test-${Date.now()}`)
process.env.NODE_ENV = 'test'

const cookies = require('../src/main/cookies/manager')
const profiles = require('../src/main/database/profiles')
const { closeDb } = require('../src/main/database')

async function run() {
  const parsed = cookies.parseCookies([
    { domain: '.example.com', path: '/', secure: true, httpOnly: true, name: 'sid', value: 'abc', expirationDate: 2000000000 },
  ], 'json')
  assert.strictEqual(parsed.validCount, 1)

  const net = cookies.parseCookies('# Netscape HTTP Cookie File\n#HttpOnly_.example.org\tTRUE\t/\tTRUE\t2000000000\tauth\tsecret', 'netscape')
  assert.strictEqual(net.validCount, 1)
  assert.strictEqual(net.cookies[0].httpOnly, true)

  const merged = cookies.mergeCookies(
    [{ domain: '.example.com', path: '/', name: 'sid', value: 'old' }],
    [{ domain: '.example.com', path: '/', name: 'sid', value: 'new' }],
  )
  assert.strictEqual(merged.length, 1)
  assert.strictEqual(merged[0].value, 'new')

  const profile = await profiles.createProfile({ name: 'Cookie Profile', browser_type: 'chromium' })
  const imported = await cookies.importCookies(profile.id, JSON.stringify(parsed.cookies), { format: 'json', mode: 'replace-all' })
  assert.strictEqual(imported.importedCount, 1)
  const exported = await cookies.exportCookies(profile.id, 'netscape')
  assert(exported.content.includes('#HttpOnly_.example.com'))
  assert(exported.content.includes('\tsid\tabc'))

  await profiles.deleteProfile(profile.id, { deleteData: true })
  closeDb()
  fs.rmSync(process.env.APPDATA, { recursive: true, force: true })
  console.log('✓ Cookie Manager JSON/Netscape parsing, validation, merge and encrypted offline storage verified')
}

run().catch((err) => { console.error(err); process.exit(1) })
