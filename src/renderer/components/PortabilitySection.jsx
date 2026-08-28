import { useState, useEffect } from 'react'
import {
  DownloadIcon,
  UploadIcon,
  AlertIcon,
  CheckIcon,
  CloseIcon,
  LayersIcon,
  GlobeIcon,
  FolderIcon,
  CopyIcon,
  ZapIcon,
  ShieldCheckIcon,
} from './icons'

function Notice({ type, children }) {
  return (
    <div
      className={`px-4 py-3 rounded-2xl border text-xs font-semibold flex items-center gap-2 animate-fade-in ${
        type === 'error'
          ? 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'
          : type === 'warning'
          ? 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
          : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
      }`}
    >
      {type === 'error' || type === 'warning' ? <AlertIcon size={15} /> : <CheckIcon size={15} />}
      <span>{children}</span>
    </div>
  )
}

function CheckRow({ checked, onToggle, title, subtitle, icon: Icon }) {
  return (
    <label className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border cursor-pointer select-none">
      <button
        type="button"
        onClick={onToggle}
        className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
          checked
            ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
            : 'border-slate-300 dark:border-app-border-light bg-white dark:bg-app-surface'
        }`}
      >
        {checked && <CheckIcon size={12} className="stroke-[2.5]" />}
      </button>
      {Icon && <Icon size={16} className="text-slate-400 dark:text-app-muted-2 shrink-0" />}
      <div className="flex-1">
        <p className="text-xs font-bold text-slate-900 dark:text-app-text">{title}</p>
        {subtitle && <p className="text-[11px] text-slate-400 dark:text-app-muted-2 mt-0.5">{subtitle}</p>}
      </div>
    </label>
  )
}

function ImportDecisionModal({ inspect, onClose, onImport }) {
  const [strategy, setStrategy] = useState('generate-new')
  const [busy, setBusy] = useState(false)
  const hasConflicts = (inspect.conflicts || []).length > 0
  const profileCount = (inspect.profiles || []).length
  const hasData = inspect.hasBrowserData

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-md p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-app-surface border border-slate-200/90 dark:border-app-border shadow-2xl overflow-hidden animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-app-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <UploadIcon size={15} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">Import Profile Package</h3>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
                v{inspect.manifest.export_version} • exported {inspect.manifest.exported_at ? new Date(inspect.manifest.exported_at).toLocaleString() : 'unknown'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-app-surface-2">
            <CloseIcon size={17} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-app-text mb-2">Package contents</p>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
              {(inspect.manifest.included_components || []).map((c) => (
                <span key={c} className="px-2 py-0.5 rounded-md bg-white dark:bg-app-surface border border-slate-200/70 dark:border-app-border capitalize">
                  {c.replace('-', ' ')}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-app-text mb-1.5">
              {profileCount} profile(s) in package
            </p>
            <div className="space-y-1.5">
              {(inspect.profiles || []).map((p) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-app-bg border border-slate-200/70 dark:border-app-border text-xs">
                  <span className="font-semibold text-slate-800 dark:text-app-text">{p.name}</span>
                  {(inspect.conflicts || []).some((c) => c.id === p.id) ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                      ID conflict
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                      New
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {hasData && (
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25">
              <AlertIcon size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed font-medium">
                This package contains browser data which may include authenticated sessions and sensitive website data.
              </p>
            </div>
          )}

          {hasConflicts ? (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700 dark:text-app-text">
                {inspect.conflicts.length} profile(s) already exist with the same ID. How should conflicts be handled?
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'generate-new', label: 'New ID', desc: 'Import as new profile' },
                  { value: 'skip', label: 'Skip', desc: 'Leave existing' },
                  { value: 'replace-config', label: 'Replace Config', desc: 'Keep browser data' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStrategy(opt.value)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      strategy === opt.value
                        ? 'bg-white dark:bg-app-surface border-brand-500 ring-2 ring-brand-500/20'
                        : 'bg-slate-50 dark:bg-app-bg border-slate-200/80 dark:border-app-border hover:border-slate-300'
                    }`}
                  >
                    <p className="text-[11px] font-bold text-slate-900 dark:text-app-text">{opt.label}</p>
                    <p className="text-[9px] text-slate-400 dark:text-app-muted-2 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">No ID conflicts — all profiles will be imported as new.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-app-border">
          <button onClick={onClose} className="btn-secondary text-xs">Cancel</button>
          <button
            onClick={async () => {
              setBusy(true)
              await onImport(strategy)
            }}
            disabled={busy}
            className="btn-primary text-xs"
          >
            {busy ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <UploadIcon size={13} />}
            Import Now
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PortabilitySection() {
  const [profiles, setProfiles] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [allSelected, setAllSelected] = useState(false)
  const [includeGroups, setIncludeGroups] = useState(true)
  const [includeTags, setIncludeTags] = useState(true)
  const [includeProxies, setIncludeProxies] = useState(true)
  const [includeAutomations, setIncludeAutomations] = useState(true)
  const [includeBrowserData, setIncludeBrowserData] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [importDecision, setImportDecision] = useState(null)

  function showNotice(type, text) {
    setNotice({ type, text })
    setTimeout(() => setNotice(null), 5000)
  }

  async function loadProfiles() {
    if (!window.electronAPI || !window.electronAPI.getProfiles) return
    try {
      const list = await window.electronAPI.getProfiles()
      setProfiles(list || [])
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadProfiles()
  }, [])

  useEffect(() => {
    setAllSelected(profiles.length > 0 && selectedIds.size === profiles.length)
  }, [selectedIds, profiles])

  function toggleProfile(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(profiles.map((p) => p.id)))
  }

  async function handleExport() {
    if (selectedIds.size === 0) {
      showNotice('warning', 'Select at least one profile to export')
      return
    }
    setBusy(true)
    try {
      const result = await window.electronAPI.exportProfiles({
        profileIds: [...selectedIds],
        includeGroups,
        includeTags,
        includeProxies,
        includeAutomations,
        includeBrowserData,
      })
      if (result.canceled) return
      showNotice('success', `Exported ${result.profiles} profile(s) (${Math.round((result.fileSize || 0) / 1024)} KB)`)
    } catch (err) {
      showNotice('error', err.message || 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    setBusy(true)
    try {
      const picked = await window.electronAPI.pickImportProfiles()
      if (picked.canceled) return
      const inspect = await window.electronAPI.inspectProfileExport(picked.path)
      if (!inspect.success) {
        showNotice('error', inspect.error || 'Invalid package')
        return
      }
      setImportDecision({ path: picked.path, inspect })
    } catch (err) {
      showNotice('error', err.message || 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirmImport(strategy) {
    const { path: archivePath } = importDecision
    try {
      const report = await window.electronAPI.importProfileExport(archivePath, strategy)
      if (!report.success) {
        showNotice('error', report.error || 'Import failed')
      } else {
        const text = `${report.imported.length} imported, ${report.replaced.length} replaced, ${report.skipped.length} skipped`
        showNotice(report.errors && report.errors.length > 0 ? 'warning' : 'success', `Import finished — ${text}`)
        loadProfiles()
      }
    } catch (err) {
      showNotice('error', err.message || 'Import failed')
    }
    setImportDecision(null)
  }

  return (
    <div className="space-y-4">
      {notice && <Notice type={notice.type}>{notice.text}</Notice>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CheckRow checked={includeGroups} onToggle={() => setIncludeGroups((v) => !v)} icon={FolderIcon} title="Include Groups" subtitle="Restore folder/group assignments" />
        <CheckRow checked={includeTags} onToggle={() => setIncludeTags((v) => !v)} icon={CopyIcon} title="Include Tags" subtitle="Restore profile tags" />
        <CheckRow checked={includeProxies} onToggle={() => setIncludeProxies((v) => !v)} icon={GlobeIcon} title="Include Proxy References" subtitle="Public proxy metadata only — passwords never exported" />
        <CheckRow checked={includeAutomations} onToggle={() => setIncludeAutomations((v) => !v)} icon={ZapIcon} title="Include Automation Configs" subtitle="Automation plugins stay disabled after import" />
      </div>

      <CheckRow
        checked={includeBrowserData}
        onToggle={() => setIncludeBrowserData((v) => !v)}
        icon={ShieldCheckIcon}
        title="Include Browser Data"
        subtitle="Archives cookies, local storage and session state"
      />
      {includeBrowserData && (
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25">
          <AlertIcon size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed font-medium">
            Browser data may contain authenticated sessions and sensitive website data. Store export packages securely and never share them publicly.
          </p>
        </div>
      )}

      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-xs font-bold text-slate-700 dark:text-app-text flex items-center gap-1.5">
            <LayersIcon size={13} className="text-brand-500" />
            Select Profiles ({selectedIds.size}/{profiles.length})
          </p>
          <button type="button" onClick={toggleAll} className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline">
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
        </div>
        {profiles.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-app-muted-2 py-2">No profiles yet. Create profiles first, then export them here.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
            {profiles.map((p) => (
              <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white dark:bg-app-surface border border-slate-200/70 dark:border-app-border cursor-pointer hover:border-slate-300 transition-all">
                <button
                  type="button"
                  onClick={() => toggleProfile(p.id)}
                  className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                    selectedIds.has(p.id)
                      ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                      : 'border-slate-300 dark:border-app-border-light bg-white dark:bg-app-surface'
                  }`}
                >
                  {selectedIds.has(p.id) && <CheckIcon size={12} className="stroke-[2.5]" />}
                </button>
                <span className="text-xs font-semibold text-slate-800 dark:text-app-text truncate">{p.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button onClick={handleExport} disabled={busy} className="btn-primary">
          <DownloadIcon size={14} />
          Export Selected Profiles
        </button>
        <button onClick={handleImport} disabled={busy} className="btn-secondary">
          <UploadIcon size={14} />
          Import Profile Package
        </button>
      </div>

      {importDecision && (
        <ImportDecisionModal
          inspect={importDecision.inspect}
          onClose={() => setImportDecision(null)}
          onImport={handleConfirmImport}
        />
      )}
    </div>
  )
}