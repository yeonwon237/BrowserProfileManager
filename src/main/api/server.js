const http = require('http')
const crypto = require('crypto')
const { URL } = require('url')
const profilesRepo = require('../database/profiles')
const browserManager = require('../browser/manager')
const cookieManager = require('../cookies/manager')
const settings = require('../settings')
const { encryptSecret, decryptSecret } = require('../security/crypto')

const DEFAULT_PORT = 53000
const MAX_BODY_BYTES = 10 * 1024 * 1024
let server = null
let activeToken = null

function json(res, status, body) {
  const content = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(content),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(content)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!chunks.length) return resolve({})
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
      catch { reject(Object.assign(new Error('Invalid JSON body'), { status: 400 })) }
    })
    req.on('error', reject)
  })
}

function authorized(req) {
  const value = String(req.headers.authorization || '')
  if (!value.startsWith('Bearer ') || !activeToken) return false
  const supplied = Buffer.from(value.slice(7))
  const expected = Buffer.from(activeToken)
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected)
}

async function route(req, res) {
  if (!authorized(req)) return json(res, 401, { error: 'Unauthorized' })
  const url = new URL(req.url, 'http://127.0.0.1')
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts[0] !== 'api' || parts[1] !== 'v1') return json(res, 404, { error: 'Not found' })

  if (req.method === 'GET' && parts.length === 3 && parts[2] === 'health') {
    return json(res, 200, { ok: true, version: 1 })
  }
  if (req.method === 'GET' && parts.length === 3 && parts[2] === 'profiles') {
    const profiles = await profilesRepo.getAllProfiles({})
    return json(res, 200, { profiles: profiles.map((p) => ({ id: p.id, name: p.name, status: p.status, browserType: p.browser_type })) })
  }

  const profileId = parts[3]
  if (parts[2] !== 'profiles' || !profileId || profileId.length > 100) return json(res, 404, { error: 'Not found' })
  const profile = await profilesRepo.getProfileById(profileId)
  if (!profile) return json(res, 404, { error: 'Profile not found' })

  if (req.method === 'GET' && parts[4] === 'status') {
    return json(res, 200, { id: profileId, running: browserManager.isRunning(profileId), status: browserManager.isRunning(profileId) ? 'running' : profile.status })
  }
  if (req.method === 'POST' && parts[4] === 'start') {
    const body = await readBody(req)
    const result = await browserManager.openProfile(profile, {
      headless: Boolean(body.headless), windowLayout: body.windowLayout !== false, exposeDebugger: body.automation !== false,
    })
    return json(res, result.success ? 200 : 202, result)
  }
  if (req.method === 'POST' && parts[4] === 'stop') {
    const result = await browserManager.closeProfile(profileId)
    return json(res, result.success ? 200 : 409, result)
  }
  if (req.method === 'GET' && parts[4] === 'connection') {
    const entry = browserManager.getEntry(profileId)
    if (!entry) return json(res, 409, { error: 'Profile is not running' })
    if (!entry.debuggerUrl) return json(res, 409, { error: 'Profile was not started with automation access' })
    return json(res, 200, { type: 'cdp', host: '127.0.0.1', port: entry.debuggerPort, webSocketDebuggerUrl: entry.debuggerUrl })
  }
  if (req.method === 'GET' && parts[4] === 'cookies') {
    const format = url.searchParams.get('format') || 'json'
    return json(res, 200, await cookieManager.exportCookies(profileId, format))
  }
  if (req.method === 'POST' && parts[4] === 'cookies') {
    const body = await readBody(req)
    if (body.input === undefined) return json(res, 400, { error: 'input is required' })
    return json(res, 200, await cookieManager.importCookies(profileId, body.input, {
      format: body.format || 'auto', mode: body.mode || 'merge', skipInvalid: body.skipInvalid !== false,
    }))
  }
  return json(res, 404, { error: 'Not found' })
}

async function ensureToken() {
  if (activeToken) return activeToken
  const stored = await settings.getSetting('localApi.token', '')
  activeToken = stored ? decryptSecret(stored) : null
  if (!activeToken) {
    activeToken = crypto.randomBytes(32).toString('base64url')
    await settings.setSetting('localApi.token', encryptSecret(activeToken))
  }
  return activeToken
}

async function start(options = {}) {
  if (server) return getStatus()
  await ensureToken()
  const port = Number(options.port || await settings.getSetting('localApi.port', DEFAULT_PORT))
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local API port')
  server = http.createServer((req, res) => {
    route(req, res).catch((err) => json(res, err.status || 500, { error: err.status ? err.message : 'Internal server error' }))
  })
  server.requestTimeout = 30000
  server.headersTimeout = 10000
  server.maxRequestsPerSocket = 100
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  return getStatus()
}

async function stop() {
  if (!server) return { running: false }
  const current = server
  server = null
  await new Promise((resolve) => current.close(resolve))
  return { running: false }
}

function getStatus() {
  const address = server && server.address()
  return { running: Boolean(server), host: '127.0.0.1', port: address && address.port || null }
}

async function revealToken() { return ensureToken() }

module.exports = { start, stop, getStatus, revealToken, DEFAULT_PORT }
