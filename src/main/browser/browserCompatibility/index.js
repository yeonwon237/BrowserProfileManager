const DEFAULT = {
  minMajor: 120,
  clientHints: true,
  webGpu: true,
  pluginBehavior: 'native',
  permissions: ['notifications', 'geolocation', 'camera', 'microphone'],
}

function forChromiumMajor(input) {
  const major = Number(String(input || '').match(/\d+/)?.[0] || 0)
  if (!major) return { ...DEFAULT, major: null, supported: false, reason: 'BROWSER_VERSION_UNKNOWN' }
  return {
    ...DEFAULT,
    major,
    supported: major >= DEFAULT.minMajor,
    reason: major >= DEFAULT.minMajor ? null : 'BROWSER_VERSION_BELOW_SUPPORTED_MATRIX',
    highEntropyHints: ['architecture', 'bitness', 'model', 'platformVersion', 'uaFullVersion', 'fullVersionList'],
  }
}

function validateRuntimeCompatibility(identity = {}, browserVersion = '') {
  const matrix = forChromiumMajor(browserVersion)
  const issues = []
  if (!matrix.supported) issues.push(matrix.reason)
  if (identity.browserVersionPolicy !== 'runtime-major') issues.push('UNSUPPORTED_BROWSER_VERSION_POLICY')
  return { valid: issues.length === 0, issues, matrix }
}

module.exports = { forChromiumMajor, validateRuntimeCompatibility }
