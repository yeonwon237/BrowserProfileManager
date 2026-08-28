const profilesRepo = require('../database/profiles')
const proxiesRepo = require('../database/proxies')

const IMPORT_FIELDS = new Set(['name', 'group', 'tags', 'notes', 'browser_type', 'locale', 'timezone', 'proxy'])
const MAX_CSV_BYTES = 10 * 1024 * 1024
const MAX_IMPORT_ROWS = 10000

/**
 * Basic RFC4180 compliant CSV parser.
 */
function parseCsvRows(csvString) {
  const lines = []
  let currentRow = []
  let currentVal = ''
  let insideQuotes = false

  const text = String(csvString || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentVal += '"'
        i++
      } else {
        insideQuotes = !insideQuotes
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentVal.trim())
      currentVal = ''
    } else if (char === '\n' && !insideQuotes) {
      currentRow.push(currentVal.trim())
      if (currentRow.some((c) => c.length > 0)) {
        lines.push(currentRow)
      }
      currentRow = []
      currentVal = ''
    } else {
      currentVal += char
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim())
    if (currentRow.some((c) => c.length > 0)) {
      lines.push(currentRow)
    }
  }

  return lines
}

/**
 * Parses CSV and returns preview with validation.
 */
function parseAndValidateCsv(csvContent, customMapping = {}) {
  if (Buffer.byteLength(String(csvContent || ''), 'utf8') > MAX_CSV_BYTES) {
    return { success: false, error: 'CSV file exceeds the 10 MB safety limit', headers: [], rows: [] }
  }
  const rawRows = parseCsvRows(csvContent)
  if (rawRows.length < 2) {
    return { success: false, error: 'CSV file must have a header row and at least 1 data row', headers: [], rows: [] }
  }

  const headers = rawRows[0]
  const dataRows = rawRows.slice(1, MAX_IMPORT_ROWS + 1)

  // Default header mapping heuristic
  const mapping = {}
  for (const [index, field] of Object.entries(customMapping || {})) {
    if (IMPORT_FIELDS.has(field)) mapping[index] = field
  }
  headers.forEach((h, idx) => {
    const lower = h.toLowerCase()
    if (!mapping[idx]) {
      if (lower === 'name' || lower === 'profile_name' || lower === 'profilename') mapping[idx] = 'name'
      else if (lower === 'group' || lower === 'group_name') mapping[idx] = 'group'
      else if (lower === 'tags' || lower === 'tag') mapping[idx] = 'tags'
      else if (lower === 'browser' || lower === 'browser_type') mapping[idx] = 'browser_type'
      else if (lower === 'locale' || lower === 'lang') mapping[idx] = 'locale'
      else if (lower === 'timezone' || lower === 'tz') mapping[idx] = 'timezone'
      else if (lower === 'proxy' || lower === 'proxy_id' || lower === 'proxy_host') mapping[idx] = 'proxy'
      else if (lower === 'notes' || lower === 'note') mapping[idx] = 'notes'
    }
  })

  const validatedRows = []

  dataRows.forEach((row, rowIdx) => {
    const rowObj = {}
    row.forEach((val, colIdx) => {
      const targetField = mapping[colIdx]
      if (targetField) {
        rowObj[targetField] = val
      }
    })

    // Strict Security Guard: Never allow cookies, session tokens or passwords from external CSV
    delete rowObj.cookie
    delete rowObj.cookies
    delete rowObj.session
    delete rowObj.session_state
    delete rowObj.password
    delete rowObj.auth_token

    const validation = validateRow(rowObj, rowIdx + 1)
    validatedRows.push({
      rowIndex: rowIdx + 1,
      data: rowObj,
      status: validation.status, // 'VALID', 'WARNING', 'INVALID'
      errors: validation.errors,
      warnings: validation.warnings,
    })
  })

  const validCount = validatedRows.filter((r) => r.status === 'VALID').length
  const warnCount = validatedRows.filter((r) => r.status === 'WARNING').length
  const invalidCount = validatedRows.filter((r) => r.status === 'INVALID').length

  return {
    success: true,
    headers,
    mapping,
    totalRows: validatedRows.length,
    validCount,
    warnCount,
    invalidCount,
    rows: validatedRows,
  }
}

