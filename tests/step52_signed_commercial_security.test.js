const assert = require('assert')
const crypto = require('crypto')
const { LicenseService, getInstallationId } = require('../src/main/licensing')
const { UpdateManager } = require('../src/main/updates')

function signedToken(privateKey, payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.sign(null, Buffer.from(encoded, 'base64url'), privateKey).toString('base64url')
  return `YNL1.${encoded}.${signature}`
}

function run() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
  const service = new LicenseService({ publicKey })
  const payload = {
    licenseId: 'lic-test-1', edition: 'business', registeredTo: 'Test Customer',
    installationId: getInstallationId(), expiresAt: new Date(Date.now() + 86400000).toISOString(),
  }
  const token = signedToken(privateKey, payload)
  const activated = service.activateSignedToken(token)
  assert.strictEqual(activated.success, true)
  assert.strictEqual(activated.license.edition, 'business')
  assert.strictEqual(service.activateSignedToken(`${token.slice(0, -2)}xx`).success, false)

  const otherDevice = signedToken(privateKey, { ...payload, installationId: 'inst-someone-else' })
  assert.strictEqual(service.activateSignedToken(otherDevice).success, false)
  const expired = signedToken(privateKey, { ...payload, expiresAt: new Date(Date.now() - 1000).toISOString() })
  assert.strictEqual(service.activateSignedToken(expired).success, false)

  const updates = new UpdateManager()
  const manifest = { version: '2.0.0', channel: 'stable', platforms: { win32: { sha256: 'abc', url: 'https://example.com/app.exe' } } }
  const signature = crypto.sign(null, Buffer.from(updates.canonicalizeManifest(manifest)), privateKey).toString('base64url')
  assert.strictEqual(updates.verifyManifestSignature(manifest, signature, publicKey), true)
  assert.strictEqual(updates.verifyManifestSignature({ ...manifest, version: '2.0.1' }, signature, publicKey), false)
  console.log('✓ Ed25519 signed licenses, device binding, expiry and signed update manifests verified')
}

try { run() } catch (err) { console.error(err); process.exit(1) }
