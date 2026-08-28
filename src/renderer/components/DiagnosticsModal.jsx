import { useState, useEffect, useCallback } from 'react'
import {
  CloseIcon,
  ActivityIcon,
  CheckIcon,
  ShieldCheckIcon,
  MonitorIcon,
  GlobeIcon,
  CopyIcon,
  DownloadIcon,
} from './icons'

function DiagnosticsModal({ profile, onClose }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function copyReport() {
    if (!data) return
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setNotice('Report copied')
  }

  async function exportReport() {
    if (!data) return
    const result = await window.electronAPI.exportDiagnosticsReport(data)
    if (!result.canceled) setNotice('Report exported')
  }

  const loadDiagnostics = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (window.electronAPI && window.electronAPI.runProfileDiagnostics) {
        const res = await window.electronAPI.runProfileDiagnostics(profile.id)
        if (res.success) {
          setData(res)
        } else {
          setError(res.error || 'Diagnostics failed')
        }
      }
    } catch (err) {
      setError(err.message || 'Diagnostics failed')
    } finally {
      setLoading(false)
    }
  }, [profile.id])

  useEffect(() => {
    loadDiagnostics()
  }, [loadDiagnostics])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl bg-white dark:bg-app-surface border border-slate-200/90 dark:border-app-border shadow-2xl shadow-slate-900/20 dark:shadow-black/80 overflow-hidden animate-scale-in flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 dark:border-app-border bg-slate-50/50 dark:bg-app-surface-2/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 dark:bg-brand-500/15 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <ActivityIcon size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">
                  Environment Diagnostics — {profile.name}
                </h3>
                {data && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      data.overallStatus === 'HEALTHY'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {data.overallStatus === 'HEALTHY' ? '✓ HEALTHY' : '! NOTICE'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
                Configured vs Runtime In-Browser Environment Inspection
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
        <div className="p-7 overflow-y-auto space-y-5 flex-1">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
              <span className="w-8 h-8 border-3 border-slate-200 dark:border-app-border border-t-brand-500 rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-600 dark:text-app-muted">
                Inspecting runtime environment & browser fingerprint parameters...
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-600 dark:text-rose-400">
              <p className="font-bold mb-1">Diagnostics Error</p>
              <p>{error}</p>
            </div>
          ) : data ? (
            <div className="space-y-4">
              {/* WebRTC & Network Privacy Leak Shield */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      data.networkPrivacy && (data.networkPrivacy.realIpLeak || data.networkPrivacy.ipv6Leak || data.webrtcStatus.leaked)
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    }`}>
                      <ShieldCheckIcon size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900 dark:text-app-text">
                          Network Privacy & Leak Shield
                        </p>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600">
                          {data.webrtcStatus.policy}
                        </span>
                        {data.networkPrivacy?.killSwitch?.active && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/10 text-sky-600">
                            Kill-Switch Armed
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-app-muted-2 mt-0.5">
                        {data.webrtcStatus.description}
                      </p>
                    </div>
                  </div>
                </div>

                {data.networkPrivacy && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-app-surface border border-slate-200/60 dark:border-app-border">
                      <span className="text-[10px] uppercase font-bold text-slate-400">WebRTC Candidates</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {data.webrtcStatus.leaked ? '⚠️ Private IP Leaked' : '✓ Protected (0 Private IPs)'}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-app-surface border border-slate-200/60 dark:border-app-border">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Public IP vs Proxy</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                        {data.networkPrivacy.realIpLeak ? '⚠️ Real IP Exposed!' : data.networkPrivacy.browserPublicIp || 'Direct'}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-app-surface border border-slate-200/60 dark:border-app-border">
                      <span className="text-[10px] uppercase font-bold text-slate-400">IPv6 Bypass / Direct Leak</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {data.networkPrivacy.ipv6Leak ? '⚠️ IPv6 Leak' : '✓ IPv6 Protected / Disabled'}
                      </p>
                    </div>
                  </div>
                )}
              </div>


              {/* Comparison Table */}
              <div className="border border-slate-200/80 dark:border-app-border rounded-2xl overflow-hidden bg-white dark:bg-app-surface">
                <div className="px-4 py-3 bg-slate-50/70 dark:bg-app-surface-2/40 border-b border-slate-200/80 dark:border-app-border flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-app-text flex items-center gap-1.5">
                    <MonitorIcon size={14} className="text-brand-500" />
                    Environment Parameter Comparison
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    Configured vs Detected
                  </span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 dark:border-app-border bg-slate-50/30 dark:bg-app-surface-3/30 text-[10px] uppercase font-bold text-slate-400">
                    <tr>
                      <th className="py-2.5 px-4">Parameter</th>
                      <th className="py-2.5 px-4">Configured</th>
                      <th className="py-2.5 px-4">Detected in Runtime</th>
                      <th className="py-2.5 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-app-border">
                    {data.comparisons.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-app-surface-2/30">
                        <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-app-text">{c.field}</td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-app-muted font-mono text-[11px]">{String(c.configured)}</td>
                        <td className="py-2.5 px-4 text-slate-800 dark:text-slate-200 font-mono text-[11px]">{String(c.detected)}</td>
                        <td className="py-2.5 px-4 text-right">
                          {c.match ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                              <CheckIcon size={10} className="stroke-[3]" /> Match
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600">
                              ! Mismatch
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Proxy & Network Info */}
              {data.proxyInfo ? (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border space-y-2">
                  <div className="flex items-center gap-2">
                    <GlobeIcon size={14} className="text-sky-500" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-app-text">
                      Attached Proxy Geolocation
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-app-surface border border-slate-200/60 dark:border-app-border">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Proxy Host</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate">{data.proxyInfo.name}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-app-surface border border-slate-200/60 dark:border-app-border">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Country</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{data.proxyInfo.country_name || data.proxyInfo.country_code || 'N/A'}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-app-surface border border-slate-200/60 dark:border-app-border">
                      <span className="text-[10px] uppercase font-bold text-slate-400">City</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate">{data.proxyInfo.city || 'N/A'}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-app-surface border border-slate-200/60 dark:border-app-border">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Proxy Timezone</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate">{data.proxyInfo.timezone || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border flex items-center gap-2.5 text-xs text-slate-500">
                  <GlobeIcon size={14} className="text-slate-400" />
                  <span>Direct connection (no proxy attached)</span>
                </div>
              )}

              {data.fingerprintAudit && (
                <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-3">
                  <div className="flex items-center justify-between"><div><h4 className="text-xs font-bold">Browser Identity Consistency Audit</h4><p className="text-[11px] text-slate-400 mt-0.5">Cross-checks configured and runtime browser signals.</p></div><span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-sm font-extrabold">{data.fingerprintAudit.score}/100 · {data.fingerprintAudit.grade}</span></div>
                  {data.fingerprintAudit.issues.length > 0 ? <div className="space-y-1">{data.fingerprintAudit.issues.map((item) => <div key={item.code} className="text-[11px] text-slate-600 dark:text-app-muted"><span className="font-bold uppercase">{item.severity}</span> · {item.message}</div>)}</div> : <p className="text-[11px] text-emerald-600">No internal consistency problems detected.</p>}
                </div>
              )}

              {/* Hardware & Navigator User Agent */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Runtime User Agent</span>
                <p className="text-[11px] font-mono text-slate-700 dark:text-slate-300 break-all leading-relaxed">
                  {data.runtimeData.userAgent}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ['Browser', `${data.profile.browser_type} ${data.runtimeData.browserVersion}`],
                  ['Screen', `${data.runtimeData.screen.width}x${data.runtimeData.screen.height}`],
                  ['Public IP', data.runtimeData.publicIp],
                  ['Proxy', data.runtimeData.proxyStatus],
                  ['Cookies', data.runtimeData.cookieEnabled ? 'Available' : 'Unavailable'],
                  ['LocalStorage', data.runtimeData.localStorageAvailable ? 'Available' : 'Unavailable'],
                  ['IndexedDB', data.runtimeData.indexedDBAvailable ? 'Available' : 'Unavailable'],
                  ['Canvas / WebGL', `${data.runtimeData.canvasAvailable ? 'Canvas' : 'No canvas'} / ${data.runtimeData.webglAvailable ? 'WebGL' : 'No WebGL'}`],
                ].map(([label, value]) => (
                  <div key={label} className="p-2.5 rounded-xl bg-slate-50 dark:bg-app-bg border border-slate-200/60 dark:border-app-border">
                    <p className="text-[10px] uppercase font-bold text-slate-400">{label}</p>
                    <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 mt-0.5 break-all">{value}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-app-bg border border-slate-200/60 dark:border-app-border">
                <p className="text-[10px] uppercase font-bold text-slate-400">WebGL renderer</p>
                <p className="text-[11px] font-mono text-slate-700 dark:text-slate-300 break-all">{data.runtimeData.webglRenderer}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-7 py-4 border-t border-slate-100 dark:border-app-border shrink-0 bg-slate-50/30 dark:bg-app-surface-2/20">
          <div className="flex items-center gap-2">
            <button type="button" onClick={loadDiagnostics} disabled={loading} className="btn-secondary text-xs">
              <ActivityIcon size={13} /> Re-run
            </button>
            <button type="button" onClick={copyReport} disabled={!data} className="btn-secondary text-xs">
              <CopyIcon size={13} /> Copy report
            </button>
            <button type="button" onClick={exportReport} disabled={!data} className="btn-secondary text-xs">
              <DownloadIcon size={13} /> Export
            </button>
            {notice && <span className="text-[11px] text-emerald-500">{notice}</span>}
          </div>
          <button type="button" onClick={onClose} className="btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default DiagnosticsModal
