const crypto = require('crypto')
const { getDb, saveDb } = require('../database')
const { redactSecrets } = require('../security/redact')

function toArray(result) {
  if (!result || result.length === 0) return []
  const cols = result[0].columns
  return result[0].values.map((row) => {
    const obj = {}
    cols.forEach((col, i) => { obj[col] = row[i] })
    return obj
  })
}

function sanitizeMetadata(meta) {
  if (!meta || typeof meta !== 'object') return {}
  const safe = {}
  for (const [k, v] of Object.entries(meta)) {
    const lk = k.toLowerCase()
    if (
      lk.includes('cookie') ||
      lk.includes('token') ||
      lk.includes('password') ||
      lk.includes('secret') ||
      lk.includes('auth') ||
      lk.includes('session')
    ) {
      continue
    }
    safe[k] = v
  }
  return safe
}

let notificationSettings = {
  notifyOnAutomationFailure: true,
  notifyOnBrowserCrash: true,
  notifyOnBackupFailure: true,
  notifyOnProxyFailure: true,
}

function getNotificationSettings() {
  return { ...notificationSettings }
}

function updateNotificationSettings(newSettings = {}) {
  const allowed = ['notifyOnAutomationFailure', 'notifyOnBrowserCrash', 'notifyOnBackupFailure', 'notifyOnProxyFailure']
  const sanitized = {}
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(newSettings, key)) sanitized[key] = Boolean(newSettings[key])
  }
  notificationSettings = { ...notificationSettings, ...sanitized }
  return { ...notificationSettings }
}

/**
 * Adds a notification record if allowed by settings.
 */
async function addNotification({
  type = 'info',
  title,
  message = '',
  severity = 'info', // 'info', 'warning', 'error'
  metadata = {},
} = {}) {
  if (!title) return null

  // Check user notification settings
  if (type === 'automation_failed' && !notificationSettings.notifyOnAutomationFailure) return null
  if (type === 'browser_crash' && !notificationSettings.notifyOnBrowserCrash) return null
  if (type === 'backup_failure' && !notificationSettings.notifyOnBackupFailure) return null
  if (type === 'proxy_failure' && !notificationSettings.notifyOnProxyFailure) return null

  const db = await getDb()
  const id = `notif-${crypto.randomUUID()}`
  const safeMeta = sanitizeMetadata(metadata)
  const safeTitle = redactSecrets(String(title)).slice(0, 200)
  const safeMessage = redactSecrets(String(message)).slice(0, 1000)
  const safeSeverity = ['info', 'warning', 'error'].includes(severity) ? severity : 'info'

  db.run(
    `INSERT INTO notifications (id, type, title, message, severity, is_read, metadata)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [id, type, safeTitle, safeMessage, safeSeverity, JSON.stringify(safeMeta)]
  )
  saveDb()

  return {
    id,
    type,
    title: safeTitle,
    message: safeMessage,
    severity: safeSeverity,
    is_read: 0,
    metadata: safeMeta,
    created_at: new Date().toISOString(),
  }
}

/**
 * Returns notifications with pagination and unread counts.
 */
async function getNotifications(options = {}) {
  const db = await getDb()
  const limit = Math.max(1, Math.min(Number(options.limit) || 30, 100))

  let sql = 'SELECT * FROM notifications'
  const params = []
  if (options.unreadOnly) {
    sql += ' WHERE is_read = 0'
  }
  sql += ' ORDER BY created_at DESC LIMIT ?'
  params.push(limit)

  const rows = toArray(db.exec(sql, params))
  const countRow = db.exec('SELECT COUNT(*) as c FROM notifications WHERE is_read = 0')
  const unreadCount = countRow && countRow[0] && countRow[0].values[0] ? Number(countRow[0].values[0][0]) : 0

  return {
    notifications: rows.map((r) => {
      let parsedMeta = {}
      try { parsedMeta = JSON.parse(r.metadata) } catch {}
      return {
        ...r,
        is_read: Boolean(r.is_read),
        metadata: parsedMeta,
      }
    }),
    unreadCount,
  }
}

async function markAsRead(id) {
  const db = await getDb()
  db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id])
  saveDb()
  return { success: true }
}

async function markAllAsRead() {
  const db = await getDb()
  db.run('UPDATE notifications SET is_read = 1')
  saveDb()
  return { success: true }
}

async function clearAllNotifications() {
  const db = await getDb()
  db.run('DELETE FROM notifications')
  saveDb()
  return { success: true }
}

module.exports = {
  getNotificationSettings,
  updateNotificationSettings,
  addNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearAllNotifications,
}
