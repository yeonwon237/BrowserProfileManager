const crypto = require('crypto')
const dns = require('dns').promises
const net = require('net')
const { getDb, saveDb } = require('../database')
const profilesRepo = require('../database/profiles')
const browserManager = require('../browser/manager')

const activeRuns = new Map()
const DEFAULT_URLS = [
  'https://www.wikipedia.org/',
  'https://www.bbc.com/',
  'https://www.reuters.com/',
  'https://www.youtube.com/',
]

function isPrivateIp(ip) {
  if (!net.isIP(ip)) return false
  if (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return true
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4) return false
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
}

async function validateUrl(value, options = {}) {
  let url
  try { url = new URL(String(value || '').trim()) } catch { throw new Error(`Invalid URL: ${value}`) }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Unsupported URL protocol: ${url.protocol}`)
  if (url.username || url.password) throw new Error('URLs containing credentials are not allowed')
  const host = url.hostname.toLowerCase()
  if (!options.allowPrivate && (host === 'localhost' || host.endsWith('.localhost') || isPrivateIp(host))) {
    throw new Error(`Private or loopback URL is not allowed: ${host}`)
  }
  if (!options.skipDns && !options.allowPrivate) {
    const addresses = await dns.lookup(host, { all: true })
    if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) throw new Error(`URL resolves to a private address: ${host}`)
  }
  url.hash = ''
  return url.toString()
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Warmup cancelled'))
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Warmup cancelled')) }, { once: true })
  })
}

async function executeSequence(page, urls, options = {}) {
  const dwellMinMs = Math.max(0, Math.min(120000, Number(options.dwellMinMs ?? 3000)))
  const dwellMaxMs = Math.max(dwellMinMs, Math.min(180000, Number(options.dwellMaxMs ?? 8000)))
  const timeoutMs = Math.max(3000, Math.min(120000, Number(options.timeoutMs || 30000)))
  const report = []
  for (const url of urls) {
    if (options.signal?.aborted) throw new Error('Warmup cancelled')
    const started = Date.now()
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
      await page.evaluate(() => window.scrollTo({ top: Math.min(document.body.scrollHeight, window.innerHeight * 1.5), behavior: 'smooth' })).catch(() => {})
      const dwell = dwellMaxMs === dwellMinMs ? dwellMinMs : crypto.randomInt(dwellMinMs, dwellMaxMs + 1)
      if (dwell > 0) await delay(dwell, options.signal)
      report.push({ url, ok: true, status: response?.status?.() || null, durationMs: Date.now() - started })
    } catch (err) {
      if (/cancelled/i.test(err.message)) throw err
      report.push({ url, ok: false, error: String(err.message || 'Navigation failed').slice(0, 500), durationMs: Date.now() - started })
    }
    options.onProgress?.(report)
  }
  return report
}

async function saveRun(id, fields) {
  const db = await getDb()
  const sets = []
  const values = []
  for (const [key, value] of Object.entries(fields)) { sets.push(`${key}=?`); values.push(value) }
  values.push(id)
  db.run(`UPDATE warmup_runs SET ${sets.join(', ')} WHERE id=?`, values)
  saveDb()
}

async function start(profileId, options = {}) {
  if (activeRuns.has(profileId)) throw new Error('A warmup is already running for this profile')
  const profile = await profilesRepo.getProfileById(profileId)
  if (!profile) throw new Error('Profile not found')
  const rawUrls = Array.isArray(options.urls) && options.urls.length ? options.urls : DEFAULT_URLS
  if (rawUrls.length < 1 || rawUrls.length > 50) throw new Error('Warmup requires between 1 and 50 URLs')
  const urls = []
  for (const value of rawUrls) urls.push(await validateUrl(value))
  const id = `warmup-${crypto.randomUUID()}`
  const controller = new AbortController()
  activeRuns.set(profileId, { id, controller })
  const db = await getDb()
  db.run('INSERT INTO warmup_runs (id, profile_id, status, urls_total) VALUES (?, ?, ?, ?)', [id, profileId, 'running', urls.length])
  saveDb()

  const wasRunning = browserManager.isRunning(profileId)
  let page = null
  try {
    if (!wasRunning) await browserManager.openProfile(profile, { headless: options.headless !== false, windowLayout: false })
    const entry = browserManager.getEntry(profileId)
    if (!entry) throw new Error('Browser profile could not be started')
    page = await entry.context.newPage()
    const report = await executeSequence(page, urls, {
      dwellMinMs: options.dwellMinMs, dwellMaxMs: options.dwellMaxMs, timeoutMs: options.timeoutMs,
      signal: controller.signal,
      onProgress: (items) => saveRun(id, { urls_completed: items.length, report: JSON.stringify(items) }).catch(() => {}),
    })
    await saveRun(id, { status: 'completed', urls_completed: report.length, report: JSON.stringify(report), finished_at: new Date().toISOString() })
    return { success: true, id, profileId, report }
  } catch (err) {
    const status = controller.signal.aborted ? 'cancelled' : 'failed'
    await saveRun(id, { status, error: String(err.message || err).slice(0, 1000), finished_at: new Date().toISOString() })
    throw err
  } finally {
    if (page) await page.close().catch(() => {})
    if (!wasRunning) await browserManager.closeProfile(profileId).catch(() => {})
    activeRuns.delete(profileId)
  }
}

function cancel(profileId) {
  const active = activeRuns.get(profileId)
  if (!active) return { success: false, error: 'No active warmup for this profile' }
  active.controller.abort()
  return { success: true, id: active.id }
}

async function history(profileId, limit = 20) {
  const db = await getDb()
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20))
  const result = db.exec('SELECT * FROM warmup_runs WHERE profile_id=? ORDER BY started_at DESC LIMIT ?', [profileId, safeLimit])
  if (!result?.[0]) return []
  return result[0].values.map((values) => {
    const row = Object.fromEntries(result[0].columns.map((key, i) => [key, values[i]]))
    try { row.report = JSON.parse(row.report || '[]') } catch { row.report = [] }
    return row
  })
}

module.exports = { DEFAULT_URLS, isPrivateIp, validateUrl, executeSequence, start, cancel, history }
