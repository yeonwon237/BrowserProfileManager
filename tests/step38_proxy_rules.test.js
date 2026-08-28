const assert = require('assert')
const { getDb, closeDb } = require('../src/main/database')
const proxyRuleManager = require('../src/main/proxies/ruleManager')
const proxiesRepo = require('../src/main/database/proxies')
const profilesRepo = require('../src/main/database/profiles')

async function runTests() {
  console.log('=== STARTING BƯỚC 33: PROXY ASSIGNMENT RULES TESTS ===\n')

  const db = await getDb()
  db.run('DELETE FROM profiles')
  db.run('DELETE FROM proxies')

  console.log('[Test 1] Setting up Proxies with capacity limits & querying live stats...')
  const pUS = await proxiesRepo.createProxy({
    name: 'US Dedicated Proxy',
    protocol: 'http',
    host: 'us.proxy.net',
    port: 8080,
    max_profiles: 4,
  })

  const pEU = await proxiesRepo.createProxy({
    name: 'EU Fast Proxy',
    protocol: 'socks5',
    host: 'eu.proxy.net',
    port: 1080,
    max_profiles: 3,
  })

  const pASIA = await proxiesRepo.createProxy({
    name: 'ASIA Residential',
    protocol: 'http',
    host: 'asia.proxy.net',
    port: 3128,
    max_profiles: 5,
  })

  let stats = await proxyRuleManager.getProxyStats()
  assert.strictEqual(stats.length, 3)
  assert(stats.every((s) => s.assigned_profile_count === 0))
  console.log('✓ Initial proxy capacity & live load stats accurate')

  console.log('\n[Test 2] Least Used load-balancing assignment rule...')
  // Create 6 unassigned profiles
  const profilesBatch1 = []
  for (let i = 1; i <= 6; i++) {
    const prof = await profilesRepo.createProfile({
      name: `Worker-${i}`,
      workspace_id: 'default',
    })
    profilesBatch1.push(prof)
  }

  const resLeastUsed = await proxyRuleManager.applyAssignmentRule({
    ruleType: 'unassigned',
    mode: 'least_used',
    workspaceId: 'default',
  })

  assert.strictEqual(resLeastUsed.success, true)
  assert.strictEqual(resLeastUsed.assignedCount, 6)

  stats = await proxyRuleManager.getProxyStats()
  // With 6 profiles over 3 proxies in least_used mode, each proxy gets exactly 2 profiles
  assert.strictEqual(stats.find((s) => s.id === pUS.id).assigned_profile_count, 2)
  assert.strictEqual(stats.find((s) => s.id === pEU.id).assigned_profile_count, 2)
  assert.strictEqual(stats.find((s) => s.id === pASIA.id).assigned_profile_count, 2)
  console.log('✓ Least Used strategy evenly balanced 6 profiles (2 on US, 2 on EU, 2 on ASIA)')

  console.log('\n[Test 3] Capacity limit warnings on overload...')
  // Create 6 more profiles and assign to pool
  for (let i = 7; i <= 12; i++) {
    await profilesRepo.createProfile({ name: `Worker-${i}`, workspace_id: 'default' })
  }

  // Total will now be 12 profiles. EU has max 3, so assigning 2 more (total 4) will trigger warning
  const resOverload = await proxyRuleManager.applyAssignmentRule({
    ruleType: 'unassigned',
    mode: 'least_used',
    workspaceId: 'default',
  })

  assert.strictEqual(resOverload.success, true)
  assert.strictEqual(resOverload.assignedCount, 6)
  assert(resOverload.warnings.length > 0, 'Must warn when a proxy exceeds configured max profiles')
  console.log('✓ Overload detection successfully issued non-blocking warnings')

  console.log('\n[Test 4] Bulk Remove Proxy Assignment...')
  const allProfiles = await profilesRepo.getAllProfiles()
  const pids = allProfiles.slice(0, 5).map((p) => p.id)

  const remRes = await proxyRuleManager.bulkRemoveProxy({ profileIds: pids })
  assert.strictEqual(remRes.success, true)
  assert.strictEqual(remRes.removedCount, 5)

  const updatedProfiles = await profilesRepo.getAllProfiles()
  const unassignedCount = updatedProfiles.filter((p) => !p.proxy_id).length
  assert.strictEqual(unassignedCount, 5)
  console.log('✓ Bulk proxy removal cleared proxy from 5 profiles cleanly')

  closeDb()
  console.log('\n======================================================')
  console.log('🎉 ALL BƯỚC 33 PROXY RULES TESTS PASSED!')
  console.log('======================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err)
  process.exit(1)
})
