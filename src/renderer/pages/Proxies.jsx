import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  PlusIcon,
  GlobeIcon,
  TrashIcon,
  PencilIcon,
  RefreshIcon,
  KeyIcon,
  AlertIcon,
  CheckIcon,
  CloseIcon,
  CopyIcon,
  ShieldCheckIcon,
  LayersIcon,
} from '../components/icons'
import ProxyFormModal from '../components/ProxyFormModal'
import ProxyRulesModal from '../components/ProxyRulesModal'
import ConfirmDialog from '../components/ConfirmDialog'

function MetricCard({ title, value, subtitle, icon: Icon, colorClass, borderClass }) {
  return (
    <div className="card p-4 flex items-center justify-between relative overflow-hidden group hover:border-slate-300 dark:hover:border-app-border-light transition-all">
      <div>
        <p className="text-[11px] font-semibold text-slate-400 dark:text-app-muted-2 uppercase tracking-wider">
          {title}
        </p>
        <p className="text-2xl font-extrabold text-slate-900 dark:text-app-text mt-0.5 tracking-tight">
          {value}
        </p>
        {subtitle && (
          <p className="text-[11px] text-slate-400 dark:text-app-muted mt-0.5 font-medium">
            {subtitle}
          </p>
        )}
      </div>
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${borderClass} ${colorClass} transition-transform duration-300 group-hover:scale-110 shadow-sm`}>
        <Icon size={20} />
      </div>
    </div>
  )
}

function ProtocolBadge({ protocol }) {
  const map = {
    http: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25',
    https: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    socks5: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/25',
  }
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${map[protocol] || map.http}`}>
      {protocol}
    </span>
  )
}

