const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const AdmZip = require('adm-zip')
const profilesRepo = require('./database/profiles')
const proxiesRepo = require('./database/proxies')
const automationManager = require('./automation/manager')
const { addLog } = require('./database/logs')
const { getAutomationsPath, getBrowserDataPath } = require('../shared/paths')

const EXPORT_VERSION = 1
const PACKAGE_TYPE = 'ynlogin-profile-export'
const APP_VERSION = require('../../package.json').version || '1.0.0'

const COMPONENTS = ['settings', 'groups', 'tags', 'proxies', 'automations', 'browser-data']
const CONFLICT_STRATEGIES = ['generate-new', 'skip', 'replace-config']

function getAppVersion() {
  return APP_VERSION
}

function safeConfigProfile(profile) {
  const { browser_data_path: _browser_data_path, proxy: _proxy, status: _status, created_at: _created_at, updated_at: _updated_at, id, ...rest } = profile
  return { id, ...rest }
}

function parseJsonEntry(zip, name) {
  const entry = zip.getEntry(name)
  if (!entry) return null
  try {
    return JSON.parse(entry.getData().toString('utf8'))
  } catch {
    return null
  }
}

function extractDirFromZip(zip, prefix, targetDir) {
  let count = 0
  const root = path.resolve(targetDir)
  for (const entry of zip.getEntries()) {
    if (!entry.entryName.startsWith(prefix)) continue
    const relative = entry.entryName.slice(prefix.length).replace(/\\/g, '/')
    if (!relative) continue
    if (relative.includes('\0') || path.posix.isAbsolute(relative) || /^[A-Za-z]:/.test(relative)) {
      throw new Error(`Unsafe archive entry: ${entry.entryName}`)
    }
    const destPath = path.resolve(root, ...relative.split('/'))
    const relation = path.relative(root, destPath)
    if (relation.startsWith('..') || path.isAbsolute(relation)) {
      throw new Error(`Unsafe archive entry: ${entry.entryName}`)
    }
    if (entry.isDirectory) {
      fs.mkdirSync(destPath, { recursive: true })
      continue
    }
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    fs.writeFileSync(destPath, entry.getData())
    count++
  }
  return count
}

/**
 * Validate an extracted browser data directory before it is used by a profile.
 * Chromium profiles expose Preferences/Local State/Default, Firefox uses prefs.js.
 */
function validateBrowserDataDir(dir) {
  if (!fs.existsSync(dir)) return { valid: false, reason: 'directory does not exist' }
  const entries = fs.readdirSync(dir)
  if (entries.length === 0) return { valid: false, reason: 'directory is empty' }
  const markers = ['Preferences', 'Local State', 'Default', 'Cookies', 'prefs.js', 'user.js', 'xulstore.json']
  const hit = markers.some((m) => fs.existsSync(path.join(dir, m)))
  if (!hit) return { valid: false, reason: 'no recognized browser profile markers', files: entries.length }
  return { valid: true, hitMarker: true, files: entries.length }
}

/**
 * Build a portable profile-export archive containing selected profiles and
 * the components the user opted into. Secrets are never exported: proxy
 * passwords, application secrets and encryption keys are stripped.
 */
