const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { getProfileById } = require('../database/profiles')
const browserManager = require('../browser/manager')
const { getAutomationsPath } = require('../../shared/paths')

let active = null

const RECORDER_SCRIPT = `
(() => {
  if (window.__ynloginRecorderInstalled) return
  window.__ynloginRecorderInstalled = true

  const selectorFor = (element) => {
    if (!(element instanceof Element)) return null
    const esc = (value) => CSS.escape(String(value))
    for (const attr of ['data-testid', 'data-test', 'data-qa']) {
      const value = element.getAttribute(attr)
      if (value) return '[' + attr + '="' + String(value).replace(/"/g, '\\"') + '"]'
    }
    if (element.id) return '#' + esc(element.id)
    if (element.getAttribute('name')) {
      const tag = element.tagName.toLowerCase()
      return tag + '[name="' + String(element.getAttribute('name')).replace(/"/g, '\\"') + '"]'
    }
    const aria = element.getAttribute('aria-label')
    if (aria) return '[aria-label="' + String(aria).replace(/"/g, '\\"') + '"]'
    const placeholder = element.getAttribute('placeholder')
    if (placeholder) return '[placeholder="' + String(placeholder).replace(/"/g, '\\"') + '"]'
    if (element.matches('a[href]')) {
      const href = String(element.getAttribute('href')).replace(/"/g, '\\"')
      return 'a[href="' + href + '"]:visible'
    }
    if (element.matches('button, input[type="submit"], input[type="button"], [role="button"]')) {
      const label = (element.innerText || element.value || element.getAttribute('aria-label') || '').trim().replace(/"/g, '\\"')
      if (label) return element.tagName.toLowerCase() + ':has-text("' + label + '"):visible'
    }

    const parts = []
    let node = element
    while (node && node.nodeType === 1 && node !== document.body) {
      let part = node.tagName.toLowerCase()
      const siblings = node.parentElement ? Array.from(node.parentElement.children).filter((x) => x.tagName === node.tagName) : []
      if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')'
      parts.unshift(part)
      node = node.parentElement
      if (parts.length >= 6) break
    }
    return parts.join(' > ')
  }

  const send = (payload) => {
    try { window.__ynloginRecordAction({ ...payload, url: location.href, at: Date.now() }) } catch {}
  }

  const roleFor = (element) => {
    const explicit = element.getAttribute('role')
    if (explicit) return explicit
    if (element.matches('a[href]')) return 'link'
    if (element.matches('button, input[type="submit"], input[type="button"]')) return 'button'
    return null
  }

  document.addEventListener('change', (event) => {
    const el = event.target
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return
    const selector = selectorFor(el)
    if (!selector) return
    const inputType = (el.getAttribute('type') || '').toLowerCase()
    const semantic = inputType === 'password' ? 'password' : inputType === 'email' || /email/i.test(el.name || '') ? 'email' : null
    if (el instanceof HTMLSelectElement) send({ type: 'select', selector, value: el.value, label: el.getAttribute('aria-label') || el.name || 'Select value' })
    else if (inputType === 'checkbox' || inputType === 'radio') send({ type: 'check', selector, checked: el.checked, label: el.getAttribute('aria-label') || el.name || 'Option' })
    else send({ type: 'fill', selector, semantic, inputType, label: el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || 'Text value' })
  }, true)

  document.addEventListener('click', (event) => {
    const el = event.target instanceof Element ? event.target.closest('button, a, input[type="submit"], input[type="button"], [role="button"]') : null
    if (!el) return
    const selector = selectorFor(el)
    if (selector) {
      const label = (el.innerText || el.value || el.getAttribute('aria-label') || 'Click').trim().replace(/\\s+/g, ' ').slice(0, 100)
      send({
        type: 'click',
        selector,
        role: roleFor(el),
        href: el.matches('a[href]') ? el.getAttribute('href') : null,
        label,
      })
    }
  }, true)
})()
`

function slugify(value) {
  const slug = String(value || 'recorded-tool').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return (slug || 'recorded-tool').slice(0, 48)
}

function uniqueInputKey(action, counts) {
  const base = action.semantic || slugify(action.label || 'value').replace(/-/g, '_') || 'value'
  counts[base] = (counts[base] || 0) + 1
  return counts[base] === 1 ? base : `${base}_${counts[base]}`
}

