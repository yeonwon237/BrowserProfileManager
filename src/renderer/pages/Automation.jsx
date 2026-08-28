import { useEffect, useState, useCallback } from 'react'
import {
  ZapIcon,
  PlusIcon,
  TrashIcon,
  AlertIcon,
  PlayIcon,
  CloseIcon,
  LayersIcon,
  SparklesIcon,
  TerminalIcon,
  ActivityIcon,
  ClockIcon,
} from '../components/icons'
import DynamicForm from '../components/DynamicForm'
import BulkRunModal from '../components/BulkRunModal'
import QueuePanel from '../components/QueuePanel'
import ScheduledTab from '../components/ScheduledTab'
import AutomationHistoryTab from '../components/AutomationHistoryTab'
import RunDebugButtons from '../components/RunDebugButtons'
import ProfileAvatar from '../components/ProfileAvatar'

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-brand-600' : 'bg-slate-200 dark:bg-app-border-light'
      }`}
      title={checked ? 'Disable tool' : 'Enable tool'}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}

function ToolCard({ tool, busy, onToggle, onRemove, onRun, onBulkRun }) {
  return (
    <div className="card p-5 flex flex-col gap-3.5 hover:border-slate-300 dark:hover:border-app-border-light transition-all group">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-transform duration-200 group-hover:scale-105 ${
              tool.valid
                ? 'bg-brand-500/10 dark:bg-brand-500/15 border-brand-500/25 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'bg-rose-500/10 border-rose-500/25 text-rose-500'
            }`}
          >
            {tool.valid ? <ZapIcon size={18} /> : <AlertIcon size={18} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-app-text truncate">{tool.name}</h3>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-app-surface-3 text-[10px] font-mono font-bold text-slate-500 dark:text-app-muted">
                v{tool.version || '1.0'}
              </span>
              {tool.valid && !tool.compatible && (
                <span
                  className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/25 text-[10px] font-bold text-rose-600 dark:text-rose-400"
                  title={tool.compatibilityReason || 'Incompatible'}
                >
                  Incompatible
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 dark:text-app-muted-2 font-mono truncate max-w-[200px]">
              {tool.id}
            </p>
          </div>
        </div>
        <Toggle checked={tool.enabled} onChange={() => onToggle(tool)} />
      </div>

      <p className="text-xs text-slate-500 dark:text-app-muted leading-relaxed line-clamp-2 min-h-[32px]">
        {tool.description || 'Custom automation script for browser profiles.'}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {tool.runModes.map((m) => (
          <span
            key={m}
            className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-app-surface-3 border border-slate-200/80 dark:border-app-border text-[10px] font-semibold text-slate-600 dark:text-app-muted"
          >
            {m}
          </span>
        ))}
        {tool.inputSchema.length > 0 && (
          <span className="px-2.5 py-0.5 rounded-lg bg-brand-500/10 dark:bg-brand-500/15 border border-brand-500/20 text-[10px] font-semibold text-brand-600 dark:text-brand-400">
            {tool.inputSchema.length} Input{tool.inputSchema.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {tool.permissions && tool.permissions.length > 0 && (
        <div className="rounded-xl bg-slate-50 dark:bg-app-bg border border-slate-200/70 dark:border-app-border px-3 py-2">
          <p className="text-[10px] font-bold text-slate-400 dark:text-app-muted-2 mb-1">
            This automation requests:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tool.permissions.map((perm) => (
              <span
                key={perm}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-app-surface border border-slate-200/70 dark:border-app-border text-[10px] font-semibold text-slate-600 dark:text-app-muted"
              >
                {perm.replace('-', ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {!tool.valid && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2">
          <p className="text-[11px] text-rose-500 leading-relaxed font-medium">
            {tool.errors.join(' · ')}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100 dark:border-app-border">
        <button
          onClick={() => onRemove(tool)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
          title="Remove tool from library"
        >
          <TrashIcon size={15} />
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onBulkRun(tool)}
            disabled={!tool.valid || !tool.enabled || busy}
            className="btn-secondary"
            title="Enqueue on multiple profiles"
          >
            <LayersIcon size={13} />
            Queue
          </button>
          <button
            onClick={() => onRun(tool)}
            disabled={!tool.valid || !tool.enabled || busy}
            className="btn-primary"
          >
            <PlayIcon size={13} />
            Run
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyLibrary({ onImport }) {
  return (
    <div className="empty-state py-20">
      <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-app-surface-2 border border-slate-200 dark:border-app-border flex items-center justify-center mb-4 shadow-inner">
        <ZapIcon size={28} className="text-slate-400 dark:text-app-muted-2" />
      </div>
      <h3 className="text-base font-bold text-slate-800 dark:text-app-text mb-1">
        Automation Library is Empty
      </h3>
      <p className="text-xs text-slate-400 dark:text-app-muted-2 mb-6 max-w-sm leading-relaxed">
        Import a tool folder containing manifest.json and main.js or add sample automation plugins to get started.
      </p>
      <button onClick={onImport} className="btn-primary">
        <PlusIcon size={15} />
        Import Tool Folder
      </button>
    </div>
  )
}

function RunToolModal({ tool, profiles, onClose, onRun }) {
  const [profileId, setProfileId] = useState('')
  const [inputs, setInputs] = useState({})
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [validationErrors, setValidationErrors] = useState([])

  useEffect(() => {
    if (profiles.length > 0 && !profileId) setProfileId(profiles[0].id)
  }, [profiles, profileId])

  useEffect(() => {
    const defaults = {}
    for (const field of tool.inputSchema) {
      if (field.default !== undefined) defaults[field.key] = field.default
      else if (field.type === 'checkbox') defaults[field.key] = false
    }
    if (Object.keys(defaults).length > 0) {
      setInputs((prev) => ({ ...defaults, ...prev }))
    }
  }, [tool])

  function validate() {
    const errors = []
    for (const field of tool.inputSchema) {
      const value = inputs[field.key]
      if (field.required) {
        const empty =
          value === undefined || value === null || value === '' ||
          (field.type === 'number' && (value === '' || isNaN(Number(value)))) ||
          (field.type === 'checkbox' && value !== true)
        if (empty) errors.push(`"${field.label}" is required`)
      }
      if (field.type === 'url' && value) {
        if (!/^https?:\/\/.+/i.test(String(value).trim())) {
          errors.push(`"${field.label}" must be a valid http(s) URL`)
        }
      }
      if (field.type === 'number' && value !== undefined && value !== '') {
        const num = Number(value)
        if (isNaN(num)) errors.push(`"${field.label}" must be a number`)
        else if (field.min !== undefined && num < Number(field.min)) errors.push(`"${field.label}" must be >= ${field.min}`)
        else if (field.max !== undefined && num > Number(field.max)) errors.push(`"${field.label}" must be <= ${field.max}`)
      }
      if ((field.type === 'file' || field.type === 'folder') && field.required && !value) {
        errors.push(`"${field.label}" is required`)
      }
    }
    return errors
  }

  async function handleRun() {
    const errors = validate()
    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }
    setValidationErrors([])
    setRunning(true)
    setResult(null)
    try {
      const res = await onRun(tool.id, profileId, inputs)
      setResult(res)
    } catch (err) {
      setResult({ ok: false, message: err.message || 'Run failed' })
    } finally {
      setRunning(false)
    }
  }

  const selectedProfile = profiles.find((p) => p.id === profileId)

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
              <PlayIcon size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">
                Run Tool: {tool.name}
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

        <div className="p-7 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
              Target Profile
            </label>
            <div className="flex items-center gap-3">
              {selectedProfile && (
                <ProfileAvatar seed={selectedProfile.id} name={selectedProfile.name} size={36} />
              )}
              <select
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                className="input cursor-pointer flex-1 font-semibold"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.group_name ? `(${p.group_name})` : ''} {p.status === 'running' ? '• [Running]' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {tool.inputSchema.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-app-border">
              <p className="text-xs font-bold text-slate-700 dark:text-app-muted uppercase tracking-wider mb-3">
                Parameters
              </p>
              <DynamicForm schema={tool.inputSchema} values={inputs} onChange={setInputs} />
            </div>
          )}

          {validationErrors.length > 0 && (
            <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3.5 space-y-1">
              {validationErrors.map((err, i) => (
                <p key={i} className="text-xs font-medium text-rose-500">• {err}</p>
              ))}
            </div>
          )}

          {result && (
            <div
              className={`rounded-2xl p-4 border text-xs font-semibold ${
                result.ok
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'
              }`}
            >
              <p className="flex items-center gap-1.5">
                <span>{result.ok ? '✓ Execution successful:' : '✕ Execution failed:'}</span>
                <span className="font-normal">{result.message}</span>
              </p>
              {!result.ok && result.runId && (
                <div className="mt-3 pt-2.5 border-t border-rose-500/20">
                  <RunDebugButtons runId={result.runId} />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-app-border">
            <button onClick={onClose} className="btn-secondary">
              Close
            </button>
            <button onClick={handleRun} disabled={running} className="btn-primary">
              {running ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running Script...
                </span>
              ) : (
                <>
                  <PlayIcon size={14} />
                  Execute Automation
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RecorderModal({ profiles, onClose, onCreated }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id || '')
  const [startUrl, setStartUrl] = useState('')
  const [toolName, setToolName] = useState('Recorded Login')
  const [recording, setRecording] = useState(false)
  const [actionCount, setActionCount] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [guideExpanded, setGuideExpanded] = useState(true)

  useEffect(() => {
    if (!recording) return undefined
    const timer = setInterval(async () => {
      const state = await window.electronAPI.getAutomationRecordingStatus().catch(() => null)
      if (state) setActionCount(state.actionCount || 0)
    }, 700)
    return () => clearInterval(timer)
  }, [recording])

  async function start() {
    setError('')
    setBusy(true)
    try {
      const state = await window.electronAPI.startAutomationRecording({ profileId, startUrl })
      setRecording(true)
      setActionCount(state.actionCount || 0)
    } catch (err) {
      setError(err.message || 'Could not start recorder')
    } finally {
      setBusy(false)
    }
  }

  async function stop() {
    setError('')
    setBusy(true)
    try {
      const result = await window.electronAPI.stopAutomationRecording({ name: toolName })
      setRecording(false)
      await onCreated(result)
    } catch (err) {
      setError(err.message || 'Could not create tool')
      const state = await window.electronAPI.getAutomationRecordingStatus().catch(() => null)
      setRecording(Boolean(state?.active))
    } finally {
      setBusy(false)
    }
  }

  async function close() {
    if (recording && !window.confirm('Cancel this recording? Recorded actions will be discarded.')) return
    if (recording) await window.electronAPI.cancelAutomationRecording().catch(() => {})
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-md p-4" onClick={close}>
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-app-surface border border-slate-200 dark:border-app-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 dark:border-app-border">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">Record an Automation</h3>
            <p className="text-[11px] text-slate-400 mt-1">Your passwords are converted to secure runtime inputs, never written into generated code.</p>
          </div>
          <button onClick={close} className="p-1.5 text-slate-400"><CloseIcon size={18} /></button>
        </div>
        <div className="p-7 space-y-4">
          {!recording ? (
            <>
              <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setGuideExpanded((value) => !value)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="flex items-center gap-2 text-xs font-bold text-brand-700 dark:text-brand-400">
                    <SparklesIcon size={15} /> Hướng dẫn ghi thao tác
                  </span>
                  <span className="text-xs text-slate-400">{guideExpanded ? 'Thu gọn' : 'Xem hướng dẫn'}</span>
                </button>
                {guideExpanded && (
                  <div className="px-4 pb-4 border-t border-brand-500/15">
                    <div className="pt-3 space-y-2.5">
                      {[
                        'Chọn profile và nhập trang bắt đầu, ví dụ trang đăng nhập.',
                        'Nhấn Start Recording rồi thao tác trong trình duyệt theo đúng thứ tự.',
                        'Ví dụ: nhập Email → nhập Password → nhấn Login.',
                        'Quay lại đây và nhấn Stop & Create Tool.',
                        'Trong thư viện, nhấn Run, chọn profile và nhập dữ liệu để chạy lại.',
                      ].map((text, index) => (
                        <div key={text} className="flex gap-2.5 text-xs text-slate-600 dark:text-app-muted leading-relaxed">
                          <span className="w-5 h-5 rounded-lg bg-brand-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">{index + 1}</span>
                          <span>{text}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-[11px] text-slate-600 dark:text-app-muted leading-relaxed">
                      Không ghi CAPTCHA hoặc OTP. Chờ trang tải xong trước mỗi bước. Email và mật khẩu sẽ trở thành trường nhập khi chạy, không được ghi cứng vào code.
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5">Profile used for recording</label>
                <select className="input" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
                  {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5">Start URL</label>
                <input className="input" type="url" value={startUrl} onChange={(e) => setStartUrl(e.target.value)} placeholder="https://example.com/login" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5">Tool name</label>
                <input className="input" value={toolName} onChange={(e) => setToolName(e.target.value)} placeholder="Login to Example" />
              </div>
              <div className="rounded-2xl bg-brand-500/10 border border-brand-500/20 p-4 text-xs text-slate-600 dark:text-app-muted leading-relaxed">
                Press Start, then use the opened browser normally: enter email, enter password, and click Login. Return here and press Stop &amp; Create Tool.
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-rose-500/10 border border-rose-500/25 flex items-center justify-center mb-4">
                <span className="w-4 h-4 rounded-full bg-rose-500 animate-pulse" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-app-text">Recording in progress</h4>
              <p className="text-xs text-slate-400 mt-2">{actionCount} action{actionCount === 1 ? '' : 's'} captured</p>
              <p className="text-[11px] text-slate-400 mt-3">Complete the workflow in the browser, then return here.</p>
            </div>
          )}
          {error && <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-600">{error}</div>}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-app-border">
            <button className="btn-secondary" onClick={close}>Cancel</button>
            {!recording ? (
              <button className="btn-primary" disabled={busy || !profileId || !startUrl || !toolName.trim()} onClick={start}>
                <ActivityIcon size={14} /> Start Recording
              </button>
            ) : (
              <button className="btn-primary" disabled={busy || actionCount === 0} onClick={stop}>
                <ZapIcon size={14} /> Stop &amp; Create Tool
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Automation({ search = '' }) {
  const [tab, setTab] = useState('library')
  const [tools, setTools] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [runTarget, setRunTarget] = useState(null)
  const [bulkTarget, setBulkTarget] = useState(null)
  const [recorderOpen, setRecorderOpen] = useState(false)
  const [notice, setNotice] = useState({ type: 'success', text: '' })

  const refresh = useCallback(async () => {
    const [toolData, profileData] = await Promise.all([
      window.electronAPI.scanAutomations(),
      window.electronAPI.getProfiles(),
    ])
    setTools(toolData || [])
    setProfiles(profileData || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!notice.text) return
    const t = setTimeout(() => setNotice({ type: 'success', text: '' }), 3500)
    return () => clearTimeout(t)
  }, [notice])

  async function handleImport() {
    setBusy(true)
    try {
      const picked = await window.electronAPI.pickToolFolder()
      if (picked.canceled) return
      const result = await window.electronAPI.importTool(picked.path)
      if (result.success) {
        setNotice({ type: 'success', text: `Imported "${result.name}" v${result.version}` })
      } else {
        setNotice({ type: 'error', text: `Import failed: ${result.errors.join(' · ')}` })
      }
      await refresh()
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Import failed' })
    } finally {
      setBusy(false)
    }
  }

  async function handleToggle(tool) {
    const next = !tool.enabled
    await window.electronAPI.setToolEnabled(tool.id, next)
    setTools((prev) => prev.map((t) => (t.id === tool.id ? { ...t, enabled: next } : t)))
  }

  async function handleRemove(tool) {
    if (!window.confirm(`Remove tool "${tool.name}" from library?`)) return
    setBusy(true)
    try {
      await window.electronAPI.removeTool(tool.id)
      setNotice({ type: 'success', text: `Removed "${tool.name}"` })
      await refresh()
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Remove failed' })
    } finally {
      setBusy(false)
    }
  }

  async function handleRun(id, profileId, inputs) {
    const health = await window.electronAPI.checkProfileHealth(profileId)
    if (!health.success || health.overallStatus === 'ERROR') {
      const details = (health.checks || []).filter((c) => c.status === 'FAIL').map((c) => c.message).join('\n')
      throw new Error(details || health.error || 'Profile health check failed')
    }
    if (health.overallStatus === 'WARNING') {
      const warnings = (health.checks || []).filter((c) => c.status === 'WARN').map((c) => c.message).join('\n')
      if (!window.confirm(`Profile health check returned warnings:\n\n${warnings}\n\nContinue anyway?`)) {
        return { ok: false, message: 'Run cancelled after health-check warning' }
      }
    }
    return window.electronAPI.runTool(id, profileId, inputs)
  }

  async function handleEnqueue(toolId, profileIds, inputs) {
    const reports = await window.electronAPI.checkBatchProfiles(profileIds)
    const errors = reports.filter((r) => !r.success || r.overallStatus === 'ERROR')
    if (errors.length > 0) {
      throw new Error(`${errors.length} selected profile(s) failed health check and were not queued`)
    }
    const warnings = reports.filter((r) => r.overallStatus === 'WARNING')
    if (warnings.length > 0 && !window.confirm(`${warnings.length} profile(s) have health-check warnings. Continue queueing?`)) {
      throw new Error('Queueing cancelled after health-check warning')
    }
    const result = await window.electronAPI.queueEnqueue(toolId, profileIds, inputs)
    setNotice({ type: 'success', text: `Added ${result.queued} job(s) to the queue` })
    setTab('queue')
    return result
  }

  const filteredTools = tools.filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.name.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto space-y-6">
      {/* Header with Segmented Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-white dark:bg-app-surface p-1 rounded-2xl border border-slate-200/90 dark:border-app-border shadow-xs">
          <button
            onClick={() => setTab('library')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'library'
                ? 'bg-brand-500/10 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 shadow-xs border border-brand-500/20'
                : 'text-slate-500 dark:text-app-muted hover:text-slate-900 dark:hover:text-app-text'
            }`}
          >
            <ZapIcon size={14} />
            <span>Plugin Library</span>
            <span className="px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-app-surface-3 text-[10px] font-mono">
              {tools.length}
            </span>
          </button>

          <button
            onClick={() => setTab('queue')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'queue'
                ? 'bg-brand-500/10 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 shadow-xs border border-brand-500/20'
                : 'text-slate-500 dark:text-app-muted hover:text-slate-900 dark:hover:text-app-text'
            }`}
          >
            <LayersIcon size={14} />
            <span>Execution Queue</span>
          </button>

          <button
            onClick={() => setTab('scheduled')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'scheduled'
                ? 'bg-brand-500/10 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 shadow-xs border border-brand-500/20'
                : 'text-slate-500 dark:text-app-muted hover:text-slate-900 dark:hover:text-app-text'
            }`}
          >
            <ClockIcon size={14} />
            <span>Scheduled</span>
          </button>

          <button
            onClick={() => setTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'history'
                ? 'bg-brand-500/10 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 shadow-xs border border-brand-500/20'
                : 'text-slate-500 dark:text-app-muted hover:text-slate-900 dark:hover:text-app-text'
            }`}
          >
            <TerminalIcon size={14} />
            <span>History & Analytics</span>
          </button>
        </div>

        {tab === 'library' && (
          <div className="flex items-center gap-2">
            <button onClick={() => setRecorderOpen(true)} disabled={busy || profiles.length === 0} className="btn-secondary">
              <ActivityIcon size={15} /> Record Tool
            </button>
            <button onClick={handleImport} disabled={busy} className="btn-primary">
              <PlusIcon size={15} /> Import Tool Folder
            </button>
          </div>
        )}
      </div>

      {notice.text && (
        <div
          className={`px-4 py-3 rounded-2xl border text-xs font-semibold flex items-center justify-between animate-fade-in ${
            notice.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice({ type: 'success', text: '' })} className="p-0.5 rounded opacity-70 hover:opacity-100">
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      {tab === 'history' ? (
        <AutomationHistoryTab />
      ) : tab === 'scheduled' ? (
        <ScheduledTab tools={tools} profiles={profiles} />
      ) : tab === 'queue' ? (
        <QueuePanel />
      ) : loading ? (
        <div className="card flex flex-col items-center justify-center py-28 gap-3">
          <div className="w-7 h-7 border-2 border-slate-200 dark:border-app-border-light border-t-brand-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-400 dark:text-app-muted-2 font-medium">Scanning plugins...</p>
        </div>
      ) : tools.length === 0 ? (
        <div className="card">
          <EmptyLibrary onImport={handleImport} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              busy={busy}
              onToggle={handleToggle}
              onRemove={handleRemove}
              onRun={(t) => setRunTarget(t)}
              onBulkRun={(t) => setBulkTarget(t)}
            />
          ))}
        </div>
      )}

      {runTarget && (
        <RunToolModal
          tool={runTarget}
          profiles={profiles}
          onClose={() => setRunTarget(null)}
          onRun={handleRun}
        />
      )}

      {bulkTarget && (
        <BulkRunModal
          tool={bulkTarget}
          profiles={profiles}
          onClose={() => setBulkTarget(null)}
          onEnqueue={handleEnqueue}
        />
      )}

      {recorderOpen && (
        <RecorderModal
          profiles={profiles}
          onClose={() => setRecorderOpen(false)}
          onCreated={async (result) => {
            setNotice({ type: 'success', text: `Created "${result.name}" from ${result.actionCount} recorded action(s)` })
            setRecorderOpen(false)
            await refresh()
          }}
        />
      )}

    </div>
  )
}

export default Automation
