const { app, BrowserWindow, ipcMain, dialog, shell, screen, clipboard } = require('electron')
const path = require('path')
// Electron on Windows resolves the roaming directory through the shell and can
// ignore a process-local APPDATA override. E2E runs must never touch the real
// user's database, so pin userData before database modules are loaded.
if (process.env.NODE_ENV === 'test' && process.env.APPDATA) {
  app.setPath('userData', path.join(process.env.APPDATA, 'YNlogin'))
}
const { getDb, closeDb } = require('./database')
const profilesRepo = require('./database/profiles')
const proxiesRepo = require('./database/proxies')
const workspacesRepo = require('./database/workspaces')
const templatesRepo = require('./database/templates')
const runsRepo = require('./database/runs')
const browserManager = require('./browser/manager')
const automationManager = require('./automation/manager')
const automationRecorder = require('./automation/recorder')
const automationQueue = require('./automation/queue')
const scheduler = require('./automation/scheduler')
const settingsRepo = require('./settings')
const backupModule = require('./backup')
const binaryManager = require('./browser/binaryManager')
const portabilityModule = require('./portability')
const recoveryManager = require('./browser/recovery')
const resourceManager = require('./browser/resourceManager')
const ipcValidate = require('./security/ipcValidate')
const dashboardManager = require('./dashboard/manager')
const searchModule = require('./search')
const dataTools = require('./dataTools')
const proxyRuleManager = require('./proxies/ruleManager')
const notificationManager = require('./notifications/manager')
const cookieManager = require('./cookies/manager')
const localApi = require('./api/server')
const extensionManager = require('./extensions/manager')
const totp = require('./security/totp')
const warmupManager = require('./warmup/manager')
const actionSynchronizer = require('./browser/actionSynchronizer')
const profileInspector = require('./browser/profileInspector')
const { teamSyncRuntime } = require('./sync/runtime')
const versions = require('./versions')
const logger = require('./logger')
const errorDialog = require('./errorDialog')
const { getAppDataPath, getLogsPath, getProfilesPath, getDatabasePath } = require('../shared/paths')
const fs = require('fs')

// Global safety net: a single unhandled promise rejection must never crash the
// whole app (it previously prevented the main window from opening when a
// background seeding task threw). Log the error and keep the app alive.
process.on('unhandledRejection', (reason) => {
  try { logger.error(`[unhandledRejection] ${reason && reason.message ? reason.message : reason}`) } catch {}
})
process.on('uncaughtException', (err) => {
  try { logger.error(`[uncaughtException] ${err && err.message ? err.message : err}`) } catch {}
})

let mainWindow = null
let quitInProgress = false
let cleanupComplete = false
// Automated UI tests use an isolated APPDATA and must coexist with an installed
// YNlogin instance; production still enforces the single-instance lock.
const hasSingleInstanceLock = process.env.NODE_ENV === 'test' || app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
}

