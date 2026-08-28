const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { closeDb } = require('../src/main/database')
const { getDatabasePath } = require('../src/shared/paths')
const migration = require('../src/main/database/migration')
const versions = require('../src/main/versions')
const { checkManifestCompatibility } = require('../src/main/versions')
const { validateManifest } = require('../src/main/automation/manifest')
const { IDENTITY_VERSION } = require('../src/main/browser/profileIdentity')

async function runStep27Tests() {
  console.log('=== STARTING BƯỚC 24: APP UPDATE & DATABASE MIGRATION TESTS ===\n')

  const dbPath = getDatabasePath()
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  try {
    // 1. Build a legacy (v1) database with a real profile but no schema_version.
    console.log('[Test 1] Creating a legacy v1 database with profile data...')
    const initSqlJs = require('sql.js')
    const SQL = await initSqlJs()
    const legacy = new SQL.Database()
    legacy.run(
      `CREATE TABLE profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'idle',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    )
    legacy.run(
      `CREATE TABLE proxies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL
      )`
    )
    legacy.run(`INSERT INTO profiles (id, name, status) VALUES ('legacy-1', 'Legacy Profile', 'idle')`)
    const legacyBuffer = Buffer.from(legacy.export())
    legacy.close()
    fs.writeFileSync(dbPath, legacyBuffer)
    console.log('✓ Legacy database written (no meta table, no schema_version)')

    // 2. Failed migration must roll back and restore the original file.
    console.log('\n[Test 2] Failed migration rolls back and restores the database...')
    const SQL2 = await initSqlJs()
    // Use a copy so sql.js never mutates the reference we compare against.
    const failingDb = new SQL.Database(Uint8Array.from(legacyBuffer))
    const injectedIndex = migration.MIGRATIONS.length
    migration.MIGRATIONS.push({
      to: migration.SCHEMA_VERSION + 1,
      up() {
        throw new Error('simulated migration failure')
      },
    })
    let rolledBack = false
    try {
      await migration.run(failingDb)
    } catch (err) {
      rolledBack = /rolled back/.test(err.message)
      assert(rolledBack, `must report rollback: ${err.message}`)
    } finally {
      migration.MIGRATIONS.splice(injectedIndex, 1)
    }
    assert.strictEqual(rolledBack, true, 'migration failure must roll back')
    const restored = fs.readFileSync(dbPath)
    assert.deepStrictEqual(Buffer.from(restored), legacyBuffer, 'database file must be restored to pre-migration state')
    console.log('✓ Failed migration rolled back; database file restored intact')

    // 3. Open the legacy DB with the current app -> sequential migration.
    console.log('\n[Test 3] Legacy database migrates sequentially and preserves profiles...')
    const { getDb } = require('../src/main/database')
    const db = await getDb()
    const schemaVersion = migration.getSchemaVersion(db)
    assert.strictEqual(schemaVersion, migration.SCHEMA_VERSION, `schema must reach v${migration.SCHEMA_VERSION}`)

    const profileRow = db.exec("SELECT id, name, environment FROM profiles WHERE id = 'legacy-1'")
    assert(profileRow.length > 0 && profileRow[0].values.length > 0, 'legacy profile must be preserved')
    assert.strictEqual(profileRow[0].values[0][1], 'Legacy Profile')
    const migratedEnvironment = JSON.parse(profileRow[0].values[0][2])
    assert.strictEqual(migratedEnvironment.identity.version, IDENTITY_VERSION, 'legacy profile must receive the current versioned identity')
    assert(/^[a-f0-9]{24}$/.test(migratedEnvironment.identity.profileKey), 'legacy identity key must be valid')

    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('browser_binaries', 'environment_presets', 'meta')")
    const tableNames = tables.length > 0 ? tables[0].values.map((r) => r[0]) : []
    assert(tableNames.includes('browser_binaries'), 'browser_binaries table must exist after migration')
    assert(tableNames.includes('meta'), 'meta table must exist after migration')
    console.log(`✓ Legacy DB migrated v1 -> v${migration.SCHEMA_VERSION}, profile intact, new tables present`)

    // 4. Version endpoint returns app / database / automation API versions.
    console.log('\n[Test 4] Version reporting...')
    const info = versions.getVersions(migration.getSchemaVersion(db))
    assert(info.app, 'app version required')
    assert.strictEqual(info.database, migration.SCHEMA_VERSION)
    assert.strictEqual(info.automationApi, 1)
    console.log(`✓ App v${info.app} | Database v${info.database} | Automation API v${info.automationApi}`)

    // 5. Automation manifest compatibility (no crash on incompatible).
    console.log('\n[Test 5] Automation manifest compatibility...')
    const compatible = checkManifestCompatibility({ automation_api_version: 1, minimum_app_version: '0.0.1' })
    assert.strictEqual(compatible.compatible, true)
    const wrongApi = checkManifestCompatibility({ automation_api_version: 99 })
    assert.strictEqual(wrongApi.compatible, false)
    assert(wrongApi.reason.includes('Automation API'), 'reason must explain the API mismatch')
    const tooNew = checkManifestCompatibility({ minimum_app_version: '999.0.0' })
    assert.strictEqual(tooNew.compatible, false)
    const tooOld = checkManifestCompatibility({ maximum_app_version: '0.0.1' })
    assert.strictEqual(tooOld.compatible, false)

    const validManifest = validateManifest(path.join(process.cwd(), 'src/main/automation/sampleTools/open-website'), {
      id: 'compat-check',
      name: 'C',
      version: '1.0.0',
      description: 'd',
      entry: 'main.js',
      runModes: ['browser'],
      automation_api_version: 1,
      minimum_app_version: '1.0.0',
      maximum_app_version: '2.0.0',
    })
    assert.strictEqual(validManifest.valid, true, 'valid compatibility fields must pass')
    const badManifest = validateManifest(path.join(process.cwd(), 'src/main/automation/sampleTools/open-website'), {
      id: 'compat-bad',
      name: 'C',
      version: '1.0.0',
      description: 'd',
      entry: 'main.js',
      runModes: ['browser'],
      automation_api_version: 'one',
    })
    assert.strictEqual(badManifest.valid, false, 'invalid automation_api_version must be rejected')
    console.log('✓ Incompatible automations are flagged, never crash the app')

    console.log('\n======================================================')
    console.log('🎉 ALL BƯỚC 24 DATABASE MIGRATION TESTS PASSED!')
    console.log('======================================================\n')
  } finally {
    closeDb()
  }
}

runStep27Tests().catch((err) => {
  console.error('\n❌ BƯỚC 24 TEST FAILED:', err)
  process.exit(1)
})
