import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  PlusIcon,
  UsersIcon,
  TrashIcon,
  CheckIcon,
  ChevronDownIcon,
  FolderIcon,
  GlobeIcon,
  PowerIcon,
  ActivityIcon,
  FilterIcon,
  CloseIcon,
  ChromiumIcon,
  ChromeIcon,
  EdgeIcon,
  FirefoxIcon,
  LayersIcon,
} from '../components/icons'
import ProfileFormModal from '../components/ProfileFormModal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import MoveGroupModal from '../components/MoveGroupModal'
import DuplicateProfileModal from '../components/DuplicateProfileModal'
import DiagnosticsModal from '../components/DiagnosticsModal'
import HealthCheckModal from '../components/HealthCheckModal'
import ProfileMenu from '../components/ProfileMenu'
import ProfileAvatar from '../components/ProfileAvatar'
import TemplatesModal from '../components/TemplatesModal'
import BulkCreateProfilesModal from '../components/BulkCreateProfilesModal'
import CookieManagerModal from '../components/CookieManagerModal'
import TotpModal from '../components/TotpModal'
import WarmupModal from '../components/WarmupModal'
import FingerprintInspectorModal from '../components/FingerprintInspectorModal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useWorkspace } from '../context/WorkspaceContext'

function BrowserBadge({ type }) {
  const t = (type || 'chromium').toLowerCase()
  if (t === 'chrome') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <ChromeIcon size={12} />
        Chrome
      </span>
    )
  }
  if (t === 'msedge' || t === 'edge') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
        <EdgeIcon size={12} />
        Edge
      </span>
    )
  }
  if (t === 'firefox') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
        <FirefoxIcon size={12} />
        Firefox
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
      <ChromiumIcon size={12} />
      Chromium
    </span>
  )
}

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
  const map = {
    running: {
      label: 'Running',
      cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 shadow-sm shadow-emerald-500/10',
      dot: 'bg-emerald-500 animate-ping',
      solidDot: 'bg-emerald-500',
    },
    error: {
      label: 'Error',
      cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
      dot: 'bg-rose-500',
      solidDot: 'bg-rose-500',
    },
    warning: {
      label: 'Warning',
      cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
      dot: 'bg-amber-500',
      solidDot: 'bg-amber-500',
    },
    queued: {
      label: 'Waiting for slot',
      cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25',
      dot: 'bg-sky-500 animate-ping',
      solidDot: 'bg-sky-500',
    },
    idle: {
      label: 'Ready',
      cls: 'bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/60',
      dot: 'bg-slate-400 dark:bg-slate-500',
      solidDot: 'bg-slate-400 dark:bg-slate-500',
    },
  }
  const s = map[status] || map.idle
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold border ${s.cls}`}>
      <span className="relative flex h-2 w-2">
        {status === 'running' && (
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${s.dot}`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${s.solidDot}`} />
      </span>
      {s.label}
    </span>
  )
}

function TagChips({ tags }) {
  if (!tags || tags.length === 0) return <span className="text-xs text-slate-300 dark:text-app-muted-2">—</span>
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {tags.slice(0, 3).map((tag, i) => (
        <span
          key={i}
          className="px-2.5 py-0.5 rounded-lg bg-brand-500/10 dark:bg-brand-500/15 border border-brand-500/20 text-[11px] font-semibold text-brand-600 dark:text-brand-400"
        >
          {tag}
        </span>
      ))}
      {tags.length > 3 && (
        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-app-surface-3 text-[10px] font-bold text-slate-500 dark:text-app-muted">
          +{tags.length - 3}
        </span>
      )}
    </div>
  )
}

function Checkbox({ checked, onChange, indeterminate }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-150 active:scale-95 ${
        checked || indeterminate
          ? 'bg-brand-600 border-brand-600 text-white shadow-sm shadow-brand-600/30'
          : 'border-slate-300 dark:border-app-border-light bg-white dark:bg-app-surface hover:border-brand-500'
      }`}
    >
      {checked && <CheckIcon size={12} className="stroke-[2.5]" />}
      {indeterminate && !checked && <div className="w-2 h-0.5 bg-white rounded-full" />}
    </button>
  )
}

