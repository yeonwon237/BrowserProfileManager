const path = require('path')
const os = require('os')
process.env.APPDATA = path.join(os.tmpdir(), 'ynlogin-queue-test')

const { getDb, closeDb } = require('./src/main/database')
const profilesRepo = require('./src/main/database/profiles')
const queue = require('./src/main/automation/queue')
const manager = require('./src/main/automation/manager')
const browserManager = require('./src/main/browser/manager')
const settings = require('./src/main/settings')

const originalRunTool = manager.runTool
const originalClose = browserManager.closeProfile

let runningNow = 0
let maxObserved = 0
let runLog = []
let failProfileId = null
const attempts = {}

function mockRunTool(id, profileId, inputs, options) {
  return new Promise(async (resolve) => {
    runningNow++
    maxObserved = Math.max(maxObserved, runningNow)
    attempts[profileId] = (attempts[profileId] || 0) + 1
    runLog.push({ action: 'start', profileId, runningNow })

    if (options.onProgress) {
      for (let i = 1; i <= 3; i++) {
        await new Promise((r) => setTimeout(r, 20))
        options.onProgress(i, 3)
      }
    }
    await new Promise((r) => setTimeout(r, 60))

    runningNow--
    runLog.push({ action: 'end', profileId, runningNow })

    if (profileId === failProfileId && attempts[profileId] === 1) {
      resolve({ ok: false, message: 'simulated failure (first attempt)' })
    } else {
      resolve({ ok: true, message: 'done' })
    }
  })
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

function expect(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg)
  console.log('  ✓', msg)
}

async function waitFor(predicate, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true
    await sleep(100)
  }
  return false
}

async function run() {
  await getDb()
  await manager.seedSampleTools()

  manager.runTool = mockRunTool
  browserManager.closeProfile = async () => ({ success: true })

  console.log('=== SETUP ===')
  const profiles = []
  for (let i = 1; i <= 5; i++) {
    const p = await profilesRepo.createProfile({ name: `P${i}` })
    profiles.push(p)
  }
  await settings.setMaxConcurrent(2)
  failProfileId = profiles[2].id
  console.log('  5 profiles, maxConcurrent=2, failing profile =', profiles[2].name)

  console.log('\n=== ENQUEUE 5 JOBS (concurrency = 2) ===')
  const ids = profiles.map((p) => p.id)
  const enq = await queue.enqueue('open-website', ids, { url: 'http://localhost:9999/' })
  expect(enq.queued === 5, '5 jobs queued')

  const allDone = await waitFor(() => {
    const q = queue.getQueue()
    return q.every((j) => j.status === 'success' || j.status === 'failed')
  })
  expect(allDone, 'all jobs finished')

  const counts = queue.getCounts()
  console.log('  counts:', JSON.stringify(counts))
  expect(counts.success === 4, '4 succeeded')
  expect(counts.failed === 1, '1 failed (p3)')
  expect(maxObserved <= 2, `never exceeded 2 concurrent (max observed = ${maxObserved})`)

  console.log('\n=== RETRY ONE (the failed job) ===')
  const failedJob = queue.getQueue().find((j) => j.status === 'failed')
  const retried = await queue.retryJob(failedJob.jobId)
  expect(retried.success, 'retryJob accepted')
  const retriedDone = await waitFor(() => queue.getQueue().find((j) => j.jobId === failedJob.jobId).status === 'success')
  expect(retriedDone, 'retried job succeeded')
  console.log('  counts after retry:', JSON.stringify(queue.getCounts()))

  console.log('\n=== RETRY ALL FAILED ===')
  const p6 = await profilesRepo.createProfile({ name: 'P6' })
  failProfileId = p6.id
  await queue.enqueue('open-website', [p6.id, profiles[4].id], { url: 'http://localhost:9999/' })
  await waitFor(() => queue.getCounts().running === 0 && queue.getCounts().waiting === 0)
  const countsBeforeRetryAll = queue.getCounts()
  expect(countsBeforeRetryAll.failed === 1, 'one job failed in new batch')
  await queue.retryAllFailed()
  const requeued = queue.getQueue().filter((j) => j.status === 'waiting' || j.status === 'running')
  expect(requeued.length > 0, 'retryAllFailed re-queues the failed job')
  const retryAllDone = await waitFor(() => {
    const counts = queue.getCounts()
    return counts.failed === 0 && counts.running === 0 && counts.waiting === 0
  })
  expect(retryAllDone, 'all retried jobs finished')
  console.log('  counts after retryAll:', JSON.stringify(queue.getCounts()))
  expect(queue.getCounts().success >= 6, 'retried job succeeded')

  console.log('\n=== STOP ALL ===')
  failProfileId = null
  const stopProfiles = []
  for (let i = 1; i <= 4; i++) {
    stopProfiles.push(await profilesRepo.createProfile({ name: `Stop P${i}` }))
  }
  await queue.enqueue('open-website', stopProfiles.map((p) => p.id), { url: 'http://localhost:9999/' })
  await queue.stopAll()
  const afterStop = queue.getQueue()
  expect(!afterStop.some((j) => j.status === 'waiting' || j.status === 'running'), 'no waiting/running jobs after stop')
  expect(afterStop.some((j) => j.status === 'cancelled'), 'at least one job cancelled')
  expect(afterStop.length > 0, 'jobs still in queue (cancelled)')

  console.log('\n=== CLEAR COMPLETED ===')
  await queue.clearCompleted()
  expect(queue.getQueue().length === 0, 'queue empty after clear')

  console.log('\n=== ALL QUEUE TESTS PASSED ===')
  manager.runTool = originalRunTool
  browserManager.closeProfile = originalClose
  closeDb()
}

run().catch((err) => {
  console.error('QUEUE TEST FAILED:', err.message)
  manager.runTool = originalRunTool
  browserManager.closeProfile = originalClose
  closeDb()
  process.exit(1)
})
