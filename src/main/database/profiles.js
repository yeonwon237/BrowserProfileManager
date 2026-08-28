const fs = require('fs')
const crypto = require('crypto')
const { getDb, saveDb } = require('./index')
const { getProfileFolderPath, getBrowserDataPath } = require('../../shared/paths')
const { ensureIdentity } = require('../browser/profileIdentity')

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

function parseTags(value) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseEnvironment(value) {
  if (!value) return { mode: 'default' }
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return typeof parsed === 'object' && parsed !== null ? parsed : { mode: 'default' }
  } catch {
    return { mode: 'default' }
  }
}

function ensureProfileFolder(profileId) {
  const dataPath = getBrowserDataPath(profileId)
  fs.mkdirSync(dataPath, { recursive: true })
  return dataPath
}

function publicProxy(row) {
  if (!row) return null
  const { encrypted_password, ...rest } = row
  return { ...rest, has_password: Boolean(encrypted_password) }
}

function attachProxies(db, profiles) {
  if (profiles.length === 0) return profiles
  const proxyIds = [...new Set(profiles.map((p) => p.proxy_id).filter(Boolean))]
  if (proxyIds.length === 0) return profiles.map((p) => ({ ...p, proxy: null }))

  const placeholders = proxyIds.map(() => '?').join(', ')
  const rows = toArray(db.exec(`SELECT * FROM proxies WHERE id IN (${placeholders})`, proxyIds))
  const byId = new Map(rows.map((r) => [r.id, publicProxy(r)]))

  return profiles.map((p) => ({
    ...p,
    proxy: p.proxy_id ? byId.get(p.proxy_id) || null : null,
  }))
}

async function getAllProfiles(options = {}) {
  const db = await getDb()
  let query = 'SELECT * FROM profiles'
  const params = []
  if (options && options.workspace_id) {
    query += ' WHERE workspace_id = ?'
    params.push(options.workspace_id)
  }
  query += ' ORDER BY created_at DESC'
  const rows = toArray(db.exec(query, params))
  return attachProxies(
    db,
    rows.map((row) => ({
      ...row,
      workspace_id: row.workspace_id || 'default',
      tags: parseTags(row.tags),
      environment: parseEnvironment(row.environment),
    }))
  )
}

async function getProfileById(id) {
  const db = await getDb()
  const row = toObject(db.exec('SELECT * FROM profiles WHERE id = ?', [id]))
  if (!row) return null
  return attachProxies(db, [
    {
      ...row,
      workspace_id: row.workspace_id || 'default',
      tags: parseTags(row.tags),
      environment: parseEnvironment(row.environment),
    },
  ])[0]
}

async function createProfile(data = {}) {
  const db = await getDb()
  const id = data.id || crypto.randomUUID()
  const dataPath = ensureProfileFolder(id)

  const browserType = data.browser_type || 'chromium'
  const browserChannel = data.browser_channel || (browserType === 'chrome' ? 'chrome' : browserType === 'msedge' || browserType === 'edge' ? 'msedge' : null)
  const browserVersion = data.browser_version || null
  let rawEnvironment = data.environment
  if (typeof rawEnvironment === 'string') {
    try { rawEnvironment = JSON.parse(rawEnvironment) } catch { rawEnvironment = { mode: 'default' } }
  }
  const environment = JSON.stringify(ensureIdentity(id, rawEnvironment || { mode: 'default' }, browserType))
  const workspaceId = data.workspace_id || 'default'

  db.run(
    `INSERT INTO profiles (id, name, group_name, tags, notes, browser_data_path, proxy_id, workspace_id, browser_type, browser_channel, browser_version, environment, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle')`,
    [
      id,
      data.name || 'Untitled Profile',
      data.group || null,
      JSON.stringify(Array.isArray(data.tags) ? data.tags : []),
      data.notes || null,
      dataPath,
      data.proxy_id || null,
      workspaceId,
      browserType,
      browserChannel,
      browserVersion,
      environment,
    ]
  )
  saveDb()
  return await getProfileById(id)
}

