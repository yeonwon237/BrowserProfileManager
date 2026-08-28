import { useCallback, useEffect, useState } from 'react'
import { CloseIcon, DownloadIcon } from './icons'

export default function CookieManagerModal({ profile, onClose }) {
  const [format, setFormat] = useState('json')
  const [mode, setMode] = useState('merge')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (nextFormat = format) => {
    setBusy(true)
    setStatus('')
    try {
      const result = await window.electronAPI.exportCookies(profile.id, nextFormat)
      setContent(result.content)
      setStatus(`${result.count} cookie(s) loaded`)
    } catch (err) {
      setStatus(err.message || 'Could not load cookies')
    } finally { setBusy(false) }
  }, [format, profile.id])

  useEffect(() => { load('json') }, [load])

  async function apply() {
    setBusy(true)
    setStatus('')
    try {
      const preview = await window.electronAPI.parseCookies(content, format)
      if (!preview.validCount) throw new Error(preview.errors?.[0] || 'No valid cookies found')
      const result = await window.electronAPI.importCookies(profile.id, content, { format, mode, skipInvalid: true })
      setStatus(`Imported ${result.importedCount} cookie(s); ${result.errors.length} invalid row(s) skipped`)
    } catch (err) {
      setStatus(err.message || 'Cookie import failed')
    } finally { setBusy(false) }
  }

  function download() {
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${profile.name.replace(/[^a-z0-9_-]+/gi, '_')}_cookies.${format === 'json' ? 'json' : 'txt'}`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="card w-full max-w-3xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-app-text">Cookie Manager</h2>
            <p className="text-xs text-slate-400 mt-1">{profile.name} · Cookie values are sensitive.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-app-surface-3"><CloseIcon size={16} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select value={format} onChange={(e) => { setFormat(e.target.value); load(e.target.value) }} className="input text-xs">
            <option value="json">JSON</option>
            <option value="netscape">Netscape</option>
          </select>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="input text-xs">
            <option value="merge">Merge and update matching cookies</option>
            <option value="replace-domains">Replace imported domains</option>
            <option value="replace-all">Replace all cookies</option>
          </select>
        </div>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={16} spellCheck={false} className="input w-full font-mono text-[11px]" />
        {status && <p className="text-xs text-slate-500 dark:text-app-muted">{status}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={download} disabled={busy || !content} className="btn-secondary"><DownloadIcon size={14} />Export file</button>
          <button onClick={() => load()} disabled={busy} className="btn-secondary">Reload</button>
          <button onClick={apply} disabled={busy || !content.trim()} className="btn-primary">{busy ? 'Working…' : 'Validate & Apply'}</button>
        </div>
      </div>
    </div>
  )
}
