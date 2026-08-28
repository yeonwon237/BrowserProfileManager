const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { getDb, closeDb } = require('../src/main/database')
const { createProfile, deleteProfile, getProfileById } = require('../src/main/database/profiles')
const {
  getAppDataPath,
  getDatabasePath,
  getBrowserDataPath,
  getLogsPath,
  isInsideProjectDir,
} = require('../src/shared/paths')
const binaryManager = require('../src/main/browser/binaryManager')
const logger = require('../src/main/logger')
const errorDialog = require('../src/main/errorDialog')

const PROJECT_DIR = path.resolve(__dirname, '..')

async function runStep28Tests() {
  console.log('=== STARTING BƯỚC 25: PRODUCTION PACKAGING TESTS ===\n')

  const createdProfileIds = []

  try {
    // 1. Development / production data separation
    console.log('[Test 1] Runtime data lives outside the project directory...')
    assert(isInsideProjectDir(PROJECT_DIR) === false, 'project dir itself is not "inside"')
    assert.strictEqual(isInsideProjectDir(getAppDataPath()), false, 'app data must not be inside the project')
    assert.strictEqual(isInsideProjectDir(getDatabasePath()), false, 'database must not be inside the project')
    assert.strictEqual(isInsideProjectDir(getLogsPath()), false, 'logs must not be inside the project')
    assert(!path.resolve(getAppDataPath()).startsWith(PROJECT_DIR), 'data dir must not be under the source tree')
    console.log(`✓ Data dir: ${getAppDataPath()} (outside project)`)

    // 2. Clean install initializes database in the data directory
    console.log('\n[Test 2] Clean install initializes in the data directory...')
    await getDb()
    assert(fs.existsSync(getDatabasePath()), 'data.db must be created')
    assert(!isInsideProjectDir(getDatabasePath()), 'data.db must never be created inside the project')
    console.log(`✓ Clean install created ${getDatabasePath()}`)

    // 3. App restart preserves profiles (restart simulation)
    console.log('\n[Test 3] App restart preserves profiles and sessions...')
    const profile = await createProfile({ name: 'Persist Me', browser_type: 'chromium' })
    createdProfileIds.push(profile.id)
    const markerFile = path.join(getBrowserDataPath(profile.id), 'Preferences')
    fs.mkdirSync(getBrowserDataPath(profile.id), { recursive: true })
    fs.writeFileSync(markerFile, '{"persist":true}')

    closeDb() // simulate app exit
    const db2 = await getDb() // simulate app restart
    assert(db2, 'database reopens')
    const afterRestart = await getProfileById(profile.id)
    assert(afterRestart && afterRestart.name === 'Persist Me', 'profile must survive restart')
    assert(fs.existsSync(markerFile), 'browser data must survive restart')
    console.log('✓ Profile + browser data survive an app restart')

    // 4. App update does not delete browser data (migration no-op on same version)
    console.log('\n[Test 4] App update preserves browser data...')
    const migration = require('../src/main/database/migration')
    assert.strictEqual(migration.getSchemaVersion(db2), migration.SCHEMA_VERSION)
    const runResult = await migration.run(db2)
    assert.strictEqual(runResult.migrated, false, 'no migration needed at current version')
    assert(fs.existsSync(markerFile), 'browser data untouched by update')
    console.log('✓ Schema update leaves browser data untouched')

    // 5. Uninstall / reinstall keeps browser profiles (uninstall never deletes data silently)
    console.log('\n[Test 5] Uninstall/reinstall preserves browser profiles...')
    const dataDir = getAppDataPath()
    const profileFolder = path.join(dataDir, 'profiles', profile.id, 'browser-data')
    // Simulate uninstall removing the app binary/db but leaving userData.
    closeDb()
    fs.rmSync(getDatabasePath(), { force: true })
    fs.rmSync(path.join(dataDir, 'runtime.json'), { force: true })
    // Reinstall = fresh database in the same userData directory.
    await getDb()
    assert(fs.existsSync(profileFolder), 'browser data folder must survive reinstall — uninstall never deletes profiles silently')
    console.log('✓ Uninstall/reinstall keeps the browser data folder intact (data is never silently deleted)')

    // 6. Browser binaries resolved outside the project (no hard-coded node_modules path)
    console.log('\n[Test 6] Browser binaries resolve to OS locations, not project node_modules...')
    await binaryManager.scanBrowsers({ probeVersions: false })
    const resolved = await binaryManager.resolveForProfile({ browser_type: 'chromium', browser_channel: null })
    assert(resolved && resolved.executable_path, 'chromium must resolve')
    assert(!isInsideProjectDir(resolved.executable_path), 'browser binary must not resolve inside the project')
    assert(!resolved.executable_path.includes('node_modules'), 'no hard-coded dev node_modules path')
    console.log(`✓ Chromium resolves to ${resolved.executable_path} (outside project)`)

    // 7. Production logging writes to the logs folder
    console.log('\n[Test 7] Logging writes to the logs folder (no stdout-only debug)...')
    logger.write('info', 'packaging-test-marker-12345')
    const logFile = path.join(getLogsPath(), 'app.log')
    assert(fs.existsSync(logFile), 'app.log must be written to the logs folder')
    const content = fs.readFileSync(logFile, 'utf8')
    assert(content.includes('packaging-test-marker-12345'), 'log marker must be persisted')
    assert(!isInsideProjectDir(logFile), 'logs must live outside the project')
    console.log(`✓ Logs written to ${logFile}`)

    // 8. Friendly error dialog hides technical stack, logs it separately
    console.log('\n[Test 8] Friendly errors mask technical details and log them separately...')
    const technicalErr = new Error('TypeError: Cannot read properties of undefined at Object.foo (C:\\app\\src\\x.js:12:3)')
    const friendly = errorDialog.friendlyMessage(technicalErr)
    assert(!friendly.includes('x.js'), 'technical stack must be hidden')
    assert(friendly.toLowerCase().includes('logs folder'), 'user should be pointed to the logs folder')
    const errFile = errorDialog.writeTechnicalError('test-context', technicalErr)
    assert(errFile && fs.existsSync(errFile), 'technical error must be written to a file')
    const errContent = fs.readFileSync(errFile, 'utf8')
    assert(errContent.includes('x.js'), 'technical details retained in the separate log')
    console.log('✓ Friendly message shown; technical details stored separately')

    console.log('\n======================================================')
    console.log('🎉 ALL BƯỚC 25 PRODUCTION PACKAGING TESTS PASSED!')
    console.log('======================================================\n')
  } finally {
    closeDb()
    for (const id of createdProfileIds) await deleteProfile(id, { deleteData: false }).catch(() => {})
  }
}

runStep28Tests().catch((err) => {
  console.error('\n❌ BƯỚC 25 TEST FAILED:', err)
  process.exit(1)
})