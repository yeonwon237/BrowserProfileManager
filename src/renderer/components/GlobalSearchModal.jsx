import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SearchIcon,
  UsersIcon,
  ZapIcon,
  GlobeIcon,
  TerminalIcon,
  FolderIcon,
  CloseIcon,
} from './icons'
import { useWorkspace } from '../context/WorkspaceContext'

export default function GlobalSearchModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { currentWorkspaceId, selectWorkspace } = useWorkspace()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({
    profiles: [],
    automations: [],
    proxies: [],
    runs: [],
    workspaces: [],
    total: 0,
  })
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults({ profiles: [], automations: [], proxies: [], runs: [], workspaces: [], total: 0 })
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const doSearch = useCallback(
    async (q) => {
      if (!q.trim()) {
        setResults({ profiles: [], automations: [], proxies: [], runs: [], workspaces: [], total: 0 })
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        if (window.electronAPI && window.electronAPI.searchGlobal) {
          const res = await window.electronAPI.searchGlobal(q, {
            workspace_id: currentWorkspaceId === 'all' ? null : currentWorkspaceId,
            limit: 8,
          })
          if (res) setResults(res)
        }
      } catch (err) {
        console.warn('Global search failed:', err)
      } finally {
        setLoading(false)
      }
    },
    [currentWorkspaceId]
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      doSearch(query)
    }, 150)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  if (!isOpen) return null

  const handleAction = (item) => {
    onClose()
    if (item.category === 'profiles') {
      navigate('/profiles')
    } else if (item.category === 'automations') {
      navigate('/automation')
    } else if (item.category === 'proxies') {
      navigate('/proxies')
    } else if (item.category === 'runs') {
      navigate('/automation')
    } else if (item.category === 'workspaces') {
      selectWorkspace(item.id)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-app-surface rounded-2xl border border-slate-200 dark:border-app-border shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[80vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="p-4 border-b border-slate-200 dark:border-app-border flex items-center gap-3">
          <SearchIcon size={18} className="text-brand-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search profiles, automations, proxies, runs, workspaces... (Esc to exit)"
            className="w-full bg-transparent text-sm font-medium text-slate-800 dark:text-app-text focus:outline-none placeholder:text-slate-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-app-text"
            >
              <CloseIcon size={14} />
            </button>
          )}
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-app-surface-3 text-slate-400 shrink-0">
            ESC
          </span>
        </div>

        {/* Results Container */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-slate-200 dark:border-app-border-light border-t-brand-500 rounded-full animate-spin" />
              <span className="text-xs text-slate-400">Searching everything...</span>
            </div>
          ) : !query.trim() ? (
            <div className="py-12 text-center text-slate-400 dark:text-app-muted text-xs space-y-1">
              <p className="font-semibold text-slate-600 dark:text-app-text">Quick Search & Navigation</p>
              <p>Type to search across Profiles, Automations, Proxies, Runs & Workspaces.</p>
            </div>
          ) : results.total === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-app-muted text-xs">
              No matching records found for "{query}".
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Profiles */}
              {results.profiles.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                    Profiles ({results.profiles.length})
                  </span>
                  <div className="space-y-1">
                    {results.profiles.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleAction(p)}
                        className="p-2.5 rounded-xl flex items-center justify-between hover:bg-slate-100 dark:hover:bg-app-surface-2 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UsersIcon size={14} className="text-brand-500 shrink-0" />
                          <span className="font-bold text-slate-800 dark:text-app-text truncate">
                            {p.name}
                          </span>
                          {p.group && (
                            <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px]">
                              {p.group}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-slate-400 uppercase">
                            {p.browserType}
                          </span>
                        </div>
                        <span className="text-[11px] text-brand-600 dark:text-brand-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                          Open Profile →
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Automations */}
              {results.automations.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                    Automations ({results.automations.length})
                  </span>
                  <div className="space-y-1">
                    {results.automations.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => handleAction(a)}
                        className="p-2.5 rounded-xl flex items-center justify-between hover:bg-slate-100 dark:hover:bg-app-surface-2 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ZapIcon size={14} className="text-amber-500 shrink-0" />
                          <span className="font-bold text-slate-800 dark:text-app-text truncate">
                            {a.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            v{a.version || '1.0'}
                          </span>
                        </div>
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                          View Tool →
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Proxies */}
              {results.proxies.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                    Proxies ({results.proxies.length})
                  </span>
                  <div className="space-y-1">
                    {results.proxies.map((pr) => (
                      <div
                        key={pr.id}
                        onClick={() => handleAction(pr)}
                        className="p-2.5 rounded-xl flex items-center justify-between hover:bg-slate-100 dark:hover:bg-app-surface-2 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <GlobeIcon size={14} className="text-sky-500 shrink-0" />
                          <span className="font-bold text-slate-800 dark:text-app-text truncate">
                            {pr.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {pr.host}:{pr.port}
                          </span>
                        </div>
                        <span className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                          Manage Proxy →
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Runs */}
              {results.runs.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                    Automation Runs ({results.runs.length})
                  </span>
                  <div className="space-y-1">
                    {results.runs.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => handleAction(r)}
                        className="p-2.5 rounded-xl flex items-center justify-between hover:bg-slate-100 dark:hover:bg-app-surface-2 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <TerminalIcon size={14} className="text-purple-500 shrink-0" />
                          <span className="font-bold text-slate-800 dark:text-app-text truncate">
                            {r.toolName || r.id}
                          </span>
                          <span className="text-slate-400">({r.profileName})</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              r.status === 'success'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : 'bg-rose-500/10 text-rose-600'
                            }`}
                          >
                            {r.status?.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                          View Log →
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Workspaces */}
              {results.workspaces.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                    Workspaces ({results.workspaces.length})
                  </span>
                  <div className="space-y-1">
                    {results.workspaces.map((w) => (
                      <div
                        key={w.id}
                        onClick={() => handleAction(w)}
                        className="p-2.5 rounded-xl flex items-center justify-between hover:bg-slate-100 dark:hover:bg-app-surface-2 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FolderIcon size={14} className="text-teal-500 shrink-0" />
                          <span className="font-bold text-slate-800 dark:text-app-text truncate">
                            {w.name}
                          </span>
                          {w.isDefault && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                              Default
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                          Switch Workspace →
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
