const crypto = require('crypto')
const browserManager = require('./manager')
const humanBehavior = require('./humanBehavior')

const sessions = new Map()
const SENSITIVE_PATTERN = /pass(word)?|otp|totp|2fa|captcha|cvv|cvc|card.?number|security.?code|secret/i

function isSensitiveDescriptor(descriptor = {}) {
  return String(descriptor.type || '').toLowerCase() === 'password' ||
    [descriptor.name, descriptor.id, descriptor.autocomplete, descriptor.placeholder, descriptor.ariaLabel]
      .some((value) => SENSITIVE_PATTERN.test(String(value || '')))
}

function validateEvent(event) {
  if (!event || !['click', 'input', 'scroll'].includes(event.type)) return false
  if (event.type === 'scroll') return Number.isFinite(event.x) && Number.isFinite(event.y)
  const hasSelector = typeof event.selector === 'string' && event.selector.length > 0 && event.selector.length <= 1000
  const hasSemantic = typeof event.descriptor?.role === 'string' && typeof event.descriptor?.accessibleName === 'string'
  if (!hasSelector && !hasSemantic) return false
  if (event.type === 'input' && (typeof event.value !== 'string' || event.value.length > 10000 || isSensitiveDescriptor(event.descriptor))) return false
  return true
}

async function applyEvent(page, event, options = {}) {
  if (!validateEvent(event)) return { ok: false, skipped: true }
  try {
    if (options.delayMs) {
      await new Promise((r) => setTimeout(r, options.delayMs))
    }
    // Replay the captured action through the Human Behavioral engine instead
    // of calling raw DOM methods, so worker browsers reproduce natural
    // kinematics (Bézier mouse paths, human typing cadence, eased scrolling).
    if (event.type === 'scroll') {
      // try/finally guarantees the applying flag is always released, even if
      // the humanized scroll throws, so the worker never stops emitting events.
      await page.evaluate(() => { window.__ynSyncApplying = true })
      try {
        await humanBehavior.humanScroll(page, event.y, { steps: 12, pauseAfter: false })
      } finally {
        await page.evaluate(() => { window.__ynSyncApplying = false })
      }
    } else if (event.type === 'click') {
      let target = event.selector ? page.locator(event.selector).first() : null
      const targetCount = async (locator) => locator && typeof locator.count === 'function' ? locator.count().catch(() => 0) : locator ? 1 : 0
      if (!target || await targetCount(target) === 0) {
        const role = event.descriptor?.role
        const name = event.descriptor?.accessibleName
        target = role && name ? page.getByRole(role, { name, exact: true }).first() : null
      }
      if (!target || await targetCount(target) === 0) {
        const error = new Error('Semantic target does not exist in worker page')
        error.code = 'SYNC_TARGET_NOT_FOUND'
        throw error
      }
      const box = await target.boundingBox()
      if (!box) throw new Error('Semantic target is not visible in worker page')
      await humanBehavior.humanClick(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, { steps: 24 })
    } else if (event.type === 'input') {
      // `clear: true` replaces the existing field content instead of appending,
      // matching the captured final value (prevents "aab" duplication).
      await humanBehavior.humanType(page, event.selector, event.value, { allowTypo: false, clear: true })
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err.message || err).slice(0, 300) }
  }
}