function Checkbox({ checked, onChange, indeterminate }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-150 active:scale-95 ${
        checked || indeterminate
          ? 'bg-brand-600 border-brand-600 text-white shadow-sm shadow-brand-600/30'
          : 'border-slate-300 dark:border-app-border-light bg-white dark:bg-app-surface hover:border-brand-500'
      }`}
    >
      {checked && <CheckIcon size={12} className="stroke-[2.5]" />}
      {indeterminate && !checked && <div className="w-2 h-0.5 bg-white rounded-full" />}
    </button>
  )
}

function EmptyState({ onAdd }) {
  return (
    <div className="empty-state py-20">
      <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-app-surface-2 border border-slate-200 dark:border-app-border flex items-center justify-center mb-4 shadow-inner">
        <GlobeIcon size={28} className="text-slate-400 dark:text-app-muted-2" />
      </div>
      <h3 className="text-base font-bold text-slate-800 dark:text-app-text mb-1">
        No Proxy Connections Configured
      </h3>
      <p className="text-xs text-slate-400 dark:text-app-muted-2 mb-6 max-w-sm leading-relaxed">
        Add custom HTTP, HTTPS, or SOCKS5 proxies to disguise browser fingerprints and route profile web traffic.
      </p>
      <button onClick={onAdd} className="btn-primary">
        <PlusIcon size={15} />
        Add First Proxy
      </button>
    </div>
  )
}

function ConfirmDeleteModal({ proxy, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      await onConfirm(proxy.id)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to delete proxy')
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white dark:bg-app-surface border border-slate-200/90 dark:border-app-border shadow-2xl shadow-slate-900/20 dark:shadow-black/80 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 dark:border-app-border bg-slate-50/50 dark:bg-app-surface-2/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <TrashIcon size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">Delete Proxy</h3>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2">Permanent deletion</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 dark:text-app-muted hover:text-slate-700 dark:hover:text-app-text hover:bg-slate-100 dark:hover:bg-app-surface-2 transition-all">
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="p-7 space-y-4">
          <p className="text-xs text-slate-600 dark:text-app-muted leading-relaxed">
            Are you sure you want to delete proxy <strong className="text-slate-900 dark:text-app-text">"{proxy.name}"</strong>? Any browser profiles currently using this proxy will automatically revert to direct connections.
          </p>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-medium text-rose-500 dark:text-rose-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-app-border">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleDelete} disabled={deleting} className="btn-danger">
              {deleting ? 'Deleting...' : 'Delete Proxy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Proxies({ search = '' }) {
  const [proxies, setProxies] = useState([])
  const [loading, setLoading] = useState(true)
  const [formModal, setFormModal] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [notice, setNotice] = useState({ type: 'success', text: '' })
  const [testingId, setTestingId] = useState(null)
  const [testResults, setTestResults] = useState({})
  const [copiedId, setCopiedId] = useState(null)
  const [selected, setSelected] = useState({})
  const [confirmDialog, setConfirmDialog] = useState(null)

  const refresh = useCallback(async () => {
    const data = await window.electronAPI.getProxies()
    setProxies(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!notice.text) return
    const t = setTimeout(() => setNotice({ type: 'success', text: '' }), 3500)
    return () => clearTimeout(t)
  }, [notice])

  async function handleTest(id) {
    setTestingId(id)
    setTestResults((prev) => ({ ...prev, [id]: { testing: true } }))
    try {
      const result = await window.electronAPI.testProxy(id)
      setTestResults((prev) => ({ ...prev, [id]: result }))
    } catch (err) {
      setTestResults((prev) => ({ ...prev, [id]: { success: false, message: err.message } }))
    } finally {
      setTestingId(null)
    }
  }

  async function handleCreate(payload) {
    const items = Array.isArray(payload) ? payload : [payload]
    for (const item of items) {
      await window.electronAPI.createProxy(item)
    }
    setNotice({
      type: 'success',
      text: items.length === 1 ? 'Proxy added successfully' : `${items.length} proxies imported successfully`,
    })
    await refresh()
  }

  async function handleEdit(payload) {
    await window.electronAPI.updateProxy(formModal.id, payload)
    setNotice({ type: 'success', text: 'Proxy updated' })
    await refresh()
  }

  async function handleDelete(id) {
    await window.electronAPI.deleteProxy(id)
    setNotice({ type: 'success', text: 'Proxy deleted' })
    setTestResults((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setSelected((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    await refresh()
  }

  function handleCopy(text, id) {
    navigator.clipboard?.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function formatDate(value) {
    if (!value) return '—'
    const d = new Date(value.replace(' ', 'T'))
    if (isNaN(d)) return value
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const filteredProxies = useMemo(() => {
    if (!search) return proxies
    const q = search.toLowerCase()
    return proxies.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.host.toLowerCase().includes(q) ||
        String(p.port).includes(q) ||
        (p.notes || '').toLowerCase().includes(q)
    )
  }, [proxies, search])

  const counts = {
    total: proxies.length,
    http: proxies.filter((p) => p.protocol === 'http').length,
    https: proxies.filter((p) => p.protocol === 'https').length,
    socks5: proxies.filter((p) => p.protocol === 'socks5').length,
  }

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected])
  const allFilteredSelected = filteredProxies.length > 0 && filteredProxies.every((p) => selected[p.id])
  const someSelected = selectedIds.length > 0 && !allFilteredSelected

  function toggleAll() {
    const next = { ...selected }
    filteredProxies.forEach((p) => {
      next[p.id] = !allFilteredSelected
    })
    setSelected(next)
  }

  function toggleOne(id) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function clearSelection() {
    setSelected({})
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return
    setConfirmDialog({
      title: 'Delete Proxies',
      subtitle: 'Permanent deletion',
      message: `Are you sure you want to delete ${selectedIds.length} selected proxy node(s)? Any profiles using them will revert to direct connections.`,
      confirmLabel: 'Delete Proxies',
      loadingLabel: 'Deleting...',
      tone: 'danger',
      onConfirm: async () => {
        await window.electronAPI.bulkDeleteProxies(selectedIds)
        setNotice({ type: 'success', text: `${selectedIds.length} proxies deleted` })
        setTestResults((prev) => {
          const next = { ...prev }
          selectedIds.forEach((id) => { delete next[id] })
          return next
        })
        clearSelection()
        await refresh()
      },
    })
  }

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto space-y-6">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          title="Total Proxies"
          value={counts.total}
          subtitle="Configured nodes"
          icon={GlobeIcon}
          colorClass="bg-brand-500/10 text-brand-600 dark:text-brand-400"
          borderClass="border-brand-500/20"
        />
        <MetricCard
          title="HTTP"
          value={counts.http}
          subtitle="Standard web proxy"
          icon={GlobeIcon}
          colorClass="bg-sky-500/10 text-sky-600 dark:text-sky-400"
          borderClass="border-sky-500/20"
        />
        <MetricCard
          title="HTTPS (SSL)"
          value={counts.https}
          subtitle="Encrypted tunnel"
          icon={ShieldCheckIcon}
          colorClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          borderClass="border-emerald-500/20"
        />
        <MetricCard
          title="SOCKS5"
          value={counts.socks5}
          subtitle="Full TCP proxy"
          icon={KeyIcon}
          colorClass="bg-purple-500/10 text-purple-600 dark:text-purple-400"
          borderClass="border-purple-500/20"
        />
      </div>

      {/* Header toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-app-text">Proxy Nodes</h3>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-app-surface-2 border border-slate-200 dark:border-app-border text-[11px] font-bold text-slate-600 dark:text-app-muted">
            {filteredProxies.length} available
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRulesModal(true)}
            className="btn btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5"
          >
            <LayersIcon size={14} />
            <span>Proxy Rules & Auto-Assign</span>
          </button>
          <button onClick={() => setFormModal({ mode: 'create' })} className="btn-primary">
            <PlusIcon size={15} />
            Add Proxy
          </button>
        </div>
      </div>

      {notice.text && (
        <div
          className={`px-4 py-3 rounded-2xl border text-xs font-semibold flex items-center justify-between animate-fade-in ${
            notice.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice({ type: 'success', text: '' })} className="p-0.5 rounded opacity-70 hover:opacity-100">
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="card flex flex-col items-center justify-center py-28 gap-3">
          <div className="w-7 h-7 border-2 border-slate-200 dark:border-app-border-light border-t-brand-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-400 dark:text-app-muted-2 font-medium">Loading proxies...</p>
        </div>
      ) : proxies.length === 0 ? (
        <div className="card">
          <EmptyState onAdd={() => setFormModal({ mode: 'create' })} />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-app-border bg-slate-50/60 dark:bg-app-surface-2/40 text-[11px] font-bold text-slate-400 dark:text-app-muted uppercase tracking-wider">
                  <th className="px-5 py-3.5 w-12 text-center">
                    <Checkbox checked={allFilteredSelected} indeterminate={someSelected} onChange={toggleAll} />
                  </th>
                  <th className="px-5 py-3.5">Proxy Name</th>
                  <th className="px-5 py-3.5">Protocol</th>
                  <th className="px-5 py-3.5">Host : Port</th>
                  <th className="px-5 py-3.5">Authentication</th>
                  <th className="px-5 py-3.5">Created</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-app-border text-xs">
                {filteredProxies.map((proxy) => {
                  const test = testResults[proxy.id]
                  const isTesting = testingId === proxy.id
                  const hostPort = `${proxy.host}:${proxy.port}`

                  return (
                    <>
                    <tr
                      key={proxy.id}
                      className={`transition-colors duration-150 ${
                        selected[proxy.id]
                          ? 'bg-brand-500/5 dark:bg-brand-500/10'
                          : 'hover:bg-slate-50/80 dark:hover:bg-app-surface-2/40'
                      }`}
                    >
                      <td className="px-5 py-3.5 text-center">
                        <Checkbox checked={Boolean(selected[proxy.id])} onChange={() => toggleOne(proxy.id)} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500 shrink-0">
                            <GlobeIcon size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-slate-900 dark:text-app-text">{proxy.name}</p>
                            {proxy.notes && (
                              <p className="text-[11px] text-slate-400 dark:text-app-muted-2 truncate max-w-[180px]">
                                {proxy.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <ProtocolBadge protocol={proxy.protocol} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-app-surface-3 border border-slate-200/80 dark:border-app-border font-mono text-[11px] font-bold text-slate-800 dark:text-app-text">
                          <span>{hostPort}</span>
                          <button
                            onClick={() => handleCopy(hostPort, proxy.id)}
                            title="Copy IP:Port"
                            className="text-slate-400 hover:text-brand-500 transition-colors"
                          >
                            {copiedId === proxy.id ? <CheckIcon size={12} className="text-emerald-500" /> : <CopyIcon size={12} />}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {proxy.username ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                            <KeyIcon size={12} className="text-slate-400 dark:text-app-muted-2" />
                            {proxy.username}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-app-muted-2 italic">None (IP whitelist)</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-slate-500 dark:text-app-muted">{formatDate(proxy.created_at)}</span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {test && (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                test.testing
                                  ? 'bg-slate-100 dark:bg-app-surface-3 text-slate-600 dark:text-app-muted border-slate-200 dark:border-app-border'
                                  : test.success
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
                              }`}
                            >
                              {test.testing ? (
                                <>
                                  <span className="w-2.5 h-2.5 border-2 border-slate-300 border-t-brand-500 rounded-full animate-spin" />
                                  Pinging...
                                </>
                              ) : test.success ? (
                                <>
                                  <CheckIcon size={12} />
                                  {test.message || 'Online'}
                                </>
                              ) : (
                                <>
                                  <AlertIcon size={12} />
                                  Failed
                                </>
                              )}
                            </span>
                          )}

                          <button
                            onClick={() => handleTest(proxy.id)}
                            disabled={isTesting}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-app-surface-3 hover:bg-brand-500/15 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200/80 dark:border-app-border text-[11px] font-semibold text-slate-600 dark:text-app-muted transition-all active:scale-95 shadow-xs disabled:opacity-50"
                            title="Test proxy connectivity"
                          >
                            <RefreshIcon size={12} className={isTesting ? 'animate-spin' : ''} />
                            Check
                          </button>

                          <button
                            onClick={() => setFormModal({ mode: 'edit', id: proxy.id, proxy })}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-app-text hover:bg-slate-100 dark:hover:bg-app-surface-2 transition-all"
                            title="Edit proxy"
                          >
                            <PencilIcon size={14} />
                          </button>

                          <button
                            onClick={() => setDeleteTarget(proxy)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                            title="Delete proxy"
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {test && (test.cloudflare || test.countryMismatch) && (
                      <tr className="bg-amber-500/5 dark:bg-amber-500/10">
                        <td colSpan={7} className="px-5 py-2.5 border-b border-amber-500/15">
                          <div className="flex items-start gap-2 text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                            <AlertIcon size={14} className="shrink-0 mt-0.5" />
                            <span>
                              {test.warnings && test.warnings[0]
                                ? test.warnings[0]
                                : 'Proxy này đi qua Cloudflare (WARP/Workers): IP hiển thị 1.1.1.1 và quốc gia thường không phản ánh đúng proxy bạn đã mua (ví dụ gắn nhãn Hàn Quốc nhưng ra Cloudflare AU).'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating Multi-Select Capsule */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/90 dark:bg-app-surface/90 backdrop-blur-xl border border-slate-200/90 dark:border-brand-500/30 shadow-2xl shadow-slate-900/20 dark:shadow-black/70 animate-scale-in">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-app-border">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-900 dark:text-app-text">
              {selectedIds.length} Selected
            </span>
          </div>
          <button
            onClick={handleBulkDelete}
            className="btn-danger"
          >
            <TrashIcon size={14} />
            Delete
          </button>
          <button
            onClick={clearSelection}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-app-muted-2 dark:hover:text-app-text"
            title="Clear selection"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      {formModal && (
        <ProxyFormModal
          mode={formModal.mode}
          initial={formModal.proxy}
          onClose={() => setFormModal(null)}
          onSubmit={formModal.mode === 'edit' ? handleEdit : handleCreate}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          proxy={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}

      {showRulesModal && (
        <ProxyRulesModal
          isOpen={showRulesModal}
          onClose={() => setShowRulesModal(false)}
          onApplied={() => {
            refresh()
            setNotice({ type: 'success', text: 'Proxy rules successfully applied!' })
          }}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          isOpen={Boolean(confirmDialog)}
          title={confirmDialog.title}
          subtitle={confirmDialog.subtitle}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          loadingLabel={confirmDialog.loadingLabel}
          tone={confirmDialog.tone}
          onClose={() => setConfirmDialog(null)}
          onConfirm={confirmDialog.onConfirm}
        />
      )}
    </div>
  )
}

export default Proxies