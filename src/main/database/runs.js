const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { getDb, saveDb } = require('./index')
const { getRunsPath } = require('../../shared/paths')
const { redactSecrets, redactObject } = require('../security/redact')

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

function ensureRunDir(runId) {
  const dir = getRunsPath(runId)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getRunLogPath(runId) {
  return path.join(getRunsPath(runId), 'run.log')
}

function appendLogFile(runId, level, message) {
  try {
    const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${redactSecrets(String(message || ''))}\n`
    fs.appendFileSync(getRunLogPath(runId), line)
  } catch {
    // ignore file write errors
  }
}

function categorizeError(errMsg) {
  if (!errMsg) return null
  const msg = String(errMsg).toLowerCase()
  if (msg.includes('health') || msg.includes('pre-flight') || msg.includes('binary')) return 'HEALTH_CHECK'
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('waitfor')) return 'TIMEOUT'
  if (msg.includes('navigation') || msg.includes('err_connection') || msg.includes('dns')) return 'NAVIGATION'
  if (msg.includes('auth') || msg.includes('login') || msg.includes('password') || msg.includes('401') || msg.includes('403')) return 'AUTH'
  if (msg.includes('cancel') || msg.includes('stopped by user')) return 'USER_CANCELLED'
  if (msg.includes('plugin') || msg.includes('syntax') || msg.includes('referenceerror') || msg.includes('typeerror')) return 'PLUGIN_ERROR'
  return 'UNKNOWN'
}

async function createRun({ tool, profile, inputs, workspace_id, retry_count = 0 }) {
  const db = await getDb()
  const id = crypto.randomUUID()
  const logsPath = ensureRunDir(id)
  const startTime = new Date().toISOString()
  const wsId = workspace_id || (profile ? profile.workspace_id : 'default') || 'default'
  const safeInputs = JSON.stringify(redactObject(inputs || {}))

  db.run(
    `INSERT INTO runs (
       id, tool_id, tool_name, profile_id, profile_name, workspace_id,
       status, start_time, logs_path, inputs, retry_count
     ) VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, ?)`,
    [
      id,
      tool.id,
      tool.name || tool.id,
      profile.id,
      profile.name || profile.id,
      wsId,
      startTime,
      logsPath,
      safeInputs,
      retry_count,
    ]
  )
  saveDb()
  appendLogFile(id, 'info', `Run started: ${tool.name || tool.id} on ${profile.name || profile.id}`)
  return { id, logsPath, startTime }
}

async function addRunLog(runId, level, message) {
  const db = await getDb()
  const safeMessage = redactSecrets(String(message || ''))
  db.run(
    `INSERT INTO run_logs (run_id, level, message) VALUES (?, ?, ?)`,
    [runId, level || 'info', safeMessage]
  )
  saveDb()
  appendLogFile(runId, level || 'info', safeMessage)
}

async function finishRun(runId, { status, error, errorCategory, url, screenshotPath }) {
  const db = await getDb()
  const existing = toObject(db.exec('SELECT * FROM runs WHERE id = ?', [runId]))
  if (!existing) return null

  const now = new Date()
  const endTime = now.toISOString()
  let durationMs = null
  if (existing.start_time) {
    durationMs = Math.max(0, now.getTime() - new Date(existing.start_time).getTime())
  }

  const finalStatus = status || 'success'
  const finalError = error !== undefined ? error : existing.error
  const category = errorCategory || (finalError ? categorizeError(finalError) : null)

  db.run(
    `UPDATE runs SET
       status = ?,
       end_time = ?,
       duration_ms = ?,
       error = ?,
       error_category = ?,
       url = ?,
       screenshot_path = ?
     WHERE id = ?`,
    [
      finalStatus,
      endTime,
      durationMs,
      finalError ? redactSecrets(finalError) : null,
      category,
      url || existing.url,
      screenshotPath || existing.screenshot_path,
      runId,
    ]
  )
  saveDb()
  appendLogFile(runId, 'info', `Run finished: ${finalStatus} (duration: ${durationMs}ms)`)
  if (finalError) appendLogFile(runId, 'error', redactSecrets(finalError))
  return getRunById(runId)
}

async function getRunById(runId) {
  const db = await getDb()
  const row = toObject(db.exec('SELECT * FROM runs WHERE id = ?', [runId]))
  return row
}

/**
 * Filtered, paginated runs query.
 */
async function getRuns(options = {}) {
  const db = await getDb()
  const page = Math.max(1, parseInt(options.page) || 1)
  const pageSize = Math.max(1, Math.min(100, parseInt(options.pageSize) || 20))
  const offset = (page - 1) * pageSize

  let whereClauses = []
  let params = []

  if (options.workspace_id && options.workspace_id !== 'all') {
    whereClauses.push('(workspace_id = ? OR workspace_id IS NULL)')
    params.push(options.workspace_id)
  }

  if (options.status && options.status !== 'all') {
    whereClauses.push('status = ?')
    params.push(options.status)
  }

  if (options.tool_id) {
    whereClauses.push('tool_id = ?')
    params.push(options.tool_id)
  }

  if (options.profile_id) {
    whereClauses.push('profile_id = ?')
    params.push(options.profile_id)
  }

  if (options.startDate) {
    whereClauses.push('start_time >= ?')
    params.push(options.startDate)
  }

  if (options.endDate) {
    whereClauses.push('start_time <= ?')
    params.push(options.endDate)
  }

  if (options.search) {
    whereClauses.push('(tool_name LIKE ? OR profile_name LIKE ? OR error LIKE ?)')
    const pattern = `%${options.search}%`
    params.push(pattern, pattern, pattern)
  }

  const whereSql = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : ''

  // Total count
  const countResult = db.exec(`SELECT COUNT(*) as total FROM runs${whereSql}`, params)
  const total = countResult && countResult[0] && countResult[0].values[0] ? countResult[0].values[0][0] : 0
  const totalPages = Math.ceil(total / pageSize) || 1

  // Paginated records
  const query = `SELECT * FROM runs${whereSql} ORDER BY start_time DESC LIMIT ? OFFSET ?`
  const runs = toArray(db.exec(query, [...params, pageSize, offset]))

  return {
    runs,
    total,
    page,
    pageSize,
    totalPages,
  }
}

/**
 * Detailed run inspection with log file contents & secret redaction.
 */
async function getRunDetails(runId) {
  const run = await getRunById(runId)
  if (!run) return null

  let logContent = ''
  const logPath = getRunLogPath(runId)
  if (fs.existsSync(logPath)) {
    try {
      const raw = fs.readFileSync(logPath, 'utf8')
      logContent = redactSecrets(raw)
    } catch {
      logContent = 'Failed reading log file'
    }
  }

  const dbLogs = await getRunLogs(runId, 500)

  return {
    ...run,
    logContent,
    dbLogs,
    hasScreenshot: run.screenshot_path ? fs.existsSync(run.screenshot_path) : false,
  }
}

/**
 * Aggregates local analytics from SQLite.
 * No cloud telemetry — 100% local computation.
 */
async function getAutomationAnalytics(options = {}) {
  const db = await getDb()
  let whereClauses = []
  let params = []

  if (options.workspace_id && options.workspace_id !== 'all') {
    whereClauses.push('(workspace_id = ? OR workspace_id IS NULL)')
    params.push(options.workspace_id)
  }
  if (options.startDate) {
    whereClauses.push('start_time >= ?')
    params.push(options.startDate)
  }
  if (options.endDate) {
    whereClauses.push('start_time <= ?')
    params.push(options.endDate)
  }

  const whereSql = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : ''

  // Total and status counts
  const statusRows = toArray(
    db.exec(`SELECT status, COUNT(*) as count FROM runs${whereSql} GROUP BY status`, params)
  )
  const statusDistribution = { success: 0, failed: 0, running: 0, waiting: 0, cancelled: 0, skipped: 0 }
  let totalRuns = 0
  statusRows.forEach((r) => {
    const s = r.status || 'unknown'
    const c = Number(r.count) || 0
    if (statusDistribution[s] !== undefined) statusDistribution[s] = c
    else statusDistribution[s] = c
    totalRuns += c
  })

  const successCount = statusDistribution.success || 0
  const failCount = (statusDistribution.failed || 0) + (statusDistribution.error || 0)
  const successRate = totalRuns > 0 ? Math.round((successCount / totalRuns) * 100) : 0
  const failureRate = totalRuns > 0 ? Math.round((failCount / totalRuns) * 100) : 0

  // Average duration
  const durClauses = [...whereClauses, 'duration_ms IS NOT NULL', 'duration_ms > 0']
  const avgResult = db.exec(
    `SELECT AVG(duration_ms) as avg_duration FROM runs WHERE ${durClauses.join(' AND ')}`,
    params
  )
  const averageDurationMs =
    avgResult && avgResult[0] && avgResult[0].values[0] && avgResult[0].values[0][0]
      ? Math.round(avgResult[0].values[0][0])
      : 0

  // Runs today & last 7 days
  const todayClauses = [...whereClauses, "date(start_time, 'localtime') = date('now', 'localtime')"]
  const todayResult = db.exec(
    `SELECT COUNT(*) as count FROM runs WHERE ${todayClauses.join(' AND ')}`,
    params
  )
  const runsToday =
    todayResult && todayResult[0] && todayResult[0].values[0] ? Number(todayResult[0].values[0][0]) : 0

  const last7Clauses = [...whereClauses, "start_time >= datetime('now', '-7 days')"]
  const last7Result = db.exec(
    `SELECT COUNT(*) as count FROM runs WHERE ${last7Clauses.join(' AND ')}`,
    params
  )
  const runsLast7Days =
    last7Result && last7Result[0] && last7Result[0].values[0] ? Number(last7Result[0].values[0][0]) : 0

  // Top failing automations
  const failAutoClauses = [...whereClauses, "status = 'failed'"]
  const topFailingAutoRows = toArray(
    db.exec(
      `SELECT tool_id, tool_name, COUNT(*) as fail_count FROM runs WHERE ${failAutoClauses.join(' AND ')} GROUP BY tool_id, tool_name ORDER BY fail_count DESC LIMIT 5`,
      params
    )
  )

  // Top failing profiles
  const failProfileClauses = [...whereClauses, "status = 'failed'"]
  const topFailingProfileRows = toArray(
    db.exec(
      `SELECT profile_id, profile_name, COUNT(*) as fail_count FROM runs WHERE ${failProfileClauses.join(' AND ')} GROUP BY profile_id, profile_name ORDER BY fail_count DESC LIMIT 5`,
      params
    )
  )

  // Daily breakdown last 7 days
  const dailyClauses = [...whereClauses, "start_time >= datetime('now', '-7 days')"]
  const dailyRows = toArray(
    db.exec(
      `SELECT
         date(start_time, 'localtime') as day,
         COUNT(*) as total,
         SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as fail_count
       FROM runs
       WHERE ${dailyClauses.join(' AND ')}
       GROUP BY day
       ORDER BY day ASC`,
      params
    )
  )

  return {
    totalRuns,
    successRate,
    failureRate,
    averageDurationMs,
    runsToday,
    runsLast7Days,
    statusDistribution,
    topFailingAutomations: topFailingAutoRows,
    topFailingProfiles: topFailingProfileRows,
    runsByDay: dailyRows,
  }
}

async function getRecentRuns(limit = 100) {
  const db = await getDb()
  return toArray(db.exec(
    `SELECT * FROM runs ORDER BY start_time DESC LIMIT ?`,
    [Number(limit) || 100]
  ))
}

async function getRunLogs(runId, limit = 500) {
  const db = await getDb()
  return toArray(db.exec(
    `SELECT * FROM run_logs WHERE run_id = ? ORDER BY id ASC LIMIT ?`,
    [runId, Number(limit) || 500]
  ))
}

async function hasScreenshot(runId) {
  const run = await getRunById(runId)
  if (!run || !run.screenshot_path) return false
  return fs.existsSync(run.screenshot_path)
}

module.exports = {
  createRun,
  addRunLog,
  finishRun,
  getRunById,
  getRuns,
  getRunDetails,
  getAutomationAnalytics,
  getRecentRuns,
  getRunLogs,
  hasScreenshot,
  getRunLogPath,
}