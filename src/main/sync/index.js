const crypto = require('crypto')
const { ProfileLeaseService } = require('./profileLeases')

const ENVELOPE_VERSION = 1
const ALLOWED_FIELDS = ['id', 'name', 'group_name', 'tags', 'workspace_id', 'browser_type', 'browser_channel', 'browser_version', 'environment', 'notes', 'created_at', 'updated_at', 'revision']

function sanitizeRecord(record = {}) {
  return Object.fromEntries(ALLOWED_FIELDS.filter((key) => record[key] !== undefined).map((key) => [key, record[key]]))
}

function deriveKey(secret, salt) {
  if (typeof secret !== 'string' || secret.length < 16) throw new Error('Workspace sync secret must contain at least 16 characters')
  return crypto.scryptSync(secret, salt, 32)
}

function sealPayload(payload, secret, workspaceId = 'default') {
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const aad = Buffer.from(`ynlogin-sync:${ENVELOPE_VERSION}:${workspaceId}`)
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(secret, salt), iv)
  cipher.setAAD(aad)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  return { version: ENVELOPE_VERSION, workspaceId, algorithm: 'aes-256-gcm', kdf: 'scrypt', salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') }
}

function openPayload(envelope, secret) {
  if (!envelope || envelope.version !== ENVELOPE_VERSION || envelope.algorithm !== 'aes-256-gcm') throw new Error('Unsupported sync envelope')
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(secret, Buffer.from(envelope.salt, 'base64')), Buffer.from(envelope.iv, 'base64'))
  decipher.setAAD(Buffer.from(`ynlogin-sync:${envelope.version}:${envelope.workspaceId}`))
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8'))
}

class SyncProvider {
  async syncConfigurations() { throw new Error('Not implemented') }
  async resolveConflict(localRecord, remoteRecord, strategy = 'local_newer') {
    if (strategy === 'manual') return { conflict: true, local: localRecord, remote: remoteRecord }
    if (strategy === 'remote_newer') return remoteRecord
    const localRevision = Number(localRecord?.revision || 0)
    const remoteRevision = Number(remoteRecord?.revision || 0)
    if (localRevision !== remoteRevision) return localRevision > remoteRevision ? localRecord : remoteRecord
    const localTime = new Date(localRecord?.updated_at || localRecord?.created_at || 0).getTime()
    const remoteTime = new Date(remoteRecord?.updated_at || remoteRecord?.created_at || 0).getTime()
    return localTime >= remoteTime ? localRecord : remoteRecord
  }
}

class LocalOnlySyncProvider extends SyncProvider {
  constructor() { super(); this.name = 'Local-First (No Cloud Sync)' }
  async syncConfigurations() { return { success: true, syncedCount: 0, mode: 'local-only' } }
}

class HttpsSyncTransport {
  constructor(endpoint, { fetchImpl = globalThis.fetch, timeoutMs = 15_000 } = {}) {
    const url = new URL(endpoint)
    if (url.protocol !== 'https:') throw new Error('Cloud sync endpoint must use HTTPS')
    this.endpoint = url.toString(); this.fetchImpl = fetchImpl; this.timeoutMs = timeoutMs
  }
  async exchange(envelope, { bearerToken } = {}) {
    if (typeof this.fetchImpl !== 'function') throw new Error('Fetch transport is unavailable')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetchImpl(this.endpoint, { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json', ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}) }, body: JSON.stringify(envelope) })
      if (!response.ok) throw new Error(`Sync server returned HTTP ${response.status}`)
      return response.json()
    } finally { clearTimeout(timer) }
  }
}

class EncryptedCloudSyncProvider extends SyncProvider {
  constructor(options = {}) {
    super()
    if (typeof options === 'string') options = { endpoint: options }
    this.name = 'End-to-End Encrypted Cloud Sync'; this.workspaceId = options.workspaceId || 'default'
    this.secret = options.secret; this.bearerToken = options.bearerToken
    this.transport = options.transport || (options.endpoint ? new HttpsSyncTransport(options.endpoint, options) : null)
  }
  async syncConfigurations(localProfiles = [], { cursor = null, conflictStrategy = 'local_newer' } = {}) {
    if (!this.transport) throw new Error('Cloud sync transport is not configured')
    const records = localProfiles.map(sanitizeRecord)
    const responseEnvelope = await this.transport.exchange(sealPayload({ cursor, records, sentAt: new Date().toISOString() }, this.secret, this.workspaceId), { bearerToken: this.bearerToken })
    const remote = openPayload(responseEnvelope, this.secret)
    const localById = new Map(records.map((record) => [record.id, record])); const merged = []; const conflicts = []
    for (const remoteRecord of (remote.records || []).map(sanitizeRecord)) {
      const localRecord = localById.get(remoteRecord.id)
      if (!localRecord) { merged.push(remoteRecord); continue }
      localById.delete(remoteRecord.id)
      const resolved = await this.resolveConflict(localRecord, remoteRecord, conflictStrategy)
      if (resolved?.conflict) conflicts.push(resolved); else merged.push(resolved)
    }
    merged.push(...localById.values())
    return { success: true, mode: 'encrypted-cloud', syncedCount: records.length, receivedCount: (remote.records || []).length, cursor: remote.cursor || cursor, records: merged, conflicts }
  }
}

module.exports = { SyncProvider, LocalOnlySyncProvider, EncryptedCloudSyncProvider, HttpsSyncTransport, ProfileLeaseService, sanitizeRecord, sealPayload, openPayload, ENVELOPE_VERSION }
