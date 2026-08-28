const fs = require('fs')
const path = require('path')
const { encryptSecret, decryptSecret } = require('../security/crypto')
const profilesRepo = require('../database/profiles')
const browserManager = require('../browser/manager')

const MAX_COOKIE_COUNT = 10000
const MAX_INPUT_BYTES = 10 * 1024 * 1024
const SAME_SITE = new Map([
  ['strict', 'Strict'],
  ['lax', 'Lax'],
  ['none', 'None'],
])

function sessionStatePath(profile) {
  return path.join(path.dirname(profile.browser_data_path), 'session-state.enc')
}

function readOfflineCookies(profile) {
  const file = sessionStatePath(profile)
  if (!fs.existsSync(file)) return []
  const decoded = decryptSecret(fs.readFileSync(file, 'utf8'))
  if (!decoded) throw new Error('Cookie storage could not be decrypted')
  const state = JSON.parse(decoded)
  return Array.isArray(state.cookies) ? state.cookies : []
}

function writeOfflineCookies(profile, cookies) {
  fs.mkdirSync(path.dirname(sessionStatePath(profile)), { recursive: true })
  const encrypted = encryptSecret(JSON.stringify({ cookies }))
  if (!encrypted) throw new Error('Cookie storage could not be encrypted')
  fs.writeFileSync(sessionStatePath(profile), encrypted, { encoding: 'utf8', mode: 0o600 })
}

