const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')
const { getDatabasePath } = require('../../shared/paths')
const migration = require('./migration')

let db = null
let dbPath = null

async function getDb() {
  if (db) return db

  const SQL = await initSqlJs()
  dbPath = getDatabasePath()
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  initSchema()
  // Versioned schema migrations (backup + sequential, rollback on failure).
  await migration.run(db)
  saveDb()
  return db
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      group_name TEXT,
      tags TEXT DEFAULT '[]',
      notes TEXT,
      browser_data_path TEXT,
      proxy_id TEXT,
      browser_type TEXT NOT NULL DEFAULT 'chromium',
      browser_channel TEXT,
      browser_version TEXT,
      environment TEXT DEFAULT '{}',
      status TEXT DEFAULT 'idle',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS proxies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      protocol TEXT NOT NULL DEFAULT 'http',
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      username TEXT,
      encrypted_password TEXT,
      country_code TEXT,
      country_name TEXT,
      city TEXT,
      timezone TEXT,
      geo_metadata TEXT DEFAULT '{}',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id TEXT,
      action TEXT NOT NULL,
      status TEXT DEFAULT 'info',
      message TEXT,
      screenshot_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      tool_path TEXT,
      enabled INTEGER DEFAULT 1,
      installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      tool_id TEXT,
      tool_name TEXT,
      profile_id TEXT,
      profile_name TEXT,
      status TEXT DEFAULT 'running',
      start_time TEXT,
      end_time TEXT,
      error TEXT,
      url TEXT,
      screenshot_path TEXT,
      logs_path TEXT
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS run_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT,
      level TEXT DEFAULT 'info',
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS browser_binaries (
      id TEXT PRIMARY KEY,
      browser_type TEXT NOT NULL,
      channel TEXT,
      name TEXT NOT NULL,
      version TEXT,
      executable_path TEXT,
      source TEXT NOT NULL DEFAULT 'system',
      status TEXT NOT NULL DEFAULT 'available',
      detected_at TEXT,
      last_checked_at TEXT
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS environment_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      platform TEXT DEFAULT 'windows',
      browser_type TEXT DEFAULT 'chromium',
      locale TEXT DEFAULT 'en-US',
      timezone_mode TEXT DEFAULT 'custom',
      timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
      languages TEXT DEFAULT '["en-US", "en"]',
      viewport_width INTEGER DEFAULT 1920,
      viewport_height INTEGER DEFAULT 1080,
      device_scale_factor REAL DEFAULT 1.0,
      color_scheme TEXT DEFAULT 'no-preference',
      reduced_motion TEXT DEFAULT 'no-preference',
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS config_presets (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      workspace_id TEXT,
      config TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      severity TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`CREATE TABLE IF NOT EXISTS extensions (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, version TEXT, manifest_version INTEGER,
    source_path TEXT NOT NULL, sha256 TEXT NOT NULL, enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS extension_assignments (
    extension_id TEXT NOT NULL, scope_type TEXT NOT NULL, scope_id TEXT NOT NULL,
    enabled INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (extension_id, scope_type, scope_id)
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS profile_secrets (
    profile_id TEXT NOT NULL, secret_type TEXT NOT NULL, encrypted_value TEXT NOT NULL,
    metadata TEXT DEFAULT '{}', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (profile_id, secret_type)
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS warmup_runs (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, status TEXT NOT NULL,
    urls_total INTEGER DEFAULT 0, urls_completed INTEGER DEFAULT 0,
    report TEXT DEFAULT '[]', error TEXT, started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS profile_leases (
    profile_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, lease_token TEXT NOT NULL UNIQUE,
    acquired_at DATETIME NOT NULL, expires_at DATETIME NOT NULL,
    metadata TEXT DEFAULT '{}'
  )`)
  db.run('CREATE INDEX IF NOT EXISTS idx_profile_leases_expires ON profile_leases(expires_at)')

  migrateProfilesTable()
  migrateProxiesTable()
  migrateRunsTable()

  try {
    const workspacesRepo = require('./workspaces')
    workspacesRepo.seedDefaultWorkspace(db)
  } catch (err) {
    // ignore
  }

  try {
    const templatesRepo = require('./templates')
    templatesRepo.seedDefaultTemplate(db)
  } catch (err) {
    // ignore
  }

  try {
    const schedulerModule = require('../automation/scheduler')
    schedulerModule.seedDefaultScheduler(db)
  } catch (err) {
    // ignore
  }

  try {
    const presetsRepo = require('./presets')
    presetsRepo.seedDefaultPresets(db)
  } catch (err) {
    // ignore
  }
}

function tableColumns(tableName) {
  const result = db.exec(`PRAGMA table_info(${tableName})`)
  if (result.length === 0) return []
  return result[0].values.map((row) => row[1])
}

function migrateProfilesTable() {
  const cols = tableColumns('profiles')

  const addColumn = (name, definition) => {
    if (!cols.includes(name)) {
      db.run(`ALTER TABLE profiles ADD COLUMN ${name} ${definition}`)
    }
  }

  addColumn('group_name', 'TEXT')
  addColumn('tags', "TEXT DEFAULT '[]'")
  addColumn('notes', 'TEXT')
  addColumn('browser_data_path', 'TEXT')
  addColumn('proxy_id', 'TEXT')
  addColumn('workspace_id', "TEXT DEFAULT 'default'")
  addColumn('browser_type', "TEXT NOT NULL DEFAULT 'chromium'")
  addColumn('browser_channel', 'TEXT')
  addColumn('browser_version', 'TEXT')
  addColumn('environment', "TEXT DEFAULT '{}'")
}

function migrateProxiesTable() {
  const cols = tableColumns('proxies')

  const addColumn = (name, definition) => {
    if (!cols.includes(name)) {
      db.run(`ALTER TABLE proxies ADD COLUMN ${name} ${definition}`)
    }
  }

  addColumn('protocol', "TEXT NOT NULL DEFAULT 'http'")
  addColumn('username', 'TEXT')
  addColumn('encrypted_password', 'TEXT')
  addColumn('country_code', 'TEXT')
  addColumn('country_name', 'TEXT')
  addColumn('city', 'TEXT')
  addColumn('timezone', 'TEXT')
  addColumn('geo_metadata', "TEXT DEFAULT '{}'")
  addColumn('notes', 'TEXT')
  addColumn('workspace_id', 'TEXT')
  addColumn('tags', "TEXT DEFAULT '[]'")
  addColumn('group_name', 'TEXT')
  addColumn('status', "TEXT DEFAULT 'unknown'")
  addColumn('latency', 'INTEGER')
  addColumn('last_tested', 'DATETIME')
  addColumn('max_profiles', 'INTEGER DEFAULT 5')
  addColumn('created_at', 'DATETIME')
  addColumn('updated_at', 'DATETIME')
}

function migrateRunsTable() {
  const cols = tableColumns('runs')

  const addColumn = (name, definition) => {
    if (!cols.includes(name)) {
      db.run(`ALTER TABLE runs ADD COLUMN ${name} ${definition}`)
    }
  }

  addColumn('workspace_id', "TEXT DEFAULT 'default'")
  addColumn('duration_ms', 'INTEGER')
  addColumn('error_category', 'TEXT')
  addColumn('retry_count', 'INTEGER DEFAULT 0')
  addColumn('inputs', "TEXT DEFAULT '{}'")
}

function saveDb() {
  if (db && dbPath) {
    const data = db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(dbPath, buffer)
  }
}

function closeDb() {
  if (db) {
    saveDb()
    db.close()
    db = null
  }
}

module.exports = { getDb, saveDb, closeDb }
