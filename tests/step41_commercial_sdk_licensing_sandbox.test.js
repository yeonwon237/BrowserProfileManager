const assert = require('assert')
const crypto = require('crypto')
const { licenseService, featurePolicyService, getInstallationId } = require('../src/main/licensing')
const { updateManager } = require('../src/main/updates')
const { validateManifest, createAutomationContext } = require('../src/sdk')
const { automationSandbox } = require('../src/main/automation/sandbox')
const { pluginMarketplace } = require('../src/main/automation/marketplace')

async function runTests() {
  console.log('=== STARTING BƯỚC 36–45: COMMERCIAL LICENSING, SDK & SANDBOX TESTS ===\n')

  console.log('[Test 1] Product Licensing & Feature Policy...')
  licenseService.setLicenseKey('FREE')
  let policy = featurePolicyService.getEffectivePolicy()
  assert.strictEqual(policy.edition, 'free')
  assert.strictEqual(policy.max_profiles, 5)
  assert.strictEqual(policy.scheduler_enabled, false)

  licenseService.setLicenseKey('PRO-COMMERCIAL-KEY-123')
  policy = featurePolicyService.getEffectivePolicy()
  assert.strictEqual(policy.edition, 'pro')
  assert.strictEqual(policy.max_profiles, 100)
  assert.strictEqual(policy.scheduler_enabled, true)

  // Zero Data Lock Guarantee: When expired, export and backup are ALWAYS allowed
  licenseService.currentLicense.status = 'expired'
  policy = featurePolicyService.getEffectivePolicy()
  assert.strictEqual(policy.canExportData, true, 'Export must NEVER be locked when license expires')
  assert.strictEqual(policy.canBackup, true, 'Backup must NEVER be locked when license expires')
  console.log('✓ Licensing: Multi-tier editions active, with zero data-lock guarantee on expiry')

  console.log('\n[Test 2] Device Activation & Installation Identifier...')
  const installId = getInstallationId()
  assert(installId && installId.startsWith('inst-'), 'Unique installation identifier generated')
  const deact = licenseService.deactivateDevice()
  assert.strictEqual(deact.success, true)
  console.log('✓ Device Activation: Independent installation ID stored, deactivation successful')

  console.log('\n[Test 3] Application Auto Update & Integrity Verification...')
  const dummyPayload = Buffer.from('YNlogin-app-update-binary-content')
  const expectedHash = crypto.createHash('sha256').update(dummyPayload).digest('hex')
  const isIntegrityValid = updateManager.verifyUpdateIntegrity(dummyPayload, expectedHash)
  assert.strictEqual(isIntegrityValid, true, 'SHA-256 update integrity check must pass')

  const isNewer = updateManager.isNewerVersion('1.2.0', '1.0.0')
  assert.strictEqual(isNewer, true)
  const isNotNewer = updateManager.isNewerVersion('1.0.0', '1.0.0')
  assert.strictEqual(isNotNewer, false)
  console.log('✓ Auto-Update: Semantic versioning and SHA-256 release checksum verification passed')

  console.log('\n[Test 4] Plugin SDK & Manifest Validation...')
  const validManifest = {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    permissions: ['browser.page', 'browser.navigation'],
  }
  const check1 = validateManifest(validManifest)
  assert.strictEqual(check1.valid, true)

  const invalidManifest = {
    id: 'bad-plugin',
    permissions: ['unauthorized.system.root.access'],
  }
  const check2 = validateManifest(invalidManifest)
  assert.strictEqual(check2.valid, false, 'Should reject unknown/unauthorized permissions')
  console.log('✓ Plugin SDK: Manifest validator strictly enforces permissions and schemas')

  console.log('\n[Test 5] Plugin Sandboxing Runtime (Timeout & Fault Containment)...')
  // 1. Normal successful plugin execution
  const mockPage = {
    goto: async (url) => ({ status: 200, url }),
    title: async () => 'Test Automation Page',
  }

  const goodPlugin = async (ctx) => {
    await ctx.browser.goto('https://example.com')
    const t = await ctx.browser.title()
    return { title: t, status: 'ok' }
  }

  const run1 = await automationSandbox.executeInSandbox({
    pluginFn: goodPlugin,
    page: mockPage,
    permissions: ['browser.page', 'browser.navigation'],
  })
  assert.strictEqual(run1.success, true)
  assert.strictEqual(run1.result.title, 'Test Automation Page')

  // 2. Erroneous plugin execution (must not crash main process)
  const crashingPlugin = async () => {
    throw new Error('Fatal simulated crash inside third-party script!')
  }
  const run2 = await automationSandbox.executeInSandbox({
    pluginFn: crashingPlugin,
    page: mockPage,
  })
  assert.strictEqual(run2.success, false)
  assert(run2.error.includes('Fatal simulated crash'))

  // 3. Timeout containment
  const infiniteLoopPlugin = async () => {
    await new Promise((r) => setTimeout(r, 500))
  }
  const run3 = await automationSandbox.executeInSandbox({
    pluginFn: infiniteLoopPlugin,
    page: mockPage,
    timeoutMs: 100,
  })
  assert.strictEqual(run3.success, false)
  assert(run3.error.includes('SandboxTimeout'))
  console.log('✓ Plugin Sandboxing: Safely contains errors and enforces timeout boundaries')

  console.log('\n[Test 6] Plugin Marketplace Architecture...')
  const catalog = pluginMarketplace.getCatalog()
  assert(catalog.length >= 3)
  const official = pluginMarketplace.getCatalog({ officialOnly: true })
  assert(official.every((p) => p.isOfficial))

  const thirdPartyDetails = pluginMarketplace.getPluginDetails('community-amazon-tracker')
  assert(thirdPartyDetails.trustWarning !== null, 'Third-party plugins must include security trust warning')
  console.log('✓ Plugin Marketplace: Catalog, official signatures, and third-party warnings verified')

  console.log('\n======================================================')
  console.log('🎉 ALL BƯỚC 36–45 COMMERCIAL & SDK TESTS PASSED!')
  console.log('======================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err)
  process.exit(1)
})
