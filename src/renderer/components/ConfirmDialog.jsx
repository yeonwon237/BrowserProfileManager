import { useState } from 'react'
import { CloseIcon, AlertIcon, CheckIcon } from './icons'

/**
 * Generic in-app confirmation dialog that matches the application UI design.
 * Replaces native `window.confirm` so every confirm prompt looks consistent
 * with the rest of the interface (no OS-styled dialogs).
 */
export default function ConfirmDialog({
  isOpen,
  title = 'Confirm',
  subtitle,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loadingLabel,
  onConfirm,
  onClose,
}) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const isDanger = tone === 'danger'
  const accentClass = isDanger
    ? 'bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/25 text-rose-600 dark:text-rose-400'
    : 'bg-brand-500/10 dark:bg-brand-500/15 border-brand-500/25 text-brand-600 dark:text-brand-400'

  async function handleConfirm() {
    setConfirming(true)
    setError('')
    try {
      await onConfirm?.()
      onClose?.()
    } catch (err) {
      setError(err.message || 'Action failed')
      setConfirming(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white dark:bg-app-surface border border-slate-200/90 dark:border-app-border shadow-2xl shadow-slate-900/20 dark:shadow-black/80 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 dark:border-app-border bg-slate-50/50 dark:bg-app-surface-2/30">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${accentClass}`}>
              {isDanger ? <AlertIcon size={16} /> : <CheckIcon size={16} />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">{title}</h3>
              {subtitle && (
                <p className="text-[11px] text-slate-400 dark:text-app-muted-2">{subtitle}</p>
              )}
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
          <p className="text-xs text-slate-600 dark:text-app-muted leading-relaxed">{message}</p>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-medium text-rose-500 dark:text-rose-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-app-border">
            <button onClick={onClose} className="btn-secondary">
              {cancelLabel}
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className={isDanger ? 'btn-danger' : 'btn-primary'}
            >
              {confirming ? loadingLabel || 'Working...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}