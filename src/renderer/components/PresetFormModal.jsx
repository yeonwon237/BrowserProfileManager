import { useState } from 'react'
import {
  CloseIcon,
  SparklesIcon,
} from './icons'

function PresetFormModal({ mode, initial, onClose, onSubmit }) {
  const isEdit = mode === 'edit'
  const [form, setForm] = useState(() => {
    if (isEdit && initial) {
      return {
        name: initial.name || '',
        description: initial.description || '',
        platform: initial.platform || 'windows',
        browser_type: initial.browser_type || 'chromium',
        locale: initial.locale || 'en-US',
        timezone_mode: initial.timezone_mode || 'custom',
        timezone: initial.timezone || 'Asia/Ho_Chi_Minh',
        languages: Array.isArray(initial.languages) ? initial.languages.join(', ') : (initial.languages || 'en-US, en'),
        viewport_width: initial.viewport_width || 1920,
        viewport_height: initial.viewport_height || 1080,
        device_scale_factor: initial.device_scale_factor || 1,
        color_scheme: initial.color_scheme || 'no-preference',
        reduced_motion: initial.reduced_motion || 'no-preference',
      }
    }
    return {
      name: '',
      description: '',
      platform: 'windows',
      browser_type: 'chromium',
      locale: 'en-US',
      timezone_mode: 'custom',
      timezone: 'Asia/Ho_Chi_Minh',
      languages: 'en-US, en',
      viewport_width: 1920,
      viewport_height: 1080,
      device_scale_factor: 1,
      color_scheme: 'no-preference',
      reduced_motion: 'no-preference',
    }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Preset name is required')
      return
    }

    setSaving(true)
    setError('')

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        platform: form.platform,
        browser_type: form.browser_type,
        locale: form.locale.trim() || 'en-US',
        timezone_mode: form.timezone_mode,
        timezone: form.timezone.trim() || 'Asia/Ho_Chi_Minh',
        languages: form.languages ? form.languages.split(',').map((s) => s.trim()).filter(Boolean) : ['en-US', 'en'],
        viewport_width: Number(form.viewport_width) || 1920,
        viewport_height: Number(form.viewport_height) || 1080,
        device_scale_factor: Number(form.device_scale_factor) || 1,
        color_scheme: form.color_scheme,
        reduced_motion: form.reduced_motion,
      }
      await onSubmit(payload)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save preset')
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
              <SparklesIcon size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">
                {isEdit ? 'Edit Environment Preset' : 'Create Environment Preset'}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
                Reusable configuration template for browser environments
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

        <form onSubmit={handleSubmit} className="p-7 space-y-4 max-h-[78vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
              Preset Name <span className="text-brand-500">*</span>
            </label>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Desktop macOS (Marketing)"
              className="input"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
              Description
            </label>
            <input
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="e.g. High-DPI MacBook Retina preset with English locale"
              className="input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
                Target Platform
              </label>
              <select
                value={form.platform}
                onChange={(e) => setField('platform', e.target.value)}
                className="input cursor-pointer"
              >
                <option value="windows">Desktop Windows</option>
                <option value="macos">Desktop macOS</option>
                <option value="linux">Desktop Linux</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
                Preferred Browser
              </label>
              <select
                value={form.browser_type}
                onChange={(e) => setField('browser_type', e.target.value)}
                className="input cursor-pointer"
              >
                <option value="chromium">Chromium</option>
                <option value="chrome">Google Chrome</option>
                <option value="msedge">Microsoft Edge</option>
                <option value="firefox">Mozilla Firefox</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
                Locale
              </label>
              <input
                value={form.locale}
                onChange={(e) => setField('locale', e.target.value)}
                placeholder="e.g. en-US"
                className="input"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
                Timezone
              </label>
              <input
                value={form.timezone}
                onChange={(e) => setField('timezone', e.target.value)}
                placeholder="e.g. Asia/Ho_Chi_Minh"
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
                Viewport Width (px)
              </label>
              <input
                type="number"
                value={form.viewport_width}
                onChange={(e) => setField('viewport_width', e.target.value)}
                placeholder="1920"
                className="input"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
                Viewport Height (px)
              </label>
              <input
                type="number"
                value={form.viewport_height}
                onChange={(e) => setField('viewport_height', e.target.value)}
                placeholder="1080"
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
                Color Scheme
              </label>
              <select
                value={form.color_scheme}
                onChange={(e) => setField('color_scheme', e.target.value)}
                className="input cursor-pointer"
              >
                <option value="no-preference">No Preference</option>
                <option value="dark">Dark Mode</option>
                <option value="light">Light Mode</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
                Device Scale Factor
              </label>
              <select
                value={form.device_scale_factor}
                onChange={(e) => setField('device_scale_factor', e.target.value)}
                className="input cursor-pointer"
              >
                <option value="1">1.0x (Standard)</option>
                <option value="1.25">1.25x (HD)</option>
                <option value="1.5">1.5x (2K)</option>
                <option value="2">2.0x (Retina)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-app-border">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : isEdit ? (
                'Save Changes'
              ) : (
                'Create Preset'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PresetFormModal
