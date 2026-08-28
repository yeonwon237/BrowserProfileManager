const { getPlatformTemplate } = require('./deviceTemplates')

function buildFontProfile(identity = {}) {
  const expected = getPlatformTemplate(identity.platformFamily).fonts || []
  const declared = Array.isArray(identity.fonts) ? identity.fonts : expected
  return { platformFamily: identity.platformFamily, declared: [...new Set(declared)], expected }
}

function auditFontProfile(identity = {}, measurableFonts = []) {
  const profile = buildFontProfile(identity)
  const foreign = profile.declared.filter((font) => !profile.expected.includes(font))
  const measurableSet = new Set(measurableFonts)
  const unavailable = measurableFonts.length ? profile.declared.filter((font) => !measurableSet.has(font)) : []
  return { healthy: foreign.length === 0 && unavailable.length === 0, foreign, unavailable, profile }
}

module.exports = { buildFontProfile, auditFontProfile }