function validateRow(data, rowNum) {
  const errors = []
  const warnings = []

  if (!data.name || !String(data.name).trim()) {
    errors.push(`Row ${rowNum}: Profile name is required`)
  }

  if (data.browser_type) {
    const b = String(data.browser_type).toLowerCase()
    if (!['chromium', 'chrome', 'msedge', 'firefox'].includes(b)) {
      warnings.push(`Row ${rowNum}: Unknown browser type "${data.browser_type}", defaulting to chromium`)
    }
  }

  if (data.tags && typeof data.tags === 'string') {
    // string tags comma-separated
    data.tags = data.tags.split(';').join(',').split(',').map((t) => t.trim()).filter(Boolean)
  } else if (!Array.isArray(data.tags)) {
    data.tags = []
  }

  let status = 'VALID'
  if (errors.length > 0) status = 'INVALID'
  else if (warnings.length > 0) status = 'WARNING'

  return { status, errors, warnings }
}

/**
 * Executes import of validated profile rows.
 */
async function executeImport({ rows = [], workspaceId = 'default', skipInvalid = true } = {}) {
  if (!Array.isArray(rows) || rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Import is limited to ${MAX_IMPORT_ROWS} rows per operation`)
  }
  const importedProfiles = []
  const skippedRows = []

  for (const item of rows) {
    const d = item && item.data && typeof item.data === 'object' ? item.data : {}
    const validation = validateRow(d, Number(item.rowIndex) || 0)
    if (validation.status === 'INVALID') {
      skippedRows.push(item)
      if (skipInvalid) continue
      throw new Error(validation.errors.join('; '))
    }

    let proxyId = null
    if (d.proxy) {
      const proxy = await proxiesRepo.getProxyById(String(d.proxy))
      proxyId = proxy ? proxy.id : null
    }
    const profile = await profilesRepo.createProfile({
      name: d.name,
      group: d.group || null,
      workspace_id: workspaceId || 'default',
      browser_type: ['chrome', 'msedge', 'firefox'].includes(String(d.browser_type).toLowerCase())
        ? String(d.browser_type).toLowerCase()
        : 'chromium',
      tags: Array.isArray(d.tags) ? d.tags : [],
      notes: d.notes || null,
      proxy_id: proxyId,
      environment: {
        mode: d.locale || d.timezone ? 'custom' : 'default',
        locale: d.locale || 'en-US',
        timezone: d.timezone || 'America/New_York',
      },
    })
    importedProfiles.push(profile)
  }

  return {
    success: true,
    importedCount: importedProfiles.length,
    skippedCount: skippedRows.length,
    profiles: importedProfiles,
  }
}

/**
 * Exports profile configuration to JSON or CSV.
 * STRICT SAFETY RULE: Never exports passwords or session cookies by default!
 */
async function exportProfilesData({ profileIds, workspaceId, format = 'json' } = {}) {
  let list = []
  if (Array.isArray(profileIds) && profileIds.length > 0) {
    for (const id of profileIds) {
      const p = await profilesRepo.getProfileById(id)
      if (p) list.push(p)
    }
  } else if (workspaceId && workspaceId !== 'all') {
    list = await profilesRepo.getAllProfiles({ workspace_id: workspaceId })
  } else {
    list = await profilesRepo.getAllProfiles()
  }

  // Sanitize export data: Remove internal machine storage paths and secrets
  const sanitized = list.map((p) => ({
    name: p.name,
    group: p.group_name || '',
    workspace_id: p.workspace_id || 'default',
    browser_type: p.browser_type || 'chromium',
    tags: Array.isArray(p.tags) ? p.tags.join(', ') : '',
    locale: p.environment?.locale || 'en-US',
    timezone: p.environment?.timezone || 'America/New_York',
    notes: p.notes || '',
    proxy_id: p.proxy_id || '',
    created_at: p.created_at,
  }))

  if (format === 'csv') {
    const headers = ['name', 'group', 'workspace_id', 'browser_type', 'tags', 'locale', 'timezone', 'notes', 'proxy_id']
    const lines = [headers.join(',')]
    sanitized.forEach((r) => {
      const row = headers.map((h) => {
        const val = String(r[h] || '').replace(/"/g, '""')
        return `"${val}"`
      })
      lines.push(row.join(','))
    })
    return { format: 'csv', content: lines.join('\n'), count: sanitized.length }
  }

  return { format: 'json', content: JSON.stringify(sanitized, null, 2), count: sanitized.length }
}

module.exports = {
  parseCsvRows,
  parseAndValidateCsv,
  executeImport,
  exportProfilesData,
}
