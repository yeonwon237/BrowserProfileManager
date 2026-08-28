import { useEffect, useState, useCallback } from 'react'
import {
  LayersIcon,
  StopIcon,
  RefreshIcon,
  TrashIcon,
  CloseIcon,
  ActivityIcon,
} from './icons'
import RunDebugButtons from './RunDebugButtons'

const STATUS_STYLES = {
  waiting: 'bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/60',
  running: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/25 shadow-sm shadow-brand-500/10',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
  failed: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
  cancelled: 'bg-slate-100 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/60',
}

function StatusBadge({ status }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold border ${STATUS_STYLES[status] || STATUS_STYLES.waiting}`}>
      {status === 'running' && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
        </span>
      )}
      {label}
    </span>
  )
}

function ProgressBar({ progress, status }) {
  if (status === 'running' && progress) {
    const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
    return (
      <div className="flex items-center gap-2.5">
        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-app-surface-3 overflow-hidden border border-slate-200/80 dark:border-app-border">
          <div
            className="h-full bg-gradient-to-r from-brand-600 to-indigo-400 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] font-mono font-bold text-brand-600 dark:text-brand-400 w-10 text-right">
          {pct}%
        </span>
      </div>
    )
  }
  if (status === 'running') {
    return (
      <div className="flex items-center gap-2.5">
        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-app-surface-3 overflow-hidden border border-slate-200/80 dark:border-app-border">
          <div className="h-full w-1/3 bg-brand-500/60 rounded-full animate-pulse" />
        </div>
        <span className="text-[11px] font-mono text-slate-400 dark:text-app-muted-2">...</span>
      </div>
    )
  }
  return (
    <span className="text-xs text-slate-400 dark:text-app-muted-2 truncate block max-w-[200px]">
      {progress ? 'Completed' : '—'}
    </span>
  )
}

function QueuePanel() {
  const [queue, setQueue] = useState([])
  const [maxConcurrent, setMaxConcurrent] = useState(1)
  const [notice, setNotice] = useState({ type: 'success', text: '' })

  const refresh = useCallback(async () => {
    const [jobs, mc] = await Promise.all([
      window.electronAPI.getQueue(),
      window.electronAPI.getMaxConcurrent(),
    ])
    setQueue(jobs || [])
    setMaxConcurrent(mc || 1)
  }, [])

  useEffect(() => {
    refresh()
    const unsubscribe = window.electronAPI.onQueueUpdated((jobs) => {
      setQueue(jobs || [])
    })
    return unsubscribe
  }, [refresh])

  useEffect(() => {
    if (!notice.text) return
    const t = setTimeout(() => setNotice({ type: 'success', text: '' }), 3000)
    return () => clearTimeout(t)
  }, [notice])

  async function handleConcurrentChange(value) {
    const n = Number(value)
    if (n >= 1) {
      await window.electronAPI.setMaxConcurrent(n)
      setMaxConcurrent(n)
    }
  }

  const counts = {
    waiting: queue.filter((j) => j.status === 'waiting').length,
    running: queue.filter((j) => j.status === 'running').length,
    success: queue.filter((j) => j.status === 'success').length,
    failed: queue.filter((j) => j.status === 'failed').length,
    cancelled: queue.filter((j) => j.status === 'cancelled').length,
  }
  const total = queue.length
  const done = counts.success + counts.failed + counts.cancelled
  const overallPct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-app-text">Execution Queue</h3>
          <span className="px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 text-[11px] font-bold">
            {total} Job{total === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <div className="flex items-center gap-2 bg-white dark:bg-app-surface px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-app-border shadow-xs">
            <span className="text-xs font-semibold text-slate-500 dark:text-app-muted">Max Concurrency:</span>
            <input
              type="number"
              min={1}
              value={maxConcurrent}
              onChange={(e) => handleConcurrentChange(e.target.value)}
              className="w-12 px-1.5 py-0.5 rounded-lg bg-slate-100 dark:bg-app-surface-2 text-slate-900 dark:text-app-text text-xs font-bold text-center border border-slate-200 dark:border-app-border focus:outline-none focus:border-brand-500"
            />
          </div>

          <button
            onClick={async () => {
              await window.electronAPI.queueStopAll()
              setNotice({ type: 'success', text: 'Queue cancelled' })
            }}
            disabled={counts.running === 0 && counts.waiting === 0}
            className="btn-danger text-xs"
          >
            <StopIcon size={14} />
            Stop All
          </button>

          <button
            onClick={async () => {
              const r = await window.electronAPI.queueRetryAllFailed()
              setNotice({ type: 'success', text: `Retried ${r.retried || 0} failed job(s)` })
            }}
            disabled={counts.failed + counts.cancelled === 0}
            className="btn-secondary"
          >
            <RefreshIcon size={13} />
            Retry Failed
          </button>

          <button
            onClick={async () => {
              await window.electronAPI.queueClearCompleted()
            }}
            disabled={done === 0}
            className="btn-secondary"
          >
            <TrashIcon size={13} />
            Clear Done
          </button>
        </div>
      </div>

      {notice.text && (
        <div
          className={`px-4 py-3 rounded-2xl border text-xs font-semibold flex items-center justify-between animate-fade-in ${
            notice.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice({ type: 'success', text: '' })} className="p-0.5 rounded opacity-70 hover:opacity-100">
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      {/* Counts Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Waiting', value: counts.waiting, color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-app-surface-2' },
          { label: 'Running', value: counts.running, color: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-500/10' },
          { label: 'Success', value: counts.success, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Failed', value: counts.failed, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10' },
          { label: 'Cancelled', value: counts.cancelled, color: 'text-slate-400', bg: 'bg-slate-100 dark:bg-app-surface-2' },
        ].map((item) => (
          <div key={item.label} className="card p-3.5 flex items-center justify-between">
            <div>
              <p className={`text-xl font-extrabold ${item.color} tracking-tight`}>{item.value}</p>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-app-muted-2 uppercase tracking-wider mt-0.5">
                {item.label}
              </p>
            </div>
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${item.bg} ${item.color}`}>
              <LayersIcon size={14} />
            </span>
          </div>
        ))}
      </div>

      {/* Overall Progress Gauge */}
      {total > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ActivityIcon size={14} className="text-brand-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-700 dark:text-app-muted">Overall Queue Progress</span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-900 dark:text-app-text">
              {done} / {total} Jobs ({overallPct}%)
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-app-surface-3 overflow-hidden border border-slate-200/80 dark:border-app-border">
            <div
              className="h-full bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-400 rounded-full transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Jobs Table */}
      {queue.length === 0 ? (
        <div className="card empty-state py-16">
          <div className="w-14 h-14 rounded-3xl bg-slate-100 dark:bg-app-surface-2 border border-slate-200 dark:border-app-border flex items-center justify-center mb-3">
            <LayersIcon size={24} className="text-slate-400 dark:text-app-muted-2" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-app-text mb-1">Execution Queue is Empty</h3>
          <p className="text-xs text-slate-400 dark:text-app-muted-2 max-w-sm">
            Launch tools on multiple profiles from the Library tab to monitor automated jobs here in real time.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-app-border bg-slate-50/60 dark:bg-app-surface-2/40 text-[11px] font-bold text-slate-400 dark:text-app-muted uppercase tracking-wider">
                  <th className="px-5 py-3.5">Profile</th>
                  <th className="px-5 py-3.5">Automation Tool</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 w-48">Progress</th>
                  <th className="px-5 py-3.5">Result Summary</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-app-border text-xs">
                {queue.map((job) => (
                  <tr key={job.jobId} className="hover:bg-slate-50/80 dark:hover:bg-app-surface-2/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-bold text-slate-900 dark:text-app-text">{job.profileName}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-app-surface-3 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-app-border">
                        {job.toolName}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <ProgressBar progress={job.progress} status={job.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      {job.error ? (
                        <span className="text-[11px] font-medium text-rose-500 truncate block max-w-[200px]" title={job.error}>
                          {job.error}
                        </span>
                      ) : job.result ? (
                        <span className="text-[11px] font-medium text-slate-600 dark:text-app-muted truncate block max-w-[200px]" title={job.result}>
                          {job.result}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300 dark:text-app-muted-2">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {(job.status === 'waiting' || job.status === 'running') && (
                          <button
                            onClick={() => window.electronAPI.queueStopJob(job.jobId)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                            title="Stop job"
                          >
                            <CloseIcon size={15} />
                          </button>
                        )}
                        {(job.status === 'failed' || job.status === 'cancelled') && (
                          <button
                            onClick={() => window.electronAPI.queueRetryJob(job.jobId)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-app-surface-3 hover:bg-brand-500/15 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200/80 dark:border-app-border text-[11px] font-semibold text-slate-600 dark:text-app-muted transition-all active:scale-95 shadow-xs"
                            title="Retry this job"
                          >
                            <RefreshIcon size={12} />
                            Retry
                          </button>
                        )}
                        {job.status === 'failed' && job.runId && (
                          <RunDebugButtons runId={job.runId} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default QueuePanel