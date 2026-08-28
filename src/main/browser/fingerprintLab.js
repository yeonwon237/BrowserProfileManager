const crypto = require('crypto')
const { createIdentity, validateIdentity } = require('./profileIdentity')

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function runIdentityLab({ profileIds = [], environment = { mode: 'default' }, browserType = 'chromium' } = {}) {
  const identities = profileIds.map((profileId) => ({
    profileId,
    identity: createIdentity(profileId, environment, browserType),
  }))
  const hashes = identities.map(({ identity }) => stableHash(identity))
  const keys = identities.map(({ identity }) => identity.profileKey)
  const invalid = identities
    .map(({ profileId, identity }) => ({ profileId, ...validateIdentity(identity) }))
    .filter((result) => !result.valid)
  const repeatedRunDrift = identities.filter(({ profileId, identity }) => {
    return stableHash(identity) !== stableHash(createIdentity(profileId, environment, browserType))
  })
  const hashCollisions = hashes.length - new Set(hashes).size
  const keyCollisions = keys.length - new Set(keys).size

  return {
    passed: invalid.length === 0 && repeatedRunDrift.length === 0 && hashCollisions === 0 && keyCollisions === 0,
    sampleSize: identities.length,
    stableCount: identities.length - repeatedRunDrift.length,
    uniqueHashCount: new Set(hashes).size,
    uniqueProfileKeyCount: new Set(keys).size,
    hashCollisions,
    keyCollisions,
    invalid,
    driftProfileIds: repeatedRunDrift.map((item) => item.profileId),
    identityVersion: identities[0]?.identity.version || null,
    generatedAt: new Date().toISOString(),
  }
}

function compareRuntimeSnapshots(snapshots = []) {
  if (snapshots.length < 2) return { stable: true, drift: [] }
  const fields = ['userAgent', 'platform', 'language', 'timezone', 'hardwareConcurrency', 'deviceMemory', 'webglRenderer']
  const baseline = snapshots[0]
  const drift = []
  for (let index = 1; index < snapshots.length; index += 1) {
    for (const field of fields) {
      if (JSON.stringify(snapshots[index]?.[field]) !== JSON.stringify(baseline?.[field])) {
        drift.push({ run: index + 1, field, expected: baseline?.[field], actual: snapshots[index]?.[field] })
      }
    }
  }
  return { stable: drift.length === 0, drift }
}

module.exports = { stableHash, runIdentityLab, compareRuntimeSnapshots }
