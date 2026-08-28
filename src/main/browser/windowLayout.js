const { getSetting, setSetting } = require('../settings')

const SETTING_KEY = 'browser.windowLayout'
const DEFAULTS = Object.freeze({
  enabled: true,
  width: 900,
  height: 700,
  gapX: 12,
  gapY: 12,
  columns: 0,
  offsetX: 0,
  offsetY: 0,
})

function clamp(value, min, max, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}

function sanitizeWindowLayout(value = {}) {
  return {
    enabled: value.enabled !== false && value.enabled !== 'false',
    width: clamp(value.width, 480, 3840, DEFAULTS.width),
    height: clamp(value.height, 360, 2160, DEFAULTS.height),
    gapX: clamp(value.gapX, 0, 500, DEFAULTS.gapX),
    gapY: clamp(value.gapY, 0, 500, DEFAULTS.gapY),
    columns: clamp(value.columns, 0, 20, DEFAULTS.columns),
    offsetX: clamp(value.offsetX, 0, 3000, DEFAULTS.offsetX),
    offsetY: clamp(value.offsetY, 0, 2000, DEFAULTS.offsetY),
  }
}

async function getWindowLayout() {
  const raw = await getSetting(SETTING_KEY, JSON.stringify(DEFAULTS))
  try {
    return sanitizeWindowLayout(JSON.parse(raw))
  } catch {
    return { ...DEFAULTS }
  }
}

async function setWindowLayout(value) {
  const sanitized = sanitizeWindowLayout(value)
  await setSetting(SETTING_KEY, JSON.stringify(sanitized))
  return sanitized
}

function calculateWindowBounds(layout, slot, workArea = {}, profileCount = null) {
  const cfg = sanitizeWindowLayout(layout)
  const area = {
    x: Number(workArea.x) || 0,
    y: Number(workArea.y) || 0,
    width: clamp(workArea.width, 480, 16384, 1920),
    height: clamp(workArea.height, 360, 8640, 1080),
  }

  // --- Manual mode: user explicitly configured columns / window size. ---
  // Tile the configured grid, then cascade overflow with a bounded staircase
  // step that never pushes windows off the usable screen.
  if (cfg.columns > 0) {
    const usableHeight = Math.max(cfg.height, area.height - cfg.offsetY)
    const rows = Math.max(1, Math.floor((usableHeight + cfg.gapY) / (cfg.height + cfg.gapY)))
    const visibleSlots = Math.max(1, cfg.columns * rows)
    const slotNumber = Math.max(0, Number(slot) || 0)
    const normalizedSlot = slotNumber % visibleSlots
    const page = Math.floor(slotNumber / visibleSlots)

    const step = 32
    const maxCascadeX = Math.max(0, area.width - cfg.width - cfg.offsetX)
    const maxCascadeY = Math.max(0, area.height - cfg.height - cfg.offsetY)
    const cascadeX = Math.min(maxCascadeX, page * step)
    const cascadeY = Math.min(maxCascadeY, page * step)

    const column = normalizedSlot % cfg.columns
    const row = Math.floor(normalizedSlot / cfg.columns)
    return {
      x: area.x + cfg.offsetX + column * (cfg.width + cfg.gapX) + cascadeX,
      y: area.y + cfg.offsetY + row * (cfg.height + cfg.gapY) + cascadeY,
      width: cfg.width,
      height: cfg.height,
      columns: cfg.columns,
      rows,
    }
  }

  // --- Auto mode (default): fit window size to the number of profiles being
  // opened so they tile in a clean, non-overlapping grid that stays on-screen.
  // This replaces the old huge 900x700 windows that overlapped when opening
  // many profiles at once.
  const count = Math.max(1, Math.min(Number(profileCount) || 1, 30))
  const columns = Math.max(2, Math.min(6, Math.ceil(Math.sqrt(count))))
  const rows = Math.max(1, Math.ceil(count / columns))
  const width = clamp(
    Math.floor((area.width - area.x - cfg.offsetX - (columns - 1) * cfg.gapX) / columns),
    320, 3840, cfg.width
  )
  const height = clamp(
    Math.floor((area.height - area.y - cfg.offsetY - (rows - 1) * cfg.gapY) / rows),
    240, 2160, cfg.height
  )
  const slotNumber = Math.max(0, Number(slot) || 0)
  const column = slotNumber % columns
  const row = Math.floor(slotNumber / columns)
  return {
    x: area.x + cfg.offsetX + column * (width + cfg.gapX),
    y: area.y + cfg.offsetY + row * (height + cfg.gapY),
    width,
    height,
    columns,
    rows,
  }
}

module.exports = {
  DEFAULTS,
  sanitizeWindowLayout,
  calculateWindowBounds,
  getWindowLayout,
  setWindowLayout,
}
