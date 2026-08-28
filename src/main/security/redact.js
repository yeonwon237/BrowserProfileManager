/**
 * Secret redaction for all logging paths. Detects common credential shapes
 * (Authorization/Cookie headers, password/token/secret keys) and masks their
 * values before anything is written to a log.
 */
const HEADER_PATTERN = /(authorization|proxy-authorization|cookie|set-cookie)\s*[:=]\s*(?:Bearer\s+)?[^\s,;]+/gi
const KEY_VALUE_PATTERN =
  /(["\']?(?:password|passwd|pwd|secret|token|access_token|refresh_token|api[_-]?key|apikey|session_id|sessionid)["\']?\s*[:=]\s*)(["\']?)([^,"\'&\s;)}]+)/gi

const REDACTED = '[REDACTED]'

function redactSecrets(text) {
  if (typeof text !== 'string' || text.length === 0) return text

  let out = text
  out = out.replace(HEADER_PATTERN, (match, key) => {
    return `${key}: ${REDACTED}`
  })

  out = out.replace(KEY_VALUE_PATTERN, (match, prefix, _quote, value) => {
    if (!value) return match
    return `${prefix}${REDACTED}`
  })

  return out
}

function redactObject(obj, seen = new Set()) {
  if (obj === null || typeof obj !== 'object') return obj
  if (typeof obj === 'string') return redactSecrets(obj)
  if (seen.has(obj)) return obj
  seen.add(obj)

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, seen))
  }

  const SECRET_KEYS = ['password', 'passwd', 'pwd', 'secret', 'token', 'access_token', 'refresh_token', 'api_key', 'apikey', 'cookie', 'authorization', 'authorization_header']

  const out = {}
  for (const [key, value] of Object.entries(obj)) {
    if (SECRET_KEYS.includes(String(key).toLowerCase()) && typeof value === 'string') {
      out[key] = REDACTED
    } else {
      out[key] = redactObject(value, seen)
    }
  }
  return out
}

module.exports = { redactSecrets, redactObject, REDACTED }