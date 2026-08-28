const assert = require('assert')
const fs = require('fs')
const path = require('path')
const os = require('os')
const AdmZip = require('adm-zip')

process.env.APPDATA = path.join(os.tmpdir(), `ynlogin-extension-test-${Date.now()}`)
process.env.NODE_ENV = 'test'

const manager = require('../src/main/extensions/manager')
const profiles = require('../src/main/database/profiles')
const { closeDb } = require('../src/main/database')

async function run() {
  const extensionDir = path.join(process.env.APPDATA, 'fixture-extension')
  fs.mkdirSync(extensionDir, { recursive: true })
  fs.writeFileSync(path.join(extensionDir, 'manifest.json'), JSON.stringify({
    manifest_version: 3, name: 'YNlogin Test Extension', version: '1.0.0', permissions: ['storage'],
  }))
  const registered = await manager.registerDirectory(extensionDir)
  assert.strictEqual(registered.manifest_version, 3)
  assert.strictEqual(registered.sha256.length, 64)

  const zip = new AdmZip()
  zip.addFile('manifest.json', Buffer.from(JSON.stringify({ manifest_version: 3, name: 'CRX Test', version: '2.0.0' })))
  const zipBuffer = zip.toBuffer()
  const header = Buffer.alloc(12)
  header.write('Cr24', 0, 'ascii')
  header.writeUInt32LE(3, 4)
  header.writeUInt32LE(0, 8)
  const crxPath = path.join(process.env.APPDATA, 'fixture.crx')
  fs.writeFileSync(crxPath, Buffer.concat([header, zipBuffer]))
  const crxRegistered = await manager.registerCrx(crxPath)
  assert.strictEqual(crxRegistered.name, 'CRX Test')
  assert.throws(() => manager.extractCrxZip(Buffer.from('not-a-crx')), /Invalid CRX header/)

  const profile = await profiles.createProfile({ name: 'Extension Profile', workspace_id: 'default' })
  await manager.assign(registered.id, 'profile', profile.id, true)
  const assigned = await manager.getForProfile(profile)
  assert.strictEqual(assigned.length, 1)
  assert.strictEqual(assigned[0].id, registered.id)

  await manager.remove(registered.id)
  await manager.remove(crxRegistered.id)
  assert.strictEqual((await manager.getForProfile(profile)).length, 0)
  await profiles.deleteProfile(profile.id, { deleteData: true })
  closeDb()
  fs.rmSync(process.env.APPDATA, { recursive: true, force: true })
  console.log('✓ Extension manifest validation, registry, hashing and profile assignment verified')
}

run().catch((err) => { console.error(err); process.exit(1) })
