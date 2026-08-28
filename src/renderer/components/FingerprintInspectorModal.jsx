import { useState, useEffect } from 'react'
import { CloseIcon, GlobeIcon, RefreshIcon, AlertIcon, CheckIcon } from './icons'

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-100 dark:border-app-border/60 last:border-0">
      <span className="text-[11px] text-slate-400 dark:text-app-muted-2 shrink-0 pt-0.5">{label}</span>
      <span className="text-[11px] font-mono text-slate-800 dark:text-app-text text-right break-all">{value || '—'}</span>
    </div>
  )
}

export default function FingerprintInspectorModal({ profile, onClose }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function runInspect() {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await window.electronAPI.inspectProfileFingerprint(profile.id)
      if (!res || !res.success) {
        setError((res && res.error) || 'Inspect failed')
      } else {
        setResult(res)
      }
    } catch (err) {
      setError(err.message || 'Inspect failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runInspect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ip = result && result.ip
  const fp = result && result.fingerprint

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white dark:bg-app-surface border border-slate-200/90 dark:border-app-border shadow-2xl shadow-slate-900/20 dark:shadow-black/80 overflow-hidden animate-scale-in flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-app-border bg-slate-50/50 dark:bg-app-surface-2/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 dark:bg-brand-500/15 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <GlobeIcon size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">Fingerprint & IP Inspector</h3>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2 truncate max-w-[280px]">
                {profile.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runInspect}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-app-surface-3 hover:bg-brand-500/15 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200/80 dark:border-app-border text-[11px] font-semibold text-slate-600 dark:text-app-muted transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshIcon size={12} className={loading ? 'animate-spin' : ''} />
              Re-check
            </button>
            <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 dark:text-app-muted hover:text-slate-700 dark:hover:text-app-text hover:bg-slate-100 dark:hover:bg-app-surface-2 transition-all">
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-medium text-amber-600 dark:text-amber-400 flex items-start gap-2">
              <AlertIcon size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-slate-200 dark:border-app-border-light border-t-brand-500 rounded-full animate-spin" />
              <p className="text-xs text-slate-400 dark:text-app-muted-2">Inspecting the running profile...</p>
            </div>
          )}

          {result && !loading && (
            <>
              {/* Public IP */}
              <div className="rounded-2xl border border-slate-200 dark:border-app-border overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-app-surface-2/40 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-app-muted flex items-center justify-between">
                  <span>Public IP (through proxy)</span>
                  {ip && ip.ip && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckIcon size={12} /> Live
                    </span>
                  )}
                </div>
                {ip && ip.ip ? (
                  <div className="p-4 space-y-1.5">
                    <p className="text-2xl font-extrabold font-mono text-slate-900 dark:text-app-text">{ip.ip}</p>
                    <p className="text-xs text-slate-500 dark:text-app-muted">
                      {[ip.city, ip.region, ip.country].filter(Boolean).join(', ') || 'Unknown location'}
                    </p>
                    {ip.org && <p className="text-[11px] text-slate-400 dark:text-app-muted-2 truncate">{ip.org}</p>}
                  </div>
                ) : (
                  <div className="p-4">
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {ip && ip.error ? ip.error : 'Không lấy được IP — profile có thể chưa có proxy hoặc proxy không kết nối được.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Fingerprint */}
              <div className="rounded-2xl border border-slate-200 dark:border-app-border overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-app-surface-2/40 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-app-muted">
                  Browser & Environment
                </div>
                <div className="px-4 py-2">
                  <Row label="User-Agent" value={fp.userAgent} />
                  <Row label="Platform" value={fp.platform} />
                  <Row label="Language" value={fp.language} />
                  <Row label="Languages" value={fp.languages && fp.languages.join(', ')} />
                  <Row label="Timezone" value={fp.timezone} />
                  <Row label="Screen" value={`${fp.screen.width}×${fp.screen.height} (${fp.screen.colorDepth}-bit)`} />
                  <Row label="Device Pixel Ratio" value={fp.devicePixelRatio} />
                  <Row label="CPU Cores" value={fp.cores} />
                  <Row label="Device Memory" value={fp.memory != null ? `${fp.memory} GB` : '—'} />
                  <Row label="WebDriver" value={String(fp.webdriver)} />
                  <Row label="Canvas Hash" value={fp.canvasHash} />
                  <Row label="WebGL Vendor" value={fp.webglVendor} />
                  <Row label="WebGL Renderer" value={fp.webglRenderer} />
                </div>
              </div>

              <p className="text-[10px] text-slate-400 dark:text-app-muted-2 leading-relaxed">
                Hai profile khác nhau khi có IP khác nhau (proxy khác nhau) và/hoặc locale/timezone/platform/canvas khác nhau. Nếu hai profile trùng toàn bộ các giá trị trên, chúng đang dùng chung proxy và cùng môi trường.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}