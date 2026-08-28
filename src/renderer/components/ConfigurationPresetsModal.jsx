import { useState, useEffect, useCallback } from 'react'
import {
  LayersIcon,
  PlusIcon,
  TrashIcon,
} from './icons'
import { useWorkspace } from '../context/WorkspaceContext'

export default function ConfigurationPresetsModal({ isOpen, onClose }) {
  const { currentWorkspaceId } = useWorkspace()
  const [presets, setPresets] = useState([])
  const [activeType, setActiveType] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [form, setForm] = useState({
    name: '',
    type: 'environment',
    description: '',
    configText: '{\n  "locale": "en-US",\n  "timezone": "America/New_York"\n}',
    scope: 'workspace',
  })
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const reloadPresets = useCallback(async () => {
    setLoading(true)
    try {
      if (window.electronAPI && window.electronAPI.getConfigPresets) {
        const list = await window.electronAPI.getConfigPresets({
          type: activeType !== 'all' ? activeType : undefined,
          workspace_id: currentWorkspaceId === 'all' ? null : currentWorkspaceId,
        })
        setPresets(list || [])
      }
    } catch (err) {
      console.warn('Failed loading presets:', err)
    } finally {
      setLoading(false)
    }
  }, [activeType, currentWorkspaceId])

  useEffect(() => {
    if (isOpen) reloadPresets()
  }, [isOpen, reloadPresets])

  if (!isOpen) return null

  const handleSave = async () => {
    setError(null)
    if (!form.name.trim()) {
      setError('Preset name is required')
      return
    }
    let parsedConfig = {}
    try {
      parsedConfig = JSON.parse(form.configText)
    } catch {
      setError('Invalid JSON in config payload')
      return
    }

    try {
      if (window.electronAPI && window.electronAPI.createConfigPreset) {
        await window.electronAPI.createConfigPreset({
          name: form.name.trim(),
          type: form.type,
          description: form.description.trim() || null,
          workspace_id: form.scope === 'workspace' && currentWorkspaceId !== 'all' ? currentWorkspaceId : null,
          config: parsedConfig,
        })
        setShowCreateModal(false)
        setNotice('Preset created successfully!')
        reloadPresets()
      }
    } catch (err) {
      setError(err.message || 'Failed saving preset')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this preset?')) return
    try {
      if (window.electronAPI && window.electronAPI.deleteConfigPreset) {
        await window.electronAPI.deleteConfigPreset(id)
        reloadPresets()
      }
    } catch (err) {
      setError(err.message || 'Failed deleting preset')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-app-surface rounded-2xl border border-slate-200 dark:border-app-border shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-app-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <LayersIcon size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-app-text">
                Configuration Presets
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
                Reusable configuration blocks for Environments, Browsers, Proxies & Automations
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

        {/* Filters and Add */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-app-border flex items-center justify-between gap-3 text-xs bg-slate-50/50 dark:bg-app-surface-2/20">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {['all', 'environment', 'browser', 'proxy', 'automation_input'].map((t) => (
              <button
                key={t}
                onClick={() => setActiveType(t)}
                className={`px-3 py-1.5 rounded-xl font-bold capitalize transition-all ${
                  activeType === t
                    ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                    : 'text-slate-500 hover:text-slate-900 dark:text-app-muted dark:hover:text-app-text'
                }`}
              >
                {t === 'automation_input' ? 'Automation Inputs' : t}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setForm({
                name: '',
                type: activeType === 'all' ? 'environment' : activeType,
                description: '',
                configText: '{\n  "locale": "en-US",\n  "timezone": "America/New_York"\n}',
                scope: 'workspace',
              })
              setShowCreateModal(true)
            }}
            className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1 shrink-0"
          >
            <PlusIcon size={13} />
            <span>New Preset</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {notice && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 text-xs font-semibold">
              {notice}
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-slate-200 dark:border-app-border-light border-t-purple-500 rounded-full animate-spin" />
              <span className="text-xs text-slate-400">Loading presets...</span>
            </div>
          ) : presets.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-1">
              <p className="font-semibold text-slate-600 dark:text-app-text">No presets found</p>
              <p>Create reusable configuration presets for quick assignment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {presets.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl border border-slate-200/80 dark:border-app-border bg-white dark:bg-app-surface space-y-2 group hover:border-purple-500/40 transition-all shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-app-text truncate">
                          {p.name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold uppercase">
                          {p.type}
                        </span>
                      </div>
                      {p.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                          {p.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1 rounded text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <TrashIcon size={13} />
                    </button>
                  </div>

                  <pre className="p-2.5 rounded-xl bg-slate-50 dark:bg-app-surface-2/50 font-mono text-[10px] text-slate-600 dark:text-app-muted overflow-x-auto max-h-24">
                    {JSON.stringify(p.config, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Submodal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div className="bg-white dark:bg-app-surface rounded-2xl border border-slate-200 dark:border-app-border shadow-2xl max-w-md w-full p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">
                Create Configuration Preset
              </h3>

              {error && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                  {error}
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-app-text">
                    Preset Name
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. US Residential Environment"
                    className="input w-full text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-app-text">
                      Preset Type
                    </label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="input w-full text-xs"
                    >
                      <option value="environment">Environment</option>
                      <option value="browser">Browser</option>
                      <option value="proxy">Proxy</option>
                      <option value="automation_input">Automation Input</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-app-text">
                      Scope
                    </label>
                    <select
                      value={form.scope}
                      onChange={(e) => setForm({ ...form, scope: e.target.value })}
                      className="input w-full text-xs"
                    >
                      <option value="workspace">Current Workspace</option>
                      <option value="global">Global (All Workspaces)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-app-text">
                    Config Payload (JSON)
                  </label>
                  <textarea
                    value={form.configText}
                    onChange={(e) => setForm({ ...form, configText: e.target.value })}
                    rows={5}
                    className="input w-full font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="btn btn-primary text-xs py-1.5 px-4"
                >
                  Save Preset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