function createWindow() {
  const isDev = !app.isPackaged
  const useDevServer = isDev && process.env.YNLOGIN_E2E_DIST !== '1'
  const iconPath = isDev
    ? path.join(__dirname, '../../assets/icon.ico')
    : path.join(process.resourcesPath, 'assets/icon.ico')

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'YNlogin',
    backgroundColor: '#0b0c10',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  if (useDevServer) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    logger.error(`[renderer] Load failed (${code}): ${description}; URL=${url || 'unknown'}`)
  })
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logger.error(`[renderer] Process exited: ${details.reason}; code=${details.exitCode}`)
  })
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) logger.error(`[renderer] ${message} (${sourceId || 'unknown'}:${line || 0})`)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function broadcast(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

function registerIpcHandlers() {
  ipcMain.handle('db:get-profiles', (event, options) => profilesRepo.getAllProfiles(options || {}))
  ipcMain.handle('workspaces:get-all', (event, options) => workspacesRepo.getAllWorkspaces(options || {}))
  ipcMain.handle('workspaces:get', (event, id) => workspacesRepo.getWorkspaceById(id))
  ipcMain.handle('workspaces:create', (event, data) => workspacesRepo.createWorkspace(data || {}))
  ipcMain.handle('workspaces:update', (event, id, data) => workspacesRepo.updateWorkspace(id, data || {}))
  ipcMain.handle('workspaces:duplicate', (event, id, data) => workspacesRepo.duplicateWorkspace(id, data || {}))
  ipcMain.handle('workspaces:archive', (event, id, archived) => workspacesRepo.archiveWorkspace(id, archived))
  ipcMain.handle('workspaces:delete', (event, id, options) => workspacesRepo.deleteWorkspace(id, options || {}))
  ipcMain.handle('db:bulk-set-workspace', (event, ids, workspaceId) => profilesRepo.bulkSetWorkspace(ids, workspaceId))

  ipcMain.handle('templates:get-all', (event, options) => templatesRepo.getAllTemplates(options || {}))
  ipcMain.handle('templates:get', (event, id) => templatesRepo.getTemplateById(id))
  ipcMain.handle('templates:create', (event, data) => templatesRepo.createTemplate(data || {}))
  ipcMain.handle('templates:update', (event, id, data) => templatesRepo.updateTemplate(id, data || {}))
  ipcMain.handle('templates:delete', (event, id) => templatesRepo.deleteTemplate(id))
  ipcMain.handle('templates:duplicate', (event, id, data) => templatesRepo.duplicateTemplate(id, data || {}))
  ipcMain.handle('templates:create-from-profile', (event, profileId, templateData) => templatesRepo.createTemplateFromProfile(profileId, templateData || {}))
  ipcMain.handle('templates:create-profile', (event, templateId, overrides) => templatesRepo.createProfileFromTemplate(templateId, overrides || {}))
  ipcMain.handle('templates:bulk-create', (event, options) => templatesRepo.bulkCreateProfiles(options || {}))

  ipcMain.handle('scheduler:get-all', (event, options) => scheduler.getAllScheduledJobs(options || {}))
  ipcMain.handle('scheduler:get', (event, id) => scheduler.getScheduledJobById(id))
  ipcMain.handle('scheduler:create', (event, data) => scheduler.createScheduledJob(data || {}))
  ipcMain.handle('scheduler:update', (event, id, data) => scheduler.updateScheduledJob(id, data || {}))
  ipcMain.handle('scheduler:delete', (event, id) => scheduler.deleteScheduledJob(id))
  ipcMain.handle('scheduler:duplicate', (event, id, data) => scheduler.duplicateScheduledJob(id, data || {}))
  ipcMain.handle('scheduler:toggle', (event, id, enabled) => scheduler.toggleScheduledJob(id, enabled))
  ipcMain.handle('scheduler:run-now', (event, id) => scheduler.executeScheduledJob(id))

  ipcMain.handle('runs:get-paginated', (event, options) => runsRepo.getRuns(options || {}))
  ipcMain.handle('runs:get-details', (event, runId) => runsRepo.getRunDetails(runId))
  ipcMain.handle('runs:get-analytics', (event, options) => runsRepo.getAutomationAnalytics(options || {}))
  ipcMain.handle('runs:get-logs', (event, runId, limit) => runsRepo.getRunLogs(runId, limit))
  ipcMain.handle('runs:has-screenshot', (event, runId) => runsRepo.hasScreenshot(runId))

  ipcMain.handle('search:global', (event, query, options) => searchModule.globalSearch(query, options || {}))

  ipcMain.handle('data-tools:parse-csv', (event, csvContent, mapping) => dataTools.parseAndValidateCsv(csvContent, mapping || {}))
  ipcMain.handle('data-tools:execute-import', (event, options) => dataTools.executeImport(options || {}))
  ipcMain.handle('data-tools:export-profiles', (event, options) => dataTools.exportProfilesData(options || {}))
  ipcMain.handle('cookies:parse', (event, input, format) => cookieManager.parseCookies(input, format || 'auto'))
  ipcMain.handle('cookies:import', (event, profileId, input, options) => cookieManager.importCookies(profileId, input, options || {}))
  ipcMain.handle('cookies:export', (event, profileId, format) => cookieManager.exportCookies(profileId, format || 'json'))

  ipcMain.handle('local-api:status', () => localApi.getStatus())
  ipcMain.handle('local-api:start', (event, options) => localApi.start(options || {}))
  ipcMain.handle('local-api:stop', () => localApi.stop())
  ipcMain.handle('local-api:reveal-token', () => localApi.revealToken())
  ipcMain.handle('extensions:list', () => extensionManager.listExtensions())
  ipcMain.handle('extensions:assignments', (event, extensionId) => extensionManager.listAssignments(extensionId || null))
  ipcMain.handle('extensions:register-directory', (event, sourcePath) => extensionManager.registerDirectory(sourcePath))
  ipcMain.handle('extensions:register-crx', (event, sourcePath) => extensionManager.registerCrx(sourcePath))
  ipcMain.handle('extensions:assign', (event, extensionId, scopeType, scopeId, enabled) => extensionManager.assign(extensionId, scopeType, scopeId, enabled))
  ipcMain.handle('extensions:remove', (event, extensionId) => extensionManager.remove(extensionId))
  ipcMain.handle('team-sync:status', (event, workspaceId) => teamSyncRuntime.getStatus(workspaceId || 'default'))
  ipcMain.handle('team-sync:configure', (event, config) => teamSyncRuntime.configure(config || {}))
  ipcMain.handle('team-sync:run', (event, workspaceId, options) => teamSyncRuntime.syncNow(workspaceId || 'default', options || {}))
  ipcMain.handle('totp:status', (event, profileId) => totp.status(profileId))
  ipcMain.handle('totp:set', (event, profileId, input, options) => totp.setTotp(profileId, input, options || {}))
  ipcMain.handle('totp:remove', (event, profileId) => totp.remove(profileId))
  ipcMain.handle('totp:copy', async (event, profileId) => {
    const result = await totp.currentCode(profileId)
    clipboard.writeText(result.code)
    const copiedCode = result.code
    setTimeout(() => {
      if (clipboard.readText() === copiedCode) clipboard.clear()
    }, 45000).unref?.()
    return { success: true, remaining: result.remaining, digits: result.digits }
  })
  ipcMain.handle('warmup:start', (event, profileId, options) => warmupManager.start(profileId, options || {}))
  ipcMain.handle('warmup:cancel', (event, profileId) => warmupManager.cancel(profileId))
  ipcMain.handle('warmup:history', (event, profileId, limit) => warmupManager.history(profileId, limit))
  ipcMain.handle('action-sync:start', (event, masterId, workerIds) => actionSynchronizer.start(masterId, workerIds || []))
  ipcMain.handle('action-sync:stop', (event, id) => actionSynchronizer.stop(id))
  ipcMain.handle('action-sync:stop-all', () => actionSynchronizer.stopAll())
  ipcMain.handle('action-sync:status', () => actionSynchronizer.status())

  ipcMain.handle('proxy-rules:get-stats', (event, options) => proxyRuleManager.getProxyStats(options || {}))
  ipcMain.handle('proxy-rules:apply', (event, options) => proxyRuleManager.applyAssignmentRule(options || {}))
  ipcMain.handle('proxy-rules:remove', (event, options) => proxyRuleManager.bulkRemoveProxy(options || {}))

  ipcMain.handle('notifications:get', (event, options) => notificationManager.getNotifications(options || {}))
  ipcMain.handle('notifications:mark-read', (event, id) => {
    const result = notificationManager.markAsRead(id)
    broadcast('notifications:changed', {})
    return result
  })
  ipcMain.handle('notifications:mark-all-read', () => {
    const result = notificationManager.markAllAsRead()
    broadcast('notifications:changed', {})
    return result
  })
  ipcMain.handle('notifications:clear-all', () => {
    const result = notificationManager.clearAllNotifications()
    broadcast('notifications:changed', {})
    return result
  })
  ipcMain.handle('notifications:get-settings', () => notificationManager.getNotificationSettings())
  ipcMain.handle('notifications:update-settings', (event, s) => notificationManager.updateNotificationSettings(s || {}))

  ipcMain.handle('dashboard:get-metrics', (event, options) => dashboardManager.getMetrics(options || {}))
  ipcMain.handle('dashboard:get-recent-activity', (event, limit, options) => dashboardManager.getRecentActivity(limit, options || {}))
  ipcMain.handle('db:create-profile', (event, data) => {
    const { valid, errors, sanitized } = ipcValidate.validateProfilePayload(data || {})
    if (!valid) throw new Error(`Invalid profile data: ${errors.join('; ')}`)
    return profilesRepo.createProfile(sanitized)
  })
  ipcMain.handle('db:update-profile', (event, id, data) => {
    const { valid, errors, sanitized } = ipcValidate.validateProfilePayload(data || {})
    if (!valid) throw new Error(`Invalid profile data: ${errors.join('; ')}`)
    return profilesRepo.updateProfile(id, sanitized)
  })
  ipcMain.handle('db:delete-profile', (event, id, options) => profilesRepo.deleteProfile(id, options))
  ipcMain.handle('db:duplicate-profile', (event, id, data) => profilesRepo.duplicateProfile(id, data))
  ipcMain.handle('db:clear-profile-session', (event, id) => profilesRepo.clearProfileSessionData(id))
  ipcMain.handle('db:bulk-set-group', (event, ids, group) => profilesRepo.bulkSetGroup(ids, group))
  ipcMain.handle('db:bulk-delete', (event, ids, options) => profilesRepo.bulkDelete(ids, options))
  ipcMain.handle('environment:validate', (event, env) => require('./browser/environmentValidator').validateEnvironment(env))

  const consistencyValidator = require('./browser/consistencyValidator')
  ipcMain.handle('consistency:check', async (event, profile, proxyId) => {
    let proxy = null
    if (proxyId) {
      proxy = await proxiesRepo.getProxyById(proxyId)
    }
    return consistencyValidator.validateConsistency(profile, proxy)
  })
  ipcMain.handle('consistency:apply-proxy-geo', async (event, environment, proxyId) => {
    let proxy = null
    if (proxyId) {
      proxy = await proxiesRepo.getProxyById(proxyId)
    }
    return consistencyValidator.applyProxyGeoToEnvironment(environment, proxy)
  })

  const diagnostics = require('./browser/diagnostics')
  ipcMain.handle('diagnostics:run-profile', (event, profileId) => diagnostics.runProfileDiagnostics(profileId))
  ipcMain.handle('diagnostics:export-report', async (event, report) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export diagnostics report',
      defaultPath: `ynlogin-diagnostics-${Date.now()}.json`,
      filters: [{ name: 'JSON report', extensions: ['json'] }],
    })
    if (canceled || !filePath) return { canceled: true }
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8')
    return { canceled: false, path: filePath }
  })

  const healthCheck = require('./browser/healthCheck')
  ipcMain.handle('health:check-profile', (event, profileId) => healthCheck.checkProfileHealth(profileId))
  ipcMain.handle('health:check-batch', (event, profileIds) => healthCheck.checkBatchProfiles(profileIds))
  ipcMain.handle('account-safety:check', (event, profileId) => require('./browser/accountSafety').evaluateProfileSafety(profileId))
  ipcMain.handle('profiles:inspect-fingerprint', (event, profileId) => profileInspector.inspectProfileFingerprint(profileId))
  ipcMain.handle('profiles:align-environment-to-proxy', (event, profileId) => require('./browser/environmentAlign').alignEnvironmentToProxy(profileId))
  ipcMain.handle('account-safety:check-batch', (event, profileIds) => require('./browser/accountSafety').evaluateBatch(profileIds || []))

  const leakProtection = require('./browser/leakProtection')
  ipcMain.handle('privacy:get-host-ip', () => leakProtection.getDirectHostPublicIp())
  ipcMain.handle('privacy:validate-profile', async (event, profileId) => {
    const profile = await profilesRepo.getProfileById(profileId)
    if (!profile) throw new Error('Profile not found')
    const entry = browserManager.getEntry(profileId)
    const context = entry ? entry.context : null
    return leakProtection.validateProfileNetworkPrivacy(profile, context)
  })

  const presetsRepo = require('./database/presets')
  ipcMain.handle('presets:get-all', () => presetsRepo.getAllPresets())
  ipcMain.handle('presets:create', (event, data) => presetsRepo.createPreset(data))
  ipcMain.handle('presets:update', (event, id, data) => presetsRepo.updatePreset(id, data))
  ipcMain.handle('presets:delete', (event, id) => presetsRepo.deletePreset(id))
  ipcMain.handle('presets:duplicate', (event, id, data) => presetsRepo.duplicatePreset(id, data))

  ipcMain.handle('config-presets:get-all', (event, options) => presetsRepo.getConfigPresets(options || {}))
  ipcMain.handle('config-presets:get', (event, id) => presetsRepo.getConfigPresetById(id))
  ipcMain.handle('config-presets:create', (event, data) => presetsRepo.createConfigPreset(data))
  ipcMain.handle('config-presets:update', (event, id, data) => presetsRepo.updateConfigPreset(id, data))
  ipcMain.handle('config-presets:delete', (event, id) => presetsRepo.deleteConfigPreset(id))

  ipcMain.handle('proxies:get-all', (event, options) => proxiesRepo.getAllProxies(options || {}))
  ipcMain.handle('proxies:create', (event, data) => {
    const { valid, errors, sanitized } = ipcValidate.validateProxyPayload(data || {})
    if (!valid) throw new Error(`Invalid proxy data: ${errors.join('; ')}`)
    return proxiesRepo.createProxy(sanitized)
  })
  ipcMain.handle('proxies:update', (event, id, data) => {
    const { valid, errors, sanitized } = ipcValidate.validateProxyPayload(data || {})
    if (!valid) throw new Error(`Invalid proxy data: ${errors.join('; ')}`)
    return proxiesRepo.updateProxy(id, sanitized)
  })
  ipcMain.handle('proxies:delete', (event, id) => proxiesRepo.deleteProxy(id))
  ipcMain.handle('proxies:bulk-delete', (event, ids) => proxiesRepo.bulkDelete(Array.isArray(ids) ? ids : []))
  ipcMain.handle('proxies:test', (event, id) => proxiesRepo.testProxy(id))
  ipcMain.handle('proxies:generate-random', (event, count, prefix) => proxiesRepo.generateRandomProxies(count, prefix))
  ipcMain.handle('proxies:assign-random', (event, profileIds, prefix) => proxiesRepo.assignRandomProxiesToProfiles(profileIds, { prefix }))

  ipcMain.handle('automation:scan', () => automationManager.scanAutomations())
  ipcMain.handle('automation:pick-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select tool folder',
      properties: ['openDirectory'],
    })
    if (canceled || filePaths.length === 0) return { canceled: true }
    return { canceled: false, path: filePaths[0] }
  })
  ipcMain.handle('dialog:pick-file', async (event, title, filters) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: title || 'Select file',
      properties: ['openFile'],
      filters: Array.isArray(filters) && filters.length > 0 ? filters : undefined,
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })
  ipcMain.handle('dialog:pick-folder', async (event, title) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: title || 'Select folder',
      properties: ['openDirectory'],
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })
  ipcMain.handle('automation:import', (event, folderPath) => {
    if (typeof folderPath !== 'string' || folderPath.length > 4096) throw new Error('Invalid folder path')
    return automationManager.importTool(folderPath)
  })
  ipcMain.handle('automation:set-enabled', (event, id, enabled) => automationManager.setEnabled(id, Boolean(enabled)))
  ipcMain.handle('automation:remove', (event, id) => automationManager.removeTool(id))
  ipcMain.handle('automation:run', (event, id, profileId, inputs) =>
    automationManager.runTool(id, profileId, ipcValidate.sanitizeInputs(inputs || {}))
  )
  ipcMain.handle('automation:recorder-start', (event, options) => automationRecorder.startRecording(options || {}))
  ipcMain.handle('automation:recorder-stop', (event, options) => automationRecorder.stopRecording(options || {}))
  ipcMain.handle('automation:recorder-cancel', () => automationRecorder.cancelRecording())
  ipcMain.handle('automation:recorder-status', () => automationRecorder.status())

  ipcMain.handle('queue:enqueue', (event, toolId, profileIds, inputs) =>
    automationQueue.enqueue(toolId, profileIds, inputs)
  )
  ipcMain.handle('queue:get', () => automationQueue.getQueue())
  ipcMain.handle('queue:get-counts', () => automationQueue.getCounts())
  ipcMain.handle('queue:stop-all', () => automationQueue.stopAll())
  ipcMain.handle('queue:stop-job', (event, jobId) => automationQueue.stopJob(jobId))
  ipcMain.handle('queue:retry-job', (event, jobId) => automationQueue.retryJob(jobId))
  ipcMain.handle('queue:retry-all-failed', () => automationQueue.retryAllFailed())
  ipcMain.handle('queue:clear-completed', () => automationQueue.clearCompleted())

  ipcMain.handle('settings:get', (event, key, defaultValue) => {
    if (typeof key !== 'string' || key.length > 200) throw new Error('Invalid setting key')
    return settingsRepo.getSetting(key, defaultValue)
  })
  ipcMain.handle('settings:set', (event, key, value) => {
    if (typeof key !== 'string' || key.length > 200) throw new Error('Invalid setting key')
    if (!ipcValidate.validateSettingValue(value).valid) throw new Error('Invalid setting value')
    return settingsRepo.setSetting(key, value)
  })
  ipcMain.handle('settings:get-max-concurrent', () => settingsRepo.getMaxConcurrent())
  ipcMain.handle('settings:set-max-concurrent', (event, n) => settingsRepo.setMaxConcurrent(n))

  ipcMain.handle('runs:get-recent', (event, limit) => runsRepo.getRecentRuns(limit))
  ipcMain.handle('runs:get', (event, runId) => runsRepo.getRunById(runId))
  ipcMain.handle('runs:open-logs', async (event, runId) => {
    const run = await runsRepo.getRunById(runId)
    if (!run || !run.logs_path) return { success: false }
    return { success: shell.openPath(run.logs_path) === '' }
  })
  ipcMain.handle('runs:open-screenshot', async (event, runId) => {
    const run = await runsRepo.getRunById(runId)
    if (!run || !run.screenshot_path) return { success: false }
    return { success: shell.openPath(run.screenshot_path) === '' }
  })

  ipcMain.handle('backup:export', async (event, options) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export YNlogin backup',
      defaultPath: `ynlogin-backup-${new Date().toISOString().slice(0, 10)}.zip`,
      filters: [{ name: 'YNlogin backup', extensions: ['zip'] }],
    })
    if (canceled || !filePath) return { canceled: true }
    return backupModule.exportBackup({ includeBrowserData: options.includeBrowserData, destPath: filePath })
  })

  ipcMain.handle('backup:pick-import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import YNlogin backup',
      properties: ['openFile'],
      filters: [{ name: 'YNlogin backup', extensions: ['zip'] }],
    })
    if (canceled || filePaths.length === 0) return { canceled: true }
    return { canceled: false, path: filePaths[0] }
  })

  ipcMain.handle('backup:import', (event, archivePath) => backupModule.importBackup(archivePath))
  ipcMain.handle('backup:database', () => backupModule.backupDatabase())

  ipcMain.handle('portability:export', async (event, options) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export profile package',
      defaultPath: `ynlogin-profiles-${new Date().toISOString().slice(0, 10)}.zip`,
      filters: [{ name: 'YNlogin profile export', extensions: ['zip'] }],
    })
    if (canceled || !filePath) return { canceled: true }
    return portabilityModule.exportProfiles({ profileIds: options.profileIds, options, destPath: filePath })
  })
  ipcMain.handle('portability:pick-import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import YNlogin profile package',
      properties: ['openFile'],
      filters: [{ name: 'YNlogin profile export', extensions: ['zip'] }],
    })
    if (canceled || filePaths.length === 0) return { canceled: true }
    return { canceled: false, path: filePaths[0] }
  })
  ipcMain.handle('portability:inspect', (event, archivePath) => portabilityModule.inspectExport(archivePath))
  ipcMain.handle('portability:import', (event, archivePath, strategies) =>
    portabilityModule.importProfiles(archivePath, strategies)
  )

  ipcMain.handle('recovery:orphans', () => recoveryManager.getActiveOrphans())
  ipcMain.handle('recovery:decide', (event, sessionId, decision) => recoveryManager.decideOrphan(sessionId, decision))
  ipcMain.handle('recovery:reconnect-feasibility', () => recoveryManager.reconnectFeasibility())
  ipcMain.handle('recovery:safe-startup-get', () => recoveryManager.isSafeStartupMode())
  ipcMain.handle('recovery:safe-startup-set', (event, enabled) => recoveryManager.setSafeStartupMode(enabled))

  ipcMain.handle('resource:status', () => resourceManager.getStatus())
  ipcMain.handle('resource:set-max-browsers', (event, n) => resourceManager.setMaxBrowsers(n))
  ipcMain.handle('resource:set-max-automations', (event, n) => resourceManager.setMaxAutomations(n))
  ipcMain.handle('resource:set-memory-threshold', (event, n) => resourceManager.setMemoryThresholdPercent(n))
  ipcMain.handle('resource:set-low-resource', (event, enabled) => resourceManager.setLowResourceMode(enabled))
  ipcMain.handle('resource:memory-warning', () => resourceManager.maybeNotifyMemoryWarning())

  ipcMain.handle('app:versions', async () => {
    const { getSchemaVersion } = require('./database/migration')
    const db = await getDb()
    return versions.getVersions(getSchemaVersion(db))
  })

  ipcMain.handle('app:open-path', async (event, kind) => {
    let target = null
    if (kind === 'data') target = getAppDataPath()
    else if (kind === 'logs') target = getLogsPath()
    else if (kind === 'profiles') target = getProfilesPath()
    else if (kind === 'database') target = getDatabasePath()
    if (!target) return { success: false }
    fs.mkdirSync(target, { recursive: true })
    return { success: shell.openPath(target) === '', path: target }
  })

  ipcMain.handle('app:check-environment', async () => {
    const { getSchemaVersion } = require('./database/migration')
    const db = await getDb()
    const binaries = await binaryManager.scanBrowsers({ probeVersions: false })
    const memory = await resourceManager.getMemoryStatus()
    return {
      ok: true,
      versions: versions.getVersions(getSchemaVersion(db)),
      appData: getAppDataPath(),
      database: getDatabasePath(),
      profiles: getProfilesPath(),
      logs: getLogsPath(),
      browsers: binaries.map((b) => ({ id: b.id, name: b.name, status: b.status, version: b.version, source: b.source })),
      memory,
      platform: process.platform,
      arch: process.arch,
    }
  })

  ipcMain.handle('browser:open-profile', async (event, id) => {
    const profile = await profilesRepo.getProfileById(id)
    if (!profile) throw new Error('Profile not found')
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const result = await browserManager.openProfile(profile, { workArea: display.workArea })
    resourceManager.maybeNotifyMemoryWarning().catch(() => {})
    return result
  })

  ipcMain.handle('browser:close-profile', async (event, id) => {
    const result = await browserManager.closeProfile(id)
    resourceManager.maybeNotifyMemoryWarning().catch(() => {})
    return result
  })
  ipcMain.handle('browser:get-running', () => browserManager.getRunningProfiles())
  ipcMain.handle('browser:get-installed-engines', () => require('./browser/adapter').detectInstalledEngines())
  ipcMain.handle('browser:get-max-concurrency', () => browserManager.getMaxConcurrency())
  ipcMain.handle('browser:set-max-concurrency', (event, limit) => browserManager.setMaxConcurrency(limit))

  ipcMain.handle('browsers:scan', (event, options) => binaryManager.scanBrowsers(options || {}))
  ipcMain.handle('browsers:get-all', () => binaryManager.getAllBinaries())
  ipcMain.handle('browsers:check', (event, id) => binaryManager.checkBinary(id))
  ipcMain.handle('browsers:add-custom', (event, data) => binaryManager.addCustomBrowser(data))
  ipcMain.handle('browsers:remove-custom', (event, id) => binaryManager.removeCustomBrowser(id))
  ipcMain.handle('browsers:refresh-statuses', () => binaryManager.refreshProfileBrowserStatuses())
}

