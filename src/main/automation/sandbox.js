const { createAutomationContext } = require('../../sdk')

class AutomationSandbox {
  constructor() {
    this.defaultTimeoutMs = 60000 // 60s max per automation task
  }

  /**
   * Executes plugin automation function in guarded sandbox runtime.
   */
  async executeInSandbox({
    pluginFn,
    runId,
    page,
    inputs = {},
    permissions = [],
    logger,
    timeoutMs,
  } = {}) {
    const maxTimeout = Number(timeoutMs) || this.defaultTimeoutMs

    const context = createAutomationContext({
      runId,
      page,
      inputs,
      permissions,
      logger,
    })

    let timer = null
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`SandboxTimeout: Automation exceeded maximum execution time of ${maxTimeout}ms`))
      }, maxTimeout)
    })

    try {
      const executionPromise = Promise.resolve().then(() => pluginFn(context))
      const result = await Promise.race([executionPromise, timeoutPromise])
      return {
        success: true,
        result: result !== undefined ? result : { completed: true },
      }
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Unknown sandbox execution error',
        stack: err.stack,
      }
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}

const automationSandbox = new AutomationSandbox()

module.exports = {
  AutomationSandbox,
  automationSandbox,
}
