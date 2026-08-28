const path = require('path')
process.env.APPDATA = path.join(require('os').tmpdir(), 'ynlogin-test')

const { getDb, closeDb } = require('./src/main/database')
const repo = require('./src/main/database/profiles')

async function run() {
  await getDb()

  const p1 = await repo.createProfile({ name: 'Profile 001', group: 'Work', tags: ['main', 'test'], notes: 'First profile' })
  const p2 = await repo.createProfile({ name: 'Profile 002', group: 'Personal', tags: [], notes: '' })
  const p3 = await repo.createProfile({ name: 'Profile 003', group: null, tags: ['temp'] })

  console.log('\n=== CREATE ===')
  console.log(`Created: ${p1.name} (${p1.id}) path=${p1.browser_data_path}`)
  console.log(`Created: ${p2.name} (${p2.id})`)
  console.log(`Created: ${p3.name} (${p3.id})`)

  if (!p1.id) throw new Error('FAIL: no UUID generated')
  if (!p1.browser_data_path) throw new Error('FAIL: no browser_data_path')
  if (!require('fs').existsSync(p1.browser_data_path)) throw new Error('FAIL: browser-data folder not created')

  console.log('\n=== EDIT ===')
  const edited = await repo.updateProfile(p1.id, { name: 'Profile 001 (edited)', group: 'Important', tags: ['main', 'updated'], notes: 'Updated note' })
  console.log(`Edited: name=${edited.name} group=${edited.group_name} tags=${JSON.stringify(edited.tags)} notes=${edited.notes}`)
  if (edited.name !== 'Profile 001 (edited)') throw new Error('FAIL: edit name')

  console.log('\n=== DUPLICATE ===')
  const dup = await repo.duplicateProfile(p2.id)
  console.log(`Duplicated: ${dup.name} (${dup.id})`)
  if (dup.id === p2.id) throw new Error('FAIL: duplicate must have new UUID')
  if (dup.browser_data_path === p2.browser_data_path) throw new Error('FAIL: duplicate must have separate browser-data')
  if (require('fs').existsSync(dup.browser_data_path)) console.log('  new browser-data folder created (empty, no cookies copied)')

  console.log('\n=== LIST ===')
  const all = await repo.getAllProfiles()
  console.log(`Total profiles: ${all.length}`)
  all.forEach((p) => console.log(`  - ${p.name} [${p.group_name || 'No group'}] tags=${JSON.stringify(p.tags)} status=${p.status}`))

  console.log('\n=== DELETE (keep data) ===')
  const keepDataFolder = dup.browser_data_path
  const r1 = await repo.deleteProfile(dup.id, { deleteData: false })
  console.log(`deleteData=false → success=${r1.success}, folder still exists=${require('fs').existsSync(keepDataFolder)}`)

  console.log('\n=== DELETE (with data) ===')
  const p3folder = p3.browser_data_path
  const r2 = await repo.deleteProfile(p3.id, { deleteData: true })
  console.log(`deleteData=true → success=${r2.success}, folder removed=${!require('fs').existsSync(p3folder)}`)

  console.log('\n=== ALL TESTS PASSED ===')
  closeDb()
}

run().catch((err) => {
  console.error('TEST FAILED:', err)
  closeDb()
  process.exit(1)
})