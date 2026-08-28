import { useState } from 'react'
import {
  PlusIcon,
  DownloadIcon,
} from '../components/icons'
import { useWorkspace } from '../context/WorkspaceContext'

export default function DataTools() {
  const { currentWorkspaceId, reloadWorkspaces } = useWorkspace()
  const [activeTab, setActiveTab] = useState('import')
  const [csvText, setCsvText] = useState('')
  const [parsedResult, setParsedResult] = useState(null)
  const [columnMapping, setColumnMapping] = useState({})
  const [exportScope, setExportScope] = useState('workspace')
  const [exportFormat, setExportFormat] = useState('csv')
  const [exportResult, setExportResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)

  const handleParseCsv = async () => {
    if (!csvText.trim()) {
      setError('Please paste CSV content or load a CSV file')
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (window.electronAPI && window.electronAPI.parseCsv) {
        const res = await window.electronAPI.parseCsv(csvText, columnMapping)
        if (res && res.success) {
          setParsedResult(res)
          setColumnMapping(res.mapping || {})
        } else {
          setError(res?.error || 'Failed parsing CSV')
        }
      }
    } catch (err) {
      setError(err.message || 'CSV parse error')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (skipInvalid = true) => {
    if (!parsedResult || !parsedResult.rows) return
    setLoading(true)
    setError(null)
    try {
      if (window.electronAPI && window.electronAPI.importDataRows) {
        const res = await window.electronAPI.importDataRows({
          rows: parsedResult.rows,
          workspaceId: currentWorkspaceId === 'all' ? 'default' : currentWorkspaceId,
          skipInvalid,
        })
        if (res && res.success) {
          setNotice(`Successfully imported ${res.importedCount} profiles! (Skipped: ${res.skippedCount})`)
          setParsedResult(null)
          setCsvText('')
          reloadWorkspaces()
        }
      }
    } catch (err) {
      setError(err.message || 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setLoading(true)
    setError(null)
    setExportResult(null)
    try {
      if (window.electronAPI && window.electronAPI.exportProfilesData) {
        const res = await window.electronAPI.exportProfilesData({
          workspaceId: exportScope === 'workspace' ? (currentWorkspaceId === 'all' ? null : currentWorkspaceId) : null,
          format: exportFormat,
        })
        if (res) {
          setExportResult(res)
          setNotice(`Exported ${res.count} profiles in ${res.format.toUpperCase()} format!`)
        }
      }
    } catch (err) {
      setError(err.message || 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!exportResult) return
    const blob = new Blob([exportResult.content], {
      type: exportResult.format === 'csv' ? 'text/csv' : 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `profiles_export_${new Date().toISOString().slice(0, 10)}.${exportResult.format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto space-y-6">
      {/* Header & Tabs */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-white dark:bg-app-surface p-1 rounded-2xl border border-slate-200/90 dark:border-app-border shadow-xs">
          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'import'
                ? 'bg-brand-500/10 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 shadow-xs border border-brand-500/20'
                : 'text-slate-500 dark:text-app-muted hover:text-slate-900 dark:hover:text-app-text'
            }`}
          >
            <PlusIcon size={14} />
            <span>Bulk CSV / JSON Import</span>
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'export'
                ? 'bg-brand-500/10 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 shadow-xs border border-brand-500/20'
                : 'text-slate-500 dark:text-app-muted hover:text-slate-900 dark:hover:text-app-text'
            }`}
          >
            <DownloadIcon size={14} />
            <span>Profile Data Export</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-between animate-fade-in">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between animate-fade-in">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {activeTab === 'import' ? (
        <div className="space-y-6">
          {/* CSV Input Card */}
          <div className="card p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">
                Paste or Upload Profile CSV
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2 mt-0.5">
                Supported columns: name, group, tags, browser_type, locale, timezone, proxy_id, notes.
              </p>
            </div>

            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`name,group,tags,browser_type,locale,timezone\nAccount-01,Marketing,fb;lead,chromium,en-US,America/New_York\nAccount-02,Affiliate,tiktok;us,chrome,en-GB,Europe/London`}
              rows={6}
              className="input w-full font-mono text-xs"
            />

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setCsvText(
                    `name,group,tags,browser_type,locale,timezone\nWorker-001,Farming,vip;promo,chrome,en-US,America/New_York\nWorker-002,Farming,vip;promo,chrome,en-US,America/New_York\nWorker-003,Scraping,lead,chromium,en-GB,Europe/London`
                  )
                }}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
              >
                Insert sample CSV template
              </button>

              <button
                onClick={handleParseCsv}
                disabled={loading || !csvText.trim()}
                className="btn btn-primary text-xs py-2 px-4"
              >
                {loading ? 'Parsing...' : 'Analyze & Map Columns'}
              </button>
            </div>
          </div>

          {/* Validation & Preview Table */}
          {parsedResult && (
            <div className="card overflow-hidden space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">
                    Validation Preview ({parsedResult.totalRows} rows)
                  </h3>
                  <div className="flex items-center gap-3 text-xs mt-1">
                    <span className="text-emerald-600 font-semibold">
                      ✓ {parsedResult.validCount} Valid
                    </span>
                    {parsedResult.warnCount > 0 && (
                      <span className="text-amber-600 font-semibold">
                        ⚠ {parsedResult.warnCount} Warnings
                      </span>
                    )}
                    {parsedResult.invalidCount > 0 && (
                      <span className="text-rose-600 font-semibold">
                        ✕ {parsedResult.invalidCount} Invalid
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleImport(true)}
                    disabled={loading || parsedResult.validCount + parsedResult.warnCount === 0}
                    className="btn btn-primary text-xs py-2 px-4"
                  >
                    Import Valid Rows ({parsedResult.validCount + parsedResult.warnCount})
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200/80 dark:border-app-border rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-app-surface-2/40 border-b border-slate-200/80 dark:border-app-border text-[11px] font-bold text-slate-400 uppercase">
                      <th className="py-2.5 px-3">Row</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Profile Name</th>
                      <th className="py-2.5 px-3">Group</th>
                      <th className="py-2.5 px-3">Browser</th>
                      <th className="py-2.5 px-3">Locale / Timezone</th>
                      <th className="py-2.5 px-3">Issues / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-app-border/60">
                    {parsedResult.rows.map((r) => (
                      <tr key={r.rowIndex} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono text-slate-400">{r.rowIndex}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.status === 'VALID'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : r.status === 'WARNING'
                                ? 'bg-amber-500/10 text-amber-600'
                                : 'bg-rose-500/10 text-rose-600'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-app-text">
                          {r.data.name || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{r.data.group || '—'}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {r.data.browser_type || 'chromium'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {r.data.locale || 'en-US'} / {r.data.timezone || 'America/New_York'}
                        </td>
                        <td className="py-2.5 px-3 text-rose-500 text-[11px]">
                          {r.errors.join('; ') || r.warnings.join('; ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Export Tab */
        <div className="card p-6 space-y-5 max-w-xl">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">
              Export Profile Configurations
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-app-muted-2 mt-0.5">
              Export profiles safely for backups, migration, or sharing. Passwords and session cookies are never exported.
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-app-text">
                Export Scope
              </label>
              <select
                value={exportScope}
                onChange={(e) => setExportScope(e.target.value)}
                className="input w-full text-xs"
              >
                <option value="workspace">Current Active Workspace</option>
                <option value="all">All Workspaces & Profiles</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-app-text">
                Format
              </label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className="input w-full text-xs"
              >
                <option value="csv">CSV (Spreadsheet compatible)</option>
                <option value="json">JSON (Full structured metadata)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleExport}
              disabled={loading}
              className="btn btn-primary text-xs py-2 px-4"
            >
              {loading ? 'Exporting...' : 'Generate Export File'}
            </button>

            {exportResult && (
              <button
                onClick={handleDownload}
                className="btn btn-secondary text-xs py-2 px-4 flex items-center gap-1.5"
              >
                <DownloadIcon size={14} />
                <span>Download .{exportResult.format}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
