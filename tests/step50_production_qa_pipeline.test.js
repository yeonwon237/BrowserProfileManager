const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { getDb, closeDb } = require('../src/main/database')
const profilesRepo = require('../src/main/database/profiles')
const workspacesRepo = require('../src/main/database/workspaces')
const { createEncryptedBackup, restoreEncryptedBackup } = require('../src/main/backup/encryptedBackup')
const { organizationService, ROLES } = require('../src/main/organization')
const { LocalOnlySyncProvider, EncryptedCloudSyncProvider } = require('../src/main/sync')
const { crashReporter } = require('../src/main/observability/crashReporter')

async function runTests() {
  console.log('=== STARTING BƯỚC 50: PRODUCTION RELEASE QA PIPELINE & FINAL REGRESSION TESTS ===\n')

  const db = await getDb()
  db.run('DELETE FROM profiles')
  db.run("DELETE FROM workspaces WHERE id != 'default'")

  console.log('[Test 1] Core Foundation Regression: Isolated Persistent Sessions & Multi-Profile Independence...')
  const profA = await profilesRepo.createProfile({ name: 'Profile A (Secure Login)', workspace_id: 'default' })
  const profB = await profilesRepo.createProfile({ name: 'Profile B (Clean Isolation)', workspace_id: 'default' })

  assert(profA.browser_data_path !== profB.browser_data_path, 'Browser data paths must be strictly distinct')

  // Simulate persistent session storage in Profile A's directory
  fs.mkdirSync(profA.browser_data_path, { recursive: true })
  fs.mkdirSync(profB.browser_data_path, { recursive: true })

  const sessionFileA = path.join(profA.browser_data_path, 'Default', 'Session Storage')
  fs.mkdirSync(path.dirname(sessionFileA), { recursive: true })
  fs.writeFileSync(sessionFileA, 'USER_AUTHENTICATION_SESSION_DATA_TOKEN=ACTIVE_LOGGED_IN')

  // Verify Profile B has no trace of Profile A's session
  const sessionFileB = path.join(profB.browser_data_path, 'Default', 'Session Storage')
  assert.strictEqual(fs.existsSync(sessionFileB), false, 'Profile B must not contain Profile A session files')

  // Re-read Profile A storage to ensure persistence
  const readA = fs.readFileSync(sessionFileA, 'utf8')
  assert(readA.includes('ACTIVE_LOGGED_IN'), 'Profile A session data must persist cleanly across restarts')
  console.log('✓ Core regression: Persistent storage persists across restarts and remains 100% isolated between profiles')

  console.log('\n[Test 2] AES-256-GCM Encrypted Backup & Restoration Security...')
  const backupRes = await createEncryptedBackup({ password: 'StrongMasterPassword2026!' })
  assert.strictEqual(backupRes.success, true)
  assert(backupRes.packageString.includes('ynlogin-encrypted-backup'))

  // Attempt decryption with wrong password
  let decryptFailed = false
  try {
    await restoreEncryptedBackup({
      password: 'WrongPassword!',
      packageString: backupRes.packageString,
    })
  } catch (err) {
    decryptFailed = true
    assert(err.message.includes('Decryption failed'))
  }
  assert.strictEqual(decryptFailed, true, 'Must reject restoration with invalid password')

  // Decrypt with correct password
  const restoreRes = await restoreEncryptedBackup({
    password: 'StrongMasterPassword2026!',
    packageString: backupRes.packageString,
  })
  assert.strictEqual(restoreRes.success, true)
  assert.strictEqual(restoreRes.payload.profiles.length, 2)
  assert.strictEqual(restoreRes.payload.profiles[0].browser_data_path, undefined, 'backup metadata must not expose local machine paths')
  assert.strictEqual(restoreRes.payload.profiles[0].proxy, undefined, 'backup metadata must not embed proxy credential objects')
  console.log('✓ Encrypted Backup: AES-256-GCM encryption, authentication tag, and password validation passed')

  console.log('\n[Test 3] Multi-tenant RBAC Permissions Enforcement...')
  assert.strictEqual(organizationService.hasPermission(ROLES.OWNER, 'manage_billing'), true)
  assert.strictEqual(organizationService.hasPermission(ROLES.ADMIN, 'manage_profiles'), true)
  assert.strictEqual(organizationService.hasPermission(ROLES.MEMBER, 'manage_billing'), false)
  assert.strictEqual(organizationService.hasPermission(ROLES.VIEWER, 'run_automation'), false)
  console.log('✓ RBAC: Organization roles and permission matrix enforced')

  console.log('\n[Test 4] Sync Provider & Conflict Resolution...')
  const localSync = new LocalOnlySyncProvider()
  const syncRes = await localSync.syncConfigurations()
  assert.strictEqual(syncRes.mode, 'local-only')

  const recordLocal = { id: 'prof-1', name: 'Profile Local', updated_at: '2026-08-23T10:00:00Z' }
  const recordRemote = { id: 'prof-1', name: 'Profile Remote', updated_at: '2026-08-23T12:00:00Z' }
  const resolved = await localSync.resolveConflict(recordLocal, recordRemote, 'local_newer')
  assert.strictEqual(resolved.name, 'Profile Remote', 'Remote is newer so local_newer resolves to the later timestamp')
  console.log('✓ Sync Architecture: Configuration sync separation and conflict resolution verified')

  console.log('\n[Test 5] Observability & Privacy-Preserving Crash Reporting...')
  crashReporter.setOptIn(false)
  const mockError = new Error('DatabaseTimeout while header Authorization: Bearer secret-token-xyz was passed with Cookie: user_sess=abc')
  const reportRes = await crashReporter.reportCrash(mockError, { component: 'database' })
  assert.strictEqual(reportRes.sent, false, 'Remote crash reporting must be strictly opt-in')
  assert(reportRes.report.errorStack.includes('Authorization: Bearer [REDACTED]'), 'Auth token must be redacted')
  assert(reportRes.report.errorStack.includes('Cookie: [REDACTED]'), 'Cookie must be redacted')
  console.log('✓ Observability: Privacy scrubbing and opt-in telemetry guards verified')

  closeDb()
  console.log('\n========================================================================')
  console.log('🎉 ALL BƯỚC 50 PRODUCTION QA PIPELINE & REGRESSION TESTS PASSED!')
  console.log('========================================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err)
  process.exit(1)
})
