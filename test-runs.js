const os = require('os')
const path = require('path')
const fs = require('fs')
const http = require('http')

process.env.APPDATA = path.join(os.tmpdir(), 'ynlogin-runs-test')

const { getDb, closeDb } = require('./src/main/database')
const profilesRepo = require('./src/main/database/profiles')
const manager = require('./src/main/automation/manager')
const runsRepo = require('./src/main/database/runs')
const browserManager = require('./src/main/browser/manager')

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end('<html><body><h1>Run Test</h1></body></html>')
})

function expect(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg)
  console.log('  ✓', msg)
}

async function run() {
  await getDb()
  await manager.seedSampleTools()
  await new Promise((res) => server.listen(8795, res))

  const profile = await profilesRepo.createProfile({ name: 'Run Test Profile' })

  console.log('=== RUN OPEN WEBSITE (success) ===')
  const ok = await manager.runTool('open-website', profile.id, { url: `http://localhost:8795/` }, {})
  console.log('  result:', JSON.stringify(ok))
  expect(ok.ok === true, 'tool succeeded')
  expect(Boolean(ok.runId), 'run id returned')

  const successRun = await runsRepo.getRunById(ok.runId)
  expect(successRun.status === 'success', 'run status success')
  expect(successRun.tool_name === 'Open Website', 'run tool name recorded')
  expect(successRun.profile_name === 'Run Test Profile', 'run profile recorded')
  expect(Boolean(successRun.start_time && successRun.end_time), 'start/end times recorded')
  const logs = await runsRepo.getRunLogs(ok.runId)
  console.log('  log lines:', logs.length)
  expect(logs.length >= 2, 'log lines recorded')

  // close any opened browser for this profile
  await browserManager.closeProfile(profile.id).catch(() => {})

  console.log('\n=== CREATE BROKEN TOOL AND RUN (failure) ===')
  const brokenFolder = path.join(os.tmpdir(), 'ynlogin-runs-broken')
  fs.mkdirSync(brokenFolder, { recursive: true })
  fs.writeFileSync(
    path.join(brokenFolder, 'manifest.json'),
    JSON.stringify({
      id: 'runs-broken', name: 'Runs Broken', version: '1.0.0', description: 'fails', entry: 'main.js', runModes: ['browser'], inputSchema: [],
    })
  )
  fs.writeFileSync(
    path.join(brokenFolder, 'main.js'),
    `module.exports = async ({ page, logger }) => {
      await page.goto('http://localhost:8795/', { waitUntil: 'domcontentloaded' })
      logger.info('reached page')
      throw new Error('intentional boom')
    }`
  )
  await manager.importTool(brokenFolder)

  const fail = await manager.runTool('runs-broken', profile.id, {}, {})
  console.log('  result:', JSON.stringify(fail))
  expect(fail.ok === false, 'tool failed')
  expect(Boolean(fail.runId), 'run id returned on failure')

  const failedRun = await runsRepo.getRunById(fail.runId)
  expect(failedRun.status === 'failed', 'run status failed')
  expect(Boolean(failedRun.error), 'error message recorded')
  console.log('  error:', failedRun.error)
  expect(failedRun.url && failedRun.url.includes('localhost:8795'), 'current URL recorded')
  console.log('  url:', failedRun.url)
  expect(Boolean(failedRun.screenshot_path) && fs.existsSync(failedRun.screenshot_path), 'screenshot captured on disk')
  expect(Boolean(failedRun.logs_path) && fs.existsSync(path.join(failedRun.logs_path, 'run.log')), 'run.log file exists')

  const failLogs = await runsRepo.getRunLogs(fail.runId)
  expect(failLogs.some((l) => l.level === 'error'), 'error logged in run_logs')

  const recent = await runsRepo.getRecentRuns(10)
  expect(recent.length >= 2, 'recent runs list contains runs')

  await browserManager.closeProfile(profile.id).catch(() => {})
  await manager.removeTool('runs-broken')

  console.log('\n=== ALL RUNS TESTS PASSED ===')
  await browserManager.closeAllProfiles()
  await new Promise((resolve) => server.close(resolve))
  closeDb()
  fs.rmSync(path.join(os.tmpdir(), 'ynlogin-runs-test'), { recursive: true, force: true })
}

run().catch(async (err) => {
  console.error('RUNS TEST FAILED:', err.message)
  await browserManager.closeAllProfiles().catch(() => {})
  await new Promise((resolve) => server.close(resolve)).catch(() => {})
  closeDb()
  process.exit(1)
})
