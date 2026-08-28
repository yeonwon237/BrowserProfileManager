import { FolderIcon, FileIcon, CheckIcon } from './icons'

function Label({ field }) {
  return (
    <label className="block text-xs font-semibold text-slate-700 dark:text-app-muted mb-1.5">
      {field.label}
      {field.required && <span className="text-brand-500"> *</span>}
    </label>
  )
}

function PathPicker({ field, value, onChange }) {
  async function browse() {
    const picked = field.type === 'folder'
      ? await window.electronAPI.pickFolder(field.title || 'Select folder')
      : await window.electronAPI.pickFile(field.title || 'Select file')
    if (picked) onChange(picked)
  }

  return (
    <div className="flex gap-2">
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || (field.type === 'folder' ? 'Choose folder path...' : 'Choose file path...')}
        className="input flex-1 min-w-0"
      />
      <button
        type="button"
        onClick={browse}
        className="btn-secondary shrink-0"
      >
        {field.type === 'folder' ? <FolderIcon size={14} /> : <FileIcon size={14} />}
        Browse
      </button>
    </div>
  )
}

function DynamicForm({ schema = [], values = {}, onChange }) {
  function setValue(key, value) {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="space-y-4">
      {schema.map((field) => {
        const value = values[field.key]

        if (field.type === 'checkbox') {
          return (
            <div key={field.key} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <button
                  type="button"
                  onClick={() => setValue(field.key, !value)}
                  className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                    value ? 'bg-brand-600 border-brand-600 text-white shadow-sm' : 'border-slate-300 dark:border-app-border-light bg-white dark:bg-app-surface'
                  }`}
                >
                  {value && <CheckIcon size={12} className="stroke-[2.5]" />}
                </button>
                <span className="text-xs font-semibold text-slate-800 dark:text-app-text">{field.label}</span>
              </label>
              {field.hint && <p className="text-[11px] text-slate-400 dark:text-app-muted-2 mt-1.5 ml-7">{field.hint}</p>}
            </div>
          )
        }

        return (
          <div key={field.key}>
            <Label field={field} />
            {field.type === 'file' || field.type === 'folder' ? (
              <PathPicker field={field} value={value} onChange={(v) => setValue(field.key, v)} />
            ) : field.type === 'textarea' ? (
              <textarea
                value={value || ''}
                onChange={(e) => setValue(field.key, e.target.value)}
                rows={field.rows || 3}
                placeholder={field.placeholder || ''}
                className="input resize-none"
              />
            ) : field.type === 'select' ? (
              <select
                value={value || ''}
                onChange={(e) => setValue(field.key, e.target.value)}
                className="input cursor-pointer"
              >
                <option value="">{field.placeholder || 'Select option...'}</option>
                {(field.options || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === 'url' ? 'url' : field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : 'text'}
                value={value || ''}
                onChange={(e) => setValue(field.key, field.type === 'number' ? e.target.value : e.target.value)}
                placeholder={field.placeholder || ''}
                min={field.min}
                max={field.max}
                step={field.step}
                className="input"
              />
            )}
            {field.hint && <p className="text-[11px] text-slate-400 dark:text-app-muted-2 mt-1">{field.hint}</p>}
          </div>
        )
      })}
    </div>
  )
}

export default DynamicForm