function normalizeDomain(value) {
  const domain = String(value || '').trim().toLowerCase()
  if (!domain || domain.length > 253 || /[\s/?#@]/.test(domain)) return null
  const bare = domain.startsWith('.') ? domain.slice(1) : domain
  if (!bare || !bare.includes('.') && bare !== 'localhost' || !/^[a-z0-9.-]+$/i.test(bare)) return null
  return domain
}

function normalizeCookie(raw, index = 0) {
  if (!raw || typeof raw !== 'object') throw new Error(`Cookie ${index + 1} must be an object`)
  const name = String(raw.name ?? '').trim()
  const value = String(raw.value ?? '')
  const domain = normalizeDomain(raw.domain || (raw.url ? new URL(raw.url).hostname : ''))
  const cookiePath = String(raw.path || '/').trim()
  if (!name || name.length > 4096 || /[\x00-\x20\x7f;,]/.test(name)) throw new Error(`Cookie ${index + 1} has an invalid name`)
  if (Buffer.byteLength(value, 'utf8') > 16384) throw new Error(`Cookie ${index + 1} value is too large`)
  if (!domain) throw new Error(`Cookie ${index + 1} has an invalid domain`)
  if (!cookiePath.startsWith('/') || cookiePath.length > 4096) throw new Error(`Cookie ${index + 1} has an invalid path`)

  let expires = Number(raw.expires ?? raw.expirationDate ?? -1)
  if (!Number.isFinite(expires) || expires <= 0) expires = -1
  if (expires > 100000000000) expires = Math.floor(expires / 1000)

  const result = {
    name,
    value,
    domain,
    path: cookiePath,
    expires,
    httpOnly: Boolean(raw.httpOnly),
    secure: Boolean(raw.secure),
  }
  const sameSite = SAME_SITE.get(String(raw.sameSite || '').toLowerCase())
  if (sameSite) result.sameSite = sameSite
  if (raw.partitionKey && typeof raw.partitionKey === 'string') result.partitionKey = raw.partitionKey.slice(0, 2048)
  return result
}

function parseNetscape(input) {
  const cookies = []
  const errors = []
  String(input || '').split(/\r?\n/).forEach((line, lineIndex) => {
    const trimmed = line.trim()
    if (!trimmed || (trimmed.startsWith('#') && !trimmed.startsWith('#HttpOnly_'))) return
    const fields = line.split('\t')
    if (fields.length < 7) {
      errors.push(`Line ${lineIndex + 1}: expected 7 tab-separated fields`)
      return
    }
    let domain = fields[0].trim()
    let httpOnly = false
    if (domain.startsWith('#HttpOnly_')) {
      httpOnly = true
      domain = domain.slice('#HttpOnly_'.length)
    }
    try {
      cookies.push(normalizeCookie({
        domain,
        path: fields[2],
        secure: /^true$/i.test(fields[3]),
        expires: fields[4],
        name: fields[5],
        value: fields.slice(6).join('\t'),
        httpOnly,
      }, cookies.length))
    } catch (err) {
      errors.push(`Line ${lineIndex + 1}: ${err.message}`)
    }
  })
  return { format: 'netscape', cookies, errors }
}

function parseJson(input) {
  const decoded = typeof input === 'string' ? JSON.parse(input) : input
  const list = Array.isArray(decoded) ? decoded : decoded && Array.isArray(decoded.cookies) ? decoded.cookies : null
  if (!list) throw new Error('JSON must be an array or an object with a cookies array')
  const cookies = []
  const errors = []
  list.forEach((raw, index) => {
    try { cookies.push(normalizeCookie(raw, index)) } catch (err) { errors.push(err.message) }
  })
  return { format: 'json', cookies, errors }
}

function parseCookies(input, format = 'auto') {
  const bytes = Buffer.byteLength(typeof input === 'string' ? input : JSON.stringify(input || null), 'utf8')
  if (bytes > MAX_INPUT_BYTES) throw new Error('Cookie input exceeds the 10 MB limit')
  const selected = format === 'auto'
    ? (typeof input === 'string' && /^[\s\r\n]*[\[{]/.test(input) ? 'json' : 'netscape')
    : String(format).toLowerCase()
  const result = selected === 'json' ? parseJson(input) : selected === 'netscape' ? parseNetscape(input) : null
  if (!result) throw new Error('Unsupported cookie format')
  if (result.cookies.length > MAX_COOKIE_COUNT) throw new Error(`Cookie count exceeds ${MAX_COOKIE_COUNT}`)
  return { ...result, validCount: result.cookies.length, invalidCount: result.errors.length }
}

function cookieKey(cookie) {
  return `${cookie.domain.toLowerCase()}\u0000${cookie.path}\u0000${cookie.name}\u0000${cookie.partitionKey || ''}`
}

function mergeCookies(existing, incoming, mode = 'merge') {
  if (mode === 'replace-all') return incoming
  const incomingDomains = new Set(incoming.map((c) => c.domain.replace(/^\./, '').toLowerCase()))
  const base = mode === 'replace-domains'
    ? existing.filter((c) => !incomingDomains.has(String(c.domain).replace(/^\./, '').toLowerCase()))
    : existing
  const map = new Map(base.map((cookie) => [cookieKey(cookie), cookie]))
  incoming.forEach((cookie) => map.set(cookieKey(cookie), cookie))
  return [...map.values()]
}

async function getCookies(profileId) {
  const profile = await profilesRepo.getProfileById(profileId)
  if (!profile) throw new Error('Profile not found')
  const entry = browserManager.getEntry(profileId)
  return entry ? entry.context.cookies() : readOfflineCookies(profile)
}

async function importCookies(profileId, input, options = {}) {
  const parsed = parseCookies(input, options.format || 'auto')
  if (parsed.errors.length && options.skipInvalid === false) {
    throw new Error(`Cookie validation failed: ${parsed.errors.slice(0, 5).join('; ')}`)
  }
  const profile = await profilesRepo.getProfileById(profileId)
  if (!profile) throw new Error('Profile not found')
  const entry = browserManager.getEntry(profileId)
  const existing = entry ? await entry.context.cookies() : readOfflineCookies(profile)
  const merged = mergeCookies(existing, parsed.cookies, options.mode || 'merge')
  if (entry) {
    if (options.mode === 'replace-all') await entry.context.clearCookies()
    else if (options.mode === 'replace-domains') {
      for (const domain of new Set(parsed.cookies.map((c) => c.domain))) await entry.context.clearCookies({ domain })
    }
    await entry.context.addCookies(parsed.cookies)
  } else {
    writeOfflineCookies(profile, merged)
  }
  return { success: true, importedCount: parsed.cookies.length, totalCount: merged.length, errors: parsed.errors }
}

function toNetscape(cookies) {
  const lines = ['# Netscape HTTP Cookie File', '# Exported by YNlogin. Treat this file as sensitive.', '']
  cookies.forEach((cookie) => {
    const prefix = cookie.httpOnly ? '#HttpOnly_' : ''
    const includeSubdomains = String(cookie.domain).startsWith('.') ? 'TRUE' : 'FALSE'
    lines.push([
      `${prefix}${cookie.domain}`,
      includeSubdomains,
      cookie.path || '/',
      cookie.secure ? 'TRUE' : 'FALSE',
      cookie.expires > 0 ? Math.floor(cookie.expires) : 0,
      cookie.name,
      cookie.value,
    ].join('\t'))
  })
  return lines.join('\n')
}

async function exportCookies(profileId, format = 'json') {
  const cookies = await getCookies(profileId)
  if (format === 'netscape') return { format, count: cookies.length, content: toNetscape(cookies) }
  if (format !== 'json') throw new Error('Unsupported cookie format')
  return { format, count: cookies.length, content: JSON.stringify(cookies, null, 2) }
}

module.exports = { parseCookies, mergeCookies, getCookies, importCookies, exportCookies, normalizeCookie, toNetscape }
