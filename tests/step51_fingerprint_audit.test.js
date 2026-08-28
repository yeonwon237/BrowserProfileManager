const assert = require('assert')
const { auditFingerprint } = require('../src/main/browser/fingerprintAudit')

function run() {
  const healthy = auditFingerprint({ mode: 'custom', locale: 'en-US', timezone: 'America/New_York' }, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/151.0.0.0',
    platform: 'Win32', language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/New_York',
    hardwareConcurrency: 8, deviceMemory: 8, canvasAvailable: true, webglAvailable: true,
    webglRenderer: 'ANGLE (NVIDIA)', viewport: { innerWidth: 1280, innerHeight: 720 }, screen: { width: 1920, height: 1080 },
    webdriver: false,
  })
  assert.strictEqual(healthy.score, 100)
  assert.strictEqual(healthy.consistent, true)

  const broken = auditFingerprint({ mode: 'custom', locale: 'en-US', timezone: 'UTC' }, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/151.0.0.0', platform: 'MacIntel',
    language: 'fr-FR', languages: ['de-DE'], timezone: 'Asia/Tokyo', hardwareConcurrency: 0,
    deviceMemory: 256, canvasAvailable: false, webglAvailable: false, webdriver: true,
    viewport: { innerWidth: 2000, innerHeight: 1200 }, screen: { width: 1280, height: 720 },
  })
  assert.strictEqual(broken.consistent, false)
  assert(broken.score < 50)
  const codes = new Set(broken.issues.map((item) => item.code))
  assert(codes.has('UA_PLATFORM_MISMATCH'))
  assert(codes.has('CONFIG_TIMEZONE_DRIFT'))
  assert(codes.has('VIEWPORT_SCREEN_IMPOSSIBLE'))
  console.log('✓ Browser identity audit scores coherent signals and detects cross-signal contradictions')
}

try { run() } catch (err) { console.error(err); process.exit(1) }
