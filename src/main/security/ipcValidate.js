/**
 * IPC input validation for the main process. Renderer-supplied data is
 * coerced/sanitized before it reaches the database or managers, so a
 * compromised renderer cannot inject arbitrary types, oversized strings, or
 * non-plain objects into the trusted side.
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function sanitizeString(value, max = 5000) {
  if (value === undefined || value === null) return value
  if (typeof value !== 'string') return String(value).slice(0, max)
  return value.slice(0, max)
}

function sanitizeStringOrNull(value, max = 5000) {
  if (value === undefined || value === null) return null
  return sanitizeString(value, max)
}

function sanitizeEnvironment(value) {
  if (value === undefined || value === null) return value
  if (!isPlainObject(value)) return { mode: 'default' }
  const out = {}
  for (const [key, val] of Object.entries(value)) {
    if (key.length > 64) continue
    if (typeof val === 'string') out[key] = val.slice(0, 500)
    else if (typeof val === 'number' && Number.isFinite(val)) out[key] = val
    else if (typeof val === 'boolean') out[key] = val
    else if (Array.isArray(val) && val.length <= 200) out[key] = val.map((x) => (typeof x === 'string' ? x.slice(0, 200) : x))
    else if (isPlainObject(val)) out[key] = sanitizeEnvironment(val)
  }
  return out
}

function sanitizeInputs(value) {
  if (!isPlainObject(value)) return {}
  const out = {}
  for (const [key, val] of Object.entries(value)) {
    if (key.length > 128) continue
    if (typeof val === 'string') out[key] = val.slice(0, 10000)
    else if (typeof val === 'number' && Number.isFinite(val)) out[key] = val
    else if (typeof val === 'boolean') out[key] = val
    else if (Array.isArray(val) && val.length <= 500) out[key] = val.map((x) => (typeof x === 'string' ? x.slice(0, 2000) : x))
  }
  return out
}

function validateProfilePayload(data) {
  if (!isPlainObject(data)) return { valid: false, errors: ['payload must be an object'] }
  const errors = []
  const sanitized = { ...data }

  if (data.name !== undefined && (typeof data.name !== 'string' || data.name.length === 0 || data.name.length > 120)) {
    errors.push('name must be a non-empty string (max 120 chars)')
  } else if (typeof data.name === 'string') {
    sanitized.name = data.name.trim().slice(0, 120)
  }

  for (const key of ['group', 'notes', 'browser_type', 'browser_channel', 'browser_version']) {
    if (data[key] !== undefined && data[key] !== null && typeof data[key] !== 'string') {
      errors.push(`${key} must be a string`)
    } else if (typeof data[key] === 'string') {
      sanitized[key] = data[key].slice(0, 2000)
    }
  }

  if (data.tags !== undefined && !Array.isArray(data.tags)) errors.push('tags must be an array')
  if (data.proxy_id !== undefined && data.proxy_id !== null && typeof data.proxy_id !== 'string') {
    errors.push('proxy_id must be a string or null')
  }
  if (data.environment !== undefined && !isPlainObject(data.environment)) {
    errors.push('environment must be an object')
  } else if (isPlainObject(data.environment)) {
    sanitized.environment = sanitizeEnvironment(data.environment)
  }

  return { valid: errors.length === 0, errors, sanitized }
}

function validateProxyPayload(data) {
  if (!isPlainObject(data)) return { valid: false, errors: ['payload must be an object'] }
  const errors = []
  const sanitized = { ...data }

  if (data.name !== undefined && (typeof data.name !== 'string' || data.name.length === 0 || data.name.length > 120)) {
    errors.push('name must be a non-empty string (max 120 chars)')
  }
  for (const key of ['host', 'username', 'password', 'country_code', 'country_name', 'city', 'timezone', 'notes']) {
    if (data[key] !== undefined && data[key] !== null && typeof data[key] !== 'string') {
      errors.push(`${key} must be a string`)
    } else if (typeof data[key] === 'string') {
      sanitized[key] = data[key].slice(0, 2000)
    }
  }
  if (data.protocol !== undefined && !['http', 'https', 'socks5'].includes(data.protocol)) {
    errors.push('protocol must be http, https or socks5')
  }
  if (data.port !== undefined && data.port !== null && (!Number.isInteger(Number(data.port)) || Number(data.port) < 0 || Number(data.port) > 65535)) {
    errors.push('port must be an integer between 0 and 65535')
  }

  return { valid: errors.length === 0, errors, sanitized }
}

function validateSettingValue(value) {
  if (value === undefined || value === null) return { valid: false }
  const type = typeof value
  if (type === 'string') return { valid: value.length <= 5000 }
  if (type === 'number') return { valid: Number.isFinite(value) }
  if (type === 'boolean') return { valid: true }
  return { valid: false }
}

module.exports = {
  isPlainObject,
  sanitizeString,
  sanitizeStringOrNull,
  sanitizeEnvironment,
  sanitizeInputs,
  validateProfilePayload,
  validateProxyPayload,
  validateSettingValue,
}