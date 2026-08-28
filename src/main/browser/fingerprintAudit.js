function issue(code, severity, message, expected = null, actual = null) {
  return { code, severity, message, expected, actual }
}

function auditFingerprint(config = {}, runtime = {}) {
  const issues = []
  const ua = String(runtime.userAgent || '')
  const platform = String(runtime.platform || '')
  const env = config.environment || config || {}

  if (/Windows NT/i.test(ua) && !/^Win/i.test(platform)) issues.push(issue('UA_PLATFORM_MISMATCH', 'error', 'Windows user agent does not match navigator.platform', 'Win32/Win64', platform))
  if (/Macintosh|Mac OS X/i.test(ua) && !/^Mac/i.test(platform)) issues.push(issue('UA_PLATFORM_MISMATCH', 'error', 'macOS user agent does not match navigator.platform', 'MacIntel', platform))
  if (/Linux/i.test(ua) && !/Linux/i.test(platform)) issues.push(issue('UA_PLATFORM_MISMATCH', 'error', 'Linux user agent does not match navigator.platform', 'Linux', platform))
  if (runtime.webdriver === true) issues.push(issue('WEBDRIVER_EXPOSED', 'warning', 'navigator.webdriver is exposed; some sites may treat automation differently'))

  const languages = Array.isArray(runtime.languages) ? runtime.languages : []
  if (runtime.language && languages.length && String(runtime.language).toLowerCase() !== String(languages[0]).toLowerCase()) {
    issues.push(issue('LANGUAGE_ORDER_MISMATCH', 'warning', 'navigator.language must match the first navigator.languages entry', runtime.language, languages[0]))
  }
  if (env.mode === 'custom' && env.locale && runtime.language && env.locale.toLowerCase() !== runtime.language.toLowerCase()) {
    issues.push(issue('CONFIG_LOCALE_DRIFT', 'error', 'Configured locale differs from runtime language', env.locale, runtime.language))
  }
  if (env.mode === 'custom' && env.timezone && runtime.timezone && env.timezone.toLowerCase() !== runtime.timezone.toLowerCase()) {
    issues.push(issue('CONFIG_TIMEZONE_DRIFT', 'error', 'Configured timezone differs from runtime timezone', env.timezone, runtime.timezone))
  }
  if (runtime.viewport && runtime.screen && (runtime.viewport.innerWidth > runtime.screen.width || runtime.viewport.innerHeight > runtime.screen.height)) {
    issues.push(issue('VIEWPORT_SCREEN_IMPOSSIBLE', 'error', 'Viewport dimensions cannot exceed screen dimensions'))
  }
  const cores = Number(runtime.hardwareConcurrency)
  if (!Number.isInteger(cores) || cores < 1 || cores > 128) issues.push(issue('HARDWARE_CONCURRENCY_INVALID', 'error', 'hardwareConcurrency is outside plausible bounds', '1–128', runtime.hardwareConcurrency))
  const memory = Number(runtime.deviceMemory)
  if (runtime.deviceMemory !== 'N/A' && (!Number.isFinite(memory) || memory < 0.25 || memory > 64)) issues.push(issue('DEVICE_MEMORY_INVALID', 'warning', 'deviceMemory is outside common browser bounds', '0.25–64', runtime.deviceMemory))
  if (/SwiftShader|llvmpipe/i.test(String(runtime.webglRenderer || ''))) issues.push(issue('SOFTWARE_RENDERER', 'info', 'Software WebGL renderer detected; this may be expected in headless or virtualized environments'))
  if (!runtime.canvasAvailable || !runtime.webglAvailable) issues.push(issue('GRAPHICS_API_MISSING', 'warning', 'Canvas or WebGL is unavailable'))
  if (runtime.nativeCodeCloaked === false) issues.push(issue('NATIVE_CODE_TAMPERED', 'error', 'JavaScript prototype hooks leak non-native toString signatures'))
  if (runtime.chromeRuntimeMissing === true && !/Firefox/i.test(ua)) issues.push(issue('CHROME_RUNTIME_MISSING', 'warning', 'window.chrome runtime object is missing in Chromium profile'))

  const penalties = { error: 20, warning: 8, info: 2 }
  const score = Math.max(0, 100 - issues.reduce((sum, item) => sum + penalties[item.severity], 0))
  return {
    score,
    grade: score >= 95 ? 'A' : score >= 85 ? 'B' : score >= 70 ? 'C' : score >= 50 ? 'D' : 'F',
    consistent: !issues.some((item) => item.severity === 'error'),
    issues,
    auditedAt: new Date().toISOString(),
  }
}

module.exports = { auditFingerprint }
