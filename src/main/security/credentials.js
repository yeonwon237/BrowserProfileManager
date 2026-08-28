const cryptoJs = require('./crypto')

/**
 * Secure Credential Manager — abstraction over the OS credential store
 * (Windows Credential Manager via DPAPI / macOS Keychain) provided by
 * Electron's safeStorage. Application code never handles or stores secrets
 * in plaintext.
 */
function backend() {
  return cryptoJs.isEncryptionAvailable() ? 'os-credential-store' : 'local-aes-256-gcm'
}

function isSecure() {
  return true
}

/**
 * Encrypt a secret into a portable, opaque token for storage in the DB.
 * Never stores plaintext.
 */
function encrypt(value) {
  return cryptoJs.encryptSecret(value)
}

/**
 * Decrypt an opaque token back to the original secret (only usable in the
 * main process where the OS credential store is available).
 */
function decrypt(encoded) {
  return cryptoJs.decryptSecret(encoded)
}

/**
 * Verify that an encrypted token differs from the plaintext and round-trips.
 */
function verifyRoundTrip(plain) {
  if (plain == null || plain === '') return { ok: true }
  const encrypted = encrypt(plain)
  if (!encrypted || encrypted === String(plain)) return { ok: false, error: 'secret stored in plaintext' }
  const decrypted = decrypt(encrypted)
  if (decrypted !== String(plain)) return { ok: false, error: 'round-trip mismatch' }
  return { ok: true }
}

module.exports = { backend, isSecure, encrypt, decrypt, verifyRoundTrip }
