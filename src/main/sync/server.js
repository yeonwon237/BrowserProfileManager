const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')

const MAX_BODY_BYTES = 25 * 1024 * 1024

function secureEqual(left, right) {
  const a = Buffer.from(String(left || ''))
  const b = Buffer.from(String(right || ''))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

class OpaqueSyncStore {
  constructor({ persistencePath = null } = {}) {
    this.persistencePath = persistencePath
    this.workspaces = new Map()
    if (persistencePath && fs.existsSync(persistencePath)) {
      const parsed = JSON.parse(fs.readFileSync(persistencePath, 'utf8'))
      Object.entries(parsed.workspaces || {}).forEach(([id, value]) => this.workspaces.set(id, value))
    }
  }

  persist() {
    if (!this.persistencePath) return
    fs.mkdirSync(path.dirname(this.persistencePath), { recursive: true })
    const tempPath = `${this.persistencePath}.${process.pid}.tmp`
    fs.writeFileSync(tempPath, JSON.stringify({ workspaces: Object.fromEntries(this.workspaces) }), { mode: 0o600 })
    fs.renameSync(tempPath, this.persistencePath)
  }

  exchange(envelope) {
    if (!envelope || !/^[a-zA-Z0-9_-]{1,100}$/.test(envelope.workspaceId || '')) throw new Error('Invalid workspace envelope')
    if (envelope.algorithm !== 'aes-256-gcm' || !envelope.ciphertext || !envelope.tag) throw new Error('Invalid encrypted envelope')
    const previous = this.workspaces.get(envelope.workspaceId)?.envelope || envelope
    const revision = Number(this.workspaces.get(envelope.workspaceId)?.revision || 0) + 1
    this.workspaces.set(envelope.workspaceId, { revision, updatedAt: new Date().toISOString(), envelope })
    this.persist()
    return { envelope: previous, revision }
  }

  getStats() {
    return [...this.workspaces.entries()].map(([workspaceId, entry]) => ({ workspaceId, revision: entry.revision, updatedAt: entry.updatedAt }))
  }
}

function createTeamSyncServer({ token, store = new OpaqueSyncStore(), host = '127.0.0.1', port = 0, tls = null, onEncryptedBody } = {}) {
  if (typeof token !== 'string' || token.length < 24) throw new Error('Server bearer token must contain at least 24 characters')
  if (!tls && !['127.0.0.1', '::1', 'localhost'].includes(host)) throw new Error('A remote Team Sync server requires TLS certificate and key')
  const listener = async (req, res) => {
    res.setHeader('content-type', 'application/json')
    res.setHeader('cache-control', 'no-store')
    res.setHeader('x-content-type-options', 'nosniff')
    if (req.method === 'GET' && req.url === '/health') { res.end(JSON.stringify({ ok: true, encryptedStorage: true })); return }
    if (req.method !== 'POST' || req.url !== '/v1/exchange') { res.statusCode = 404; res.end(JSON.stringify({ error: 'Not found' })); return }
    const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!secureEqual(auth, token)) { res.statusCode = 401; res.end(JSON.stringify({ error: 'Unauthorized' })); return }
    const chunks = []; let size = 0
    try {
      for await (const chunk of req) {
        size += chunk.length
        if (size > MAX_BODY_BYTES) throw new Error('Request body is too large')
        chunks.push(chunk)
      }
      const raw = Buffer.concat(chunks).toString('utf8')
      if (onEncryptedBody) onEncryptedBody(raw)
      const result = store.exchange(JSON.parse(raw))
      res.end(JSON.stringify(result.envelope))
    } catch (error) {
      res.statusCode = /too large/i.test(error.message) ? 413 : 400
      res.end(JSON.stringify({ error: error.message }))
    }
  }
  const server = tls ? https.createServer({ key: tls.key, cert: tls.cert }, listener) : http.createServer(listener)
  return {
    store,
    async start() { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve) }); return server.address() },
    async stop() { if (!server.listening) return; await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) },
  }
}

module.exports = { OpaqueSyncStore, createTeamSyncServer, MAX_BODY_BYTES }
