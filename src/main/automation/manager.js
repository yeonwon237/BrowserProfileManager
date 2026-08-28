const fs = require('fs')
const path = require('path')
const { getDb, saveDb } = require('../database')
const { getProfileById } = require('../database/profiles')
const { addLog } = require('../database/logs')
const { createRun, addRunLog, finishRun, getRunLogPath } = require('../database/runs')
const browserManager = require('../browser/manager')
const { validateManifest } = require('./manifest')
const { loadPlugin } = require('../security/pluginSandbox')
const { checkManifestCompatibility } = require('../versions')
const { getAutomationsPath, getProfileDownloadsPath, getProfileTempPath, getRunsPath } = require('../../shared/paths')
const leakProtection = require('../browser/leakProtection')

function toArray(result) {
  if (!result || result.length === 0) return []
  const cols = result[0].columns
  return result[0].values.map((row) => {
    const obj = {}
    cols.forEach((col, i) => { obj[col] = row[i] })
    return obj
  })
}

function readManifest(toolDir) {
  const manifestPath = path.join(toolDir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) return null
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch {
    return null
  }
}

// Recursively copy a directory that may live inside an Electron asar archive.
// `fs.cpSync` with recursive:true fails with ENOENT when the source path is
// inside app.asar, so we read + write each file individually.
function copyDirFromAsar(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return false
  fs.mkdirSync(destDir, { recursive: true })
  const entries = fs.readdirSync(srcDir, { withFileTypes: true })
  for (const entry of entries) {
    const src = path.join(srcDir, entry.name)
    const dest = path.join(destDir, entry.name)
    if (entry.isDirectory()) {
      copyDirFromAsar(src, dest)
    } else {
      fs.writeFileSync(dest, fs.readFileSync(src))
    }
  }
  return true
}

async function scanAutomations() {
  const dir = getAutomationsPath()
  fs.mkdirSync(dir, { recursive: true })

  const entries = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory())
  const db = await getDb()
  const stateRows = toArray(db.exec('SELECT * FROM automations'))
  const stateMap = new Map(stateRows.map((r) => [r.id, { enabled: Boolean(r.enabled), tool_path: r.tool_path }]))

  const tools = []
  for (const entry of entries) {
    const toolDir = path.join(dir, entry.name)
    const manifest = readManifest(toolDir)
    const { valid, errors } = validateManifest(toolDir, manifest)
    const id = (manifest && manifest.id) || path.basename(toolDir)
    const state = stateMap.get(id) || {}
    const compat = checkManifestCompatibility(manifest || {})

    tools.push({
      id,
      name: (manifest && manifest.name) || '(invalid tool)',
      version: (manifest && manifest.version) || null,
      description: (manifest && manifest.description) || null,
      runModes: (manifest && manifest.runModes) || [],
      inputSchema: (manifest && manifest.inputSchema) || [],
      permissions: (manifest && manifest.permissions) || [],
      entry: (manifest && manifest.entry) || null,
      enabled: state.enabled !== undefined ? state.enabled : true,
      compatible: compat.compatible,
      compatibilityReason: compat.reason,
      toolPath: toolDir,
      valid,
      errors: errors || [],
    })
  }
  return tools
}

async function importTool(sourceDir) {
  if (!sourceDir || !fs.existsSync(sourceDir)) {
    return { success: false, errors: ['Selected folder does not exist'] }
  }

  const manifest = readManifest(sourceDir)
  if (!manifest) {
    return { success: false, errors: ['No manifest.json found in the selected folder'] }
  }

  const { valid, errors } = validateManifest(sourceDir, manifest)
  if (!valid) {
    return { success: false, errors }
  }

  const automationsDir = getAutomationsPath()
  fs.mkdirSync(automationsDir, { recursive: true })
  const destDir = path.join(automationsDir, manifest.id)
  fs.mkdirSync(destDir, { recursive: true })
  fs.cpSync(sourceDir, destDir, { recursive: true, force: true })

  const db = await getDb()
  db.run(
    `INSERT INTO automations (id, tool_path, enabled, updated_at)
     VALUES (?, ?, 0, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET tool_path = excluded.tool_path, enabled = 0, updated_at = CURRENT_TIMESTAMP`,
    [manifest.id, destDir]
  )
  saveDb()

  return { success: true, id: manifest.id, name: manifest.name, version: manifest.version, enabled: false }
}

async function removeTool(id) {
  const db = await getDb()
  const rows = toArray(db.exec('SELECT * FROM automations WHERE id = ?', [id]))
  db.run('DELETE FROM automations WHERE id = ?', [id])
  saveDb()

  const toolPath = rows.length > 0 ? rows[0].tool_path : path.join(getAutomationsPath(), id)
  if (fs.existsSync(toolPath)) {
    fs.rmSync(toolPath, { recursive: true, force: true })
  }
  return { success: true }
}

