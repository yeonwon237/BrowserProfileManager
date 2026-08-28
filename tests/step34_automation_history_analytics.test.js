const assert = require('assert')
const fs = require('fs')
const { getDb, closeDb } = require('../src/main/database')
const runsRepo = require('../src/main/database/runs')
const profilesRepo = require('../src/main/database/profiles')

async function runTests() {
  console.log('=== STARTING BƯỚC 30: AUTOMATION HISTORY & ANALYTICS TESTS ===\n')

  const db = await getDb()
  db.run('DELETE FROM profiles')
  db.run('DELETE FROM runs')
  db.run('DELETE FROM run_logs')

  console.log('[Test 1] Run lifecycle, duration, secret redaction, and error categorization...')
  const profileA = await profilesRepo.createProfile({ name: 'Trader Profile 1', workspace_id: 'ws-crypto' })
  const toolMock = { id: 'binance_bot', name: 'Binance Order Placer' }

  // 1. Create run with sensitive inputs
  const runInfo = await runsRepo.createRun({
    tool: toolMock,
    profile: profileA,
    inputs: { api_key: 'public_key_123', api_secret: 'super_secret_token_abc' },
    workspace_id: 'ws-crypto',
  })

  assert(runInfo.id, 'Run ID must be generated')

  // 2. Add log entries with sensitive data
  await runsRepo.addRunLog(runInfo.id, 'info', 'Connecting to API with Authorization: Bearer secret-auth-token-xyz')
  await runsRepo.addRunLog(runInfo.id, 'debug', 'Setting Cookie: session_id=secret12345; user=trader')

  // Short delay to test duration
  await new Promise((r) => setTimeout(r, 60))

  // 3. Finish run with timeout error
  const finished = await runsRepo.finishRun(runInfo.id, {
    status: 'failed',
    error: 'Navigation error: WaitForSelector timed out after 30000ms',
  })

  assert.strictEqual(finished.status, 'failed')
  assert(finished.duration_ms >= 50, `Expected duration >= 50ms, got ${finished.duration_ms}ms`)
  assert.strictEqual(finished.error_category, 'TIMEOUT', `Expected TIMEOUT category, got ${finished.error_category}`)

  // 4. Detailed Run Inspection & Secret Redaction Check
  const details = await runsRepo.getRunDetails(runInfo.id)
  assert(details, 'Run details must be loaded')
  assert(details.logContent.includes('[REDACTED]'), 'Log content must redact Authorization and Cookie secrets')
  assert(!details.logContent.includes('secret-auth-token-xyz'), 'Raw secret token must NOT exist in logs')
  console.log('✓ Run lifecycle computes duration, categorizes errors, and redacts sensitive data')

  console.log('\n[Test 2] Filtered & paginated runs queries...')
  const profileB = await profilesRepo.createProfile({ name: 'Default Profile', workspace_id: 'default' })

  // Seed 25 additional runs
  for (let i = 1; i <= 25; i++) {
    const isCrypto = i <= 15
    const isSuccess = i % 3 !== 0 // ~66% success
    const run = await runsRepo.createRun({
      tool: { id: isCrypto ? 'crypto_bot' : 'social_bot', name: isCrypto ? 'Crypto Bot' : 'Social Bot' },
      profile: isCrypto ? profileA : profileB,
      workspace_id: isCrypto ? 'ws-crypto' : 'default',
    })
    await runsRepo.finishRun(run.id, {
      status: isSuccess ? 'success' : 'failed',
      error: isSuccess ? null : 'Authentication error: 401 Unauthorized',
    })
  }

  // Page 1 of 10
  const page1 = await runsRepo.getRuns({ page: 1, pageSize: 10 })
  assert.strictEqual(page1.runs.length, 10, 'Page 1 must have 10 items')
  assert.strictEqual(page1.total, 26, 'Total must be 26 (1 initial + 25 seeded)')
  assert.strictEqual(page1.totalPages, 3, 'Total pages must be 3')

  // Page 3 of 10
  const page3 = await runsRepo.getRuns({ page: 3, pageSize: 10 })
  assert.strictEqual(page3.runs.length, 6, 'Page 3 must have remaining 6 items')

  // Filter by workspace
  const cryptoRuns = await runsRepo.getRuns({ workspace_id: 'ws-crypto', pageSize: 50 })
  assert.strictEqual(cryptoRuns.runs.length, 16, `Expected 16 runs in ws-crypto, got ${cryptoRuns.runs.length}`)

  // Filter by status
  const failedRuns = await runsRepo.getRuns({ status: 'failed', pageSize: 50 })
  assert(failedRuns.runs.every((r) => r.status === 'failed'), 'All filtered items must have status=failed')

  // Search filter
  const searched = await runsRepo.getRuns({ search: 'Binance', pageSize: 50 })
  assert.strictEqual(searched.runs.length, 1, 'Search query must find 1 matching run')
  console.log('✓ Paginated and filtered queries operate efficiently')

  console.log('\n[Test 3] Local Analytics aggregation (100% local SQLite computation)...')
  const analytics = await runsRepo.getAutomationAnalytics()
  assert(analytics.totalRuns === 26, `Expected 26 total runs, got ${analytics.totalRuns}`)
  assert(analytics.successRate > 0 && analytics.successRate <= 100, `Valid success rate: ${analytics.successRate}%`)
  assert(analytics.failureRate > 0 && analytics.failureRate <= 100, `Valid failure rate: ${analytics.failureRate}%`)
  assert.strictEqual(analytics.runsToday, 26, `Expected 26 runs today, got ${analytics.runsToday}`)
  assert.strictEqual(analytics.runsLast7Days, 26, `Expected 26 runs in last 7 days, got ${analytics.runsLast7Days}`)

  // Top failing tools
  assert(Array.isArray(analytics.topFailingAutomations), 'topFailingAutomations must be an array')
  assert(analytics.topFailingAutomations.length > 0, 'Must identify top failing automations')

  // Workspace-scoped analytics
  const cryptoAnalytics = await runsRepo.getAutomationAnalytics({ workspace_id: 'ws-crypto' })
  assert.strictEqual(cryptoAnalytics.totalRuns, 16, `Expected 16 runs in crypto workspace analytics, got ${cryptoAnalytics.totalRuns}`)
  console.log('✓ Local analytics computes success/fail rates, durations, and top failing tools')

  closeDb()
  console.log('\n======================================================')
  console.log('🎉 ALL BƯỚC 30 AUTOMATION HISTORY & ANALYTICS TESTS PASSED!')
  console.log('======================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err)
  process.exit(1)
})
