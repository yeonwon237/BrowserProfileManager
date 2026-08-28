const assert = require('assert')
const http = require('http')
const { getDb, closeDb } = require('../src/main/database')
const { createProfile, deleteProfile, getProfileById } = require('../src/main/database/profiles')
const browserManager = require('../src/main/browser/manager')
const resourceManager = require('../src/main/browser/resourceManager')
const automationManager = require('../src/main/automation/manager')
const automationQueue = require('../src/main/automation/queue')

async function runStep25Tests() {
  console.log('=== STARTING BƯỚC 22: RESOURCE MANAGER TESTS ===\n')

  const createdProfileIds = []
  let server = null

  try {
    await getDb()

    // 1. Defaults and status shape
    console.log('[Test 1] Resource status shape & defaults...')
    await resourceManager.setMaxBrowsers(5)
    await resourceManager.setMaxAutomations(3)
    await resourceManager.setLowResourceMode(false)
    const status = await resourceManager.getStatus()
    assert.strictEqual(status.maxBrowsers, 5)
    assert.strictEqual(status.maxAutomations, 3)
    assert.strictEqual(status.activeBrowsers, 0)
    assert.strictEqual(status.activeAutomations, 0)
    assert.strictEqual(status.pendingBrowsers, 0)
    assert(typeof status.memory.percent === 'number' && status.memory.percent >= 0)
    assert(typeof status.memory.rssMB === 'number')
    assert(status.cpu && typeof status.cpu.cores === 'number')
    assert.strictEqual(status.lowResourceMode, false)
    assert.strictEqual(status.effectiveBrowserLimit, 5)
    assert.strictEqual(status.effectiveAutomationLimit, 3)
    console.log('✓ Resource status exposes browser/automation/memory/cpu metrics')

    // 2. Low Resource Mode reduces concurrency
    console.log('\n[Test 2] Low Resource Mode caps concurrency...')
    await resourceManager.setLowResourceMode(true)
    const lowStatus = await resourceManager.getStatus()
    assert.strictEqual(lowStatus.lowResourceMode, true)
    assert.strictEqual(lowStatus.effectiveBrowserLimit, 2, 'low resource mode should cap browsers')
    assert.strictEqual(lowStatus.effectiveAutomationLimit, 1, 'low resource mode should cap automations')
    await resourceManager.setLowResourceMode(false)
    assert.strictEqual((await resourceManager.getStatus()).effectiveBrowserLimit, 5)
    console.log('✓ Low Resource Mode reduces concurrency without touching profile data')

    // 3. Browser slot gating + waiting-for-slot queue
    console.log('\n[Test 3] Waiting for slot behavior...')
    await resourceManager.setMaxBrowsers(1)
    const profileA = await createProfile({ name: 'Res A', browser_type: 'chromium' })
    const profileB = await createProfile({ name: 'Res B', browser_type: 'chromium' })
    const profileC = await createProfile({ name: 'Res C', browser_type: 'chromium' })
    createdProfileIds.push(profileA.id, profileB.id, profileC.id)

    assert.strictEqual(await resourceManager.getBrowserSlotAvailable(), true)
    const openA = await browserManager.openProfile(profileA, { headless: true })
    assert(openA.success !== false, 'profile A should launch')
    assert.strictEqual(await resourceManager.getBrowserSlotAvailable(), false)

    const openB = await browserManager.openProfile(profileB, { headless: true })
    assert.strictEqual(openB.queued, true, 'profile B must wait for a slot')
    assert.strictEqual(openB.message, 'Waiting for slot')
    assert.strictEqual(browserManager.getPendingCount(), 1)
    assert.strictEqual((await getProfileById(profileB.id)).status, 'queued')

    const openC = await browserManager.openProfile(profileC, { headless: true })
    assert.strictEqual(openC.queued, true, 'profile C must wait for a slot')
    assert.strictEqual(browserManager.getPendingCount(), 2)

    const statusMid = await resourceManager.getStatus()
    assert.strictEqual(statusMid.activeBrowsers, 1)
    assert.strictEqual(statusMid.pendingBrowsers, 2)
    console.log('✓ 2 profiles queued while 1 browser active (max 1)')

    // Close A -> B should auto-launch
    await browserManager.closeProfile(profileA.id)
    await new Promise((r) => setTimeout(r, 2500))
    assert(browserManager.isRunning(profileB.id), 'profile B must auto-launch when a slot frees')
    assert.strictEqual(browserManager.getPendingCount(), 1, 'only C remains pending')
    assert.strictEqual((await getProfileById(profileB.id)).status, 'running')
    console.log('✓ Queued profile auto-launched after slot freed')

    // Cancel pending: delete profile C removes it from the queue
    await deleteProfile(profileC.id, { deleteData: true })
    assert.strictEqual(browserManager.getPendingCount(), 0, 'deleting a queued profile must cancel it')
    console.log('✓ Deleting a queued profile cancels its pending launch')

    await browserManager.closeProfile(profileB.id).catch(() => {})
    await resourceManager.setMaxBrowsers(5)

    // 4. Automation queue shares ResourceManager concurrency
    console.log('\n[Test 4] Automation queue respects max automation concurrency...')
    server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><head><title>res-test</title></head><body>ok</body></html>')
    })
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const url = `http://127.0.0.1:${server.address().port}`

    await automationManager.seedSampleTools()
    await automationManager.setEnabled('open-website', true)

    await resourceManager.setMaxAutomations(1)
    const qProfile1 = await createProfile({ name: 'Queue One', browser_type: 'chromium' })
    const qProfile2 = await createProfile({ name: 'Queue Two', browser_type: 'chromium' })
    createdProfileIds.push(qProfile1.id, qProfile2.id)

    automationQueue.clearCompleted()
    await automationQueue.enqueue('open-website', [qProfile1.id, qProfile2.id], { url })
    let maxRunning = 0
    const deadline = Date.now() + 60000
    while (Date.now() < deadline) {
      const counts = automationQueue.getCounts()
      maxRunning = Math.max(maxRunning, counts.running)
      if (counts.running === 0 && counts.waiting === 0) break
      await new Promise((r) => setTimeout(r, 250))
    }
    const finalCounts = automationQueue.getCounts()
    assert.strictEqual(finalCounts.success, 2, `both jobs should succeed: ${JSON.stringify(finalCounts)}`)
    assert(maxRunning <= 1, `automation concurrency must not exceed limit, saw ${maxRunning}`)
    console.log(`✓ Queue ran both jobs with max concurrency 1 (peak running=${maxRunning})`)

    // 5. Memory warning logic
    console.log('\n[Test 5] Memory warning threshold logic...')
    await resourceManager.setMemoryThresholdPercent(100)
    const lowWarn = await resourceManager.getMemoryStatus()
    assert.strictEqual(lowWarn.warning, false, '100% threshold should not warn')
    let emitted = null
    resourceManager.setListener((event) => { emitted = event })
    await resourceManager.setMemoryThresholdPercent(10)
    const highWarn = await resourceManager.getMemoryStatus()
    assert.strictEqual(highWarn.warning, true, '10% threshold should warn on a running machine')
    const warned = await resourceManager.maybeNotifyMemoryWarning()
    assert.strictEqual(warned, true)
    assert(emitted && emitted.type === 'memory-warning', 'listener must receive memory-warning event')
    resourceManager.setListener(null)
    await resourceManager.setMemoryThresholdPercent(85)
    console.log('✓ Memory warning fires when usage crosses threshold')

    console.log('\n======================================================')
    console.log('🎉 ALL BƯỚC 22 RESOURCE MANAGER TESTS PASSED!')
    console.log('======================================================\n')
  } finally {
    automationQueue.stopAll().catch(() => {})
    await browserManager.closeAllProfiles().catch(() => {})
    for (const id of createdProfileIds) await deleteProfile(id, { deleteData: true }).catch(() => {})
    if (server) await new Promise((resolve) => server.close(resolve)).catch(() => {})
    closeDb()
  }
}

runStep25Tests().catch((err) => {
  console.error('\n❌ BƯỚC 22 TEST FAILED:', err)
  process.exit(1)
})