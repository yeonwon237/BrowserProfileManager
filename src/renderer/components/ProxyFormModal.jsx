import { useState, useMemo } from 'react'
import { CloseIcon, GlobeIcon, CheckIcon, AlertIcon } from './icons'
import { parseProxyList, PROTOCOLS } from '../lib/proxyParser'

const PROTOCOL_LABELS = {
  http: 'HTTP',
  https: 'HTTPS',
  socks5: 'SOCKS5',
}

function ManualForm({ mode, initial, onClose, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    protocol: initial?.protocol || 'http',
    host: initial?.host || '',
    port: initial?.port || '',
    username: initial?.username || '',
    password: '',
    notes: initial?.notes || '',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Name is required')
    if (!form.host.trim()) return setError('Host is required')
    if (!form.port || isNaN(Number(form.port))) return setError('Valid port number is required')

    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        protocol: form.protocol,
        host: form.host.trim(),
        port: Number(form.port),
        username: form.username.trim() || null,
        notes: form.notes.trim() || null,
      }
      // An empty password in edit mode means "keep the existing password".
      // Sending an empty string would overwrite the encrypted credential and
      // make every subsequent proxy request fail with HTTP 407.
      if (mode !== 'edit' || form.password) payload.password = form.password
      await onCancel(payload)
    } catch (err) {
      setError(err.message || 'Failed to save proxy')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-7 space-y-4 max-h-[75vh] overflow-y-auto">
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
          Proxy Name <span className="text-brand-500">*</span>
        </label>
        <input
          autoFocus
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="e.g. US Residential Proxy #1"
          className="input"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
          Protocol
        </label>
        <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-app-surface-2 p-1 rounded-2xl border border-slate-200/80 dark:border-app-border">
          {PROTOCOLS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setField('protocol', p)}
              className={`py-2 rounded-xl text-xs font-bold transition-all ${
                form.protocol === p
                  ? 'bg-white dark:bg-app-surface text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200/80 dark:border-app-border'
                  : 'text-slate-500 dark:text-app-muted hover:text-slate-900 dark:hover:text-app-text'
              }`}
            >
              {PROTOCOL_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
            Host / IP Address <span className="text-brand-500">*</span>
          </label>
          <input
            value={form.host}
            onChange={(e) => setField('host', e.target.value)}
            placeholder="192.168.1.1 or proxy.server.com"
            className="input font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
            Port <span className="text-brand-500">*</span>
          </label>
          <input
            value={form.port}
            onChange={(e) => setField('port', e.target.value)}
            placeholder="8080"
            className="input font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
            Username <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            value={form.username}
            onChange={(e) => setField('username', e.target.value)}
            placeholder="User"
            className="input"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
            Password {mode === 'edit' && <span className="text-slate-400 font-normal">(blank = keep)</span>}
          </label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setField('password', e.target.value)}
            placeholder="••••••••"
            className="input font-mono"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
          Notes & Location
        </label>
        <input
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          placeholder="e.g. US East coast, Fast latency"
          className="input"
        />
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-medium text-rose-500 dark:text-rose-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-app-border">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Add Proxy'}
        </button>
      </div>
    </form>
  )
}

