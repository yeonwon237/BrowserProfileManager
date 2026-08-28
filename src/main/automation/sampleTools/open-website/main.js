module.exports = async ({ page, browser, inputs, logger }) => {
  const url = String(inputs.url || '').trim()
  if (!url) {
    throw new Error('URL is required')
  }

  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`
  logger.info(`Opening ${normalized} ...`)

  // Prefer the raw page; fall back to the sandbox browser API so the tool also
  // works when page navigation goes through the permission-aware wrapper.
  const target = (page && typeof page.goto === 'function')
    ? page
    : (browser && typeof browser.goto === 'function') ? browser : null
  if (!target) {
    throw new Error('No browser page available (tool requires browser.page / browser.navigation permission)')
  }

  await target.goto(normalized, { waitUntil: 'domcontentloaded', timeout: 45000 })

  const title = (typeof target.title === 'function' ? await target.title().catch(() => '') : '')
  logger.info(`Page loaded: ${title || normalized}`)

  return { ok: true, message: `Opened ${normalized}` }
}