const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { safeStorage } = require('electron')
const { getAppDataPath } = require('../../shared/paths')

const KEY_FILE = () => path.join(getAppDataPath(), 'credentials.key')
const SAFE_PREFIX = 'safe:'
const AES_PREFIX = 'aes-gcm:'

function isEncryptionAvailable() {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

function getLocalKey() {
  const keyFile = KEY_FILE()
  fs.mkdirSync(path.dirname(keyFile), { recursive: true })
  if (!fs.existsSync(keyFile)) {
    fs.writeFileSync(keyFile, crypto.randomBytes(32), { mode: 0o600, flag: 'wx' })
  }
  try { fs.chmodSync(keyFile, 0o600) } catch { /* Windows ACLs are managed by the user profile */ }
  const key = fs.readFileSync(keyFile)
  if (key.length !== 32) throw new Error('Invalid local credential encryption key')
  return key
}

function encryptWithLocalKey(value) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getLocalKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${AES_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

function encryptSecret(plain) {
  if (plain == null || plain === '') return null
  try {
    if (isEncryptionAvailable()) {
      return SAFE_PREFIX + safeStorage.encryptString(String(plain)).toString('base64')
    }
  } catch (err) {
    console.warn('[crypto] safeStorage encrypt failed, using local authenticated encryption')
  }
  return encryptWithLocalKey(String(plain))
}

function decryptSecret(encoded) {
  if (!encoded) return null
  if (encoded.startsWith(AES_PREFIX)) {
    try {
      const [ivText, tagText, encryptedText] = encoded.slice(AES_PREFIX.length).split(':')
      if (!ivText || !tagText || encryptedText == null) return null
      const decipher = crypto.createDecipheriv('aes-256-gcm', getLocalKey(), Buffer.from(ivText, 'base64'))
      decipher.setAuthTag(Buffer.from(tagText, 'base64'))
      return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64')), decipher.final()]).toString('utf8')
    } catch {
      return null
    }
  }
  try {
    if (encoded.startsWith(SAFE_PREFIX) && isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(encoded.slice(SAFE_PREFIX.length), 'base64'))
    }
    // Compatibility with tokens created before encryption formats were tagged.
    if (!encoded.includes(':') && isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
    }
  } catch (err) {
    console.warn('[crypto] safeStorage decrypt failed')
  }
  try {
    return Buffer.from(encoded, 'base64').toString('utf8')
  } catch {
    return null
  }
}

module.exports = { encryptSecret, decryptSecret, isEncryptionAvailable, KEY_FILE }
