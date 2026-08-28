const assert = require('assert')
const { getDb, closeDb } = require('../src/main/database')
const { globalSearch } = require('../src/main/search')
const profilesRepo = require('../src/main/database/profiles')
const proxiesRepo = require('../src/main/database/proxies')
const workspacesRepo = require('../src/main/database/workspaces')
const runsRepo = require('../src/main/database/runs')
const automationManager = require('../src/main/automation/manager')

async function runTests() {
  console.log('=== STARTING BƯỚC 31: GLOBAL SEARCH TESTS ===\n')

  const db = await getDb()
  db.run('DELETE FROM profiles')
  db.run('DELETE FROM proxies')
  db.run('DELETE FROM runs')
  db.run("DELETE FROM workspaces WHERE id != 'default'")

  await automationManager.seedSampleTools()

  console.log('[Test 1] Multi-entity search precision...')
  // Setup known entities
  const p1 = await profilesRepo.createProfile({
    name: 'Facebook Growth Profile Alpha',
    group: 'SocialGrowth',
    tags: ['fb-lead', 'meta-ads'],
  })

  const px1 = await proxiesRepo.createProxy({
    name: 'Residential Tokyo Fast',
    protocol: 'socks5',
    host: 'tokyo.fastproxy.io',
    port: 1080,
    country_code: 'JP',
    city: 'Tokyo',
  })

  const ws1 = await workspacesRepo.createWorkspace({
    id: 'ws-ecom',
    name: 'E-Commerce Enterprise',
    description: 'Shopify and Amazon store profiles',
  })

  const r1 = await runsRepo.createRun({
    tool: { id: 'insta_scraper', name: 'Instagram Follower Scraper' },
    profile: p1,
  })
  await runsRepo.finishRun(r1.id, { status: 'failed', error: 'RateLimitExceeded: Instagram API throttled' })

  // Search by profile name keyword
  const resProfile = await globalSearch('Growth')
  assert(resProfile.profiles.some((p) => p.name.includes('Growth')), 'Must find profile by name keyword')

  // Search by tag
  const resTag = await globalSearch('meta-ads')
  assert(resTag.profiles.some((p) => p.tags.includes('meta-ads')), 'Must find profile by tag')

  // Search by proxy host / city
  const resProxy = await globalSearch('Tokyo')
  assert(resProxy.proxies.some((pr) => pr.city === 'Tokyo'), 'Must find proxy by city/host')

  // Search by run error
  const resRun = await globalSearch('RateLimitExceeded')
  assert(resRun.runs.some((r) => r.error && r.error.includes('RateLimitExceeded')), 'Must find run by error message')

  // Search by workspace
  const resWs = await globalSearch('E-Commerce')
  assert(resWs.workspaces.some((w) => w.name.includes('E-Commerce')), 'Must find workspace by name')
  console.log('✓ Multi-entity search precision verified across Profiles, Proxies, Runs, and Workspaces')

  console.log('\n[Test 2] Scale & Performance stress test (1,000 Profiles + 10,000 Runs)...')
  console.log('Seeding 1,000 profiles in batch transaction...')
  db.run('BEGIN TRANSACTION')
  for (let i = 1; i <= 1000; i++) {
    const id = `profile-scale-${i}`
    const name = `Enterprise Account #${i} [${i % 5 === 0 ? 'VIP' : 'Standard'}]`
    const group = `Group-${i % 20}`
    const tags = JSON.stringify([`tag-${i % 10}`, i % 2 === 0 ? 'active' : 'dormant'])
    db.run(
      `INSERT INTO profiles (id, name, group_name, tags, browser_type, status, workspace_id)
       VALUES (?, ?, ?, ?, 'chromium', 'idle', 'default')`,
      [id, name, group, tags]
    )
  }
  db.run('COMMIT')

  console.log('Seeding 10,000 automation runs in batch transaction...')
  db.run('BEGIN TRANSACTION')
  const startTime = new Date().toISOString()
  for (let i = 1; i <= 10000; i++) {
    const runId = `run-scale-${i}`
    const toolName = i % 3 === 0 ? 'Twitter Bot Worker' : i % 2 === 0 ? 'Amazon Price Tracker' : 'Google SERP Extractor'
    const profName = `Enterprise Account #${(i % 1000) + 1}`
    const status = i % 7 === 0 ? 'failed' : 'success'
    const error = i % 7 === 0 ? `CustomWorkerError: step failed at index ${i}` : null
    db.run(
      `INSERT INTO runs (id, tool_id, tool_name, profile_id, profile_name, workspace_id, status, start_time, duration_ms, error)
       VALUES (?, 'tool-scale', ?, 'prof-scale', ?, 'default', ?, ?, 120, ?)`,
      [runId, toolName, profName, status, startTime, error]
    )
  }
  db.run('COMMIT')

  console.log('✓ Database populated with 1,000 profiles and 10,000 runs')

  // Run performance queries
  const benchmarkQueries = ['VIP', 'Price Tracker', 'CustomWorkerError', 'Enterprise', 'Group-15', 'tag-7']
  for (const q of benchmarkQueries) {
    const t0 = process.hrtime.bigint()
    const searchRes = await globalSearch(q, { limit: 10 })
    const t1 = process.hrtime.bigint()
    const ms = Number(t1 - t0) / 1e6

    assert(searchRes.total > 0, `Search query "${q}" must return results`)
    assert(ms < 50, `Search query "${q}" latency ${ms.toFixed(2)}ms must be under 50ms!`)
    console.log(`  - Query "${q}": found ${searchRes.total} results in ${ms.toFixed(2)}ms (PASS < 50ms)`)
  }

  closeDb()
  console.log('\n======================================================')
  console.log('🎉 ALL BƯỚC 31 GLOBAL SEARCH TESTS PASSED!')
  console.log('======================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err)
  process.exit(1)
})