function Select({ value, onChange, options, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none w-full pl-3.5 pr-8 py-2 rounded-xl bg-white dark:bg-app-surface text-slate-800 dark:text-app-text text-xs font-semibold border border-slate-200/90 dark:border-app-border focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 cursor-pointer shadow-xs transition-all"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        size={14}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-app-muted-2 pointer-events-none"
      />
    </div>
  )
}

function EmptyState({ onNew, hasFilter }) {
  return (
    <div className="empty-state py-20">
      <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-app-surface-2 border border-slate-200 dark:border-app-border flex items-center justify-center mb-4 shadow-inner">
        <UsersIcon size={28} className="text-slate-400 dark:text-app-muted-2" />
      </div>
      {hasFilter ? (
        <>
          <h3 className="text-sm font-bold text-slate-800 dark:text-app-text mb-1">
            No matching profiles
          </h3>
          <p className="text-xs text-slate-400 dark:text-app-muted-2 mb-4 max-w-xs leading-relaxed">
            We couldn't find any profiles matching your search query or group filter.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-base font-bold text-slate-800 dark:text-app-text mb-1">
            No browser profiles yet
          </h3>
          <p className="text-xs text-slate-400 dark:text-app-muted-2 mb-6 max-w-sm leading-relaxed">
            Create your first isolated browser profile. Each session maintains independent cookies, logins, storage, and proxies.
          </p>
          <button onClick={onNew} className="btn-primary">
            <PlusIcon size={15} />
            Create First Profile
          </button>
        </>
      )}
    </div>
  )
}

