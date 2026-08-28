import { useState, useEffect } from 'react'
import { LayersIcon, AlertIcon } from './icons'

export default function TemplateFormModal({ isOpen, onClose, template, onSave, proxies = [] }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [browserType, setBrowserType] = useState('chromium')
  const [proxyId, setProxyId] = useState('')
  const [groupName, setGroupName] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [notesTemplate, setNotesTemplate] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (template) {
      setName(template.name || '')
      setDescription(template.description || '')
      setBrowserType(template.browser_type || 'chromium')
      setProxyId(template.proxy_id || '')
      setGroupName(template.group_name || '')
      setTagsInput(Array.isArray(template.tags) ? template.tags.join(', ') : '')
      setNotesTemplate(template.notes_template || '')
    } else {
      setName('')
      setDescription('')
      setBrowserType('chromium')
      setProxyId('')
      setGroupName('')
      setTagsInput('')
      setNotesTemplate('')
    }
    setError(null)
  }, [template, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Template name is required')
      return
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    setLoading(true)
    setError(null)

    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        browser_type: browserType,
        proxy_id: proxyId || null,
        group_name: groupName.trim() || null,
        tags,
        notes_template: notesTemplate || null,
      })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save template')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-app-surface rounded-2xl border border-slate-200 dark:border-app-border shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-app-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <LayersIcon size={16} />
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-app-text">
              {template ? 'Edit Profile Template' : 'New Profile Template'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-app-muted dark:hover:text-app-text"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertIcon size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-app-text">
              Template Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard Desktop Chrome, Stealth Worker, QA Base"
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
              placeholder="Description of the template configuration..."
              rows={2}
              className="input w-full text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-app-text">
                Browser Engine
              </label>
              <select
                value={browserType}
                onChange={(e) => setBrowserType(e.target.value)}
                className="input w-full text-xs"
              >
                <option value="chromium">Chromium</option>
                <option value="chrome">Google Chrome</option>
                <option value="msedge">Microsoft Edge</option>
                <option value="firefox">Firefox</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-app-text">
                Proxy Configuration
              </label>
              <select
                value={proxyId}
                onChange={(e) => setProxyId(e.target.value)}
                className="input w-full text-xs"
              >
                <option value="">No Proxy (Direct)</option>
                {proxies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.host}:{p.port})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-app-text">
                Default Group
              </label>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Accounts, Farming, Testing"
                className="input w-full text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-app-text">
                Default Tags
              </label>
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="tag1, tag2, tag3"
                className="input w-full text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-app-text">
              Notes Template
            </label>
            <textarea
              value={notesTemplate}
              onChange={(e) => setNotesTemplate(e.target.value)}
              placeholder="Default notes applied to profiles created with this template..."
              rows={2}
              className="input w-full text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-app-border">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary text-xs py-1.5 px-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary text-xs py-1.5 px-4"
            >
              {loading ? 'Saving...' : template ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