async function exportProfiles({ profileIds, options = {}, destPath }) {
  const include = {
    groups: options.includeGroups !== false,
    tags: options.includeTags !== false,
    proxies: options.includeProxies !== false,
    automations: options.includeAutomations !== false,
    browserData: options.includeBrowserData === true,
  }

  const allProfiles = await profilesRepo.getAllProfiles()
  const profileById = new Map(allProfiles.map((profile) => [profile.id, profile]))
  // Preserve the caller's explicit order so import reports map predictably to
  // the profiles selected in the UI (database timestamp ordering is unstable).
  const selected = [...new Set(profileIds)].map((id) => profileById.get(id)).filter(Boolean)
  if (selected.length === 0) throw new Error('No profiles selected for export')

  const zip = new AdmZip()
  const includedComponents = ['settings']
  if (include.groups) includedComponents.push('groups')
  if (include.tags) includedComponents.push('tags')
  if (include.proxies) includedComponents.push('proxies')
  if (include.automations) includedComponents.push('automations')
  if (include.browserData) includedComponents.push('browser-data')

  const manifest = {
    type: PACKAGE_TYPE,
    export_version: EXPORT_VERSION,
    app_version: getAppVersion(),
    exported_at: new Date().toISOString(),
    included_components: includedComponents,
    profiles: selected.map((p) => ({ id: p.id, name: p.name, browser_type: p.browser_type })),
  }

  const groupNames = new Set()
  const tagValues = new Set()
  const proxyIds = new Set()

  for (const profile of selected) {
    const config = safeConfigProfile(profile)
    if (!include.groups) config.group_name = null
    if (!include.tags) config.tags = []
    if (include.proxies && profile.proxy_id) proxyIds.add(profile.proxy_id)
    if (!include.proxies) config.proxy_id = null
    if (profile.group_name) groupNames.add(profile.group_name)
    for (const tag of profile.tags || []) tagValues.add(tag)
    zip.addFile(`profiles/${profile.id}.json`, Buffer.from(JSON.stringify(config, null, 2)))
  }

  // Proxy references — public metadata only, never the password.
  if (include.proxies && proxyIds.size > 0) {
    const allProxies = await proxiesRepo.getAllProxies()
    const referenced = allProxies.filter((p) => proxyIds.has(p.id))
    const proxyConfigs = referenced.map((p) => ({
      id: p.id,
      name: p.name,
      protocol: p.protocol,
      host: p.host,
      port: p.port,
      username: p.username,
      country_code: p.country_code,
      country_name: p.country_name,
      city: p.city,
      timezone: p.timezone,
      geo_metadata: p.geo_metadata || {},
      notes: p.notes,
    }))
    zip.addFile('configs/proxies.json', Buffer.from(JSON.stringify(proxyConfigs, null, 2)))
  }

  if (include.groups && groupNames.size > 0) {
    zip.addFile('configs/groups.json', Buffer.from(JSON.stringify([...groupNames], null, 2)))
  }
  if (include.tags && tagValues.size > 0) {
    zip.addFile('configs/tags.json', Buffer.from(JSON.stringify([...tagValues], null, 2)))
  }

  if (include.automations) {
    const tools = await automationManager.scanAutomations()
    for (const tool of tools) {
      if (tool.valid && fs.existsSync(tool.toolPath)) {
        zip.addLocalFolder(tool.toolPath, `configs/automations/${tool.id}`)
      }
    }
  }

  if (include.browserData) {
    for (const profile of selected) {
      const dataDir = getBrowserDataPath(profile.id)
      if (fs.existsSync(dataDir)) {
        zip.addLocalFolder(dataDir, `optional-browser-data/${profile.id}/browser-data`)
      }
    }
  }

  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)))
  fs.mkdirSync(path.dirname(destPath), { recursive: true })
  zip.writeZip(destPath)

  return {
    path: destPath,
    profiles: selected.length,
    includedComponents,
    fileSize: fs.statSync(destPath).size,
  }
}

/**
 * Read an export archive without importing anything. Used by the UI to show
 * manifest details and existing profile-ID conflicts before deciding.
 */
async function inspectExport(archivePath) {
  if (!fs.existsSync(archivePath)) {
    return { success: false, error: 'Export file does not exist' }
  }
  let zip
  try {
    zip = new AdmZip(archivePath)
  } catch (err) {
    return { success: false, error: 'Archive is corrupt: ' + (err.message || 'unknown error') }
  }
  const manifest = parseJsonEntry(zip, 'manifest.json')
  if (!manifest || manifest.type !== PACKAGE_TYPE) {
    return { success: false, error: 'Not a valid YNlogin profile export' }
  }
  const profiles = (manifest.profiles || []).map((p) => ({ ...p, config: parseJsonEntry(zip, `profiles/${p.id}.json`) }))
  const conflicts = []
  for (const p of profiles) {
    const existing = await profilesRepo.getProfileById(p.id)
    if (existing) conflicts.push({ id: p.id, name: p.name })
  }
  return {
    success: true,
    manifest,
    profiles,
    conflicts,
    hasBrowserData: manifest.included_components.includes('browser-data'),
  }
}

