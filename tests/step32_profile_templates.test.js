const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { getDb, closeDb } = require('../src/main/database')
const templatesRepo = require('../src/main/database/templates')
const profilesRepo = require('../src/main/database/profiles')
const browserManager = require('../src/main/browser/manager')

async function runTests() {
  console.log('=== STARTING BƯỚC 28: PROFILE TEMPLATES TESTS ===\n')

  const db = await getDb()
  db.run('DELETE FROM profiles')
  db.run('DELETE FROM profile_templates')

  console.log('[Test 1] Template CRUD & configuration storage...')
  const template1 = await templatesRepo.createTemplate({
    id: 'tmpl-desktop-chrome',
    name: 'Desktop Chrome USA',
    description: 'High-res desktop template with US locale',
    workspace_id: 'default',
    browser_type: 'chrome',
    browser_channel: 'chrome',
    environment: {
      locale: 'en-US',
      timezone: 'America/New_York',
      viewport: { width: 1920, height: 1080 },
    },
    tags: ['desktop', 'automation', 'us'],
    group_name: 'Farming Accounts',
    notes_template: 'Created via automated template pipeline',
  })

  assert(template1, 'Template must be created')
  assert.strictEqual(template1.name, 'Desktop Chrome USA')
  assert.strictEqual(template1.browser_type, 'chrome')
  assert.strictEqual(template1.environment.locale, 'en-US')
  assert.deepStrictEqual(template1.tags, ['desktop', 'automation', 'us'])

  // Verify template does NOT have sensitive runtime keys
  assert.strictEqual(template1.cookies, undefined)
  assert.strictEqual(template1.session_state, undefined)
  assert.strictEqual(template1.browser_data_path, undefined)

  // Update
  const updated = await templatesRepo.updateTemplate(template1.id, {
    description: 'Updated template description',
  })
  assert.strictEqual(updated.description, 'Updated template description')

  // Duplicate
  const duplicated = await templatesRepo.duplicateTemplate(template1.id, { name: 'Desktop Chrome UK' })
  assert(duplicated.id !== template1.id, 'Duplicated template must have new UUID')
  assert.strictEqual(duplicated.name, 'Desktop Chrome UK')
  assert.strictEqual(duplicated.browser_type, 'chrome')
  console.log('✓ Template CRUD, duplicate and config storage working properly')

  console.log('\n[Test 2] Create template from profile (Sanitization verification)...')
  const originalProfile = await profilesRepo.createProfile({
    name: 'Source Profile with Session',
    browser_type: 'firefox',
    environment: { locale: 'fr-FR', timezone: 'Europe/Paris' },
    tags: ['source-tag'],
    group: 'Source Group',
    notes: 'Secret account credentials and notes',
  })

  // Pretend session files exist in profile directory
  const profileDir = originalProfile.browser_data_path
  fs.mkdirSync(profileDir, { recursive: true })
  fs.writeFileSync(path.join(profileDir, 'Cookies'), 'dummy-cookie-binary-data')

  const tmplFromProfile = await templatesRepo.createTemplateFromProfile(originalProfile.id, {
    name: 'Sanitized Firefox Template',
  })

  assert.strictEqual(tmplFromProfile.browser_type, 'firefox')
  assert.strictEqual(tmplFromProfile.environment.locale, 'fr-FR')
  assert.strictEqual(tmplFromProfile.browser_data_path, undefined)
  assert.strictEqual(tmplFromProfile.cookies, undefined)
  console.log('✓ Template created from profile with configuration copied and zero session data leak')

  console.log('\n[Test 3] Create single profile from template...')
  const newProfile = await templatesRepo.createProfileFromTemplate(template1.id, {
    name: 'Instantiated Profile 1',
  })

  assert(newProfile, 'New profile must be instantiated')
  assert.strictEqual(newProfile.name, 'Instantiated Profile 1')
  assert.strictEqual(newProfile.browser_type, 'chrome')
  assert.strictEqual(newProfile.environment.locale, 'en-US')
  assert(newProfile.browser_data_path, 'Must have distinct browser_data_path')
  assert(newProfile.id !== originalProfile.id)
  assert(!fs.existsSync(path.join(newProfile.browser_data_path, 'Cookies')), 'New profile must have clean session storage')
  console.log('✓ Profile cleanly created from template with fresh UUID and isolated data path')

  console.log('\n[Test 4] Bulk create 20 profiles with name pattern...')
  const initialRunningCount = browserManager.getRunningProfiles().length

  const bulkResult = await templatesRepo.bulkCreateProfiles({
    templateId: template1.id,
    count: 20,
    namePattern: 'Account-{number}',
    workspaceId: 'default',
  })

  assert.strictEqual(bulkResult.created, 20, 'Expected 20 created profiles')
  assert.strictEqual(bulkResult.profiles.length, 20)

  // Verify naming pattern
  assert.strictEqual(bulkResult.profiles[0].name, 'Account-001')
  assert.strictEqual(bulkResult.profiles[1].name, 'Account-002')
  assert.strictEqual(bulkResult.profiles[19].name, 'Account-020')

  // Verify all 20 profiles have unique IDs and unique browser_data_path
  const ids = new Set(bulkResult.profiles.map((p) => p.id))
  const paths = new Set(bulkResult.profiles.map((p) => p.browser_data_path))
  assert.strictEqual(ids.size, 20, 'All 20 profiles must have unique IDs')
  assert.strictEqual(paths.size, 20, 'All 20 profiles must have unique browser data paths')

  // Verify no browser was launched during bulk creation
  const afterRunningCount = browserManager.getRunningProfiles().length
  assert.strictEqual(afterRunningCount, initialRunningCount, 'No browser should be launched during bulk creation')
  console.log('✓ Bulk created 20 profiles (Account-001 to Account-020) with strict isolation and zero browser launch')

  console.log('\n[Test 5] Custom, random and explicit-list bulk creation...')
  const customResult = await templatesRepo.bulkCreateProfiles({
    count: 3,
    namingMode: 'random',
    namePattern: 'Ngẫu nhiên',
    browserType: 'firefox',
    groupName: 'Nhóm tùy chỉnh',
    tags: ['tạo-hàng-loạt'],
  })
  assert.strictEqual(customResult.created, 3)
  assert(customResult.profiles.every((profile) => profile.name.startsWith('Ngẫu nhiên-')))
  assert(customResult.profiles.every((profile) => profile.browser_type === 'firefox'))
  assert.strictEqual(new Set(customResult.profiles.map((profile) => profile.name)).size, 3)

  const listResult = await templatesRepo.bulkCreateProfiles({
    namingMode: 'list',
    customNames: ['Hồ sơ Hà Nội', 'Hồ sơ Đà Nẵng', 'Hồ sơ Sài Gòn'],
    browserType: 'chromium',
  })
  assert.deepStrictEqual(listResult.profiles.map((profile) => profile.name), ['Hồ sơ Hà Nội', 'Hồ sơ Đà Nẵng', 'Hồ sơ Sài Gòn'])
  console.log('✓ Custom configuration, random names and explicit name lists work without a template')

  closeDb()
  console.log('\n======================================================')
  console.log('🎉 ALL BƯỚC 28 PROFILE TEMPLATES TESTS PASSED!')
  console.log('======================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err)
  process.exit(1)
})
