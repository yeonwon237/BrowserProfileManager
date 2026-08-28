import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ClockIcon,
  RefreshIcon,
  CheckIcon,
  AlertIcon,
  CloseIcon,
  TerminalIcon,
  ActivityIcon,
  CopyIcon,
} from '../components/icons'
import RunDebugButtons from '../components/RunDebugButtons'

function MetricCard({ title, value, subtitle, icon: Icon, colorClass, borderClass }) {
  return (
    <div className="card p-4 flex items-center justify-between relative overflow-hidden group hover:border-slate-300 dark:hover:border-app-border-light transition-all">
      <div>
        <p className="text-[11px] font-semibold text-slate-400 dark:text-app-muted-2 uppercase tracking-wider">
          {title}
        </p>
        <p className="text-2xl font-extrabold text-slate-900 dark:text-app-text mt-0.5 tracking-tight">
          {value}
        </p>
        {subtitle && (
          <p className="text-[11px] text-slate-400 dark:text-app-muted mt-0.5 font-medium">
            {subtitle}
          </p>
        )}
      </div>
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${borderClass} ${colorClass} transition-transform duration-300 group-hover:scale-110 shadow-sm`}>
        <Icon size={20} />
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const isOk = status === 'success'
  const isFail = status === 'failed'
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
        isOk
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
          : isFail
          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
          : 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/25'
      }`}
    >
      {isOk ? <CheckIcon size={12} /> : isFail ? <AlertIcon size={12} /> : null}
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : '—'}
    </span>
  )
}

