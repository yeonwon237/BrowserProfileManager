const crypto = require('crypto')
const { getDb, saveDb } = require('../database')
const automationQueue = require('./queue')

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

function computeNextRunAt(scheduleType, scheduleValue, fromDate = new Date()) {
  const from = new Date(fromDate)
  const now = new Date()
  const base = from > now ? from : now

  switch (scheduleType) {
    case 'once': {
      const target = new Date(scheduleValue)
      return isNaN(target.getTime()) ? null : target.toISOString()
    }

    case 'interval': {
      // scheduleValue in minutes (e.g. 30, 60) or seconds
      const minutes = Math.max(1, parseInt(scheduleValue) || 60)
      return new Date(base.getTime() + minutes * 60 * 1000).toISOString()
    }

    case 'daily': {
      // scheduleValue format "HH:MM", e.g. "09:30"
      const parts = String(scheduleValue || '09:00').split(':')
      const targetHour = parseInt(parts[0]) || 0
      const targetMinute = parseInt(parts[1]) || 0

      const next = new Date(base)
      next.setHours(targetHour, targetMinute, 0, 0)
      if (next <= base) {
        next.setDate(next.getDate() + 1)
      }
      return next.toISOString()
    }

    case 'weekly': {
      // scheduleValue format "day HH:MM", e.g. "monday 09:00" or numeric day "1 09:00"
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const tokens = String(scheduleValue || 'monday 09:00').toLowerCase().split(' ')
      let dayIndex = days.indexOf(tokens[0])
      if (dayIndex === -1) dayIndex = parseInt(tokens[0]) || 1
      dayIndex = Math.max(0, Math.min(6, dayIndex))

      const timeParts = (tokens[1] || '09:00').split(':')
      const targetHour = parseInt(timeParts[0]) || 0
      const targetMinute = parseInt(timeParts[1]) || 0

      const next = new Date(base)
      next.setHours(targetHour, targetMinute, 0, 0)
      let diff = dayIndex - base.getDay()
      if (diff < 0 || (diff === 0 && next <= base)) {
        diff += 7
      }
      next.setDate(base.getDate() + diff)
      return next.toISOString()
    }

    case 'cron': {
      // Simple 5-part cron fallback: min hour day month weekday
      // For basic cron intervals, default to next hour if custom
      return new Date(base.getTime() + 60 * 60 * 1000).toISOString()
    }

    default:
      return null
  }
}

function formatJob(row) {
  if (!row) return null
  return {
    ...row,
    enabled: Boolean(row.enabled),
    inputs: parseJson(row.inputs, {}),
    profile_selection_value:
      row.profile_selection_type === 'multiple'
        ? parseJson(row.profile_selection_value, [])
        : row.profile_selection_value,
  }
}

async function getAllScheduledJobs(options = {}) {
  const db = await getDb()
  let query = 'SELECT * FROM scheduled_jobs'
  const params = []
  if (options && options.workspace_id) {
    query += ' WHERE workspace_id IS NULL OR workspace_id = ? OR workspace_id = "default"'
    params.push(options.workspace_id)
  }
  query += ' ORDER BY created_at DESC'
  const rows = toArray(db.exec(query, params))
  return rows.map(formatJob)
}

async function getScheduledJobById(id) {
  const db = await getDb()
  const row = toObject(db.exec('SELECT * FROM scheduled_jobs WHERE id = ?', [id]))
  return formatJob(row)
}

