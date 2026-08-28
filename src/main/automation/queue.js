const crypto = require('crypto')
const { getProfileById } = require('../database/profiles')
const automationManager = require('./manager')
const browserManager = require('../browser/manager')
const resourceManager = require('../browser/resourceManager')

const jobs = []
let active = false
let listener = null
let acceptingJobs = true

const STATUS = ['waiting', 'running', 'success', 'failed', 'cancelled']

function setListener(fn) {
  listener = fn
}

function notify() {
  if (typeof listener === 'function') {
    listener(getQueue())
  }
}

function now() {
  return new Date().toISOString()
}

function publicJob(job) {
  const { _cancelled, ...rest } = job
  return rest
}

function getQueue() {
  return jobs.map(publicJob)
}

function getCounts() {
  const counts = { waiting: 0, running: 0, success: 0, failed: 0, cancelled: 0, total: jobs.length }
  jobs.forEach((j) => {
    counts[j.status] = (counts[j.status] || 0) + 1
  })
  return counts
}

async function enqueue(toolId, profileIds, inputs = {}) {
  if (!acceptingJobs) {
    throw new Error('Automation queue is shutting down and is not accepting new jobs')
  }
  const tool = await automationManager.getTool(toolId)
  if (!tool) throw new Error('Tool not found')
  if (!tool.valid) throw new Error(`Tool manifest is invalid: ${tool.errors.join('; ')}`)
  if (!tool.enabled) throw new Error('Tool is disabled')

  const ids = Array.isArray(profileIds) ? profileIds : [profileIds]
  if (ids.length === 0) throw new Error('No profiles selected')

  const created = []
  for (const profileId of ids) {
    const profile = await getProfileById(profileId)
    if (!profile) continue

    const job = {
      jobId: crypto.randomUUID(),
      toolId: tool.id,
      toolName: tool.name,
      profileId: profile.id,
      profileName: profile.name,
      status: 'waiting',
      progress: null,
      result: null,
      error: null,
      inputs: { ...inputs },
      createdAt: now(),
      startedAt: null,
      finishedAt: null,
      _cancelled: false,
    }
    jobs.push(job)
    created.push(job)
  }

  notify()
  pump()
  return { queued: created.length }
}

function stopAccepting() {
  acceptingJobs = false
  return { success: true }
}

function startAccepting() {
  acceptingJobs = true
  return { success: true }
}

function isAccepting() {
  return acceptingJobs
}

async function runJob(job) {
  job.startedAt = now()
  try {
    const result = await automationManager.runTool(job.toolId, job.profileId, job.inputs, {
      onProgress: (current, total) => {
        job.progress = { current, total }
        notify()
      },
    })
    if (job._cancelled) return
    job.status = result.ok ? 'success' : 'failed'
    job.result = result.message
    job.runId = result.runId || job.runId || null
    job.screenshotPath = result.screenshotPath || null
    if (!result.ok) job.error = result.message
  } catch (err) {
    if (job._cancelled) return
    job.status = 'failed'
    job.error = err.message || 'Failed'
  } finally {
    job.finishedAt = now()
    notify()
  }
}

async function pump() {
  if (active) return
  active = true
  try {
    while (true) {
      const maxConcurrent = await resourceManager.getEffectiveAutomationLimit()
      const runningCount = jobs.filter((j) => j.status === 'running').length
      const hasWaiting = jobs.some((j) => j.status === 'waiting')

      if (!hasWaiting) {
        if (runningCount === 0) break
        await sleep(300)
        continue
      }

      if (runningCount >= maxConcurrent) {
        await sleep(300)
        continue
      }

      const next = jobs.find((j) => j.status === 'waiting')
      if (next) {
        next.status = 'running'
        notify()
        runJob(next).catch(() => {})
      }
    }
  } finally {
    active = false
  }
  notify()
}

function getRunningCount() {
  return jobs.filter((j) => j.status === 'running').length
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function stopJob(jobId) {
  const job = jobs.find((j) => j.jobId === jobId)
  if (!job) return { success: false }

  if (job.status === 'waiting') {
    job.status = 'cancelled'
    job.finishedAt = now()
    job.result = 'Cancelled'
    notify()
    return { success: true }
  }

  if (job.status === 'running') {
    job._cancelled = true
    job.status = 'cancelled'
    job.result = 'Stopped by user'
    job.finishedAt = now()
    notify()
    await browserManager.closeProfile(job.profileId).catch(() => {})
    return { success: true }
  }

  return { success: false }
}

async function stopAll() {
  for (const job of jobs) {
    if (job.status === 'waiting' || job.status === 'running') {
      await stopJob(job.jobId)
    }
  }
  notify()
  return { success: true }
}

async function retryJob(jobId) {
  const job = jobs.find((j) => j.jobId === jobId)
  if (!job || (job.status !== 'failed' && job.status !== 'cancelled')) {
    return { success: false, error: 'Job cannot be retried' }
  }
  job.status = 'waiting'
  job.progress = null
  job.result = null
  job.error = null
  job.startedAt = null
  job.finishedAt = null
  job._cancelled = false
  notify()
  pump()
  return { success: true }
}

async function retryAllFailed() {
  let count = 0
  for (const job of jobs) {
    if (job.status === 'failed' || job.status === 'cancelled') {
      job.status = 'waiting'
      job.progress = null
      job.result = null
      job.error = null
      job.startedAt = null
      job.finishedAt = null
      job._cancelled = false
      count++
    }
  }
  notify()
  pump()
  return { success: true, retried: count }
}

function clearCompleted() {
  const keep = jobs.filter((j) => j.status === 'waiting' || j.status === 'running')
  jobs.length = 0
  jobs.push(...keep)
  notify()
  return { success: true }
}

module.exports = {
  setListener,
  enqueue,
  stopAll,
  stopJob,
  retryJob,
  retryAllFailed,
  clearCompleted,
  getQueue,
  getCounts,
  getRunningCount,
  STATUS,
  stopAccepting,
  startAccepting,
  isAccepting,
}
