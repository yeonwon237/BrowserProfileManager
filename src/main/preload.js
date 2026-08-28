const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getProfiles: (options) => ipcRenderer.invoke('db:get-profiles', options),
  getWorkspaces: (options) => ipcRenderer.invoke('workspaces:get-all', options),
  getWorkspace: (id) => ipcRenderer.invoke('workspaces:get', id),
  createWorkspace: (data) => ipcRenderer.invoke('workspaces:create', data),
  updateWorkspace: (id, data) => ipcRenderer.invoke('workspaces:update', id, data),
  duplicateWorkspace: (id, data) => ipcRenderer.invoke('workspaces:duplicate', id, data),
  archiveWorkspace: (id, archived) => ipcRenderer.invoke('workspaces:archive', id, archived),
  deleteWorkspace: (id, options) => ipcRenderer.invoke('workspaces:delete', id, options),
  bulkSetWorkspace: (ids, workspaceId) => ipcRenderer.invoke('db:bulk-set-workspace', ids, workspaceId),

  getTemplates: (options) => ipcRenderer.invoke('templates:get-all', options),
  getTemplate: (id) => ipcRenderer.invoke('templates:get', id),
  createTemplate: (data) => ipcRenderer.invoke('templates:create', data),
  updateTemplate: (id, data) => ipcRenderer.invoke('templates:update', id, data),
  deleteTemplate: (id) => ipcRenderer.invoke('templates:delete', id),
  duplicateTemplate: (id, data) => ipcRenderer.invoke('templates:duplicate', id, data),
  createTemplateFromProfile: (profileId, templateData) => ipcRenderer.invoke('templates:create-from-profile', profileId, templateData),
  createProfileFromTemplate: (templateId, overrides) => ipcRenderer.invoke('templates:create-profile', templateId, overrides),
  bulkCreateProfiles: (options) => ipcRenderer.invoke('templates:bulk-create', options),

  getScheduledJobs: (options) => ipcRenderer.invoke('scheduler:get-all', options),
  getScheduledJob: (id) => ipcRenderer.invoke('scheduler:get', id),
  createScheduledJob: (data) => ipcRenderer.invoke('scheduler:create', data),
  updateScheduledJob: (id, data) => ipcRenderer.invoke('scheduler:update', id, data),
  deleteScheduledJob: (id) => ipcRenderer.invoke('scheduler:delete', id),
  duplicateScheduledJob: (id, data) => ipcRenderer.invoke('scheduler:duplicate', id, data),
  toggleScheduledJob: (id, enabled) => ipcRenderer.invoke('scheduler:toggle', id, enabled),
  runScheduledJobNow: (id) => ipcRenderer.invoke('scheduler:run-now', id),

  getDashboardMetrics: (options) => ipcRenderer.invoke('dashboard:get-metrics', options),
  getRecentActivity: (limit, options) => ipcRenderer.invoke('dashboard:get-recent-activity', limit, options),
  createProfile: (data) => ipcRenderer.invoke('db:create-profile', data),
  updateProfile: (id, data) => ipcRenderer.invoke('db:update-profile', id, data),
  deleteProfile: (id, options) => ipcRenderer.invoke('db:delete-profile', id, options),
  duplicateProfile: (id, data) => ipcRenderer.invoke('db:duplicate-profile', id, data),
  clearProfileSession: (id) => ipcRenderer.invoke('db:clear-profile-session', id),
  bulkSetGroup: (ids, group) => ipcRenderer.invoke('db:bulk-set-group', ids, group),
  bulkDeleteProfiles: (ids, options) => ipcRenderer.invoke('db:bulk-delete', ids, options),
  validateEnvironment: (env) => ipcRenderer.invoke('environment:validate', env),
  checkConsistency: (profile, proxyId) => ipcRenderer.invoke('consistency:check', profile, proxyId),
  applyProxyGeo: (env, proxyId) => ipcRenderer.invoke('consistency:apply-proxy-geo', env, proxyId),
  runProfileDiagnostics: (profileId) => ipcRenderer.invoke('diagnostics:run-profile', profileId),
  exportDiagnosticsReport: (report) => ipcRenderer.invoke('diagnostics:export-report', report),
  checkProfileHealth: (profileId) => ipcRenderer.invoke('health:check-profile', profileId),
  checkBatchProfiles: (profileIds) => ipcRenderer.invoke('health:check-batch', profileIds),
  checkAccountSafety: (profileId) => ipcRenderer.invoke('account-safety:check', profileId),
  checkBatchAccountSafety: (profileIds) => ipcRenderer.invoke('account-safety:check-batch', profileIds),
  getDirectHostIp: () => ipcRenderer.invoke('privacy:get-host-ip'),
  validateProfilePrivacy: (profileId) => ipcRenderer.invoke('privacy:validate-profile', profileId),

  getPresets: () => ipcRenderer.invoke('presets:get-all'),
  createPreset: (data) => ipcRenderer.invoke('presets:create', data),
  updatePreset: (id, data) => ipcRenderer.invoke('presets:update', id, data),
  deletePreset: (id) => ipcRenderer.invoke('presets:delete', id),
  duplicatePreset: (id, data) => ipcRenderer.invoke('presets:duplicate', id, data),

  getConfigPresets: (options) => ipcRenderer.invoke('config-presets:get-all', options),
  getConfigPreset: (id) => ipcRenderer.invoke('config-presets:get', id),
  createConfigPreset: (data) => ipcRenderer.invoke('config-presets:create', data),
  updateConfigPreset: (id, data) => ipcRenderer.invoke('config-presets:update', id, data),
  deleteConfigPreset: (id) => ipcRenderer.invoke('config-presets:delete', id),

  getProxies: (options) => ipcRenderer.invoke('proxies:get-all', options),
  createProxy: (data) => ipcRenderer.invoke('proxies:create', data),
  updateProxy: (id, data) => ipcRenderer.invoke('proxies:update', id, data),
  deleteProxy: (id) => ipcRenderer.invoke('proxies:delete', id),
  bulkDeleteProxies: (ids) => ipcRenderer.invoke('proxies:bulk-delete', ids),
  generateRandomProxies: (count, prefix) => ipcRenderer.invoke('proxies:generate-random', count, prefix),
  assignRandomProxiesToProfiles: (profileIds, prefix) => ipcRenderer.invoke('proxies:assign-random', profileIds, prefix),
  testProxy: (id) => ipcRenderer.invoke('proxies:test', id),

  getProxyStats: (options) => ipcRenderer.invoke('proxy-rules:get-stats', options),
  applyProxyRule: (options) => ipcRenderer.invoke('proxy-rules:apply', options),
  removeProxyAssignment: (options) => ipcRenderer.invoke('proxy-rules:remove', options),

  scanAutomations: () => ipcRenderer.invoke('automation:scan'),
  pickToolFolder: () => ipcRenderer.invoke('automation:pick-folder'),
  importTool: (folderPath) => ipcRenderer.invoke('automation:import', folderPath),
  setToolEnabled: (id, enabled) => ipcRenderer.invoke('automation:set-enabled', id, enabled),
  removeTool: (id) => ipcRenderer.invoke('automation:remove', id),
  runTool: (id, profileId, inputs) => ipcRenderer.invoke('automation:run', id, profileId, inputs),
  startAutomationRecording: (options) => ipcRenderer.invoke('automation:recorder-start', options),
  stopAutomationRecording: (options) => ipcRenderer.invoke('automation:recorder-stop', options),
  cancelAutomationRecording: () => ipcRenderer.invoke('automation:recorder-cancel'),
  getAutomationRecordingStatus: () => ipcRenderer.invoke('automation:recorder-status'),

  pickFile: (title, filters) => ipcRenderer.invoke('dialog:pick-file', title, filters),
  pickFolder: (title) => ipcRenderer.invoke('dialog:pick-folder', title),

  queueEnqueue: (toolId, profileIds, inputs) => ipcRenderer.invoke('queue:enqueue', toolId, profileIds, inputs),
  getQueue: () => ipcRenderer.invoke('queue:get'),
  getQueueCounts: () => ipcRenderer.invoke('queue:get-counts'),
  queueStopAll: () => ipcRenderer.invoke('queue:stop-all'),
  queueStopJob: (jobId) => ipcRenderer.invoke('queue:stop-job', jobId),
  queueRetryJob: (jobId) => ipcRenderer.invoke('queue:retry-job', jobId),
  queueRetryAllFailed: () => ipcRenderer.invoke('queue:retry-all-failed'),
  queueClearCompleted: () => ipcRenderer.invoke('queue:clear-completed'),

  getSetting: (key, defaultValue) => ipcRenderer.invoke('settings:get', key, defaultValue),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  getMaxConcurrent: () => ipcRenderer.invoke('settings:get-max-concurrent'),
  setMaxConcurrent: (n) => ipcRenderer.invoke('settings:set-max-concurrent', n),

  getRuns: (options) => ipcRenderer.invoke('runs:get-paginated', options),
  getRunDetails: (runId) => ipcRenderer.invoke('runs:get-details', runId),
  getAutomationAnalytics: (options) => ipcRenderer.invoke('runs:get-analytics', options),
  getRecentRuns: (limit) => ipcRenderer.invoke('runs:get-recent', limit),
  getRun: (runId) => ipcRenderer.invoke('runs:get', runId),
  getRunLogs: (runId) => ipcRenderer.invoke('runs:get-logs', runId),
  openRunLogs: (runId) => ipcRenderer.invoke('runs:open-logs', runId),
  openRunScreenshot: (runId) => ipcRenderer.invoke('runs:open-screenshot', runId),

  searchGlobal: (query, options) => ipcRenderer.invoke('search:global', query, options),

  getNotifications: (options) => ipcRenderer.invoke('notifications:get', options),
  markNotificationRead: (id) => ipcRenderer.invoke('notifications:mark-read', id),
  markAllNotificationsRead: () => ipcRenderer.invoke('notifications:mark-all-read'),
  clearAllNotifications: () => ipcRenderer.invoke('notifications:clear-all'),
  getNotificationSettings: () => ipcRenderer.invoke('notifications:get-settings'),
  updateNotificationSettings: (s) => ipcRenderer.invoke('notifications:update-settings', s),
  onNotificationsChanged: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('notifications:changed', listener)
    return () => ipcRenderer.removeListener('notifications:changed', listener)
  },

  parseCsv: (csvContent, mapping) => ipcRenderer.invoke('data-tools:parse-csv', csvContent, mapping),
  importDataRows: (options) => ipcRenderer.invoke('data-tools:execute-import', options),
  exportProfilesData: (options) => ipcRenderer.invoke('data-tools:export-profiles', options),
  parseCookies: (input, format) => ipcRenderer.invoke('cookies:parse', input, format),
  importCookies: (profileId, input, options) => ipcRenderer.invoke('cookies:import', profileId, input, options),
  exportCookies: (profileId, format) => ipcRenderer.invoke('cookies:export', profileId, format),

  getLocalApiStatus: () => ipcRenderer.invoke('local-api:status'),
  startLocalApi: (options) => ipcRenderer.invoke('local-api:start', options),
  stopLocalApi: () => ipcRenderer.invoke('local-api:stop'),
  revealLocalApiToken: () => ipcRenderer.invoke('local-api:reveal-token'),
  getExtensions: () => ipcRenderer.invoke('extensions:list'),
  getExtensionAssignments: (extensionId) => ipcRenderer.invoke('extensions:assignments', extensionId),
  registerExtensionDirectory: (sourcePath) => ipcRenderer.invoke('extensions:register-directory', sourcePath),
  registerExtensionCrx: (sourcePath) => ipcRenderer.invoke('extensions:register-crx', sourcePath),
  assignExtension: (extensionId, scopeType, scopeId, enabled) => ipcRenderer.invoke('extensions:assign', extensionId, scopeType, scopeId, enabled),
  removeExtension: (extensionId) => ipcRenderer.invoke('extensions:remove', extensionId),
  getTeamSyncStatus: (workspaceId) => ipcRenderer.invoke('team-sync:status', workspaceId),
  configureTeamSync: (config) => ipcRenderer.invoke('team-sync:configure', config),
  runTeamSync: (workspaceId, options) => ipcRenderer.invoke('team-sync:run', workspaceId, options),
  getTotpStatus: (profileId) => ipcRenderer.invoke('totp:status', profileId),
  setTotp: (profileId, input, options) => ipcRenderer.invoke('totp:set', profileId, input, options),
  removeTotp: (profileId) => ipcRenderer.invoke('totp:remove', profileId),
  copyTotp: (profileId) => ipcRenderer.invoke('totp:copy', profileId),
  startWarmup: (profileId, options) => ipcRenderer.invoke('warmup:start', profileId, options),
  cancelWarmup: (profileId) => ipcRenderer.invoke('warmup:cancel', profileId),
  getWarmupHistory: (profileId, limit) => ipcRenderer.invoke('warmup:history', profileId, limit),
  startActionSync: (masterId, workerIds) => ipcRenderer.invoke('action-sync:start', masterId, workerIds),
  stopActionSync: (id) => ipcRenderer.invoke('action-sync:stop', id),
  stopAllActionSync: () => ipcRenderer.invoke('action-sync:stop-all'),
  getActionSyncStatus: () => ipcRenderer.invoke('action-sync:status'),

  exportBackup: (options) => ipcRenderer.invoke('backup:export', options),
  pickImportBackup: () => ipcRenderer.invoke('backup:pick-import'),
  importBackup: (archivePath) => ipcRenderer.invoke('backup:import', archivePath),
  backupDatabase: () => ipcRenderer.invoke('backup:database'),

  exportProfiles: (options) => ipcRenderer.invoke('portability:export', options),
  pickImportProfiles: () => ipcRenderer.invoke('portability:pick-import'),
  inspectProfileExport: (archivePath) => ipcRenderer.invoke('portability:inspect', archivePath),
  importProfileExport: (archivePath, strategies) => ipcRenderer.invoke('portability:import', archivePath, strategies),

  getRecoveryOrphans: () => ipcRenderer.invoke('recovery:orphans'),
  decideRecoveryOrphan: (sessionId, decision) => ipcRenderer.invoke('recovery:decide', sessionId, decision),
  getReconnectFeasibility: () => ipcRenderer.invoke('recovery:reconnect-feasibility'),
  getSafeStartupMode: () => ipcRenderer.invoke('recovery:safe-startup-get'),
  setSafeStartupMode: (enabled) => ipcRenderer.invoke('recovery:safe-startup-set', enabled),
  getAppVersions: () => ipcRenderer.invoke('app:versions'),
  openAppPath: (kind) => ipcRenderer.invoke('app:open-path', kind),
  checkEnvironment: () => ipcRenderer.invoke('app:check-environment'),

  getResourceStatus: () => ipcRenderer.invoke('resource:status'),
  setMaxBrowsers: (n) => ipcRenderer.invoke('resource:set-max-browsers', n),
  setMaxAutomations: (n) => ipcRenderer.invoke('resource:set-max-automations', n),
  setMemoryThreshold: (n) => ipcRenderer.invoke('resource:set-memory-threshold', n),
  setLowResourceMode: (enabled) => ipcRenderer.invoke('resource:set-low-resource', enabled),
  checkMemoryWarning: () => ipcRenderer.invoke('resource:memory-warning'),

  onResourceEvent: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('resource-event', listener)
    return () => ipcRenderer.removeListener('resource-event', listener)
  },

  onRecoveryOrphansDetected: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('recovery-orphans-detected', listener)
    return () => ipcRenderer.removeListener('recovery-orphans-detected', listener)
  },

  onQueueUpdated: (callback) => {
    const listener = (_event, queue) => callback(queue)
    ipcRenderer.on('queue-updated', listener)
    return () => ipcRenderer.removeListener('queue-updated', listener)
  },

  openProfile: (id) => ipcRenderer.invoke('browser:open-profile', id),
  closeProfile: (id) => ipcRenderer.invoke('browser:close-profile', id),
  inspectProfileFingerprint: (id) => ipcRenderer.invoke('profiles:inspect-fingerprint', id),
  alignEnvironmentToProxy: (id) => ipcRenderer.invoke('profiles:align-environment-to-proxy', id),
  getRunningProfiles: () => ipcRenderer.invoke('browser:get-running'),
  getInstalledEngines: () => ipcRenderer.invoke('browser:get-installed-engines'),
  getMaxConcurrency: () => ipcRenderer.invoke('browser:get-max-concurrency'),
  setMaxConcurrency: (limit) => ipcRenderer.invoke('browser:set-max-concurrency', limit),

  getBrowsers: () => ipcRenderer.invoke('browsers:get-all'),
  scanBrowsers: (options) => ipcRenderer.invoke('browsers:scan', options),
  checkBrowser: (id) => ipcRenderer.invoke('browsers:check', id),
  addCustomBrowser: (data) => ipcRenderer.invoke('browsers:add-custom', data),
  removeCustomBrowser: (id) => ipcRenderer.invoke('browsers:remove-custom', id),
  refreshBrowserStatuses: () => ipcRenderer.invoke('browsers:refresh-statuses'),

  onProfileStatusChanged: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('profile-status-changed', listener)
    return () => ipcRenderer.removeListener('profile-status-changed', listener)
  },
})