async function createScheduledJob(data = {}) {
  const db = await getDb()
  const id = data.id || crypto.randomUUID()
  const name = (data.name || 'Untitled Scheduled Job').trim()
  const workspaceId = data.workspace_id || 'default'
  const automationId = data.automation_id
  const profileType = data.profile_selection_type || 'single'
  const profileValue =
    typeof data.profile_selection_value === 'object'
      ? JSON.stringify(data.profile_selection_value)
      : String(data.profile_selection_value || '')
  const inputs = JSON.stringify(data.inputs || {})
  const scheduleType = data.schedule_type || 'daily'
  const scheduleValue = String(data.schedule_value || '09:00')
  const enabled = data.enabled !== undefined ? (data.enabled ? 1 : 0) : 1
  const nextRunAt = enabled ? computeNextRunAt(scheduleType, scheduleValue) : null

  db.run(
    `INSERT INTO scheduled_jobs (
       id, name, workspace_id, automation_id, profile_selection_type,
       profile_selection_value, inputs, schedule_type, schedule_value,
       enabled, status, next_run_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      workspaceId,
      automationId,
      profileType,
      profileValue,
      inputs,
      scheduleType,
      scheduleValue,
      enabled,
      enabled ? 'enabled' : 'disabled',
      nextRunAt,
    ]
  )
  saveDb()
  return getScheduledJobById(id)
}

async function updateScheduledJob(id, data = {}) {
  const db = await getDb()
  const existing = await getScheduledJobById(id)
  if (!existing) throw new Error('Scheduled job not found')

  const name = data.name !== undefined ? String(data.name).trim() : existing.name
  const workspaceId = data.workspace_id !== undefined ? data.workspace_id : existing.workspace_id
  const automationId = data.automation_id !== undefined ? data.automation_id : existing.automation_id
  const profileType = data.profile_selection_type !== undefined ? data.profile_selection_type : existing.profile_selection_type
  const profileValue =
    data.profile_selection_value !== undefined
      ? typeof data.profile_selection_value === 'object'
        ? JSON.stringify(data.profile_selection_value)
        : String(data.profile_selection_value)
      : typeof existing.profile_selection_value === 'object'
      ? JSON.stringify(existing.profile_selection_value)
      : existing.profile_selection_value
  const inputs = data.inputs !== undefined ? JSON.stringify(data.inputs) : JSON.stringify(existing.inputs)
  const scheduleType = data.schedule_type !== undefined ? data.schedule_type : existing.schedule_type
  const scheduleValue = data.schedule_value !== undefined ? String(data.schedule_value) : existing.schedule_value
  const enabled = data.enabled !== undefined ? (data.enabled ? 1 : 0) : (existing.enabled ? 1 : 0)

  let nextRunAt = existing.next_run_at
  if (enabled && (data.schedule_type !== undefined || data.schedule_value !== undefined || !existing.enabled)) {
    nextRunAt = computeNextRunAt(scheduleType, scheduleValue)
  } else if (!enabled) {
    nextRunAt = null
  }

  db.run(
    `UPDATE scheduled_jobs SET
       name = ?,
       workspace_id = ?,
       automation_id = ?,
       profile_selection_type = ?,
       profile_selection_value = ?,
       inputs = ?,
       schedule_type = ?,
       schedule_value = ?,
       enabled = ?,
       status = ?,
       next_run_at = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      name,
      workspaceId,
      automationId,
      profileType,
      profileValue,
      inputs,
      scheduleType,
      scheduleValue,
      enabled,
      enabled ? 'enabled' : 'disabled',
      nextRunAt,
      id,
    ]
  )
  saveDb()
  return getScheduledJobById(id)
}

async function deleteScheduledJob(id) {
  const db = await getDb()
  db.run('DELETE FROM scheduled_jobs WHERE id = ?', [id])
  saveDb()
  return { success: true }
}

async function duplicateScheduledJob(id, data = {}) {
  const source = await getScheduledJobById(id)
  if (!source) throw new Error('Scheduled job not found')

  return createScheduledJob({
    name: data.name || `${source.name} (Copy)`,
    workspace_id: source.workspace_id,
    automation_id: source.automation_id,
    profile_selection_type: source.profile_selection_type,
    profile_selection_value: source.profile_selection_value,
    inputs: source.inputs,
    schedule_type: source.schedule_type,
    schedule_value: source.schedule_value,
    enabled: source.enabled,
  })
}