function formatDuration(ms) {
  if (!ms && ms !== 0) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = (ms / 1000).toFixed(1)
  return `${s}s`
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value.replace(' ', 'T'))
  if (isNaN(d)) return value
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function RunDetailModal({ runId, onClose }) {
  const [run, setRun] = useState(null)
  const [logs, setLogs] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let disposed = false
    Promise.all([
      window.electronAPI.getRun(runId),
      window.electronAPI.getRunLogs(runId),
    ]).then(([r, l]) => {
      if (disposed) return
      setRun(r)
      setLogs(typeof l === 'string' ? l : Array.isArray(l) ? l.map(line => line.message || JSON.stringify(line)).join('\n') : '')
      setLoading(false)
    }).catch(() => {
      if (!disposed) setLoading(false)
    })
    return () => { disposed = true }
  }, [runId])

  function handleCopyLogs() {
    navigator.clipboard?.writeText(logs)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-3xl bg-white dark:bg-app-surface border border-slate-200/90 dark:border-app-border shadow-2xl shadow-slate-900/20 dark:shadow-black/80 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 dark:border-app-border bg-slate-50/50 dark:bg-app-surface-2/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 dark:bg-brand-500/15 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <TerminalIcon size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">
                Run Details & Execution Logs
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2 font-mono">
                {runId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 dark:text-app-muted hover:text-slate-700 dark:hover:text-app-text hover:bg-slate-100 dark:hover:bg-app-surface-2 transition-all"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="p-7 space-y-4 max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-slate-200 dark:border-app-border-light border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : run ? (
            <>
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-app-bg p-4 rounded-2xl border border-slate-200/80 dark:border-app-border">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-app-muted-2">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={run.status} />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-app-muted-2">Duration</p>
                  <p className="text-xs font-mono font-bold text-slate-800 dark:text-app-text mt-1">
                    {formatDuration(run.duration_ms)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-app-muted-2">Tool</p>
                  <p className="text-xs font-semibold text-slate-800 dark:text-app-text truncate mt-1">
                    {run.tool_name || run.tool_id}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-app-muted-2">Profile</p>
                  <p className="text-xs font-semibold text-slate-800 dark:text-app-text truncate mt-1">
                    {run.profile_name || run.profile_id}
                  </p>
                </div>
              </div>

              {/* Error Box */}
              {(run.error_message || run.error) && (
                <div className="rounded-2xl bg-rose-500/10 border border-rose-500/25 p-4">
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-1 flex items-center gap-1.5">
                    <AlertIcon size={14} />
                    Execution Error
                  </p>
                  <pre className="text-[11px] font-mono text-rose-600/90 dark:text-rose-300 whitespace-pre-wrap break-all leading-relaxed">
                    {run.error_message || run.error}
                  </pre>
                </div>
              )}

              {/* Terminal Logs View */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-app-muted uppercase tracking-wider">
                    Console Logs
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyLogs}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-app-surface-3 hover:bg-slate-200 dark:hover:bg-app-border text-[11px] font-bold text-slate-600 dark:text-app-muted transition-all"
                    >
                      {copied ? <CheckIcon size={12} className="text-emerald-500" /> : <CopyIcon size={12} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <RunDebugButtons runId={runId} size="md" />
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-950 p-4 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-72 leading-relaxed shadow-inner">
                  {logs ? (
                    <pre className="whitespace-pre-wrap break-all">{logs}</pre>
                  ) : (
                    <p className="text-slate-500 italic">No output logs recorded for this run.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-rose-500">Run record not found.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Logs({ search = '' }) {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await window.electronAPI.getRecentRuns(100)
    setRuns(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const filteredRuns = useMemo(() => {
    return runs.filter((r) => {
      const matchFilter = statusFilter === 'all' || r.status === statusFilter
      if (!matchFilter) return false
      if (!search) return true
      const q = search.toLowerCase()
      return (
        (r.tool_name || '').toLowerCase().includes(q) ||
        (r.profile_name || '').toLowerCase().includes(q) ||
        (r.id || '').toLowerCase().includes(q) ||
        (r.error_message || r.error || '').toLowerCase().includes(q)
      )
    })
  }, [runs, statusFilter, search])

  const counts = {
    total: runs.length,
    success: runs.filter((r) => r.status === 'success').length,
    failed: runs.filter((r) => r.status === 'failed').length,
  }

  const avgDuration = useMemo(() => {
    const valid = runs.filter((r) => r.duration_ms > 0)
    if (valid.length === 0) return '0s'
    const avg = valid.reduce((acc, r) => acc + r.duration_ms, 0) / valid.length
    return formatDuration(Math.round(avg))
  }, [runs])

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          title="Total Runs"
          value={counts.total}
          subtitle="Recorded executions"
          icon={ClockIcon}
          colorClass="bg-brand-500/10 text-brand-600 dark:text-brand-400"
          borderClass="border-brand-500/20"
        />
        <MetricCard
          title="Successful"
          value={counts.success}
          subtitle="Completed without error"
          icon={CheckIcon}
          colorClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          borderClass="border-emerald-500/20"
        />
        <MetricCard
          title="Failed"
          value={counts.failed}
          subtitle="Error & debug captured"
          icon={AlertIcon}
          colorClass="bg-rose-500/10 text-rose-600 dark:text-rose-400"
          borderClass="border-rose-500/20"
        />
        <MetricCard
          title="Avg Duration"
          value={avgDuration}
          subtitle="Execution speed"
          icon={ActivityIcon}
          colorClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          borderClass="border-indigo-500/20"
        />
      </div>

      {/* Filter and Refresh Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-white dark:bg-app-surface p-1 rounded-2xl border border-slate-200/90 dark:border-app-border shadow-xs">
          {[
            { key: 'all', label: 'All Executions' },
            { key: 'success', label: 'Success' },
            { key: 'failed', label: 'Failed' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === f.key
                  ? 'bg-brand-500/10 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-500 dark:text-app-muted hover:text-slate-900 dark:hover:text-app-text'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button onClick={refresh} className="btn-secondary">
          <RefreshIcon size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Main Runs Table */}
      {loading ? (
        <div className="card flex flex-col items-center justify-center py-28 gap-3">
          <div className="w-7 h-7 border-2 border-slate-200 dark:border-app-border-light border-t-brand-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-400 dark:text-app-muted-2 font-medium">Loading execution history...</p>
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="card empty-state py-20">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-app-surface-2 border border-slate-200 dark:border-app-border flex items-center justify-center mb-4">
            <ClockIcon size={28} className="text-slate-400 dark:text-app-muted-2" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-app-text mb-1">
            No Execution Records Found
          </h3>
          <p className="text-xs text-slate-400 dark:text-app-muted-2 max-w-sm">
            Launch tools or queue jobs on profiles. Error logs, console outputs, and debug screenshots will be archived here automatically.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-app-border bg-slate-50/60 dark:bg-app-surface-2/40 text-[11px] font-bold text-slate-400 dark:text-app-muted uppercase tracking-wider">
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Tool Name</th>
                  <th className="px-5 py-3.5">Target Profile</th>
                  <th className="px-5 py-3.5">Duration</th>
                  <th className="px-5 py-3.5">Started At</th>
                  <th className="px-6 py-3.5 text-right">Debug & Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-app-border text-xs">
                {filteredRuns.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => setSelectedRunId(run.id)}
                    className="hover:bg-slate-50/80 dark:hover:bg-app-surface-2/40 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-slate-900 dark:text-app-text text-[13px]">
                        {run.tool_name || run.tool_id}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {run.profile_name || run.profile_id}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-600 dark:text-app-muted">
                      {formatDuration(run.duration_ms)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-app-muted">
                      {formatDate(run.started_at || run.start_time)}
                    </td>
                    <td className="px-6 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <RunDebugButtons runId={run.id} />
                        <button
                          onClick={() => setSelectedRunId(run.id)}
                          className="btn-secondary text-[11px] py-1 px-2.5"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedRunId && (
        <RunDetailModal runId={selectedRunId} onClose={() => setSelectedRunId(null)} />
      )}
    </div>
  )
}

export default Logs
