const fs = require('fs')
const path = require('path')
const { dialog, app } = require('electron')
const { getLogsPath } = require('../shared/paths')
const logger = require('./logger')

function writeTechnicalError(context, err) {
  try {
    const dir = getLogsPath()
    fs.mkdirSync(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const file = path.join(dir, `error-${stamp}.log`)
    const detail = [
      `[${new Date().toISOString()}]`,
      `Context: ${context}`,
      `Message: ${err && err.message ? err.message : String(err)}`,
      err && err.stack ? `Stack:\n${err.stack}` : '',
      '',
    ].join('\n')
    fs.appendFileSync(file, detail)
    logger.error(`${context}: ${err && err.message ? err.message : String(err)}`)
    return file
  } catch {
    return null
  }
}

function friendlyMessage(err) {
  const msg = err && err.message ? err.message : String(err)
  const technical = /\.js:|\.js:|node_modules|at Object|at async/i.test(msg)
  if (technical) return 'Something went wrong. The technical details were saved to the logs folder.'
  return msg
}

/**
 * Show a friendly error to the user; technical details go to the logs folder.
 */
function showFriendlyError(window, context, err) {
  const logFile = writeTechnicalError(context, err)
  const message = friendlyMessage(err)
  const detail = logFile ? `Technical details were saved to:\n${logFile}` : ''
  try {
    if (window && !window.isDestroyed()) {
      dialog.showMessageBox(window, {
        type: 'error',
        title: 'YNlogin — Something went wrong',
        message,
        detail,
        buttons: ['OK'],
      })
    } else {
      dialog.showErrorBox('YNlogin — Something went wrong', message + (detail ? `\n\n${detail}` : ''))
    }
  } catch {
    dialog.showErrorBox('YNlogin — Something went wrong', message)
  }
  return logFile
}

function installGlobalErrorHandlers(getWindow) {
  process.on('uncaughtException', (err) => {
    writeTechnicalError('uncaughtException', err)
    try {
      if (app && !app.isQuiting) showFriendlyError(getWindow ? getWindow() : null, 'uncaughtException', err)
    } catch {
      // ignore
    }
  })
  process.on('unhandledRejection', (reason) => {
    writeTechnicalError('unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)))
  })
}

module.exports = { showFriendlyError, writeTechnicalError, installGlobalErrorHandlers, friendlyMessage }