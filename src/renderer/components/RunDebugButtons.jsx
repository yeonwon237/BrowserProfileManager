import { useEffect, useState } from 'react'
import { ImageIcon, FolderIcon } from './icons'

function RunDebugButtons({ runId, size = 'sm' }) {
  const [hasShot, setHasShot] = useState(false)

  useEffect(() => {
    if (!runId) return
    window.electronAPI.getRun(runId).then((run) => {
      setHasShot(Boolean(run && run.screenshot_path))
    }).catch(() => {})
  }, [runId])

  if (!runId) return null

  const btnClass =
    size === 'sm'
      ? 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-app-surface-3 hover:bg-brand-500/15 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200/80 dark:border-app-border text-[11px] font-semibold text-slate-600 dark:text-app-muted transition-all active:scale-95 shadow-xs'
      : 'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-app-surface-3 hover:bg-brand-500/15 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200/80 dark:border-app-border text-xs font-semibold text-slate-700 dark:text-app-text transition-all active:scale-95 shadow-xs'

  return (
    <div className="flex items-center gap-1.5">
      {hasShot && (
        <button
          className={btnClass}
          onClick={() => window.electronAPI.openRunScreenshot(runId)}
          title="Open captured error screenshot"
        >
          <ImageIcon size={size === 'sm' ? 12 : 14} className="text-amber-500" />
          Screenshot
        </button>
      )}
      <button
        className={btnClass}
        onClick={() => window.electronAPI.openRunLogs(runId)}
        title="Open run logs folder on disk"
      >
        <FolderIcon size={size === 'sm' ? 12 : 14} className="text-slate-400 dark:text-app-muted" />
        Logs
      </button>
    </div>
  )
}

export default RunDebugButtons