function BatchForm({ onClose, onCancel }) {
  const [text, setText] = useState('')
  const [namePrefix, setNamePrefix] = useState('')
  const [protocol, setProtocol] = useState('http')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { parsed, invalid } = useMemo(() => parseProxyList(text, protocol), [text, protocol])

  async function handleSubmit(e) {
    e.preventDefault()
    if (parsed.length === 0) {
      setError('No valid proxy entries found')
      return
    }
    setSaving(true)
    setError('')
    try {
      const items = parsed.map((p, i) => ({
        name: namePrefix.trim()
          ? `${namePrefix.trim()} ${i + 1}`
          : `${p.host}:${p.port}`,
        protocol: p.protocol,
        host: p.host,
        port: p.port,
        username: p.username,
        password: p.password,
        notes: null,
      }))
      await onCancel(items)
    } catch (err) {
      setError(err.message || 'Failed to import proxies')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-7 space-y-4 max-h-[75vh] overflow-y-auto">
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
          Default Protocol fallback
        </label>
        <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-app-surface-2 p-1 rounded-2xl border border-slate-200/80 dark:border-app-border">
          {PROTOCOLS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProtocol(p)}
              className={`py-2 rounded-xl text-xs font-bold transition-all ${
                protocol === p
                  ? 'bg-white dark:bg-app-surface text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200/80 dark:border-app-border'
                  : 'text-slate-500 dark:text-app-muted hover:text-slate-900 dark:hover:text-app-text'
              }`}
            >
              {PROTOCOL_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
          Paste Raw Proxies <span className="text-slate-400 font-normal">(one proxy per line)</span>
        </label>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          spellCheck={false}
          placeholder={
            '192.168.1.100:8080:user:pass\n10.0.0.1:3128:user\nsocks5://user:pass@127.0.0.1:1080\nproxy.host.com:9000'
          }
          className="input resize-none font-mono text-xs leading-relaxed"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
          Name Prefix <span className="text-slate-400 font-normal">(optional — default is host:port)</span>
        </label>
        <input
          value={namePrefix}
          onChange={(e) => setNamePrefix(e.target.value)}
          placeholder="e.g. Scraper IP"
          className="input"
        />
      </div>

      {/* Parser Live Preview */}
      <div className="rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border p-4">
        {parsed.length > 0 && (
          <div className="mb-2">
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
              <CheckIcon size={14} />
              <span>{parsed.length} Valid Proxies Detected</span>
            </p>
            <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
              {parsed.map((p, i) => (
                <div
                  key={i}
                  className="text-[11px] font-mono text-slate-800 dark:text-app-text px-2.5 py-1 rounded-lg bg-white dark:bg-app-surface border border-slate-200/60 dark:border-app-border truncate"
                >
                  <span className="text-brand-500 uppercase font-bold mr-1.5">{p.protocol}://</span>
                  {p.username ? `${p.username}:***@` : ''}
                  {p.host}:{p.port}
                </div>
              ))}
            </div>
          </div>
        )}

        {invalid.length > 0 && (
          <div>
            <p className="text-xs font-bold text-rose-500 mb-1.5 flex items-center gap-1.5">
              <AlertIcon size={14} />
              <span>{invalid.length} Unrecognized Lines</span>
            </p>
            <div className="max-h-20 overflow-y-auto space-y-1">
              {invalid.map((line, i) => (
                <p key={i} className="text-[11px] font-mono text-rose-500/80 truncate">
                  • {line}
                </p>
              ))}
            </div>
          </div>
        )}

        {text.trim() && parsed.length === 0 && invalid.length === 0 && (
          <p className="text-[11px] text-slate-400 dark:text-app-muted-2">Paste proxies above to see live preview.</p>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-medium text-rose-500 dark:text-rose-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-app-border">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={saving || parsed.length === 0} className="btn-primary">
          {saving ? 'Importing...' : `Add ${parsed.length} Prox${parsed.length === 1 ? 'y' : 'ies'}`}
        </button>
      </div>
    </form>
  )
}

function ProxyFormModal({ mode, initial, onClose, onSubmit }) {
  const [tab, setTab] = useState('manual')

  const handleSubmit = async (payload) => {
    // Await the parent's persistence call, then close on success so the modal
    // never gets stuck showing "Importing..." / "Saving...". Errors propagate
    // back to the inner form which displays them and resets its busy state.
    await onSubmit(payload)
    onClose()
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
              <GlobeIcon size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">
                {mode === 'edit' ? 'Edit Proxy Node' : 'Add Proxy Connection'}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
                Configure HTTP, HTTPS, or SOCKS5 network proxy
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

        {mode === 'create' && (
          <div className="flex bg-slate-100 dark:bg-app-surface-2 p-1 mx-7 mt-5 rounded-2xl border border-slate-200/80 dark:border-app-border">
            <button
              onClick={() => setTab('manual')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                tab === 'manual'
                  ? 'bg-white dark:bg-app-surface text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-500 dark:text-app-muted hover:text-slate-900 dark:hover:text-app-text'
              }`}
            >
              Single Entry
            </button>
            <button
              onClick={() => setTab('batch')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                tab === 'batch'
                  ? 'bg-white dark:bg-app-surface text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-500 dark:text-app-muted hover:text-slate-900 dark:hover:text-app-text'
              }`}
            >
              Batch Paste (Bulk List)
            </button>
          </div>
        )}

        {mode === 'edit' || tab === 'manual' ? (
          <ManualForm mode={mode} initial={initial} onClose={onClose} onCancel={handleSubmit} />
        ) : (
          <BatchForm onClose={onClose} onCancel={handleSubmit} />
        )}
      </div>
    </div>
  )
}

export default ProxyFormModal
