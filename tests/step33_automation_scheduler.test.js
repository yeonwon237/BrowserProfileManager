const assert = require('assert')
const { getDb, closeDb } = require('../src/main/database')
const scheduler = require('../src/main/automation/scheduler')
const profilesRepo = require('../src/main/database/profiles')
const automationManager = require('../src/main/automation/manager')
const automationQueue = require('../src/main/automation/queue')

async function runTests() {
  console.log('=== STARTING BƯỚC 29: AUTOMATION SCHEDULER TESTS ===\n')

  const db = await getDb()
  db.run('DELETE FROM profiles')
  db.run('DELETE FROM scheduled_jobs')
  db.run('DELETE FROM runs')

  await automationManager.seedSampleTools()
  const tools = await automationManager.scanAutomations()
  const sampleTool = tools[0]
  assert(sampleTool, 'Sample tool must exist')

  console.log('[Test 1] Scheduled job CRUD & schedule calculation...')
  const jobDaily = await scheduler.createScheduledJob({
    id: 'job-daily-1',
    name: 'Morning Social Warmup',
    workspace_id: 'default',
    automation_id: sampleTool.id,
    profile_selection_type: 'single',
    profile_selection_value: 'profile-x',
    schedule_type: 'daily',
    schedule_value: '08:30',
    enabled: true,
  })

  assert(jobDaily, 'Job must be created')
  assert.strictEqual(jobDaily.name, 'Morning Social Warmup')
  assert.strictEqual(jobDaily.schedule_type, 'daily')
  assert(jobDaily.next_run_at, 'next_run_at must be computed')

  // Interval job
  const jobInterval = await scheduler.createScheduledJob({
    id: 'job-interval-1',
    name: 'Hourly Health Check',
    workspace_id: 'default',
    automation_id: sampleTool.id,
    profile_selection_type: 'single',
    profile_selection_value: 'profile-x',
    schedule_type: 'interval',
    schedule_value: '60',
    enabled: true,
  })
  assert.strictEqual(jobInterval.schedule_type, 'interval')

  // Run-once job
  const pastDate = new Date(Date.now() - 1000).toISOString()
  const jobOnce = await scheduler.createScheduledJob({
    id: 'job-once-1',
    name: 'One-Time Task',
    workspace_id: 'default',
    automation_id: sampleTool.id,
    profile_selection_type: 'single',
    profile_selection_value: 'profile-x',
    schedule_type: 'once',
    schedule_value: pastDate,
    enabled: true,
  })

  // Duplicate
  const dupJob = await scheduler.duplicateScheduledJob(jobDaily.id, { name: 'Morning Warmup (Copy)' })
  assert(dupJob.id !== jobDaily.id)
  assert.strictEqual(dupJob.name, 'Morning Warmup (Copy)')

  // Toggle
  const toggledOff = await scheduler.toggleScheduledJob(jobDaily.id, false)
  assert.strictEqual(toggledOff.enabled, false)
  assert.strictEqual(toggledOff.next_run_at, null)

  const toggledOn = await scheduler.toggleScheduledJob(jobDaily.id, true)
  assert.strictEqual(toggledOn.enabled, true)
  assert(toggledOn.next_run_at !== null)
  console.log('✓ Scheduled job CRUD, duplication, toggling, and next_run_at working correctly')

  console.log('\n[Test 2] Dynamic Profile Resolution at run time...')
  // Create 3 profiles in group "Marketing"
  const p1 = await profilesRepo.createProfile({ name: 'Profile M1', group: 'Marketing' })
  const p2 = await profilesRepo.createProfile({ name: 'Profile M2', group: 'Marketing' })
  const p3 = await profilesRepo.createProfile({ name: 'Profile M3', group: 'Marketing' })
  const pOther = await profilesRepo.createProfile({ name: 'Profile O1', group: 'Dev' })

  const groupJob = await scheduler.createScheduledJob({
    name: 'Marketing Batch Auto',
    automation_id: sampleTool.id,
    profile_selection_type: 'group',
    profile_selection_value: 'Marketing',
    schedule_type: 'interval',
    schedule_value: '30',
  })

  let resolved = await scheduler.resolveProfileIds(groupJob)
  assert.strictEqual(resolved.length, 3, `Expected 3 profiles in group Marketing, got ${resolved.length}`)

  // Dynamically add a 4th profile to group "Marketing"
  const p4 = await profilesRepo.createProfile({ name: 'Profile M4', group: 'Marketing' })
  resolved = await scheduler.resolveProfileIds(groupJob)
  assert.strictEqual(resolved.length, 4, `Expected 4 profiles dynamically resolved, got ${resolved.length}`)
  console.log('✓ Dynamic runtime resolution: group queries database dynamically when job executes')

  console.log('\n[Test 3] Queue Integration (Strict rule: Enqueues through Automation Queue)...')
  let queueEnqueued = false
  const originalEnqueue = automationQueue.enqueue
  automationQueue.enqueue = async (toolId, profileIds, inputs) => {
    queueEnqueued = true
    return { success: true, queued: profileIds.length }
  }

  try {
    const execResult = await scheduler.executeScheduledJob(groupJob.id)
    assert.strictEqual(execResult.success, true)
    assert.strictEqual(execResult.profileCount, 4)
    assert.strictEqual(queueEnqueued, true, 'Scheduler MUST enqueue to automationQueue')

    const updatedJob = await scheduler.getScheduledJobById(groupJob.id)
    assert(updatedJob.last_run_at, 'Job must record last_run_at')
  } finally {
    automationQueue.enqueue = originalEnqueue
  }
  console.log('✓ Strict queue enforcement: Scheduler routes all dispatches through Automation Queue')

  console.log('\n[Test 4] Run-Once Job Auto-Disables after execution...')
  const targetProfile = await profilesRepo.createProfile({ name: 'Single Profile' })
  const onceJob = await scheduler.createScheduledJob({
    name: 'Run-Once Test',
    automation_id: sampleTool.id,
    profile_selection_type: 'single',
    profile_selection_value: targetProfile.id,
    schedule_type: 'once',
    schedule_value: new Date(Date.now() - 5000).toISOString(),
    enabled: true,
  })

  automationQueue.enqueue = async (toolId, profileIds, inputs) => ({ success: true, queued: 1 })
  try {
    await scheduler.executeScheduledJob(onceJob.id)
    const refreshedOnce = await scheduler.getScheduledJobById(onceJob.id)
    assert.strictEqual(refreshedOnce.enabled, false, 'Run-once job must auto-disable')
    assert.strictEqual(refreshedOnce.next_run_at, null)
  } finally {
    automationQueue.enqueue = originalEnqueue
  }
  console.log('✓ Run-once job successfully executes and auto-disables')

  console.log('\n[Test 5] Scheduler tick trigger verification...')
  let tickExecuted = false
  automationQueue.enqueue = async () => {
    tickExecuted = true
    return { success: true, queued: 1 }
  }

  // Create a due job (past next_run_at)
  await scheduler.createScheduledJob({
    id: 'due-job',
    name: 'Due Job',
    automation_id: sampleTool.id,
    profile_selection_type: 'single',
    profile_selection_value: targetProfile.id,
    schedule_type: 'interval',
    schedule_value: '10',
    enabled: true,
  })

  db.run(`UPDATE scheduled_jobs SET next_run_at = datetime('now', '-5 minutes') WHERE id = 'due-job'`)

  try {
    await scheduler.tick()
    assert.strictEqual(tickExecuted, true, 'Scheduler tick must trigger due jobs')
  } finally {
    automationQueue.enqueue = originalEnqueue
  }
  console.log('✓ Scheduler tick loop accurately discovers and executes due scheduled jobs')

  closeDb()
  console.log('\n======================================================')
  console.log('🎉 ALL BƯỚC 29 AUTOMATION SCHEDULER TESTS PASSED!')
  console.log('======================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err)
  process.exit(1)
})
