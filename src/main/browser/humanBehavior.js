/**
 * Human Behavioral Biometrics Engine for YNlogin
 * Generates natural kinematic Bézier curves for mouse paths,
 * Gaussian typing cadences with realistic typos/backspaces,
 * and smooth deceleration scrolling.
 */

/**
 * Generate a random number from a normal (Gaussian) distribution
 */
function randomGaussian(mean = 0, stdev = 1) {
  let u = 1 - Math.random()
  let v = Math.random()
  let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  return z * stdev + mean
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Cubic Bézier interpolation formula:
 * B(t) = (1-t)^3 * P0 + 3*(1-t)^2 * t * P1 + 3*(1-t) * t^2 * P2 + t^3 * P3
 */
function cubicBezier(p0, p1, p2, p3, t) {
  const u = 1 - t
  const tt = t * t
  const uu = u * u
  const uuu = uu * u
  const ttt = tt * t

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  }
}

/**
 * Generate human-like Bézier control points between start and end coordinates
 */
function generateBezierPath(start, end, options = {}) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const distance = Math.hypot(dx, dy)

  // Number of steps scales with distance
  const baseSteps = options.steps || Math.max(15, Math.min(80, Math.round(distance / 15)))
  const deviation = options.deviation || Math.min(80, distance * 0.25)

  // Control point 1: offset near the beginning
  const cp1 = {
    x: start.x + dx * 0.25 + (Math.random() - 0.5) * deviation,
    y: start.y + dy * 0.25 + (Math.random() - 0.5) * deviation,
  }

  // Control point 2: offset near the destination
  const cp2 = {
    x: start.x + dx * 0.75 + (Math.random() - 0.5) * deviation,
    y: start.y + dy * 0.75 + (Math.random() - 0.5) * deviation,
  }

  const points = []
  for (let i = 0; i <= baseSteps; i++) {
    // Non-linear pacing: slower at beginning and end (ease-in-out)
    const rawT = i / baseSteps
    const t = rawT < 0.5 ? 2 * rawT * rawT : -1 + (4 - 2 * rawT) * rawT
    const pt = cubicBezier(start, cp1, cp2, end, clamp(t, 0, 1))

    // Subtle micro-jitter
    const jitter = i > 0 && i < baseSteps ? (Math.random() - 0.5) * 1.5 : 0
    points.push({
      x: Math.round(pt.x + jitter),
      y: Math.round(pt.y + jitter),
      delay: Math.max(2, Math.round(randomGaussian(8, 3))),
    })
  }

  return points
}

/**
 * Per-page mouse position tracking so that Bézier paths start from the actual
 * current location of THAT page's cursor. The state is keyed by the page
 * object (WeakMap) instead of a module-global, so concurrent profiles/pages
 * never share (and therefore never jump from) another page's cursor.
 */
const pageMouseStates = new WeakMap()

function getMouseState(page) {
  let state = pageMouseStates.get(page)
  if (!state) {
    state = { x: null, y: null }
    pageMouseStates.set(page, state)
  }
  return state
}

/**
 * Human-like mouse movement on a Playwright page
 */
async function humanMove(page, targetX, targetY, options = {}) {
  if (!page || !page.mouse) return

  const state = getMouseState(page)

  // Start from the true current mouse position (the last point we moved to on
  // THIS page), falling back to a deterministic center of the viewport.
  let startX = options.startX
  let startY = options.startY
  if (startX === undefined || startY === undefined) {
    const known = state.x !== null && state.y !== null
    if (known) {
      startX = state.x
      startY = state.y
    } else {
      const center = await page.evaluate(() => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 })).catch(() => ({ x: 400, y: 300 }))
      startX = startX !== undefined ? startX : Math.round(center.x)
      startY = startY !== undefined ? startY : Math.round(center.y)
    }
  }

  const path = generateBezierPath({ x: startX, y: startY }, { x: targetX, y: targetY }, options)

  for (const point of path) {
    await page.mouse.move(point.x, point.y)
    state.x = point.x
    state.y = point.y
    if (point.delay > 0) {
      await new Promise((r) => setTimeout(r, point.delay))
    }
  }
}

/**
 * Human-like click on an element or coordinates
 */
async function humanClick(page, selectorOrCoords, options = {}) {
  if (!page) return

  let targetX = 0
  let targetY = 0

  if (typeof selectorOrCoords === 'string') {
    const locator = page.locator(selectorOrCoords).first()
    const box = await locator.boundingBox()
    if (!box) {
      // Fallback to standard click if bounding box unavailable
      return locator.click({ timeout: 5000 })
    }
    // Click randomly inside the element's bounding box (not exact center)
    const marginX = Math.min(5, box.width * 0.1)
    const marginY = Math.min(5, box.height * 0.1)
    targetX = box.x + marginX + Math.random() * (box.width - 2 * marginX)
    targetY = box.y + marginY + Math.random() * (box.height - 2 * marginY)
  } else if (selectorOrCoords && typeof selectorOrCoords.x === 'number') {
    targetX = selectorOrCoords.x
    targetY = selectorOrCoords.y
  }

  await humanMove(page, targetX, targetY, options)
  const state = getMouseState(page)
  state.x = Math.round(targetX)
  state.y = Math.round(targetY)

  // Human click duration: mouse down -> slight hold -> mouse up
  const holdTime = Math.max(30, Math.round(randomGaussian(80, 20)))
  await page.mouse.down()
  await new Promise((r) => setTimeout(r, holdTime))
  await page.mouse.up()

  // Post-click pause
  const postPause = Math.max(50, Math.round(randomGaussian(120, 30)))
  await new Promise((r) => setTimeout(r, postPause))
}

