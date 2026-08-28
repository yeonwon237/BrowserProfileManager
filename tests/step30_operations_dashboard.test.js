const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { getDb, closeDb } = require('../src/main/database')
const profilesRepo = require('../src/main/database/profiles')
const runsRepo = require('../src/main/database/runs')
const { addLog } = require('../src/main/database/logs')
const dashboardManager = require('../src/main/dashboard/manager')
const automationQueue = require('../src/main/automation/queue')

async function runTests() {
  console.log('=== STARTING BƯỚC 26: OPERATIONS DASHBOARD TESTS ===\n')

  const db = await getDb()
  db.run('DELETE FROM profiles')
  db.run('DELETE FROM runs')
  db.run('DELETE FROM logs')

  console.log('[Test 1] Simulating 100 profiles with varied statuses...')
  const startTime = Date.now()

  for (let i = 1; i <= 100; i++) {
    let status = 'idle'
    if (i <= 5) status = 'error'
    else if (i <= 10) status = 'warning'
    else if (i <= 15) status = 'running'

    await profilesRepo.createProfile({
      name: `Scale Profile ${String(i).padStart(3, '0')}`,
      browser_type: 'chromium',
      status,
    })
  }

  // Update status directly to match our simulated distribution
  db.run(`UPDATE profiles SET status = 'error' WHERE name IN ('Scale Profile 001', 'Scale Profile 002', 'Scale Profile 003', 'Scale Profile 004', 'Scale Profile 005')`)
  db.run(`UPDATE profiles SET status = 'warning' WHERE name IN ('Scale Profile 006', 'Scale Profile 007', 'Scale Profile 008', 'Scale Profile 009', 'Scale Profile 010')`)

  const loadDuration = Date.now() - startTime
  console.log(`✓ 100 profiles created in ${loadDuration}ms`)

  console.log('\n[Test 2] Fast dashboard metrics aggregation...')
  const metricStart = Date.now()
  const metrics = await dashboardManager.getMetrics()
  const metricDuration = Date.now() - metricStart

  assert.strictEqual(metrics.totalProfiles, 100, `Expected 100 profiles, got ${metrics.totalProfiles}`)
  assert.strictEqual(metrics.errorProfiles, 5, `Expected 5 error profiles, got ${metrics.errorProfiles}`)
  assert.strictEqual(metrics.warningProfiles, 5, `Expected 5 warning profiles, got ${metrics.warningProfiles}`)
  assert.strictEqual(metrics.readyProfiles, 90, `Expected 90 ready profiles, got ${metrics.readyProfiles}`)
  assert(metricDuration < 100, `Expected sub-100ms aggregation, got ${metricDuration}ms`)
  console.log(`✓ Metrics aggregated in ${metricDuration}ms: Total=${metrics.totalProfiles}, Ready=${metrics.readyProfiles}, Warning=${metrics.warningProfiles}, Error=${metrics.errorProfiles}`)

  console.log('\n[Test 3] Automation & today runs counting...')
  const run1 = await runsRepo.createRun({
    tool: { id: 'test-tool', name: 'Test Scanner' },
    profile: { id: 'p-1', name: 'Scale Profile 001' },
  })
  await runsRepo.finishRun(run1.id, { status: 'success' })

  const run2 = await runsRepo.createRun({
    tool: { id: 'test-tool-2', name: 'Form Submitter' },
    profile: { id: 'p-2', name: 'Scale Profile 002' },
  })
  await runsRepo.finishRun(run2.id, { status: 'failed', error: 'Element not found' })

  const metricsWithRuns = await dashboardManager.getMetrics()
  assert.strictEqual(metricsWithRuns.successfulJobsToday, 1, 'Expected 1 successful run today')
  assert.strictEqual(metricsWithRuns.failedJobsToday, 1, 'Expected 1 failed run today')
  console.log(`✓ Runs counted: successToday=${metricsWithRuns.successfulJobsToday}, failedToday=${metricsWithRuns.failedJobsToday}`)

  console.log('\n[Test 4] Recent activity aggregation...')
  await addLog({
    profile_id: 'p-1',
    action: 'profile:open',
    status: 'info',
    message: 'Profile "Scale Profile 001" opened',
  })
  await addLog({
    profile_id: 'p-2',
    action: 'browser:crash',
    status: 'error',
    message: 'Browser process crashed',
  })
  await addLog({
    profile_id: 'p-3',
    action: 'privacy-guard',
    status: 'warn',
    message: 'Proxy IP mismatch detected',
  })

  const activities = await dashboardManager.getRecentActivity(10)
  assert(activities.length >= 4, `Expected at least 4 activities, got ${activities.length}`)
  const types = activities.map((a) => a.type)
  assert(types.includes('profile_open'), 'Activities should include profile_open')
  assert(types.includes('browser_crash'), 'Activities should include browser_crash')
  assert(types.includes('proxy_warning'), 'Activities should include proxy_warning')
  assert(types.includes('automation_success') || types.includes('automation_fail'), 'Activities should include automation run')
  console.log(`✓ Recent activities aggregated and formatted properly (${activities.length} entries)`)

  console.log('\n[Test 5] Resource Overview integration...')
  assert(metrics.resourceStatus !== undefined, 'resourceStatus should be exposed')
  assert(typeof metrics.resourceStatus.browsers.max === 'number', 'browsers max limit should be numeric')
  assert(typeof metrics.resourceStatus.automations.max === 'number', 'automations max limit should be numeric')
  console.log(`✓ Resource overview shape valid (Max browsers: ${metrics.resourceStatus.browsers.max}, Max automations: ${metrics.resourceStatus.automations.max})`)

  closeDb()
  console.log('\n======================================================')
  console.log('🎉 ALL BƯỚC 26 OPERATIONS DASHBOARD TESTS PASSED!')
  console.log('======================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err)
  process.exit(1)
})
