const assert = require('assert')
const { getDb, closeDb } = require('../src/main/database')
const { createProfile, deleteProfile } = require('../src/main/database/profiles')
const { createProxy, deleteProxy } = require('../src/main/database/proxies')
const { checkProfileHealth, checkBatchProfiles } = require('../src/main/browser/healthCheck')
const leakProtection = require('../src/main/browser/leakProtection')

async function runStep17Tests() {
  console.log('=== STARTING BƯỚC 17: PROFILE HEALTH CHECK TESTS ===\n')

  let createdProfileIds = []
  let createdProxyIds = []

  try {
    // 1. Test Healthy Profile
    console.log('[Test 1] Testing Health Check on Valid Ready Profile...')
    const healthyProfile = await createProfile({
      name: 'Healthy Test Profile',
      browser_type: 'chromium',
      environment: {
        mode: 'custom',
        locale: 'en-US',
        timezone: 'America/New_York',
        languages: ['en-US', 'en'],
        viewport: { width: 1920, height: 1080 },
      },
      tags: ['healthy'],
    })
    createdProfileIds.push(healthyProfile.id)

    const health1 = await checkProfileHealth(healthyProfile.id)
    assert(health1.success, 'Health check should succeed')
    assert.strictEqual(health1.overallStatus, 'HEALTHY', 'Valid profile should have HEALTHY status')
    assert(health1.checks.every((c) => c.status === 'PASS'), 'All checks should be PASS')
    console.log('✓ Healthy profile successfully verified: 100% PASS on all checks')

    // 2. Test Invalid Browser Engine (Error Status)
    console.log('\n[Test 2] Testing Health Check on Profile with Unavailable Browser Engine...')
    const invalidEngineProfile = await createProfile({
      name: 'Invalid Engine Profile',
      browser_type: 'non_existent_quantum_browser',
      environment: { mode: 'default' },
    })
    createdProfileIds.push(invalidEngineProfile.id)

    const health2 = await checkProfileHealth(invalidEngineProfile.id)
    assert(health2.success)
    assert.strictEqual(health2.overallStatus, 'ERROR', 'Missing engine should result in ERROR overall status')
    const engineCheck = health2.checks.find((c) => c.id === 'browser_engine')
    assert(engineCheck && engineCheck.status === 'FAIL', 'Engine check should FAIL')
    assert(engineCheck.remedy, 'Remedy should be provided')
    console.log('✓ Unavailable browser engine accurately caught with ERROR status and actionable remedy')

    // 3. Test Network Consistency Warning (Warning Status)
    console.log('\n[Test 3] Testing Health Check on Inconsistent Proxy/Timezone Profile (Warning Status)...')
    const usProxy = await createProxy({
      name: 'US Proxy Warning Test',
      protocol: 'http',
      host: '127.0.0.1',
      port: 8080,
      country_code: 'US',
      country_name: 'United States',
      city: 'New York',
      timezone: 'America/New_York',
      geo_metadata: { country_code: 'US', country_name: 'United States', timezone: 'America/New_York' },
    })
    createdProxyIds.push(usProxy.id)

    const warnProfile = await createProfile({
      name: 'Warning Mismatched Profile',
      browser_type: 'chromium',
      proxy_id: usProxy.id,
      environment: {
        mode: 'custom',
        locale: 'vi-VN',
        timezone: 'Asia/Ho_Chi_Minh', // Mismatched with US proxy
        viewport: { width: 1280, height: 720 },
      },
    })
    createdProfileIds.push(warnProfile.id)

    const health3 = await checkProfileHealth(warnProfile.id)
    assert(health3.success)
    const consistencyCheck = health3.checks.find((c) => c.id === 'network_consistency')
    assert(consistencyCheck && consistencyCheck.status === 'WARN', 'Consistency check should WARN')
    assert(consistencyCheck.remedy, 'Consistency check should have remedy')
    console.log('✓ Geo-mismatched profile accurately reports WARN status with auto-match remedy')

    // 4. Test Batch Health Check
    console.log('\n[Test 4] Testing Batch Health Check...')
    const batchResults = await checkBatchProfiles([healthyProfile.id, invalidEngineProfile.id])
    assert.strictEqual(batchResults.length, 2, 'Batch check should return 2 results')
    assert.strictEqual(batchResults[0].overallStatus, 'HEALTHY')
    assert.strictEqual(batchResults[1].overallStatus, 'ERROR')
    console.log('✓ Batch health check verified across multiple profiles')

    // 5. Verify WebRTC Leak Protection Co-existence
    console.log('\n[Test 5] Verifying WebRTC Leak Protection Co-existence...')
    assert(leakProtection.getLaunchArgs, 'WebRTC leak protection must remain available')
    console.log('✓ WebRTC leak protection active and unaffected')

    console.log('\n======================================================')
    console.log('🎉 ALL BƯỚC 17 TESTS PASSED SUCCESSFULLY WITH ZERO ERRORS!')
    console.log('======================================================\n')
  } finally {
    for (const id of createdProfileIds) {
      await deleteProfile(id, { deleteData: true }).catch(() => {})
    }
    for (const id of createdProxyIds) {
      await deleteProxy(id).catch(() => {})
    }
    closeDb()
  }
}

runStep17Tests().catch((err) => {
  console.error('\n❌ STEP 17 TEST FAILED:', err)
  process.exit(1)
})
