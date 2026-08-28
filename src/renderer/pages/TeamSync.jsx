import { useCallback, useEffect, useState } from 'react'
import { ActivityIcon, CheckIcon, RefreshIcon, ShieldCheckIcon } from '../components/icons'
import { useWorkspace } from '../context/WorkspaceContext'

export default function TeamSync() {
  const { currentWorkspaceId } = useWorkspace()
  const workspaceId = currentWorkspaceId === 'all' ? 'default' : currentWorkspaceId
  const [status, setStatus] = useState(null)
  const [endpoint, setEndpoint] = useState('')
  const [secret, setSecret] = useState('')
  const [token, setToken] = useState('')
  const [notice, setNotice] = useState('')
  const [conflictStrategy, setConflictStrategy] = useState('manual')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!window.electronAPI?.getTeamSyncStatus) {
      setStatus({ configured: false, workspaceId, endpoint: '', lastSyncAt: null, hasCursor: false })
      return
    }
    const next = await window.electronAPI.getTeamSyncStatus(workspaceId)
    setStatus(next)
    if (next.endpoint) setEndpoint(next.endpoint)
  }, [workspaceId])

  useEffect(() => { refresh().catch((error) => setNotice(error.message)) }, [refresh])

  async function configure(event) {
    event.preventDefault()
    setBusy(true); setNotice('')
    try {
      const next = await window.electronAPI.configureTeamSync({ workspaceId, endpoint, secret, bearerToken: token })
      setStatus(next); setSecret(''); setToken(''); setNotice('Encrypted Team Sync configuration saved.')
    } catch (error) { setNotice(error.message || 'Configuration failed') }
    finally { setBusy(false) }
  }

  async function syncNow() {
    setBusy(true); setNotice('')
    try {
      const result = await window.electronAPI.runTeamSync(workspaceId, { conflictStrategy })
      setNotice(result.requiresResolution ? `${result.conflicts.length} conflict(s) require resolution.` : `Sync complete: ${result.appliedCount} profile(s) reconciled.`)
      await refresh()
    } catch (error) { setNotice(error.message || 'Sync failed') }
    finally { setBusy(false) }
  }

  return <div className="px-8 py-7 max-w-5xl mx-auto space-y-6">
    <div><h1 className="text-xl font-extrabold text-slate-900 dark:text-app-text">Team Sync</h1><p className="text-xs text-slate-400 mt-1">End-to-end encrypted profile configuration sync with revision conflict protection.</p></div>
    {notice && <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-xs text-brand-600 dark:text-brand-400">{notice}</div>}
    <div className="grid md:grid-cols-2 gap-6">
      <form onSubmit={configure} className="card p-5 space-y-4">
        <div className="flex items-center gap-2"><ShieldCheckIcon size={17} className="text-brand-500"/><h2 className="text-sm font-bold">Secure workspace connection</h2></div>
        <label className="block text-xs font-semibold">HTTPS endpoint<input required type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://sync.example.com/v1/exchange" className="input w-full mt-1" /></label>
        <label className="block text-xs font-semibold">Workspace encryption secret<input required={!status?.configured} minLength={16} type="password" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder={status?.configured ? 'Enter a new secret to rotate' : 'Minimum 16 characters'} className="input w-full mt-1" /></label>
        <label className="block text-xs font-semibold">Bearer token<input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Optional service token" className="input w-full mt-1" /></label>
        <button disabled={busy || !secret} className="btn-primary w-full justify-center"><CheckIcon size={14}/>Save encrypted configuration</button>
      </form>
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2"><ActivityIcon size={17} className="text-emerald-500"/><h2 className="text-sm font-bold">Runtime status</h2></div>
        <div className="rounded-xl bg-slate-50 dark:bg-app-surface-2 p-4 text-xs space-y-2"><p><b>Workspace:</b> {workspaceId}</p><p><b>Configured:</b> {status?.configured ? 'Yes' : 'No'}</p><p><b>Last sync:</b> {status?.lastSyncAt || 'Never'}</p><p><b>Remote cursor:</b> {status?.hasCursor ? 'Stored' : 'None'}</p></div>
        <label className="block text-xs font-semibold">Conflict policy<select value={conflictStrategy} onChange={(event) => setConflictStrategy(event.target.value)} className="input w-full mt-1"><option value="manual">Stop and report conflicts</option><option value="local_newer">Prefer highest revision / newest record</option><option value="remote_newer">Prefer remote record</option></select></label>
        <button type="button" onClick={syncNow} disabled={busy || !status?.configured} className="btn-primary w-full justify-center"><RefreshIcon size={14}/>Sync now</button>
        <p className="text-[11px] text-slate-400">Secrets and service tokens are encrypted locally and never returned to the renderer.</p>
      </div>
    </div>
  </div>
}
