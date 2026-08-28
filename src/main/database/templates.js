const crypto = require('crypto')
const { getDb, saveDb } = require('./index')
const profilesRepo = require('./profiles')
const proxiesRepo = require('./proxies')

// A curated pool of realistic browser environments (platform, locale, timezone,
// viewport). Used to make bulk-created profiles visibly DIFFERENT from each
// other instead of every profile inheriting the same default locale / timezone.
const ENVIRONMENT_POOL = [
  { platform: 'windows', locale: 'vi-VN', languages: ['vi-VN', 'vi'], timezone: 'Asia/Ho_Chi_Minh', viewport: { width: 1366, height: 768 } },
  { platform: 'windows', locale: 'en-US', languages: ['en-US', 'en'], timezone: 'America/New_York', viewport: { width: 1920, height: 1080 } },
  { platform: 'windows', locale: 'ko-KR', languages: ['ko-KR', 'ko'], timezone: 'Asia/Seoul', viewport: { width: 1440, height: 900 } },
  { platform: 'windows', locale: 'ja-JP', languages: ['ja-JP', 'ja'], timezone: 'Asia/Tokyo', viewport: { width: 1536, height: 864 } },
  { platform: 'windows', locale: 'th-TH', languages: ['th-TH', 'th'], timezone: 'Asia/Bangkok', viewport: { width: 1366, height: 768 } },
  { platform: 'windows', locale: 'fr-FR', languages: ['fr-FR', 'fr'], timezone: 'Europe/Paris', viewport: { width: 1920, height: 1080 } },
  { platform: 'windows', locale: 'de-DE', languages: ['de-DE', 'de'], timezone: 'Europe/Berlin', viewport: { width: 1440, height: 900 } },
  { platform: 'windows', locale: 'es-ES', languages: ['es-ES', 'es'], timezone: 'Europe/Madrid', viewport: { width: 1536, height: 864 } },
  { platform: 'windows', locale: 'pt-BR', languages: ['pt-BR', 'pt'], timezone: 'America/Sao_Paulo', viewport: { width: 1366, height: 768 } },
  { platform: 'windows', locale: 'id-ID', languages: ['id-ID', 'id'], timezone: 'Asia/Jakarta', viewport: { width: 1920, height: 1080 } },
  { platform: 'windows', locale: 'tr-TR', languages: ['tr-TR', 'tr'], timezone: 'Europe/Istanbul', viewport: { width: 1440, height: 900 } },
  { platform: 'windows', locale: 'en-GB', languages: ['en-GB', 'en'], timezone: 'Europe/London', viewport: { width: 1536, height: 864 } },
]

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

function formatTemplate(row) {
  if (!row) return null
  return {
    ...row,
    tags: Array.isArray(parseJson(row.tags, [])) ? parseJson(row.tags, []) : [],
    environment: parseJson(row.environment, { mode: 'default' }),
    automation_defaults: parseJson(row.automation_defaults, {}),
  }
}

async function getAllTemplates(options = {}) {
  const db = await getDb()
  let query = 'SELECT * FROM profile_templates'
  const params = []
  if (options && options.workspace_id) {
    query += ' WHERE workspace_id IS NULL OR workspace_id = ? OR workspace_id = "default"'
    params.push(options.workspace_id)
  }
  query += ' ORDER BY created_at DESC'
  const rows = toArray(db.exec(query, params))
  return rows.map(formatTemplate)
}

async function getTemplateById(id) {
  const db = await getDb()
  const row = toObject(db.exec('SELECT * FROM profile_templates WHERE id = ?', [id]))
  return formatTemplate(row)
}

