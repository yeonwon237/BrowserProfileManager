const assert = require('assert')
const fs = require('fs')
const { getDb, closeDb } = require('../src/main/database')
const dataTools = require('../src/main/dataTools')
const profilesRepo = require('../src/main/database/profiles')

async function runTests() {
  console.log('=== STARTING BƯỚC 32: DATA TOOLS (BULK IMPORT/EXPORT) TESTS ===\n')

  const db = await getDb()
  db.run('DELETE FROM profiles')

  console.log('[Test 1] CSV parsing, column mapping & multi-level validation...')
  const sampleCsv = `name,group,tags,browser_type,locale,timezone,cookies,password
Account-Alpha,Marketing,fb;ads,chromium,en-US,America/New_York,stolen_cookie_123,supersecret123
Account-Beta,Affiliate,tiktok;viral,chrome,en-GB,Europe/London,cookie_val,pass_val
,InvalidGroup,tag1,chromium,en-US,America/New_York,,
Account-Gamma,Dev,api,safari_unsupported,vi-VN,Asia/Ho_Chi_Minh,,`

  const parsed = dataTools.parseAndValidateCsv(sampleCsv)
  assert.strictEqual(parsed.success, true)
  assert.strictEqual(parsed.totalRows, 4)
  assert.strictEqual(parsed.validCount, 2, 'Should have 2 strictly valid rows')
  assert.strictEqual(parsed.warnCount, 1, 'Should have 1 warning row (unsupported browser)')
  assert.strictEqual(parsed.invalidCount, 1, 'Should have 1 invalid row (missing name)')

  // Security Verification: Secrets must be stripped from parsed data
  const firstRow = parsed.rows[0].data
  assert.strictEqual(firstRow.name, 'Account-Alpha')
  assert.strictEqual(firstRow.cookies, undefined, 'Cookies must be stripped')
  assert.strictEqual(firstRow.password, undefined, 'Password must be stripped')
  const hostileMapping = dataTools.parseAndValidateCsv('name,evil\nSafe Name,payload', { 1: 'password' })
  assert.strictEqual(hostileMapping.rows[0].data.password, undefined, 'custom mapping must only accept approved profile fields')
  console.log('✓ CSV parser accurately maps columns, validates rows, and strips potential secret injections')

  console.log('\n[Test 2] Resilient partial import (skip invalid)...')
  const importRes = await dataTools.executeImport({
    rows: parsed.rows,
    workspaceId: 'default',
    skipInvalid: true,
  })

  assert.strictEqual(importRes.success, true)
  assert.strictEqual(importRes.importedCount, 3, 'Expected 3 imported profiles (2 valid + 1 warning)')
  assert.strictEqual(importRes.skippedCount, 1, 'Expected 1 skipped invalid row')
  const tampered = [{ rowIndex: 99, status: 'VALID', data: { name: '' } }]
  const tamperedResult = await dataTools.executeImport({ rows: tampered, skipInvalid: true })
  assert.strictEqual(tamperedResult.importedCount, 0, 'main process must revalidate renderer-supplied rows')

  const allProfiles = await profilesRepo.getAllProfiles()
  assert.strictEqual(allProfiles.length, 3)

  // Verify unique paths and configs
  const paths = new Set(allProfiles.map((p) => p.browser_data_path))
  assert.strictEqual(paths.size, 3, 'All imported profiles must have distinct storage directories')
  console.log('✓ Resilient import: imported 3 valid/warning profiles and skipped 1 invalid without crashing')

  console.log('\n[Test 3] Profile Data Export (JSON & CSV)...')
  const jsonExport = await dataTools.exportProfilesData({ format: 'json' })
  assert.strictEqual(jsonExport.count, 3)
  const parsedJson = JSON.parse(jsonExport.content)
  assert(Array.isArray(parsedJson))
  assert.strictEqual(parsedJson[0].name, 'Account-Alpha')

  // CSV Export
  const csvExport = await dataTools.exportProfilesData({ format: 'csv' })
  assert.strictEqual(csvExport.count, 3)
  assert(csvExport.content.includes('Account-Alpha'))
  assert(csvExport.content.includes('Account-Beta'))
  assert(!csvExport.content.includes('password'), 'Export content must not contain sensitive password fields')
  console.log('✓ Export: JSON and CSV exports generated cleanly without secret exposure')

  closeDb()
  console.log('\n======================================================')
  console.log('🎉 ALL BƯỚC 32 DATA TOOLS TESTS PASSED!')
  console.log('======================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err)
  process.exit(1)
})
