import { useState, useEffect } from 'react'
import { AlertIcon, CloseIcon, PlayIcon, StopIcon, ExternalLinkIcon, CheckIcon } from './icons'

export default function OrphanBrowserModal() {
  const [orphans, setOrphans] = useState([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [reconnectInfo, setReconnectInfo] = useState(null)

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onRecoveryOrphansDetected) {
      const unsubscribe = window.electronAPI.onRecoveryOrphansDetected((list) => {
        setOrphans(list || [])
      })
      return unsubscribe
    }
  }, [])

  async function handleClose(sessionId) {
    setBusy(true)
    try {
      const res = await window.electronAPI.decideRecoveryOrphan(sessionId, 'close')
      if (res.success) {
        setOrphans((prev) => prev.filter((o) => o.sessionId !== sessionId))
        setNotice({ type: 'success', text: `Browser closed (${res.killed} process(es) terminated)` })
      } else {
        setNotice({ type: 'error', text: res.error || 'Failed to close browser' })
      }
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Failed to close browser' })
    } finally {
      setBusy(false)
    }
  }

  async function handleLeave(sessionId) {
    setBusy(true)
    try {
      await window.electronAPI.decideRecoveryOrphan(sessionId, 'leave')
      setOrphans((prev) => prev.filter((o) => o.sessionId !== sessionId))
      setNotice({ type: 'success', text: 'Browser left running. You can use it outside YNlogin.' })
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Failed to update decision' })
    } finally {
      setBusy(false)
    }
  }

  async function handleReconnect(_sessionId) {
    setBusy(true)
    try {
      const info = await window.electronAPI.getReconnectFeasibility()
      setReconnectInfo(info)
    } finally {
      setBusy(false)
    }
  }

  if (orphans.length === 0) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-app-surface border border-slate-200/90 dark:border-app-border shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-app-border bg-amber-500/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertIcon size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">Orphan Browser Detected</h3>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
                YNlogin closed unexpectedly but the browser process is still running
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {notice && (
            <div
              className={`px-4 py-3 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
                notice.type === 'error'
                  ? 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'
                  : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {notice.type === 'error' ? <AlertIcon size={15} /> : <CheckIcon size={15} />}
              <span>{notice.text}</span>
            </div>
          )}

          {reconnectInfo && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border text-xs leading-relaxed text-slate-600 dark:text-app-muted">
              <p className="font-bold text-slate-800 dark:text-app-text mb-1">Reconnect not feasible</p>
              {reconnectInfo.reason}
            </div>
          )}

          {orphans.map((o) => (
            <div key={o.sessionId} className="p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-app-text">{o.profileName}</p>
                  <p className="text-[11px] text-slate-400 dark:text-app-muted-2 capitalize">
                    {o.browserType} • started {o.startedAt ? new Date(o.startedAt).toLocaleTimeString() : 'unknown'}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                  Orphan
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={() => handleClose(o.sessionId)} disabled={busy} className="btn-primary text-xs">
                  <StopIcon size={13} />
                  Close Browser
                </button>
                <button onClick={() => handleLeave(o.sessionId)} disabled={busy} className="btn-secondary text-xs">
                  <PlayIcon size={13} />
                  Leave Running
                </button>
                <button onClick={() => handleReconnect(o.sessionId)} disabled={busy} className="btn-secondary text-xs">
                  <ExternalLinkIcon size={13} />
                  Reconnect
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 dark:border-app-border">
          <button onClick={() => setOrphans([])} className="btn-secondary text-xs">
            <CloseIcon size={13} />
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}