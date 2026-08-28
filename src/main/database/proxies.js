const crypto = require('crypto')
const { getDb, saveDb } = require('./index')
const credentials = require('../security/credentials')

const { request } = require('playwright')

function toObject(result) {
  if (!result || result.length === 0 || !result[0].values[0]) return null
  const cols = result[0].columns
  const row = result[0].values[0]
  const obj = {}
  cols.forEach((col, i) => { obj[col] = row[i] })
  return obj
}

function toArray(result) {
  if (!result || result.length === 0) return []
  const cols = result[0].columns
  return result[0].values.map((row) => {
    const obj = {}
    cols.forEach((col, i) => { obj[col] = row[i] })
    return obj
  })
}

function parseGeo(val) {
  if (!val) return {}
  try {
    const parsed = JSON.parse(val)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function publicProxy(row) {
  if (!row) return null
  const { encrypted_password, geo_metadata, ...rest } = row
  return {
    ...rest,
    geo_metadata: parseGeo(geo_metadata),
    has_password: Boolean(encrypted_password),
  }
}

function validateProtocol(protocol) {
  return ['http', 'https', 'socks5'].includes(protocol) ? protocol : 'http'
}

async function getProxyById(id) {
  const db = await getDb()
  const row = toObject(db.exec('SELECT * FROM proxies WHERE id = ?', [id]))
  return row || null
}

async function getAllProxies(options = {}) {
  const db = await getDb()
  let query = 'SELECT * FROM proxies'
  const params = []
  if (options && options.workspace_id) {
    query += ' WHERE workspace_id IS NULL OR workspace_id = ? OR workspace_id = ""'
    params.push(options.workspace_id)
  }
  query += ' ORDER BY created_at DESC'
  return toArray(db.exec(query, params)).map(publicProxy)
}

async function createProxy(data = {}) {
  const db = await getDb()
  const id = data.id || crypto.randomUUID()
  const protocol = validateProtocol(data.protocol)
  const geoMetadata = typeof data.geo_metadata === 'object' ? JSON.stringify(data.geo_metadata) : (data.geo_metadata || '{}')
  const workspaceId = data.workspace_id || null
  const tags = Array.isArray(data.tags) ? JSON.stringify(data.tags) : (data.tags || '[]')
  const maxProfiles = data.max_profiles != null ? Number(data.max_profiles) : 5

  db.run(
    `INSERT INTO proxies (id, name, protocol, host, port, username, encrypted_password, country_code, country_name, city, timezone, geo_metadata, notes, workspace_id, tags, group_name, max_profiles)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.name || 'Untitled proxy',
      protocol,
      data.host || '',
      Number(data.port) || 0,
      data.username || null,
      credentials.encrypt(data.password),
      data.country_code || null,
      data.country_name || null,
      data.city || null,
      data.timezone || null,
      geoMetadata,
      data.notes || null,
      workspaceId,
      tags,
      data.group_name || null,
      maxProfiles,
    ]
  )
  saveDb()
  return publicProxy(await getProxyById(id))
}

async function updateProxy(id, data = {}) {
  const db = await getDb()
  const existing = await getProxyById(id)
  if (!existing) throw new Error('Proxy not found')

  const passwordChanged = Object.prototype.hasOwnProperty.call(data, 'password')
  const geoMetadata = data.geo_metadata !== undefined
    ? (typeof data.geo_metadata === 'object' ? JSON.stringify(data.geo_metadata) : data.geo_metadata)
    : existing.geo_metadata
  const workspaceId = data.workspace_id !== undefined ? (data.workspace_id || null) : existing.workspace_id
  const tags = data.tags !== undefined ? (Array.isArray(data.tags) ? JSON.stringify(data.tags) : data.tags) : existing.tags
  const maxProfiles = data.max_profiles !== undefined ? Number(data.max_profiles) : existing.max_profiles

  db.run(
    `UPDATE proxies SET
       name = ?, protocol = ?, host = ?, port = ?, username = ?,
       encrypted_password = ?, country_code = ?, country_name = ?, city = ?, timezone = ?, geo_metadata = ?, notes = ?, workspace_id = ?,
       tags = ?, group_name = ?, max_profiles = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      data.name ?? existing.name,
      validateProtocol(data.protocol ?? existing.protocol),
      data.host ?? existing.host,
      data.port != null ? Number(data.port) : existing.port,
      data.username ?? existing.username,
      passwordChanged ? credentials.encrypt(data.password) : existing.encrypted_password,
      data.country_code !== undefined ? data.country_code : existing.country_code,
      data.country_name !== undefined ? data.country_name : existing.country_name,
      data.city !== undefined ? data.city : existing.city,
      data.timezone !== undefined ? data.timezone : existing.timezone,
      geoMetadata,
      data.notes !== undefined ? data.notes : existing.notes,
      workspaceId,
      tags,
      data.group_name !== undefined ? data.group_name : existing.group_name,
      maxProfiles,
      id,
    ]
  )
  saveDb()
  return publicProxy(await getProxyById(id))
}

// Public-looking IPv4 ranges used when generating placeholder random proxies
// (deliberately avoids private/reserved blocks such as 10.x, 192.168.x).
const PUBLIC_IP_FIRST_OCTETS = [45, 46, 62, 77, 80, 89, 91, 94, 103, 104, 109, 113, 116, 118, 128, 146, 149, 151, 152, 157, 158, 163, 164, 167, 169, 173, 178, 185, 191, 193, 194, 196, 199, 202, 203, 205, 209, 212, 213, 216, 217]
const PROTOCOLS_LIST = ['http', 'https', 'socks5']
const PROXY_PORTS = [3128, 8080, 1080, 8888, 4145, 8118, 9000, 10000]

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomPublicIp() {
  const a = PUBLIC_IP_FIRST_OCTETS[randomInt(0, PUBLIC_IP_FIRST_OCTETS.length - 1)]
  return [a, randomInt(1, 255), randomInt(1, 255), randomInt(1, 255)].join('.')
}

function randomProxyProtocol() {
  return PROTOCOLS_LIST[randomInt(0, PROTOCOLS_LIST.length - 1)]
}

/**
 * Creates a proxy entry with a randomly generated public-looking host:port.
 * These are placeholders intended for structure/testing — the user replaces
 * them with real proxy endpoints before relying on them for traffic.
 */
async function createRandomProxy({ name, protocol, notes = 'Proxy ngẫu nhiên (thay bằng proxy thật trước khi dùng)' } = {}) {
  const chosenProtocol = PROTOCOLS_LIST.includes(protocol) ? protocol : randomProxyProtocol()
  return createProxy({
    name: name || `Proxy ngẫu nhiên ${randomInt(100, 999)}`,
    protocol: chosenProtocol,
    host: randomPublicIp(),
    port: PROXY_PORTS[randomInt(0, PROXY_PORTS.length - 1)],
    username: null,
    password: '',
    notes,
  })
}

/**
 * Creates `count` random proxy placeholders, optionally with a name prefix.
 */
async function generateRandomProxies(count = 1, prefix = 'Proxy ngẫu nhiên') {
  const total = Math.max(1, Math.min(Number(count) || 1, 500))
  const created = []
  for (let i = 1; i <= total; i++) {
    created.push(await createRandomProxy({ name: `${prefix} ${String(i).padStart(2, '0')}` }))
  }
  return { success: true, created: created.length, proxies: created }
}

/**
 * Assigns a proxy to a profile via the profiles repository.
 * When a proxy with a known country is attached, timezone/locale are aligned
 * automatically so IPhey does not flag IP vs browser environment mismatch.
 */
async function assignProxyToProfile(profileId, proxyId) {
  const profilesRepo = require('./profiles')
  await profilesRepo.updateProfile(profileId, { proxy_id: proxyId || null })
  let aligned = null
  if (proxyId) {
    try {
      aligned = await require('../browser/environmentAlign').alignEnvironmentToProxy(profileId)
    } catch {
      aligned = null
    }
  }
  return { success: true, profileId, proxyId, aligned }
}

/**
 * Creates one random proxy placeholder per profile and assigns it to that
 * profile, so N selected profiles each get their own random proxy.
 */
async function assignRandomProxiesToProfiles(profileIds = [], { prefix = 'Proxy ngẫu nhiên' } = {}) {
  const unique = [...new Set((profileIds || []).filter(Boolean))]
  if (unique.length === 0) return { success: true, assigned: 0, results: [] }

  const results = []
  for (let i = 0; i < unique.length; i++) {
    try {
      const proxy = await createRandomProxy({ name: `${prefix} ${String(i + 1).padStart(2, '0')}` })
      await assignProxyToProfile(unique[i], proxy.id)
      results.push({ profileId: unique[i], proxyId: proxy.id, host: proxy.host, port: proxy.port })
    } catch {
      // Skip profiles that cannot be assigned (e.g. already deleted); the rest
      // of the batch must still succeed.
    }
  }
  return { success: true, assigned: results.length, results }
}

async function deleteProxy(id) {
  const db = await getDb()
  const existing = await getProxyById(id)
  if (!existing) return { success: false, error: 'Proxy not found' }

  db.run('UPDATE profiles SET proxy_id = NULL WHERE proxy_id = ?', [id])
  db.run('DELETE FROM proxies WHERE id = ?', [id])
  saveDb()
  return { success: true }
}

/**
 * Deletes multiple proxies at once. Any profile referencing a deleted proxy is
 * detached from it so no profile is left pointing at a missing node.
 */
async function bulkDelete(ids = []) {
  const db = await getDb()
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return { success: true, deletedCount: 0 }

  const placeholders = unique.map(() => '?').join(', ')
  db.run(`UPDATE profiles SET proxy_id = NULL WHERE proxy_id IN (${placeholders})`, unique)
  db.run(`DELETE FROM proxies WHERE id IN (${placeholders})`, unique)
  saveDb()
  return { success: true, deletedCount: unique.length }
}

function buildServerString(proxy) {
  const proto = proxy.protocol === 'socks5' ? 'socks5' : proxy.protocol
  return `${proto}://${proxy.host}:${proxy.port}`
}

async function getProxyConfig(id) {
  const proxy = await getProxyById(id)
  if (!proxy) return null
  const config = { server: buildServerString(proxy) }
  if (proxy.username) {
    config.username = proxy.username
    config.password = credentials.decrypt(proxy.encrypted_password) || ''
  }
  return config
}

async function testProxy(id) {
  const proxy = await getProxyById(id)
  if (!proxy) return { success: false, message: 'Proxy not found' }

  const server = buildServerString(proxy)
  const proxyConfig = { server }
  if (proxy.username) {
    proxyConfig.username = proxy.username
    proxyConfig.password = credentials.decrypt(proxy.encrypted_password) || ''
  }

  let context
  try {
    context = await request.newContext({
      proxy: proxyConfig,
      timeout: 12000,
    })
    const start = Date.now()

    // Check geo via TWO endpoints so we can detect proxies whose country
    // differs between plain HTTP and HTTPS (the classic Cloudflare WARP /
    // Workers signature: ip-api via HTTP shows "Korea", but the browser's
    // HTTPS request to ipinfo.io shows a different edge, e.g. 1.1.1.1 / AU).
    let geoHttp = null
    let geoHttps = null
    let cfRay = false

    let lastStatus = 0
    let lastStatusText = ''

    try {
      const resHttp = await context.get('http://ip-api.com/json/?fields=status,country,countryCode,city,timezone,query', { timeout: 8000 })
      lastStatus = resHttp.status()
      lastStatusText = resHttp.statusText() || ''
      if (resHttp.ok()) {
        const headers = resHttp.headers() || {}
        cfRay = cfRay || Boolean(headers['cf-ray']) || String(headers['server'] || '').toLowerCase() === 'cloudflare'
        const geoJson = await resHttp.json()
        if (geoJson.status === 'success' || geoJson.countryCode) {
          geoHttp = {
            ip: String(geoJson.query || ''),
            country_code: geoJson.countryCode,
            country_name: geoJson.country,
            city: geoJson.city,
            timezone: geoJson.timezone,
          }
        }
      }
    } catch {
      // ignore HTTP check failure; HTTPS may still work
    }

    try {
      const resHttps = await context.get('https://ipinfo.io/json', { timeout: 8000 })
      lastStatus = resHttps.status()
      lastStatusText = resHttps.statusText() || ''
      if (resHttps.ok()) {
        const headers = resHttps.headers() || {}
        cfRay = cfRay || Boolean(headers['cf-ray'])
        const geoJson = await resHttps.json()
        if (geoJson && geoJson.ip) {
          geoHttps = {
            ip: String(geoJson.ip || ''),
            country_code: String(geoJson.country || '').toUpperCase(),
            country_name: geoJson.country ? String(geoJson.country).toUpperCase() : '',
            city: geoJson.city || '',
            timezone: geoJson.timezone || '',
            org: geoJson.org || '',
          }
        }
      }
    } catch {
      // ignore HTTPS check failure
    }

    // Fallback reachability probe — only treat HTTP 2xx as success.
    // A 407 Proxy Authentication Required must NEVER be reported as connected.
    let probeOk = false
    if (!geoHttp && !geoHttps) {
      try {
        const probe = await context.get('http://example.com', { timeout: 8000 })
        lastStatus = probe.status()
        lastStatusText = probe.statusText() || ''
        probeOk = probe.ok() || (lastStatus >= 200 && lastStatus < 400)
      } catch (probeErr) {
        const msg = String(probeErr && probeErr.message || '')
        if (/407|proxy.?auth|authentication required/i.test(msg)) {
          lastStatus = 407
          lastStatusText = 'Proxy Authentication Required'
        }
        throw probeErr
      }
    }

    const latency = Date.now() - start
    await context.dispose()

    // Prefer the HTTPS result (matches what the real browser shows), fall back
    // to the HTTP result.
    const geo = geoHttps || geoHttp
    const connected = Boolean(geo) || probeOk

    if (!connected) {
      const authHint = lastStatus === 407
        ? ' (407 Proxy Authentication Required — kiểm tra user/password hoặc whitelist IP trên nhà cung cấp proxy)'
        : lastStatus
          ? ` (HTTP ${lastStatus}${lastStatusText ? ' ' + lastStatusText : ''})`
          : ''
      return {
        success: false,
        latency,
        status: lastStatus || null,
        message: `Proxy connection failed${authHint}`,
      }
    }

    const ipValues = [geoHttp && geoHttp.ip, geoHttps && geoHttps.ip].filter(Boolean)
    const isCloudflare = cfRay || ipValues.includes('1.1.1.1') || ipValues.includes('1.0.0.1')

    // Country mismatch between HTTP and HTTPS is the giveaway of a Cloudflare
    // / multi-PoP proxy that will NOT stay on the country you bought.
    const countryMismatch = Boolean(
      geoHttp && geoHttps &&
      geoHttp.country_code &&
      geoHttps.country_code &&
      geoHttp.country_code !== geoHttps.country_code
    )

    if (geo && geo.country_code) {
      await updateProxy(id, {
        country_code: geo.country_code,
        country_name: geo.country_name,
        city: geo.city,
        timezone: geo.timezone,
        geo_metadata: { ...(geo || {}), cloudflare: isCloudflare, http: geoHttp, https: geoHttps },
      })
    }

    const warnings = []
    if (countryMismatch) {
      warnings.push(
        `Quốc gia giữa HTTP và HTTPS KHÁC NHAU (HTTP: ${geoHttp.country_code} — ${geoHttp.ip}; HTTPS: ${geoHttps.country_code} — ${geoHttps.ip}). Đây là proxy Cloudflare (WARP/Workers) đi qua nhiều PoP — "Check ra Hàn Quốc" nhưng trình duyệt mở web (HTTPS) lại ra quốc gia khác. Hãy dùng proxy residential/datacenter thật của nhà cung cấp.`
      )
    } else if (isCloudflare) {
      warnings.push(
        'Proxy này đi qua Cloudflare (WARP/Workers). IP hiển thị 1.1.1.1 và quốc gia thường KHÔNG phản ánh đúng vị trí bạn đã mua (ví dụ gắn nhãn Hàn Quốc nhưng ra Cloudflare AU). Hãy dùng proxy residential/datacenter thật từ nhà cung cấp.'
      )
    }

    return {
      success: true,
      latency,
      geo,
      geoHttp,
      geoHttps,
      cloudflare: isCloudflare,
      countryMismatch,
      warnings,
      message: geo
        ? `Connected in ${latency}ms • ${geo.country_name || geo.country_code} (${geo.city || ''})${countryMismatch || isCloudflare ? ' • ⚠️ Cloudflare/không nhất quán' : ''}`
        : `Connected in ${latency}ms`,
    }
  } catch (err) {
    if (context) {
      try { await context.dispose() } catch {}
    }
    const msg = String(err && err.message || 'Connection failed')
    if (/407|proxy.?auth|authentication required/i.test(msg)) {
      return {
        success: false,
        status: 407,
        message: 'Proxy Authentication Required (407) — kiểm tra user/password hoặc whitelist IP trên nhà cung cấp proxy',
      }
    }
    return { success: false, message: msg }
  }
}

module.exports = {
  getAllProxies,
  getProxyById,
  createProxy,
  updateProxy,
  deleteProxy,
  bulkDelete,
  testProxy,
  buildServerString,
  getProxyConfig,
  createRandomProxy,
  generateRandomProxies,
  assignProxyToProfile,
  assignRandomProxiesToProfiles,
}