const fs = require('fs')
const path = require('path')

function normalizeUrl(raw) {
  const url = String(raw || '').trim()
  if (!url) return null
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function sameDomain(a, b) {
  try {
    return new URL(a).hostname === new URL(b).hostname
  } catch {
    return false
  }
}

module.exports = async ({ page, browser: _browser, inputs, logger, downloadsDir: _downloadsDir }) => {
  const startUrl = normalizeUrl(inputs.url)
  if (!startUrl) throw new Error('Start URL is required')

  const keyword = String(inputs.keyword || '').trim().toLowerCase()
  const maxPages = Math.max(1, Math.min(100, Number(inputs.maxPages) || 5))
  const delayMs = Math.max(0, Math.min(30000, Number(inputs.delayMs) || 0))
  const mode = inputs.mode === 'crawl' ? 'crawl' : 'single'
  const followLinks = Boolean(inputs.followLinks)

  const collected = []
  const visited = new Set()
  let current = startUrl

  for (let i = 0; i < maxPages; i++) {
    if (visited.has(current)) break
    visited.add(current)

    logger.info(`[${i + 1}/${maxPages}] Opening ${current} ...`)
    await page.goto(current, { waitUntil: 'domcontentloaded', timeout: 45000 })

    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]'))
        .map((a) => a.href)
        .filter((h) => /^https?:\/\//i.test(h))
    )

    const filtered = keyword ? links.filter((h) => h.toLowerCase().includes(keyword)) : links
    const unique = [...new Set(filtered)]
    collected.push(...unique)
    logger.info(`  found ${unique.length} matching link${unique.length === 1 ? '' : 's'}`)

    if (mode !== 'crawl' || !followLinks) break

    const next = links.find((h) => !visited.has(h) && sameDomain(h, current))
    if (!next) {
      logger.info('  no more in-domain links to follow')
      break
    }
    current = next

    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }

  const uniqueCollected = [...new Set(collected)]
  const message = `Scanned ${visited.size} page(s), collected ${uniqueCollected.length} link(s)`

  if (inputs.outputFolder) {
    const reportDir = inputs.outputFolder
    fs.mkdirSync(reportDir, { recursive: true })
    const reportPath = path.join(reportDir, 'links.txt')
    fs.writeFileSync(reportPath, uniqueCollected.join('\n'), 'utf8')
    logger.info(`Report saved to ${reportPath}`)
  }

  logger.info(message)
  return { ok: true, message, keepOpen: true }
}
