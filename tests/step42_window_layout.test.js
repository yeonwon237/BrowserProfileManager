const assert = require('assert')
const { closeDb } = require('../src/main/database')
const windowLayout = require('../src/main/browser/windowLayout')

async function run() {
  console.log('=== BROWSER WINDOW ARRANGEMENT TESTS ===')

  const saved = await windowLayout.setWindowLayout({
    enabled: true,
    width: 800,
    height: 600,
    gapX: 20,
    gapY: 10,
    columns: 2,
    offsetX: 30,
    offsetY: 40,
  })
  assert.deepStrictEqual(await windowLayout.getWindowLayout(), saved)

  const area = { x: 100, y: 50, width: 1920, height: 1080 }
  assert.deepStrictEqual(windowLayout.calculateWindowBounds(saved, 0, area), {
    x: 130, y: 90, width: 800, height: 600, columns: 2, rows: 1,
  })
  assert.deepStrictEqual(windowLayout.calculateWindowBounds(saved, 1, area), {
    x: 950, y: 90, width: 800, height: 600, columns: 2, rows: 1,
  })
  // Overflow windows cascade with a bounded 32px staircase step that never
  // pushes the window off the usable screen area.
  assert.deepStrictEqual(windowLayout.calculateWindowBounds(saved, 2, area), {
    x: 162, y: 122, width: 800, height: 600, columns: 2, rows: 1,
  })

  // Even with many profiles, the last window must stay fully on-screen.
  const farSlot = windowLayout.calculateWindowBounds(saved, 200, area)
  assert(farSlot.x + farSlot.width <= area.x + area.width, `overflow window must stay on-screen, got x=${farSlot.x}`)
  assert(farSlot.y + farSlot.height <= area.y + area.height, `overflow window must stay on-screen, got y=${farSlot.y}`)

  const safe = windowLayout.sanitizeWindowLayout({ width: 1, height: 99999, gapX: -5, columns: 99 })
  assert.strictEqual(safe.width, 480)
  assert.strictEqual(safe.height, 2160)
  assert.strictEqual(safe.gapX, 0)
  assert.strictEqual(safe.columns, 20)

  console.log('✓ Settings persistence, grid positions, monitor offsets, and safe limits verified')
  closeDb()
}

run().catch((err) => {
  console.error(err)
  closeDb()
  process.exit(1)
})
