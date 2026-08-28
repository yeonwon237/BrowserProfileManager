const fs = require('fs')
const path = require('path')
const { getLogsPath } = require('../shared/paths')

function isProduction() {
  try {
    const electron = require('electron')
    if (electron && electron.app && typeof electron.app.isPackaged === 'boolean') {
      return electron.app.isPackaged
    }
  } catch {
    // not in electron — treat as development
  }
  return false
}

function write(level, message) {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`
  try {
    const dir = getLogsPath()
    fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(path.join(dir, 'app.log'), line)
  } catch {
    // logging must never crash the app
  }
}

/**
 * Info/warn/error used across the app. Production builds only write to the log
 * file (no debug noise on stdout); dev keeps console output.
 */
function info(message) {
  write('info', message)
  if (!isProduction()) console.log(`[info] ${message}`)
}

function warn(message) {
  write('warn', message)
  if (!isProduction()) console.warn(`[warn] ${message}`)
}

function error(message) {
  write('error', message)
  if (!isProduction()) console.error(`[error] ${message}`)
}

module.exports = { info, warn, error, isProduction, write }