async function updateProfile(id, data = {}) {
  const db = await getDb()
  const existing = await getProfileById(id)
  if (!existing) throw new Error('Profile not found')

  const browserType = data.browser_type !== undefined ? data.browser_type : (existing.browser_type || 'chromium')
  let browserChannel = data.browser_channel !== undefined ? data.browser_channel : existing.browser_channel
  if (data.browser_type && data.browser_channel === undefined) {
    browserChannel = browserType === 'chrome' ? 'chrome' : browserType === 'msedge' || browserType === 'edge' ? 'msedge' : null
  }
  const browserVersion = data.browser_version !== undefined ? data.browser_version : existing.browser_version
  const environment = data.environment !== undefined
    ? (typeof data.environment === 'object' && data.environment !== null ? JSON.stringify(data.environment) : String(data.environment))
    : JSON.stringify(existing.environment || { mode: 'default' })
  const workspaceId = data.workspace_id !== undefined ? data.workspace_id : (existing.workspace_id || 'default')

  const nextProxyId = data.proxy_id === undefined ? existing.proxy_id : data.proxy_id
  const proxyChanged = data.proxy_id !== undefined && data.proxy_id !== existing.proxy_id

  db.run(
    `UPDATE profiles SET
       name = ?,
       group_name = ?,
       tags = ?,
       notes = ?,
       proxy_id = ?,
       workspace_id = ?,
       browser_type = ?,
       browser_channel = ?,
       browser_version = ?,
       environment = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      data.name ?? existing.name,
      data.group ?? existing.group_name,
      JSON.stringify(Array.isArray(data.tags) ? data.tags : Array.isArray(existing.tags) ? existing.tags : parseTags(data.tags ?? existing.tags)),
      data.notes ?? existing.notes,
      nextProxyId,
      workspaceId,
      browserType,
      browserChannel,
      browserVersion,
      environment,
      id,
    ]
  )
  saveDb()

  // Auto-sync timezone/locale when a proxy is newly assigned (or changed).
  // Skip if the caller already supplied a custom environment in this update.
  if (proxyChanged && nextProxyId && data.environment === undefined) {
    try {
      await require('../browser/environmentAlign').alignEnvironmentToProxy(id)
    } catch {
      // alignment is best-effort; profile update already succeeded
    }
  }

  return await getProfileById(id)
}

async function deleteProfile(id, options = {}) {
  const db = await getDb()
  const existing = await getProfileById(id)
  if (!existing) return { success: false, error: 'Profile not found' }

  try {
    const browserManager = require('../browser/manager')
    browserManager.cancelPendingLaunch(id)
  } catch {
    // ignore
  }

  db.run('DELETE FROM profiles WHERE id = ?', [id])
  saveDb()

  if (options.deleteData) {
    const folder = getProfileFolderPath(id)
    if (fs.existsSync(folder)) {
      fs.rmSync(folder, { recursive: true, force: true })
    }
  }

  return { success: true, deletedData: Boolean(options.deleteData) }
}

async function duplicateProfile(id, data = {}) {
  const db = await getDb()
  const source = await getProfileById(id)
  if (!source) throw new Error('Profile not found')

  const newId = crypto.randomUUID()
  const dataPath = ensureProfileFolder(newId)
  const baseName = data.name || `${source.name} (copy)`
  const environment = JSON.stringify(source.environment || { mode: 'default' })
  const workspaceId = data.workspace_id || source.workspace_id || 'default'

  db.run(
    `INSERT INTO profiles (id, name, group_name, tags, notes, browser_data_path, proxy_id, workspace_id, browser_type, browser_channel, browser_version, environment, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle')`,
    [
      newId,
      baseName,
      source.group_name,
      JSON.stringify(source.tags),
      source.notes,
      dataPath,
      source.proxy_id,
      workspaceId,
      source.browser_type || 'chromium',
      source.browser_channel || null,
      source.browser_version || null,
      environment,
    ]
  )
  saveDb()

  return getProfileById(newId)
}

async function clearProfileSessionData(id) {
  const existing = await getProfileById(id)
  if (!existing) throw new Error('Profile not found')

  // Close browser instance if currently open
  try {
    const browserManager = require('../browser/manager')
    if (browserManager.isRunning(id)) {
      await browserManager.closeProfile(id)
    }
  } catch {
    // ignore
  }

  const folder = existing.browser_data_path || getProfileFolderPath(id)
  if (fs.existsSync(folder)) {
    try {
      fs.rmSync(folder, { recursive: true, force: true })
    } catch (err) {
      // ignore
    }
  }
  const sessionStatePath = require('path').join(require('path').dirname(folder), 'session-state.enc')
  if (fs.existsSync(sessionStatePath)) {
    fs.rmSync(sessionStatePath, { force: true })
  }
  ensureProfileFolder(id)

  return { success: true, message: `Session storage and cookies cleared for "${existing.name}"` }
}

async function setProfileStatus(id, status) {
  const db = await getDb()
  const existing = await getProfileById(id)
  if (!existing) return null

  db.run(
    `UPDATE profiles SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, id]
  )
  saveDb()
  return getProfileById(id)
}

async function resetTransientStatuses() {
  const db = await getDb()
  db.run(
    `UPDATE profiles SET status = 'idle', updated_at = CURRENT_TIMESTAMP
     WHERE status IN ('running', 'queued')`
  )
  saveDb()
  return { success: true }
}

async function bulkSetGroup(ids, group) {
  const db = await getDb()
  if (!Array.isArray(ids) || ids.length === 0) return { success: true, updated: 0 }

  const placeholders = ids.map(() => '?').join(', ')
  db.run(
    `UPDATE profiles SET group_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
    [group || null, ...ids]
  )
  saveDb()
  return { success: true, updated: ids.length }
}

async function bulkDelete(ids, options = {}) {
  const db = await getDb()
  if (!Array.isArray(ids) || ids.length === 0) return { success: true, deleted: 0 }

  try {
    const browserManager = require('../browser/manager')
    for (const id of ids) browserManager.cancelPendingLaunch(id)
  } catch {
    // ignore
  }

  const placeholders = ids.map(() => '?').join(', ')
  db.run(`DELETE FROM profiles WHERE id IN (${placeholders})`, ids)
  saveDb()

  if (options.deleteData) {
    for (const id of ids) {
      const folder = getProfileFolderPath(id)
      if (fs.existsSync(folder)) {
        fs.rmSync(folder, { recursive: true, force: true })
      }
    }
  }

  return { success: true, deleted: ids.length, deletedData: Boolean(options.deleteData) }
}

async function bulkSetWorkspace(ids, workspaceId) {
  const db = await getDb()
  if (!Array.isArray(ids) || ids.length === 0) return { success: true, updated: 0 }

  const targetId = workspaceId || 'default'
  const placeholders = ids.map(() => '?').join(', ')
  db.run(
    `UPDATE profiles SET workspace_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
    [targetId, ...ids]
  )
  saveDb()
  return { success: true, updated: ids.length }
}

module.exports = {
  getAllProfiles,
  getProfileById,
  createProfile,
  updateProfile,
  deleteProfile,
  duplicateProfile,
  clearProfileSessionData,
  setProfileStatus,
  resetTransientStatuses,
  bulkSetGroup,
  bulkSetWorkspace,
  bulkDelete,
}
