const assert = require('assert')
const fs = require('fs')
const { getDb, saveDb, closeDb } = require('../src/main/database')
const { createProfile, deleteProfile, getProfileById, updateProfile } = require('../src/main/database/profiles')
const binaryManager = require('../src/main/browser/binaryManager')
const browserManager = require('../src/main/browser/manager')
const adapter = require('../src/main/browser/adapter')

async function runStep22Tests() {
  console.log('=== STARTING BƯỚC 19: BROWSER BINARY & VERSION MANAGER TESTS ===\n')

  const createdProfileIds = []
  let customBinaryId = null

  try {
    await getDb()

    // 1. Scan Browsers — detect bundled Chromium, system Chrome, system Edge
    console.log('[Test 1] Scanning browser binaries (bundled + system)...')
    const scanned = await binaryManager.scanBrowsers({ probeVersions: true })
    const byId = new Map(scanned.map((b) => [b.id, b]))

    const bundledChromium = byId.get('bundled-chromium')
    assert(bundledChromium, 'bundled-chromium record must exist after scan')
    assert.strictEqual(bundledChromium.browser_type, 'chromium')
    assert.strictEqual(bundledChromium.source, 'bundled')
    assert(bundledChromium.executable_path, 'bundled chromium must have an executable path')
    assert(fs.existsSync(bundledChromium.executable_path), 'bundled chromium executable must exist on disk')
    assert(bundledChromium.version, 'bundled chromium must report a version')
    assert(bundledChromium.status === 'available' || bundledChromium.status === 'needs-update', `chromium status should be available/needs-update, got ${bundledChromium.status}`)
    console.log(`✓ Bundled Chromium detected: v${bundledChromium.version} (${bundledChromium.status})`)

    const systemChrome = byId.get('system-chrome')
    assert(systemChrome, 'system-chrome record must exist after scan')
    assert.strictEqual(systemChrome.source, 'system')
    if (systemChrome.executable_path) {
      assert(fs.existsSync(systemChrome.executable_path), 'chrome executable must exist when a path is reported')
    }
    console.log(`✓ Google Chrome detected: ${systemChrome.executable_path ? `v${systemChrome.version} (${systemChrome.status})` : `not installed (${systemChrome.status})`}`)

    const systemEdge = byId.get('system-msedge')
    assert(systemEdge, 'system-msedge record must exist after scan')
    assert.strictEqual(systemEdge.source, 'system')
    console.log(`✓ Microsoft Edge detected: ${systemEdge.executable_path ? `v${systemEdge.version} (${systemEdge.status})` : `not installed (${systemEdge.status})`}`)

    // Cross-platform assertion: status must be consistent with executable presence
    for (const b of scanned) {
      const exists = b.executable_path && fs.existsSync(b.executable_path)
      if (b.source !== 'custom') {
        if (!exists) {
          assert(b.status === 'missing' || b.status === 'needs-update', `${b.id} without executable must be missing/needs-update`)
        }
      }
    }
    console.log('✓ All detected binaries report executable existence consistently')

    // 2. getAllBinaries returns all stored records
    console.log('\n[Test 2] Reading stored binaries from the database...')
    const all = await binaryManager.getAllBinaries()
    assert(all.length >= 4, 'At least 4 binaries (bundled chromium/firefox, chrome, edge) should be stored')
    assert(all.every((b) => b.source_label && b.status_label), 'Binaries should expose human-readable labels')
    console.log(`✓ ${all.length} browser binary records stored`)

    // 3. resolveForProfile routes to the correct binary
    console.log('\n[Test 3] Resolving profile browser through BrowserBinaryManager...')
    const resolvedChromium = await binaryManager.resolveForProfile({ browser_type: 'chromium', browser_channel: null })
    assert(resolvedChromium, 'chromium profile must resolve to a binary')
    assert.strictEqual(resolvedChromium.browser_type, 'chromium')
    assert.strictEqual(resolvedChromium.engine, 'chromium')
    assert(fs.existsSync(resolvedChromium.executable_path), 'resolved executable must exist')

    const resolvedChrome = await binaryManager.resolveForProfile({ browser_type: 'chrome', browser_channel: 'chrome' })
    assert(resolvedChrome, 'chrome profile must resolve to a binary')
    assert.strictEqual(resolvedChrome.browser_type, 'chrome')
    console.log('✓ Profile browser resolution routed through BrowserBinaryManager')

    // 4. Browser does not exist -> profile status Warning (profile not deleted)
    console.log('\n[Test 4] Missing browser => profile status Warning (profile preserved)...')
    const db = await getDb()
    db.run("DELETE FROM browser_binaries WHERE id = 'bundled-firefox'")
    saveDb()

    const firefoxProfile = await createProfile({ name: 'Firefox Missing Browser', browser_type: 'firefox' })
    createdProfileIds.push(firefoxProfile.id)

    const changes = await binaryManager.refreshProfileBrowserStatuses()
    const warned = await getProfileById(firefoxProfile.id)
    assert.strictEqual(warned.status, 'warning', 'Profile using a missing browser must be marked warning')
    assert(changes.some((c) => c.id === firefoxProfile.id && c.status === 'warning'), 'refresh must report the warning change')
    console.log(`✓ Firefox profile flagged as Warning (${warned.status}) — profile still exists`)

    const unknownProfile = await createProfile({ name: 'Unknown Browser', browser_type: 'quantum_engine_x' })
    createdProfileIds.push(unknownProfile.id)
    await binaryManager.refreshProfileBrowserStatuses()
    const unknown = await getProfileById(unknownProfile.id)
    assert.strictEqual(unknown.status, 'warning', 'Unknown browser must resolve to warning')
    console.log('✓ Unknown/unregistered browser also produces Warning status')

    // 5. Change profile browser -> opens again (Edit Profile flow at data level)
    console.log('\n[Test 5] Switching profile browser to Chromium and reopening...')
    await updateProfile(firefoxProfile.id, { browser_type: 'chromium', browser_channel: null })
    await binaryManager.refreshProfileBrowserStatuses()
    const switched = await getProfileById(firefoxProfile.id)
    assert.strictEqual(switched.status, 'idle', 'Profile must return to idle once browser is available')

    await browserManager.openProfile(switched, { headless: true })
    const entry = browserManager.getEntry(switched.id)
    assert(entry && entry.context, 'Browser context must launch after switching browser')
    const page = entry.context.pages()[0] || (await entry.context.newPage())
    await page.goto('data:text/html,<html><title>Reopened</title></html>')
    assert.strictEqual(await page.title(), 'Reopened')
    await browserManager.closeProfile(switched.id)
    console.log('✓ Profile reopened successfully after switching browser engine')

    // 6. Adapter launch uses the resolved executable path (not an internal search)
    console.log('\n[Test 6] Verifying BrowserAdapter launches via the resolved binary...')
    const chromeProfile = await createProfile({ name: 'Chrome Launch', browser_type: 'chrome', browser_channel: 'chrome' })
    createdProfileIds.push(chromeProfile.id)
    if (binaryManager.isResolvable(await binaryManager.resolveForProfile(chromeProfile))) {
      await browserManager.openProfile(chromeProfile, { headless: true })
      const chromeEntry = browserManager.getEntry(chromeProfile.id)
      assert(chromeEntry, 'Chrome profile must launch')
      await browserManager.closeProfile(chromeProfile.id)
      console.log('✓ Chrome profile launched via resolved binary path')
    } else {
      console.log('— Chrome not installed; skipped launch (still validates resolution logic)')
    }

    // 7. Custom browser add / remove / protection
    console.log('\n[Test 7] Custom browser management...')
    const chromePath = resolvedChrome.executable_path
    assert(chromePath && fs.existsSync(chromePath), 'Need a real executable for the custom browser test')
    const custom = await binaryManager.addCustomBrowser({
      name: 'Custom Chrome Nightly',
      browser_type: 'chrome',
      executable_path: chromePath,
    })
    customBinaryId = custom.id
    assert(custom.source === 'custom', 'New record must be marked as custom source')
    assert(custom.status === 'available' || custom.status === 'unsupported', `custom status must be available/unsupported, got ${custom.status}`)
    assert(custom.executable_path === chromePath)
    console.log(`✓ Custom browser added: ${custom.name} (${custom.status})`)

    const removal = await binaryManager.removeCustomBrowser(custom.id)
    assert.strictEqual(removal.success, true, 'Custom browser record must be removable')
    customBinaryId = null
    assert.strictEqual(await binaryManager.getBinaryById(custom.id), null, 'Record must be gone after removal')

    const blocked = await binaryManager.removeCustomBrowser('system-chrome')
    assert.strictEqual(blocked.success, false, 'System browser record must NOT be removable')
    console.log('✓ Custom browser remove works; system records are protected from removal')

    // 8. detectInstalledEngines (adapter) delegates to the binary manager
    console.log('\n[Test 8] Adapter engine detection delegates to BrowserBinaryManager...')
    const engines = await adapter.detectInstalledEngines(true)
    assert(engines.length === 4, 'Adapter must expose chromium, chrome, msedge, firefox')
    const chromiumEngine = engines.find((e) => e.id === 'chromium')
    assert(chromiumEngine.available === (bundledChromium.status === 'available'))
    assert(chromiumEngine.executable_path, 'Engine detection must include the executable path')
    console.log('✓ Adapter engine detection now sourced from BrowserBinaryManager')

    console.log('\n======================================================')
    console.log('🎉 ALL BƯỚC 19 BROWSER BINARY MANAGER TESTS PASSED!')
    console.log('======================================================\n')
  } finally {
    await browserManager.closeAllProfiles().catch(() => {})
    for (const id of createdProfileIds) {
      await deleteProfile(id, { deleteData: true }).catch(() => {})
    }
    if (customBinaryId) {
      await binaryManager.removeCustomBrowser(customBinaryId).catch(() => {})
    }
    closeDb()
  }
}

runStep22Tests().catch((err) => {
  console.error('\n❌ BƯỚC 19 TEST FAILED:', err)
  process.exit(1)
})