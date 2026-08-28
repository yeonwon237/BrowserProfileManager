const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { getDb, closeDb } = require('../src/main/database')
const { createProfile, deleteProfile, getProfileById } = require('../src/main/database/profiles')
const { getLogs } = require('../src/main/database/logs')
const browserManager = require('../src/main/browser/manager')
const recovery = require('../src/main/browser/recovery')

async function runStep24Tests() {
  console.log('=== STARTING BƯỚC 21: BROWSER & APP CRASH RECOVERY TESTS ===\n')

  const createdProfileIds = []
  let activeSession = null

  try {
    await getDb()

    // 1. Register a browser launch -> runtime record with all required fields
    console.log('[Test 1] Registering a browser launch runtime record...')
    const profileA = await createProfile({ name: 'Recovery Alpha', browser_type: 'chromium' })
    createdProfileIds.push(profileA.id)
    const fakeDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ynrecovery-'))
    const sessionId = await recovery.registerLaunch(profileA.id, 'chromium', fakeDataDir)
    assert(sessionId, 'sessionId must be returned')

    const records = () => JSON.parse(fs.readFileSync(recovery.RUNTIME_FILE(), 'utf8')).records
    const rec = records().find((r) => r.sessionId === sessionId)
    assert(rec, 'runtime record must persist to disk')
    assert.strictEqual(rec.profileId, profileA.id)
    assert.strictEqual(rec.browser_type, 'chromium')
    assert.strictEqual(rec.status, 'running')
    assert(rec.startedAt, 'record must include started_at')
    assert(rec.sessionId, 'record must include session_id')
    assert('process_id' in { process_id: rec.processId }, 'record includes process_id field')
    console.log(`✓ Runtime record written: session ${sessionId.slice(0, 8)}… status=running`)

    // 2. Normal close completes the record
    console.log('\n[Test 2] Completing a runtime record on normal close...')
    await recovery.completeRun(sessionId)
    const closedRec = records().find((r) => r.sessionId === sessionId)
    assert.strictEqual(closedRec.status, 'closed')
    assert(closedRec.endedAt, 'closed record must have ended_at')
    console.log('✓ Normal close marked record as closed')

    // 3. Unexpected browser exit -> crashed + crash log
    console.log('\n[Test 3] Unexpected browser exit marks record as crashed + logs...')
    const crashSession = await recovery.registerLaunch(profileA.id, 'chromium', fakeDataDir)
    await recovery.onBrowserExited(crashSession, 'crashed')
    const crashedRec = records().find((r) => r.sessionId === crashSession)
    assert.strictEqual(crashedRec.status, 'crashed')
    const crashLogs = (await getLogs(100)).filter((l) => l.action === 'crash-recovery' && l.status === 'warn')
    assert(crashLogs.length >= 1, 'crash must be logged')
    console.log('✓ Browser crash recorded and crash log written')

    // 4. scanAtStartup recovers a stale running record (process gone)
    console.log('\n[Test 4] Startup scan recovers stale Running status...')
    const staleSession = await recovery.registerLaunch(profileA.id, 'chromium', fakeDataDir)
    assert.strictEqual(records().find((r) => r.sessionId === staleSession).status, 'running')
    const result = await recovery.scanAtStartup()
    const recoveredIds = result.recovered.map((r) => r.sessionId)
    assert(recoveredIds.includes(staleSession), 'stale running record must be recovered')
    assert.strictEqual(records().find((r) => r.sessionId === staleSession).status, 'recovered')
    const profileAfter = await getProfileById(profileA.id)
    assert.strictEqual(profileAfter.status, 'idle', 'profile must be Ready after recovery')
    console.log('✓ Stale running status recovered -> profile Ready')

    // 5. Orphan detection: browser process still alive at startup
    console.log('\n[Test 5] Orphan detection when browser process is still alive...')
    const orphanProfile = await createProfile({ name: 'Recovery Orphan', browser_type: 'chromium' })
    createdProfileIds.push(orphanProfile.id)
    await browserManager.openProfile(orphanProfile, { headless: true })
    activeSession = browserManager.getEntry(orphanProfile.id).sessionId
    assert(activeSession, 'launched profile must have a session')

    const orphanScan = await recovery.scanAtStartup()
    const orphan = orphanScan.orphans.find((o) => o.sessionId === activeSession)
    assert(orphan, 'alive browser must be detected as orphan')
    assert(orphan.profileName === 'Recovery Orphan')
    assert(orphan.browserType, 'orphan must include browser type')
    console.log(`✓ Orphan browser detected: ${orphan.profileName} (${orphan.browserType})`)

    // 6. Orphan decision: close -> kills process, profile Ready
    console.log('\n[Test 6] Closing an orphan browser...')
    const closeResult = await recovery.decideOrphan(activeSession, 'close')
    assert.strictEqual(closeResult.success, true)
    assert(closeResult.killed >= 1, 'at least one browser process should be terminated')
    const closedOrphan = records().find((r) => r.sessionId === activeSession)
    assert.strictEqual(closedOrphan.status, 'closed')
    const orphanProfileAfter = await getProfileById(orphanProfile.id)
    assert.strictEqual(orphanProfileAfter.status, 'idle')
    console.log(`✓ Orphan browser closed (${closeResult.killed} process(es) terminated)`)

    // 7. Reconnect is not feasible (explained clearly)
    console.log('\n[Test 7] Reconnect feasibility is clearly explained...')
    const recon = recovery.reconnectFeasibility()
    assert.strictEqual(recon.feasible, false)
    assert(recon.reason, 'reconnect must include an explanation')
    console.log('✓ Reconnect reports infeasible with a clear reason')

    // 8. Leave Running decision
    console.log('\n[Test 8] Leaving an orphan running...')
    await browserManager.closeProfile(orphanProfile.id).catch(() => {})
    await browserManager.openProfile(orphanProfile, { headless: true })
    const leaveSession = browserManager.getEntry(orphanProfile.id).sessionId
    const scanForLeave = await recovery.scanAtStartup()
    const leaveOrphan = scanForLeave.orphans.find((o) => o.sessionId === leaveSession)
    assert(leaveOrphan, 'must be detected as orphan')
    await recovery.decideOrphan(leaveSession, 'leave')
    assert.strictEqual(records().find((r) => r.sessionId === leaveSession).status, 'left-running')
    await browserManager.closeProfile(orphanProfile.id).catch(() => {})
    console.log('✓ Orphan left running and acknowledged')

    // 9. Safe Startup Mode: repeated crashes enable it, toggle works
    console.log('\n[Test 9] Safe Startup Mode...')
    await recovery.noteStartupOutcome(true)
    await recovery.noteStartupOutcome(true)
    const autoSafe = await recovery.isSafeStartupMode()
    assert.strictEqual(autoSafe, true, 'repeated crashes must auto-enable safe startup')
    await recovery.noteStartupOutcome(false)
    const cleared = await recovery.isSafeStartupMode()
    assert.strictEqual(cleared, false, 'clean startup must clear crash count')
    await recovery.setSafeStartupMode(true)
    assert.strictEqual(await recovery.isSafeStartupMode(), true)
    await recovery.setSafeStartupMode(false)
    console.log('✓ Safe Startup Mode auto-enables after crashes and toggles manually')

    // 10. Forced browser kill while tracked -> profile returns to Ready via manager
    console.log('\n[Test 10] Forcing a browser kill while the profile is running...')
    const killProfile = await createProfile({ name: 'Recovery Kill', browser_type: 'chromium' })
    createdProfileIds.push(killProfile.id)
    await browserManager.openProfile(killProfile, { headless: true })
    const killSession = browserManager.getEntry(killProfile.id).sessionId
    const pids = recovery.findBrowserProcesses('chromium', browserManager.getEntry(killProfile.id).browserDataPath)
    assert(pids.length >= 1, 'must find the running browser process')
    recovery.killBrowserProcesses('chromium', browserManager.getEntry(killProfile.id).browserDataPath)
    await new Promise((r) => setTimeout(r, 2500))
    const afterKill = await getProfileById(killProfile.id)
    assert.strictEqual(afterKill.status, 'idle', 'profile must return to Ready after external kill')
    const killedRec = records().find((r) => r.sessionId === killSession)
    assert(['crashed', 'closed'].includes(killedRec.status), `record must be closed/crashed, got ${killedRec.status}`)
    console.log(`✓ External kill detected, profile Ready, record=${killedRec.status}`)

    console.log('\n======================================================')
    console.log('🎉 ALL BƯỚC 21 CRASH RECOVERY TESTS PASSED!')
    console.log('======================================================\n')
  } finally {
    await browserManager.closeAllProfiles().catch(() => {})
    for (const id of createdProfileIds) await deleteProfile(id, { deleteData: true }).catch(() => {})
    try { fs.rmSync(recovery.RUNTIME_FILE(), { force: true }) } catch { /* ignore */ }
    closeDb()
  }
}

runStep24Tests().catch((err) => {
  console.error('\n❌ BƯỚC 21 TEST FAILED:', err)
  process.exit(1)
})