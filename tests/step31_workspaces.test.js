const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { getDb, closeDb } = require('../src/main/database')
const workspacesRepo = require('../src/main/database/workspaces')
const profilesRepo = require('../src/main/database/profiles')
const proxiesRepo = require('../src/main/database/proxies')

async function runTests() {
  console.log('=== STARTING BƯỚC 27: WORKSPACE MANAGEMENT TESTS ===\n')

  const db = await getDb()
  db.run('DELETE FROM profiles')
  db.run('DELETE FROM proxies')
  db.run("DELETE FROM workspaces WHERE id != 'default'")

  console.log('[Test 1] Default workspace existence and guardrails...')
  const defaultWs = await workspacesRepo.getWorkspaceById('default')
  assert(defaultWs, 'Default workspace must exist')
  assert.strictEqual(defaultWs.is_default, true, 'Default workspace must have is_default=true')

  // Guard: cannot archive default workspace
  let archiveFailed = false
  try {
    await workspacesRepo.archiveWorkspace('default', true)
  } catch (err) {
    archiveFailed = true
  }
  assert(archiveFailed, 'Archiving default workspace must fail')

  // Guard: cannot delete default workspace
  let deleteDefaultFailed = false
  try {
    await workspacesRepo.deleteWorkspace('default')
  } catch (err) {
    deleteDefaultFailed = true
  }
  assert(deleteDefaultFailed, 'Deleting default workspace must fail')
  console.log('✓ Default workspace initialized with protection guardrails')

  console.log('\n[Test 2] Workspace CRUD & duplication...')
  const wsA = await workspacesRepo.createWorkspace({
    id: 'ws-marketing',
    name: 'Marketing Campaigns',
    description: 'Profiles for social media marketing',
    default_browser_settings: { browser_type: 'chrome', viewport: { width: 1440, height: 900 } },
  })
  assert.strictEqual(wsA.id, 'ws-marketing')
  assert.strictEqual(wsA.name, 'Marketing Campaigns')
  assert.strictEqual(wsA.default_browser_settings.browser_type, 'chrome')

  const wsB = await workspacesRepo.createWorkspace({
    id: 'ws-testing',
    name: 'QA Testing',
    description: 'Profiles for automated testing',
  })
  assert.strictEqual(wsB.id, 'ws-testing')

  // Update
  const updatedA = await workspacesRepo.updateWorkspace(wsA.id, {
    name: 'Global Marketing Hub',
    description: 'Updated marketing description',
  })
  assert.strictEqual(updatedA.name, 'Global Marketing Hub')

  // Duplicate
  const dupA = await workspacesRepo.duplicateWorkspace(wsA.id, { name: 'Marketing Staging' })
  assert(dupA.id !== wsA.id, 'Duplicated workspace must have unique ID')
  assert.strictEqual(dupA.name, 'Marketing Staging')
  assert.strictEqual(dupA.default_browser_settings.browser_type, 'chrome')

  // Archive
  await workspacesRepo.archiveWorkspace(wsB.id, true)
  const activeList = await workspacesRepo.getAllWorkspaces({ includeArchived: false })
  assert(!activeList.some((w) => w.id === wsB.id), 'Archived workspace must not appear in active list')
  const allList = await workspacesRepo.getAllWorkspaces({ includeArchived: true })
  assert(allList.some((w) => w.id === wsB.id), 'Archived workspace must appear when includeArchived=true')
  console.log('✓ Workspace CRUD, duplicate and archive behave correctly')

  console.log('\n[Test 3] Profile isolation across workspaces...')
  for (let i = 1; i <= 8; i++) {
    await profilesRepo.createProfile({
      name: `Marketing Profile ${i}`,
      workspace_id: 'ws-marketing',
      browser_type: 'chromium',
    })
  }
  for (let i = 1; i <= 4; i++) {
    await profilesRepo.createProfile({
      name: `Default Profile ${i}`,
      workspace_id: 'default',
      browser_type: 'chromium',
    })
  }

  const mktProfiles = await profilesRepo.getAllProfiles({ workspace_id: 'ws-marketing' })
  assert.strictEqual(mktProfiles.length, 8, `Expected 8 marketing profiles, got ${mktProfiles.length}`)

  const defProfiles = await profilesRepo.getAllProfiles({ workspace_id: 'default' })
  assert.strictEqual(defProfiles.length, 4, `Expected 4 default profiles, got ${defProfiles.length}`)

  const allProfiles = await profilesRepo.getAllProfiles()
  assert.strictEqual(allProfiles.length, 12, `Expected 12 total profiles, got ${allProfiles.length}`)
  console.log('✓ Profile isolation: queries strictly filter by workspace_id')

  console.log('\n[Test 4] Proxy inheritance & workspace assignment...')
  const globalProxy = await proxiesRepo.createProxy({
    name: 'Global Residential Proxy',
    protocol: 'http',
    host: 'proxy.global.com',
    port: 8080,
    workspace_id: null,
  })
  const mktProxy = await proxiesRepo.createProxy({
    name: 'Marketing Dedicated Proxy',
    protocol: 'http',
    host: 'proxy.marketing.com',
    port: 8080,
    workspace_id: 'ws-marketing',
  })

  const mktProxies = await proxiesRepo.getAllProxies({ workspace_id: 'ws-marketing' })
  assert.strictEqual(mktProxies.length, 2, `Expected 2 proxies for marketing, got ${mktProxies.length}`)

  const defProxies = await proxiesRepo.getAllProxies({ workspace_id: 'default' })
  assert.strictEqual(defProxies.length, 1, `Expected 1 global proxy for default, got ${defProxies.length}`)
  console.log('✓ Proxies inherit correctly (global + workspace-scoped)')

  console.log('\n[Test 5] Safe non-destructive deletion with profile reassignment...')
  await assert.rejects(
    () => workspacesRepo.deleteWorkspace('ws-marketing', { targetWorkspaceId: 'missing-workspace' }),
    /does not exist/,
    'workspace deletion must reject a nonexistent reassignment target'
  )
  assert(await workspacesRepo.getWorkspaceById('ws-marketing'), 'failed deletion must preserve the source workspace')
  const beforeDeleteProfiles = await profilesRepo.getAllProfiles({ workspace_id: 'ws-marketing' })
  const firstProfileDataPath = beforeDeleteProfiles[0].browser_data_path
  assert(fs.existsSync(firstProfileDataPath), 'Profile browser data path must exist before deletion')

  const deleteResult = await workspacesRepo.deleteWorkspace('ws-marketing', { targetWorkspaceId: 'default' })
  assert(deleteResult.success, 'Workspace deletion must succeed')

  const deletedWs = await workspacesRepo.getWorkspaceById('ws-marketing')
  assert.strictEqual(deletedWs, null, 'Deleted workspace must no longer exist')

  // Check profiles were reassigned to default
  const reassignedProfiles = await profilesRepo.getAllProfiles({ workspace_id: 'default' })
  assert.strictEqual(reassignedProfiles.length, 12, `Expected 12 profiles in default workspace after reassign, got ${reassignedProfiles.length}`)
  assert(fs.existsSync(firstProfileDataPath), 'Profile browser data must NOT be deleted')
  console.log('✓ Non-destructive deletion: 8 profiles safely moved to default workspace with browser data preserved')

  closeDb()
  console.log('\n======================================================')
  console.log('🎉 ALL BƯỚC 27 WORKSPACE MANAGEMENT TESTS PASSED!')
  console.log('======================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err)
  process.exit(1)
})