async function toggleScheduledJob(id, enabled) {
  const job = await getScheduledJobById(id)
  if (!job) throw new Error('Scheduled job not found')

  const nextRunAt = enabled ? computeNextRunAt(job.schedule_type, job.schedule_value) : null
  const db = await getDb()
  db.run(
    `UPDATE scheduled_jobs SET
       enabled = ?,
       status = ?,
       next_run_at = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [enabled ? 1 : 0, enabled ? 'enabled' : 'disabled', nextRunAt, id]
  )
  saveDb()
  return getScheduledJobById(id)
}

/**
 * Dynamically resolves target profile IDs at execution time.
 * If group or workspace is specified, queries the database right now.
 */
async function resolveProfileIds(job) {
  const db = await getDb()
  const type = job.profile_selection_type
  const value = job.profile_selection_value

  if (type === 'single') {
    return value ? [String(value)] : []
  }

  if (type === 'multiple') {
    return Array.isArray(value) ? value : parseJson(value, [])
  }

  if (type === 'group') {
    const groupName = typeof value === 'string' ? value : ''
    let query = 'SELECT id FROM profiles WHERE group_name = ?'
    const params = [groupName]
    if (job.workspace_id && job.workspace_id !== 'all') {
      query += ' AND (workspace_id = ? OR workspace_id IS NULL)'
      params.push(job.workspace_id)
    }
    const rows = toArray(db.exec(query, params))
    return rows.map((r) => r.id)
  }

  if (type === 'workspace') {
    const wsId = typeof value === 'string' && value ? value : job.workspace_id || 'default'
    const rows = toArray(db.exec('SELECT id FROM profiles WHERE workspace_id = ?', [wsId]))
    return rows.map((r) => r.id)
  }

  return []
}

/**
 * Executes a scheduled job by resolving profiles dynamically and enqueuing them.
 * STRICT RULE: Always sends jobs to Automation Queue. Never launches browser directly.
 */
async function executeScheduledJob(jobId) {
  const job = await getScheduledJobById(jobId)
  if (!job) return { success: false, error: 'Job not found' }

  const profileIds = await resolveProfileIds(job)
  if (profileIds.length === 0) {
    const db = await getDb()
    db.run(
      `UPDATE scheduled_jobs SET last_run_at = CURRENT_TIMESTAMP, last_error = 'No profiles resolved at runtime' WHERE id = ?`,
      [jobId]
    )
    saveDb()
    return { success: false, error: 'No matching profiles resolved for execution' }
  }

  // Enqueue via Automation Queue
  const enqueueResult = await automationQueue.enqueue(job.automation_id, profileIds, job.inputs)

  // Calculate next run time
  let nextRunAt = null
  let enabled = job.enabled ? 1 : 0
  let status = job.status

  if (job.schedule_type === 'once') {
    enabled = 0
    status = 'disabled'
    nextRunAt = null
  } else {
    nextRunAt = computeNextRunAt(job.schedule_type, job.schedule_value, new Date())
  }

  const db = await getDb()
  db.run(
    `UPDATE scheduled_jobs SET
       last_run_at = CURRENT_TIMESTAMP,
       next_run_at = ?,
       enabled = ?,
       status = ?,
       last_error = NULL,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [nextRunAt, enabled, status, jobId]
  )
  saveDb()

  return {
    success: true,
    queued: enqueueResult.queued,
    profileCount: profileIds.length,
    nextRunAt,
  }
}

let timerInterval = null

async function tick() {
  try {
    const db = await getDb()
    const nowIso = new Date().toISOString()
    const dueRows = toArray(
      db.exec(
        `SELECT id FROM scheduled_jobs WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?`,
        [nowIso]
      )
    )

    for (const row of dueRows) {
      try {
        await executeScheduledJob(row.id)
      } catch (err) {
        console.warn(`[scheduler] Failed executing job ${row.id}:`, err.message)
      }
    }
  } catch {
    // ignore
  }
}

function start(intervalMs = 15000) {
  if (timerInterval) return
  timerInterval = setInterval(tick, intervalMs)
  // Run an initial tick shortly after start
  setTimeout(tick, 2000)
}

function stop() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function seedDefaultScheduler(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS scheduled_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      workspace_id TEXT DEFAULT 'default',
      automation_id TEXT NOT NULL,
      profile_selection_type TEXT NOT NULL DEFAULT 'single',
      profile_selection_value TEXT,
      inputs TEXT DEFAULT '{}',
      schedule_type TEXT NOT NULL DEFAULT 'daily',
      schedule_value TEXT,
      enabled INTEGER DEFAULT 1,
      status TEXT DEFAULT 'enabled',
      last_run_at DATETIME,
      next_run_at DATETIME,
      last_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

module.exports = {
  getAllScheduledJobs,
  getScheduledJobById,
  createScheduledJob,
  updateScheduledJob,
  deleteScheduledJob,
  duplicateScheduledJob,
  toggleScheduledJob,
  executeScheduledJob,
  resolveProfileIds,
  computeNextRunAt,
  tick,
  start,
  stop,
  seedDefaultScheduler,
}
