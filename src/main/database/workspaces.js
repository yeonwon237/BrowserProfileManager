const crypto = require('crypto')
const { getDb, saveDb } = require('./index')

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

function parseJson(val, fallback = {}) {
  if (!val) return fallback
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val
    return typeof parsed === 'object' && parsed !== null ? parsed : fallback
  } catch {
    return fallback
  }
}

function formatWorkspace(row) {
  if (!row) return null
  return {
    ...row,
    is_default: Boolean(row.is_default),
    is_archived: Boolean(row.is_archived),
    default_browser_settings: parseJson(row.default_browser_settings, {}),
    default_automation_settings: parseJson(row.default_automation_settings, {}),
  }
}

async function getAllWorkspaces(options = {}) {
  const db = await getDb()
  const includeArchived = Boolean(options.includeArchived)
  const where = includeArchived ? '' : 'WHERE is_archived = 0'
  const rows = toArray(db.exec(`SELECT * FROM workspaces ${where} ORDER BY is_default DESC, created_at ASC`))

  // Attach profile counts per workspace
  const profileCounts = toArray(
    db.exec(`SELECT workspace_id, COUNT(*) as count FROM profiles GROUP BY workspace_id`)
  )
  const countMap = new Map(profileCounts.map((r) => [r.workspace_id || 'default', Number(r.count || 0)]))

  return rows.map((row) => ({
    ...formatWorkspace(row),
    profile_count: countMap.get(row.id) || 0,
  }))
}

async function getWorkspaceById(id) {
  const db = await getDb()
  const row = toObject(db.exec('SELECT * FROM workspaces WHERE id = ?', [id]))
  if (!row) return null

  const profileCountRow = toObject(
    db.exec('SELECT COUNT(*) as count FROM profiles WHERE workspace_id = ?', [id])
  )
  return {
    ...formatWorkspace(row),
    profile_count: profileCountRow ? Number(profileCountRow.count || 0) : 0,
  }
}

async function createWorkspace(data = {}) {
  const db = await getDb()
  const id = data.id || crypto.randomUUID()
  const name = (data.name || 'Untitled Workspace').trim()
  const description = data.description || null
  const browserSettings = JSON.stringify(data.default_browser_settings || {})
  const autoSettings = JSON.stringify(data.default_automation_settings || {})

  db.run(
    `INSERT INTO workspaces (id, name, description, default_browser_settings, default_automation_settings, is_default, is_archived)
     VALUES (?, ?, ?, ?, ?, 0, 0)`,
    [id, name, description, browserSettings, autoSettings]
  )
  saveDb()
  return getWorkspaceById(id)
}

async function updateWorkspace(id, data = {}) {
  const db = await getDb()
  const existing = await getWorkspaceById(id)
  if (!existing) throw new Error('Workspace not found')

  const name = data.name !== undefined ? String(data.name).trim() : existing.name
  const description = data.description !== undefined ? data.description : existing.description
  const browserSettings =
    data.default_browser_settings !== undefined
      ? JSON.stringify(data.default_browser_settings || {})
      : JSON.stringify(existing.default_browser_settings || {})
  const autoSettings =
    data.default_automation_settings !== undefined
      ? JSON.stringify(data.default_automation_settings || {})
      : JSON.stringify(existing.default_automation_settings || {})

  db.run(
    `UPDATE workspaces SET
       name = ?,
       description = ?,
       default_browser_settings = ?,
       default_automation_settings = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [name, description, browserSettings, autoSettings, id]
  )
  saveDb()
  return getWorkspaceById(id)
}

async function duplicateWorkspace(id, data = {}) {
  const source = await getWorkspaceById(id)
  if (!source) throw new Error('Source workspace not found')

  return createWorkspace({
    name: data.name || `${source.name} (Copy)`,
    description: source.description,
    default_browser_settings: source.default_browser_settings,
    default_automation_settings: source.default_automation_settings,
  })
}

async function archiveWorkspace(id, archived = true) {
  const existing = await getWorkspaceById(id)
  if (!existing) throw new Error('Workspace not found')
  if (existing.is_default && archived) {
    throw new Error('Default workspace cannot be archived')
  }

  const db = await getDb()
  db.run(
    `UPDATE workspaces SET is_archived = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [archived ? 1 : 0, id]
  )
  saveDb()
  return getWorkspaceById(id)
}

async function deleteWorkspace(id, options = {}) {
  const existing = await getWorkspaceById(id)
  if (!existing) return { success: false, error: 'Workspace not found' }
  if (existing.is_default || id === 'default') {
    throw new Error('Default workspace cannot be deleted')
  }

  const db = await getDb()
  const targetWorkspaceId = options.targetWorkspaceId || 'default'
  if (targetWorkspaceId === id) throw new Error('Target workspace must be different from the workspace being deleted')
  const target = await getWorkspaceById(targetWorkspaceId)
  if (!target) throw new Error('Target workspace does not exist')

  // Never delete browser data! Safely reassign profiles and configs to target workspace
  db.run('BEGIN TRANSACTION')
  try {
    db.run(`UPDATE profiles SET workspace_id = ? WHERE workspace_id = ?`, [targetWorkspaceId, id])
    db.run(`UPDATE proxies SET workspace_id = ? WHERE workspace_id = ?`, [targetWorkspaceId, id])
    db.run(`UPDATE environment_presets SET workspace_id = ? WHERE workspace_id = ?`, [targetWorkspaceId, id])

    const autoCols = (db.exec('PRAGMA table_info(automations)')[0] || { values: [] }).values.map((r) => r[1])
    if (autoCols.includes('workspace_id')) {
      db.run(`UPDATE automations SET workspace_id = ? WHERE workspace_id = ?`, [targetWorkspaceId, id])
    }

    db.run('DELETE FROM workspaces WHERE id = ?', [id])
    db.run('COMMIT')
  } catch (err) {
    try { db.run('ROLLBACK') } catch { /* no-op */ }
    throw err
  }
  saveDb()

  return { success: true, movedTo: targetWorkspaceId }
}

function seedDefaultWorkspace(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      default_browser_settings TEXT DEFAULT '{}',
      default_automation_settings TEXT DEFAULT '{}',
      is_default INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    INSERT OR IGNORE INTO workspaces (id, name, description, is_default, is_archived)
    VALUES ('default', 'Default Workspace', 'Primary default workspace', 1, 0)
  `)
}

module.exports = {
  getAllWorkspaces,
  getWorkspaceById,
  createWorkspace,
  updateWorkspace,
  duplicateWorkspace,
  archiveWorkspace,
  deleteWorkspace,
  seedDefaultWorkspace,
}