/**
 * Map of physically adjacent QWERTY neighbors (row-wise, left-to-right).
 * A typo should hit a nearby physical key, not an arbitrary ASCII offset.
 */
const QWERTY_NEIGHBORS = {
  q: ['w', 'a'], w: ['q', 'e', 's'], e: ['w', 'r', 'd'], r: ['e', 't', 'f'], t: ['r', 'y', 'g'],
  y: ['t', 'u', 'h'], u: ['y', 'i', 'j'], i: ['u', 'o', 'k'], o: ['i', 'p', 'l'], p: ['o'],
  a: ['q', 's', 'z'], s: ['a', 'd', 'w', 'x'], d: ['s', 'f', 'e', 'c'], f: ['d', 'g', 'r', 'v'],
  g: ['f', 'h', 't', 'b'], h: ['g', 'j', 'y', 'n'], j: ['h', 'k', 'u', 'm'], k: ['j', 'l', 'i'],
  l: ['k', 'o'], z: ['a', 's', 'x'], x: ['z', 's', 'd', 'c'], c: ['x', 'd', 'f', 'v'],
  v: ['c', 'f', 'g', 'b'], b: ['v', 'g', 'h', 'n'], n: ['b', 'h', 'j', 'm'], m: ['n', 'j'],
}

function qwertyTypo(char) {
  const lower = char.toLowerCase()
  const neighbors = QWERTY_NEIGHBORS[lower]
  if (!neighbors) return null
  const replacement = neighbors[Math.floor(Math.random() * neighbors.length)]
  return char === lower ? replacement : replacement.toUpperCase()
}

/**
 * Human-like typing with variable cadence and typo correction.
 * When `options.clear` is true the field's existing value is replaced (cleared
 * first) rather than having the new text appended to whatever is already there.
 */
async function humanType(page, selector, text, options = {}) {
  if (!page || typeof text !== 'string') return

  if (typeof selector === 'string') {
    await humanClick(page, selector, options)
  }

  // Replace, don't append: select all + delete so typing lands on a clean field.
  if (options.clear) {
    try {
      await page.keyboard.press('ControlOrMeta+a')
      await page.keyboard.press('Backspace')
    } catch {}
  }

  const allowTypo = options.allowTypo !== false
  const typoRate = options.typoRate || 0.03 // 3% typo rate

  // Iterate Unicode code points (not UTF-16 code units) so emoji and
  // supplementary-plane characters are never split into replacement glyphs.
  const characters = Array.from(text)
  for (let i = 0; i < characters.length; i++) {
    const char = characters[i]

    // Simulate accidental typo using physically adjacent QWERTY keys
    if (allowTypo && Math.random() < typoRate && /[a-zA-Z]/.test(char)) {
      const wrongChar = qwertyTypo(char)
      if (wrongChar) {
        await typeChar(page, wrongChar)
        await new Promise((r) => setTimeout(r, Math.max(80, Math.round(randomGaussian(180, 40)))))
        // Backspace to fix typo
        await page.keyboard.press('Backspace')
        await new Promise((r) => setTimeout(r, Math.max(60, Math.round(randomGaussian(140, 30)))))
      }
    }

    await typeChar(page, char)

    // Inter-key delay with Gaussian distribution (fast for common letters, slower for specials/spaces)
    let meanDelay = char === ' ' || char === '.' || char === '@' ? 160 : 85
    let stdevDelay = 25
    const keyDelay = Math.max(25, Math.round(randomGaussian(meanDelay, stdevDelay)))
    await new Promise((r) => setTimeout(r, keyDelay))
  }
}

/**
 * Type a single character, preserving full Unicode code points. Supplementary
 * plane characters (emoji, rare CJK) are inserted as text rather than being
 * dispatched as a keyboard event that could split surrogate pairs.
 */
async function typeChar(page, char) {
  const isSingleAscii = char.length === 1 && char.charCodeAt(0) < 128 && !/[^\x20-\x7E]/.test(char)
  if (!isSingleAscii && page.keyboard && typeof page.keyboard.insertText === 'function') {
    await page.keyboard.insertText(char)
  } else {
    await page.keyboard.type(char)
  }
}

/**
 * Human-like smooth scrolling with easing curves
 */
async function humanScroll(page, targetY, options = {}) {
  if (!page) return

  const currentScrollY = await page.evaluate(() => window.scrollY || window.pageYOffset || 0)
  const distance = targetY - currentScrollY
  const steps = options.steps || Math.max(10, Math.min(40, Math.round(Math.abs(distance) / 40)))

  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    // Ease-out cubic
    const ease = 1 - Math.pow(1 - t, 3)
    const currentY = currentScrollY + distance * ease

    await page.evaluate((y) => window.scrollTo(0, y), currentY)

    const stepDelay = Math.max(10, Math.round(randomGaussian(25, 8)))
    await new Promise((r) => setTimeout(r, stepDelay))
  }

  // Reading pause after scroll
  if (options.pauseAfter !== false) {
    const pause = Math.max(200, Math.round(randomGaussian(600, 150)))
    await new Promise((r) => setTimeout(r, pause))
  }
}

module.exports = {
  randomGaussian,
  generateBezierPath,
  qwertyTypo,
  humanMove,
  humanClick,
  humanType,
  humanScroll,
}
