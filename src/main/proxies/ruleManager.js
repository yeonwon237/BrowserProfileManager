const { getDb, saveDb } = require('../database')
const proxiesRepo = require('../database/proxies')

function toArray(result) {
  if (!result || result.length === 0) return []
  const cols = result[0].columns
  return result[0].values.map((row) => {
    const obj = {}
    cols.forEach((col, i) => { obj[col] = row[i] })
    return obj
  })
}

/**
 * Returns proxies with assigned profile counts.
 */
async function getProxyStats(options = {}) {
  const db = await getDb()
  const proxies = await proxiesRepo.getAllProxies(options)

  // Query live assignment count
  const countRows = toArray(
    db.exec(`SELECT proxy_id, COUNT(*) as count FROM profiles WHERE proxy_id IS NOT NULL AND proxy_id != '' GROUP BY proxy_id`)
  )
  const countMap = new Map(countRows.map((r) => [r.proxy_id, Number(r.count) || 0]))

  return proxies.map((p) => {
    const assignedCount = countMap.get(p.id) || 0
    const max = p.max_profiles || 5
    return {
      ...p,
      assigned_profile_count: assignedCount,
      is_over_limit: assignedCount > max,
      capacity_remaining: Math.max(0, max - assignedCount),
    }
  })
}

/**
 * Assigns proxy to a list of profiles using the chosen strategy:
 * - 'least_used': sorts proxy pool by assigned_count ascending, assigns to least loaded.
 * - 'round_robin': cycles through available proxies sequentially.
 * - 'manual': assigns all profiles to single specified proxyId.
 */
async function applyAssignmentRule({
  ruleType = 'unassigned', // 'unassigned', 'group', 'workspace', 'selected'
  targetProfileIds,
  proxyPoolIds,
  mode = 'least_used', // 'least_used', 'round_robin', 'manual'
  manualProxyId,
  groupName,
  workspaceId,
  maxPerProxy = 5,
  allowExceed = true,
} = {}) {
  const db = await getDb()

  // 1. Resolve target profile IDs
  let profileIds = []
  if (Array.isArray(targetProfileIds) && targetProfileIds.length > 0) {
    profileIds = [...targetProfileIds]
  } else if (ruleType === 'unassigned') {
    let q = `SELECT id FROM profiles WHERE (proxy_id IS NULL OR proxy_id = '')`
    const p = []
    if (workspaceId && workspaceId !== 'all') {
      q += ' AND (workspace_id = ? OR workspace_id IS NULL)'
      p.push(workspaceId)
    }
    const rows = toArray(db.exec(q, p))
    profileIds = rows.map((r) => r.id)
  } else if (ruleType === 'group' && groupName) {
    const rows = toArray(db.exec(`SELECT id FROM profiles WHERE group_name = ?`, [groupName]))
    profileIds = rows.map((r) => r.id)
  } else if (ruleType === 'workspace' && workspaceId) {
    const rows = toArray(db.exec(`SELECT id FROM profiles WHERE workspace_id = ?`, [workspaceId]))
    profileIds = rows.map((r) => r.id)
  }

  if (profileIds.length === 0) {
    return { success: true, assignedCount: 0, warnings: ['No matching target profiles found'] }
  }

  // 2. Resolve proxy pool
  let proxyPool = await getProxyStats({ workspace_id: workspaceId })
  if (Array.isArray(proxyPoolIds) && proxyPoolIds.length > 0) {
    const poolSet = new Set(proxyPoolIds)
    proxyPool = proxyPool.filter((p) => poolSet.has(p.id))
  }

  if (proxyPool.length === 0 && mode !== 'manual') {
    return { success: false, assignedCount: 0, error: 'No proxies available in selected pool' }
  }

  const warnings = []
  const assignments = []

  if (mode === 'manual') {
    const targetProxy = proxyPool.find((p) => p.id === manualProxyId)
    if (!targetProxy) return { success: false, assignedCount: 0, error: 'Selected proxy does not exist or is outside this workspace' }
    const projected = targetProxy.assigned_profile_count + profileIds.length
    const limit = targetProxy.max_profiles || maxPerProxy
    if (projected > limit) warnings.push(`Proxy "${targetProxy.name}" would exceed configured limit of ${limit} profiles`)
    if (projected > limit && !allowExceed) {
      return { success: false, assignedCount: 0, error: warnings[0], warnings }
    }
    for (const pid of profileIds) {
      assignments.push({ profileId: pid, proxyId: targetProxy.id })
    }
  } else if (mode === 'round_robin') {
    let pIdx = 0
    for (const pid of profileIds) {
      const chosen = proxyPool[pIdx % proxyPool.length]
      assignments.push({ profileId: pid, proxyId: chosen.id })
      chosen.assigned_profile_count++
      pIdx++
    }
  } else {
    // 'least_used' (default)
    for (const pid of profileIds) {
      // Sort by assigned_profile_count ascending
      proxyPool.sort((a, b) => a.assigned_profile_count - b.assigned_profile_count)
      const chosen = proxyPool[0]
      if (chosen.assigned_profile_count >= (chosen.max_profiles || maxPerProxy)) {
        warnings.push(`Proxy "${chosen.name}" exceeded configured limit of ${chosen.max_profiles || maxPerProxy} profiles`)
      }
      assignments.push({ profileId: pid, proxyId: chosen.id })
      chosen.assigned_profile_count++
    }
  }

  // Execute database updates in batch
  db.run('BEGIN TRANSACTION')
  for (const { profileId, proxyId } of assignments) {
    db.run(`UPDATE profiles SET proxy_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [proxyId, profileId])
  }
  db.run('COMMIT')
  saveDb()

  // Align timezone/locale to each proxy country after bulk assign.
  const align = require('../browser/environmentAlign')
  for (const { profileId } of assignments) {
    try {
      await align.alignEnvironmentToProxy(profileId)
    } catch {
      // best-effort per profile
    }
  }

  return {
    success: true,
    assignedCount: assignments.length,
    warnings: Array.from(new Set(warnings)),
    assignments,
  }
}

/**
 * Bulk removes proxy assignments from specified profiles.
 */
async function bulkRemoveProxy({ profileIds = [] } = {}) {
  if (!Array.isArray(profileIds) || profileIds.length === 0) {
    return { success: true, removedCount: 0 }
  }

  const db = await getDb()
  db.run('BEGIN TRANSACTION')
  for (const id of profileIds) {
    db.run(`UPDATE profiles SET proxy_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id])
  }
  db.run('COMMIT')
  saveDb()

  return { success: true, removedCount: profileIds.length }
}

module.exports = {
  getProxyStats,
  applyAssignmentRule,
  bulkRemoveProxy,
}
