const profilesRepo = require('../database/profiles')
const proxiesRepo = require('../database/proxies')

/**
 * Maps a proxy's country code to a consistent browser environment
 * (timezone + locale + language). Anti-detect checkers (IPhey, BrowserLeaks,
 * etc.) flag a LOW trust score when the profile's timezone/language does NOT
 * match the IP's country. Aligning them makes the profile look like a real
 * user in that country.
 */
const COUNTRY_ENVIRONMENT = {
  KR: { timezone: 'Asia/Seoul', locale: 'ko-KR', language: 'ko' },
  JP: { timezone: 'Asia/Tokyo', locale: 'ja-JP', language: 'ja' },
  VN: { timezone: 'Asia/Ho_Chi_Minh', locale: 'vi-VN', language: 'vi' },
  TH: { timezone: 'Asia/Bangkok', locale: 'th-TH', language: 'th' },
  ID: { timezone: 'Asia/Jakarta', locale: 'id-ID', language: 'id' },
  PH: { timezone: 'Asia/Manila', locale: 'en-PH', language: 'en' },
  MY: { timezone: 'Asia/Kuala_Lumpur', locale: 'ms-MY', language: 'ms' },
  SG: { timezone: 'Asia/Singapore', locale: 'en-SG', language: 'en' },
  HK: { timezone: 'Asia/Hong_Kong', locale: 'zh-HK', language: 'zh' },
  TW: { timezone: 'Asia/Taipei', locale: 'zh-TW', language: 'zh' },
  CN: { timezone: 'Asia/Shanghai', locale: 'zh-CN', language: 'zh' },
  US: { timezone: 'America/New_York', locale: 'en-US', language: 'en' },
  GB: { timezone: 'Europe/London', locale: 'en-GB', language: 'en' },
  CA: { timezone: 'America/Toronto', locale: 'en-CA', language: 'en' },
  AU: { timezone: 'Australia/Sydney', locale: 'en-AU', language: 'en' },
  DE: { timezone: 'Europe/Berlin', locale: 'de-DE', language: 'de' },
  FR: { timezone: 'Europe/Paris', locale: 'fr-FR', language: 'fr' },
  ES: { timezone: 'Europe/Madrid', locale: 'es-ES', language: 'es' },
  IT: { timezone: 'Europe/Rome', locale: 'it-IT', language: 'it' },
  PT: { timezone: 'Europe/Lisbon', locale: 'pt-PT', language: 'pt' },
  NL: { timezone: 'Europe/Amsterdam', locale: 'nl-NL', language: 'nl' },
  PL: { timezone: 'Europe/Warsaw', locale: 'pl-PL', language: 'pl' },
  TR: { timezone: 'Europe/Istanbul', locale: 'tr-TR', language: 'tr' },
  RU: { timezone: 'Europe/Moscow', locale: 'ru-RU', language: 'ru' },
  UA: { timezone: 'Europe/Kyiv', locale: 'uk-UA', language: 'uk' },
  BR: { timezone: 'America/Sao_Paulo', locale: 'pt-BR', language: 'pt' },
  MX: { timezone: 'America/Mexico_City', locale: 'es-MX', language: 'es' },
  AR: { timezone: 'America/Argentina/Buenos_Aires', locale: 'es-AR', language: 'es' },
  CO: { timezone: 'America/Bogota', locale: 'es-CO', language: 'es' },
  CL: { timezone: 'America/Santiago', locale: 'es-CL', language: 'es' },
  IN: { timezone: 'Asia/Kolkata', locale: 'en-IN', language: 'en' },
}

/**
 * Updates a profile's runtime environment (timezone, locale, languages) to
 * match the country of the proxy assigned to it. This removes the classic
 * "IP is Korea but browser is Vietnam" mismatch that makes anti-detect checks
 * report an unreliable digital identity.
 */
async function alignEnvironmentToProxy(profileId) {
  const profile = await profilesRepo.getProfileById(profileId)
  if (!profile) return { success: false, error: 'Profile not found' }

  const proxy = profile.proxy || (profile.proxy_id ? await proxiesRepo.getProxyById(profile.proxy_id) : null)
  if (!proxy) return { success: false, error: 'Profile has no proxy assigned' }

  const country = String(proxy.country_code || '').toUpperCase()
  const env = COUNTRY_ENVIRONMENT[country]
  if (!env) {
    return { success: false, error: `Chưa có cấu hình môi trường cho quốc gia "${country}". Hãy chạy nút Check trên proxy để lấy quốc gia, hoặc tự đặt timezone/locale trong Edit Profile.` }
  }

  // Prefer timezone reported by the live geo check when present (more accurate
  // for multi-zone countries like US), else fall back to country defaults.
  const proxyTz = proxy.timezone || (proxy.geo_metadata && proxy.geo_metadata.timezone) || null
  const timezone = proxyTz || env.timezone

  const current = profile.environment && typeof profile.environment === 'object' ? profile.environment : { mode: 'default' }
  // Drop the cached runtime `identity` — otherwise ensureIdentity() would reuse
  // the old locale/timezone at launch instead of regenerating from the new env.
  const { identity: _identity, ...rest } = current
  const nextEnvironment = {
    ...rest,
    mode: 'custom',
    locale: env.locale,
    languages: [env.locale, env.language],
    timezone,
  }
  await profilesRepo.updateProfile(profileId, { environment: nextEnvironment })
  return { success: true, profileId, country, environment: nextEnvironment }
}

module.exports = { alignEnvironmentToProxy, COUNTRY_ENVIRONMENT }