function compileRecording(session, name) {
  const counts = {}
  const schema = [{ key: 'url', label: 'Start URL', type: 'url', required: true, default: session.startUrl }]
  const schemaKeys = new Set(['url'])
  const actions = session.actions.map((action) => {
    if (action.type !== 'fill') return action
    const key = uniqueInputKey(action, counts)
    if (!schemaKeys.has(key)) {
      schemaKeys.add(key)
      schema.push({
        key,
        label: action.semantic === 'password' ? 'Password' : action.semantic === 'email' ? 'Email' : action.label,
        type: action.semantic === 'password' ? 'password' : action.semantic === 'email' ? 'text' : 'text',
        required: true,
        hint: action.semantic === 'password' ? 'Password is used only for this run and is not written into generated code.' : undefined,
      })
    }
    return { ...action, inputKey: key }
  })

  const id = `${slugify(name)}-${crypto.randomBytes(3).toString('hex')}`
  const manifest = {
    id,
    name: String(name || 'Recorded Automation').trim(),
    version: '1.0.0',
    description: `Recorded browser workflow with ${actions.length} action(s). Sensitive values are runtime inputs.`,
    entry: 'main.js',
    runModes: ['browser'],
    permissions: ['browser.page', 'browser.navigation'],
    inputSchema: schema,
  }
  const main = `// Generated by YNlogin Automation Recorder.\nconst actions = ${JSON.stringify(actions, null, 2)}\n\nasync function resolveLocator(page, action) {\n  const candidates = []\n  if (action.role && action.label) candidates.push(page.getByRole(action.role, { name: action.label, exact: true }).first())\n  if (action.href) candidates.push(page.locator('a[href]').filter({ hasText: action.label || '' }).first())\n  if (action.label && action.type === 'click') candidates.push(page.getByText(action.label, { exact: true }).first())\n  if (action.selector) candidates.push(page.locator(action.selector).first())\n  for (const candidate of candidates) {\n    try {\n      await candidate.waitFor({ state: 'visible', timeout: 3000 })\n      return candidate\n    } catch {}\n  }\n  throw new Error(\`Cannot find recorded element "\${action.label || action.selector}". The website layout may have changed.\`)\n}\n\nmodule.exports = async ({ page, inputs, logger }) => {\n  const startUrl = String(inputs.url || '').trim()\n  if (!/^https?:\\/\\//i.test(startUrl)) throw new Error('A valid Start URL is required')\n  await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })\n\n  for (let index = 0; index < actions.length; index += 1) {\n    const action = actions[index]\n    const locator = await resolveLocator(page, action)\n    logger.info(\`[\${index + 1}/\${actions.length}] \${action.type}: \${action.label || action.selector}\`)\n    if (action.type === 'fill') await locator.fill(String(inputs[action.inputKey] ?? ''))\n    else if (action.type === 'select') await locator.selectOption(action.value)\n    else if (action.type === 'check') await locator.setChecked(Boolean(action.checked))\n    else if (action.type === 'click') {\n      await locator.click()\n      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {})\n    }\n  }\n  return { ok: true, message: \`Completed \${actions.length} recorded action(s)\`, keepOpen: true }\n}\n`
  return { id, manifest, main, actions }
}

async function startRecording({ profileId, startUrl }) {
  if (active) throw new Error('Another recording is already active')
  const profile = await getProfileById(profileId)
  if (!profile) throw new Error('Profile not found')
  const normalizedUrl = String(startUrl || '').trim()
  if (!/^https?:\/\//i.test(normalizedUrl)) throw new Error('Start URL must begin with http:// or https://')

  let openedByRecorder = false
  if (!browserManager.isRunning(profileId)) {
    await browserManager.openProfile(profile)
    openedByRecorder = true
  }
  const entry = browserManager.getEntry(profileId)
  if (!entry || !entry.context) throw new Error('Browser context is unavailable')

  active = { profileId, profileName: profile.name, startUrl: normalizedUrl, actions: [], openedByRecorder, startedAt: Date.now() }
  try {
    await entry.context.exposeBinding('__ynloginRecordAction', (_source, payload) => {
      if (!active || active.profileId !== profileId || !payload || !payload.type) return
      active.actions.push({ ...payload, at: undefined, url: undefined })
    })
  } catch (err) {
    if (!/already registered|already exists/i.test(err.message || '')) throw err
  }
  await entry.context.addInitScript(RECORDER_SCRIPT)
  const page = entry.context.pages()[0] || (await entry.context.newPage())
  await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.evaluate(RECORDER_SCRIPT).catch(() => {})
  return status()
}

async function stopRecording({ name }) {
  if (!active) throw new Error('No recording is active')
  const session = active
  active = null
  if (session.actions.length === 0) throw new Error('No actions were recorded')
  const compiled = compileRecording(session, name)
  const toolDir = path.join(getAutomationsPath(), compiled.id)
  fs.mkdirSync(toolDir, { recursive: true })
  fs.writeFileSync(path.join(toolDir, 'manifest.json'), JSON.stringify(compiled.manifest, null, 2), 'utf8')
  fs.writeFileSync(path.join(toolDir, 'main.js'), compiled.main, 'utf8')
  return { success: true, id: compiled.id, name: compiled.manifest.name, actionCount: compiled.actions.length }
}

function cancelRecording() {
  const previous = active
  active = null
  return { success: true, wasActive: Boolean(previous) }
}

function status() {
  if (!active) return { active: false, actionCount: 0 }
  return { active: true, profileId: active.profileId, profileName: active.profileName, startUrl: active.startUrl, actionCount: active.actions.length, startedAt: active.startedAt }
}

module.exports = { startRecording, stopRecording, cancelRecording, status, compileRecording, RECORDER_SCRIPT }
