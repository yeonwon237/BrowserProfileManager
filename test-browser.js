const os = require('os')
const path = require('path')
const fs = require('fs')
const http = require('http')
const { chromium } = require('playwright')

const root = path.join(os.tmpdir(), 'ynlogin-browser-test')
const dirA = path.join(root, 'A', 'browser-data')
const dirB = path.join(root, 'B', 'browser-data')
fs.mkdirSync(dirA, { recursive: true })
fs.mkdirSync(dirB, { recursive: true })

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end('<html><body>test</body></html>')
})
const TEST_PORT = 8791

function startServer() {
  return new Promise((resolve) => server.listen(TEST_PORT, resolve))
}
function stopServer() {
  return new Promise((resolve) => server.close(resolve))
}

async function withContext(userDataDir, fn) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    viewport: { width: 800, height: 600 },
  })
  try {
    await fn(context)
  } finally {
    await context.close()
  }
}

const writeAll = () => {
  localStorage.setItem('login_token', 'SESSION_A_SECRET')
  document.cookie = 'session_cookie=COOKIE_A; expires=Wed, 01 Jan 2030 00:00:00 GMT; path=/'
  window.__dbdone = false
  const req = indexedDB.open('testdb', 1)
  req.onupgradeneeded = () => req.result.createObjectStore('kv')
  req.onerror = () => { window.__dbdone = true; window.__dberr = 'open:' + req.error }
  req.onsuccess = () => {
    const db = req.result
    const tx = db.transaction('kv', 'readwrite')
    tx.objectStore('kv').put('INDEXEDDB_A', 'key')
    tx.oncomplete = () => { window.__dbdone = true }
    tx.onerror = () => { window.__dbdone = true; window.__dberr = 'tx:' + tx.error }
  }
}

const startReadIndexedDB = () => {
  window.__dbval = '__PENDING__'
  const req = indexedDB.open('testdb')
  req.onerror = () => { window.__dbval = '__ERROR__' }
  req.onsuccess = () => {
    try {
      const tx = req.result.transaction('kv', 'readonly')
      const gr = tx.objectStore('kv').get('key')
      gr.onsuccess = () => { window.__dbval = gr.result }
      gr.onerror = () => { window.__dbval = '__ERROR__' }
    } catch (e) {
      window.__dbval = null
    }
  }
}

async function readState(page) {
  await page.evaluate(startReadIndexedDB)
  await page.waitForFunction(() => window.__dbval !== '__PENDING__')
  return {
    local: await page.evaluate(() => localStorage.getItem('login_token')),
    cookie: await page.evaluate(() => document.cookie),
    indexed: await page.evaluate(() => window.__dbval),
  }
}

async function run() {
  await startServer()
  console.log('=== STEP 1: Write session data to Profile A ===')
  await withContext(dirA, async (ctx) => {
    const page = ctx.pages()[0] || (await ctx.newPage())
    await page.goto(`http://localhost:${TEST_PORT}/`)
    await page.evaluate(writeAll)
    await page.waitForFunction(() => window.__dbdone === true, null, { timeout: 8000 })
    const state = await readState(page)
    console.log(`  A localStorage = ${state.local}`)
    console.log(`  A cookie = ${state.cookie}`)
    console.log(`  A indexedDB = ${state.indexed}`)
  })

  console.log('\n=== STEP 2: Verify Profile B has NO session of A ===')
  await withContext(dirB, async (ctx) => {
    const page = ctx.pages()[0] || (await ctx.newPage())
    await page.goto(`http://localhost:${TEST_PORT}/`)
    const state = await readState(page)
    console.log(`  B localStorage = ${state.local || '(empty)'}`)
    console.log(`  B cookie = ${state.cookie || '(empty)'}`)
    console.log(`  B indexedDB = ${state.indexed || '(empty)'}`)
    if (state.local) throw new Error('FAIL: Profile B received A localStorage!')
    if (state.cookie.includes('COOKIE_A')) throw new Error('FAIL: Profile B received A cookie!')
    if (state.indexed) throw new Error('FAIL: Profile B received A IndexedDB!')
  })

  console.log('\n=== STEP 3: Reopen Profile A, verify session persists ===')
  await withContext(dirA, async (ctx) => {
    const page = ctx.pages()[0] || (await ctx.newPage())
    await page.goto(`http://localhost:${TEST_PORT}/`)
    const state = await readState(page)
    console.log(`  A localStorage = ${state.local}`)
    console.log(`  A cookie = ${state.cookie}`)
    console.log(`  A indexedDB = ${state.indexed}`)
    if (state.local !== 'SESSION_A_SECRET') throw new Error('FAIL: A localStorage lost after reopen')
    if (!state.cookie.includes('COOKIE_A')) throw new Error('FAIL: A cookie lost after reopen')
    if (state.indexed !== 'INDEXEDDB_A') throw new Error('FAIL: A IndexedDB lost after reopen')
  })

  console.log('\n=== ALL BROWSER TESTS PASSED ===')
  await stopServer()
  fs.rmSync(root, { recursive: true, force: true })
}

run().catch(async (err) => {
  console.error('BROWSER TEST FAILED:', err.message)
  await stopServer()
  process.exit(1)
})