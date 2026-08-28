const assert = require('assert')
const fs = require('fs')
const http = require('http')
const path = require('path')
const { closeDb } = require('../src/main/database')
const { createProfile, deleteProfile } = require('../src/main/database/profiles')
const browserManager = require('../src/main/browser/manager')
const recorder = require('../src/main/automation/recorder')
const automationManager = require('../src/main/automation/manager')
const { getAutomationsPath } = require('../src/shared/paths')

async function run() {
  console.log('=== STARTING AUTOMATION RECORDER TESTS ===')
  const profiles = []
  let server
  let toolId
  let replayLayout = false
  try {
    server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`<!doctype html>${replayLayout ? '<main><section><div>Layout changed</div>' : ''}<form onsubmit="event.preventDefault(); document.body.dataset.loggedIn='yes'">
        <input name="email" type="email"><input name="password" type="password">
        <button type="submit">Login</button></form>${replayLayout ? '</section></main>' : ''}`)
    })
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const url = `http://localhost:${server.address().port}`
    const recordProfile = await createProfile({ name: 'Recorder Source', browser_type: 'chromium' })
    const replayProfile = await createProfile({ name: 'Recorder Replay', browser_type: 'chromium' })
    profiles.push(recordProfile.id, replayProfile.id)

    await browserManager.openProfile(recordProfile, { headless: true })
    await recorder.startRecording({ profileId: recordProfile.id, startUrl: url })
    const page = browserManager.getEntry(recordProfile.id).context.pages()[0]
    await page.locator('input[name="email"]').fill('secret@example.com')
    await page.locator('input[name="password"]').fill('do-not-write-this-password')
    await page.getByRole('button', { name: 'Login' }).click()

    const created = await recorder.stopRecording({ name: 'Recorded Login Test' })
    toolId = created.id
    assert(created.actionCount >= 3, 'Recorder must capture email, password, and login click')
    const toolDir = path.join(getAutomationsPath(), toolId)
    const generatedCode = fs.readFileSync(path.join(toolDir, 'main.js'), 'utf8')
    const manifest = JSON.parse(fs.readFileSync(path.join(toolDir, 'manifest.json'), 'utf8'))
    assert(!generatedCode.includes('secret@example.com'), 'Email value must not be embedded in generated code')
    assert(!generatedCode.includes('do-not-write-this-password'), 'Password must not be embedded in generated code')
    assert(manifest.inputSchema.some((field) => field.key === 'email'))
    assert(manifest.inputSchema.some((field) => field.key === 'password' && field.type === 'password'))

    await browserManager.closeProfile(recordProfile.id)
    replayLayout = true
    const result = await automationManager.runTool(toolId, replayProfile.id, {
      url,
      email: 'replay@example.com',
      password: 'replay-password',
    })
    assert.strictEqual(result.ok, true, result.message)
    const replayPage = browserManager.getEntry(replayProfile.id).context.pages()[0]
    assert.strictEqual(await replayPage.evaluate(() => document.body.dataset.loggedIn), 'yes')
    assert.strictEqual(await replayPage.locator('input[name="email"]').inputValue(), 'replay@example.com')
    console.log('✓ Recording, secure code generation, library registration, and replay verified')
  } finally {
    recorder.cancelRecording()
    await browserManager.closeAllProfiles().catch(() => {})
    for (const id of profiles) await deleteProfile(id, { deleteData: true }).catch(() => {})
    if (toolId) {
      const toolPath = path.join(getAutomationsPath(), toolId)
      if (fs.existsSync(toolPath)) fs.rmSync(toolPath, { recursive: true, force: true })
    }
    if (server) await new Promise((resolve) => server.close(resolve))
    closeDb()
  }
}

run().catch((err) => {
  console.error('❌ AUTOMATION RECORDER TEST FAILED:', err)
  process.exit(1)
})
