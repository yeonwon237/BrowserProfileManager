import { useCallback, useEffect, useState } from 'react'
import { FolderIcon, LayersIcon, PlusIcon, TrashIcon } from '../components/icons'

export default function Extensions() {
  const [extensions, setExtensions] = useState([])
  const [profiles, setProfiles] = useState([])
  const [workspaces, setWorkspaces] = useState([])
  const [assignments, setAssignments] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [scopeType, setScopeType] = useState('profile')
  const [scopeId, setScopeId] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async (preferredId = '') => {
    const [extensionRows, profileRows, workspaceRows] = await Promise.all([
      window.electronAPI.getExtensions(), window.electronAPI.getProfiles({}), window.electronAPI.getWorkspaces({}),
    ])
    setExtensions(extensionRows || [])
    setProfiles(profileRows || [])
    setWorkspaces(workspaceRows || [])
    const nextId = preferredId || extensionRows?.[0]?.id || ''
    setSelectedId(nextId)
    setAssignments(nextId ? await window.electronAPI.getExtensionAssignments(nextId) : [])
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const options = scopeType === 'profile' ? profiles : workspaces
    if (!options.some((item) => item.id === scopeId)) setScopeId(options[0]?.id || '')
  }, [scopeType, profiles, workspaces, scopeId])

  async function selectExtension(id) {
    setSelectedId(id)
    setAssignments(await window.electronAPI.getExtensionAssignments(id))
  }

  async function register() {
    const folder = await window.electronAPI.pickFolder('Select unpacked Chrome extension folder')
    if (!folder) return
    setBusy(true)
    try {
      const result = await window.electronAPI.registerExtensionDirectory(folder)
      setNotice(`Registered ${result.name} ${result.version}`)
      await refresh(result.id)
    } catch (err) { setNotice(err.message || 'Extension registration failed') }
    finally { setBusy(false) }
  }

  async function registerCrx() {
    const file = await window.electronAPI.pickFile('Select Chrome extension package', [{ name: 'Chrome extension', extensions: ['crx'] }])
    if (!file) return
    setBusy(true)
    try {
      const result = await window.electronAPI.registerExtensionCrx(file)
      setNotice(`Imported ${result.name} ${result.version} from CRX`)
      await refresh(result.id)
    } catch (err) { setNotice(err.message || 'CRX import failed') }
    finally { setBusy(false) }
  }

  async function assign() {
    if (!selectedId || !scopeId) return
    setBusy(true)
    try {
      await window.electronAPI.assignExtension(selectedId, scopeType, scopeId, true)
      setAssignments(await window.electronAPI.getExtensionAssignments(selectedId))
      setNotice('Assignment saved. It applies on the next profile launch.')
    } catch (err) { setNotice(err.message || 'Assignment failed') }
    finally { setBusy(false) }
  }

  async function removeExtension(extension) {
    if (!confirm(`Remove ${extension.name} from YNlogin? The source folder will not be deleted.`)) return
    await window.electronAPI.removeExtension(extension.id)
    await refresh()
  }

  const targets = scopeType === 'profile' ? profiles : workspaces
  const selected = extensions.find((item) => item.id === selectedId)

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-extrabold text-slate-900 dark:text-app-text">Extension Manager</h1><p className="text-xs text-slate-400 mt-1">Register verified unpacked extensions and assign them centrally.</p></div>
        <div className="flex gap-2"><button onClick={registerCrx} disabled={busy} className="btn-secondary"><PlusIcon size={14} />Import .crx</button><button onClick={register} disabled={busy} className="btn-primary"><PlusIcon size={14} />Register folder</button></div>
      </div>
      {notice && <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-xs text-brand-600 dark:text-brand-400">{notice}</div>}
      <div className="grid grid-cols-[1.2fr_1fr] gap-6">
        <div className="card overflow-hidden">
          {extensions.length === 0 ? <div className="p-12 text-center"><FolderIcon size={28} className="mx-auto text-slate-300" /><p className="text-sm font-bold mt-3">No extensions registered</p></div> : extensions.map((extension) => (
            <button key={extension.id} onClick={() => selectExtension(extension.id)} className={`w-full text-left p-4 border-b border-slate-100 dark:border-app-border flex items-center gap-3 ${selectedId === extension.id ? 'bg-brand-500/10' : 'hover:bg-slate-50 dark:hover:bg-app-surface-2'}`}>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center"><LayersIcon size={18} /></div>
              <div className="min-w-0 flex-1"><p className="text-sm font-bold truncate">{extension.name}</p><p className="text-[11px] text-slate-400">v{extension.version || '—'} · Manifest V{extension.manifest_version} · {extension.sha256.slice(0, 12)}…</p></div>
              <span onClick={(event) => { event.stopPropagation(); removeExtension(extension) }} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg"><TrashIcon size={14} /></span>
            </button>
          ))}
        </div>
        <div className="card p-5 space-y-4">
          <div><h2 className="text-sm font-bold">Assignments</h2><p className="text-[11px] text-slate-400 mt-1">{selected ? selected.name : 'Select an extension'}</p></div>
          <select value={scopeType} onChange={(e) => setScopeType(e.target.value)} className="input w-full text-xs"><option value="profile">Profile</option><option value="workspace">Workspace</option></select>
          <select value={scopeId} onChange={(e) => setScopeId(e.target.value)} className="input w-full text-xs">{targets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <button onClick={assign} disabled={busy || !selectedId || !scopeId} className="btn-primary w-full justify-center">Assign extension</button>
          <div className="space-y-2 pt-2">
            {assignments.map((item) => {
              const source = item.scope_type === 'profile' ? profiles : workspaces
              const name = source.find((target) => target.id === item.scope_id)?.name || item.scope_id
              return <div key={`${item.scope_type}:${item.scope_id}`} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-app-surface-2 text-xs"><span className="font-bold capitalize">{item.scope_type}</span> · {name}</div>
            })}
            {selectedId && assignments.length === 0 && <p className="text-xs text-slate-400">No assignments yet.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
