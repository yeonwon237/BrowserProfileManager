import { useState } from 'react'
import { PlusIcon, CopyIcon, TrashIcon, AlertIcon, LayersIcon } from './icons'

export default function WorkspaceModal({ isOpen, onClose, workspaces, activeWorkspaceId, onSelect, onReload }) {
  const [mode, setMode] = useState('list') // 'list' | 'create' | 'edit' | 'delete'
  const [selectedWorkspace, setSelectedWorkspace] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [targetWorkspaceId, setTargetWorkspaceId] = useState('default')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Workspace name is required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (window.electronAPI && window.electronAPI.createWorkspace) {
        const created = await window.electronAPI.createWorkspace({ name: name.trim(), description })
        await onReload()
        if (created && created.id) onSelect(created.id)
        setMode('list')
        setName('')
        setDescription('')
      }
    } catch (err) {
      setError(err.message || 'Failed to create workspace')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Workspace name is required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (window.electronAPI && window.electronAPI.updateWorkspace) {
        await window.electronAPI.updateWorkspace(selectedWorkspace.id, { name: name.trim(), description })
        await onReload()
        setMode('list')
      }
    } catch (err) {
      setError(err.message || 'Failed to update workspace')
    } finally {
      setLoading(false)
    }
  }

  const handleDuplicate = async (ws) => {
    setLoading(true)
    try {
      if (window.electronAPI && window.electronAPI.duplicateWorkspace) {
        const dup = await window.electronAPI.duplicateWorkspace(ws.id)
        await onReload()
        if (dup && dup.id) onSelect(dup.id)
      }
    } catch (err) {
      setError(err.message || 'Failed to duplicate workspace')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedWorkspace) return
    setLoading(true)
    setError(null)
    try {
      if (window.electronAPI && window.electronAPI.deleteWorkspace) {
        await window.electronAPI.deleteWorkspace(selectedWorkspace.id, {
          targetWorkspaceId,
          moveProfiles: true,
        })
        await onReload()
        if (activeWorkspaceId === selectedWorkspace.id) {
          onSelect(targetWorkspaceId)
        }
        setMode('list')
      }
    } catch (err) {
      setError(err.message || 'Failed to delete workspace')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-app-surface rounded-2xl border border-slate-200 dark:border-app-border shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-app-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <LayersIcon size={16} />
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-app-text">
              {mode === 'list' && 'Workspace Management'}
              {mode === 'create' && 'Create New Workspace'}
              {mode === 'edit' && `Edit Workspace: ${selectedWorkspace?.name}`}
              {mode === 'delete' && `Delete Workspace`}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-app-muted dark:hover:text-app-text"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertIcon size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'list' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-app-muted">
                  Workspaces isolate profiles, proxies and automation configurations.
                </p>
                <button
                  onClick={() => {
                    setName('')
                    setDescription('')
                    setError(null)
                    setMode('create')
                  }}
                  className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <PlusIcon size={13} />
                  <span>New</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-app-border/60">
                {workspaces.map((ws) => (
                  <div
                    key={ws.id}
                    className={`py-3 flex items-center justify-between gap-3 group ${
                      activeWorkspaceId === ws.id ? 'bg-brand-500/5 -mx-2 px-2 rounded-xl' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-800 dark:text-app-text truncate">
                          {ws.name}
                        </p>
                        {ws.is_default && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400">
                            DEFAULT
                          </span>
                        )}
                        {ws.is_archived && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-app-surface-2 text-slate-500">
                            ARCHIVED
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-app-muted-2 mt-0.5">
                        {ws.profile_count || 0} profiles {ws.description ? `• ${ws.description}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          onSelect(ws.id)
                          onClose()
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${
                          activeWorkspaceId === ws.id
                            ? 'bg-brand-500 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-app-surface-2 text-slate-700 dark:text-app-text hover:bg-slate-200'
                        }`}
                      >
                        {activeWorkspaceId === ws.id ? 'Active' : 'Switch'}
                      </button>

                      <button
                        onClick={() => handleDuplicate(ws)}
                        title="Duplicate workspace"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-app-muted dark:hover:text-app-text hover:bg-slate-100 dark:hover:bg-app-surface-2"
                      >
                        <CopyIcon size={13} />
                      </button>

                      {!ws.is_default && (
                        <button
                          onClick={() => {
                            setSelectedWorkspace(ws)
                            setName(ws.name)
                            setDescription(ws.description || '')
                            setMode('edit')
                          }}
                          className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-app-text px-2 py-1"
                        >
                          Edit
                        </button>
                      )}

                      {!ws.is_default && (
                        <button
                          onClick={() => {
                            setSelectedWorkspace(ws)
                            setTargetWorkspaceId('default')
                            setMode('delete')
                          }}
                          title="Delete workspace"
                          className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        >
                          <TrashIcon size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(mode === 'create' || mode === 'edit') && (
            <form onSubmit={mode === 'create' ? handleCreate : handleEdit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-app-text">
                  Workspace Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Workspace Marketing, E-commerce, Testing"
                  className="input w-full text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-app-text">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short note about this workspace purpose..."
                  rows={2}
                  className="input w-full text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="btn btn-secondary text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary text-xs py-1.5 px-4"
                >
                  {loading ? 'Saving...' : mode === 'create' ? 'Create' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {mode === 'delete' && selectedWorkspace && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertIcon size={14} className="text-amber-500 shrink-0" />
                  Non-Destructive Safe Deletion
                </p>
                <p className="leading-relaxed">
                  Deleting workspace <strong>"{selectedWorkspace.name}"</strong> will NOT delete any browser cookies or profile user data folders on disk.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-app-text">
                  Move {selectedWorkspace.profile_count || 0} profile(s) to:
                </label>
                <select
                  value={targetWorkspaceId}
                  onChange={(e) => setTargetWorkspaceId(e.target.value)}
                  className="input w-full text-xs"
                >
                  {workspaces
                    .filter((w) => w.id !== selectedWorkspace.id && !w.is_archived)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.is_default ? '(Default)' : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="btn btn-secondary text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="btn bg-rose-600 hover:bg-rose-700 text-white text-xs py-1.5 px-4 shadow-sm"
                >
                  {loading ? 'Deleting...' : 'Move Profiles & Delete Workspace'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
