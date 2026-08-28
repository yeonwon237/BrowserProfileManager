const assert = require('assert')
const { getDb, closeDb } = require('../src/main/database')
const presetsRepo = require('../src/main/database/presets')
const { createProfile, getProfileById, deleteProfile, updateProfile } = require('../src/main/database/profiles')
const browserManager = require('../src/main/browser/manager')

async function runStep13Tests() {
  console.log('=== STARTING BƯỚC 13: ENVIRONMENT PRESETS TESTS ===\n')

  let createdProfileIds = []
  let createdPresetIds = []

  try {
    // 1. Test Default Seeding
    console.log('[Test 1] Testing Default Presets Initialization...')
    const db = await getDb()
    const allPresets = await presetsRepo.getAllPresets()
    console.log('Default presets found:', allPresets.map((p) => p.name).join(' | '))
    assert(Array.isArray(allPresets) && allPresets.length >= 4, 'Should have at least 4 default presets seeded')
    
    const winPreset = allPresets.find((p) => p.id === 'preset-win-std')
    assert(winPreset, 'Desktop Windows Standard preset must exist')
    assert.strictEqual(winPreset.locale, 'en-US')
    assert.strictEqual(winPreset.viewport_width, 1920)

    // 2. Test Preset CRUD Operations
    console.log('\n[Test 2] Testing Preset CRUD Operations (Create, Update, Duplicate, Delete)...')
    let customPreset = await presetsRepo.createPreset({
      name: 'UK E-Commerce London',
      description: 'London timezone, British English, 1080p resolution',
      platform: 'macos',
      browser_type: 'chrome',
      locale: 'en-GB',
      timezone_mode: 'custom',
      timezone: 'Europe/London',
      languages: ['en-GB', 'en-US', 'en'],
      viewport_width: 1920,
      viewport_height: 1080,
      device_scale_factor: 2.0,
      color_scheme: 'dark',
      reduced_motion: 'no-preference',
    })
    assert(customPreset && customPreset.id, 'Custom preset should be created')
    createdPresetIds.push(customPreset.id)
    assert.strictEqual(customPreset.locale, 'en-GB')
    assert.strictEqual(customPreset.timezone, 'Europe/London')

    // Update preset
    customPreset = await presetsRepo.updatePreset(customPreset.id, {
      description: 'Updated London workspace description',
      viewport_width: 1440,
      viewport_height: 900,
    })
    assert.strictEqual(customPreset.viewport_width, 1440)
    assert.strictEqual(customPreset.viewport_height, 900)

    // Duplicate preset
    const duplicated = await presetsRepo.duplicatePreset(customPreset.id, { name: 'UK E-Commerce (Clone)' })
    assert(duplicated && duplicated.id, 'Duplicated preset should exist')
    createdPresetIds.push(duplicated.id)
    assert.strictEqual(duplicated.name, 'UK E-Commerce (Clone)')
    assert.strictEqual(duplicated.locale, 'en-GB')

    // Delete duplicated preset
    await presetsRepo.deletePreset(duplicated.id)
    const afterDelete = await presetsRepo.getPresetById(duplicated.id)
    assert.strictEqual(afterDelete, null, 'Duplicated preset should be deleted')
    console.log('✓ Preset CRUD operations verified')

    // 3. Test Applying Preset to Profile
    console.log('\n[Test 3] Applying Preset to a Profile...')
    const profileA = await createProfile({
      name: 'Profile London Account',
      browser_type: customPreset.browser_type,
      environment: {
        mode: 'custom',
        locale: customPreset.locale,
        timezone: customPreset.timezone,
        languages: customPreset.languages,
        viewport: { width: customPreset.viewport_width, height: customPreset.viewport_height },
        deviceScaleFactor: customPreset.device_scale_factor,
        colorScheme: customPreset.color_scheme,
        reducedMotion: customPreset.reduced_motion,
      },
      tags: ['preset-test'],
    })
    assert(profileA && profileA.id, 'Profile A should be created from preset template')
    createdProfileIds.push(profileA.id)

    const fetchedProfileA = await getProfileById(profileA.id)
    assert.strictEqual(fetchedProfileA.environment.locale, 'en-GB')
    assert.strictEqual(fetchedProfileA.environment.timezone, 'Europe/London')
    assert.strictEqual(fetchedProfileA.environment.viewport.width, 1440)
    assert.strictEqual(fetchedProfileA.environment.viewport.height, 900)
    console.log('✓ Preset template successfully applied to Profile A')

    // 4. Test Independence Guarantee: Modifying Preset later does NOT affect existing profiles
    console.log('\n[Test 4] Verifying Independence Guarantee (Modifying preset does not affect profile)...')
    await presetsRepo.updatePreset(customPreset.id, {
      locale: 'fr-FR',
      timezone: 'Europe/Paris',
      viewport_width: 1280,
      viewport_height: 720,
    })

    const profileAAfterPresetChange = await getProfileById(profileA.id)
    assert.strictEqual(profileAAfterPresetChange.environment.locale, 'en-GB', 'Profile A locale must remain en-GB')
    assert.strictEqual(profileAAfterPresetChange.environment.timezone, 'Europe/London', 'Profile A timezone must remain Europe/London')
    assert.strictEqual(profileAAfterPresetChange.environment.viewport.width, 1440, 'Profile A viewport width must remain 1440')
    console.log('✓ Independence guarantee verified: profile environment is immutable to future preset edits')

    // 5. Test "Reset to System Defaults"
    console.log('\n[Test 5] Testing "Reset to System Defaults"...')
    await updateProfile(profileA.id, {
      environment: { mode: 'default' },
    })
    const resetProfile = await getProfileById(profileA.id)
    assert.strictEqual(resetProfile.environment.mode, 'default', 'Profile should be reset to default mode')
    console.log('✓ Reset to system defaults verified')

    // 6. Test In-Browser Execution of Profile Configured with Preset
    console.log('\n[Test 6] Testing In-Browser Execution from Tokyo Preset...')
    const tokyoPreset = allPresets.find((p) => p.id === 'preset-tokyo-compact')
    const profileTokyo = await createProfile({
      name: 'Profile Tokyo Test',
      browser_type: 'chromium',
      environment: {
        mode: 'custom',
        locale: tokyoPreset.locale,
        timezone: tokyoPreset.timezone,
        languages: tokyoPreset.languages,
        viewport: { width: tokyoPreset.viewport_width, height: tokyoPreset.viewport_height },
        deviceScaleFactor: tokyoPreset.device_scale_factor,
        colorScheme: tokyoPreset.color_scheme,
        reducedMotion: tokyoPreset.reduced_motion,
      },
    })
    createdProfileIds.push(profileTokyo.id)

    const launchRes = await browserManager.openProfile(profileTokyo)
    assert(launchRes.success, 'Profile Tokyo must launch successfully')

    const entry = browserManager.getEntry(profileTokyo.id)
    const page = entry.context.pages()[0] || (await entry.context.newPage())
    await page.goto('data:text/html,<html><head><title>Tokyo Preset</title></head><body><h1>Preset Test</h1></body></html>')

    const detectedLocale = await page.evaluate(() => navigator.language)
    const detectedTz = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
    const detectedViewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))

    console.log(`Detected in browser -> Locale: ${detectedLocale} | Timezone: ${detectedTz} | Viewport: ${detectedViewport.width}x${detectedViewport.height}`)

    assert.strictEqual(detectedLocale, 'ja-JP', 'Browser locale must match preset ja-JP')
    assert.strictEqual(detectedTz, 'Asia/Tokyo', 'Browser timezone must match preset Asia/Tokyo')
    assert.strictEqual(detectedViewport.width, 1280, 'Browser viewport width must match preset 1280')
    assert.strictEqual(detectedViewport.height, 720, 'Browser viewport height must match preset 720')

    await browserManager.closeProfile(profileTokyo.id)
    console.log('✓ In-browser execution of preset configuration verified')

    console.log('\n======================================================')
    console.log('🎉 ALL BƯỚC 13 TESTS PASSED SUCCESSFULLY WITH ZERO ERRORS!')
    console.log('======================================================\n')
  } finally {
    for (const id of createdProfileIds) {
      await deleteProfile(id, { deleteData: true }).catch(() => {})
    }
    for (const id of createdPresetIds) {
      await presetsRepo.deletePreset(id).catch(() => {})
    }
    closeDb()
  }
}

runStep13Tests().catch((err) => {
  console.error('\n❌ STEP 13 TEST FAILED:', err)
  process.exit(1)
})
