const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const AdmZip = require('adm-zip')
const { getDb, saveDb } = require('../database')
const { getAppDataPath } = require('../../shared/paths')

const MAX_CRX_BYTES = 100 * 1024 * 1024

function rows(result) {
  if (!result || !result[0]) return []
  return result[0].values.map((values) => Object.fromEntries(result[0].columns.map((key, i) => [key, values[i]])))
}

function inspectDirectory(sourcePath) {
  const resolved = path.resolve(String(sourcePath || ''))
  const manifestPath = path.join(resolved, 'manifest.json')
  if (!fs.existsSync(manifestPath) || !fs.statSync(manifestPath).isFile()) throw new Error('Extension manifest.json was not found')
  const raw = fs.readFileSync(manifestPath)
  if (raw.length > 1024 * 1024) throw new Error('Extension manifest is too large')
  const manifest = JSON.parse(raw.toString('utf8'))
  if (![2, 3].includes(Number(manifest.manifest_version))) throw new Error('Only Chrome Manifest V2/V3 extensions are supported')
  if (!manifest.name || typeof manifest.name !== 'string') throw new Error('Extension manifest name is required')
  const sha256 = crypto.createHash('sha256').update(raw).digest('hex')
  return {
    source_path: resolved,
    name: manifest.name.slice(0, 200),
    version: String(manifest.version || '').slice(0, 50),
    manifest_version: Number(manifest.manifest_version),
    sha256,
    permissions: Array.isArray(manifest.permissions) ? manifest.permissions.map(String).slice(0, 100) : [],
  }
}

async function registerDirectory(sourcePath) {
  const info = inspectDirectory(sourcePath)
  const db = await getDb()
  const existing = rows(db.exec('SELECT id FROM extensions WHERE source_path = ?', [info.source_path]))[0]
  const id = existing?.id || `ext-${crypto.randomUUID()}`
  db.run(`INSERT INTO extensions (id, name, version, manifest_version, source_path, sha256, enabled)
    VALUES (?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, version=excluded.version,
    manifest_version=excluded.manifest_version, sha256=excluded.sha256, updated_at=CURRENT_TIMESTAMP`,
  [id, info.name, info.version, info.manifest_version, info.source_path, info.sha256])
  saveDb()
  return { id, ...info, enabled: true }
}

function extractCrxZip(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16 || buffer.subarray(0, 4).toString('ascii') !== 'Cr24') throw new Error('Invalid CRX header')
  const version = buffer.readUInt32LE(4)
  let offset
  if (version === 2) offset = 16 + buffer.readUInt32LE(8) + buffer.readUInt32LE(12)
  else if (version === 3) offset = 12 + buffer.readUInt32LE(8)
  else throw new Error(`Unsupported CRX version ${version}`)
  if (offset >= buffer.length || buffer.subarray(offset, offset + 2).toString('hex') !== '504b') throw new Error('CRX ZIP payload is invalid')
  return { version, zip: buffer.subarray(offset) }
}

async function registerCrx(crxPath) {
  const resolved = path.resolve(String(crxPath || ''))
  if (path.extname(resolved).toLowerCase() !== '.crx') throw new Error('A .crx file is required')
  const stat = fs.statSync(resolved)
  if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_CRX_BYTES) throw new Error('CRX file size is invalid')
  const source = fs.readFileSync(resolved)
  const digest = crypto.createHash('sha256').update(source).digest('hex')
  const { zip } = extractCrxZip(source)
  const target = path.join(getAppDataPath(), 'extensions', digest)
  fs.mkdirSync(target, { recursive: true })
  const archive = new AdmZip(zip)
  const entries = archive.getEntries()
  if (entries.length === 0 || entries.length > 10_000) throw new Error('CRX archive contents are invalid')
  archive.extractAllTo(target, true)
  try { return await registerDirectory(target) }
  catch (error) { throw new Error(`CRX extension validation failed: ${error.message}`) }
}

async function listExtensions() {
  const db = await getDb()
  return rows(db.exec('SELECT * FROM extensions ORDER BY name COLLATE NOCASE')).map((item) => ({ ...item, enabled: Boolean(item.enabled) }))
}

async function assign(extensionId, scopeType, scopeId, enabled = true) {
  if (!['profile', 'workspace'].includes(scopeType)) throw new Error('Invalid extension assignment scope')
  if (!scopeId || String(scopeId).length > 100) throw new Error('Invalid assignment scope id')
  const db = await getDb()
  if (!rows(db.exec('SELECT id FROM extensions WHERE id = ?', [extensionId]))[0]) throw new Error('Extension not found')
  db.run(`INSERT INTO extension_assignments (extension_id, scope_type, scope_id, enabled) VALUES (?, ?, ?, ?)
    ON CONFLICT(extension_id, scope_type, scope_id) DO UPDATE SET enabled=excluded.enabled`,
  [extensionId, scopeType, scopeId, enabled ? 1 : 0])
  saveDb()
  return { success: true }
}

async function getForProfile(profile) {
  const db = await getDb()
  const result = rows(db.exec(`SELECT DISTINCT e.* FROM extensions e
    JOIN extension_assignments a ON a.extension_id=e.id
    WHERE e.enabled=1 AND a.enabled=1 AND
      ((a.scope_type='profile' AND a.scope_id=?) OR (a.scope_type='workspace' AND a.scope_id=?))`,
  [profile.id, profile.workspace_id || 'default']))
  return result.filter((item) => fs.existsSync(path.join(item.source_path, 'manifest.json')))
}

async function listAssignments(extensionId = null) {
  const db = await getDb()
  const result = extensionId
    ? db.exec('SELECT * FROM extension_assignments WHERE extension_id = ? ORDER BY scope_type, scope_id', [extensionId])
    : db.exec('SELECT * FROM extension_assignments ORDER BY extension_id, scope_type, scope_id')
  return rows(result).map((item) => ({ ...item, enabled: Boolean(item.enabled) }))
}

async function remove(extensionId) {
  const db = await getDb()
  db.run('DELETE FROM extension_assignments WHERE extension_id = ?', [extensionId])
  db.run('DELETE FROM extensions WHERE id = ?', [extensionId])
  saveDb()
  return { success: true }
}

module.exports = { inspectDirectory, registerDirectory, registerCrx, extractCrxZip, listExtensions, assign, getForProfile, listAssignments, remove, MAX_CRX_BYTES }
