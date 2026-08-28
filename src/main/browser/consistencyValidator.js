const COUNTRY_DATA = {
  US: {
    name: 'United States',
    timezones: [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Anchorage',
      'Pacific/Honolulu',
      'America/Phoenix',
      'America/Detroit',
      'America/Indiana/Indianapolis',
    ],
    primaryTimezone: 'America/New_York',
    locales: ['en-US', 'es-US', 'en'],
    primaryLocale: 'en-US',
    languages: ['en-US', 'en'],
  },
  VN: {
    name: 'Vietnam',
    timezones: ['Asia/Ho_Chi_Minh', 'Asia/Bangkok'],
    primaryTimezone: 'Asia/Ho_Chi_Minh',
    locales: ['vi-VN', 'vi', 'en-US'],
    primaryLocale: 'vi-VN',
    languages: ['vi-VN', 'vi', 'en-US', 'en'],
  },
  JP: {
    name: 'Japan',
    timezones: ['Asia/Tokyo'],
    primaryTimezone: 'Asia/Tokyo',
    locales: ['ja-JP', 'ja', 'en-US'],
    primaryLocale: 'ja-JP',
    languages: ['ja-JP', 'ja', 'en-US'],
  },
  GB: {
    name: 'United Kingdom',
    timezones: ['Europe/London', 'UTC', 'GMT'],
    primaryTimezone: 'Europe/London',
    locales: ['en-GB', 'en-US', 'en'],
    primaryLocale: 'en-GB',
    languages: ['en-GB', 'en-US', 'en'],
  },
  UK: {
    name: 'United Kingdom',
    timezones: ['Europe/London', 'UTC', 'GMT'],
    primaryTimezone: 'Europe/London',
    locales: ['en-GB', 'en-US', 'en'],
    primaryLocale: 'en-GB',
    languages: ['en-GB', 'en-US', 'en'],
  },
  DE: {
    name: 'Germany',
    timezones: ['Europe/Berlin'],
    primaryTimezone: 'Europe/Berlin',
    locales: ['de-DE', 'de', 'en-US'],
    primaryLocale: 'de-DE',
    languages: ['de-DE', 'de', 'en-US', 'en'],
  },
  FR: {
    name: 'France',
    timezones: ['Europe/Paris'],
    primaryTimezone: 'Europe/Paris',
    locales: ['fr-FR', 'fr', 'en-US'],
    primaryLocale: 'fr-FR',
    languages: ['fr-FR', 'fr', 'en-US', 'en'],
  },
  SG: {
    name: 'Singapore',
    timezones: ['Asia/Singapore'],
    primaryTimezone: 'Asia/Singapore',
    locales: ['en-SG', 'zh-SG', 'ms-SG', 'en-US'],
    primaryLocale: 'en-SG',
    languages: ['en-SG', 'en', 'zh-SG'],
  },
  KR: {
    name: 'South Korea',
    timezones: ['Asia/Seoul'],
    primaryTimezone: 'Asia/Seoul',
    locales: ['ko-KR', 'ko', 'en-US'],
    primaryLocale: 'ko-KR',
    languages: ['ko-KR', 'ko', 'en-US'],
  },
  AU: {
    name: 'Australia',
    timezones: [
      'Australia/Sydney',
      'Australia/Melbourne',
      'Australia/Brisbane',
      'Australia/Perth',
      'Australia/Adelaide',
      'Australia/Hobart',
      'Australia/Darwin',
    ],
    primaryTimezone: 'Australia/Sydney',
    locales: ['en-AU', 'en-US', 'en'],
    primaryLocale: 'en-AU',
    languages: ['en-AU', 'en-US', 'en'],
  },
  CA: {
    name: 'Canada',
    timezones: [
      'America/Toronto',
      'America/Vancouver',
      'America/Montreal',
      'America/Edmonton',
      'America/Winnipeg',
      'America/Halifax',
      'America/St_Johns',
    ],
    primaryTimezone: 'America/Toronto',
    locales: ['en-CA', 'fr-CA', 'en-US', 'en'],
    primaryLocale: 'en-CA',
    languages: ['en-CA', 'en-US', 'fr-CA', 'en'],
  },
  NL: {
    name: 'Netherlands',
    timezones: ['Europe/Amsterdam'],
    primaryTimezone: 'Europe/Amsterdam',
    locales: ['nl-NL', 'nl', 'en-US'],
    primaryLocale: 'nl-NL',
    languages: ['nl-NL', 'nl', 'en-US', 'en'],
  },
  HK: {
    name: 'Hong Kong',
    timezones: ['Asia/Hong_Kong'],
    primaryTimezone: 'Asia/Hong_Kong',
    locales: ['zh-HK', 'en-HK', 'zh-TW', 'en-US'],
    primaryLocale: 'zh-HK',
    languages: ['zh-HK', 'zh', 'en-HK', 'en-US'],
  },
  TW: {
    name: 'Taiwan',
    timezones: ['Asia/Taipei'],
    primaryTimezone: 'Asia/Taipei',
    locales: ['zh-TW', 'zh', 'en-US'],
    primaryLocale: 'zh-TW',
    languages: ['zh-TW', 'zh', 'en-US'],
  },
  TH: {
    name: 'Thailand',
    timezones: ['Asia/Bangkok'],
    primaryTimezone: 'Asia/Bangkok',
    locales: ['th-TH', 'th', 'en-US'],
    primaryLocale: 'th-TH',
    languages: ['th-TH', 'th', 'en-US', 'en'],
  },
  PH: {
    name: 'Philippines',
    timezones: ['Asia/Manila'],
    primaryTimezone: 'Asia/Manila',
    locales: ['en-PH', 'fil-PH', 'en-US'],
    primaryLocale: 'en-PH',
    languages: ['en-PH', 'fil-PH', 'en-US', 'en'],
  },
  ID: {
    name: 'Indonesia',
    timezones: ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'],
    primaryTimezone: 'Asia/Jakarta',
    locales: ['id-ID', 'id', 'en-US'],
    primaryLocale: 'id-ID',
    languages: ['id-ID', 'id', 'en-US', 'en'],
  },
  IN: {
    name: 'India',
    timezones: ['Asia/Kolkata'],
    primaryTimezone: 'Asia/Kolkata',
    locales: ['en-IN', 'hi-IN', 'en-US'],
    primaryLocale: 'en-IN',
    languages: ['en-IN', 'hi-IN', 'en-US', 'en'],
  },
  BR: {
    name: 'Brazil',
    timezones: ['America/Sao_Paulo', 'America/Bahia', 'America/Manaus', 'America/Fortaleza'],
    primaryTimezone: 'America/Sao_Paulo',
    locales: ['pt-BR', 'pt', 'en-US'],
    primaryLocale: 'pt-BR',
    languages: ['pt-BR', 'pt', 'en-US', 'en'],
  },
  RU: {
    name: 'Russia',
    timezones: ['Europe/Moscow', 'Asia/Yekaterinburg', 'Asia/Novosibirsk', 'Asia/Vladivostok'],
    primaryTimezone: 'Europe/Moscow',
    locales: ['ru-RU', 'ru', 'en-US'],
    primaryLocale: 'ru-RU',
    languages: ['ru-RU', 'ru', 'en-US'],
  },
}

