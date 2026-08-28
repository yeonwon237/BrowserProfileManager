import { useCallback, useEffect, useState } from 'react'
import { CloseIcon, PlayIcon, StopIcon } from './icons'

const SAMPLE_URLS = 'https://www.wikipedia.org/\nhttps://www.bbc.com/\nhttps://www.reuters.com/\nhttps://www.youtube.com/'

export default function WarmupModal({ profile, onClose }) {
  const [urls, setUrls] = useState(SAMPLE_URLS)
  const [dwellSeconds, setDwellSeconds] = useState(5)
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState([])
  const [history, setHistory] = useState([])
  const [notice, setNotice] = useState('')

  const loadHistory = useCallback(async () => { setHistory(await window.electronAPI.getWarmupHistory(profile.id, 10)) }, [profile.id])
  useEffect(() => { loadHistory() }, [loadHistory])

  async function start() {
    const list = urls.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
    setRunning(true); setReport([]); setNotice('Warmup is running…')
    try {
      const result = await window.electronAPI.startWarmup(profile.id, {
        urls: list, dwellMinMs: Number(dwellSeconds) * 1000, dwellMaxMs: Number(dwellSeconds) * 1000 + 2000,
      })
      setReport(result.report || [])
      setNotice(`Completed ${result.report.filter((item) => item.ok).length}/${result.report.length} pages.`)
    } catch (err) { setNotice(err.message || 'Warmup failed') }
    finally { setRunning(false); loadHistory() }
  }

  async function cancel() { await window.electronAPI.cancelWarmup(profile.id); setNotice('Cancellation requested…') }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="card w-full max-w-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between"><div><h2 className="text-base font-bold">Profile Warmup</h2><p className="text-xs text-slate-400 mt-1">{profile.name} · 1–50 public HTTP(S) pages</p></div><button onClick={onClose} disabled={running} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-app-surface-3"><CloseIcon size={16} /></button></div>
        <textarea value={urls} onChange={(e) => setUrls(e.target.value)} disabled={running} rows={7} className="input w-full font-mono text-xs" />
        <div><label className="text-xs font-semibold">Dwell time per page: {dwellSeconds}s</label><input type="range" min="1" max="60" value={dwellSeconds} onChange={(e) => setDwellSeconds(e.target.value)} disabled={running} className="w-full mt-2" /></div>
        <p className="text-[11px] text-slate-400">Loopback, private-network and credential-bearing URLs are blocked. Warmup prepares normal session storage; it does not guarantee account acceptance.</p>
        <div className="flex gap-2">{running ? <button onClick={cancel} className="btn-danger"><StopIcon size={14} />Cancel warmup</button> : <button onClick={start} disabled={!urls.trim()} className="btn-primary"><PlayIcon size={14} />Start warmup</button>}</div>
        {notice && <p className="text-xs text-slate-500">{notice}</p>}
        {report.length > 0 && <div className="space-y-1">{report.map((item) => <div key={item.url} className={`p-2 rounded-lg text-[11px] ${item.ok ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>{item.ok ? '✓' : '✕'} {item.url} {item.status ? `· HTTP ${item.status}` : ''}</div>)}</div>}
        {history.length > 0 && <div className="pt-3 border-t border-slate-100 dark:border-app-border"><h3 className="text-xs font-bold mb-2">Recent runs</h3>{history.map((run) => <div key={run.id} className="flex justify-between py-1.5 text-[11px]"><span className="capitalize">{run.status}</span><span>{run.urls_completed}/{run.urls_total} pages</span></div>)}</div>}
      </div>
    </div>
  )
}
