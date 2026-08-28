const OS_CHROME = {
  windows: { taskbar: 48, frameX: 16, frameY: 88 },
  macos: { taskbar: 25, frameX: 0, frameY: 72 },
  linux: { taskbar: 32, frameX: 16, frameY: 80 },
}

function buildScreenModel(identity = {}, requestedViewport = null) {
  const screen = identity.screen || { width: 1920, height: 1080, deviceScaleFactor: 1, colorDepth: 24, pixelDepth: 24 }
  const chrome = OS_CHROME[identity.platformFamily] || OS_CHROME.windows
  const availWidth = screen.width
  const availHeight = Math.max(240, screen.height - chrome.taskbar)
  const requested = requestedViewport && Number(requestedViewport.width) && Number(requestedViewport.height)
    ? { width: Number(requestedViewport.width), height: Number(requestedViewport.height) }
    : { width: Math.min(1280, availWidth), height: Math.min(720, availHeight) }
  const viewport = {
    width: Math.max(320, Math.min(requested.width, availWidth)),
    height: Math.max(240, Math.min(requested.height, availHeight)),
  }
  return {
    width: screen.width, height: screen.height, availWidth, availHeight,
    colorDepth: screen.colorDepth || 24, pixelDepth: screen.pixelDepth || 24,
    deviceScaleFactor: screen.deviceScaleFactor || 1,
    viewport,
    outerWidth: Math.min(screen.width, viewport.width + chrome.frameX),
    outerHeight: Math.min(screen.height, viewport.height + chrome.frameY),
  }
}

function validateScreenModel(model = {}) {
  const issues = []
  if (model.availWidth > model.width || model.availHeight > model.height) issues.push('AVAILABLE_BOUNDS_EXCEED_SCREEN')
  if (model.viewport?.width > model.availWidth || model.viewport?.height > model.availHeight) issues.push('VIEWPORT_EXCEEDS_AVAILABLE_SCREEN')
  if (model.outerWidth < model.viewport?.width || model.outerHeight < model.viewport?.height) issues.push('OUTER_BOUNDS_SMALLER_THAN_INNER')
  if (![1, 1.25, 1.5, 2].includes(Number(model.deviceScaleFactor))) issues.push('UNUSUAL_DEVICE_SCALE_FACTOR')
  return { valid: issues.length === 0, issues }
}

module.exports = { buildScreenModel, validateScreenModel }
