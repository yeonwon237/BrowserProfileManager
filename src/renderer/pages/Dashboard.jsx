import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UsersIcon,
  ZapIcon,
  GlobeIcon,
  ActivityIcon,
  AlertIcon,
  CheckIcon,
  ClockIcon,
  PlusIcon,
  DownloadIcon,
  LayersIcon,
  PlayIcon,
  ShieldCheckIcon,
  RefreshIcon,
  ScrollIcon,
} from '../components/icons'
import ProfileFormModal from '../components/ProfileFormModal'
import QueuePanel from '../components/QueuePanel'
import { useWorkspace } from '../context/WorkspaceContext'

function MetricCard({ title, value, subtitle, icon: Icon, colorClass, borderClass, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`card p-4 flex items-center justify-between relative overflow-hidden group hover:border-slate-300 dark:hover:border-app-border-light transition-all ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      }`}
    >
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
      <div
        className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${borderClass} ${colorClass} transition-transform duration-300 group-hover:scale-110 shadow-sm`}
      >
        <Icon size={20} />
      </div>
    </div>
  )
}

function ResourceBar({ label, current, max, unit = '', color = 'bg-brand-500' }) {
  const percent = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500 dark:text-app-muted font-medium">{label}</span>
        <span className="font-semibold text-slate-700 dark:text-app-text">
          {current} {unit} / {max} {unit} ({percent}%)
        </span>
      </div>
      <div className="w-full h-2 bg-slate-100 dark:bg-app-surface-2 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500 rounded-full`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function ActivityItem({ item, onClick }) {
  const getBadge = () => {
    switch (item.type) {
      case 'profile_open':
        return {
          icon: PlayIcon,
          bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        }
      case 'profile_close':
        return {
          icon: ClockIcon,
          bg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
        }
      case 'automation_success':
        return {
          icon: CheckIcon,
          bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        }
      case 'automation_fail':
        return {
          icon: AlertIcon,
          bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        }
      case 'browser_crash':
        return {
          icon: AlertIcon,
          bg: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
        }
      case 'proxy_warning':
        return {
          icon: GlobeIcon,
          bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        }
      case 'import_export':
        return {
          icon: DownloadIcon,
          bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
        }
      default:
        return {
          icon: ActivityIcon,
          bg: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20',
        }
    }
  }

  const badge = getBadge()
  const Icon = badge.icon

  const timeStr = item.timestamp
    ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : ''

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-xl border border-slate-100 dark:border-app-border/60 bg-white/60 dark:bg-app-surface/40 hover:bg-slate-50 dark:hover:bg-app-surface-2/60 transition-all flex items-start gap-3 ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className={`p-2 rounded-xl border ${badge.bg} shrink-0 mt-0.5`}>
        <Icon size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-800 dark:text-app-text truncate">{item.title}</p>
          <span className="text-[10px] font-mono text-slate-400 dark:text-app-muted-2 shrink-0">
            {timeStr}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-app-muted mt-0.5 line-clamp-2">
          {item.message}
        </p>
        {item.profileName && (
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-app-surface-2 text-slate-600 dark:text-app-muted font-medium">
              {item.profileName}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function Dashboard({ search = '' }) {
  const navigate = useNavigate()
  const { currentWorkspaceId } = useWorkspace()
  const [metrics, setMetrics] = useState({
    totalProfiles: 0,
    readyProfiles: 0,
    runningProfiles: 0,
    warningProfiles: 0,
    errorProfiles: 0,
    activeBrowsers: 0,
    activeAutomations: 0,
    waitingJobs: 0,
    failedJobsToday: 0,
    successfulJobsToday: 0,
    resourceStatus: {
      cpu: 0,
      memory: { usedMb: 0, totalMb: 0, percent: 0 },
      browsers: { active: 0, max: 5 },
      automations: { active: 0, max: 3 },
      queueSize: 0,
    },
  })

  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showQueue, setShowQueue] = useState(false)

  const loadData = useCallback(async () => {
    try {
      if (window.electronAPI) {
        const wsOpt = currentWorkspaceId && currentWorkspaceId !== 'all' ? { workspace_id: currentWorkspaceId } : {}
        if (window.electronAPI.getDashboardMetrics) {
          const m = await window.electronAPI.getDashboardMetrics(wsOpt)
          if (m) setMetrics(m)
        }
        if (window.electronAPI.getRecentActivity) {
          const act = await window.electronAPI.getRecentActivity(25, wsOpt)
          if (Array.isArray(act)) setActivities(act)
        }
      }
    } catch (err) {
      console.warn('Dashboard data fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [currentWorkspaceId])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 3000)

    let unsubStatus = null
    let unsubQueue = null
    let unsubResource = null

    if (window.electronAPI) {
      if (window.electronAPI.onProfileStatusChanged) {
        unsubStatus = window.electronAPI.onProfileStatusChanged(() => loadData())
      }
      if (window.electronAPI.onQueueUpdated) {
        unsubQueue = window.electronAPI.onQueueUpdated(() => loadData())
      }
      if (window.electronAPI.onResourceEvent) {
        unsubResource = window.electronAPI.onResourceEvent(() => loadData())
      }
    }

    return () => {
      clearInterval(interval)
      if (unsubStatus) unsubStatus()
      if (unsubQueue) unsubQueue()
      if (unsubResource) unsubResource()
    }
  }, [loadData])

  const filteredActivities = activities.filter((act) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (act.title && act.title.toLowerCase().includes(q)) ||
      (act.message && act.message.toLowerCase().includes(q)) ||
      (act.profileName && act.profileName.toLowerCase().includes(q))
    )
  })

  return (
    <div className="p-8 space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-app-text tracking-tight flex items-center gap-2">
            Operations Dashboard
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              Live Hub
            </span>
          </h1>
          <p className="text-xs text-slate-400 dark:text-app-muted-2 mt-0.5">
            Real-time multi-profile orchestration, resource monitoring & task analytics
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowProfileModal(true)}
            className="btn btn-primary text-xs py-2 px-3.5 flex items-center gap-2 shadow-sm"
          >
            <PlusIcon size={14} />
            <span>New Profile</span>
          </button>

          <button
            onClick={() => navigate('/profiles?action=import')}
            className="btn btn-secondary text-xs py-2 px-3 flex items-center gap-2"
          >
            <DownloadIcon size={14} />
            <span>Import</span>
          </button>

          <button
            onClick={() => navigate('/automation')}
            className="btn btn-secondary text-xs py-2 px-3 flex items-center gap-2"
          >
            <ZapIcon size={14} />
            <span>Automation</span>
          </button>

          <button
            onClick={() => setShowQueue(!showQueue)}
            className={`btn text-xs py-2 px-3 flex items-center gap-2 border ${
              showQueue
                ? 'bg-brand-500/10 border-brand-500/30 text-brand-600 dark:text-brand-400'
                : 'btn-secondary'
            }`}
          >
            <LayersIcon size={14} />
            <span>Queue ({metrics.waitingJobs + metrics.activeAutomations})</span>
          </button>

          <button
            onClick={loadData}
            title="Refresh metrics"
            className="p-2 rounded-xl border border-slate-200 dark:border-app-border bg-white dark:bg-app-surface text-slate-500 dark:text-app-muted hover:text-slate-800 dark:hover:text-app-text hover:bg-slate-50 dark:hover:bg-app-surface-2 transition-all"
          >
            <RefreshIcon size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Total Profiles"
          value={metrics.totalProfiles}
          subtitle={`${metrics.readyProfiles} ready • ${metrics.runningProfiles} active`}
          icon={UsersIcon}
          colorClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          borderClass="border-indigo-500/20"
          onClick={() => navigate('/profiles')}
        />

        <MetricCard
          title="Active Browsers"
          value={metrics.activeBrowsers}
          subtitle={`Max limit: ${metrics.resourceStatus.browsers.max}`}
          icon={ActivityIcon}
          colorClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          borderClass="border-emerald-500/20"
        />

        <MetricCard
          title="Active Automations"
          value={metrics.activeAutomations}
          subtitle={`${metrics.waitingJobs} waiting in queue`}
          icon={ZapIcon}
          colorClass="bg-brand-500/10 text-brand-600 dark:text-brand-400"
          borderClass="border-brand-500/20"
          onClick={() => navigate('/automation')}
        />

        <MetricCard
          title="Success Today"
          value={metrics.successfulJobsToday}
          subtitle="Completed automation runs"
          icon={CheckIcon}
          colorClass="bg-teal-500/10 text-teal-600 dark:text-teal-400"
          borderClass="border-teal-500/20"
          onClick={() => navigate('/logs')}
        />

        <MetricCard
          title="Errors & Warnings"
          value={metrics.errorProfiles + metrics.warningProfiles + metrics.failedJobsToday}
          subtitle={`${metrics.failedJobsToday} failed jobs today`}
          icon={AlertIcon}
          colorClass="bg-rose-500/10 text-rose-600 dark:text-rose-400"
          borderClass="border-rose-500/20"
          onClick={() => navigate('/logs')}
        />
      </div>

      {/* Middle Section: Resource Overview + Queue Summary + Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 1 Column: System & Resource Status */}
        <div className="space-y-6">
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 dark:text-app-text tracking-wide uppercase flex items-center gap-2">
                <ActivityIcon size={14} className="text-brand-500" />
                Resource Overview
              </h3>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-app-surface-2 text-slate-600 dark:text-app-muted">
                Host Metrics
              </span>
            </div>

            <div className="space-y-4 pt-1">
              <ResourceBar
                label="RAM Usage"
                current={metrics.resourceStatus.memory.usedMb || 0}
                max={metrics.resourceStatus.memory.totalMb || 16384}
                unit="MB"
                color={
                  (metrics.resourceStatus.memory.percent || 0) > 85
                    ? 'bg-rose-500'
                    : (metrics.resourceStatus.memory.percent || 0) > 70
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }
              />

              <ResourceBar
                label="Browser Instances"
                current={metrics.activeBrowsers}
                max={metrics.resourceStatus.browsers.max || 5}
                color="bg-brand-500"
              />

              <ResourceBar
                label="Automation Slots"
                current={metrics.activeAutomations}
                max={metrics.resourceStatus.automations.max || 3}
                color="bg-indigo-500"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-app-border flex items-center justify-between text-xs text-slate-500 dark:text-app-muted">
              <span>Low-Resource Guard</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <ShieldCheckIcon size={13} /> Active
              </span>
            </div>
          </div>

          {/* Quick Actions Shortcuts Card */}
          <div className="card p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-app-text tracking-wide uppercase">
              Quick Management
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowProfileModal(true)}
                className="p-3 rounded-xl border border-slate-200/80 dark:border-app-border bg-slate-50/60 dark:bg-app-surface-2/40 hover:bg-slate-100 dark:hover:bg-app-surface-2 text-left transition-all group"
              >
                <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <PlusIcon size={14} />
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-app-text">New Profile</p>
                <p className="text-[10px] text-slate-400 dark:text-app-muted-2 mt-0.5">
                  Configure browser
                </p>
              </button>

              <button
                onClick={() => navigate('/automation')}
                className="p-3 rounded-xl border border-slate-200/80 dark:border-app-border bg-slate-50/60 dark:bg-app-surface-2/40 hover:bg-slate-100 dark:hover:bg-app-surface-2 text-left transition-all group"
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <PlayIcon size={14} />
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-app-text">Run Automation</p>
                <p className="text-[10px] text-slate-400 dark:text-app-muted-2 mt-0.5">
                  Execute scripts
                </p>
              </button>

              <button
                onClick={() => setShowQueue(true)}
                className="p-3 rounded-xl border border-slate-200/80 dark:border-app-border bg-slate-50/60 dark:bg-app-surface-2/40 hover:bg-slate-100 dark:hover:bg-app-surface-2 text-left transition-all group"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <LayersIcon size={14} />
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-app-text">Open Queue</p>
                <p className="text-[10px] text-slate-400 dark:text-app-muted-2 mt-0.5">
                  {metrics.waitingJobs} waiting
                </p>
              </button>

              <button
                onClick={() => navigate('/logs')}
                className="p-3 rounded-xl border border-slate-200/80 dark:border-app-border bg-slate-50/60 dark:bg-app-surface-2/40 hover:bg-slate-100 dark:hover:bg-app-surface-2 text-left transition-all group"
              >
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <ScrollIcon size={14} />
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-app-text">Execution Logs</p>
                <p className="text-[10px] text-slate-400 dark:text-app-muted-2 mt-0.5">
                  View failures
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Recent Activity Feed */}
        <div className="lg:col-span-2 card p-5 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-app-text tracking-wide uppercase flex items-center gap-2">
                <ClockIcon size={14} className="text-brand-500" />
                Recent Activity
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-app-muted mt-0.5">
                Real-time stream of sessions, automations, crashes and proxy alerts
              </p>
            </div>
            <button
              onClick={() => navigate('/logs')}
              className="text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline"
            >
              View all logs →
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px] space-y-2.5 pr-1">
            {filteredActivities.length === 0 ? (
              <div className="py-16 text-center text-slate-400 dark:text-app-muted text-xs space-y-2">
                <ClockIcon size={24} className="mx-auto opacity-40" />
                <p>No recent activity records found</p>
              </div>
            ) : (
              filteredActivities.map((act) => (
                <ActivityItem
                  key={act.id}
                  item={act}
                  onClick={() => {
                    if (act.type.startsWith('automation')) {
                      navigate('/logs')
                    } else if (act.profileId) {
                      navigate('/profiles')
                    }
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Profile Creation Modal */}
      {showProfileModal && (
        <ProfileFormModal
          mode="create"
          onClose={() => setShowProfileModal(false)}
          onSubmit={async (data) => {
            if (window.electronAPI && window.electronAPI.createProfile) {
              await window.electronAPI.createProfile(data)
              await loadData()
            }
          }}
        />
      )}

      {/* Queue Drawer / Panel */}
      {showQueue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-app-surface rounded-2xl border border-slate-200 dark:border-app-border shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-app-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-app-text flex items-center gap-2">
                <LayersIcon size={16} className="text-brand-500" />
                Automation Queue Manager
              </h3>
              <button
                onClick={() => setShowQueue(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-app-muted dark:hover:text-app-text hover:bg-slate-100 dark:hover:bg-app-surface-2 transition-all"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <QueuePanel />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
