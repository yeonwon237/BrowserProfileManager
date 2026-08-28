import { useState, useEffect, useCallback } from 'react'
import {
  PlayIcon,
  PlusIcon,
  CopyIcon,
  TrashIcon,
  ClockIcon,
} from './icons'
import ScheduleFormModal from './ScheduleFormModal'
import { useWorkspace } from '../context/WorkspaceContext'

export default function ScheduledTab({ tools = [], profiles = [] }) {
  const { currentWorkspaceId } = useWorkspace()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editingJob, setEditingJob] = useState(null)
  const [runningJobId, setRunningJobId] = useState(null)
  const [notice, setNotice] = useState(null)

  const reloadJobs = useCallback(async () => {
    try {
      if (window.electronAPI && window.electronAPI.getScheduledJobs) {
        const opts = currentWorkspaceId && currentWorkspaceId !== 'all' ? { workspace_id: currentWorkspaceId } : {}
        const list = await window.electronAPI.getScheduledJobs(opts)
        setJobs(list || [])
      }
    } catch (err) {
      setError(err.message || 'Failed to load scheduled jobs')
    } finally {
      setLoading(false)
    }
  }, [currentWorkspaceId])

  useEffect(() => {
    reloadJobs()
    const timer = setInterval(reloadJobs, 5000)
    return () => clearInterval(timer)
  }, [reloadJobs])

  const handleToggle = async (job) => {
    try {
      if (window.electronAPI && window.electronAPI.toggleScheduledJob) {
        await window.electronAPI.toggleScheduledJob(job.id, !job.enabled)
        reloadJobs()
      }
    } catch (err) {
      setError(err.message || 'Failed to toggle job')
    }
  }

  const handleRunNow = async (job) => {
    setRunningJobId(job.id)
    try {
      if (window.electronAPI && window.electronAPI.runScheduledJobNow) {
        const res = await window.electronAPI.runScheduledJobNow(job.id)
        if (res && res.success) {
          setNotice(`Enqueued ${res.profileCount} task(s) to automation queue!`)
          setTimeout(() => setNotice(null), 3500)
          reloadJobs()
        } else {
          setError(res?.error || 'Failed to execute job')
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to execute job')
    } finally {
      setRunningJobId(null)
    }
  }

  const handleDuplicate = async (job) => {
    try {
      if (window.electronAPI && window.electronAPI.duplicateScheduledJob) {
        await window.electronAPI.duplicateScheduledJob(job.id)
        reloadJobs()
      }
    } catch (err) {
      setError(err.message || 'Failed to duplicate job')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this scheduled job?')) return
    try {
      if (window.electronAPI && window.electronAPI.deleteScheduledJob) {
        await window.electronAPI.deleteScheduledJob(id)
        reloadJobs()
      }
    } catch (err) {
      setError(err.message || 'Failed to delete job')
    }
  }

  const formatTimestamp = (val) => {
    if (!val) return '—'
    const d = new Date(val)
    if (isNaN(d.getTime())) return val
    return d.toLocaleString()
  }

  const formatTarget = (job) => {
    if (job.profile_selection_type === 'group') {
      return `Group: ${job.profile_selection_value || 'Default'}`
    }
    if (job.profile_selection_type === 'workspace') {
      return `Workspace: ${job.profile_selection_value || 'Default'}`
    }
    if (job.profile_selection_type === 'multiple') {
      const arr = Array.isArray(job.profile_selection_value) ? job.profile_selection_value : []
      return `${arr.length} Profiles`
    }
    const p = profiles.find((pr) => pr.id === job.profile_selection_value)
    return p ? p.name : job.profile_selection_value || '1 Profile'
  }

  return (
    <div className="space-y-4">
      {/* Desktop App Lifecycle Disclaimer Banner */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <ClockIcon size={16} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300">
              Desktop Scheduler Active
            </h4>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
              Scheduled automations run while the application is running. Scheduled runs automatically enqueue and adhere to concurrency limits.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingJob(null)
            setShowModal(true)
          }}
          className="btn btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shrink-0"
        >
          <PlusIcon size={14} />
          <span>New Schedule</span>
        </button>
      </div>

      {notice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-semibold animate-fade-in">
          {notice}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Main Table */}
      {loading ? (
        <div className="card flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-6 h-6 border-2 border-slate-200 dark:border-app-border-light border-t-brand-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Loading schedules...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="card py-16 text-center text-slate-400 dark:text-app-muted text-xs space-y-2 border border-dashed border-slate-200 dark:border-app-border rounded-2xl">
          <ClockIcon size={28} className="mx-auto opacity-40" />
          <p className="font-semibold text-slate-700 dark:text-app-text">No scheduled automations yet</p>
          <p className="text-[11px]">Set up recurring daily, weekly or interval automation jobs.</p>
          <button
            onClick={() => {
              setEditingJob(null)
              setShowModal(true)
            }}
            className="text-brand-600 dark:text-brand-400 font-semibold hover:underline mt-2 inline-block"
          >
            Create first scheduled job →
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-app-border bg-slate-50/50 dark:bg-app-surface-2/30 text-[11px] font-bold text-slate-400 dark:text-app-muted-2 uppercase tracking-wider">
                  <th className="py-3 px-4">Schedule</th>
                  <th className="py-3 px-4">Tool</th>
                  <th className="py-3 px-4">Target Profiles</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Next Run</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-app-border/60 text-xs">
                {jobs.map((job) => {
                  const tool = tools.find((t) => t.id === job.automation_id)
                  return (
                    <tr key={job.id} className="hover:bg-slate-50/60 dark:hover:bg-app-surface-2/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-app-text">
                        {job.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-app-muted">
                        {tool ? tool.name : job.automation_id}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-app-muted font-medium">
                        {formatTarget(job)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-app-text capitalize">
                        {job.schedule_type}: <span className="font-mono text-[11px]">{job.schedule_value}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {job.enabled ? formatTimestamp(job.next_run_at) : '— (Paused)'}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggle(job)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${
                            job.enabled
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-slate-100 dark:bg-app-surface-2 text-slate-500 dark:text-app-muted border-slate-200 dark:border-app-border hover:bg-slate-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${job.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                          {job.enabled ? 'Active' : 'Paused'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleRunNow(job)}
                            disabled={runningJobId === job.id}
                            className="btn btn-primary text-xs py-1 px-2.5 flex items-center gap-1"
                          >
                            <PlayIcon size={12} />
                            <span>Run Now</span>
                          </button>
                          <button
                            onClick={() => handleDuplicate(job)}
                            title="Duplicate schedule"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-app-text hover:bg-slate-100 dark:hover:bg-app-surface-2"
                          >
                            <CopyIcon size={13} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingJob(job)
                              setShowModal(true)
                            }}
                            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-app-text px-2 py-1"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(job.id)}
                            title="Delete schedule"
                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                          >
                            <TrashIcon size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <ScheduleFormModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false)
            setEditingJob(null)
          }}
          job={editingJob}
          tools={tools}
          profiles={profiles}
          onSave={async (data) => {
            if (editingJob) {
              await window.electronAPI.updateScheduledJob(editingJob.id, data)
            } else {
              await window.electronAPI.createScheduledJob(data)
            }
            reloadJobs()
          }}
        />
      )}
    </div>
  )
}
