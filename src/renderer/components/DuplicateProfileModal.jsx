import { useState } from 'react'
import {
  CloseIcon,
  CopyIcon,
  SparklesIcon,
  DatabaseIcon,
  CheckIcon,
} from './icons'

function DuplicateProfileModal({ profile, onClose, onDuplicate }) {
  const [name, setName] = useState(`${profile.name} (copy)`)
  const [copySession, setCopySession] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Profile name is required')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await onDuplicate(profile.id, {
        name: name.trim(),
        copySession,
      })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to duplicate profile')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white dark:bg-app-surface border border-slate-200/90 dark:border-app-border shadow-2xl shadow-slate-900/20 dark:shadow-black/80 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 dark:border-app-border bg-slate-50/50 dark:bg-app-surface-2/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 dark:bg-brand-500/15 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <CopyIcon size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">
                Duplicate Profile
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
                Copy configuration into a new isolated browser profile
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

        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
              New Profile Name <span className="text-brand-500">*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter duplicated profile name"
              className="input"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted">
              Duplication Mode
            </label>

            {/* Option 1: Clean Session (Default) */}
            <button
              type="button"
              onClick={() => setCopySession(false)}
              className={`w-full p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                !copySession
                  ? 'bg-white dark:bg-app-surface border-brand-500 ring-2 ring-brand-500/20 shadow-md'
                  : 'bg-slate-50/70 dark:bg-app-bg border-slate-200/80 dark:border-app-border hover:border-slate-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${!copySession ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-app-surface-3 text-slate-500'}`}>
                <SparklesIcon size={16} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-900 dark:text-app-text">
                    Clean Isolated Session (Recommended)
                  </p>
                  {!copySession && (
                    <div className="w-4 h-4 rounded-full bg-brand-500 text-white flex items-center justify-center">
                      <CheckIcon size={10} className="stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 dark:text-app-muted-2 mt-0.5 leading-relaxed">
                  Copies environment parameters (timezone, locale, resolution, engine, proxy) with a fresh, empty browser data directory.
                </p>
              </div>
            </button>

            {/* Session copying is intentionally unavailable during duplication. */}
            <button
              type="button"
              disabled
              className={`w-full p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                copySession
                  ? 'bg-white dark:bg-app-surface border-brand-500 ring-2 ring-brand-500/20 shadow-md'
                  : 'bg-slate-50/70 dark:bg-app-bg border-slate-200/80 dark:border-app-border hover:border-slate-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${copySession ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-app-surface-3 text-slate-500'}`}>
                <DatabaseIcon size={16} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-900 dark:text-app-text">
                    Session data is not copied
                  </p>
                  {copySession && (
                    <div className="w-4 h-4 rounded-full bg-brand-500 text-white flex items-center justify-center">
                      <CheckIcon size={10} className="stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 dark:text-app-muted-2 mt-0.5 leading-relaxed">
                  Use the dedicated backup and restore workflow when session data must be transferred. Backups include an explicit sensitive-data warning.
                </p>
              </div>
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-app-border">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Duplicating...
                </span>
              ) : (
                'Duplicate Profile'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default DuplicateProfileModal
