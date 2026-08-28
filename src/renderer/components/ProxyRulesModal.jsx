import { useState, useEffect, useCallback } from 'react'
import { GlobeIcon } from './icons'
import { useWorkspace } from '../context/WorkspaceContext'

export default function ProxyRulesModal({ isOpen, onClose, onApplied }) {
  const { currentWorkspaceId } = useWorkspace()
  const [ruleType, setRuleType] = useState('unassigned')
  const [groupName, setGroupName] = useState('')
  const [mode, setMode] = useState('least_used')
  const [manualProxyId, setManualProxyId] = useState('')
  const [maxPerProxy, setMaxPerProxy] = useState(5)
  const [proxyStats, setProxyStats] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const reloadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (window.electronAPI) {
        const wsOpt = currentWorkspaceId && currentWorkspaceId !== 'all' ? { workspace_id: currentWorkspaceId } : {}
        if (window.electronAPI.getProxyStats) {
          const stats = await window.electronAPI.getProxyStats(wsOpt)
          setProxyStats(stats || [])
          if (stats && stats[0]) setManualProxyId(stats[0].id)
        }
        if (window.electronAPI.getProfiles) {
          const profiles = await window.electronAPI.getProfiles(wsOpt)
          const distinct = Array.from(new Set(profiles.map((p) => p.group_name || p.group).filter(Boolean)))
          setGroups(distinct)
          if (distinct[0]) setGroupName(distinct[0])
        }
      }
    } catch (err) {
      setError(err.message || 'Failed loading proxy stats')
    } finally {
      setLoading(false)
    }
  }, [currentWorkspaceId])

  useEffect(() => {
    if (isOpen) reloadData()
  }, [isOpen, reloadData])

  if (!isOpen) return null

  const handleApply = async () => {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      if (window.electronAPI && window.electronAPI.applyProxyRule) {
        const res = await window.electronAPI.applyProxyRule({
          ruleType,
          groupName: ruleType === 'group' ? groupName : undefined,
          workspaceId: currentWorkspaceId === 'all' ? 'default' : currentWorkspaceId,
          mode,
          manualProxyId: mode === 'manual' ? manualProxyId : undefined,
          maxPerProxy: Number(maxPerProxy) || 5,
        })
        if (res && res.success) {
          setNotice(`Assigned proxies to ${res.assignedCount} profiles!`)
          if (res.warnings && res.warnings.length > 0) {
            setError(res.warnings.join('; '))
          }
          await reloadData()
          if (onApplied) onApplied()
        } else {
          setError(res?.error || 'Assignment failed')
        }
      }
    } catch (err) {
      setError(err.message || 'Assignment failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-app-surface rounded-2xl border border-slate-200 dark:border-app-border shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-app-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <GlobeIcon size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-app-text">
                Proxy Assignment Rules
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
                Automated multi-profile routing with capacity balancing
              </p>
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
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {notice && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-semibold animate-fade-in">
              {notice}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 font-semibold flex items-center justify-between animate-fade-in">
              <span>{error}</span>
              <button onClick={() => setError(null)}>✕</button>
            </div>
          )}

          {/* Rule Type */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-app-text">
              Target Profiles
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRuleType('unassigned')}
                className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                  ruleType === 'unassigned'
                    ? 'bg-brand-500/10 border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-slate-200 dark:border-app-border text-slate-600 dark:text-app-muted'
                }`}
              >
                Unassigned Only
              </button>
              <button
                type="button"
                onClick={() => setRuleType('group')}
                className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                  ruleType === 'group'
                    ? 'bg-brand-500/10 border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-slate-200 dark:border-app-border text-slate-600 dark:text-app-muted'
                }`}
              >
                Profile Group
              </button>
              <button
                type="button"
                onClick={() => setRuleType('workspace')}
                className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                  ruleType === 'workspace'
                    ? 'bg-brand-500/10 border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-slate-200 dark:border-app-border text-slate-600 dark:text-app-muted'
                }`}
              >
                All in Workspace
              </button>
            </div>

            {ruleType === 'group' && (
              <select
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="input w-full text-xs mt-2"
              >
                {groups.length === 0 ? (
                  <option value="">(No groups found)</option>
                ) : (
                  groups.map((g) => (
                    <option key={g} value={g}>
                      Group: {g}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Strategy */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-app-text">
                Assignment Mode
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="input w-full text-xs"
              >
                <option value="least_used">Least Used (Balanced Load)</option>
                <option value="round_robin">Round Robin (Cyclic)</option>
                <option value="manual">Single Proxy (Manual)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-app-text">
                Max Profiles Per Proxy
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={maxPerProxy}
                onChange={(e) => setMaxPerProxy(parseInt(e.target.value) || 5)}
                className="input w-full text-xs"
              />
            </div>
          </div>

          {mode === 'manual' && (
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-app-text">
                Select Destination Proxy
              </label>
              <select
                value={manualProxyId}
                onChange={(e) => setManualProxyId(e.target.value)}
                className="input w-full text-xs"
              >
                {proxyStats.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.host}:{p.port}) — {p.assigned_profile_count} profiles
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Proxy Pool Usage Preview */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-app-border">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Proxy Pool Load & Capacity ({proxyStats.length} Proxies)
            </span>
            <div className="space-y-1.5 max-h-44 overflow-y-auto border border-slate-200/80 dark:border-app-border rounded-xl p-2">
              {proxyStats.map((p) => (
                <div
                  key={p.id}
                  className="p-2 rounded-lg bg-slate-50 dark:bg-app-surface-2/40 flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-bold text-slate-800 dark:text-app-text truncate">
                      {p.name}
                    </span>
                    <span className="font-mono text-slate-400 text-[10px]">
                      {p.host}:{p.port}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`font-mono font-bold ${
                        p.assigned_profile_count > (p.max_profiles || maxPerProxy)
                          ? 'text-rose-500'
                          : 'text-slate-600 dark:text-app-muted'
                      }`}
                    >
                      {p.assigned_profile_count} / {p.max_profiles || maxPerProxy} profiles
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-app-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary text-xs py-1.5 px-3"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={loading || proxyStats.length === 0}
            className="btn btn-primary text-xs py-1.5 px-4"
          >
            {loading ? 'Assigning...' : 'Execute Proxy Assignment'}
          </button>
        </div>
      </div>
    </div>
  )
}
