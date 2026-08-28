const crypto = require('crypto')
const database = require('../database')

const MIN_TTL_MS = 5_000
const MAX_TTL_MS = 15 * 60_000

function rows(result) {
  if (!result?.length) return []
  const { columns, values } = result[0]
  return values.map((valuesRow) => Object.fromEntries(columns.map((name, i) => [name, valuesRow[i]])))
}

class ProfileLeaseService {
  constructor({ getDb = database.getDb, saveDb = database.saveDb, now = () => Date.now() } = {}) {
    this.getDb = getDb
    this.saveDb = saveDb
    this.now = now
  }

  normalizeTtl(ttlMs) {
    const value = Number(ttlMs)
    if (!Number.isFinite(value)) return 60_000
    return Math.min(MAX_TTL_MS, Math.max(MIN_TTL_MS, Math.floor(value)))
  }

  async acquire(profileId, ownerId, { ttlMs = 60_000, metadata = {} } = {}) {
    if (!profileId || !ownerId) throw new Error('profileId and ownerId are required')
    const db = await this.getDb()
    const now = this.now()
    const current = rows(db.exec('SELECT * FROM profile_leases WHERE profile_id=?', [profileId]))[0]
    if (current && Date.parse(current.expires_at) > now && current.owner_id !== ownerId) {
      return { acquired: false, conflict: true, ownerId: current.owner_id, expiresAt: current.expires_at }
    }
    const token = crypto.randomBytes(32).toString('base64url')
    const acquiredAt = new Date(now).toISOString()
    const expiresAt = new Date(now + this.normalizeTtl(ttlMs)).toISOString()
    db.run(`INSERT INTO profile_leases (profile_id, owner_id, lease_token, acquired_at, expires_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(profile_id) DO UPDATE SET owner_id=excluded.owner_id, lease_token=excluded.lease_token,
      acquired_at=excluded.acquired_at, expires_at=excluded.expires_at, metadata=excluded.metadata`,
    [profileId, ownerId, token, acquiredAt, expiresAt, JSON.stringify(metadata || {})])
    this.saveDb()
    return { acquired: true, profileId, ownerId, token, acquiredAt, expiresAt }
  }

  async renew(profileId, token, ttlMs = 60_000) {
    const db = await this.getDb()
    const now = this.now()
    const current = rows(db.exec('SELECT * FROM profile_leases WHERE profile_id=?', [profileId]))[0]
    if (!current || current.lease_token !== token || Date.parse(current.expires_at) <= now) {
      return { renewed: false }
    }
    const expiresAt = new Date(now + this.normalizeTtl(ttlMs)).toISOString()
    db.run('UPDATE profile_leases SET expires_at=? WHERE profile_id=? AND lease_token=?', [expiresAt, profileId, token])
    this.saveDb()
    return { renewed: true, expiresAt }
  }

  async release(profileId, token) {
    const db = await this.getDb()
    const current = rows(db.exec('SELECT lease_token FROM profile_leases WHERE profile_id=?', [profileId]))[0]
    if (!current || current.lease_token !== token) return { released: false }
    db.run('DELETE FROM profile_leases WHERE profile_id=? AND lease_token=?', [profileId, token])
    this.saveDb()
    return { released: true }
  }

  async inspect(profileId) {
    const db = await this.getDb()
    const current = rows(db.exec('SELECT profile_id, owner_id, acquired_at, expires_at, metadata FROM profile_leases WHERE profile_id=?', [profileId]))[0]
    if (!current || Date.parse(current.expires_at) <= this.now()) return null
    return { profileId: current.profile_id, ownerId: current.owner_id, acquiredAt: current.acquired_at,
      expiresAt: current.expires_at, metadata: JSON.parse(current.metadata || '{}') }
  }
}

module.exports = { ProfileLeaseService, MIN_TTL_MS, MAX_TTL_MS }