function strategyFor(strategies, profileId) {
  if (!strategies) return 'generate-new'
  if (typeof strategies === 'string') return strategies
  if (typeof strategies === 'object' && strategies !== null) {
    if (Array.isArray(strategies.generateNew) && strategies.generateNew.includes(profileId)) return 'generate-new'
    if (Array.isArray(strategies.skip) && strategies.skip.includes(profileId)) return 'skip'
    if (Array.isArray(strategies.replaceConfig) && strategies.replaceConfig.includes(profileId)) return 'replace-config'
    if (strategies.default) return strategies.default
  }
  return 'generate-new'
}

/**
 * Import a profile export archive. Never crashes on a corrupt package and
 * never silently overwrites browser data.
 */
async function importProfiles(archivePath, strategies = {}) {
  if (!fs.existsSync(archivePath)) {
    return { success: false, error: 'Export file does not exist' }
  }

  const report = {
    success: true,
    imported: [],
    skipped: [],
    replaced: [],
    generatedNewIds: [],
    warnings: [],
    errors: [],
  }

  let zip
  try {
    zip = new AdmZip(archivePath)
  } catch (err) {
    return { success: false, error: 'Archive is corrupt: ' + (err.message || 'unknown error') }
  }

  const manifest = parseJsonEntry(zip, 'manifest.json')
  if (!manifest || manifest.type !== PACKAGE_TYPE) {
    return { success: false, error: 'Not a valid YNlogin profile export' }
  }
  if (typeof manifest.export_version !== 'number' || manifest.export_version > EXPORT_VERSION) {
    return {
      success: false,
      error: `Export version ${manifest.export_version} is newer than supported (${EXPORT_VERSION}). Please update the app.`,
    }
  }

  const included = new Set(manifest.included_components || [])
  const profileRefs = manifest.profiles || []

  await addLog({ action: 'profile-import', status: 'info', message: `Import started: ${profileRefs.length} profile(s) from ${path.basename(archivePath)}` }).catch(() => {})

  // Resolve conflicts first (no writes happen before all conflicts are resolved).
  const pendingConflicts = []
  for (const ref of profileRefs) {
    const existing = await profilesRepo.getProfileById(ref.id)
    if (existing) pendingConflicts.push(ref.id)
  }
  if (pendingConflicts.length > 0 && strategies === 'ask') {
    return { success: true, needsDecision: true, conflicts: pendingConflicts.map((id) => ({ id })) }
  }

  // 1. Import proxy references (public data only, no passwords).
  const proxyIdMap = new Map()
  if (included.has('proxies')) {
    const proxyConfigs = parseJsonEntry(zip, 'configs/proxies.json') || []
    for (const proxy of proxyConfigs) {
      try {
        const existing = await proxiesRepo.getProxyById(proxy.id)
        if (existing) {
          proxyIdMap.set(proxy.id, proxy.id)
          continue
        }
        await proxiesRepo.createProxy({
          id: proxy.id,
          name: proxy.name,
          protocol: proxy.protocol,
          host: proxy.host,
          port: proxy.port,
          username: proxy.username,
          password: '',
          country_code: proxy.country_code,
          country_name: proxy.country_name,
          city: proxy.city,
          timezone: proxy.timezone,
          geo_metadata: proxy.geo_metadata || {},
          notes: proxy.notes,
        })
        proxyIdMap.set(proxy.id, proxy.id)
      } catch (err) {
        report.warnings.push(`Proxy "${proxy.name}": ${err.message}`)
      }
    }
  }

  // 2. Import automation configs.
  if (included.has('automations')) {
    const toolsDir = getAutomationsPath()
    fs.mkdirSync(toolsDir, { recursive: true })
    const toolIds = new Set()
    for (const entry of zip.getEntries()) {
      if (!entry.entryName.startsWith('configs/automations/')) continue
      const parts = entry.entryName.split('/')
      if (parts.length < 3 || !parts[2]) continue
      toolIds.add(parts[2])
    }
    for (const toolId of toolIds) {
      try {
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(toolId)) {
          throw new Error('Invalid automation identifier in archive')
        }
        const existing = await automationManager.getTool(toolId)
        if (existing) {
          report.warnings.push(`Automation "${toolId}" already exists — skipped`)
          continue
        }
        const dest = path.join(toolsDir, toolId)
        extractDirFromZip(zip, `configs/automations/${toolId}/`, dest)
        const tool = await automationManager.getTool(toolId)
        if (tool && tool.valid) report.warnings.push(`Automation "${toolId}" imported (disabled until enabled manually)`)
        else report.warnings.push(`Automation "${toolId}" imported but manifest is invalid`)
      } catch (err) {
        report.warnings.push(`Automation "${toolId}": ${err.message}`)
      }
    }
  }

  // 3. Import each profile config.
  for (const ref of profileRefs) {
    try {
      const config = parseJsonEntry(zip, `profiles/${ref.id}.json`) || {}
      const existing = await profilesRepo.getProfileById(ref.id)
      const strategy = strategyFor(strategies, ref.id)

      if (existing) {
        if (strategy === 'skip') {
          report.skipped.push(ref.id)
          continue
        }
        if (strategy === 'replace-config') {
          const browserDataDir = getBrowserDataPath(ref.id)
          const payload = {
            name: config.name,
            group: included.has('groups') ? config.group_name : existing.group_name,
            tags: included.has('tags') ? config.tags : existing.tags,
            notes: config.notes,
            proxy_id: included.has('proxies') ? (config.proxy_id ? proxyIdMap.get(config.proxy_id) || null : null) : existing.proxy_id,
            browser_type: config.browser_type,
            browser_channel: config.browser_channel,
            browser_version: config.browser_version,
            environment: config.environment,
          }
          await profilesRepo.updateProfile(ref.id, payload)
          // Never silently replace existing browser data.
          if (!fs.existsSync(browserDataDir)) fs.mkdirSync(browserDataDir, { recursive: true })
          report.replaced.push(ref.id)
          await addLog({ action: 'profile-import', status: 'info', message: `Replaced configuration for "${config.name || ref.name}" (browser data preserved)` }).catch(() => {})
          continue
        }
      }

      // generate-new (or no conflict): create a fresh profile.
      let newId = ref.id
      let newName = config.name || ref.name
      if (existing) {
        newId = crypto.randomUUID()
        newName = `${newName} (imported)`
        report.generatedNewIds.push(newId)
      }

      await profilesRepo.createProfile({
        id: newId,
        name: newName,
        group: included.has('groups') ? config.group_name : null,
        tags: included.has('tags') ? config.tags : [],
        notes: config.notes,
        proxy_id: included.has('proxies') ? (config.proxy_id ? proxyIdMap.get(config.proxy_id) || null : null) : null,
        browser_type: config.browser_type,
        browser_channel: config.browser_channel,
        browser_version: config.browser_version,
        environment: config.environment,
      })
      report.imported.push(newId)

      // Browser data — only for newly created profiles, never on replace-config.
      if (included.has('browser-data')) {
        const sourceDir = `optional-browser-data/${ref.id}/browser-data`
        const hasEntries = zip.getEntries().some((e) => e.entryName.startsWith(`${sourceDir}/`))
        if (hasEntries) {
          const targetDir = getBrowserDataPath(newId)
          extractDirFromZip(zip, `${sourceDir}/`, targetDir)
          const validation = validateBrowserDataDir(targetDir)
          if (validation.valid) {
            report.warnings.push(`Browser data restored for "${newName}" (${validation.files} items)`)
          } else {
            fs.rmSync(targetDir, { recursive: true, force: true })
            fs.mkdirSync(targetDir, { recursive: true })
            report.warnings.push(`Browser data for "${newName}" was invalid (${validation.reason}) — fresh data directory created`)
          }
        } else {
          fs.mkdirSync(getBrowserDataPath(newId), { recursive: true })
        }
      } else {
        fs.mkdirSync(getBrowserDataPath(newId), { recursive: true })
      }

      await addLog({ action: 'profile-import', status: 'info', message: `Imported profile "${newName}" as ${newId}` }).catch(() => {})
    } catch (err) {
      report.errors.push({ id: ref.id, error: err.message })
      report.warnings.push(`Profile "${ref.name}": ${err.message}`)
    }
  }

  await addLog({
    action: 'profile-import',
    status: report.errors.length === 0 ? 'success' : 'warn',
    message: `Import finished: ${report.imported.length} imported, ${report.replaced.length} replaced, ${report.skipped.length} skipped`,
  }).catch(() => {})

  return report
}

module.exports = {
  EXPORT_VERSION,
  PACKAGE_TYPE,
  COMPONENTS,
  CONFLICT_STRATEGIES,
  getAppVersion,
  exportProfiles,
  inspectExport,
  importProfiles,
  validateBrowserDataDir,
  extractDirFromZip,
}
