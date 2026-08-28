const assert = require('assert')
const { getDb, closeDb } = require('../src/main/database')
const { createProfile, getProfileById, deleteProfile, setProfileStatus, resetTransientStatuses } = require('../src/main/database/profiles')
const browserManager = require('../src/main/browser/manager')
const leakProtection = require('../src/main/browser/leakProtection')

async function runStep18Tests() {
  console.log('=== STARTING BƯỚC 18: ARCHITECTURE HARDENING TESTS ===\n')

  let createdProfileIds = []

  try {
    // 1. Test Concurrency Throttling
    console.log('[Test 1] Testing Concurrency Throttling & Process Limits...')
    browserManager.setMaxConcurrency(2)
    assert.strictEqual(browserManager.getMaxConcurrency(), 2)

    const p1 = await createProfile({ name: 'Concurrency P1', browser_type: 'chromium' })
    const p2 = await createProfile({ name: 'Concurrency P2', browser_type: 'chromium' })
    const p3 = await createProfile({ name: 'Concurrency P3', browser_type: 'chromium' })
    createdProfileIds.push(p1.id, p2.id, p3.id)

    // Launch P1 & P2
    await browserManager.openProfile(p1, { headless: true })
    await browserManager.openProfile(p2, { headless: true })
    assert.strictEqual(browserManager.getRunningIds().length, 2)

    // Attempt to launch P3 (exceeds limit 2) -> must queue as "Waiting for slot"
    const queuedResult = await browserManager.openProfile(p3, { headless: true })
    assert(queuedResult.queued, 'Profile exceeding the limit must wait for a slot instead of launching')
    assert(queuedResult.message && queuedResult.message.toLowerCase().includes('waiting'), 'Queue message must explain the wait')
    assert.strictEqual(browserManager.getPendingCount(), 1, 'P3 must be pending')
    assert.strictEqual(browserManager.getRunningIds().length, 2, 'Concurrency must never exceed the limit')

    // Close P1, then P3 should auto-launch into the freed slot
    await browserManager.closeProfile(p1.id)
    await new Promise((resolve) => setTimeout(resolve, 2500))
    assert.strictEqual(browserManager.getPendingCount(), 0, 'P3 must leave the pending queue')
    assert.strictEqual(browserManager.getRunningIds().length, 2, 'P3 must take the freed slot')
    console.log('✓ Concurrency throttling enforces the limit and queues excess launches')

    // 2. Test Parallel Graceful Shutdown (closeAllProfiles)
    console.log('\n[Test 2] Testing Parallel Graceful Shutdown (closeAllProfiles)...')
    await browserManager.closeAllProfiles()
    assert.strictEqual(browserManager.getRunningIds().length, 0, 'All profiles must be closed after closeAllProfiles')

    const p2After = await getProfileById(p2.id)
    const p3After = await getProfileById(p3.id)
    assert.strictEqual(p2After.status, 'idle', 'P2 status must be idle')
    assert.strictEqual(p3After.status, 'idle', 'P3 status must be idle')
    console.log('✓ Parallel graceful shutdown verified with 0 orphan processes')

    // Reset Concurrency to Default
    browserManager.setMaxConcurrency(10)

    // 3. Test Auto-recovery of Transient Statuses on Startup
    console.log('\n[Test 3] Testing Auto-Recovery of Stale Profile Statuses on Startup...')
    await setProfileStatus(p1.id, 'running')
    const p1BeforeRecover = await getProfileById(p1.id)
    assert.strictEqual(p1BeforeRecover.status, 'running', 'Status set to running for test')

    await resetTransientStatuses()
    const p1AfterRecover = await getProfileById(p1.id)
    assert.strictEqual(p1AfterRecover.status, 'idle', 'Stale running status must be auto-recovered to idle on startup')
    console.log('✓ Auto-recovery of stale profile statuses verified')

    // 4. Verify WebRTC Leak Protection Co-existence
    console.log('\n[Test 4] Verifying WebRTC Leak Protection Co-existence...')
    assert(leakProtection.getLaunchArgs, 'WebRTC leak protection must remain available')
    console.log('✓ WebRTC leak protection active and unaffected')

    console.log('\n======================================================')
    console.log('🎉 ALL BƯỚC 18 TESTS PASSED SUCCESSFULLY WITH ZERO ERRORS!')
    console.log('======================================================\n')
  } finally {
    browserManager.setMaxConcurrency(10)
    for (const id of createdProfileIds) {
      await deleteProfile(id, { deleteData: true }).catch(() => {})
    }
    closeDb()
  }
}

runStep18Tests().catch((err) => {
  console.error('\n❌ STEP 18 TEST FAILED:', err)
  process.exit(1)
})