function getCountryRule(countryCode) {
  if (!countryCode) return null
  const code = String(countryCode).toUpperCase().trim()
  return COUNTRY_DATA[code] || null
}

/**
 * Validate consistency between Proxy Geographic location and Profile Environment.
 *
 * @param {Object} profile - Profile object (may contain environment)
 * @param {Object} proxy - Proxy object with geo_metadata (country_code, timezone, etc.)
 * @returns {Object} { consistent: boolean, warnings: Array, suggestions: Object, proxyGeo: Object }
 */
function validateConsistency(profile = {}, proxy = null) {
  const warnings = []
  let proxyGeo = null

  if (!proxy || !proxy.id) {
    return {
      consistent: true,
      hasProxy: false,
      warnings: [],
      suggestions: null,
      proxyGeo: null,
      message: 'Direct connection (no proxy) — Environment is self-managed',
    }
  }

  // Extract proxy geo info
  if (proxy.geo_metadata && typeof proxy.geo_metadata === 'object') {
    proxyGeo = proxy.geo_metadata
  } else if (proxy.country_code) {
    proxyGeo = {
      country_code: proxy.country_code,
      country_name: proxy.country_name || proxy.country_code,
      timezone: proxy.timezone,
      city: proxy.city,
    }
  }

  if (!proxyGeo || !proxyGeo.country_code) {
    return {
      consistent: true,
      hasProxy: true,
      warnings: [],
      suggestions: null,
      proxyGeo: null,
      message: `Proxy "${proxy.name}" attached (Geo location not yet tested)`,
    }
  }

  const countryCode = String(proxyGeo.country_code).toUpperCase()
  const countryRule = getCountryRule(countryCode)
  const countryName = proxyGeo.country_name || (countryRule ? countryRule.name : countryCode)

  const env = (profile && profile.environment) ? profile.environment : { mode: 'default' }

  // Default suggestions based on proxy location
  const suggestions = {
    timezone: proxyGeo.timezone || (countryRule ? countryRule.primaryTimezone : 'UTC'),
    locale: countryRule ? countryRule.primaryLocale : 'en-US',
    languages: countryRule ? countryRule.languages : ['en-US', 'en'],
    country_name: countryName,
    country_code: countryCode,
  }

  // If profile is in custom mode, check for mismatches
  if (env.mode === 'custom') {
    // 1. Timezone Check
    if (env.timezone && countryRule) {
      const allowedTimezones = countryRule.timezones
      const matchesTimezone = allowedTimezones.some(
        (tz) => tz.toLowerCase() === env.timezone.toLowerCase() || env.timezone.toLowerCase().includes(tz.toLowerCase())
      )

      if (!matchesTimezone && proxyGeo.timezone && env.timezone !== proxyGeo.timezone) {
        warnings.push({
          type: 'timezone_mismatch',
          severity: 'warning',
          title: 'Timezone Mismatch',
          message: `Proxy is in ${countryName} (expected ${suggestions.timezone}) but profile timezone is set to "${env.timezone}".`,
          expected: suggestions.timezone,
          actual: env.timezone,
        })
      }
    }

    // 2. Locale Check
    if (env.locale && countryRule) {
      const allowedLocales = countryRule.locales
      const normLocale = env.locale.toLowerCase()
      const matchesLocale = allowedLocales.some(
        (loc) => loc.toLowerCase() === normLocale || normLocale.startsWith(loc.toLowerCase().split('-')[0])
      )

      if (!matchesLocale) {
        warnings.push({
          type: 'locale_mismatch',
          severity: 'info',
          title: 'Locale Notice',
          message: `Proxy is in ${countryName} but profile locale is set to "${env.locale}" (suggested: ${suggestions.locale}).`,
          expected: suggestions.locale,
          actual: env.locale,
        })
      }
    }
  }

  const consistent = warnings.filter((w) => w.severity === 'warning').length === 0

  return {
    consistent,
    hasProxy: true,
    warnings,
    suggestions,
    proxyGeo,
    message: consistent
      ? `Network & Environment Consistent (${countryName} • ${suggestions.timezone})`
      : `Consistency Notice: ${warnings.map((w) => w.title).join(', ')}`,
  }
}

/**
 * Automatically update an environment configuration to match a proxy's geographic location.
 *
 * @param {Object} environment - Current environment object
 * @param {Object} proxy - Proxy object with geo information
 * @returns {Object} Updated environment object
 */
function applyProxyGeoToEnvironment(environment = {}, proxy = null) {
  if (!proxy) return environment

  let geo = proxy.geo_metadata || {}
  if (!geo.country_code && proxy.country_code) {
    geo = {
      country_code: proxy.country_code,
      country_name: proxy.country_name,
      timezone: proxy.timezone,
    }
  }

  const countryRule = getCountryRule(geo.country_code)
  const targetTimezone = geo.timezone || (countryRule ? countryRule.primaryTimezone : 'UTC')
  const targetLocale = countryRule ? countryRule.primaryLocale : 'en-US'
  const targetLanguages = countryRule ? countryRule.languages : ['en-US', 'en']

  return {
    ...environment,
    mode: 'custom',
    timezone: targetTimezone,
    locale: targetLocale,
    languages: targetLanguages,
  }
}

module.exports = {
  COUNTRY_DATA,
  getCountryRule,
  validateConsistency,
  applyProxyGeoToEnvironment,
}
