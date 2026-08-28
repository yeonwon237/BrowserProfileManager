const windows = require('./templates/windows.json')
const macos = require('./templates/macos.json')
const linux = require('./templates/linux.json')

const TEMPLATES = { windows, macos, linux }

function getPlatformTemplate(platformFamily) {
  return TEMPLATES[platformFamily] || TEMPLATES.windows
}

function getDeviceTemplate(platformFamily, index = 0) {
  const platform = getPlatformTemplate(platformFamily)
  const devices = platform.devices || []
  return devices[Math.abs(Number(index) || 0) % devices.length]
}

module.exports = { TEMPLATES, getPlatformTemplate, getDeviceTemplate }
