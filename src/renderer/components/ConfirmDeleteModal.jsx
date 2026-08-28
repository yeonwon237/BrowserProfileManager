import { useState } from 'react'
import { CloseIcon, TrashIcon, AlertIcon } from './icons'

function ConfirmDeleteModal({ profile, onClose, onConfirm }) {
  const [deleteData, setDeleteData] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      await onConfirm(profile.id, { deleteData })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to delete profile')
      setDeleting(false)
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
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <TrashIcon size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">
                Delete Profile
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
                This action is permanent and cannot be undone
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
          <div className="p-4 rounded-2xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
            <AlertIcon size={18} className="text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-app-text">
                Are you sure you want to delete "{profile.name}"?
              </p>
              <p className="text-[11px] text-slate-500 dark:text-app-muted mt-1 leading-relaxed">
                Profile configuration, proxy associations, and metadata will be permanently removed.
              </p>
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border p-4 cursor-pointer hover:border-slate-300 dark:hover:border-app-border-light transition-all">
            <input
              type="checkbox"
              checked={deleteData}
              onChange={(e) => setDeleteData(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-app-border-light accent-rose-500 cursor-pointer"
            />
            <div className="min-w-0">
              <span className="text-xs font-semibold text-slate-800 dark:text-app-text">
                Wipe browser storage from disk
              </span>
              <span className="block text-[11px] text-slate-400 dark:text-app-muted-2 mt-0.5">
                Deletes all local cookies, cache, localStorage, and IndexedDB files
              </span>
            </div>
          </label>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-medium text-rose-500 dark:text-rose-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-app-border">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleDelete} disabled={deleting} className="btn-danger">
              {deleting ? 'Deleting...' : 'Delete Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDeleteModal