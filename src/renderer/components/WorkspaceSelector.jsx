import { useState, useRef, useEffect } from 'react'
import { LayersIcon, ChevronDownIcon, SettingsIcon, CheckIcon } from './icons'
import { useWorkspace } from '../context/WorkspaceContext'
import WorkspaceModal from './WorkspaceModal'

export default function WorkspaceSelector() {
  const { workspaces, currentWorkspace, currentWorkspaceId, selectWorkspace, reloadWorkspaces } =
    useWorkspace()
  const [open, setOpen] = useState(false)
  const [showManageModal, setShowManageModal] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-app-border bg-slate-50/80 dark:bg-app-surface-2/60 hover:bg-slate-100 dark:hover:bg-app-surface-2 transition-all text-xs font-semibold text-slate-800 dark:text-app-text"
      >
        <div className="w-5 h-5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
          <LayersIcon size={12} />
        </div>
        <span className="max-w-[130px] truncate">{currentWorkspace.name}</span>
        {typeof currentWorkspace.profile_count === 'number' && (
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200/60 dark:bg-app-border text-slate-600 dark:text-app-muted">
            {currentWorkspace.profile_count}
          </span>
        )}
        <ChevronDownIcon size={13} className="text-slate-400 dark:text-app-muted-2" />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-app-surface rounded-2xl border border-slate-200 dark:border-app-border shadow-xl z-50 py-1.5 animate-fade-in divide-y divide-slate-100 dark:divide-app-border/60">
          <div className="px-3 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-app-muted-2">
              Workspaces
            </p>
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            <button
              onClick={() => {
                selectWorkspace('all')
                setOpen(false)
              }}
              className={`w-full px-3.5 py-2 flex items-center justify-between text-xs transition-colors ${
                currentWorkspaceId === 'all'
                  ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                  : 'text-slate-700 dark:text-app-text hover:bg-slate-50 dark:hover:bg-app-surface-2'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>All Workspaces</span>
              </div>
              {currentWorkspaceId === 'all' && <CheckIcon size={13} />}
            </button>

            {workspaces
              .filter((w) => !w.is_archived)
              .map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    selectWorkspace(ws.id)
                    setOpen(false)
                  }}
                  className={`w-full px-3.5 py-2 flex items-center justify-between text-xs transition-colors ${
                    currentWorkspaceId === ws.id
                      ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                      : 'text-slate-700 dark:text-app-text hover:bg-slate-50 dark:hover:bg-app-surface-2'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        ws.is_default ? 'bg-brand-500' : 'bg-indigo-400'
                      }`}
                    />
                    <span className="truncate">{ws.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {typeof ws.profile_count === 'number' && (
                      <span className="text-[10px] font-mono text-slate-400">
                        {ws.profile_count}
                      </span>
                    )}
                    {currentWorkspaceId === ws.id && <CheckIcon size={13} />}
                  </div>
                </button>
              ))}
          </div>

          <div className="p-1">
            <button
              onClick={() => {
                setOpen(false)
                setShowManageModal(true)
              }}
              className="w-full px-3 py-1.5 rounded-xl text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-500/10 flex items-center gap-2 transition-colors"
            >
              <SettingsIcon size={13} />
              <span>Manage Workspaces</span>
            </button>
          </div>
        </div>
      )}

      {showManageModal && (
        <WorkspaceModal
          isOpen={showManageModal}
          onClose={() => setShowManageModal(false)}
          workspaces={workspaces}
          activeWorkspaceId={currentWorkspaceId}
          onSelect={selectWorkspace}
          onReload={reloadWorkspaces}
        />
      )}
    </div>
  )
}
