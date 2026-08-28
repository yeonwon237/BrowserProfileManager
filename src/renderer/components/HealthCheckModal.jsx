import { useState, useEffect, useCallback } from 'react'
import {
  CloseIcon,
  ShieldCheckIcon,
  CheckIcon,
  PowerIcon,
} from './icons'

function HealthCheckModal({ profile, onClose, onLaunch }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const loadHealth = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (window.electronAPI && window.electronAPI.checkProfileHealth) {
        const res = await window.electronAPI.checkProfileHealth(profile.id)
        if (res.success) {
          setData(res)
        } else {
          setError(res.error || 'Health check failed')
        }
      }
    } catch (err) {
      setError(err.message || 'Health check failed')
    } finally {
      setLoading(false)
    }
  }, [profile.id])

  useEffect(() => {
    loadHealth()
  }, [loadHealth])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white dark:bg-app-surface border border-slate-200/90 dark:border-app-border shadow-2xl shadow-slate-900/20 dark:shadow-black/80 overflow-hidden animate-scale-in flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 dark:border-app-border bg-slate-50/50 dark:bg-app-surface-2/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 dark:bg-brand-500/15 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <ShieldCheckIcon size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">
                  Profile Pre-flight Health Check
                </h3>
                {data && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      data.overallStatus === 'HEALTHY'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : data.overallStatus === 'WARNING'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {data.overallStatus === 'HEALTHY' ? '✓ HEALTHY' : data.overallStatus === 'WARNING' ? '! WARNING' : '✕ ERROR'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
                Pre-launch readiness & integrity verification for {profile.name}
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

        {/* Content Body */}
        <div className="p-7 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-14 flex flex-col items-center justify-center gap-3 text-center">
              <span className="w-8 h-8 border-3 border-slate-200 dark:border-app-border border-t-brand-500 rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-600 dark:text-app-muted">
                Running readiness checks (binaries, permissions, proxy, consistency)...
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-600 dark:text-rose-400">
              <p className="font-bold mb-1">Health Check Error</p>
              <p>{error}</p>
            </div>
          ) : data ? (
            <div className="space-y-3">
              {data.checks.map((c, i) => {
                const isPass = c.status === 'PASS'
                const isWarn = c.status === 'WARN'

                return (
                  <div
                    key={i}
                    className={`p-4 rounded-2xl border transition-all ${
                      isPass
                        ? 'bg-slate-50/70 dark:bg-app-bg border-slate-200/80 dark:border-app-border'
                        : isWarn
                        ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30'
                        : 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {isPass ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                            <CheckIcon size={12} className="stroke-[3]" />
                          </div>
                        ) : isWarn ? (
                          <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold">
                            !
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold">
                            ✕
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-900 dark:text-app-text">
                            {c.title}
                          </p>
                          <span
                            className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                              isPass
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : isWarn
                                ? 'bg-amber-500/10 text-amber-600'
                                : 'bg-rose-500/10 text-rose-600'
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-app-muted mt-0.5 leading-relaxed">
                          {c.message}
                        </p>
                        {c.remedy && (
                          <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 mt-1">
                            Suggestion: {c.remedy}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-7 py-4 border-t border-slate-100 dark:border-app-border shrink-0 bg-slate-50/30 dark:bg-app-surface-2/20">
          <button
            type="button"
            onClick={loadHealth}
            disabled={loading}
            className="btn-secondary text-xs"
          >
            Re-run Check
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Close
            </button>
            {data && data.overallStatus !== 'ERROR' && onLaunch && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onLaunch(profile.id)
                }}
                className="btn-primary"
              >
                <PowerIcon size={12} />
                Launch Profile
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HealthCheckModal