if (hasSingleInstanceLock) app.whenReady().then(async () => {
  errorDialog.installGlobalErrorHandlers(() => mainWindow)

  await getDb()
  const identityMigration = await require('./browser/identityMigration').migrateLegacyProfileIdentities()
  if (identityMigration.migrated) logger.info(`Migrated ${identityMigration.migrated} legacy profile identities (backup created)`)
  logger.info(`YNlogin started (app ${versions.APP_VERSION}, db schema v${require('./database/migration').getSchemaVersion(await getDb())})`)
  logger.info(`Data directory: ${getAppDataPath()} (production: ${app.isPackaged})`)
  logger.info(`Runtime: Electron ${process.versions.electron}, Node ${process.versions.node}, Platform ${process.platform}`)

  // Crash & orphan recovery: reconcile persisted runtime records BEFORE
  // transient statuses are reset so still-running browsers stay flagged.
  const recoveryResult = await recoveryManager.scanAtStartup()
  const orphanProfileIds = new Set((recoveryResult.orphans || []).map((o) => o.profileId))
  await profilesRepo.resetTransientStatuses()
  for (const id of orphanProfileIds) {
    await profilesRepo.setProfileStatus(id, 'running').catch(() => {})
  }
  await recoveryManager.noteStartupOutcome(recoveryResult.hadRunningRecords)
  const safeStartup = await recoveryManager.isSafeStartupMode()
  if (safeStartup) {
    console.warn('[recovery] Safe Startup Mode active — automation auto-resume is disabled')
  }

  await automationManager.seedSampleTools()

  browserManager.setStatusListener((profileId, status) => {
    broadcast('profile-status-changed', { id: profileId, status })
  })

  automationQueue.setListener((queue) => {
    broadcast('queue-updated', queue)
  })

  resourceManager.setListener((event) => {
    broadcast('resource-event', event)
  })
  resourceManager.startMonitoring(30000)
  scheduler.start(15000)

  registerIpcHandlers()
  const apiEnabled = await settingsRepo.getSetting('localApi.enabled', 'true')
  if (apiEnabled !== 'false') {
    localApi.start().then((status) => {
      logger.info(`Local API listening on http://${status.host}:${status.port}/api/v1`)
    }).catch((err) => logger.error(`[local-api] Could not start: ${err.message}`))
  }
  createWindow()

  if (recoveryResult.orphans && recoveryResult.orphans.length > 0) {
    setTimeout(() => {
      broadcast('recovery-orphans-detected', recoveryResult.orphans)
    }, 800)
  }

  // Detect browser binaries and reconcile profile statuses in the background
  // so the app never blocks on browser probes during startup.
  Promise.resolve()
    .then(() => binaryManager.scanBrowsers())
    .then(() => binaryManager.refreshProfileBrowserStatuses())
    .catch((err) => console.warn('[browsers] initial scan failed:', err.message))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', (event) => {
  if (cleanupComplete) return
  event.preventDefault()
  if (quitInProgress) return

  quitInProgress = true
  Promise.resolve()
    .then(() => scheduler.stop())
    .then(() => automationQueue.stopAccepting())
    .then(() => automationQueue.stopAll())
    .then(() => actionSynchronizer.stopAll())
    .then(() => browserManager.closeAllProfiles())
    .then(() => localApi.stop())
    .then(() => {
      logger.info('YNlogin shutdown completed cleanly')
      resourceManager.stopMonitoring()
    })
    .catch((err) => logger.error(`[shutdown] Failed to close browser profiles: ${err.message}`))
    .finally(() => {
      closeDb()
      cleanupComplete = true
      app.quit()
    })
})
