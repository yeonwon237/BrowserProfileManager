const fs = require('fs')
const path = require('path')
const { getDb, saveDb } = require('../database')
const { getAppDataPath } = require('../../shared/paths')
const { ensureIdentity, IDENTITY_VERSION } = require('./profileIdentity')

function rows(result) {
  if (!result?.[0]) return []
  const columns = result[0].columns
  return result[0].values.map((values) => Object.fromEntries(columns.map((column, index) => [column, values[index]])))
}

async function migrateLegacyProfileIdentities() {
  const db = await getDb()
  const profiles = rows(db.exec('SELECT id, name, browser_type, environment FROM profiles'))
  const pending = []
  for (const profile of profiles) {
    let environment = {}
    try { environment = JSON.parse(profile.environment || '{}') } catch {}
    if (environment?.identity?.version === IDENTITY_VERSION) continue
    pending.push({ profile, environment })
  }
  if (!pending.length) return { migrated: 0, backupPath: null }

  const backupDir = path.join(getAppDataPath(), 'backups', 'identity-migrations')
  fs.mkdirSync(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(backupDir, `legacy-identities-${stamp}.json`)
  fs.writeFileSync(backupPath, JSON.stringify(pending.map(({ profile }) => profile), null, 2))

  db.run('BEGIN TRANSACTION')
  try {
    for (const { profile, environment } of pending) {
      const migrated = ensureIdentity(profile.id, environment, profile.browser_type)
      db.run('UPDATE profiles SET environment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(migrated), profile.id])
    }
    db.run('COMMIT')
    saveDb()
    return { migrated: pending.length, backupPath }
  } catch (error) {
    try { db.run('ROLLBACK') } catch {}
    throw error
  }
}

module.exports = { migrateLegacyProfileIdentities }
