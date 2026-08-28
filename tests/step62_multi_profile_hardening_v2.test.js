const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { createIdentity, validateIdentity } = require('../src/main/browser/profileIdentity')
const { buildRuntimeIdentity } = require('../src/main/browser/runtimeIdentity')
const { evaluateFingerprintConsistency } = require('../src/main/browser/fingerprintConsistency')
const { validateProfile } = require('../src/main/browser/profileHealth')
const { buildScreenModel, validateScreenModel } = require('../src/main/browser/screenModel')
const { auditFontProfile } = require('../src/main/browser/fontProfile')
const { forChromiumMajor } = require('../src/main/browser/browserCompatibility')
const { evaluateBrowserUpdate } = require('../src/main/browser/browserCompatibility/regressionGate')
const { auditCrossProfileCollisions } = require('../src/main/browser/collisionAudit')
const { compareFingerprintSnapshots } = require('../src/main/browser/persistenceAudit')
const { createAutomationContext } = require('../src/sdk')

async function run() {
  const a = createIdentity('hardening-a', { platform: 'windows', locale: 'en-US', timezone: 'America/New_York' }, 'chrome')
  const b = createIdentity('hardening-b', { platform: 'windows', locale: 'en-US', timezone: 'America/New_York' }, 'chrome')
  assert(a.templateId && b.templateId, 'new identities must be backed by coherent device templates')
  assert.strictEqual(validateIdentity(a).valid, true)
  assert.strictEqual(a.gpu.family.includes('apple'), false, 'Windows identity must never use Apple GPU capability')
  const runtime = buildRuntimeIdentity(a, '152.0.7977.64')
  assert(runtime.userAgent.includes('Chrome/152.0.7977.64'))
  assert.strictEqual(runtime.browserCapabilities.supported, true)

  const screen = buildScreenModel(a, { width: 99999, height: 99999 })
  assert(screen.viewport.width <= screen.availWidth && screen.viewport.height <= screen.availHeight)
  assert.strictEqual(validateScreenModel(screen).valid, true)
  assert.strictEqual(auditFontProfile(a).healthy, true)
  assert.strictEqual(forChromiumMajor(152).webGpu, true)
  assert.strictEqual(evaluateBrowserUpdate({ currentVersion: '151', candidateVersion: '152', stages: { compatibility: { passed: true }, fingerprint: { passed: true }, isolation: { passed: true }, network: { passed: true }, smoke: { passed: false } } }).action, 'keep-current-version')
  assert.strictEqual(evaluateFingerprintConsistency(a, '152.0.0.0').status, 'Healthy')

  const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'ynlogin-health-'))
  try {
    const health = validateProfile({ id: 'health-a', browser_type: 'chrome', browser_data_path: storage, environment: { mode: 'default', identity: a } }, '152.0.0.0')
    assert.strictEqual(health.valid, true)
    const blocked = validateProfile({ id: 'health-a', browser_type: 'chrome', browser_data_path: storage, proxy_id: 'dead', environment: { identity: a } }, '152.0.0.0', { proxyResolvable: false })
    assert.strictEqual(blocked.valid, false, 'fail-closed profile health must reject unavailable proxy')
  } finally { fs.rmSync(storage, { recursive: true, force: true }) }

  const collision = auditCrossProfileCollisions([
    { id: 'a', browser_data_path: 'same' }, { id: 'b', browser_data_path: 'same' },
  ])
  assert.strictEqual(collision.status, 'Invalid')
  const persistence = compareFingerprintSnapshots({ userAgent: 'A', timestamp: 1 }, { userAgent: 'A', timestamp: 2 })
  assert.strictEqual(persistence.stable, true)

  const calls = []
  const locator = {
    first: () => locator,
    waitFor: async () => calls.push('wait'), isEnabled: async () => true,
    click: async () => calls.push('click'), fill: async (value) => calls.push(['fill', value]),
    pressSequentially: async (value) => calls.push(['type', value]), scrollIntoViewIfNeeded: async () => calls.push('scroll'),
  }
  const sdk = createAutomationContext({ permissions: ['browser.page'], page: { locator: () => locator }, logger: { info() {}, error() {} } })
  await sdk.browser.safeClick('#safe')
  await sdk.browser.waitAndClick('#wait')
  await sdk.browser.typeWithDelay('#input', 'hello')
  await sdk.browser.scrollIntoViewAndClick('#below')
  assert(calls.includes('scroll') && calls.filter((item) => item === 'click').length === 3)

  console.log('✓ Hardening V2 templates, consistency, health, display, fonts, compatibility, collision, persistence and SDK helpers verified')
}

run().catch((error) => { console.error(error); process.exit(1) })