async function setEnabled(id, enabled) {
  const db = await getDb()
  db.run(
    `INSERT INTO automations (id, enabled, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET enabled = excluded.enabled, updated_at = CURRENT_TIMESTAMP`,
    [id, enabled ? 1 : 0]
  )
  saveDb()
  return { success: true, enabled: Boolean(enabled) }
}

async function seedSampleTools() {
  const sampleDir = path.join(__dirname, 'sampleTools')
  if (!fs.existsSync(sampleDir)) return

  const automationsDir = getAutomationsPath()
  fs.mkdirSync(automationsDir, { recursive: true })

  const samples = fs.readdirSync(sampleDir, { withFileTypes: true }).filter((e) => e.isDirectory())
  const db = await getDb()
  for (const sample of samples) {
    const src = path.join(sampleDir, sample.name)
    const manifest = readManifest(src)
    if (!manifest || !manifest.id) continue
    const dest = path.join(automationsDir, manifest.id)

    // Always refresh bundled sample tools so shipped fixes (e.g. the
    // permissions array) reach previously-installed copies. A stale installed
    // manifest that omitted `permissions` previously made browser tools fail
    // with "Cannot read properties of undefined (reading 'goto')".
    // Use asar-safe recursive copy (fs.cpSync fails inside app.asar with ENOENT).
    copyDirFromAsar(src, dest)

    const stateRows = toArray(db.exec('SELECT enabled FROM automations WHERE id = ?', [manifest.id]))
    const enabled = stateRows.length > 0 ? Boolean(stateRows[0].enabled) : true
    db.run(
      `INSERT INTO automations (id, tool_path, enabled, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET tool_path = excluded.tool_path, enabled = excluded.enabled, updated_at = CURRENT_TIMESTAMP`,
      [manifest.id, dest, enabled ? 1 : 0]
    )
    saveDb()
  }
}

async function getTool(id) {
  const tools = await scanAutomations()
  return tools.find((t) => t.id === id) || null
}

