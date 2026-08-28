import { useState, useEffect } from 'react'
import {
  CloseIcon,
  GlobeIcon,
  FolderIcon,
  LayersIcon,
  ChromiumIcon,
  ChromeIcon,
  EdgeIcon,
  FirefoxIcon,
  CheckIcon,
  SparklesIcon,
  MonitorIcon,
} from './icons'

const BROWSER_OPTIONS = [
  {
    type: 'chromium',
    channel: null,
    name: 'Chromium',
    subtitle: 'Playwright Bundled',
    icon: ChromiumIcon,
    colorClass: 'text-indigo-500',
    borderClass: 'border-indigo-500/20',
  },
  {
    type: 'chrome',
    channel: 'chrome',
    name: 'Chrome',
    subtitle: 'Google Chrome',
    icon: ChromeIcon,
    colorClass: 'text-emerald-500',
    borderClass: 'border-emerald-500/20',
  },
  {
    type: 'msedge',
    channel: 'msedge',
    name: 'Edge',
    subtitle: 'Microsoft Edge',
    icon: EdgeIcon,
    colorClass: 'text-sky-500',
    borderClass: 'border-sky-500/20',
  },
  {
    type: 'firefox',
    channel: null,
    name: 'Firefox',
    subtitle: 'Gecko Engine',
    icon: FirefoxIcon,
    colorClass: 'text-amber-500',
    borderClass: 'border-amber-500/20',
  },
]

