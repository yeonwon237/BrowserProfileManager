import { useState, useEffect, useMemo } from 'react'
import { ZapIcon, AlertIcon } from './icons'
import { useWorkspace } from '../context/WorkspaceContext'

export default function ScheduleFormModal({
  isOpen,
  onClose,
  job,
  tools = [],
  profiles = [],
  onSave,
}) {
  const { currentWorkspaceId, workspaces } = useWorkspace()
  const [name, setName] = useState('')
  const [automationId, setAutomationId] = useState('')
  const [profileType, setProfileType] = useState('single')
  const [profileSingle, setProfileSingle] = useState('')
  const [profileGroup, setProfileGroup] = useState('')
  const [profileWorkspace, setProfileWorkspace] = useState('default')
  const [scheduleType, setScheduleType] = useState('daily')
  const [scheduleValue, setScheduleValue] = useState('09:00')
  const [enabled, setEnabled] = useState(true)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const distinctGroups = useMemo(() => Array.from(
    new Set(profiles.map((p) => p.group_name || p.group).filter(Boolean))
  ), [profiles])

  useEffect(() => {
    if (job) {
      setName(job.name || '')
      setAutomationId(job.automation_id || (tools[0] ? tools[0].id : ''))
      setProfileType(job.profile_selection_type || 'single')
      if (job.profile_selection_type === 'group') {
        setProfileGroup(job.profile_selection_value || '')
      } else if (job.profile_selection_type === 'workspace') {
        setProfileWorkspace(job.profile_selection_value || 'default')
      } else {
        setProfileSingle(job.profile_selection_value || (profiles[0] ? profiles[0].id : ''))
      }
      setScheduleType(job.schedule_type || 'daily')
      setScheduleValue(job.schedule_value || '09:00')
      setEnabled(job.enabled !== undefined ? job.enabled : true)
    } else {
      setName('')
      setAutomationId(tools[0] ? tools[0].id : '')
      setProfileType('single')
      setProfileSingle(profiles[0] ? profiles[0].id : '')
      setProfileGroup(distinctGroups[0] || '')
      setProfileWorkspace(currentWorkspaceId === 'all' ? 'default' : currentWorkspaceId)
      setScheduleType('daily')
      setScheduleValue('09:00')
      setEnabled(true)
    }
    setError(null)
  }, [job, isOpen, tools, profiles, distinctGroups, currentWorkspaceId])

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Job name is required')
      return
    }
    if (!automationId) {
      setError('Please select an automation tool')
      return
    }

    let selectionVal = ''
    if (profileType === 'single') selectionVal = profileSingle
    else if (profileType === 'group') selectionVal = profileGroup
    else if (profileType === 'workspace') selectionVal = profileWorkspace

    if (!selectionVal) {
      setError('Please select target profile(s) or group')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onSave({
        name: name.trim(),
        workspace_id: currentWorkspaceId === 'all' ? 'default' : currentWorkspaceId,
        automation_id: automationId,
        profile_selection_type: profileType,
        profile_selection_value: selectionVal,
        schedule_type: scheduleType,
        schedule_value: scheduleValue,
        enabled,
      })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save scheduled job')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-app-surface rounded-2xl border border-slate-200 dark:border-app-border shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-app-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <ZapIcon size={16} />
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-app-text">
              {job ? 'Edit Scheduled Automation' : 'New Scheduled Automation'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-app-muted dark:hover:text-app-text"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertIcon size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-app-text">
              Schedule Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Daily Account Warmup, Midnight Sync"
              className="input w-full text-xs"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-app-text">
              Automation Tool
            </label>
            <select
              value={automationId}
              onChange={(e) => setAutomationId(e.target.value)}
              className="input w-full text-xs"
              required
            >
              {tools.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (v{t.version || '1.0'})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-app-text">
              Target Profiles
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setProfileType('single')}
                className={`py-1.5 px-3 rounded-xl text-xs font-semibold border text-center transition-all ${
                  profileType === 'single'
                    ? 'bg-brand-500/10 border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-slate-200 dark:border-app-border text-slate-600 dark:text-app-muted'
                }`}
              >
                Single Profile
              </button>
              <button
                type="button"
                onClick={() => setProfileType('group')}
                className={`py-1.5 px-3 rounded-xl text-xs font-semibold border text-center transition-all ${
                  profileType === 'group'
                    ? 'bg-brand-500/10 border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-slate-200 dark:border-app-border text-slate-600 dark:text-app-muted'
                }`}
              >
                Profile Group
              </button>
              <button
                type="button"
                onClick={() => setProfileType('workspace')}
                className={`py-1.5 px-3 rounded-xl text-xs font-semibold border text-center transition-all ${
                  profileType === 'workspace'
                    ? 'bg-brand-500/10 border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-slate-200 dark:border-app-border text-slate-600 dark:text-app-muted'
                }`}
              >
                Whole Workspace
              </button>
            </div>

            {profileType === 'single' && (
              <select
                value={profileSingle}
                onChange={(e) => setProfileSingle(e.target.value)}
                className="input w-full text-xs"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.browser_type})
                  </option>
                ))}
              </select>
            )}

            {profileType === 'group' && (
              <select
                value={profileGroup}
                onChange={(e) => setProfileGroup(e.target.value)}
                className="input w-full text-xs"
              >
                {distinctGroups.length === 0 ? (
                  <option value="">(No groups created)</option>
                ) : (
                  distinctGroups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))
                )}
              </select>
            )}

            {profileType === 'workspace' && (
              <select
                value={profileWorkspace}
                onChange={(e) => setProfileWorkspace(e.target.value)}
                className="input w-full text-xs"
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.is_default ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-app-text">
                Schedule Type
              </label>
              <select
                value={scheduleType}
                onChange={(e) => {
                  setScheduleType(e.target.value)
                  if (e.target.value === 'daily') setScheduleValue('09:00')
                  if (e.target.value === 'weekly') setScheduleValue('monday 09:00')
                  if (e.target.value === 'interval') setScheduleValue('60')
                }}
                className="input w-full text-xs"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="interval">Interval (Minutes)</option>
                <option value="once">Run Once</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-app-text">
                {scheduleType === 'daily' && 'Run Time (HH:MM)'}
                {scheduleType === 'weekly' && 'Day & Time'}
                {scheduleType === 'interval' && 'Interval (Minutes)'}
                {scheduleType === 'once' && 'Target Date/Time'}
              </label>
              <input
                value={scheduleValue}
                onChange={(e) => setScheduleValue(e.target.value)}
                placeholder={
                  scheduleType === 'daily'
                    ? '09:00'
                    : scheduleType === 'weekly'
                    ? 'monday 09:00'
                    : scheduleType === 'interval'
                    ? '60'
                    : '2026-09-01T12:00:00Z'
                }
                className="input w-full text-xs font-mono"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="enableJob"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="enableJob" className="text-xs font-medium text-slate-700 dark:text-app-text cursor-pointer">
              Enable schedule immediately
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-app-border">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary text-xs py-1.5 px-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary text-xs py-1.5 px-4"
            >
              {loading ? 'Saving...' : job ? 'Save Changes' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