async function createTemplate(data = {}) {
  const db = await getDb()
  const id = data.id || crypto.randomUUID()
  const name = (data.name || 'Untitled Template').trim()
  const description = data.description || null
  const workspaceId = data.workspace_id || 'default'
  const browserType = data.browser_type || 'chromium'
  const browserChannel = data.browser_channel || null
  const browserVersion = data.browser_version || null
  const environment = JSON.stringify(data.environment || { mode: 'default' })
  const proxyId = data.proxy_id || null
  const tags = JSON.stringify(Array.isArray(data.tags) ? data.tags : [])
  const groupName = data.group_name || data.group || null
  const notesTemplate = data.notes_template || data.notes || null
  const autoDefaults = JSON.stringify(data.automation_defaults || {})

  db.run(
    `INSERT INTO profile_templates (
       id, name, description, workspace_id, browser_type, browser_channel,
       browser_version, environment, proxy_id, tags, group_name, notes_template,
       automation_defaults
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      description,
      workspaceId,
      browserType,
      browserChannel,
      browserVersion,
      environment,
      proxyId,
      tags,
      groupName,
      notesTemplate,
      autoDefaults,
    ]
  )
  saveDb()
  return getTemplateById(id)
}

async function updateTemplate(id, data = {}) {
  const db = await getDb()
  const existing = await getTemplateById(id)
  if (!existing) throw new Error('Template not found')

  const name = data.name !== undefined ? String(data.name).trim() : existing.name
  const description = data.description !== undefined ? data.description : existing.description
  const workspaceId = data.workspace_id !== undefined ? data.workspace_id : existing.workspace_id
  const browserType = data.browser_type !== undefined ? data.browser_type : existing.browser_type
  const browserChannel = data.browser_channel !== undefined ? data.browser_channel : existing.browser_channel
  const browserVersion = data.browser_version !== undefined ? data.browser_version : existing.browser_version
  const environment =
    data.environment !== undefined
      ? JSON.stringify(data.environment)
      : JSON.stringify(existing.environment)
  const proxyId = data.proxy_id !== undefined ? data.proxy_id : existing.proxy_id
  const tags =
    data.tags !== undefined
      ? JSON.stringify(Array.isArray(data.tags) ? data.tags : [])
      : JSON.stringify(existing.tags)
  const groupName =
    data.group_name !== undefined
      ? data.group_name
      : data.group !== undefined
      ? data.group
      : existing.group_name
  const notesTemplate =
    data.notes_template !== undefined ? data.notes_template : existing.notes_template
  const autoDefaults =
    data.automation_defaults !== undefined
      ? JSON.stringify(data.automation_defaults)
      : JSON.stringify(existing.automation_defaults)

  db.run(
    `UPDATE profile_templates SET
       name = ?,
       description = ?,
       workspace_id = ?,
       browser_type = ?,
       browser_channel = ?,
       browser_version = ?,
       environment = ?,
       proxy_id = ?,
       tags = ?,
       group_name = ?,
       notes_template = ?,
       automation_defaults = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      name,
      description,
      workspaceId,
      browserType,
      browserChannel,
      browserVersion,
      environment,
      proxyId,
      tags,
      groupName,
      notesTemplate,
      autoDefaults,
      id,
    ]
  )
  saveDb()
  return getTemplateById(id)
}

async function deleteTemplate(id) {
  const db = await getDb()
  db.run('DELETE FROM profile_templates WHERE id = ?', [id])
  saveDb()
  return { success: true }
}

async function duplicateTemplate(id, data = {}) {
  const source = await getTemplateById(id)
  if (!source) throw new Error('Template not found')

  return createTemplate({
    name: data.name || `${source.name} (Copy)`,
    description: source.description,
    workspace_id: source.workspace_id,
    browser_type: source.browser_type,
    browser_channel: source.browser_channel,
    browser_version: source.browser_version,
    environment: source.environment,
    proxy_id: source.proxy_id,
    tags: source.tags,
    group_name: source.group_name,
    notes_template: source.notes_template,
    automation_defaults: source.automation_defaults,
  })
}

/**
 * Creates a template from an existing profile.
 * STRICT SAFETY RULE: NEVER copies session, cookies, tokens, or browser data path!
 */
async function createTemplateFromProfile(profileId, templateData = {}) {
  const profile = await profilesRepo.getProfileById(profileId)
  if (!profile) throw new Error('Source profile not found')

  return createTemplate({
    name: templateData.name || `Template from ${profile.name}`,
    description: templateData.description || `Created from profile "${profile.name}"`,
    workspace_id: templateData.workspace_id || profile.workspace_id || 'default',
    browser_type: profile.browser_type || 'chromium',
    browser_channel: profile.browser_channel || null,
    browser_version: profile.browser_version || null,
    environment: profile.environment || { mode: 'default' },
    proxy_id: profile.proxy_id || null,
    tags: Array.isArray(profile.tags) ? [...profile.tags] : [],
    group_name: profile.group_name || null,
    notes_template: profile.notes || null,
    automation_defaults: {},
  })
}

/**
 * Creates a brand-new profile from a template.
 * Generates fresh UUID, independent browser data folder, zero legacy session state.
 */
async function createProfileFromTemplate(templateId, overrides = {}) {
  const template = await getTemplateById(templateId)
  if (!template) throw new Error('Template not found')

  const profileData = {
    name: overrides.name || `${template.name} Profile`,
    group: overrides.group !== undefined ? overrides.group : template.group_name,
    workspace_id: overrides.workspace_id || template.workspace_id || 'default',
    tags: overrides.tags !== undefined ? overrides.tags : [...template.tags],
    notes: overrides.notes !== undefined ? overrides.notes : template.notes_template,
    proxy_id: overrides.proxy_id !== undefined ? overrides.proxy_id : template.proxy_id,
    browser_type: overrides.browser_type || template.browser_type,
    browser_channel: overrides.browser_channel !== undefined ? overrides.browser_channel : template.browser_channel,
    browser_version: overrides.browser_version !== undefined ? overrides.browser_version : template.browser_version,
    environment: overrides.environment ? { ...template.environment, ...overrides.environment } : { ...template.environment },
  }

  return profilesRepo.createProfile(profileData)
}