async function runTool(id, profileId, inputs = {}, options = {}) {
  const tool = await getTool(id)
  if (!tool) return { ok: false, message: 'Tool not found' }
  if (!tool.valid) return { ok: false, message: `Tool manifest is invalid: ${tool.errors.join('; ')}` }
  if (!tool.enabled) return { ok: false, message: 'Tool is disabled' }
  if (!tool.compatible) return { ok: false, message: `Tool is incompatible: ${tool.compatibilityReason || 'unsupported'}` }

  const profile = await getProfileById(profileId)
  if (!profile) return { ok: false, message: 'Profile not found' }

  const entryPath = path.join(tool.toolPath, tool.entry)
  let runFn
  try {
    runFn = loadPlugin(entryPath, tool.permissions || [])
  } catch (err) {
    await addLog({ profile_id: profileId, action: tool.id, status: 'error', message: `Load error: ${err.message}` })
    return { ok: false, message: `Failed to load tool: ${err.message}` }
  }

  let opened = false
  let shouldClose = false
  let context
  let page
  let timeoutId = null

  // Create run record for this execution
  let run = null
  try {
    run = await createRun({ tool, profile })
  } catch {
    run = null
  }
  const runId = run ? run.id : null

  try {
    const entry = browserManager.getEntry(profileId)
    if (entry) {
      context = entry.context
      page = context.pages()[0] || (await context.newPage())
    } else {
      await browserManager.openProfile(profile)
      opened = true
      const newEntry = browserManager.getEntry(profileId)
      context = newEntry.context
      page = context.pages()[0] || (await context.newPage())
    }

    const downloadsDir = getProfileDownloadsPath(profileId)
    const tempDir = getProfileTempPath(profileId)
    fs.mkdirSync(downloadsDir, { recursive: true })
    fs.mkdirSync(tempDir, { recursive: true })

    // Step 19: Fail-Closed Automation Security Guard
    const leakGuardActive = await leakProtection.isAutomationLeakGuardEnabled()
    if (leakGuardActive && profile.proxy_id) {
      const privacyCheck = await leakProtection.validateProfileNetworkPrivacy(profile, context)
      if (!privacyCheck.safe) {
        throw new Error(`Security Guard: Automation blocked due to real-IP leakage (${privacyCheck.error || privacyCheck.code})`)
      }
    }

    const runLogger = (level, msg) => {
      if (runId) addRunLog(runId, level, msg)
      addLog({ profile_id: profileId, action: tool.id, status: level, message: String(msg) })
    }

    const logger = {
      info: (msg) => runLogger('info', msg),
      warn: (msg) => runLogger('warn', msg),
      error: (msg) => runLogger('error', msg),
    }

    const permissionSet = new Set(tool.permissions || [])
    const allowsPage = permissionSet.has('browser-page') || permissionSet.has('browser.page')
    const allowsNavigation = allowsPage || permissionSet.has('browser.navigation')
    const allowsDownloads = permissionSet.has('downloads') || permissionSet.has('downloads.write')
    const allowsSelectedFiles = permissionSet.has('filesystem') || permissionSet.has('filesystem.selectedFile')
    const selectedPaths = allowsSelectedFiles
      ? (tool.inputSchema || []).filter((field) => field.type === 'file' || field.type === 'folder')
        .map((field) => inputs[field.key]).filter((value) => typeof value === 'string' && value)
      : []
    const denied = (permission) => { throw new Error(`PermissionDenied: ${permission} permission required`) }
    const pageApi = allowsPage ? page : undefined
    const api = {
      profile: {
        id: profile.id,
        name: profile.name,
        proxy: profile.proxy || null,
      },
      browser: {
        goto: async (url, opts) => allowsNavigation ? page.goto(url, opts) : denied('browser.navigation'),
        newPage: async () => allowsPage ? context.newPage() : denied('browser.page'),
        currentPage: () => allowsPage ? page : denied('browser.page'),
        pages: () => allowsPage ? context.pages() : denied('browser.page'),
      },
      context: allowsPage ? context : undefined,
      page: pageApi,
      inputs: { ...inputs },
      logger,
      downloadsDir: allowsDownloads ? downloadsDir : undefined,
      tempDir: allowsSelectedFiles ? tempDir : undefined,
      selectedPaths,
      setProgress: (current, total) => {
        if (typeof options.onProgress === 'function') {
          options.onProgress(Number(current) || 0, Number(total) || 0)
        }
      },
    }


    const result = await Promise.race([
      Promise.resolve().then(() => runFn(api)),
      new Promise((_, rej) =>
        { timeoutId = setTimeout(() => rej(new Error('Tool timed out after 10 minutes')), 10 * 60 * 1000) }
      ),
    ])

    if (result && result.keepOpen === false) {
      shouldClose = true
    }

    const message = result && result.message ? result.message : 'Completed'
    await addLog({ profile_id: profileId, action: tool.id, status: 'success', message })
    if (runId) await finishRun(runId, { status: 'success', url: safePageUrl(page) })
    return { ok: true, message, runId }
  } catch (err) {
    await addLog({ profile_id: profileId, action: tool.id, status: 'error', message: `Run error: ${err.message}` })

    // Error debugging: screenshot + url + stack
    const debug = await captureErrorDebug(page, runId, err)
    if (runId) {
      await finishRun(runId, {
        status: 'failed',
        error: debug.stack || err.message,
        url: debug.url,
        screenshotPath: debug.screenshotPath,
      })
    }
    return { ok: false, message: err.message || 'Tool failed', runId, screenshotPath: debug.screenshotPath, logsPath: debug.logsPath }
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
    if (opened && shouldClose) {
      await browserManager.closeProfile(profileId).catch(() => {})
    }
  }
}

function safePageUrl(page) {
  try {
    return page && !page.isClosed() ? page.url() : null
  } catch {
    return null
  }
}

async function captureErrorDebug(page, runId, err) {
  let url = null
  let screenshotPath = null
  let logsPath = null

  if (runId) logsPath = getRunLogPath(runId)

  try {
    url = safePageUrl(page)
  } catch {
    url = null
  }

  if (runId && page && !page.isClosed()) {
    try {
      screenshotPath = path.join(getRunsPath(runId), 'screenshot.png')
      await page.screenshot({ path: screenshotPath })
    } catch {
      screenshotPath = null
    }
  }

  if (runId) {
    try {
      await addRunLog(runId, 'error', `Failed at URL: ${url || '(unknown)'}`)
      await addRunLog(runId, 'error', `Error: ${err && err.message ? err.message : String(err)}`)
      if (err && err.stack) await addRunLog(runId, 'error', `Stack: ${err.stack}`)
    } catch {
      // ignore
    }
  }

  return {
    url,
    screenshotPath,
    logsPath,
    stack: err && err.stack ? err.stack : err && err.message ? err.message : String(err),
  }
}

module.exports = {
  scanAutomations,
  importTool,
  removeTool,
  setEnabled,
  seedSampleTools,
  getTool,
  runTool,
}
