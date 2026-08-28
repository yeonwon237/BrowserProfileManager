import { useState, useEffect, useCallback } from 'react'
import {
  FilterIcon,
  TerminalIcon,
  RefreshIcon,
  SearchIcon,
} from './icons'
import RunDetailsModal from './RunDetailsModal'
import { useWorkspace } from '../context/WorkspaceContext'

function StatCard({ title, value, subtitle, colorClass, borderClass }) {
  return (
    <div className={`card p-4 flex flex-col gap-1 border ${borderClass || 'border-slate-200/80 dark:border-app-border'}`}>
      <span className="text-[11px] font-bold text-slate-400 dark:text-app-muted-2 uppercase tracking-wider">
        {title}
      </span>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-black tracking-tight ${colorClass}`}>
          {value}
        </span>
      </div>
      {subtitle && (
        <span className="text-[11px] text-slate-400 dark:text-app-muted mt-0.5">
          {subtitle}
        </span>
      )}
    </div>
  )
}

export default function AutomationHistoryTab() {
  const { currentWorkspaceId } = useWorkspace()
  const [runsData, setRunsData] = useState({ runs: [], total: 0, page: 1, pageSize: 20, totalPages: 1 })
  const [analytics, setAnalytics] = useState({
    totalRuns: 0,
    successRate: 0,
    failureRate: 0,
    averageDurationMs: 0,
    runsToday: 0,
    runsLast7Days: 0,
  })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [selectedRunId, setSelectedRunId] = useState(null)

  const loadData = useCallback(async () => {
    try {
      if (window.electronAPI) {
        const wsOpt = currentWorkspaceId && currentWorkspaceId !== 'all' ? { workspace_id: currentWorkspaceId } : {}

        // Load analytics
        if (window.electronAPI.getAutomationAnalytics) {
          const a = await window.electronAPI.getAutomationAnalytics(wsOpt)
          if (a) setAnalytics(a)
        }

        // Load paginated runs
        if (window.electronAPI.getRuns) {
          const result = await window.electronAPI.getRuns({
            ...wsOpt,
            status: statusFilter !== 'all' ? statusFilter : undefined,
            search: search.trim() || undefined,
            page,
            pageSize,
          })
          if (result) setRunsData(result)
        }
      }
    } catch (err) {
      console.warn('Failed loading run history:', err)
    } finally {
      setLoading(false)
    }
  }, [currentWorkspaceId, statusFilter, search, page, pageSize])

  useEffect(() => {
    loadData()
  }, [loadData])

  const formatDuration = (ms) => {
    if (ms == null) return '—'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatTimestamp = (val) => {
    if (!val) return '—'
    const d = new Date(val)
    if (isNaN(d.getTime())) return val
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Runs"
          value={analytics.totalRuns}
          subtitle={`${analytics.runsToday} runs executed today`}
          colorClass="text-brand-600 dark:text-brand-400"
          borderClass="border-brand-500/20"
        />
        <StatCard
          title="Success Rate"
          value={`${analytics.successRate}%`}
          subtitle={`${analytics.failureRate}% failure rate`}
          colorClass={analytics.successRate >= 90 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}
          borderClass="border-emerald-500/20"
        />
        <StatCard
          title="Average Duration"
          value={formatDuration(analytics.averageDurationMs)}
          subtitle="Execution latency"
          colorClass="text-indigo-600 dark:text-indigo-400"
          borderClass="border-indigo-500/20"
        />
        <StatCard
          title="Runs (7 Days)"
          value={analytics.runsLast7Days}
          subtitle="Past week throughput"
          colorClass="text-sky-600 dark:text-sky-400"
          borderClass="border-sky-500/20"
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <SearchIcon
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors pointer-events-none"
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search tool, profile, errors..."
              className="w-64 pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-app-surface border border-slate-200/90 dark:border-app-border text-xs focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-app-surface px-3 py-2 rounded-xl border border-slate-200/90 dark:border-app-border shadow-xs">
            <FilterIcon size={14} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-app-text">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="bg-transparent text-xs font-semibold text-brand-600 dark:text-brand-400 focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <button
          onClick={loadData}
          className="btn btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshIcon size={13} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Runs Table */}
      {loading ? (
        <div className="card flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-6 h-6 border-2 border-slate-200 dark:border-app-border-light border-t-brand-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Loading history...</p>
        </div>
      ) : runsData.runs.length === 0 ? (
        <div className="card py-16 text-center text-slate-400 dark:text-app-muted text-xs space-y-2 border border-dashed border-slate-200 dark:border-app-border rounded-2xl">
          <TerminalIcon size={28} className="mx-auto opacity-40" />
          <p className="font-semibold text-slate-700 dark:text-app-text">No automation runs found</p>
          <p className="text-[11px]">Run history and performance analytics will appear here.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-app-border bg-slate-50/50 dark:bg-app-surface-2/30 text-[11px] font-bold text-slate-400 dark:text-app-muted-2 uppercase tracking-wider">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Automation Tool</th>
                  <th className="py-3 px-4">Profile</th>
                  <th className="py-3 px-4">Started At</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-app-border/60 text-xs">
                {runsData.runs.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-app-surface-2/40 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          r.status === 'success'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : r.status === 'failed'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            r.status === 'success'
                              ? 'bg-emerald-500'
                              : r.status === 'failed'
                              ? 'bg-rose-500'
                              : 'bg-amber-500 animate-pulse'
                          }`}
                        />
                        {r.status?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-app-text">
                      {r.tool_name || r.tool_id}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-app-muted font-medium">
                      {r.profile_name || r.profile_id}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {formatTimestamp(r.start_time || r.started_at)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] font-bold text-slate-700 dark:text-app-text">
                      {formatDuration(r.duration_ms)}
                    </td>
                    <td className="py-3.5 px-4 max-w-[200px] truncate text-slate-500 text-[11px]">
                      {r.error ? (
                        <span className="text-rose-500 font-medium truncate block" title={r.error}>
                          {r.error_category ? `[${r.error_category}] ` : ''}{r.error}
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">Completed successfully</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedRunId(r.id)}
                        className="btn btn-secondary text-xs py-1 px-2.5"
                      >
                        View Logs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          <div className="px-4 py-3 border-t border-slate-100 dark:border-app-border flex items-center justify-between text-xs text-slate-500 dark:text-app-muted">
            <span>
              Showing page {runsData.page} of {runsData.totalPages} ({runsData.total} total runs)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={runsData.page <= 1}
                className="btn btn-secondary text-xs py-1 px-2.5 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(runsData.totalPages, p + 1))}
                disabled={runsData.page >= runsData.totalPages}
                className="btn btn-secondary text-xs py-1 px-2.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedRunId && (
        <RunDetailsModal
          isOpen={Boolean(selectedRunId)}
          onClose={() => setSelectedRunId(null)}
          runId={selectedRunId}
        />
      )}
    </div>
  )
}
