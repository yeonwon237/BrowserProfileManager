const REQUIRED_STAGES = ['compatibility', 'fingerprint', 'isolation', 'network', 'smoke']

function evaluateBrowserUpdate({ currentVersion, candidateVersion, stages = {} } = {}) {
  const failures = REQUIRED_STAGES.filter((stage) => stages[stage]?.passed !== true).map((stage) => ({ stage, reason: stages[stage]?.reason || 'NOT_APPROVED' }))
  return {
    currentVersion: currentVersion || null,
    candidateVersion: candidateVersion || null,
    approved: Boolean(candidateVersion) && failures.length === 0,
    failures,
    action: Boolean(candidateVersion) && failures.length === 0 ? 'rollout-candidate' : 'keep-current-version',
  }
}

module.exports = { REQUIRED_STAGES, evaluateBrowserUpdate }
