import { useState } from 'react'
import { CloseIcon, CheckIcon, LayersIcon } from './icons'
import DynamicForm from './DynamicForm'
import ProfileAvatar from './ProfileAvatar'

function Checkbox({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
        checked
          ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
          : 'border-slate-300 dark:border-app-border-light bg-white dark:bg-app-surface hover:border-brand-500'
      }`}
    >
      {checked && <CheckIcon size={12} className="stroke-[2.5]" />}
    </button>
  )
}

function BulkRunModal({ tool, profiles, onClose, onEnqueue }) {
  const [selected, setSelected] = useState({})
  const [inputs, setInputs] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedIds = Object.keys(selected).filter((id) => selected[id])
  const allSelected = profiles.length > 0 && profiles.every((p) => selected[p.id])

  function toggleAll() {
    const next = {}
    if (!allSelected) profiles.forEach((p) => { next[p.id] = true })
    setSelected(next)
  }

  async function handleSubmit() {
    if (selectedIds.length === 0) {
      setError('Select at least one profile to enqueue')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onEnqueue(tool.id, selectedIds, inputs)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to add to queue')
      setSaving(false)
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
              <LayersIcon size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">
                Run "{tool.name}" on Batch Profiles
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2 font-mono">
                {tool.id} • v{tool.version}
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

        <div className="p-7 space-y-5 max-h-[75vh] overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-700 dark:text-app-muted uppercase tracking-wider">
                Select Target Profiles ({selectedIds.length}/{profiles.length})
              </p>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-200/80 dark:border-app-border divide-y divide-slate-100 dark:divide-app-border">
              {profiles.map((p) => {
                const isChecked = Boolean(selected[p.id])
                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-brand-500/5 dark:bg-brand-500/10'
                        : 'bg-white dark:bg-app-bg hover:bg-slate-50 dark:hover:bg-app-surface-2'
                    }`}
                  >
                    <Checkbox checked={isChecked} onChange={() => setSelected((prev) => ({ ...prev, [p.id]: !prev[p.id] }))} />
                    <ProfileAvatar seed={p.id} name={p.name} size={26} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 dark:text-app-text truncate">{p.name}</p>
                      {p.group_name && (
                        <p className="text-[10px] text-slate-400 dark:text-app-muted-2">{p.group_name}</p>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      p.status === 'running'
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : 'bg-slate-100 dark:bg-app-surface-3 text-slate-500 border-slate-200 dark:border-app-border'
                    }`}>
                      {p.status === 'running' ? 'Running' : 'Ready'}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {tool.inputSchema.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-app-border">
              <p className="text-xs font-bold text-slate-700 dark:text-app-muted uppercase tracking-wider mb-3">
                Tool Parameters (applied across all profiles)
              </p>
              <DynamicForm schema={tool.inputSchema} values={inputs} onChange={setInputs} />
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
            <button onClick={handleSubmit} disabled={saving || selectedIds.length === 0} className="btn-primary">
              <LayersIcon size={14} />
              {saving ? 'Queueing...' : `Enqueue ${selectedIds.length} Job${selectedIds.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BulkRunModal
