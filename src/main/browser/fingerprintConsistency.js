const { validateIdentity } = require('./profileIdentity')
const { buildScreenModel, validateScreenModel } = require('./screenModel')
const { auditFontProfile } = require('./fontProfile')
const { validateRuntimeCompatibility } = require('./browserCompatibility')

function finding(code, severity, message) { return { code, severity, message } }

function evaluateFingerprintConsistency(identity = {}, browserVersion = '', options = {}) {
  const findings = []
  for (const code of validateIdentity(identity).issues) findings.push(finding(code, 'invalid', 'Profile Identity is internally inconsistent'))
  const screen = buildScreenModel(identity, options.viewport)
  for (const code of validateScreenModel(screen).issues) findings.push(finding(code, code === 'UNUSUAL_DEVICE_SCALE_FACTOR' ? 'warning' : 'invalid', 'Display geometry is inconsistent'))
  const fonts = auditFontProfile(identity, options.measurableFonts || [])
  if (fonts.foreign.length) findings.push(finding('FONT_OS_MISMATCH', 'invalid', `Fonts do not belong to ${identity.platformFamily}`))
  if (fonts.unavailable.length) findings.push(finding('FONT_NOT_RENDERABLE', 'warning', 'Declared fonts are not measurable in the browser'))
  const compatibility = validateRuntimeCompatibility(identity, browserVersion)
  for (const code of compatibility.issues) findings.push(finding(code, 'invalid', 'Browser version is outside the supported compatibility matrix'))
  if (identity.gpu?.family === 'apple-silicon' && identity.platformFamily !== 'macos') findings.push(finding('GPU_OS_MISMATCH', 'invalid', 'Apple GPU requires a macOS identity'))
  if (identity.locale && identity.languages?.[0] !== identity.locale) findings.push(finding('LOCALE_LANGUAGE_MISMATCH', 'warning', 'Primary language must match locale'))
  const invalid = findings.some((item) => item.severity === 'invalid')
  const warning = findings.some((item) => item.severity === 'warning')
  return { status: invalid ? 'Invalid' : warning ? 'Warning' : 'Healthy', score: Math.max(0, 100 - findings.filter((f) => f.severity === 'invalid').length * 30 - findings.filter((f) => f.severity === 'warning').length * 10), findings, screen, compatibility: compatibility.matrix }
}

module.exports = { evaluateFingerprintConsistency }
