import { useEffect, useState } from 'react'
import { CloseIcon, KeyIcon, TrashIcon } from './icons'

export default function TotpModal({ profile, onClose }) {
  const [state, setState] = useState({ configured: false, metadata: null })
  const [secret, setSecret] = useState('')
  const [issuer, setIssuer] = useState('')
  const [account, setAccount] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { window.electronAPI.getTotpStatus(profile.id).then(setState) }, [profile.id])

  async function save() {
    setBusy(true)
    try {
      const result = await window.electronAPI.setTotp(profile.id, secret, { issuer, account })
      setState(result)
      setSecret('')
      setNotice('2FA secret encrypted and saved.')
    } catch (err) { setNotice(err.message || 'Could not save 2FA secret') }
    finally { setBusy(false) }
  }

  async function copy() {
    setBusy(true)
    try {
      const result = await window.electronAPI.copyTotp(profile.id)
      setNotice(`OTP copied. Clipboard clears in 45 seconds; code expires in ${result.remaining}s.`)
    } catch (err) { setNotice(err.message || 'Could not generate OTP') }
    finally { setBusy(false) }
  }

  async function remove() {
    if (!confirm('Remove the encrypted 2FA secret from this profile?')) return
    await window.electronAPI.removeTotp(profile.id)
    setState({ configured: false, metadata: null })
    setNotice('2FA secret removed.')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="card w-full max-w-lg p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between"><div><h2 className="text-base font-bold">2FA / TOTP Vault</h2><p className="text-xs text-slate-400 mt-1">{profile.name}</p></div><button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-app-surface-3"><CloseIcon size={16} /></button></div>
        {state.configured ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20"><p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">2FA configured</p><p className="text-xs text-slate-500 mt-1">{state.metadata?.issuer || 'TOTP'} · {state.metadata?.account || profile.name} · {state.metadata?.digits || 6} digits</p></div>
            <button onClick={copy} disabled={busy} className="btn-primary w-full justify-center"><KeyIcon size={15} />Copy current OTP</button>
            <button onClick={remove} disabled={busy} className="btn-danger w-full justify-center"><TrashIcon size={14} />Remove 2FA secret</button>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea value={secret} onChange={(e) => setSecret(e.target.value)} rows={3} className="input w-full font-mono text-xs" placeholder="Base32 secret or otpauth://totp/... URL" />
            <div className="grid grid-cols-2 gap-3"><input value={issuer} onChange={(e) => setIssuer(e.target.value)} className="input text-xs" placeholder="Issuer (optional)" /><input value={account} onChange={(e) => setAccount(e.target.value)} className="input text-xs" placeholder="Account (optional)" /></div>
            <p className="text-[11px] text-slate-400">The secret is encrypted using OS-backed storage when available and is never shown again.</p>
            <button onClick={save} disabled={busy || !secret.trim()} className="btn-primary w-full justify-center">Encrypt & save</button>
          </div>
        )}
        {notice && <p className="text-xs text-slate-500 dark:text-app-muted">{notice}</p>}
      </div>
    </div>
  )
}
