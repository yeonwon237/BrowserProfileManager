const fs = require('fs')
const { ensureIdentity } = require('./profileIdentity')
const { evaluateFingerprintConsistency } = require('./fingerprintConsistency')

function validateProfile(profile = {}, browserVersion = '', options = {}) {
  const environment = ensureIdentity(profile.id, profile.environment || {}, profile.browser_type)
  const consistency = evaluateFingerprintConsistency(environment.identity, browserVersion, { viewport: environment.viewport })
  const findings = [...consistency.findings]
  if (!profile.id) findings.push({ code: 'PROFILE_ID_MISSING', severity: 'invalid', message: 'Profile id is required' })
  if (!profile.browser_data_path) findings.push({ code: 'STORAGE_PATH_MISSING', severity: 'invalid', message: 'Persistent storage path is required' })
  else if (fs.existsSync(profile.browser_data_path) && !fs.statSync(profile.browser_data_path).isDirectory()) findings.push({ code: 'STORAGE_PATH_INVALID', severity: 'invalid', message: 'Storage path is not a directory' })
  if (profile.proxy_id && options.proxyResolvable === false) findings.push({ code: 'PROXY_UNAVAILABLE', severity: 'invalid', message: 'Proxy profile is configured fail-closed and cannot launch without a usable proxy' })
  const invalid = findings.some((item) => item.severity === 'invalid')
  const warning = findings.some((item) => item.severity === 'warning')
  return { valid: !invalid, status: invalid ? 'Invalid' : warning ? 'Warning' : 'Healthy', findings, identity: environment.identity, consistency }
}

module.exports = { validateProfile }