/**
 * Bulk creates N profiles from a template with a customizable name pattern.
 * Pattern supports {number} (auto zero-padded based on count), {index} (1, 2, ...), {template}.
 * Never launches any browser instances during bulk create.
 */
async function bulkCreateProfiles({
  templateId,
  count = 1,
  namePattern = 'Account-{number}',
  namingMode = 'pattern',
  customNames = [],
  workspaceId,
  groupName,
  tags,
  notes,
  browserType = 'chromium',
  browserChannel = null,
  proxyId = null,
  assignRandomProxy = false,
  environment = { mode: 'default' },
} = {}) {
  const template = templateId ? await getTemplateById(templateId) : null
  if (templateId && !template) throw new Error('Template not found')

  const suppliedNames = Array.isArray(customNames)
    ? customNames.map((name) => String(name).trim()).filter(Boolean).slice(0, 500)
    : []
  const total = namingMode === 'list' && suppliedNames.length
    ? suppliedNames.length
    : Math.max(1, Math.min(Number(count) || 1, 500))
  const padLength = Math.max(3, String(total).length)
  const pattern = namePattern || 'Account-{number}'

  const createdProfiles = []

  for (let i = 1; i <= total; i++) {
    const numStr = String(i).padStart(padLength, '0')
    const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase()
    const profileName = namingMode === 'list' && suppliedNames[i - 1]
      ? suppliedNames[i - 1]
      : namingMode === 'random'
        ? `${pattern.replace(/\{number\}|\{index\}/gi, '').replace(/\{template\}/gi, template?.name || 'Profile').replace(/[-_ ]+$/g, '') || 'Profile'}-${randomSuffix}`
        : pattern
          .replace(/\{number\}/gi, numStr)
          .replace(/\{index\}/gi, String(i))
          .replace(/\{template\}/gi, template?.name || 'Profile')

    const overrides = {
      name: profileName,
      workspace_id: workspaceId || template?.workspace_id || 'default',
      group: groupName !== undefined ? groupName : template?.group_name,
      tags: tags !== undefined ? tags : (template?.tags || []),
      notes: notes !== undefined ? notes : template?.notes_template,
    }
    // Give each custom-created profile a distinct locale/timezone/platform so
    // they don't all look identical on fingerprint checks. Only applied when
    // the caller did NOT explicitly specify an environment.
    const baseEnv = environment && typeof environment === 'object' ? environment : { mode: 'default' }
    const perProfileEnv = baseEnv && baseEnv.locale
      ? baseEnv
      : { mode: 'custom', ...ENVIRONMENT_POOL[(i - 1) % ENVIRONMENT_POOL.length] }
    const profile = template
      ? await createProfileFromTemplate(templateId, overrides)
      : await profilesRepo.createProfile({
        ...overrides,
        browser_type: browserType || 'chromium',
        browser_channel: browserChannel,
        proxy_id: proxyId || null,
        environment: perProfileEnv,
      })

    // Each created profile can be given its own freshly-generated random proxy
    // so a batch immediately has distinct proxy assignments.
    if (assignRandomProxy && profile && profile.id) {
      try {
        const randomProxy = await proxiesRepo.createRandomProxy({ name: `Proxy ${profileName}` })
        if (randomProxy && randomProxy.id) {
          await profilesRepo.updateProfile(profile.id, { proxy_id: randomProxy.id })
        }
      } catch {
        // proxy generation is best-effort; a batch should still succeed
      }
    }

    createdProfiles.push(profile)
  }

  return {
    success: true,
    created: createdProfiles.length,
    profiles: createdProfiles,
  }
}

function seedDefaultTemplate(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS profile_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      workspace_id TEXT DEFAULT 'default',
      browser_type TEXT NOT NULL DEFAULT 'chromium',
      browser_channel TEXT,
      browser_version TEXT,
      environment TEXT DEFAULT '{}',
      proxy_id TEXT,
      tags TEXT DEFAULT '[]',
      group_name TEXT,
      notes_template TEXT,
      automation_defaults TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

module.exports = {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  createTemplateFromProfile,
  createProfileFromTemplate,
  bulkCreateProfiles,
  seedDefaultTemplate,
}
