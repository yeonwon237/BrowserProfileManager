function auditCrossProfileCollisions(profiles = [], runtimeEntries = []) {
  const findings = []
  const seenStorage = new Map()
  const seenContext = new Map()
  for (const profile of profiles) {
    const storage = profile.browser_data_path
    if (storage && seenStorage.has(storage)) findings.push({ code: 'SHARED_STORAGE_PATH', severity: 'invalid', profiles: [seenStorage.get(storage), profile.id] })
    else if (storage) seenStorage.set(storage, profile.id)
  }
  for (const entry of runtimeEntries) {
    if (!entry.context) continue
    if (seenContext.has(entry.context)) findings.push({ code: 'SHARED_BROWSER_CONTEXT', severity: 'invalid', profiles: [seenContext.get(entry.context), entry.profileId] })
    else seenContext.set(entry.context, entry.profileId)
  }
  const invalid = findings.some((finding) => finding.severity === 'invalid')
  return { status: invalid ? 'Invalid' : 'Healthy', findings }
}

module.exports = { auditCrossProfileCollisions }
