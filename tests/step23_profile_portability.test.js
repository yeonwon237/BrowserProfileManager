const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const AdmZip = require('adm-zip')
const { getDb, closeDb } = require('../src/main/database')
const { createProfile, deleteProfile, getProfileById, getAllProfiles } = require('../src/main/database/profiles')
const { createProxy, deleteProxy } = require('../src/main/database/proxies')
const { getLogs } = require('../src/main/database/logs')
const { getBrowserDataPath } = require('../src/shared/paths')
const portability = require('../src/main/portability')

async function runStep23Tests() {
  console.log('=== STARTING BƯỚC 20: PROFILE PORTABILITY (EXPORT / IMPORT V2) TESTS ===\n')

  const createdProfileIds = []
  const createdProxyIds = []
  const tempFiles = []
  let proxyId = null

  try {
    // 1. Build a source environment: profiles with groups/tags/proxy/browser data
    console.log('[Test 1] Creating source profiles, proxy & browser data...')
    const proxy = await createProxy({
      name: 'Portable US Proxy',
      protocol: 'http',
      host: '198.51.100.77',
      port: 8080,
      username: 'portuser',
      password: 'supersecretproxy-password',
      country_code: 'US',
      country_name: 'United States',
      city: 'New York',
      timezone: 'America/New_York',
    })
    proxyId = proxy.id
    createdProxyIds.push(proxy.id)

    const profileA = await createProfile({
      name: 'Alpha',
      browser_type: 'chromium',
      group: 'Social',
      tags: ['facebook', 'ads'],
      proxy_id: proxy.id,
      notes: 'main account',
      environment: { mode: 'custom', locale: 'en-US', timezone: 'America/New_York' },
    })
    const profileB = await createProfile({
      name: 'Beta',
      browser_type: 'chrome',
      browser_channel: 'chrome',
      group: 'Market',
      tags: ['tiktok'],
    })
    createdProfileIds.push(profileA.id, profileB.id)

    fs.writeFileSync(path.join(getBrowserDataPath(profileA.id), 'Preferences'), '{"port":"test"}')
    fs.mkdirSync(path.join(getBrowserDataPath(profileA.id), 'Default'), { recursive: true })
    fs.writeFileSync(path.join(getBrowserDataPath(profileA.id), 'Default', 'Cookies'), 'session-bytes')
    console.log(`✓ Source ready: ${profileA.name}, ${profileB.name} (+ browser data on Alpha)`)

    // 2. Export with all components
    console.log('\n[Test 2] Exporting profiles with all components...')
    const dest = path.join(os.tmpdir(), `ynlogin-port-${Date.now()}.zip`)
    tempFiles.push(dest)
    const exportResult = await portability.exportProfiles({
      profileIds: [profileA.id, profileB.id],
      options: { includeGroups: true, includeTags: true, includeProxies: true, includeAutomations: true, includeBrowserData: true },
      destPath: dest,
    })
    assert.strictEqual(exportResult.profiles, 2)
    assert(exportResult.includedComponents.includes('browser-data'))
    console.log(`✓ Exported ${exportResult.profiles} profiles (${exportResult.fileSize} bytes)`)

    // 3. Manifest structure & no secrets
    console.log('\n[Test 3] Validating manifest structure and secret-free content...')
    const zip = new AdmZip(dest)
    const manifest = JSON.parse(zip.getEntry('manifest.json').getData().toString())
    assert.strictEqual(manifest.type, portability.PACKAGE_TYPE)
    assert.strictEqual(manifest.export_version, 1)
    assert(manifest.app_version, 'manifest must include app_version')
    assert(manifest.exported_at, 'manifest must include exported_at')
    assert(Array.isArray(manifest.profiles) && manifest.profiles.length === 2, 'manifest must list profiles')
    assert(Array.isArray(manifest.included_components) && manifest.included_components.includes('settings'))
    assert.strictEqual(manifest.profiles[0].id, profileA.id)
    console.log('✓ manifest.json has export_version, app_version, exported_at, profiles, included_components')

    const raw = zip.getEntries().map((e) => e.getData().toString('utf8')).join('\n')
    assert(!raw.includes('supersecretproxy-password'), 'Proxy password must never be exported')
    assert(!raw.includes('session-bytes') || manifest.included_components.includes('browser-data'), 'browser data only present when opted-in')
    const proxyConfigs = JSON.parse(zip.getEntry('configs/proxies.json').getData().toString())
    assert.strictEqual(proxyConfigs[0].id, proxy.id)
    assert(!('password' in proxyConfigs[0]) && !('encrypted_password' in proxyConfigs[0]), 'proxy config must not include password')
    console.log('✓ No proxy passwords / secrets exported')

    const browserDataPresent = zip.getEntries().some((e) => e.entryName.startsWith(`optional-browser-data/${profileA.id}/browser-data/`))
    assert(browserDataPresent, 'browser data must be present in export')
    console.log('✓ Browser data packaged under optional-browser-data/')

    // 4. Corrupt package must not crash the app
    console.log('\n[Test 4] Corrupt package does not crash...')
    const badFile = path.join(os.tmpdir(), `bad-${Date.now()}.zip`)
    tempFiles.push(badFile)
    fs.writeFileSync(badFile, 'this is definitely not a zip archive')
    const corrupt = await portability.importProfiles(badFile, 'generate-new')
    assert.strictEqual(corrupt.success, false)
    assert(corrupt.error, 'corrupt import must return a friendly error')
    const wrongType = path.join(os.tmpdir(), `wrong-${Date.now()}.zip`)
    tempFiles.push(wrongType)
    const wz = new AdmZip()
    wz.addFile('manifest.json', Buffer.from(JSON.stringify({ type: 'not-a-portable' })))
    wz.writeZip(wrongType)
    const wrongManifest = await portability.importProfiles(wrongType, 'generate-new')
    assert.strictEqual(wrongManifest.success, false)
    console.log('✓ Corrupt / wrong-type packages rejected without crashing')

    // 5. Import into fresh profiles (generate-new on ID conflict)
    console.log('\n[Test 5] Importing with Generate New ID strategy...')
    const report = await portability.importProfiles(dest, 'generate-new')
    assert.strictEqual(report.success, true)
    assert.strictEqual(report.imported.length, 2)
    assert.strictEqual(report.generatedNewIds.length, 2, 'conflicting ids must be regenerated')
    const newAlpha = await getProfileById(report.imported[0])
    const newBeta = await getProfileById(report.imported[1])
    assert.notStrictEqual(newAlpha.id, profileA.id)
    assert.strictEqual(newAlpha.group_name, 'Social', 'group must be restored')
    assert.deepStrictEqual(newAlpha.tags, ['facebook', 'ads'], 'tags must be restored')
    assert(newAlpha.proxy_id, 'proxy reference must be restored')
    const restoredProxy = await getProfileById(report.imported[0])
    assert(restoredProxy.proxy && restoredProxy.proxy.host === '198.51.100.77', 'proxy reference must resolve')
    assert.strictEqual(newBeta.group_name, 'Market')
    const bdAlpha = getBrowserDataPath(newAlpha.id)
    assert(fs.existsSync(path.join(bdAlpha, 'Preferences')), 'browser data must be restored to new profile dir')
    assert(fs.existsSync(path.join(bdAlpha, 'Default', 'Cookies')), 'nested browser data must be restored')
    console.log('✓ Profiles imported as new IDs with groups, tags, proxy refs and browser data')

    // 6. Skip strategy
    console.log('\n[Test 6] Skip strategy for conflicts...')
    const skipReport = await portability.importProfiles(dest, 'skip')
    assert.strictEqual(skipReport.skipped.length, 2)
    assert.strictEqual(skipReport.imported.length, 0)
    console.log('✓ Existing profiles skipped on conflict')

    // 7. Replace-config preserves browser data (never silently replaced)
    console.log('\n[Test 7] Replace Configuration preserves browser data...')
    const markerFile = path.join(getBrowserDataPath(profileA.id), 'Existing-Session')
    fs.writeFileSync(markerFile, 'ORIGINAL-SESSION')
    const replaceReport = await portability.importProfiles(dest, 'replace-config')
    assert.strictEqual(replaceReport.replaced.length, 2, 'both conflicting profiles replaced')
    assert(fs.existsSync(markerFile) && fs.readFileSync(markerFile, 'utf8') === 'ORIGINAL-SESSION', 'browser data must never be silently overwritten')
    const updatedAlpha = await getProfileById(profileA.id)
    assert.strictEqual(updatedAlpha.notes, 'main account', 'config replaced')
    console.log('✓ Replace-config updated configuration but preserved browser data')

    // 8. ask strategy returns conflicts without importing
    console.log('\n[Test 8] Ask strategy surfaces conflicts...')
    const ask = await portability.importProfiles(dest, 'ask')
    assert.strictEqual(ask.needsDecision, true)
    assert(ask.conflicts.length >= 2)
    console.log('✓ Ask strategy returned conflicting profile ids for user decision')

    // 9. Configuration-only package creates fresh browser data dir
    console.log('\n[Test 9] Config-only import creates fresh browser data...')
    const configOnlyZip = path.join(os.tmpdir(), `config-only-${Date.now()}.zip`)
    tempFiles.push(configOnlyZip)
    const cz = new AdmZip(dest)
    for (const entry of cz.getEntries()) {
      if (entry.entryName.startsWith('optional-browser-data/')) cz.deleteFile(entry.entryName)
    }
    cz.writeZip(configOnlyZip)
    const configOnly = await portability.importProfiles(configOnlyZip, 'generate-new')
    const freshProfile = await getProfileById(configOnly.imported[0])
    assert(fs.existsSync(getBrowserDataPath(freshProfile.id)), 'fresh browser data dir must exist')
    console.log('✓ Config-only import created a fresh browser data directory')

    // 10. Import is fully logged without secrets
    console.log('\n[Test 10] Import operations are logged without secrets...')
    const logs = await getLogs(200)
    const importLogs = logs.filter((l) => l.action === 'profile-import')
    assert(importLogs.length >= 5, `expected import logs, got ${importLogs.length}`)
    const logText = importLogs.map((l) => l.message).join('\n')
    assert(!logText.includes('supersecretproxy-password'), 'logs must not contain proxy password')
    console.log(`✓ ${importLogs.length} import log entries recorded, secret-free`)

    console.log('\n======================================================')
    console.log('🎉 ALL BƯỚC 20 PROFILE PORTABILITY TESTS PASSED!')
    console.log('======================================================\n')
  } finally {
    for (const id of createdProfileIds) await deleteProfile(id, { deleteData: true }).catch(() => {})
    for (const id of createdProxyIds) await deleteProxy(id).catch(() => {})
    for (const f of tempFiles) {
      try { fs.rmSync(f, { force: true }) } catch { /* ignore */ }
    }
    closeDb()
  }
}

runStep23Tests().catch((err) => {
  console.error('\n❌ BƯỚC 20 TEST FAILED:', err)
  process.exit(1)
})