const COMMON_LOCALES = ['en-US', 'vi-VN', 'ja-JP', 'de-DE', 'fr-FR', 'zh-CN']
const COMMON_TIMEZONES = ['Asia/Ho_Chi_Minh', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo', 'UTC']
const RESOLUTION_PRESETS = [
  { label: '1080p', width: 1920, height: 1080 },
  { label: 'MacBook', width: 1440, height: 900 },
  { label: 'Laptop', width: 1366, height: 768 },
  { label: 'HD', width: 1280, height: 720 },
]

const DEFAULT_ENV = {
  mode: 'default',
  locale: 'en-US',
  timezone: 'Asia/Ho_Chi_Minh',
  languages: 'en-US, en',
  viewportWidth: 1920,
  viewportHeight: 1080,
  deviceScaleFactor: 1,
  colorScheme: 'no-preference',
  reducedMotion: 'no-preference',
  geoLatitude: '',
  geoLongitude: '',
  permissions: ['notifications'],
}

function parseInitialEnv(raw) {
  if (!raw || typeof raw !== 'object') return DEFAULT_ENV
  return {
    mode: raw.mode || 'default',
    locale: raw.locale || 'en-US',
    timezone: raw.timezone || 'Asia/Ho_Chi_Minh',
    languages: Array.isArray(raw.languages) ? raw.languages.join(', ') : (raw.languages || 'en-US, en'),
    viewportWidth: raw.viewport && raw.viewport.width ? raw.viewport.width : 1920,
    viewportHeight: raw.viewport && raw.viewport.height ? raw.viewport.height : 1080,
    deviceScaleFactor: raw.deviceScaleFactor || 1,
    colorScheme: raw.colorScheme || 'no-preference',
    reducedMotion: raw.reducedMotion || 'no-preference',
    geoLatitude: raw.geolocation && raw.geolocation.latitude !== undefined ? raw.geolocation.latitude : '',
    geoLongitude: raw.geolocation && raw.geolocation.longitude !== undefined ? raw.geolocation.longitude : '',
    permissions: Array.isArray(raw.permissions) ? raw.permissions : ['notifications'],
  }
}

function ProfileFormModal({ mode, initial, proxies = [], onClose, onSubmit }) {
  const [activeTab, setActiveTab] = useState('general')
  const [presets, setPresets] = useState([])
  const [form, setForm] = useState(() => {
    if (mode === 'edit' && initial) {
      return {
        name: initial.name || '',
        group: initial.group_name || '',
        tags: (initial.tags || []).join(', '),
        notes: initial.notes || '',
        proxy_id: initial.proxy_id || '',
        browser_type: initial.browser_type || 'chromium',
        browser_channel: initial.browser_channel || null,
        env: parseInitialEnv(initial.environment),
      }
    }
    return {
      name: '',
      group: '',
      tags: '',
      notes: '',
      proxy_id: '',
      browser_type: 'chromium',
      browser_channel: null,
      env: DEFAULT_ENV,
    }
  })
  const [installedEngines, setInstalledEngines] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.getInstalledEngines) {
      window.electronAPI.getInstalledEngines().then((res) => {
        setInstalledEngines(res || [])
      }).catch(() => {})
    }
    if (window.electronAPI && window.electronAPI.getPresets) {
      window.electronAPI.getPresets().then((list) => {
        setPresets(list || [])
      }).catch(() => {})
    }
  }, [])

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function setEnvField(key, value) {
    setForm((prev) => ({
      ...prev,
      env: { ...prev.env, [key]: value },
    }))
  }

  function handleSelectEngine(opt) {
    setForm((prev) => ({
      ...prev,
      browser_type: opt.type,
      browser_channel: opt.channel,
    }))
  }

  function handleApplyPreset(preset) {
    if (!preset) return
    setForm((prev) => ({
      ...prev,
      browser_type: preset.browser_type || prev.browser_type,
      browser_channel: preset.browser_type === 'chrome' ? 'chrome' : preset.browser_type === 'msedge' ? 'msedge' : null,
      env: {
        ...prev.env,
        mode: 'custom',
        locale: preset.locale || 'en-US',
        timezone: preset.timezone || 'Asia/Ho_Chi_Minh',
        languages: Array.isArray(preset.languages) ? preset.languages.join(', ') : (preset.languages || 'en-US, en'),
        viewportWidth: preset.viewport_width || 1920,
        viewportHeight: preset.viewport_height || 1080,
        deviceScaleFactor: preset.device_scale_factor || 1,
        colorScheme: preset.color_scheme || 'no-preference',
        reducedMotion: preset.reduced_motion || 'no-preference',
      },
    }))
  }

  function handleResetToDefaults() {
    setForm((prev) => ({
      ...prev,
      env: { ...DEFAULT_ENV, mode: 'default' },
    }))
  }

  const [consistency, setConsistency] = useState(null)

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.checkConsistency) {
      const envPayload = {
        mode: form.env.mode,
        locale: form.env.locale,
        timezone: form.env.timezone,
        languages: form.env.languages ? form.env.languages.split(',').map((s) => s.trim()).filter(Boolean) : [],
      }
      window.electronAPI.checkConsistency({ environment: envPayload }, form.proxy_id).then((res) => {
        setConsistency(res)
      }).catch(() => {})
    }
  }, [form.proxy_id, form.env.mode, form.env.locale, form.env.timezone, form.env.languages])

  async function handleAutoMatchProxyGeo() {
    if (!form.proxy_id || !window.electronAPI || !window.electronAPI.applyProxyGeo) return
    try {
      const updatedEnv = await window.electronAPI.applyProxyGeo(form.env, form.proxy_id)
      if (updatedEnv) {
        setForm((prev) => ({
          ...prev,
          env: {
            ...prev.env,
            mode: 'custom',
            locale: updatedEnv.locale || prev.env.locale,
            timezone: updatedEnv.timezone || prev.env.timezone,
            languages: Array.isArray(updatedEnv.languages) ? updatedEnv.languages.join(', ') : (updatedEnv.languages || prev.env.languages),
          },
        }))
      }
    } catch {
      // ignore
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Profile name is required')
      setActiveTab('general')
      return
    }

    setSaving(true)
    setError('')

    try {
      // Assemble environment payload
      let environmentPayload = { mode: form.env.mode }
      if (form.env.mode === 'custom') {
        environmentPayload = {
          mode: 'custom',
          locale: form.env.locale.trim() || undefined,
          timezone: form.env.timezone.trim() || undefined,
          languages: form.env.languages
            ? form.env.languages.split(',').map((s) => s.trim()).filter(Boolean)
            : undefined,
          viewport: {
            width: Number(form.env.viewportWidth) || 1920,
            height: Number(form.env.viewportHeight) || 1080,
          },
          deviceScaleFactor: Number(form.env.deviceScaleFactor) || 1,
          colorScheme: form.env.colorScheme,
          reducedMotion: form.env.reducedMotion,
        }
        if (form.env.geoLatitude !== '' && form.env.geoLongitude !== '') {
          environmentPayload.geolocation = {
            latitude: Number(form.env.geoLatitude),
            longitude: Number(form.env.geoLongitude),
            accuracy: 10,
          }
        }
        if (form.env.permissions && form.env.permissions.length > 0) {
          environmentPayload.permissions = form.env.permissions
        }
      }

      // Validate environment via IPC if available
      if (window.electronAPI && window.electronAPI.validateEnvironment) {
        const valRes = await window.electronAPI.validateEnvironment(environmentPayload)
        if (!valRes.valid) {
          setError(valRes.errors.join(' | '))
          setSaving(false)
          setActiveTab('environment')
          return
        }
        environmentPayload = valRes.sanitized
      }

      const payload = {
        name: form.name.trim(),
        group: form.group.trim() || null,
        tags: form.tags
          ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        notes: form.notes.trim() || null,
        proxy_id: form.proxy_id || null,
        browser_type: form.browser_type || 'chromium',
        browser_channel: form.browser_channel || null,
        environment: environmentPayload,
      }
      await onSubmit(payload)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save profile')
      setSaving(false)
    }
  }

  const isEdit = mode === 'edit'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl bg-white dark:bg-app-surface border border-slate-200/90 dark:border-app-border shadow-2xl shadow-slate-900/20 dark:shadow-black/80 overflow-hidden animate-scale-in flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 dark:border-app-border bg-slate-50/50 dark:bg-app-surface-2/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 dark:bg-brand-500/15 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <LayersIcon size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">
                {isEdit ? 'Edit Browser Profile' : 'Create New Profile'}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
                {isEdit ? 'Update settings, browser engine & environment profile' : 'Set up isolated browser cookies, engine & environment'}
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

        {/* Tab Segmented Control */}
        <div className="px-7 pt-4 border-b border-slate-100 dark:border-app-border bg-white dark:bg-app-surface flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all -mb-px flex items-center gap-2 ${
              activeTab === 'general'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-400 dark:text-app-muted hover:text-slate-700 dark:hover:text-app-text'
            }`}
          >
            <LayersIcon size={13} />
            General & Engine
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('environment')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all -mb-px flex items-center gap-2 ${
              activeTab === 'environment'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-400 dark:text-app-muted hover:text-slate-700 dark:hover:text-app-text'
            }`}
          >
            <SparklesIcon size={13} />
            Environment Profile
            {form.env.mode === 'custom' && (
              <span className="w-2 h-2 rounded-full bg-brand-500" />
            )}
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-7 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          {activeTab === 'general' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
                  Profile Name <span className="text-brand-500">*</span>
                </label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="e.g. Profile 001 — Marketing"
                  className="input"
                />
              </div>

              {/* Browser Engine Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
                  Browser Engine
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BROWSER_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    const isSelected = form.browser_type === opt.type
                    const detected = installedEngines.find((e) => e.id === opt.type || (opt.type === 'msedge' && e.id === 'msedge'))
                    const isAvailable = detected ? detected.available : true

                    return (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => handleSelectEngine(opt)}
                        className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all duration-200 active:scale-98 relative group ${
                          isSelected
                            ? 'bg-white dark:bg-app-surface border-brand-500 ring-2 ring-brand-500/20 shadow-md'
                            : 'bg-slate-50/70 dark:bg-app-bg border-slate-200/80 dark:border-app-border hover:border-slate-300 dark:hover:border-app-border-light'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${opt.colorClass} bg-slate-100 dark:bg-app-surface-3`}>
                            <Icon size={16} />
                          </div>
                          {isSelected && (
                            <div className="w-3.5 h-3.5 rounded-full bg-brand-500 text-white flex items-center justify-center">
                              <CheckIcon size={9} className="stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-app-text">{opt.name}</p>
                          <p className="text-[10px] text-slate-400 dark:text-app-muted-2 truncate">{opt.subtitle}</p>
                          {detected && !isAvailable && (
                            <span className="text-[9px] font-bold text-amber-500 block mt-0.5">Not detected</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5 flex items-center gap-1.5">
                    <FolderIcon size={13} className="text-slate-400 dark:text-app-muted-2" />
                    Group Folder
                  </label>
                  <input
                    value={form.group}
                    onChange={(e) => setField('group', e.target.value)}
                    placeholder="e.g. Social Accounts"
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5 flex items-center gap-1.5">
                    <GlobeIcon size={13} className="text-slate-400 dark:text-app-muted-2" />
                    Proxy Connection
                  </label>
                  <select
                    value={form.proxy_id}
                    onChange={(e) => setField('proxy_id', e.target.value)}
                    className="input cursor-pointer"
                  >
                    <option value="">Direct (no proxy)</option>
                    {proxies.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.protocol.toUpperCase()} • {p.host}:{p.port})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
                  Tags <span className="text-slate-400 dark:text-app-muted-2 font-normal">(comma separated)</span>
                </label>
                <input
                  value={form.tags}
                  onChange={(e) => setField('tags', e.target.value)}
                  placeholder="e.g. facebook, ads, active, 2026"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
                  Notes & Credentials Memo
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  placeholder="Add optional notes, target accounts or instructions..."
                  rows={3}
                  className="input resize-none"
                />
              </div>
            </>
          ) : (
            /* Environment Tab */
            <div className="space-y-4">
              {/* Preset Templates Selector Card */}
              {presets.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-app-text flex items-center gap-1.5">
                      <SparklesIcon size={13} className="text-brand-500" />
                      Apply Environment Preset Template
                    </span>
                    <button
                      type="button"
                      onClick={handleResetToDefaults}
                      className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      Reset to System Defaults
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {presets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className="p-2.5 rounded-xl border border-slate-200/90 dark:border-app-border bg-white dark:bg-app-surface text-left hover:border-brand-500 hover:ring-1 hover:ring-brand-500/20 transition-all active:scale-98 group"
                      >
                        <p className="text-[11px] font-bold text-slate-800 dark:text-app-text truncate group-hover:text-brand-600 dark:group-hover:text-brand-400">
                          {preset.name}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-app-muted-2 truncate mt-0.5">
                          {preset.locale} • {preset.viewport_width}x{preset.viewport_height}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Network & Environment Consistency Banner */}
              {consistency && consistency.hasProxy && (
                <div
                  className={`p-3.5 rounded-2xl border transition-all ${
                    consistency.consistent
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">
                        {consistency.consistent ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                            <CheckIcon size={12} className="stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-[10px]">
                            !
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold">
                          {consistency.consistent
                            ? 'Network & Environment Consistent'
                            : 'Proxy vs Environment Geographic Notice'}
                        </p>
                        <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
                          {consistency.consistent
                            ? consistency.message
                            : consistency.warnings.map((w) => w.message).join(' ')}
                        </p>
                      </div>
                    </div>

                    {!consistency.consistent && consistency.suggestions && (
                      <button
                        type="button"
                        onClick={handleAutoMatchProxyGeo}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-500 text-white text-[10px] font-bold shadow-sm hover:bg-amber-600 active:scale-95 transition-all shrink-0"
                      >
                        Auto-match with Proxy Geo
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Mode Toggle */}
              <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-app-bg rounded-2xl border border-slate-200/80 dark:border-app-border">
                <button
                  type="button"
                  onClick={() => setEnvField('mode', 'default')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    form.env.mode === 'default'
                      ? 'bg-white dark:bg-app-surface text-slate-900 dark:text-app-text shadow-sm'
                      : 'text-slate-500 dark:text-app-muted hover:text-slate-900 dark:hover:text-app-text'
                  }`}
                >
                  Default / System Environment
                </button>
                <button
                  type="button"
                  onClick={() => setEnvField('mode', 'custom')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    form.env.mode === 'custom'
                      ? 'bg-white dark:bg-app-surface text-brand-600 dark:text-brand-400 shadow-sm'
                      : 'text-slate-500 dark:text-app-muted hover:text-slate-900 dark:hover:text-app-text'
                  }`}
                >
                  Custom Environment
                </button>
              </div>

              {form.env.mode === 'default' ? (
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border space-y-3">
                  <div className="flex items-center gap-2.5">
                    <MonitorIcon size={16} className="text-brand-500" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-app-text">
                      System Defaults Active
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-app-muted-2 leading-relaxed">
                    This profile inherits your operating system’s native environment settings:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-app-surface border border-slate-200/60 dark:border-app-border">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Locale & Timezone</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">OS Native</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-app-surface border border-slate-200/60 dark:border-app-border">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Screen Viewport</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">Start Maximized</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Custom Environment Form */
                <div className="space-y-4 animate-fade-in">
                  {/* Locale and Timezone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
                        Locale (BCP 47)
                      </label>
                      <input
                        value={form.env.locale}
                        onChange={(e) => setEnvField('locale', e.target.value)}
                        placeholder="e.g. en-US, vi-VN, ja-JP"
                        className="input"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {COMMON_LOCALES.map((loc) => (
                          <button
                            key={loc}
                            type="button"
                            onClick={() => setEnvField('locale', loc)}
                            className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-app-surface-3 rounded text-slate-600 dark:text-app-muted hover:text-brand-500"
                          >
                            {loc}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
                        Timezone (IANA)
                      </label>
                      <input
                        value={form.env.timezone}
                        onChange={(e) => setEnvField('timezone', e.target.value)}
                        placeholder="e.g. Asia/Ho_Chi_Minh"
                        className="input"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {COMMON_TIMEZONES.slice(0, 4).map((tz) => (
                          <button
                            key={tz}
                            type="button"
                            onClick={() => setEnvField('timezone', tz)}
                            className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-app-surface-3 rounded text-slate-600 dark:text-app-muted hover:text-brand-500 truncate max-w-[110px]"
                            title={tz}
                          >
                            {tz.split('/').pop()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Preferred Languages */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
                      Preferred Languages Header
                    </label>
                    <input
                      value={form.env.languages}
                      onChange={(e) => setEnvField('languages', e.target.value)}
                      placeholder="e.g. en-US, en, vi"
                      className="input"
                    />
                  </div>

                  {/* Viewport Width and Height */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-app-muted">
                        Viewport Resolution
                      </label>
                      <div className="flex items-center gap-1">
                        {RESOLUTION_PRESETS.map((res) => (
                          <button
                            key={res.label}
                            type="button"
                            onClick={() => {
                              setEnvField('viewportWidth', res.width)
                              setEnvField('viewportHeight', res.height)
                            }}
                            className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-app-surface-3 rounded text-slate-600 dark:text-app-muted hover:text-brand-500"
                          >
                            {res.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <input
                          type="number"
                          value={form.env.viewportWidth}
                          onChange={(e) => setEnvField('viewportWidth', e.target.value)}
                          placeholder="Width (px)"
                          className="input"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          value={form.env.viewportHeight}
                          onChange={(e) => setEnvField('viewportHeight', e.target.value)}
                          placeholder="Height (px)"
                          className="input"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Color Scheme & Device Scale */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
                        Color Scheme
                      </label>
                      <select
                        value={form.env.colorScheme}
                        onChange={(e) => setEnvField('colorScheme', e.target.value)}
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
                        value={form.env.deviceScaleFactor}
                        onChange={(e) => setEnvField('deviceScaleFactor', e.target.value)}
                        className="input cursor-pointer"
                      >
                        <option value="1">1.0x (Standard)</option>
                        <option value="1.25">1.25x (HD)</option>
                        <option value="1.5">1.5x (2K)</option>
                        <option value="2">2.0x (Retina / 4K)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-app-border shrink-0">
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
                'Create Profile'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProfileFormModal
