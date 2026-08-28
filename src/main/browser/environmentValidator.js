/**
 * Environment configuration validator for browser profiles.
 * Ensures consistent and reproducible environment states.
 */

function isValidLocale(locale) {
  if (!locale || typeof locale !== 'string') return false
  try {
    const loc = new Intl.Locale(locale)
    return Boolean(loc && loc.language)
  } catch {
    return false
  }
}

function isValidTimezone(timezone) {
  if (!timezone || typeof timezone !== 'string') return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

function validateEnvironment(env) {
  const errors = []
  if (!env || typeof env !== 'object') {
    return { valid: true, sanitized: { mode: 'default' } }
  }

  const mode = env.mode === 'custom' ? 'custom' : 'default'
  if (mode === 'default') {
    return { valid: true, sanitized: { mode: 'default' } }
  }

  const sanitized = { mode: 'custom' }

  // 1. Locale
  if (env.locale) {
    if (typeof env.locale === 'string' && isValidLocale(env.locale.trim())) {
      sanitized.locale = env.locale.trim()
    } else {
      errors.push(`Invalid locale "${env.locale}". Must be a valid BCP 47 language tag (e.g. "en-US", "vi-VN").`)
    }
  }

  // 2. Timezone
  if (env.timezone) {
    if (typeof env.timezone === 'string' && isValidTimezone(env.timezone.trim())) {
      sanitized.timezone = env.timezone.trim()
    } else {
      errors.push(`Invalid timezone "${env.timezone}". Must be a valid IANA timezone (e.g. "Asia/Ho_Chi_Minh", "America/New_York").`)
    }
  }

  // 3. Preferred Languages
  if (env.languages) {
    const langs = Array.isArray(env.languages)
      ? env.languages
      : String(env.languages).split(',').map((s) => s.trim()).filter(Boolean)
    const validLangs = []
    for (const lang of langs) {
      if (isValidLocale(lang)) {
        validLangs.push(lang)
      } else {
        errors.push(`Invalid language code in languages list: "${lang}"`)
      }
    }
    if (validLangs.length > 0) {
      sanitized.languages = validLangs
    }
  }

  // 4. Viewport
  if (env.viewport && typeof env.viewport === 'object') {
    const width = Number(env.viewport.width)
    const height = Number(env.viewport.height)
    if (width >= 320 && width <= 3840 && height >= 240 && height <= 2160) {
      sanitized.viewport = { width: Math.round(width), height: Math.round(height) }
    } else {
      errors.push(`Invalid viewport dimensions (${env.viewport.width}x${env.viewport.height}). Width must be 320-3840, Height 240-2160.`)
    }
  }

  // 5. Device Scale Factor
  if (env.deviceScaleFactor !== undefined && env.deviceScaleFactor !== null && env.deviceScaleFactor !== '') {
    const dsf = Number(env.deviceScaleFactor)
    if (dsf >= 0.5 && dsf <= 4) {
      sanitized.deviceScaleFactor = dsf
    } else {
      errors.push(`Invalid device scale factor "${env.deviceScaleFactor}". Must be between 0.5 and 4.`)
    }
  }

  // 6. Color Scheme
  if (env.colorScheme) {
    if (['light', 'dark', 'no-preference'].includes(env.colorScheme)) {
      sanitized.colorScheme = env.colorScheme
    } else {
      errors.push(`Invalid color scheme "${env.colorScheme}". Allowed: "light", "dark", "no-preference".`)
    }
  }

  // 7. Reduced Motion
  if (env.reducedMotion) {
    if (['no-preference', 'reduce'].includes(env.reducedMotion)) {
      sanitized.reducedMotion = env.reducedMotion
    } else {
      errors.push(`Invalid reduced motion "${env.reducedMotion}". Allowed: "no-preference", "reduce".`)
    }
  }

  // 8. Geolocation
  if (env.geolocation && typeof env.geolocation === 'object') {
    const lat = Number(env.geolocation.latitude)
    const lng = Number(env.geolocation.longitude)
    const acc = env.geolocation.accuracy !== undefined ? Number(env.geolocation.accuracy) : 10
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && acc >= 0) {
      sanitized.geolocation = { latitude: lat, longitude: lng, accuracy: acc }
    } else {
      errors.push(`Invalid geolocation coordinates (lat: ${env.geolocation.latitude}, lng: ${env.geolocation.longitude}). Lat must be -90..90, Lng -180..180.`)
    }
  }

  // 9. Permissions
  if (env.permissions) {
    const perms = Array.isArray(env.permissions) ? env.permissions : []
    sanitized.permissions = perms.map(String)
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  }
}

module.exports = {
  isValidLocale,
  isValidTimezone,
  validateEnvironment,
}
