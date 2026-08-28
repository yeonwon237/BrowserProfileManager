import { useState } from 'react'
import { CloseIcon, FolderIcon } from './icons'

function MoveGroupModal({ title, existingGroups, onClose, onConfirm }) {
  const [mode, setMode] = useState('existing')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [newGroup, setNewGroup] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    const group = mode === 'existing' ? selectedGroup : newGroup.trim()
    if (mode === 'new' && !group) {
      setError('Enter a group name')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onConfirm(group || null)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to move profile')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white dark:bg-app-surface border border-slate-200/90 dark:border-app-border shadow-2xl shadow-slate-900/20 dark:shadow-black/80 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 dark:border-app-border bg-slate-50/50 dark:bg-app-surface-2/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 dark:bg-brand-500/15 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <FolderIcon size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">{title}</h3>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
                Organize profile into categorized folders
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 dark:text-app-muted hover:text-slate-700 dark:hover:text-app-text hover:bg-slate-100 dark:hover:bg-app-surface-2 transition-all"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="p-7 space-y-4">
          <div className="flex bg-slate-100 dark:bg-app-surface-2 p-1 rounded-xl border border-slate-200/80 dark:border-app-border">
            <button
              onClick={() => setMode('existing')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'existing'
                  ? 'bg-white dark:bg-app-surface text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-500 dark:text-app-muted hover:text-slate-900 dark:hover:text-app-text'
              }`}
            >
              Existing Group
            </button>
            <button
              onClick={() => setMode('new')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'new'
                  ? 'bg-white dark:bg-app-surface text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-500 dark:text-app-muted hover:text-slate-900 dark:hover:text-app-text'
              }`}
            >
              New Group
            </button>
          </div>

          {mode === 'existing' ? (
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              <button
                onClick={() => setSelectedGroup('')}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-between ${
                  selectedGroup === ''
                    ? 'bg-brand-500/10 dark:bg-brand-500/15 border-brand-500/30 text-brand-600 dark:text-brand-400 font-bold'
                    : 'bg-white dark:bg-app-surface border-slate-200/80 dark:border-app-border text-slate-700 dark:text-app-text hover:bg-slate-50 dark:hover:bg-app-surface-2'
                }`}
              >
                <span>No Group (Uncategorized)</span>
                {selectedGroup === '' && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
              </button>
              {existingGroups.map((group) => (
                <button
                  key={group}
                  onClick={() => setSelectedGroup(group)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-between ${
                    selectedGroup === group
                      ? 'bg-brand-500/10 dark:bg-brand-500/15 border-brand-500/30 text-brand-600 dark:text-brand-400 font-bold'
                      : 'bg-white dark:bg-app-surface border-slate-200/80 dark:border-app-border text-slate-700 dark:text-app-text hover:bg-slate-50 dark:hover:bg-app-surface-2'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FolderIcon size={13} className="text-slate-400 dark:text-app-muted-2" />
                    <span>{group}</span>
                  </div>
                  {selectedGroup === group && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
                New Group Name
              </label>
              <input
                autoFocus
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                placeholder="e.g. Work, Scrapers, Ads..."
                className="input"
              />
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-medium text-rose-500 dark:text-rose-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-app-border">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving} className="btn-primary">
              {saving ? 'Moving...' : 'Confirm Move'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MoveGroupModal
