/**
 * YNlogin Automation SDK (Version 1.0)
 * Formal interface for building isolated, safe browser automation plugins.
 */

const AUTOMATION_API_VERSION = 1

const VALID_PERMISSIONS = [
  'browser.page',
  'browser.navigation',
  'browser.screenshot',
  'downloads.write',
  'filesystem.selectedFile',
  'network',
]

/**
 * Validates plugin manifest structure and permissions.
 */
function validateManifest(manifest) {
  const errors = []
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be a valid JSON object'] }
  }

  if (!manifest.id || typeof manifest.id !== 'string') {
    errors.push('Manifest requires a unique string "id"')
  }

  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('Manifest requires a string "name"')
  }

  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('Manifest requires a semantic "version" string (e.g. "1.0.0")')
  }

  if (manifest.apiVersion && Number(manifest.apiVersion) > AUTOMATION_API_VERSION) {
    errors.push(`Incompatible apiVersion: requires <= ${AUTOMATION_API_VERSION}`)
  }

  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : []
  for (const perm of permissions) {
    if (!VALID_PERMISSIONS.includes(perm)) {
      errors.push(`Unknown permission requested: "${perm}"`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    manifest: {
      ...manifest,
      apiVersion: manifest.apiVersion || AUTOMATION_API_VERSION,
      permissions,
    },
  }
}

/**
 * Creates scoped AutomationContext for a plugin run.
 */
function createAutomationContext({ runId, page, inputs = {}, permissions = [], logger } = {}) {
  const permSet = new Set(permissions)

  const log = {
    info: (msg) => logger?.info?.(msg),
    warn: (msg) => logger?.warn?.(msg),
    error: (msg) => logger?.error?.(msg),
    debug: (msg) => logger?.debug?.(msg),
  }

  function assertPagePermission() {
    if (!permSet.has('browser.page')) throw new Error('PermissionDenied: browser.page permission required')
  }

  function assertNotCancelled(options = {}) {
    if (options.signal?.aborted) {
      const error = new Error('Automation action cancelled')
      error.code = 'ACTION_CANCELLED'
      throw error
    }
  }

  async function structuredAction(action, selector, options, operation) {
    assertPagePermission()
    if (typeof selector !== 'string' || !selector.trim() || selector.length > 1000) {
      const error = new Error(`Invalid selector for ${action}`)
      error.code = 'INVALID_SELECTOR'
      throw error
    }
    assertNotCancelled(options)
    const startedAt = Date.now()
    try {
      const result = await operation()
      assertNotCancelled(options)
      log.info(`${action} completed (${Date.now() - startedAt}ms)`)
      return result
    } catch (cause) {
      const error = new Error(`${action} failed: ${cause.message || cause}`)
      error.code = cause.code || 'AUTOMATION_ACTION_FAILED'
      error.action = action
      error.selector = selector
      error.cause = cause
      log.error(`${action} failed (${error.code})`)
      throw error
    }
  }

  const browser = {
    goto: async (url, options = {}) => {
      if (!permSet.has('browser.navigation') && !permSet.has('browser.page')) {
        throw new Error('PermissionDenied: browser.navigation permission required')
      }
      return page.goto(url, { timeout: 30000, ...options })
    },
    title: async () => {
      if (!permSet.has('browser.page')) {
        throw new Error('PermissionDenied: browser.page permission required')
      }
      return page.title()
    },
    screenshot: async (options = {}) => {
      if (!permSet.has('browser.screenshot') && !permSet.has('browser.page')) {
        throw new Error('PermissionDenied: browser.screenshot permission required')
      }
      return page.screenshot(options)
    },
    waitForSelector: async (selector, options = {}) => {
      if (!permSet.has('browser.page')) {
        throw new Error('PermissionDenied: browser.page permission required')
      }
      return page.waitForSelector(selector, options)
    },
    humanClick: async (selector, options = {}) => {
      if (!permSet.has('browser.page')) {
        throw new Error('PermissionDenied: browser.page permission required')
      }
      const humanBehavior = require('../main/browser/humanBehavior')
      return humanBehavior.humanClick(page, selector, options)
    },
    humanType: async (selector, text, options = {}) => {
      if (!permSet.has('browser.page')) {
        throw new Error('PermissionDenied: browser.page permission required')
      }
      const humanBehavior = require('../main/browser/humanBehavior')
      return humanBehavior.humanType(page, selector, text, options)
    },
    humanScroll: async (targetY, options = {}) => {
      if (!permSet.has('browser.page')) {
        throw new Error('PermissionDenied: browser.page permission required')
      }
      const humanBehavior = require('../main/browser/humanBehavior')
      return humanBehavior.humanScroll(page, targetY, options)
    },
    safeClick: (selector, options = {}) => structuredAction('safeClick', selector, options, async () => {
      const locator = page.locator(selector).first()
      await locator.waitFor({ state: 'visible', timeout: options.timeout || 10_000 })
      if (!(await locator.isEnabled())) {
        const error = new Error('Target is disabled')
        error.code = 'TARGET_DISABLED'
        throw error
      }
      return locator.click({ timeout: options.timeout || 10_000 })
    }),
    waitAndClick: (selector, options = {}) => structuredAction('waitAndClick', selector, options, async () => {
      const locator = page.locator(selector).first()
      await locator.waitFor({ state: options.state || 'visible', timeout: options.timeout || 15_000 })
      return locator.click({ timeout: options.timeout || 15_000 })
    }),
    typeWithDelay: (selector, text, options = {}) => structuredAction('typeWithDelay', selector, options, async () => {
      if (typeof text !== 'string') {
        const error = new Error('Text must be a string')
        error.code = 'INVALID_TEXT'
        throw error
      }
      const locator = page.locator(selector).first()
      await locator.waitFor({ state: 'visible', timeout: options.timeout || 10_000 })
      if (options.clear !== false) await locator.fill('')
      return locator.pressSequentially(text, { delay: options.delay ?? 60, timeout: options.timeout || 10_000 })
    }),
    scrollIntoViewAndClick: (selector, options = {}) => structuredAction('scrollIntoViewAndClick', selector, options, async () => {
      const locator = page.locator(selector).first()
      await locator.waitFor({ state: 'attached', timeout: options.timeout || 10_000 })
      await locator.scrollIntoViewIfNeeded({ timeout: options.timeout || 10_000 })
      return locator.click({ timeout: options.timeout || 10_000 })
    }),
  }

  return {
    runId,
    inputs,
    log,
    browser,
    apiVersion: AUTOMATION_API_VERSION,
  }
}

module.exports = {
  AUTOMATION_API_VERSION,
  VALID_PERMISSIONS,
  validateManifest,
  createAutomationContext,
}
