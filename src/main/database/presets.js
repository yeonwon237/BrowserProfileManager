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

function parseLanguages(val) {
  if (!val) return ['en-US', 'en']
  try {
    const parsed = JSON.parse(val)
    return Array.isArray(parsed) ? parsed : ['en-US', 'en']
  } catch {
    return ['en-US', 'en']
  }
}

function formatPreset(row) {
  if (!row) return null
  return {
    ...row,
    languages: parseLanguages(row.languages),
    is_default: Boolean(row.is_default),
  }
}

const DEFAULT_PRESETS = [
  {
    id: 'preset-win-std',
    name: 'Desktop Windows (Standard)',
    description: 'Full HD 1080p desktop profile with standard English locale',
    platform: 'windows',
    browser_type: 'chromium',
    locale: 'en-US',
    timezone_mode: 'custom',
    timezone: 'Asia/Ho_Chi_Minh',
    languages: JSON.stringify(['en-US', 'en']),
    viewport_width: 1920,
    viewport_height: 1080,
    device_scale_factor: 1.0,
    color_scheme: 'no-preference',
    reduced_motion: 'no-preference',
    is_default: 1,
  },
  {
    id: 'preset-mac-retina',
    name: 'Desktop macOS (Retina)',
    description: 'High-DPI MacBook Retina viewport (1440x900 @ 2x) with dark theme',
    platform: 'macos',
    browser_type: 'chrome',
    locale: 'en-US',
    timezone_mode: 'custom',
    timezone: 'America/New_York',
    languages: JSON.stringify(['en-US', 'en']),
    viewport_width: 1440,
    viewport_height: 900,
    device_scale_factor: 2.0,
    color_scheme: 'dark',
    reduced_motion: 'no-preference',
    is_default: 1,
  },
  {
    id: 'preset-vn-workspace',
    name: 'Vietnamese Workspace',
    description: 'Vietnamese language, Asia/Ho_Chi_Minh timezone, standard 1080p',
    platform: 'windows',
    browser_type: 'chrome',
    locale: 'vi-VN',
    timezone_mode: 'custom',
    timezone: 'Asia/Ho_Chi_Minh',
    languages: JSON.stringify(['vi-VN', 'vi', 'en-US', 'en']),
    viewport_width: 1920,
    viewport_height: 1080,
    device_scale_factor: 1.0,
    color_scheme: 'light',
    reduced_motion: 'no-preference',
    is_default: 1,
  },
  {
    id: 'preset-tokyo-compact',
    name: 'Tokyo Compact HD',
    description: 'Japanese locale, Asia/Tokyo timezone, compact 720p dark mode',
    platform: 'windows',
    browser_type: 'chromium',
    locale: 'ja-JP',
    timezone_mode: 'custom',
    timezone: 'Asia/Tokyo',
    languages: JSON.stringify(['ja-JP', 'ja', 'en-US']),
    viewport_width: 1280,
    viewport_height: 720,
    device_scale_factor: 1.0,
    color_scheme: 'dark',
    reduced_motion: 'reduce',
    is_default: 1,
  },
]

