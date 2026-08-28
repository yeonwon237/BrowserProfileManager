const { getDb, saveDb } = require('./database')

async function getSetting(key, defaultValue = null) {
  const db = await getDb()
  const result = db.exec('SELECT value FROM settings WHERE key = ?', [key])
  if (!result || result.length === 0 || !result[0].values[0]) return defaultValue
  return result[0].values[0][0]
}

async function setSetting(key, value) {
  const db = await getDb()
  db.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, String(value)]
  )
  saveDb()
  return value
}

const DEFAULT_MAX_CONCURRENT = 1

async function getMaxConcurrent() {
  const raw = await getSetting('maxConcurrentProfiles', String(DEFAULT_MAX_CONCURRENT))
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : DEFAULT_MAX_CONCURRENT
}

async function setMaxConcurrent(n) {
  const value = Number.isInteger(Number(n)) && Number(n) >= 1 ? Number(n) : DEFAULT_MAX_CONCURRENT
  await setSetting('maxConcurrentProfiles', String(value))
  return value
}

module.exports = { getSetting, setSetting, getMaxConcurrent, setMaxConcurrent }