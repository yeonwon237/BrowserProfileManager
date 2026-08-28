import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { PlusIcon, AlertIcon } from './icons'
import { useWorkspace } from '../context/WorkspaceContext'

const ENGINES = [['chromium', 'Chromium'], ['chrome', 'Google Chrome'], ['msedge', 'Microsoft Edge'], ['firefox', 'Mozilla Firefox']]

export default function BulkCreateProfilesModal({ isOpen, onClose, templates = [], onCreated }) {
  const { workspaces, currentWorkspaceId } = useWorkspace()
  const [sourceMode, setSourceMode] = useState(templates.length ? 'template' : 'custom')
  const [templateId, setTemplateId] = useState(templates[0]?.id || '')
  const [namingMode, setNamingMode] = useState('pattern')
  const [count, setCount] = useState(10)
  const [namePattern, setNamePattern] = useState('Tài khoản-{number}')
  const [customNames, setCustomNames] = useState('')
  const [workspaceId, setWorkspaceId] = useState(currentWorkspaceId === 'all' ? 'default' : currentWorkspaceId)
  const [browserType, setBrowserType] = useState('chromium')
  const [groupName, setGroupName] = useState('')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')
  const [assignRandomProxy, setAssignRandomProxy] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const selectedTemplate = templates.find((template) => template.id === templateId)
  const namesFromList = useMemo(() => customNames.split(/\r?\n/).map((name) => name.trim()).filter(Boolean), [customNames])
  const preview = useMemo(() => {
    const total = namingMode === 'list' ? Math.max(1, namesFromList.length) : Math.max(1, Math.min(Number(count) || 1, 500))
    const pad = Math.max(3, String(total).length)
    const sample = Array.from({ length: Math.min(total, 5) }, (_, offset) => {
      const index = offset + 1
      if (namingMode === 'list') return namesFromList[offset] || `Hồ sơ ${index}`
      if (namingMode === 'random') return `${namePattern.replace(/\{number\}|\{index\}/gi, '').replace(/[-_ ]+$/g, '') || 'Hồ sơ'}-${Math.random().toString(16).slice(2, 10).toUpperCase()}`
      return namePattern.replace(/\{number\}/gi, String(index).padStart(pad, '0')).replace(/\{index\}/gi, String(index)).replace(/\{template\}/gi, selectedTemplate?.name || 'Hồ sơ')
    })
    return { sample, total }
  }, [count, namePattern, namingMode, namesFromList, selectedTemplate])

  if (!isOpen) return null

  async function handleSubmit(event) {
    event.preventDefault()
    if (sourceMode === 'template' && !templateId) return setError('Hãy chọn một mẫu hoặc chuyển sang cấu hình tùy chỉnh')
    if (namingMode === 'list' && !namesFromList.length) return setError('Hãy nhập ít nhất một tên hồ sơ')
    setLoading(true); setError(null)
    try {
      const result = await window.electronAPI.bulkCreateProfiles({
        templateId: sourceMode === 'template' ? templateId : null,
        count: Number(count), namingMode, namePattern, customNames: namesFromList, workspaceId, browserType,
        browserChannel: browserType === 'chrome' ? 'chrome' : browserType === 'msedge' ? 'msedge' : null,
        groupName: groupName.trim() || undefined, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        notes: notes.trim() || undefined, environment: { mode: 'default' },
        assignRandomProxy,
      })
      if (!result?.success) throw new Error('Không thể tạo hàng loạt hồ sơ')
      await onCreated?.(result.created); onClose()
    } catch (err) { setError(err.message || 'Không thể tạo hàng loạt hồ sơ') } finally { setLoading(false) }
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-app-surface rounded-3xl border border-slate-200 dark:border-app-border shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-app-border flex items-center justify-between">
        <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center"><PlusIcon size={16} /></div><div><h2 className="text-sm font-bold">Tạo hàng loạt hồ sơ</h2><p className="text-[11px] text-slate-400">Theo mẫu, tùy chỉnh, tuần tự, ngẫu nhiên hoặc danh sách riêng</p></div></div>
        <button onClick={onClose} className="p-1 text-slate-400">✕</button>
      </div>
      <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
        {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs flex gap-2"><AlertIcon size={14} />{error}</div>}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-app-bg">
          <button type="button" disabled={!templates.length} onClick={() => setSourceMode('template')} className={`px-3 py-2 rounded-lg text-xs font-bold ${sourceMode === 'template' ? 'bg-white dark:bg-app-surface text-brand-600 shadow-sm' : 'text-slate-500'} disabled:opacity-40`}>Dùng mẫu có sẵn</button>
          <button type="button" onClick={() => setSourceMode('custom')} className={`px-3 py-2 rounded-lg text-xs font-bold ${sourceMode === 'custom' ? 'bg-white dark:bg-app-surface text-brand-600 shadow-sm' : 'text-slate-500'}`}>Tự cấu hình</button>
        </div>
        {sourceMode === 'template'
          ? <label className="block text-xs font-semibold">Mẫu hồ sơ<select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="input w-full mt-1"><option value="">Chọn mẫu</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
          : <label className="block text-xs font-semibold">Bộ máy trình duyệt<select value={browserType} onChange={(e) => setBrowserType(e.target.value)} className="input w-full mt-1">{ENGINES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        <div><p className="text-xs font-semibold mb-1.5">Cách đặt tên</p><div className="grid grid-cols-3 gap-2">{[['pattern', 'Tuần tự'], ['random', 'Ngẫu nhiên'], ['list', 'Danh sách riêng']].map(([value, label]) => <button key={value} type="button" onClick={() => setNamingMode(value)} className={`px-3 py-2 rounded-xl border text-xs font-bold ${namingMode === value ? 'border-brand-500 bg-brand-500/10 text-brand-600' : 'border-slate-200 dark:border-app-border text-slate-500'}`}>{label}</button>)}</div></div>
        {namingMode === 'list'
          ? <label className="block text-xs font-semibold">Mỗi dòng là một tên hồ sơ<textarea value={customNames} onChange={(e) => setCustomNames(e.target.value)} rows={5} placeholder={'Tài khoản quảng cáo 01\nTài khoản quảng cáo 02'} className="input w-full mt-1 resize-y" /></label>
          : <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold">Số lượng<input type="number" min="1" max="500" value={count} onChange={(e) => setCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} className="input w-full mt-1" /></label><label className="text-xs font-semibold">Mẫu tên<input value={namePattern} onChange={(e) => setNamePattern(e.target.value)} className="input w-full mt-1" /></label></div>}
        <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold">Nhóm<input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ví dụ: Quảng cáo" className="input w-full mt-1" /></label><label className="text-xs font-semibold">Thẻ<input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="thẻ1, thẻ2" className="input w-full mt-1" /></label></div>
        <label className="block text-xs font-semibold">Không gian làm việc<select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="input w-full mt-1">{workspaces.filter((workspace) => !workspace.is_archived).map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></label>
        <label className="block text-xs font-semibold">Ghi chú chung<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input w-full mt-1 resize-y" /></label>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-app-border p-3 cursor-pointer hover:border-brand-500/50 transition-colors">
          <input type="checkbox" checked={assignRandomProxy} onChange={(e) => setAssignRandomProxy(e.target.checked)} className="mt-0.5 w-4 h-4 rounded accent-brand-600 cursor-pointer" />
          <span className="text-xs text-slate-700 dark:text-app-text"><b>Gán proxy ngẫu nhiên cho mỗi hồ sơ</b><span className="block text-[11px] text-slate-400 dark:text-app-muted-2 mt-0.5">Tạo một proxy placeholder riêng (host/port ngẫu nhiên) và gán cho từng hồ sơ. Thay bằng proxy thật trước khi dùng.</span></span>
        </label>
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-app-surface-2/40 border border-slate-200 dark:border-app-border"><p className="text-[11px] font-bold mb-2">Xem trước {preview.total} hồ sơ</p><div className="flex flex-wrap gap-1.5">{preview.sample.map((name, index) => <span key={`${name}-${index}`} className="px-2 py-1 rounded-lg bg-white dark:bg-app-surface border border-slate-200 dark:border-app-border text-[11px]">{name}</span>)}</div></div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-app-border"><button type="button" onClick={onClose} className="btn-secondary">Hủy</button><button type="submit" disabled={loading} className="btn-primary">{loading ? 'Đang tạo...' : `Tạo ${preview.total} hồ sơ`}</button></div>
      </form>
    </div>
  </div>,
    document.body
  )
}