function seedDefaultPresets(db) {
  const count = db.exec('SELECT COUNT(*) as c FROM environment_presets')
  const total = count && count[0] && count[0].values[0] ? count[0].values[0][0] : 0
  if (total === 0) {
    for (const p of DEFAULT_PRESETS) {
      db.run(
        `INSERT OR IGNORE INTO environment_presets
         (id, name, description, platform, browser_type, locale, timezone_mode, timezone, languages, viewport_width, viewport_height, device_scale_factor, color_scheme, reduced_motion, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.name,
          p.description,
          p.platform,
          p.browser_type,
          p.locale,
          p.timezone_mode,
          p.timezone,
          p.languages,
          p.viewport_width,
          p.viewport_height,
          p.device_scale_factor,
          p.color_scheme,
          p.reduced_motion,
          p.is_default,
        ]
      )
    }
    saveDb()
  }
}

async function getAllPresets() {
  const db = await getDb()
  const rows = toArray(db.exec('SELECT * FROM environment_presets ORDER BY is_default DESC, created_at ASC'))
  return rows.map(formatPreset)
}

async function getPresetById(id) {
  const db = await getDb()
  const row = toObject(db.exec('SELECT * FROM environment_presets WHERE id = ?', [id]))
  return formatPreset(row)
}

async function createPreset(data = {}) {
  const db = await getDb()
  const id = data.id || `preset-${crypto.randomUUID()}`
  const languages = Array.isArray(data.languages) ? JSON.stringify(data.languages) : JSON.stringify(['en-US', 'en'])

  db.run(
    `INSERT INTO environment_presets
     (id, name, description, platform, browser_type, locale, timezone_mode, timezone, languages, viewport_width, viewport_height, device_scale_factor, color_scheme, reduced_motion, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      data.name || 'Custom Preset',
      data.description || null,
      data.platform || 'windows',
      data.browser_type || 'chromium',
      data.locale || 'en-US',
      data.timezone_mode || 'custom',
      data.timezone || 'Asia/Ho_Chi_Minh',
      languages,
      Number(data.viewport_width) || 1920,
      Number(data.viewport_height) || 1080,
      Number(data.device_scale_factor) || 1.0,
      data.color_scheme || 'no-preference',
      data.reduced_motion || 'no-preference',
    ]
  )
  saveDb()
  return getPresetById(id)
}

async function updatePreset(id, data = {}) {
  const db = await getDb()
  const existing = await getPresetById(id)
  if (!existing) throw new Error('Preset not found')

  const languages = data.languages !== undefined
    ? (Array.isArray(data.languages) ? JSON.stringify(data.languages) : JSON.stringify([String(data.languages)]))
    : JSON.stringify(existing.languages)

  db.run(
    `UPDATE environment_presets SET
       name = ?,
       description = ?,
       platform = ?,
       browser_type = ?,
       locale = ?,
       timezone_mode = ?,
       timezone = ?,
       languages = ?,
       viewport_width = ?,
       viewport_height = ?,
       device_scale_factor = ?,
       color_scheme = ?,
       reduced_motion = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      data.name ?? existing.name,
      data.description ?? existing.description,
      data.platform ?? existing.platform,
      data.browser_type ?? existing.browser_type,
      data.locale ?? existing.locale,
      data.timezone_mode ?? existing.timezone_mode,
      data.timezone ?? existing.timezone,
      languages,
      data.viewport_width !== undefined ? Number(data.viewport_width) : existing.viewport_width,
      data.viewport_height !== undefined ? Number(data.viewport_height) : existing.viewport_height,
      data.device_scale_factor !== undefined ? Number(data.device_scale_factor) : existing.device_scale_factor,
      data.color_scheme ?? existing.color_scheme,
      data.reduced_motion ?? existing.reduced_motion,
      id,
    ]
  )
  saveDb()
  return getPresetById(id)
}

async function duplicatePreset(id, data = {}) {
  const source = await getPresetById(id)
  if (!source) throw new Error('Preset not found')

  return createPreset({
    name: data.name || `${source.name} (copy)`,
    description: source.description,
    platform: source.platform,
    browser_type: source.browser_type,
    locale: source.locale,
    timezone_mode: source.timezone_mode,
    timezone: source.timezone,
    languages: source.languages,
    viewport_width: source.viewport_width,
    viewport_height: source.viewport_height,
    device_scale_factor: source.device_scale_factor,
    color_scheme: source.color_scheme,
    reduced_motion: source.reduced_motion,
  })
}

async function deletePreset(id) {
  const db = await getDb()
  db.run('DELETE FROM environment_presets WHERE id = ?', [id])
  saveDb()
  return { success: true }
}

/**
 * Generic Configuration Presets (Browser, Environment, Proxy, Automation Inputs)
 */
function sanitizePresetConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return {}
  const safe = { ...cfg }
  delete safe.cookie
  delete safe.cookies
  delete safe.session
  delete safe.session_state
  delete safe.password
  delete safe.auth_token
  delete safe.token
  delete safe.secret
  delete safe.api_secret
  return safe
}

async function getConfigPresets(options = {}) {
  const db = await getDb()
  let sql = 'SELECT * FROM config_presets'
  const where = []
  const params = []

  if (options.type) {
    where.push('type = ?')
    params.push(options.type)
  }
  if (options.workspace_id && options.workspace_id !== 'all') {
    where.push('(workspace_id = ? OR workspace_id IS NULL OR workspace_id = "")')
    params.push(options.workspace_id)
  }

  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`
  }
  sql += ' ORDER BY created_at DESC'

  const rows = toArray(db.exec(sql, params))
  return rows.map((r) => {
    let parsedConfig = {}
    try { parsedConfig = JSON.parse(r.config) } catch {}
    return {
      ...r,
      config: parsedConfig,
      is_default: Boolean(r.is_default),
    }
  })
}

async function getConfigPresetById(id) {
  const db = await getDb()
  const row = toObject(db.exec('SELECT * FROM config_presets WHERE id = ?', [id]))
  if (!row) return null
  let parsedConfig = {}
  try { parsedConfig = JSON.parse(row.config) } catch {}
  return {
    ...row,
    config: parsedConfig,
    is_default: Boolean(row.is_default),
  }
}

async function createConfigPreset(data = {}) {
  const db = await getDb()
  const id = data.id || `preset-${crypto.randomUUID()}`
  const type = ['browser', 'environment', 'proxy', 'automation_input'].includes(data.type)
    ? data.type
    : 'environment'
  const safeConfig = sanitizePresetConfig(data.config || {})

  db.run(
    `INSERT INTO config_presets (id, type, name, description, workspace_id, config, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      type,
      data.name || 'Untitled Preset',
      data.description || null,
      data.workspace_id || null,
      JSON.stringify(safeConfig),
      data.is_default ? 1 : 0,
    ]
  )
  saveDb()
  return getConfigPresetById(id)
}

async function updateConfigPreset(id, data = {}) {
  const db = await getDb()
  const existing = await getConfigPresetById(id)
  if (!existing) throw new Error('Preset not found')

  const safeConfig = data.config !== undefined ? sanitizePresetConfig(data.config) : existing.config
  const workspaceId = data.workspace_id !== undefined ? (data.workspace_id || null) : existing.workspace_id

  db.run(
    `UPDATE config_presets SET
       name = ?, description = ?, workspace_id = ?, config = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      data.name ?? existing.name,
      data.description !== undefined ? data.description : existing.description,
      workspaceId,
      JSON.stringify(safeConfig),
      id,
    ]
  )
  saveDb()
  return getConfigPresetById(id)
}

async function deleteConfigPreset(id) {
  const db = await getDb()
  db.run('DELETE FROM config_presets WHERE id = ?', [id])
  saveDb()
  return { success: true }
}

module.exports = {
  getAllPresets,
  getPresetById,
  createPreset,
  updatePreset,
  duplicatePreset,
  deletePreset,
  seedDefaultPresets,

  // New Generic Config Presets
  getConfigPresets,
  getConfigPresetById,
  createConfigPreset,
  updateConfigPreset,
  deleteConfigPreset,
}
