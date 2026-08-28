const assert = require('assert')
const { getDb, closeDb } = require('../src/main/database')
const presetsRepo = require('../src/main/database/presets')

async function runTests() {
  console.log('=== STARTING BƯỚC 34: CONFIGURATION PRESETS TESTS ===\n')

  const db = await getDb()
  db.run('DELETE FROM config_presets')

  console.log('[Test 1] Modular Preset Creation & Multi-Type Support...')
  const pEnv = await presetsRepo.createConfigPreset({
    name: 'US East Residential Env',
    type: 'environment',
    config: { locale: 'en-US', timezone: 'America/New_York', screen: { width: 1920, height: 1080 } },
  })

  const pBrowser = await presetsRepo.createConfigPreset({
    name: 'Stealth Chromium Args',
    type: 'browser',
    config: { browser_type: 'chromium', args: ['--disable-blink-features=AutomationControlled'] },
  })

  const pAuto = await presetsRepo.createConfigPreset({
    name: 'E-Commerce Scrape Inputs',
    type: 'automation_input',
    config: { target_url: 'https://example.com/shop', delay_ms: 1500, max_items: 50 },
  })

  assert.strictEqual(pEnv.type, 'environment')
  assert.strictEqual(pBrowser.type, 'browser')
  assert.strictEqual(pAuto.type, 'automation_input')
  console.log('✓ Presets created across multiple types (Environment, Browser, Automation Input)')

  console.log('\n[Test 2] Strict Sanitization against Secret Injections...')
  const pSecretTest = await presetsRepo.createConfigPreset({
    name: 'Malicious / Leaked Config',
    type: 'proxy',
    config: {
      host: 'proxy.secure.net',
      port: 8080,
      password: 'super_secret_password',
      auth_token: 'bearer_token_123',
      cookie: 'session_key=abc',
    },
  })

  assert.strictEqual(pSecretTest.config.host, 'proxy.secure.net')
  assert.strictEqual(pSecretTest.config.password, undefined, 'Preset must NOT store passwords')
  assert.strictEqual(pSecretTest.config.auth_token, undefined, 'Preset must NOT store auth tokens')
  assert.strictEqual(pSecretTest.config.cookie, undefined, 'Preset must NOT store session cookies')
  console.log('✓ Secret stripping verified: passwords, cookies, and tokens are cleanly expunged')

  console.log('\n[Test 3] Workspace Scoping & Global Presets...')
  await presetsRepo.createConfigPreset({
    name: 'Marketing Division Exclusive Preset',
    type: 'environment',
    workspace_id: 'ws-marketing',
    config: { locale: 'vi-VN', timezone: 'Asia/Ho_Chi_Minh' },
  })

  // Query scoped to ws-marketing
  const mktList = await presetsRepo.getConfigPresets({ workspace_id: 'ws-marketing' })
  assert(mktList.some((p) => p.name === 'Marketing Division Exclusive Preset'), 'Must include workspace preset')
  assert(mktList.some((p) => p.name === 'US East Residential Env'), 'Must include global preset')

  // Query scoped to ws-crypto
  const cryptoList = await presetsRepo.getConfigPresets({ workspace_id: 'ws-crypto' })
  assert(!cryptoList.some((p) => p.name === 'Marketing Division Exclusive Preset'), 'Must NOT leak other workspace presets')
  assert(cryptoList.some((p) => p.name === 'US East Residential Env'), 'Must still include global preset')
  console.log('✓ Scoping verified: global presets inherit everywhere, workspace presets stay strictly isolated')

  console.log('\n[Test 4] Update and Delete Presets...')
  const updated = await presetsRepo.updateConfigPreset(pEnv.id, {
    name: 'US East Residential Env (Updated)',
    config: { locale: 'en-US', timezone: 'America/New_York', screen: { width: 2560, height: 1440 } },
  })
  assert.strictEqual(updated.name, 'US East Residential Env (Updated)')
  assert.strictEqual(updated.config.screen.width, 2560)

  await presetsRepo.deleteConfigPreset(pSecretTest.id)
  const deleted = await presetsRepo.getConfigPresetById(pSecretTest.id)
  assert.strictEqual(deleted, null)
  console.log('✓ Preset update and deletion operate reliably')

  closeDb()
  console.log('\n======================================================')
  console.log('🎉 ALL BƯỚC 34 CONFIGURATION PRESETS TESTS PASSED!')
  console.log('======================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err)
  process.exit(1)
})