function Profiles({ search = '' }) {
  const { currentWorkspaceId, reloadWorkspaces } = useWorkspace()
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState({})
  const [formModal, setFormModal] = useState(null)
  const [duplicateTarget, setDuplicateTarget] = useState(null)
  const [diagnosticsTarget, setDiagnosticsTarget] = useState(null)
  const [healthTarget, setHealthTarget] = useState(null)
  const [cookieTarget, setCookieTarget] = useState(null)
  const [totpTarget, setTotpTarget] = useState(null)
  const [warmupTarget, setWarmupTarget] = useState(null)
  const [inspectTarget, setInspectTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [moveTarget, setMoveTarget] = useState(null)
  const [showTemplatesModal, setShowTemplatesModal] = useState(false)
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false)
  const [templates, setTemplates] = useState([])
  const [notice, setNotice] = useState({ type: 'success', text: '' })
  const [busyId, setBusyId] = useState(null)
  const [groupFilter, setGroupFilter] = useState('__all__')
  const [sortKey, setSortKey] = useState('created_desc')
  const [proxies, setProxies] = useState([])
  const [confirmDialog, setConfirmDialog] = useState(null)

  const handleSaveAsTemplate = async (profile) => {
    try {
      if (window.electronAPI && window.electronAPI.createTemplateFromProfile) {
        await window.electronAPI.createTemplateFromProfile(profile.id, {
          name: `Template - ${profile.name}`,
        })
        setNotice({ type: 'success', text: `Saved profile "${profile.name}" as reusable template!` })
      }
    } catch (err) {
      showError(err)
    }
  }

  const applyStatus = useCallback((id, status) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)))
  }, [])

  const refresh = useCallback(async () => {
    const opts = currentWorkspaceId && currentWorkspaceId !== 'all' ? { workspace_id: currentWorkspaceId } : {}
    const data = await window.electronAPI.getProfiles(opts)
    setProfiles(data || [])
    setLoading(false)
  }, [currentWorkspaceId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const opts = currentWorkspaceId && currentWorkspaceId !== 'all' ? { workspace_id: currentWorkspaceId } : {}
    window.electronAPI.getProxies(opts).then((data) => setProxies(data || []))
    window.electronAPI.getTemplates(opts).then((data) => setTemplates(data || []))
  }, [currentWorkspaceId])

  useEffect(() => {
    let disposed = false
    window.electronAPI.getRunningProfiles().then((running) => {
      if (disposed) return
      const runningIds = new Set((running || []).map((r) => r.id))
      setProfiles((prev) =>
        prev.map((p) => (runningIds.has(p.id) ? { ...p, status: 'running' } : p))
      )
    })
    const unsubscribe = window.electronAPI.onProfileStatusChanged(({ id, status }) => {
      applyStatus(id, status)
    })
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [applyStatus])

  useEffect(() => {
    if (!notice.text) return
    const t = setTimeout(() => setNotice({ type: 'success', text: '' }), 3500)
    return () => clearTimeout(t)
  }, [notice])

  const showError = (err) => setNotice({ type: 'error', text: err.message || 'Something went wrong' })

  const allGroups = useMemo(() => {
    const set = new Set()
    profiles.forEach((p) => p.group_name && set.add(p.group_name))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [profiles])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let list = profiles.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(q) ||
        (p.group_name || '').toLowerCase().includes(q) ||
        (p.notes || '').toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q))
      const matchGroup =
        groupFilter === '__all__' || (groupFilter === '__none__' ? !p.group_name : p.group_name === groupFilter)
      return matchSearch && matchGroup
    })

    const sorters = {
      created_desc: (a, b) => new Date(b.created_at) - new Date(a.created_at),
      created_asc: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      updated_desc: (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at),
      name_asc: (a, b) => a.name.localeCompare(b.name),
      name_desc: (a, b) => b.name.localeCompare(a.name),
    }
    list = [...list].sort(sorters[sortKey] || sorters.created_desc)
    return list
  }, [profiles, search, groupFilter, sortKey])

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected])
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected[p.id])
  const someSelected = selectedIds.length > 0 && !allFilteredSelected

  const runningProfilesCount = useMemo(() => profiles.filter((p) => p.status === 'running').length, [profiles])
  const proxiedProfilesCount = useMemo(() => profiles.filter((p) => p.proxy_id || p.proxy).length, [profiles])

  function toggleAll() {
    const next = { ...selected }
    filtered.forEach((p) => {
      next[p.id] = !allFilteredSelected
    })
    setSelected(next)
  }

  function toggleOne(id) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function clearSelection() {
    setSelected({})
  }

  async function handleCreate(payload) {
    await window.electronAPI.createProfile(payload)
    setNotice({ type: 'success', text: 'Profile created successfully' })
    await refresh()
  }

  async function handleEdit(payload) {
    await window.electronAPI.updateProfile(formModal.id, payload)
    setNotice({ type: 'success', text: 'Profile updated' })
    await refresh()
  }

  async function handlePerformDuplicate(id, options = {}) {
    await window.electronAPI.duplicateProfile(id, options)
    setNotice({
      type: 'success',
      text: options.copySession
        ? 'Profile duplicated with full session & cookies'
        : 'Profile duplicated (clean isolated session)',
    })
    await refresh()
  }

  async function handleClearSession(profile) {
    setConfirmDialog({
      title: 'Clear Session Data',
      subtitle: 'Cookies, login & cache',
      message: `Clear all cookies, login sessions, and cache for profile "${profile.name}"? Environment settings and proxy will remain intact.`,
      confirmLabel: 'Clear Session',
      loadingLabel: 'Clearing...',
      tone: 'danger',
      onConfirm: async () => {
        await window.electronAPI.clearProfileSession(profile.id)
        setNotice({ type: 'success', text: `Session data & cookies cleared for "${profile.name}"` })
        await refresh()
      },
    })
  }

  async function handleDelete(id, options) {
    await window.electronAPI.deleteProfile(id, options)
    setNotice({ type: 'success', text: options.deleteData ? 'Profile & data folder deleted' : 'Profile deleted' })
    setSelected((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    await refresh()
  }

  async function handleOpen(id) {
    setBusyId(id)
    try {
      const result = await window.electronAPI.openProfile(id)
      if (result && result.queued) {
        setNotice({ type: 'warning', text: result.message || 'Waiting for a browser slot' })
        applyStatus(id, 'queued')
        return
      }
      applyStatus(id, 'running')
    } catch (err) {
      showError(err)
    } finally {
      setBusyId(null)
    }
  }

  async function handleClose(id) {
    setBusyId(id)
    try {
      await window.electronAPI.closeProfile(id)
      applyStatus(id, 'idle')
    } catch (err) {
      showError(err)
    } finally {
      setBusyId(null)
    }
  }

  async function handleMoveSingle(group) {
    await window.electronAPI.updateProfile(moveTarget.id, { group })
    setNotice({ type: 'success', text: group ? `Moved to "${group}"` : 'Group cleared' })
    await refresh()
  }

  async function handleBulkMove(group) {
    await window.electronAPI.bulkSetGroup(selectedIds, group)
    setNotice({ type: 'success', text: `Moved ${selectedIds.length} profiles to "${group || 'No group'}"` })
    clearSelection()
    await refresh()
  }

  async function handleBulkDelete() {
    setConfirmDialog({
      title: 'Delete Profiles',
      subtitle: 'Permanent deletion',
      message: `Are you sure you want to delete ${selectedIds.length} selected profiles? This action cannot be undone.`,
      confirmLabel: 'Delete Profiles',
      loadingLabel: 'Deleting...',
      tone: 'danger',
      onConfirm: async () => {
        await window.electronAPI.bulkDeleteProfiles(selectedIds, { deleteData: false })
        setNotice({ type: 'success', text: `${selectedIds.length} profiles deleted` })
        clearSelection()
        await refresh()
      },
    })
  }

  async function handleBulkOpen() {
    const targets = filtered.filter((p) => selected[p.id] && p.status !== 'running')
    if (targets.length === 0) {
      setNotice({ type: 'warning', text: 'Selected profiles are already running' })
      return
    }
    for (const profile of targets) {
      try {
        const result = await window.electronAPI.openProfile(profile.id)
        if (result && result.queued) {
          applyStatus(profile.id, 'queued')
        } else {
          applyStatus(profile.id, 'running')
        }
      } catch (err) {
        showError(err)
      }
    }
    setNotice({ type: 'success', text: `Opening ${targets.length} profile(s)...` })
    clearSelection()
  }

  async function handleAlignEnvironment(profile) {
    try {
      const res = await window.electronAPI.alignEnvironmentToProxy(profile.id)
      if (res && res.success) {
        setNotice({ type: 'success', text: `Đã khớp môi trường của "${profile.name}" với quốc gia proxy (${res.country}): timezone ${res.environment.timezone}, locale ${res.environment.locale}` })
      } else {
        showError(new Error((res && res.error) || 'Không thể khớp môi trường'))
      }
      await refresh()
    } catch (err) {
      showError(err)
    }
  }

  async function handleBulkAssignRandomProxy() {
    const targets = filtered.filter((p) => selected[p.id])
    if (targets.length === 0) return
    setConfirmDialog({
      title: 'Assign Random Proxies',
      subtitle: 'Create & assign one per profile',
      message: `Create a random proxy placeholder and assign it to each of the ${targets.length} selected profiles? Replace them with real proxies before relying on them for traffic.`,
      confirmLabel: 'Assign Random Proxies',
      loadingLabel: 'Assigning...',
      onConfirm: async () => {
        await window.electronAPI.assignRandomProxiesToProfiles(targets.map((p) => p.id))
        setNotice({ type: 'success', text: `Đã tạo và gán proxy ngẫu nhiên cho ${targets.length} hồ sơ` })
        clearSelection()
        await refresh()
      },
    })
  }

  function formatDate(value) {
    if (!value) return '—'
    const d = new Date(value.replace(' ', 'T'))
    if (isNaN(d)) return value
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const groupOptions = [
    { value: '__all__', label: 'All Groups' },
    { value: '__none__', label: 'Unassigned' },
    ...allGroups.map((g) => ({ value: g, label: g })),
  ]

  const sortOptions = [
    { value: 'created_desc', label: 'Newest First' },
    { value: 'created_asc', label: 'Oldest First' },
    { value: 'updated_desc', label: 'Recently Modified' },
    { value: 'name_asc', label: 'Name (A → Z)' },
    { value: 'name_desc', label: 'Name (Z → A)' },
  ]

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto space-y-6">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Profiles"
          value={profiles.length}
          subtitle="Managed environments"
          icon={UsersIcon}
          colorClass="bg-brand-500/10 text-brand-600 dark:text-brand-400"
          borderClass="border-brand-500/20"
        />
        <MetricCard
          title="Active Sessions"
          value={runningProfilesCount}
          subtitle={runningProfilesCount > 0 ? 'Live Chromium windows' : 'All profiles idle'}
          icon={ActivityIcon}
          colorClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          borderClass="border-emerald-500/20"
        />
        <MetricCard
          title="Groups"
          value={allGroups.length}
          subtitle="Folder categories"
          icon={FolderIcon}
          colorClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          borderClass="border-amber-500/20"
        />
        <MetricCard
          title="Proxied Profiles"
          value={proxiedProfilesCount}
          subtitle={`${proxies.length} available proxies`}
          icon={GlobeIcon}
          colorClass="bg-sky-500/10 text-sky-600 dark:text-sky-400"
          borderClass="border-sky-500/20"
        />
      </div>

      {/* Action and Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-app-surface px-3 py-2 rounded-xl border border-slate-200/90 dark:border-app-border shadow-xs">
            <FilterIcon size={14} className="text-slate-400 dark:text-app-muted-2" />
            <span className="text-xs font-bold text-slate-700 dark:text-app-text">Filter:</span>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-brand-600 dark:text-brand-400 focus:outline-none cursor-pointer pr-2"
            >
              {groupOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-white dark:bg-app-surface text-slate-800 dark:text-app-text">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <Select value={sortKey} onChange={setSortKey} options={sortOptions} className="w-44" />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkCreateModal(true)}
            className="btn btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5"
          >
            <PlusIcon size={14} />
            <span>Tạo hàng loạt</span>
          </button>
          <button
            onClick={() => setShowTemplatesModal(true)}
            className="btn btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5"
          >
            <LayersIcon size={14} />
            <span>Templates</span>
          </button>

          <button onClick={() => setFormModal({ mode: 'create' })} className="btn-primary">
            <PlusIcon size={15} />
            <span>New Profile</span>
          </button>
        </div>
      </div>

      {/* Notice Toast Banner */}
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

      {/* Main Table Card */}
      {loading ? (
        <div className="card flex flex-col items-center justify-center py-28 gap-3">
          <div className="w-7 h-7 border-2 border-slate-200 dark:border-app-border-light border-t-brand-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-400 dark:text-app-muted-2 font-medium">Loading profiles...</p>
        </div>
      ) : profiles.length === 0 ? (
        <div className="card">
          <EmptyState onNew={() => setFormModal({ mode: 'create' })} hasFilter={false} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState onNew={() => setFormModal({ mode: 'create' })} hasFilter={true} />
        </div>
      ) : (
        <div className="card overflow-visible">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-app-border bg-slate-50/60 dark:bg-app-surface-2/40 text-[11px] font-bold text-slate-400 dark:text-app-muted uppercase tracking-wider">
                  <th className="px-5 py-3.5 w-12 text-center">
                    <Checkbox checked={allFilteredSelected} indeterminate={someSelected} onChange={toggleAll} />
                  </th>
                  <th className="px-3 py-3.5">Profile Name</th>
                  <th className="px-4 py-3.5">Engine</th>
                  <th className="px-4 py-3.5">Group</th>
                  <th className="px-4 py-3.5">Proxy Routing</th>
                  <th className="px-4 py-3.5">Tags</th>
                  <th className="px-4 py-3.5">Session Status</th>
                  <th className="px-4 py-3.5">Created</th>
                  <th className="px-6 py-3.5 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-app-border text-xs">
                {filtered.map((profile) => {
                  const isChecked = Boolean(selected[profile.id])
                  const isBusy = busyId === profile.id
                  const isRunning = profile.status === 'running'

                  return (
                    <tr
                      key={profile.id}
                      className={`transition-colors duration-150 ${
                        isChecked
                          ? 'bg-brand-500/5 dark:bg-brand-500/10'
                          : 'hover:bg-slate-50/80 dark:hover:bg-app-surface-2/40'
                      }`}
                    >
                      <td className="px-5 py-3.5 text-center">
                        <Checkbox checked={isChecked} onChange={() => toggleOne(profile.id)} />
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-3">
                          <ProfileAvatar seed={profile.id} name={profile.name} status={profile.status} size={34} />
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-slate-900 dark:text-app-text truncate max-w-[180px]">
                              {profile.name}
                            </p>
                            {profile.notes ? (
                              <p className="text-[11px] text-slate-400 dark:text-app-muted-2 truncate max-w-[180px]">
                                {profile.notes}
                              </p>
                            ) : (
                              <p className="text-[10px] text-slate-300 dark:text-app-muted-2/60 font-mono">
                                {profile.id.slice(0, 8)}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <BrowserBadge type={profile.browser_type} />
                      </td>
                      <td className="px-4 py-3.5">
                        {profile.group_name ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-app-surface-3 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-app-border">
                            <FolderIcon size={12} className="text-brand-500" />
                            {profile.group_name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-app-muted-2 italic">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {profile.proxy ? (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-app-text">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                            <span className="truncate max-w-[130px] font-mono text-[11px]">{profile.proxy.name}</span>
                            {profile.proxy.country_code && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-app-surface-3 text-slate-600 dark:text-app-muted uppercase">
                                {profile.proxy.country_code}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-app-muted-2 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                            Trực tiếp
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <TagChips tags={profile.tags} />
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={profile.status} />
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-medium text-slate-500 dark:text-app-muted">
                          {formatDate(profile.created_at)}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isBusy ? (
                            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-app-surface-3 border border-slate-200 dark:border-app-border text-[11px] font-semibold text-slate-500 dark:text-app-muted">
                              <span className="w-3 h-3 border-2 border-slate-400 border-t-brand-500 rounded-full animate-spin" />
                              Working...
                            </span>
                          ) : isRunning ? (
                            <button
                              onClick={() => handleClose(profile.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[11px] font-bold transition-all hover:bg-rose-500/20 active:scale-95 shadow-xs"
                              title="Stop browser session"
                            >
                              <PowerIcon size={12} />
                              Close
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpen(profile.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-500/10 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/25 text-[11px] font-bold transition-all hover:bg-brand-500/25 active:scale-95 shadow-xs"
                              title="Open Chromium browser"
                            >
                              <PowerIcon size={12} />
                              Mở
                            </button>
                          )}
                          <ProfileMenu
                            running={isRunning}
                            busy={isBusy}
                            onOpen={() => handleOpen(profile.id)}
                            onClose={() => handleClose(profile.id)}
                            onEdit={() => setFormModal({ mode: 'edit', id: profile.id, profile })}
                            onDuplicate={() => setDuplicateTarget(profile)}
                            onCreateTemplate={() => handleSaveAsTemplate(profile)}
                            onCookies={() => setCookieTarget(profile)}
                            onTotp={() => setTotpTarget(profile)}
                            onWarmup={() => setWarmupTarget(profile)}
                            onInspect={() => setInspectTarget(profile)}
                            onAlignEnvironment={() => handleAlignEnvironment(profile)}
                            onClearSession={() => handleClearSession(profile)}
                            onDiagnostics={() => setDiagnosticsTarget(profile)}
                            onHealthCheck={() => setHealthTarget(profile)}
                            onMove={() => setMoveTarget({ type: 'single', id: profile.id, profile })}
                            onDelete={() => setDeleteTarget(profile)}
                          />
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

      {/* Floating Multi-Select Capsule */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/90 dark:bg-app-surface/90 backdrop-blur-xl border border-slate-200/90 dark:border-brand-500/30 shadow-2xl shadow-slate-900/20 dark:shadow-black/70 animate-scale-in">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-app-border">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-900 dark:text-app-text">
              {selectedIds.length} Selected
            </span>
          </div>
          <button
            onClick={() => setMoveTarget({ type: 'bulk' })}
            className="btn-secondary"
          >
            <FolderIcon size={14} />
            Move Group
          </button>
          <button
            onClick={handleBulkOpen}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-500/10 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/25 text-xs font-bold transition-all hover:bg-brand-500/25 active:scale-95 shadow-xs"
          >
            <PowerIcon size={14} />
            Open
          </button>
          <button
            onClick={handleBulkAssignRandomProxy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500/10 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25 text-xs font-bold transition-all hover:bg-sky-500/25 active:scale-95 shadow-xs"
            title="Tạo và gán proxy ngẫu nhiên cho từng hồ sơ"
          >
            <GlobeIcon size={14} />
            Add Proxy
          </button>
          <button
            onClick={handleBulkDelete}
            className="btn-danger"
          >
            <TrashIcon size={14} />
            Delete
          </button>
          <button
            onClick={clearSelection}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-app-muted-2 dark:hover:text-app-text"
            title="Clear selection"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      {/* Modals */}
      {formModal && (
        <ProfileFormModal
          mode={formModal.mode}
          initial={formModal.profile}
          proxies={proxies}
          onClose={() => setFormModal(null)}
          onSubmit={formModal.mode === 'edit' ? handleEdit : handleCreate}
        />
      )}

      {duplicateTarget && (
        <DuplicateProfileModal
          profile={duplicateTarget}
          onClose={() => setDuplicateTarget(null)}
          onDuplicate={handlePerformDuplicate}
        />
      )}

      {diagnosticsTarget && (
        <DiagnosticsModal
          profile={diagnosticsTarget}
          onClose={() => setDiagnosticsTarget(null)}
        />
      )}

      {healthTarget && (
        <HealthCheckModal
          profile={healthTarget}
          onClose={() => setHealthTarget(null)}
          onLaunch={handleOpen}
        />
      )}

      {cookieTarget && (
        <CookieManagerModal profile={cookieTarget} onClose={() => setCookieTarget(null)} />
      )}
      {totpTarget && <TotpModal profile={totpTarget} onClose={() => setTotpTarget(null)} />}
      {warmupTarget && <WarmupModal profile={warmupTarget} onClose={() => setWarmupTarget(null)} />}

      {inspectTarget && (
        <FingerprintInspectorModal profile={inspectTarget} onClose={() => setInspectTarget(null)} />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          profile={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}

      {moveTarget && (
        <MoveGroupModal
          title={moveTarget.type === 'bulk' ? `Move ${selectedIds.length} profiles` : `Move "${moveTarget.profile.name}"`}
          existingGroups={allGroups}
          onClose={() => setMoveTarget(null)}
          onConfirm={moveTarget.type === 'bulk' ? handleBulkMove : handleMoveSingle}
        />
      )}

      {showTemplatesModal && (
        <TemplatesModal
          isOpen={showTemplatesModal}
          onClose={() => setShowTemplatesModal(false)}
          proxies={proxies}
          onProfileCreated={async (count) => {
            await refresh()
            await reloadWorkspaces()
            setNotice({ type: 'success', text: `Successfully generated ${count} profile(s) from template!` })
          }}
        />
      )}

      {showBulkCreateModal && (
        <BulkCreateProfilesModal
          isOpen={showBulkCreateModal}
          onClose={() => setShowBulkCreateModal(false)}
          templates={templates}
          onCreated={async (count) => {
            await refresh()
            await reloadWorkspaces()
            setNotice({ type: 'success', text: `Successfully created ${count} profiles!` })
          }}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          isOpen={Boolean(confirmDialog)}
          title={confirmDialog.title}
          subtitle={confirmDialog.subtitle}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          loadingLabel={confirmDialog.loadingLabel}
          tone={confirmDialog.tone}
          onClose={() => setConfirmDialog(null)}
          onConfirm={confirmDialog.onConfirm}
        />
      )}
    </div>
  )
}

export default Profiles
