const { getDb, saveDb } = require('./index')
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

async function addLog({ profile_id, action, status = 'info', message, screenshot_path } = {}) {
  const db = await getDb()
  const safeMessage = redactSecrets(String(message || ''))
  db.run(
    `INSERT INTO logs (profile_id, action, status, message, screenshot_path)
     VALUES (?, ?, ?, ?, ?)`,
    [profile_id || null, action || 'unknown', status || 'info', safeMessage, screenshot_path || null]
  )
  saveDb()
  return { success: true }
}

async function getLogs(limit = 200) {
  const db = await getDb()
  return toArray(db.exec(
    `SELECT * FROM logs ORDER BY created_at DESC LIMIT ?`,
    [Number(limit) || 200]
  ))
}

module.exports = { addLog, getLogs }