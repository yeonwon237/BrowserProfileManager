const os = require('os')
const path = require('path')
const fs = require('fs')
const http = require('http')

process.env.APPDATA = path.join(os.tmpdir(), 'ynlogin-auto-test')

const { getDb, closeDb } = require('./src/main/database')
const profilesRepo = require('./src/main/database/profiles')
const manager = require('./src/main/automation/manager')
const browserManager = require('./src/main/browser/manager')

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end('<html><body><h1>Automation Test</h1></body></html>')
})

async function run() {
  await getDb()
  await new Promise((res) => server.listen(8794, res))

  console.log('=== SEED + SCAN ===')
  await manager.seedSampleTools()
  let tools = await manager.scanAutomations()
  const openWebsite = tools.find((t) => t.id === 'open-website')
  console.log('tools found:', tools.map((t) => `${t.id}(valid=${t.valid})`).join(', '))
  if (!openWebsite) throw new Error('FAIL: open-website sample not seeded')
  if (!openWebsite.valid) throw new Error('FAIL: open-website invalid: ' + openWebsite.errors.join('; '))
  if (openWebsite.entry !== 'main.js') throw new Error('FAIL: entry not read')
  if (!Array.isArray(openWebsite.inputSchema)) throw new Error('FAIL: inputSchema')

  console.log('\n=== IMPORT INVALID FOLDER (no manifest) ===')
  const badFolder = path.join(os.tmpdir(), 'ynlogin-auto-bad')
  fs.mkdirSync(badFolder, { recursive: true })
  fs.writeFileSync(path.join(badFolder, 'main.js'), 'module.exports = async () => ({})')
  const badImport = await manager.importTool(badFolder)
  console.log('result:', JSON.stringify(badImport))
  if (badImport.success) throw new Error('FAIL: import without manifest should fail')

  console.log('\n=== IMPORT BROKEN TOOL (valid manifest, throws at runtime) ===')
  const brokenFolder = path.join(os.tmpdir(), 'ynlogin-auto-broken')
  fs.mkdirSync(brokenFolder, { recursive: true })
  fs.writeFileSync(
    path.join(brokenFolder, 'manifest.json'),
    JSON.stringify({
      id: 'broken-tool',
      name: 'Broken Tool',
      version: '1.0.0',
      description: 'Throws at runtime',
      entry: 'main.js',
      runModes: ['browser'],
      inputSchema: [],
    })
  )
  fs.writeFileSync(path.join(brokenFolder, 'main.js'), 'module.exports = async () => { throw new Error("boom") }')
  const brokenImport = await manager.importTool(brokenFolder)
  if (!brokenImport.success) throw new Error('FAIL: broken tool should import: ' + brokenImport.errors)
  console.log('imported:', brokenImport.id)

  console.log('\n=== ENABLE / DISABLE ===')
  await manager.setEnabled('broken-tool', false)
  let tools2 = await manager.scanAutomations()
  if (tools2.find((t) => t.id === 'broken-tool').enabled !== false) throw new Error('FAIL: disable not applied')
  await manager.setEnabled('broken-tool', true)
  console.log('toggle OK')

  console.log('\n=== RUN BROKEN TOOL (must not crash app) ===')
  const profile = await profilesRepo.createProfile({ name: 'Auto Test Profile' })
  const brokenRun = await manager.runTool('broken-tool', profile.id, {})
  console.log('result:', JSON.stringify(brokenRun))
  if (brokenRun.ok !== false) throw new Error('FAIL: broken tool should return ok:false')

  console.log('\n=== RUN OPEN WEBSITE (against local server) ===')
  const runResult = await manager.runTool('open-website', profile.id, { url: `http://localhost:${8794}/` })
  console.log('result:', JSON.stringify(runResult))
  if (runResult.ok !== true) throw new Error('FAIL: open-website should succeed')

  console.log('\n=== RUN WITH MISSING REQUIRED INPUT ===')
  const missing = await manager.runTool('open-website', profile.id, {})
  console.log('result:', JSON.stringify(missing))
  if (missing.ok !== false) throw new Error('FAIL: missing URL should fail gracefully')

  console.log('\n=== REMOVE BROKEN TOOL ===')
  const rem = await manager.removeTool('broken-tool')
  console.log('removed:', rem.success)
  const tools3 = await manager.scanAutomations()
  if (tools3.find((t) => t.id === 'broken-tool')) throw new Error('FAIL: tool not removed')

  console.log('\n=== ALL AUTOMATION TESTS PASSED ===')
  await browserManager.closeAllProfiles()
  await new Promise((resolve) => server.close(resolve))
  closeDb()
  fs.rmSync(path.join(os.tmpdir(), 'ynlogin-auto-test'), { recursive: true, force: true })
}

run().catch(async (err) => {
  console.error('AUTOMATION TEST FAILED:', err.message)
  await browserManager.closeAllProfiles().catch(() => {})
  await new Promise((resolve) => server.close(resolve)).catch(() => {})
  closeDb()
  process.exit(1)
})
