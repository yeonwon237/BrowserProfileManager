const fs = require('fs')
const { getDatabasePath } = require('../../shared/paths')

const SCHEMA_VERSION = 14
const META_TABLE = 'meta'

function tableColumns(db, tableName) {
  try {
    const result = db.exec(`PRAGMA table_info(${tableName})`)
    if (!result || result.length === 0) return []
    return result[0].values.map((row) => row[1])
  } catch {
    return []
  }
}

function ensureMetaTable(db) {
  db.run(`CREATE TABLE IF NOT EXISTS ${META_TABLE} (key TEXT PRIMARY KEY, value TEXT)`)
}

function getSchemaVersion(db) {
  ensureMetaTable(db)
  try {
    const result = db.exec('SELECT value FROM meta WHERE key = ?', ['schema_version'])
    if (result && result.length > 0 && result[0].values.length > 0) {
      const n = Number(result[0].values[0][0])
      if (Number.isInteger(n) && n >= 1) return n
    }
  } catch {
    // fall through to baseline
  }
  return 1
}

function setSchemaVersion(db, version) {
  ensureMetaTable(db)
  db.run(
    `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(version)]
  )
}

/**
 * Versioned migrations. Each migration upgrades the schema by exactly one
 * version and must be idempotent for databases that already contain some of
 * the target state.
 */
const MIGRATIONS = [
  {
    to: 2,
    up(db) {
      ensureMetaTable(db)
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
    },
  },
  {
    to: 3,
    up(db) {
      // Backfill columns that older app versions may be missing.
      const profilesCols = tableColumns(db, 'profiles')
      const addProfile = (name, def) => {
        if (!profilesCols.includes(name)) {
          db.run(`ALTER TABLE profiles ADD COLUMN ${name} ${def}`)
        }
      }
      addProfile('group_name', 'TEXT')
      addProfile('tags', "TEXT DEFAULT '[]'")
      addProfile('notes', 'TEXT')
      addProfile('browser_data_path', 'TEXT')
      addProfile('proxy_id', 'TEXT')
      addProfile('browser_type', "TEXT NOT NULL DEFAULT 'chromium'")
      addProfile('browser_channel', 'TEXT')
      addProfile('browser_version', 'TEXT')
      addProfile('environment', "TEXT DEFAULT '{}'")

      // Proxies may be missing in very old databases — never assume it exists.
      if (tableColumns(db, 'proxies').length > 0) {
        const proxiesCols = tableColumns(db, 'proxies')
        const addProxy = (name, def) => {
          if (!proxiesCols.includes(name)) {
            db.run(`ALTER TABLE proxies ADD COLUMN ${name} ${def}`)
          }
        }
        addProxy('protocol', "TEXT NOT NULL DEFAULT 'http'")
        addProxy('username', 'TEXT')
        addProxy('encrypted_password', 'TEXT')
        addProxy('country_code', 'TEXT')
        addProxy('country_name', 'TEXT')
        addProxy('city', 'TEXT')
        addProxy('timezone', 'TEXT')
        addProxy('geo_metadata', "TEXT DEFAULT '{}'")
        addProxy('notes', 'TEXT')
        addProxy('updated_at', 'DATETIME')
      }
    },
  },
  {
    to: 4,
    up(db) {
      ensureMetaTable(db)
      db.run(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          default_browser_settings TEXT DEFAULT '{}',
          default_automation_settings TEXT DEFAULT '{}',
          is_default INTEGER DEFAULT 0,
          is_archived INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      db.run(`
        INSERT OR IGNORE INTO workspaces (id, name, description, is_default, is_archived)
        VALUES ('default', 'Default Workspace', 'Primary default workspace', 1, 0)
      `)

      const addColumnIfMissing = (table, col, def) => {
        const cols = tableColumns(db, table)
        if (cols.length > 0 && !cols.includes(col)) {
          db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`)
        }
      }

      addColumnIfMissing('profiles', 'workspace_id', "TEXT DEFAULT 'default'")
      addColumnIfMissing('proxies', 'workspace_id', 'TEXT')
      addColumnIfMissing('environment_presets', 'workspace_id', 'TEXT')
      addColumnIfMissing('automations', 'workspace_id', 'TEXT')
      addColumnIfMissing('runs', 'workspace_id', "TEXT DEFAULT 'default'")

      db.run(`UPDATE profiles SET workspace_id = 'default' WHERE workspace_id IS NULL OR workspace_id = ''`)
    },
  },
  {
    to: 5,
    up(db) {
      ensureMetaTable(db)
      db.run(`
        CREATE TABLE IF NOT EXISTS profile_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          workspace_id TEXT DEFAULT 'default',
          browser_type TEXT NOT NULL DEFAULT 'chromium',
          browser_channel TEXT,
          browser_version TEXT,
          environment TEXT DEFAULT '{}',
          proxy_id TEXT,
          tags TEXT DEFAULT '[]',
          group_name TEXT,
          notes_template TEXT,
          automation_defaults TEXT DEFAULT '{}',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
    },
  },
  {
    to: 6,
    up(db) {
      ensureMetaTable(db)
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
    },
  },
  {
    to: 7,
    up(db) {
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
    },
  },
  {
    to: 8,
    up(db) {
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
    },
  },
  {
    to: 9,
    up(db) {
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
    },
  },
  {
    to: 10,
    up(db) {
      db.run(`CREATE TABLE IF NOT EXISTS profile_secrets (
        profile_id TEXT NOT NULL, secret_type TEXT NOT NULL, encrypted_value TEXT NOT NULL,
        metadata TEXT DEFAULT '{}', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (profile_id, secret_type)
      )`)
    },
  },
  {
    to: 11,
    up(db) {
      db.run(`CREATE TABLE IF NOT EXISTS warmup_runs (
        id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, status TEXT NOT NULL,
        urls_total INTEGER DEFAULT 0, urls_completed INTEGER DEFAULT 0,
        report TEXT DEFAULT '[]', error TEXT, started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        finished_at DATETIME
      )`)
    },
  },
  {
    to: 12,
    up(db) {
      db.run(`CREATE TABLE IF NOT EXISTS profile_leases (
        profile_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, lease_token TEXT NOT NULL UNIQUE,
        acquired_at DATETIME NOT NULL, expires_at DATETIME NOT NULL,
        metadata TEXT DEFAULT '{}'
      )`)
      db.run('CREATE INDEX IF NOT EXISTS idx_profile_leases_expires ON profile_leases(expires_at)')
    },
  },
  {
    to: 13,
    up(db) {
      const { ensureIdentity } = require('../browser/profileIdentity')
      const result = db.exec('SELECT id, browser_type, environment FROM profiles')
      if (!result.length) return
      for (const [id, browserType, encodedEnvironment] of result[0].values) {
        let environment = { mode: 'default' }
        try {
          const parsed = JSON.parse(encodedEnvironment || '{}')
          if (parsed && typeof parsed === 'object') environment = parsed
        } catch {
          // Corrupt legacy environment data is replaced with a safe default.
        }
        const upgraded = ensureIdentity(id, environment, browserType || 'chromium')
        db.run('UPDATE profiles SET environment = ? WHERE id = ?', [JSON.stringify(upgraded), id])
      }
    },
  },
  {
    to: 14,
    up(db) {
      const { ensureIdentity } = require('../browser/profileIdentity')
      const result = db.exec('SELECT id, browser_type, environment FROM profiles')
      if (!result.length) return
      for (const [id, browserType, encodedEnvironment] of result[0].values) {
        let environment = { mode: 'default' }
        try {
          const parsed = JSON.parse(encodedEnvironment || '{}')
          if (parsed && typeof parsed === 'object') environment = parsed
        } catch {}
        db.run('UPDATE profiles SET environment = ? WHERE id = ?', [
          JSON.stringify(ensureIdentity(id, environment, browserType || 'chromium')), id,
        ])
      }
    },
  },
]

function backupDatabaseFile() {
  const dbPath = getDatabasePath()
  if (!fs.existsSync(dbPath)) return null
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = `${dbPath}.pre-migration-${stamp}.bak`
  fs.copyFileSync(dbPath, backupPath)
  return backupPath
}

function restoreDatabaseFile(backupPath) {
  const dbPath = getDatabasePath()
  if (backupPath && fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, dbPath)
  }
}

/**
 * Run pending migrations in order. A backup is taken first so a failed
 * migration can roll back — the app never opens with a half-migrated database.
 */
async function run(db) {
  const from = getSchemaVersion(db)
  if (from >= SCHEMA_VERSION) {
    return { migrated: false, from, to: from, steps: [] }
  }

  const backup = backupDatabaseFile()
  const steps = []
  let version = from

  try {
    for (const migration of MIGRATIONS) {
      if (migration.to <= version) continue
      // Sequential only: never jump ahead.
      if (migration.to !== version + 1) {
        throw new Error(`Migration gap: expected ${version + 1}, got ${migration.to}`)
      }
      migration.up(db)
      setSchemaVersion(db, migration.to)
      version = migration.to
      steps.push(migration.to)
    }
    if (version !== SCHEMA_VERSION) {
      throw new Error(`Migration ended at ${version}, expected ${SCHEMA_VERSION}`)
    }
    return { migrated: true, from, to: version, steps }
  } catch (err) {
    if (backup) restoreDatabaseFile(backup)
    throw new Error(`Database migration failed (rolled back): ${err.message}`)
  }
}

module.exports = {
  SCHEMA_VERSION,
  MIGRATIONS,
  getSchemaVersion,
  setSchemaVersion,
  tableColumns,
  run,
}
