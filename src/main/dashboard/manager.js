const { getDb } = require('../database')
const browserManager = require('../browser/manager')
const automationQueue = require('../automation/queue')
const resourceManager = require('../browser/resourceManager')

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

async function getMetrics(options = {}) {
  const db = await getDb()
  const workspaceId = options.workspace_id || null

  let profileWhere = ''
  let profileParams = []
  if (workspaceId) {
    const cols = (db.exec('PRAGMA table_info(profiles)')[0] || { values: [] }).values.map((r) => r[1])
    if (cols.includes('workspace_id')) {
      profileWhere = ' WHERE workspace_id = ?'
      profileParams = [workspaceId]
    }
  }

  // Profile counts
  const totalRow = toObject(db.exec(`SELECT COUNT(*) as count FROM profiles${profileWhere}`, profileParams))
  const totalProfiles = totalRow ? Number(totalRow.count || 0) : 0

  const statusRows = toArray(
    db.exec(`SELECT status, COUNT(*) as count FROM profiles${profileWhere} GROUP BY status`, profileParams)
  )
  const statusMap = {}
  statusRows.forEach((r) => {
    statusMap[r.status] = Number(r.count || 0)
  })

  const runningIds = new Set(browserManager.getRunningIds ? browserManager.getRunningIds() : [])
  const runningProfiles = runningIds.size
  const errorProfiles = (statusMap['error'] || 0) + (statusMap['crashed'] || 0)
  const warningProfiles = statusMap['warning'] || 0
  const queuedProfiles = statusMap['queued'] || 0
  const readyProfiles = Math.max(0, totalProfiles - runningProfiles - errorProfiles - warningProfiles - queuedProfiles)

  // Queue counts
  const queueCounts = automationQueue.getCounts ? automationQueue.getCounts() : { waiting: 0, running: 0, total: 0 }
  const activeBrowsers = runningProfiles
  const activeAutomations = queueCounts.running || 0
  const waitingJobs = queueCounts.waiting || 0

  // Runs counts today (Local / UTC date matching)
  const todayPrefix = new Date().toISOString().slice(0, 10)
  let runsWhere = `WHERE start_time >= '${todayPrefix}T00:00:00'`
  if (workspaceId) {
    const runCols = (db.exec('PRAGMA table_info(runs)')[0] || { values: [] }).values.map((r) => r[1])
    if (runCols.includes('workspace_id')) {
      runsWhere += ` AND workspace_id = '${workspaceId}'`
    }
  }

  const successTodayRow = toObject(
    db.exec(`SELECT COUNT(*) as count FROM runs ${runsWhere} AND status = 'success'`)
  )
  const failedTodayRow = toObject(
    db.exec(`SELECT COUNT(*) as count FROM runs ${runsWhere} AND status IN ('failed', 'error')`)
  )

  const successfulJobsToday = successTodayRow ? Number(successTodayRow.count || 0) : 0
  const failedJobsToday = failedTodayRow ? Number(failedTodayRow.count || 0) : 0

  // Resources
  let resourceStatus = {
    cpu: 0,
    memory: { usedMb: 0, totalMb: 0, percent: 0 },
    browsers: { active: activeBrowsers, max: 5 },
    automations: { active: activeAutomations, max: 3 },
    queueSize: queueCounts.total || 0,
  }

  if (resourceManager && typeof resourceManager.getStatus === 'function') {
    try {
      const res = await resourceManager.getStatus()
      resourceStatus = {
        cpu: res.cpu || 0,
        memory: res.memory || { usedMb: 0, totalMb: 0, percent: 0 },
        browsers: { active: activeBrowsers, max: res.browsers ? res.browsers.max : 5 },
        automations: { active: activeAutomations, max: res.automations ? res.automations.max : 3 },
        queueSize: queueCounts.total || 0,
      }
    } catch {
      // fallback
    }
  }

  return {
    totalProfiles,
    readyProfiles,
    runningProfiles,
    warningProfiles,
    errorProfiles,
    activeBrowsers,
    activeAutomations,
    waitingJobs,
    failedJobsToday,
    successfulJobsToday,
    resourceStatus,
  }
}

async function getRecentActivity(limit = 25) {
  const db = await getDb()
  const parsedLimit = Math.min(Math.max(Number(limit) || 25, 1), 100)

  // Fetch recent logs
  const logRows = toArray(
    db.exec(
      `SELECT l.id, l.profile_id, l.action, l.status, l.message, l.screenshot_path, l.created_at,
              p.name as profile_name
       FROM logs l
       LEFT JOIN profiles p ON l.profile_id = p.id
       ORDER BY l.created_at DESC
       LIMIT ?`,
      [parsedLimit]
    )
  )

  // Fetch recent runs
  const runRows = toArray(
    db.exec(
      `SELECT id, tool_id, tool_name, profile_id, profile_name, status, start_time, end_time, error
       FROM runs
       ORDER BY start_time DESC
       LIMIT ?`,
      [parsedLimit]
    )
  )

  const activities = []

  for (const log of logRows) {
    let activityType = 'info'
    let title = log.action

    if (log.action === 'profile:open') {
      activityType = 'profile_open'
      title = 'Profile Opened'
    } else if (log.action === 'profile:close') {
      activityType = 'profile_close'
      title = 'Profile Closed'
    } else if (log.action === 'browser:crash') {
      activityType = 'browser_crash'
      title = 'Browser Crashed'
    } else if (log.action === 'privacy-guard') {
      activityType = 'proxy_warning'
      title = 'Proxy / IP Warning'
    } else if (log.action && log.action.startsWith('portability:')) {
      activityType = 'import_export'
      title = log.action === 'portability:import' ? 'Profiles Imported' : 'Profiles Exported'
    } else if (log.action && log.action.startsWith('backup:')) {
      activityType = 'import_export'
      title = 'Backup Activity'
    }

    activities.push({
      id: `log-${log.id}`,
      type: activityType,
      title,
      message: log.message,
      status: log.status || 'info',
      profileId: log.profile_id,
      profileName: log.profile_name,
      screenshotPath: log.screenshot_path,
      timestamp: log.created_at,
    })
  }

  for (const run of runRows) {
    let activityType = 'automation_run'
    let title = `Automation: ${run.tool_name || run.tool_id}`
    let status = 'info'

    if (run.status === 'success') {
      activityType = 'automation_success'
      status = 'success'
    } else if (run.status === 'failed' || run.status === 'error') {
      activityType = 'automation_fail'
      status = 'error'
    }

    activities.push({
      id: `run-${run.id}`,
      type: activityType,
      title,
      message: run.error || `Run ${run.status} on profile "${run.profile_name || run.profile_id}"`,
      status,
      profileId: run.profile_id,
      profileName: run.profile_name,
      timestamp: run.start_time,
    })
  }

  // Sort unified activities by timestamp descending
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return activities.slice(0, parsedLimit)
}

module.exports = {
  getMetrics,
  getRecentActivity,
}
