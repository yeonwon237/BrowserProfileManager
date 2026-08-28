const { getDb } = require('../database')

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
 * Searches across Profiles, Automations, Proxies, Runs, and Workspaces.
 * Strictly queries database metadata — NEVER parses cookie/session binaries.
 */
async function globalSearch(queryStr = '', options = {}) {
  const q = String(queryStr || '').trim().slice(0, 200)
  if (!q) {
    return {
      profiles: [],
      automations: [],
      proxies: [],
      runs: [],
      workspaces: [],
      total: 0,
    }
  }

  const db = await getDb()
  const escaped = q.replace(/[\\%_]/g, (char) => `\\${char}`)
  const pattern = `%${escaped}%`
  const limit = Math.max(1, Math.min(Number(options.limit) || 10, 50))
  const workspaceId = options.workspace_id

  // 1. Profiles
  let profileSql = `
    SELECT id, name, group_name, tags, browser_type, status, workspace_id
    FROM profiles
    WHERE (name LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\' OR group_name LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')
  `
  const profileParams = [pattern, pattern, pattern, pattern]
  if (workspaceId && workspaceId !== 'all') {
    profileSql += ' AND (workspace_id = ? OR workspace_id IS NULL)'
    profileParams.push(workspaceId)
  }
  profileSql += ' LIMIT ?'
  profileParams.push(limit)

  const profileRows = toArray(db.exec(profileSql, profileParams))
  const profiles = profileRows.map((r) => {
    let parsedTags = []
    try { parsedTags = JSON.parse(r.tags) } catch {}
    return {
      id: r.id,
      name: r.name,
      group: r.group_name,
      tags: Array.isArray(parsedTags) ? parsedTags : [],
      browserType: r.browser_type,
      status: r.status,
      workspaceId: r.workspace_id,
      category: 'profiles',
    }
  })

  // 2. Automations
  let automations = []
  try {
    const automationManager = require('../automation/manager')
    const allTools = await automationManager.scanAutomations()
    const lowerQ = q.toLowerCase()
    automations = (allTools || [])
      .filter((t) => {
        const nameMatch = t.name && t.name.toLowerCase().includes(lowerQ)
        const idMatch = t.id && t.id.toLowerCase().includes(lowerQ)
        const descMatch = t.description && t.description.toLowerCase().includes(lowerQ)
        return nameMatch || idMatch || descMatch
      })
      .slice(0, limit)
      .map((t) => ({
        id: t.id,
        name: t.name || t.id,
        description: t.description,
        version: t.version,
        enabled: Boolean(t.enabled),
        category: 'automations',
      }))
  } catch {
    // ignore
  }

  // 3. Proxies
  let proxySql = `
    SELECT id, name, protocol, host, port, country_code, city, workspace_id
    FROM proxies
    WHERE (name LIKE ? ESCAPE '\\' OR host LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\' OR country_code LIKE ? ESCAPE '\\' OR city LIKE ? ESCAPE '\\')
  `
  const proxyParams = [pattern, pattern, pattern, pattern, pattern]
  if (workspaceId && workspaceId !== 'all') {
    proxySql += ' AND (workspace_id = ? OR workspace_id IS NULL)'
    proxyParams.push(workspaceId)
  }
  proxySql += ' LIMIT ?'
  proxyParams.push(limit)

  const proxyRows = toArray(db.exec(proxySql, proxyParams))
  const proxies = proxyRows.map((r) => ({
    id: r.id,
    name: r.name,
    protocol: r.protocol,
    host: r.host,
    port: r.port,
    country: r.country_code,
    city: r.city,
    workspaceId: r.workspace_id,
    category: 'proxies',
  }))

  // 4. Runs
  let runSql = `
    SELECT id, tool_name, profile_name, status, start_time, duration_ms, error
    FROM runs
    WHERE (id LIKE ? ESCAPE '\\' OR tool_name LIKE ? ESCAPE '\\' OR profile_name LIKE ? ESCAPE '\\' OR error LIKE ? ESCAPE '\\')
  `
  const runParams = [pattern, pattern, pattern, pattern]
  if (workspaceId && workspaceId !== 'all') {
    runSql += ' AND (workspace_id = ? OR workspace_id IS NULL)'
    runParams.push(workspaceId)
  }
  runSql += ' ORDER BY start_time DESC LIMIT ?'
  runParams.push(limit)

  const runRows = toArray(db.exec(runSql, runParams))
  const runs = runRows.map((r) => ({
    id: r.id,
    toolName: r.tool_name,
    profileName: r.profile_name,
    status: r.status,
    startTime: r.start_time,
    durationMs: r.duration_ms,
    error: r.error,
    category: 'runs',
  }))

  // 5. Workspaces
  const wsSql = `
    SELECT id, name, description, is_default, is_archived
    FROM workspaces
    WHERE (name LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')
    LIMIT ?
  `
  const wsRows = toArray(db.exec(wsSql, [pattern, pattern, pattern, limit]))
  const workspaces = wsRows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isDefault: Boolean(r.is_default),
    isArchived: Boolean(r.is_archived),
    category: 'workspaces',
  }))

  const total =
    profiles.length +
    automations.length +
    proxies.length +
    runs.length +
    workspaces.length

  return {
    query: q,
    profiles,
    automations,
    proxies,
    runs,
    workspaces,
    total,
  }
}

module.exports = {
  globalSearch,
}
