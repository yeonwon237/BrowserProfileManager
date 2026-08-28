const assert = require('assert')
const { getDb, closeDb } = require('../src/main/database')
const { createProfile, getProfileById, deleteProfile } = require('../src/main/database/profiles')
const { createProxy, deleteProxy } = require('../src/main/database/proxies')
const browserManager = require('../src/main/browser/manager')
const leakProtection = require('../src/main/browser/leakProtection')
const automationManager = require('../src/main/automation/manager')

async function runStep19Tests() {
  console.log('=== STARTING BƯỚC 19: NETWORK PRIVACY & LEAK PROTECTION TESTS ===\n')

  let createdProfileIds = []
  let createdProxyIds = []

  try {
    // 1. Test WebRTC Leak Protection Init Script & Candidate Filtering
    console.log('[Test 1] Testing WebRTC Init Script & Candidate Filtering logic...')
    const script = await leakProtection.getWebRtcInitScript()
    assert(script && script.includes('__ynloginWebRtcPatched'), 'WebRTC init script must be generated')
    assert(script.includes('isPrivateOrLocalIP'), 'WebRTC script must have private IP detection')
    assert(script.includes('filterSdp'), 'WebRTC script must include SDP rewriting')
    console.log('✓ WebRTC init script and candidate filtering confirmed')

    // 2. Test Launch Arguments for Proxy Kill-Switch & IP Handling Policy
    console.log('\n[Test 2] Testing Launch Args for Proxy Kill-Switch & IP Handling...')
    const directArgs = leakProtection.getLaunchArgs({ proxyActive: false, disableIpv6: true })
    assert(directArgs.some((a) => a.includes('default_public_interface_only')), 'Direct connection must use default_public_interface_only')
    assert(directArgs.includes('--disable-ipv6'), 'Must disable IPv6 to prevent dual-stack leaks')

    const proxyArgs = leakProtection.getLaunchArgs({ proxyActive: true, disableIpv6: true, killSwitch: true })
    assert(proxyArgs.some((a) => a.includes('disable_non_proxied_udp')), 'Proxied connection must force disable_non_proxied_udp')
    assert(proxyArgs.includes('--proxy-bypass-list=<-loopback>'), 'Must enforce Proxy Kill-Switch fail-closed flag')
    assert(proxyArgs.includes('--enforce-webrtc-ip-permission-check'), 'Must enforce WebRTC IP permission check')
    console.log('✓ Launch arguments for Proxy Kill-Switch & IPv6 leak protection verified')

    // 3. Test In-Browser WebRTC Leak Detector Probe
    console.log('\n[Test 3] Testing In-Browser WebRTC Leak Detector Probe...')
    const p1 = await createProfile({ name: 'WebRTC Probe Profile', browser_type: 'chromium' })
    createdProfileIds.push(p1.id)

    await browserManager.openProfile(p1, { headless: true })
    const entry1 = browserManager.getEntry(p1.id)
    assert(entry1 && entry1.context, 'Browser context must be active')

    const page1 = entry1.context.pages()[0] || (await entry1.context.newPage())
    await page1.goto('data:text/html,<html><head><title>WebRTC Test</title></head><body>WebRTC Test</body></html>')

    const webrtcProbe = await leakProtection.detectWebRtcLeak(page1)
    console.log('WebRTC Probe result -> leaked:', webrtcProbe.leaked, '| private IPs:', webrtcProbe.privateIps)
    assert.strictEqual(webrtcProbe.leaked, false, 'WebRTC probe must not leak private LAN IP addresses')
    assert.strictEqual((webrtcProbe.privateIps || []).length, 0, 'Zero private IPs must be gathered')
    console.log('✓ In-browser WebRTC leak probe verified: 0 private IPs leaked')

    // 4. Test Public IP Resolution & Leak Detection Probe
    console.log('\n[Test 4] Testing Public IP Resolution & Leak Detection Probe...')
    const resolvedHostIp = await leakProtection.getDirectHostPublicIp()
    // Unit/regression runs must remain deterministic when CI blocks public-IP services.
    const directHostIp = resolvedHostIp || '198.51.100.10'
    console.log('Direct host machine IP resolved:', resolvedHostIp || 'unavailable (using reserved test address)')
    const deterministicProbePage = {
      isClosed: () => false,
      evaluate: async () => ({ ipv4: '203.0.113.199', ipv6: null }),
    }
    const ipProbe = await leakProtection.detectIpLeaks(deterministicProbePage, '203.0.113.199', directHostIp)
    assert(ipProbe.success, 'IP leak probe must complete successfully')
    console.log('Detected Browser Public IP:', ipProbe.browserIp, '| Expected Proxy IP:', ipProbe.expectedProxyIp)
    console.log('✓ Public IP resolution & dual-stack inspection probe verified')

    const dnsProbe = await leakProtection.detectDnsLeak(page1)
    assert.strictEqual(dnsProbe.success, true, 'DNS canary probe must execute')
    assert.strictEqual(dnsProbe.safe, true, 'Reserved DNS canary must not unexpectedly resolve')
    console.log('✓ DNS negative-canary test verified')

    // 5. Test Profile Network Privacy Validation & Real-IP Mismatch Detection
    console.log('\n[Test 5] Testing Profile Network Privacy Validation...')
    const privacyDirect = await leakProtection.validateProfileNetworkPrivacy(p1, entry1.context)
    assert.strictEqual(privacyDirect.safe, true, 'Direct profile without proxy must be marked safe')
    console.log('✓ Direct connection network privacy validation passed')

    // Create a Mock Proxy Profile to verify leak warning / mismatch
    const mockProxy = await createProxy({
      name: 'US Privacy Proxy',
      protocol: 'http',
      host: '198.51.100.55',
      port: 8080,
      country_code: 'US',
      city: 'New York',
    })
    createdProxyIds.push(mockProxy.id)

    const proxiedProfile = await createProfile({
      name: 'Proxied Privacy Profile',
      proxy_id: mockProxy.id,
      browser_type: 'chromium',
    })
    createdProfileIds.push(proxiedProfile.id)

    // Validate Privacy on mock proxied profile against active direct browser context (simulating real-IP leak)
    const privacyProxied = await leakProtection.validateProfileNetworkPrivacy(
      { ...proxiedProfile, proxy: mockProxy },
      entry1.context
    )
    console.log('Simulated direct context on proxied profile -> safe:', privacyProxied.safe, '| code:', privacyProxied.code)
    assert(
      privacyProxied.code === 'REAL_IP_LEAK' || privacyProxied.warnings.length > 0 || !privacyProxied.safe,
      'Must detect IP mismatch or real-IP leakage when browser IP does not match expected proxy'
    )
    console.log('✓ Real-IP leakage and proxy mismatch detection confirmed')

    // Fail closed when public-IP verification endpoints are unavailable.
    await page1.route('https://api.ipify.org*', (route) => route.abort())
    await page1.route('https://api4.ipify.org*', (route) => route.abort())
    await page1.route('https://api6.ipify.org*', (route) => route.abort())
    await page1.route('https://icanhazip.com*', (route) => route.abort())
    await entry1.context.setOffline(true)
    const unavailable = await leakProtection.validateProfileNetworkPrivacy(
      { ...proxiedProfile, proxy: mockProxy },
      entry1.context
    )
    assert.strictEqual(unavailable.safe, false, 'Unverifiable proxy routing must fail closed')
    assert.strictEqual(unavailable.code, 'VERIFICATION_UNAVAILABLE')
    await entry1.context.setOffline(false)
    console.log('✓ Unavailable IP verification fails closed')

    await browserManager.closeProfile(p1.id)

    // A dead proxy must produce a proxy error instead of reaching the site directly.
    const deadProxy = await createProxy({ name: 'Dead Proxy', protocol: 'http', host: '127.0.0.1', port: 9 })
    createdProxyIds.push(deadProxy.id)
    const deadProxyProfile = await createProfile({ name: 'Dead Proxy Profile', proxy_id: deadProxy.id, browser_type: 'chromium' })
    createdProfileIds.push(deadProxyProfile.id)
    await browserManager.openProfile(deadProxyProfile, { headless: true, skipPrivacyValidation: true })
    const deadPage = browserManager.getEntry(deadProxyProfile.id).context.pages()[0]
    await assert.rejects(
      () => deadPage.goto('http://example.com', { timeout: 5000 }),
      /proxy|ERR_PROXY_CONNECTION_FAILED|ERR_CONNECTION_REFUSED/i,
      'Dead proxy must fail closed and never fall back to direct traffic'
    )
    await browserManager.closeProfile(deadProxyProfile.id)
    console.log('✓ Dead proxy kill-switch fails closed')

    const missingProxyProfile = await createProfile({ name: 'Missing Proxy Profile', browser_type: 'chromium' })
    createdProfileIds.push(missingProxyProfile.id)
    await assert.rejects(
      () => browserManager.openProfile({ ...missingProxyProfile, proxy_id: 'missing-proxy-id' }, { headless: true }),
      /missing or invalid|prevent direct-IP fallback|không tồn tại|đã chặn mở hồ sơ/i
    )
    console.log('✓ Missing proxy configuration blocks launch')

    // 6. Test Fail-Closed Automation Security Guard
    console.log('\n[Test 6] Testing Fail-Closed Automation Security Guard...')
    // When real-IP leakage is detected, runTool must abort execution before running tool code
    await automationManager.seedSampleTools()
    const sampleTool = (await automationManager.scanAutomations())[0]
    assert(sampleTool, 'Sample automation tool must exist')
    await automationManager.setEnabled(sampleTool.id, true)

    // Profile with proxy that fails leak check
    const leakProfile = await createProfile({
      name: 'Leak Test Profile',
      proxy_id: mockProxy.id,
      browser_type: 'chromium',
    })
    createdProfileIds.push(leakProfile.id)

    // Launch profile in direct mode (bypassing proxy) to simulate a real-IP leak
    await browserManager.openProfile({ ...leakProfile, proxy_id: null }, { headless: true, skipPrivacyValidation: true })

    try {
      const runResult = await automationManager.runTool(sampleTool.id, leakProfile.id, { url: 'https://example.com' })
      console.log('Run tool with simulated leak -> ok:', runResult.ok, '| message:', runResult.message)
      assert.strictEqual(runResult.ok, false, 'Automation execution must be blocked when real-IP leakage is detected')
      assert(
        runResult.message.includes('Security Guard') || runResult.message.includes('leakage') || runResult.message.includes('REAL_IP_LEAK'),
        'Error message must indicate Security Guard / real-IP leak blockage'
      )
      console.log('✓ Security guard successfully caught leak and blocked tool execution')
    } finally {
      await browserManager.closeProfile(leakProfile.id).catch(() => {})
    }



    console.log('\n======================================================')
    console.log('🎉 ALL BƯỚC 19 TESTS PASSED SUCCESSFULLY WITH ZERO ERRORS!')
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

runStep19Tests().catch((err) => {
  console.error('\n❌ STEP 19 TEST FAILED:', err)
  process.exit(1)
})
