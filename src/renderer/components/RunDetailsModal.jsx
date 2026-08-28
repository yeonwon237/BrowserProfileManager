import { useState, useEffect } from 'react'
import { AlertIcon, TerminalIcon } from './icons'

export default function RunDetailsModal({ isOpen, onClose, runId }) {
  const [run, setRun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen || !runId) return
    setLoading(true)
    setError(null)
    if (window.electronAPI && window.electronAPI.getRunDetails) {
      window.electronAPI
        .getRunDetails(runId)
        .then((data) => {
          setRun(data)
        })
        .catch((err) => {
          setError(err.message || 'Failed loading run details')
        })
        .finally(() => setLoading(false))
    }
  }, [isOpen, runId])

  if (!isOpen) return null

  const formatTimestamp = (val) => {
    if (!val) return '—'
    const d = new Date(val)
    if (isNaN(d.getTime())) return val
    return d.toLocaleString()
  }

  const formatDuration = (ms) => {
    if (ms == null) return '—'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-app-surface rounded-2xl border border-slate-200 dark:border-app-border shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-app-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <TerminalIcon size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-app-text">
                Automation Run Details
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">{runId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-app-muted dark:hover:text-app-text"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-6 h-6 border-2 border-slate-200 dark:border-app-border-light border-t-brand-500 rounded-full animate-spin" />
              <p className="text-xs text-slate-400">Loading run details...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
              {error}
            </div>
          ) : !run ? (
            <p className="text-xs text-slate-400 text-center py-10">Run record not found</p>
          ) : (
            <>
              {/* Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-app-surface-2/40 border border-slate-200/80 dark:border-app-border text-xs">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Status</p>
                  <span
                    className={`inline-flex items-center gap-1 mt-1 font-bold ${
                      run.status === 'success'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : run.status === 'failed'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {run.status?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Duration</p>
                  <p className="font-mono font-bold text-slate-800 dark:text-app-text mt-1">
                    {formatDuration(run.duration_ms)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Started</p>
                  <p className="text-slate-700 dark:text-app-text mt-1 text-[11px]">
                    {formatTimestamp(run.start_time || run.started_at)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Profile</p>
                  <p className="text-slate-800 dark:text-app-text font-semibold mt-1 truncate">
                    {run.profile_name || run.profile_id}
                  </p>
                </div>
              </div>

              {/* Error Box (if failed) */}
              {run.error && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-1">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs font-bold">
                    <AlertIcon size={14} />
                    <span>Error ({run.error_category || 'UNKNOWN'})</span>
                  </div>
                  <pre className="text-xs font-mono text-rose-600 dark:text-rose-300 whitespace-pre-wrap break-all pt-1">
                    {run.error}
                  </pre>
                </div>
              )}

              {/* Log Console Output with Secret Redaction */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-app-text">
                    Execution Logs
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">
                    Sensitive tokens and passwords automatically redacted
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 text-slate-200 font-mono text-xs max-h-60 overflow-y-auto leading-relaxed border border-slate-800">
                  {run.logContent ? (
                    <pre className="whitespace-pre-wrap">{run.logContent}</pre>
                  ) : (
                    <span className="text-slate-500">No log output recorded for this run</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-app-border flex items-center justify-end">
          <button
            onClick={onClose}
            className="btn btn-secondary text-xs py-1.5 px-4"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
