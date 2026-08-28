const assert = require('assert')
const fs = require('fs')
const path = require('path')
const pkg = require('../package.json')
const lock = require('../package-lock.json')
const versions = require('../src/main/versions')
const stealthProtection = require('../src/main/browser/stealthProtection')

async function run() {
  const calls = []
  const context = { addInitScript: async (script) => calls.push(script) }

  assert.strictEqual(stealthProtection.shouldApplyToEngine('chromium'), true)
  assert.strictEqual(stealthProtection.shouldApplyToEngine('firefox'), false)
  assert.strictEqual(stealthProtection.shouldApplyToEngine('webkit'), false)
  assert.strictEqual((await stealthProtection.installForContext(context, 'firefox')).applied, false)
  assert.strictEqual(calls.length, 0, 'Firefox must not receive Chromium-only initialization')
  assert.strictEqual((await stealthProtection.installForContext(context, 'chromium')).applied, true)
  assert.strictEqual(calls.length, 1, 'Chromium must receive exactly one initialization script')

  assert.strictEqual(pkg.version, '1.2.0')
  assert.strictEqual(lock.version, pkg.version)
  assert.strictEqual(lock.packages[''].version, pkg.version)
  assert.strictEqual(versions.APP_VERSION, pkg.version)
  assert.strictEqual(versions.getVersions(14).app, pkg.version)
  assert.strictEqual(pkg.build.win.artifactName, 'YNlogin-Setup-${version}-${arch}.${ext}')
  const expectedArtifact = pkg.build.win.artifactName
    .replace('${version}', pkg.version).replace('${arch}', 'x64').replace('${ext}', 'exe')
  assert.strictEqual(expectedArtifact, 'YNlogin-Setup-1.2.0-x64.exe')

  const electronTest = fs.readFileSync(path.join(__dirname, 'step55_electron_ui_e2e.test.js'), 'utf8')
  assert(electronTest.includes(`bridge.versions.app, '${pkg.version}'`), 'Electron E2E assertion must track the release version')
  console.log('✓ Phạm vi engine và toàn bộ metadata phát hành v1.2.0 được kiểm tra hồi quy')
}

run().catch((error) => { console.error(error); process.exit(1) })
