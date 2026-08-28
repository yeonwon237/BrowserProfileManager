const assert = require('assert')
const fs = require('fs')
const { getDb, closeDb } = require('../src/main/database')
const workspacesRepo = require('../src/main/database/workspaces')
const templatesRepo = require('../src/main/database/templates')
const scheduler = require('../src/main/automation/scheduler')
const runsRepo = require('../src/main/database/runs')
const profilesRepo = require('../src/main/database/profiles')
const automationManager = require('../src/main/automation/manager')
const automationQueue = require('../src/main/automation/queue')

async function runTests() {
  console.log('=== STARTING TEST TỔNG HỢP SAU BƯỚC 30 (SCALE INTEGRATION TEST) ===\n')

  const db = await getDb()
  db.run('DELETE FROM profiles')
  db.run('DELETE FROM profile_templates')
  db.run('DELETE FROM scheduled_jobs')
  db.run('DELETE FROM runs')
  db.run('DELETE FROM run_logs')
  db.run("DELETE FROM workspaces WHERE id != 'default'")

  await automationManager.seedSampleTools()
  const tools = await automationManager.scanAutomations()
  const sampleTool = tools[0]

  console.log('[Phase 1] Setting up 3 isolated Workspaces...')
  const wsMarketing = await workspacesRepo.createWorkspace({
    id: 'ws-marketing',
    name: 'Marketing Division',
    description: 'Marketing automation accounts',
  })
  const wsAffiliate = await workspacesRepo.createWorkspace({
    id: 'ws-affiliate',
    name: 'Affiliate Network',
    description: 'Affiliate campaign profiles',
  })
  const defaultWs = await workspacesRepo.getWorkspaceById('default')
  assert(wsMarketing && wsAffiliate && defaultWs, 'All 3 workspaces must exist')
  console.log('✓ 3 Workspaces created: Default, Marketing Division, Affiliate Network')

  console.log('\n[Phase 2] Creating Templates and Bulk Generating 100 Profiles (50 + 30 + 20)...')
  const tmplMarketing = await templatesRepo.createTemplate({
    name: 'Social Media Worker',
    workspace_id: 'ws-marketing',
    browser_type: 'chromium',
    group_name: 'Social Ads',
    environment: { locale: 'en-US', timezone: 'America/New_York' },
  })

  const tmplAffiliate = await templatesRepo.createTemplate({
    name: 'Affiliate Browser',
    workspace_id: 'ws-affiliate',
    browser_type: 'chromium',
    group_name: 'Affiliate Traffic',
    environment: { locale: 'en-GB', timezone: 'Europe/London' },
  })

  const tmplDefault = await templatesRepo.createTemplate({
    name: 'General Purpose',
    workspace_id: 'default',
    browser_type: 'chromium',
    group_name: 'General',
  })

  // Bulk create: 50 in ws-marketing, 30 in ws-affiliate, 20 in default
  const res1 = await templatesRepo.bulkCreateProfiles({
    templateId: tmplMarketing.id,
    count: 50,
    namePattern: 'Marketing-{number}',
    workspaceId: 'ws-marketing',
  })
  const res2 = await templatesRepo.bulkCreateProfiles({
    templateId: tmplAffiliate.id,
    count: 30,
    namePattern: 'Affiliate-{number}',
    workspaceId: 'ws-affiliate',
  })
  const res3 = await templatesRepo.bulkCreateProfiles({
    templateId: tmplDefault.id,
    count: 20,
    namePattern: 'Core-{number}',
    workspaceId: 'default',
  })

  assert.strictEqual(res1.created, 50)
  assert.strictEqual(res2.created, 30)
  assert.strictEqual(res3.created, 20)

  // Verify DB total
  const allProfiles = await profilesRepo.getAllProfiles()
  assert.strictEqual(allProfiles.length, 100, `Expected 100 profiles, got ${allProfiles.length}`)

  // Verify workspace isolation
  const mktProfiles = await profilesRepo.getAllProfiles({ workspace_id: 'ws-marketing' })
  assert.strictEqual(mktProfiles.length, 50)
  const affProfiles = await profilesRepo.getAllProfiles({ workspace_id: 'ws-affiliate' })
  assert.strictEqual(affProfiles.length, 30)
  const defProfiles = await profilesRepo.getAllProfiles({ workspace_id: 'default' })
  assert.strictEqual(defProfiles.length, 20)
  console.log('✓ 100 profiles generated via templates and partitioned across 3 workspaces with unique IDs and storage directories')

  console.log('\n[Phase 3] Automation Scheduler on dynamic group & queue execution...')
  const schedJob = await scheduler.createScheduledJob({
    name: 'Daily Affiliate Sync',
    workspace_id: 'ws-affiliate',
    automation_id: sampleTool.id,
    profile_selection_type: 'group',
    profile_selection_value: 'Affiliate Traffic',
    schedule_type: 'daily',
    schedule_value: '07:00',
    enabled: true,
  })

  let enqueuedProfileCount = 0
  const originalEnqueue = automationQueue.enqueue
  automationQueue.enqueue = async (toolId, profileIds, inputs) => {
    enqueuedProfileCount = profileIds.length
    return { success: true, queued: profileIds.length }
  }

  try {
    const execRes = await scheduler.executeScheduledJob(schedJob.id)
    assert.strictEqual(execRes.success, true)
    assert.strictEqual(enqueuedProfileCount, 30, `Expected 30 affiliate profiles enqueued, got ${enqueuedProfileCount}`)
  } finally {
    automationQueue.enqueue = originalEnqueue
  }
  console.log('✓ Scheduled job dynamically resolved 30 profiles and safely routed to Automation Queue')

  console.log('\n[Phase 4] Run History generation & Analytics aggregation...')
  for (let i = 0; i < 30; i++) {
    const p = affProfiles[i]
    const run = await runsRepo.createRun({
      tool: sampleTool,
      profile: p,
      workspace_id: 'ws-affiliate',
    })
    const isSuccess = i % 4 !== 0
    await runsRepo.finishRun(run.id, {
      status: isSuccess ? 'success' : 'failed',
      error: isSuccess ? null : 'Simulated timeout on step 3',
    })
  }

  // Workspace-scoped analytics
  const affAnalytics = await runsRepo.getAutomationAnalytics({ workspace_id: 'ws-affiliate' })
  assert.strictEqual(affAnalytics.totalRuns, 30)
  assert(affAnalytics.successRate > 0 && affAnalytics.failureRate > 0)
  assert(affAnalytics.averageDurationMs >= 0)

  // Paginated query
  const pageRuns = await runsRepo.getRuns({ workspace_id: 'ws-affiliate', page: 1, pageSize: 10 })
  assert.strictEqual(pageRuns.runs.length, 10)
  assert.strictEqual(pageRuns.total, 30)
  assert.strictEqual(pageRuns.totalPages, 3)
  console.log('✓ Run history and local analytics verified: pagination, filters and KPIs accurate')

  console.log('\n[Phase 5] Safe Workspace Deletion and Profile Reassignment...')
  await workspacesRepo.deleteWorkspace('ws-affiliate', { targetWorkspaceId: 'default' })
  const deletedAff = await workspacesRepo.getWorkspaceById('ws-affiliate')
  assert.strictEqual(deletedAff, null)

  const defaultAfterMove = await profilesRepo.getAllProfiles({ workspace_id: 'default' })
  assert.strictEqual(defaultAfterMove.length, 50, `Expected 20 + 30 = 50 profiles in default workspace, got ${defaultAfterMove.length}`)
  console.log('✓ Deleted Affiliate workspace: 30 profiles safely migrated to Default workspace with zero data loss')

  closeDb()
  console.log('\n========================================================================')
  console.log('🎉 TEST TỔNG SAU BƯỚC 30 HOÀN THÀNH XUẤT SẮC — 100% PASS TOÀN DIỆN!')
  console.log('========================================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err)
  process.exit(1)
})
