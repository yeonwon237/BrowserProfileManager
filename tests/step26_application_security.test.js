const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { getDb, closeDb } = require('../src/main/database')
const { createProfile, deleteProfile } = require('../src/main/database/profiles')
const { createProxy, deleteProxy, getProxyById } = require('../src/main/database/proxies')
const { addLog, getLogs } = require('../src/main/database/logs')
const credentials = require('../src/main/security/credentials')
const { redactSecrets, redactObject } = require('../src/main/security/redact')
const { loadPlugin } = require('../src/main/security/pluginSandbox')
const browserManager = require('../src/main/browser/manager')
const ipcValidate = require('../src/main/security/ipcValidate')
const { validateManifest } = require('../src/main/automation/manifest')
const automationManager = require('../src/main/automation/manager')

async function runStep26Tests() {
  console.log('=== STARTING BƯỚC 23: APPLICATION SECURITY TESTS ===\n')

  const createdProfileIds = []
  const createdProxyIds = []
  const tempDirs = []
  let importedToolId = null

  try {
    await getDb()

    // 1. Secret redaction
    console.log('[Test 1] Logger secret redaction...')
    const sample =
      'Authorization: Bearer supersecret-token-abc123 | Cookie: session=leakme; sid=xyz | Set-Cookie: a=b | ' +
      'password=hunter2 password: hunter3 token=abcdef secret=value123'
    const redacted = redactSecrets(sample)
    assert(!redacted.includes('supersecret-token-abc123'), 'authorization token must be masked')
    assert(!redacted.includes('leakme'), 'cookie value must be masked')
    assert(!redacted.includes('hunter2'), 'password=value must be masked')
    assert(!redacted.includes('hunter3'), 'password: value must be masked')
    assert(!redacted.includes('abcdef'), 'token=value must be masked')
    assert(!redacted.includes('value123'), 'secret=value must be masked')
    assert(redacted.includes('[REDACTED]'), 'masked marker must appear')
    console.log(`✓ redactSecrets masks Authorization/Cookie/Set-Cookie/password/token/secret -> ${redacted.trim()}`)

    const redactedObj = redactObject({ ok: true, data: { password: 'p', token: 't', url: 'https://example.com' }, list: ['a', { api_key: 'k' }] })
    assert.strictEqual(redactedObj.data.password, '[REDACTED]')
    assert.strictEqual(redactedObj.data.token, '[REDACTED]')
    assert.strictEqual(redactedObj.list[1].api_key, '[REDACTED]')
    assert.strictEqual(redactedObj.data.url, 'https://example.com')
    console.log('✓ redactObject masks secret keys recursively')

    await addLog({ action: 'sec-test', status: 'info', message: `Login with Authorization: Bearer leakyauth987 and Cookie: sess=leakycookie` })
    const logs = await getLogs(20)
    const stored = logs.find((l) => l.action === 'sec-test')
    assert(stored, 'log must be stored')
    assert(!stored.message.includes('leakyauth987'), 'authorization must be redacted in DB log')
    assert(!stored.message.includes('leakycookie'), 'cookie must be redacted in DB log')
    console.log('✓ addLog stores redacted messages')

    // 2. Proxy password never stored in plaintext
    console.log('\n[Test 2] Proxy password is never stored plaintext...')
    const rawProxy = await createProxy({
      name: 'Secure Proxy',
      protocol: 'http',
      host: '10.0.0.5',
      port: 8080,
      username: 'secuser',
      password: 'plain-text-proxy-secret-1',
    })
    createdProxyIds.push(rawProxy.id)
    const storedProxy = await getProxyById(rawProxy.id)
    assert(storedProxy.encrypted_password, 'password must be encrypted')
    assert(storedProxy.encrypted_password !== 'plain-text-proxy-secret-1', 'encrypted value must differ from plaintext')
    assert(!JSON.stringify(storedProxy).includes('plain-text-proxy-secret-1'), 'no plaintext anywhere in record')
    const roundTrip = credentials.verifyRoundTrip('plain-text-proxy-secret-1')
    assert.strictEqual(roundTrip.ok, true, 'credential round-trip must work')
    console.log(`✓ Proxy password stored via ${credentials.backend()} (${credentials.isSecure() ? 'OS-backed' : 'fallback'}) — never plaintext`)

    // 3. IPC input validation
    console.log('\n[Test 3] IPC input validation...')
    const invalidProfile = ipcValidate.validateProfilePayload({ name: 123, tags: 'not-array', environment: 'not-object' })
    assert.strictEqual(invalidProfile.valid, false)
    const validProfile = ipcValidate.validateProfilePayload({
      name: '   Valid Name   ',
      tags: ['a', 'b'],
      notes: 'note',
      environment: { mode: 'custom', locale: 'en-US', timezone: 'UTC', viewport: { width: 1920, height: 1080 } },
    })
    assert.strictEqual(validProfile.valid, true)
    assert.strictEqual(validProfile.sanitized.name, 'Valid Name', 'name must be trimmed')
    assert.strictEqual(validProfile.sanitized.environment.viewport.width, 1920)
    const badProxy = ipcValidate.validateProxyPayload({ name: 'P', protocol: 'ftp', port: 99999 })
    assert.strictEqual(badProxy.valid, false)
    const dirtyInputs = ipcValidate.sanitizeInputs({ url: 'https://x.com', nested: { a: 1 }, evil: { x: {} } })
    assert.strictEqual(dirtyInputs.url, 'https://x.com')
    assert.strictEqual(ipcValidate.validateSettingValue({}).valid, false)
    assert.strictEqual(ipcValidate.validateSettingValue('ok'.repeat(6000)).valid, false)
    console.log('✓ Profile/proxy/setting/inputs payloads validated and sanitized')

    // 4. Plugin sandbox blocks Electron internals & local requires
    console.log('\n[Test 4] Automation plugin sandbox...')
    const evilDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ynsec-evil-'))
    tempDirs.push(evilDir)
    fs.writeFileSync(
      path.join(evilDir, 'main.js'),
      `const electron = require('electron'); module.exports = async () => ({ ok: true })`
    )
    await assert.rejects(
      () => Promise.resolve().then(() => loadPlugin(path.join(evilDir, 'main.js'))),
      /Electron internals/,
      'plugin requiring electron must be blocked'
    )
    fs.writeFileSync(
      path.join(evilDir, 'main.js'),
      `const cp = require('child_process'); module.exports = async () => ({ ok: true })`
    )
    await assert.rejects(
      () => Promise.resolve().then(() => loadPlugin(path.join(evilDir, 'main.js'))),
      /whitelisted modules/,
      'plugin requiring child_process must be blocked'
    )
    fs.writeFileSync(
      path.join(evilDir, 'main.js'),
      `module.exports = async ({ logger }) => { logger.info('sandbox works'); return { ok: true, message: 'done' } }`
    )
    const safeFn = loadPlugin(path.join(evilDir, 'main.js'))
    assert.strictEqual(typeof safeFn, 'function', 'safe plugin must load')
    fs.writeFileSync(path.join(evilDir, 'main.js'), `const fs = require('fs'); module.exports = async () => { fs.readFileSync(${JSON.stringify(__filename)}); return { ok: true } }`)
    const escapeFn = loadPlugin(path.join(evilDir, 'main.js'), ['filesystem'])
    await assert.rejects(() => escapeFn({}), /filesystem access denied/, 'plugin must not read app or other profile data')
    console.log('✓ Sandbox blocks Electron internals and non-whitelisted requires')

    // 5. Imported automation is disabled by default + permissions validated
    console.log('\n[Test 5] Import disables automation & manifest permissions...')
    const toolDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ynsec-tool-'))
    tempDirs.push(toolDir)
    fs.writeFileSync(
      path.join(toolDir, 'main.js'),
      `const fs = require('fs'); module.exports = async ({ logger }) => { logger.info('ok'); return { ok: true, message: 'ran' } }`
    )
    fs.writeFileSync(
      path.join(toolDir, 'manifest.json'),
      JSON.stringify({
        id: 'secure-demo-tool',
        name: 'Secure Demo',
        version: '1.0.0',
        description: 'Security test tool',
        entry: 'main.js',
        runModes: ['browser'],
        permissions: ['browser-page', 'downloads'],
        inputSchema: [],
      })
    )
    const imported = await automationManager.importTool(toolDir)
    importedToolId = imported.id
    assert.strictEqual(imported.enabled, false, 'imported automation must start disabled')
    const scanned = await automationManager.scanAutomations()
    const tool = scanned.find((t) => t.id === 'secure-demo-tool')
    assert(tool, 'imported tool must be scanned')
    assert.strictEqual(tool.enabled, false, 'tool must be disabled after import')
    assert.deepStrictEqual(tool.permissions, ['browser-page', 'downloads'], 'permissions must be surfaced')
    const badManifest = validateManifest(toolDir, {
      id: 'bad-perm',
      name: 'Bad',
      version: '1.0.0',
      description: 'd',
      entry: 'main.js',
      runModes: ['browser'],
      permissions: ['hack-all-the-things'],
    })
    assert.strictEqual(badManifest.valid, false, 'invalid permissions must be rejected')
    console.log('✓ Imported tools are disabled until explicitly enabled; permissions validated')

    // 6. Enabled plugin runs through the sandbox with whitelisted require
    console.log('\n[Test 6] Sandboxed plugin runs end-to-end...')
    await automationManager.setEnabled('secure-demo-tool', true)
    const profile = await createProfile({ name: 'Security Run', browser_type: 'chromium' })
    createdProfileIds.push(profile.id)
    const runResult = await automationManager.runTool('secure-demo-tool', profile.id, {})
    assert.strictEqual(runResult.ok, true, `plugin should run in sandbox: ${runResult.message}`)
    console.log('✓ Sandboxed plugin executed successfully using whitelisted fs/path')

    console.log('\n======================================================')
    console.log('🎉 ALL BƯỚC 23 APPLICATION SECURITY TESTS PASSED!')
    console.log('======================================================\n')
  } finally {
    await browserManager.closeAllProfiles().catch(() => {})
    await automationManager.removeTool(importedToolId).catch(() => {})
    for (const id of createdProfileIds) await deleteProfile(id, { deleteData: true }).catch(() => {})
    for (const id of createdProxyIds) await deleteProxy(id).catch(() => {})
    for (const d of tempDirs) {
      try { fs.rmSync(d, { recursive: true, force: true }) } catch { /* ignore */ }
    }
    closeDb()
  }
}

runStep26Tests().catch((err) => {
  console.error('\n❌ BƯỚC 23 TEST FAILED:', err)
  process.exit(1)
})
