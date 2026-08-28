const crypto = require('crypto')
const { getDb, saveDb } = require('../database')
const profilesRepo = require('../database/profiles')
const { encryptSecret, decryptSecret } = require('./crypto')

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const ALGORITHMS = new Set(['SHA1', 'SHA256', 'SHA512'])

function decodeBase32(value) {
  const clean = String(value || '').toUpperCase().replace(/[\s=-]/g, '')
  if (!clean || /[^A-Z2-7]/.test(clean)) throw new Error('Invalid Base32 TOTP secret')
  let bits = ''
  for (const char of clean) bits += BASE32.indexOf(char).toString(2).padStart(5, '0')
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  if (bytes.length < 10) throw new Error('TOTP secret must contain at least 80 bits')
  return Buffer.from(bytes)
}

function parseInput(input, options = {}) {
  let secret = String(input || '').trim()
  let issuer = String(options.issuer || '').slice(0, 200)
  let account = String(options.account || '').slice(0, 200)
  let algorithm = String(options.algorithm || 'SHA1').toUpperCase()
  let digits = Number(options.digits || 6)
  let period = Number(options.period || 30)
  if (/^otpauth:\/\//i.test(secret)) {
    const url = new URL(secret)
    if (url.protocol !== 'otpauth:' || url.hostname !== 'totp') throw new Error('Only otpauth TOTP URLs are supported')
    secret = url.searchParams.get('secret') || ''
    issuer = (url.searchParams.get('issuer') || issuer).slice(0, 200)
    const label = decodeURIComponent(url.pathname.replace(/^\//, ''))
    account = (label.includes(':') ? label.split(':').slice(1).join(':') : label || account).slice(0, 200)
    algorithm = String(url.searchParams.get('algorithm') || algorithm).toUpperCase()
    digits = Number(url.searchParams.get('digits') || digits)
    period = Number(url.searchParams.get('period') || period)
  }
  const normalizedSecret = secret.toUpperCase().replace(/[\s=-]/g, '')
  decodeBase32(normalizedSecret)
  if (!ALGORITHMS.has(algorithm)) throw new Error('Unsupported TOTP algorithm')
  if (![6, 8].includes(digits)) throw new Error('TOTP digits must be 6 or 8')
  if (![30, 60].includes(period)) throw new Error('TOTP period must be 30 or 60 seconds')
  return { secret: normalizedSecret, metadata: { issuer, account, algorithm, digits, period } }
}

function generateCode(secret, options = {}, timestamp = Date.now()) {
  const parsed = parseInput(secret, options)
  const { algorithm, digits, period } = parsed.metadata
  const counter = Math.floor(Number(timestamp) / 1000 / period)
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(counter))
  const digest = crypto.createHmac(algorithm.toLowerCase(), decodeBase32(parsed.secret)).update(message).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3]
  const code = String(binary % (10 ** digits)).padStart(digits, '0')
  const remaining = period - (Math.floor(Number(timestamp) / 1000) % period)
  return { code, remaining, period, digits }
}

async function setTotp(profileId, input, options = {}) {
  if (!await profilesRepo.getProfileById(profileId)) throw new Error('Profile not found')
  const parsed = parseInput(input, options)
  const encrypted = encryptSecret(parsed.secret)
  if (!encrypted) throw new Error('TOTP secret encryption failed')
  const db = await getDb()
  db.run(`INSERT INTO profile_secrets (profile_id, secret_type, encrypted_value, metadata)
    VALUES (?, 'totp', ?, ?)
    ON CONFLICT(profile_id, secret_type) DO UPDATE SET encrypted_value=excluded.encrypted_value,
    metadata=excluded.metadata, updated_at=CURRENT_TIMESTAMP`, [profileId, encrypted, JSON.stringify(parsed.metadata)])
  saveDb()
  return { success: true, configured: true, metadata: parsed.metadata }
}

async function getRecord(profileId) {
  const db = await getDb()
  const result = db.exec("SELECT encrypted_value, metadata FROM profile_secrets WHERE profile_id=? AND secret_type='totp'", [profileId])
  if (!result?.[0]?.values?.[0]) return null
  const [encryptedValue, metadataValue] = result[0].values[0]
  let metadata = {}
  try { metadata = JSON.parse(metadataValue || '{}') } catch {}
  return { encryptedValue, metadata }
}

async function status(profileId) {
  const record = await getRecord(profileId)
  return { configured: Boolean(record), metadata: record?.metadata || null }
}

async function currentCode(profileId, timestamp = Date.now()) {
  const record = await getRecord(profileId)
  if (!record) throw new Error('TOTP is not configured for this profile')
  const secret = decryptSecret(record.encryptedValue)
  if (!secret) throw new Error('TOTP secret could not be decrypted')
  return { ...generateCode(secret, record.metadata, timestamp), metadata: record.metadata }
}

async function remove(profileId) {
  const db = await getDb()
  db.run("DELETE FROM profile_secrets WHERE profile_id=? AND secret_type='totp'", [profileId])
  saveDb()
  return { success: true, configured: false }
}

module.exports = { decodeBase32, parseInput, generateCode, setTotp, status, currentCode, remove }
