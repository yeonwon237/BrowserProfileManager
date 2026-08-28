const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const AdmZip = require('adm-zip')
const { getDb } = require('./database')
const profilesRepo = require('./database/profiles')
const proxiesRepo = require('./database/proxies')
const automationManager = require('./automation/manager')
const {
  getAutomationsPath,
  getBackupsPath,
  getBrowserDataPath,
} = require('../shared/paths')

const BACKUP_VERSION = 1

function safeConfigProfile(profile) {
  const rest = { ...profile }
  delete rest.browser_data_path
  delete rest.proxy
  delete rest.status
  delete rest.created_at
  delete rest.updated_at
  return rest
}

async function exportBackup({ includeBrowserData, destPath }) {
  const profiles = await profilesRepo.getAllProfiles()
  const proxies = await proxiesRepo.getAllProxies()
  const tools = await automationManager.scanAutomations()

  const zip = new AdmZip()

  const manifest = {
    type: 'ynlogin-backup',
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    app: 'YNlogin',
    includeBrowserData: Boolean(includeBrowserData),
    counts: {
      profiles: profiles.length,
      proxies: proxies.length,
      automations: tools.filter((t) => t.valid).length,
    },
  }

  const profileConfigs = profiles.map(safeConfigProfile)
  const proxyConfigs = proxies.map((p) => ({
    id: p.id,
    name: p.name,
    protocol: p.protocol,
    host: p.host,
    port: p.port,
    username: p.username,
    notes: p.notes,
  }))

  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)))
  zip.addFile('profiles.json', Buffer.from(JSON.stringify(profileConfigs, null, 2)))
  zip.addFile('proxies.json', Buffer.from(JSON.stringify(proxyConfigs, null, 2)))

  for (const tool of tools) {
    if (tool.valid && fs.existsSync(tool.toolPath)) {
      zip.addLocalFolder(tool.toolPath, `automations/${tool.id}`)
    }
  }

  if (includeBrowserData) {
    for (const profile of profiles) {
      const dataDir = getBrowserDataPath(profile.id)
      if (fs.existsSync(dataDir)) {
        zip.addLocalFolder(dataDir, `profiles/${profile.id}/browser-data`)
      }
    }
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true })
  zip.writeZip(destPath)

  return {
    path: destPath,
    counts: manifest.counts,
    includeBrowserData: Boolean(includeBrowserData),
    fileSize: fs.statSync(destPath).size,
  }
}

async function backupDatabase() {
  const db = await getDb()
  const data = db.export()
  const backupsDir = getBackupsPath()
  fs.mkdirSync(backupsDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dest = path.join(backupsDir, `data-${stamp}.db`)
  fs.writeFileSync(dest, Buffer.from(data))
  return { path: dest, size: fs.statSync(dest).size }
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

function parseJsonEntry(zip, name) {
  const entry = zip.getEntry(name)
  if (!entry) return null
  try {
    return JSON.parse(entry.getData().toString('utf8'))
  } catch {
    return null
  }
}

async function importBackup(archivePath) {
  if (!fs.existsSync(archivePath)) {
    return { success: false, error: 'Backup file does not exist' }
  }

  const zip = new AdmZip(archivePath)
  const manifest = parseJsonEntry(zip, 'manifest.json')
  if (!manifest || manifest.type !== 'ynlogin-backup') {
    return { success: false, error: 'Not a valid YNlogin backup file' }
  }

  const profileConfigs = parseJsonEntry(zip, 'profiles.json') || []
  const proxyConfigs = parseJsonEntry(zip, 'proxies.json') || []

  const report = {
    success: true,
    profilesImported: 0,
    profilesRenamed: 0,
    proxiesImported: 0,
    proxiesRenamed: 0,
    toolsImported: 0,
    toolsSkipped: 0,
    renamed: [],
    warnings: [],
  }

  // Import proxies first (profiles reference them)
  const proxyIdMap = new Map()
  for (const proxy of proxyConfigs) {
    const existing = await proxiesRepo.getProxyById(proxy.id)
    if (existing) {
      const newId = crypto.randomUUID()
      report.proxiesRenamed++
      await proxiesRepo.createProxy({
        id: newId,
        name: `${proxy.name} (imported)`,
        protocol: proxy.protocol,
        host: proxy.host,
        port: proxy.port,
        username: proxy.username,
        password: '',
        notes: proxy.notes,
      })
      proxyIdMap.set(proxy.id, newId)
      report.renamed.push({ type: 'proxy', old: proxy.id, new: newId })
    } else {
      await proxiesRepo.createProxy({
        id: proxy.id,
        name: proxy.name,
        protocol: proxy.protocol,
        host: proxy.host,
        port: proxy.port,
        username: proxy.username,
        password: '',
        notes: proxy.notes,
      })
      proxyIdMap.set(proxy.id, proxy.id)
      report.proxiesImported++
    }
  }

  for (const profile of profileConfigs) {
    const existing = await profilesRepo.getProfileById(profile.id)
    let finalId = profile.id
    let finalName = profile.name
    if (existing) {
      finalId = crypto.randomUUID()
      finalName = `${profile.name} (imported)`
      report.profilesRenamed++
      report.renamed.push({ type: 'profile', old: profile.id, new: finalId })
    } else {
      report.profilesImported++
    }

    await profilesRepo.createProfile({
      id: finalId,
      name: finalName,
      group: profile.group_name,
      tags: profile.tags,
      notes: profile.notes,
      proxy_id: profile.proxy_id ? proxyIdMap.get(profile.proxy_id) || null : null,
    })

    if (manifest.includeBrowserData) {
      const dataDir = getBrowserDataPath(finalId)
      const count = extractDirFromZip(
        zip,
        `profiles/${profile.id}/browser-data/`,
        dataDir
      )
      if (count === 0 && profile.id === finalId) {
        report.warnings.push(`Profile "${finalName}": no browser data found in backup`)
      }
    }
  }

  // Import automations (skip existing ids to avoid clobbering)
  const toolsDir = getAutomationsPath()
  fs.mkdirSync(toolsDir, { recursive: true })
  const toolEntries = zip.getEntries().filter((e) => e.entryName.startsWith('automations/'))
  const toolIds = new Set()
  for (const entry of toolEntries) {
    const parts = entry.entryName.split('/')
    if (parts.length < 2 || !parts[1]) continue
    toolIds.add(parts[1])
  }
  for (const toolId of toolIds) {
    const existing = await automationManager.getTool(toolId)
    if (existing) {
      report.toolsSkipped++
      report.warnings.push(`Tool "${toolId}" already exists — skipped`)
      continue
    }
    const dest = path.join(toolsDir, toolId)
    extractDirFromZip(zip, `automations/${toolId}/`, dest)
    const tool = await automationManager.getTool(toolId)
    if (tool && tool.valid) {
      report.toolsImported++
    } else {
      report.warnings.push(`Tool "${toolId}" imported but has an invalid manifest`)
    }
  }

  return report
}

module.exports = { exportBackup, backupDatabase, extractDirFromZip, importBackup }