function captureScript() {
  if (window.__ynSyncInstalled) return
  window.__ynSyncInstalled = true
  const selectorFor = (element) => {
    if (!(element instanceof Element)) return null
    if (element.id) return `#${CSS.escape(element.id)}`
    const testId = element.getAttribute('data-testid')
    if (testId) return `[data-testid="${CSS.escape(testId)}"]`
    if (element.name) return `${element.tagName.toLowerCase()}[name="${CSS.escape(element.name)}"]`
    const parts = []
    let node = element
    while (node && node !== document.body && parts.length < 6) {
      let part = node.tagName.toLowerCase()
      const siblings = node.parentElement ? [...node.parentElement.children].filter((item) => item.tagName === node.tagName) : []
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`
      parts.unshift(part)
      node = node.parentElement
    }
    return parts.join(' > ')
  }
  const descriptor = (element) => ({
    type: element.type || '', name: element.name || '', id: element.id || '',
    autocomplete: element.autocomplete || '', placeholder: element.placeholder || '',
    ariaLabel: element.getAttribute?.('aria-label') || '',
    role: element.getAttribute?.('role') || ({ BUTTON: 'button', A: 'link', INPUT: element.type === 'checkbox' ? 'checkbox' : element.type === 'radio' ? 'radio' : 'textbox', SELECT: 'combobox', TEXTAREA: 'textbox' }[element.tagName] || ''),
    accessibleName: (element.getAttribute?.('aria-label') || element.innerText || element.value || element.name || '').trim().replace(/\s+/g, ' ').slice(0, 200),
  })
  document.addEventListener('click', (event) => {
    if (window.__ynSyncApplying || !event.isTrusted) return
    const selector = selectorFor(event.target)
    if (selector) window.__ynSyncEmit({ type: 'click', selector, descriptor: descriptor(event.target) })
  }, true)
  let inputTimer = null
  document.addEventListener('input', (event) => {
    if (window.__ynSyncApplying || !event.isTrusted) return
    clearTimeout(inputTimer)
    const element = event.target
    inputTimer = setTimeout(() => {
      const selector = selectorFor(element)
      if (selector) window.__ynSyncEmit({ type: 'input', selector, value: String(element.value || ''), descriptor: descriptor(element) })
    }, 120)
  }, true)
  let scrollTimer = null
  addEventListener('scroll', () => {
    if (window.__ynSyncApplying) return
    clearTimeout(scrollTimer)
    scrollTimer = setTimeout(() => window.__ynSyncEmit({ type: 'scroll', x: scrollX, y: scrollY }), 80)
  }, { passive: true })
}

async function start(masterProfileId, workerProfileIds = []) {
  if (!browserManager.isRunning(masterProfileId)) throw new Error('Master profile must be running')
  const uniqueWorkers = [...new Set(workerProfileIds)].filter((id) => id && id !== masterProfileId)
  if (uniqueWorkers.length < 1 || uniqueWorkers.length > 20) throw new Error('Select between 1 and 20 running worker profiles')
  const masterEntry = browserManager.getEntry(masterProfileId)
  const workers = uniqueWorkers.map((id) => {
    const entry = browserManager.getEntry(id)
    if (!entry) throw new Error(`Worker profile is not running: ${id}`)
    return entry
  })
  const masterPage = masterEntry.context.pages().find((page) => !page.isClosed()) || await masterEntry.context.newPage()
  const id = `sync-${crypto.randomUUID()}`
  const session = { id, masterProfileId, workerProfileIds: uniqueWorkers, active: true, eventCount: 0, errorCount: 0 }
  sessions.set(id, session)
  await masterPage.exposeBinding('__ynSyncEmit', async (_source, event) => {
    if (!session.active || !validateEvent(event)) return
    session.eventCount++
    const pages = workers.map((entry) => entry.context.pages().find((page) => !page.isClosed())).filter(Boolean)
    const results = await Promise.all(pages.map((page, idx) => {
      const delayMs = idx > 0 ? Math.floor(Math.random() * 35) + 5 : 0
      return applyEvent(page, event, { delayMs })
    }))
    session.errorCount += results.filter((result) => !result.ok && !result.skipped).length
  })
  await masterPage.evaluate(captureScript)
  return status(id)
}

function stop(id) {
  const session = sessions.get(id)
  if (!session) return { success: false, error: 'Sync session not found' }
  session.active = false
  sessions.delete(id)
  return { success: true, id }
}

function stopAll() {
  const count = sessions.size
  sessions.forEach((session) => { session.active = false })
  sessions.clear()
  return { success: true, stoppedCount: count }
}

function status(id = null) {
  if (id) {
    const session = sessions.get(id)
    return session ? { ...session } : null
  }
  return [...sessions.values()].map((session) => ({ ...session }))
}

module.exports = { isSensitiveDescriptor, validateEvent, applyEvent, start, stop, stopAll, status }
