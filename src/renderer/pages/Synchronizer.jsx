import { useCallback, useEffect, useMemo, useState } from 'react'
import { PlayIcon, StopIcon, UsersIcon } from '../components/icons'

export default function Synchronizer() {
  const [running, setRunning] = useState([])
  const [masterId, setMasterId] = useState('')
  const [workers, setWorkers] = useState({})
  const [sessions, setSessions] = useState([])
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const [profiles, active] = await Promise.all([window.electronAPI.getRunningProfiles(), window.electronAPI.getActionSyncStatus()])
    setRunning(profiles || []); setSessions(active || [])
    if (!masterId && profiles?.[0]) setMasterId(profiles[0].id)
  }, [masterId])
  useEffect(() => { refresh(); const timer = setInterval(refresh, 2000); return () => clearInterval(timer) }, [refresh])
  const selectedWorkers = useMemo(() => Object.keys(workers).filter((id) => workers[id] && id !== masterId), [workers, masterId])

  async function start() {
    setBusy(true)
    try { await window.electronAPI.startActionSync(masterId, selectedWorkers); setNotice('Synchronization session started.'); await refresh() }
    catch (err) { setNotice(err.message || 'Could not start synchronization') }
    finally { setBusy(false) }
  }
  async function emergencyStop() { await window.electronAPI.stopAllActionSync(); setNotice('Emergency stop completed.'); refresh() }

  return (
    <div className="px-8 py-7 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-xl font-extrabold">Action Synchronizer</h1><p className="text-xs text-slate-400 mt-1">Synchronize semantic click, non-sensitive input and scroll actions across running profiles.</p></div><button onClick={emergencyStop} className="btn-danger"><StopIcon size={14} />Emergency stop</button></div>
      {notice && <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-xs">{notice}</div>}
      <div className="grid grid-cols-2 gap-6">
        <div className="card p-5 space-y-4"><h2 className="text-sm font-bold">Master window</h2><select value={masterId} onChange={(e) => setMasterId(e.target.value)} className="input w-full text-xs">{running.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select><p className="text-[11px] text-slate-400">Use the currently active page in this profile as the event source.</p></div>
        <div className="card p-5 space-y-3"><h2 className="text-sm font-bold">Worker windows</h2>{running.filter((profile) => profile.id !== masterId).map((profile) => <label key={profile.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-app-surface-2 text-xs"><input type="checkbox" checked={Boolean(workers[profile.id])} onChange={(e) => setWorkers((value) => ({ ...value, [profile.id]: e.target.checked }))} />{profile.name}</label>)}{running.length < 2 && <p className="text-xs text-slate-400">Open at least two profiles first.</p>}</div>
      </div>
      <div className="card p-5 flex items-center justify-between"><div><p className="text-sm font-bold">Safety policy</p><p className="text-[11px] text-slate-400 mt-1">Password, OTP, CAPTCHA, card and security-code fields are never synchronized.</p></div><button onClick={start} disabled={busy || !masterId || selectedWorkers.length === 0} className="btn-primary"><PlayIcon size={14} />Start sync</button></div>
      {sessions.length > 0 && <div className="card p-5 space-y-3"><h2 className="text-sm font-bold">Active sessions</h2>{sessions.map((session) => <div key={session.id} className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10"><div className="flex items-center gap-2 text-xs"><UsersIcon size={14} />{session.workerProfileIds.length} workers · {session.eventCount} events · {session.errorCount} errors</div><button onClick={() => window.electronAPI.stopActionSync(session.id).then(refresh)} className="btn-danger">Stop</button></div>)}</div>}
    </div>
  )
}
