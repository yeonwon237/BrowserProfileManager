import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  MoreHorizontalIcon,
  PowerIcon,
  PencilIcon,
  CopyIcon,
  FolderIcon,
  TrashIcon,
  SparklesIcon,
  ActivityIcon,
  ShieldCheckIcon,
  GlobeIcon,
} from './icons'

function MenuItem({ icon: Icon, label, danger, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
        danger
          ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
          : 'text-slate-700 dark:text-app-text hover:bg-slate-100 dark:hover:bg-app-surface-3'
      }`}
    >
      <Icon size={14} className={danger ? 'text-rose-500' : 'text-slate-400 dark:text-app-muted'} />
      {label}
    </button>
  )
}

function ProfileMenu({ running, busy, onOpen, onClose, onEdit, onDuplicate, onCreateTemplate, onCookies, onTotp, onWarmup, onClearSession, onDiagnostics, onHealthCheck, onInspect, onAlignEnvironment, onMove, onDelete }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, right: 0 })
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!open || !buttonRef.current) return
    const updatePosition = () => {
      const rect = buttonRef.current.getBoundingClientRect()
      const menuHeight = 460
      const top = rect.bottom + menuHeight > window.innerHeight
        ? Math.max(8, rect.top - menuHeight - 6)
        : rect.bottom + 6
      setPosition({ top, right: Math.max(8, window.innerWidth - rect.right) })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  function closeAfter(fn) {
    return () => {
      setOpen(false)
      if (fn) fn()
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-xl text-slate-400 dark:text-app-muted-2 hover:text-slate-800 dark:hover:text-app-text hover:bg-slate-100 dark:hover:bg-app-surface-2 transition-all active:scale-95"
        title="More actions"
      >
        <MoreHorizontalIcon size={16} />
      </button>

      {open && (
        createPortal(<>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div style={{ top: position.top, right: position.right }} className="fixed z-50 w-64 max-h-[calc(100vh-16px)] overflow-y-auto rounded-2xl bg-white dark:bg-app-surface-2 border border-slate-200/90 dark:border-app-border shadow-xl dark:shadow-2xl dark:shadow-black/70 p-1.5 animate-scale-in">
            {busy ? (
              <div className="px-3 py-2.5 text-xs text-slate-500 dark:text-app-muted flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-slate-300 dark:border-app-border-light border-t-brand-500 rounded-full animate-spin" />
                Working...
              </div>
            ) : running ? (
              <MenuItem icon={PowerIcon} label="Close browser" onClick={closeAfter(onClose)} />
            ) : (
              <MenuItem icon={PowerIcon} label="Open profile" onClick={closeAfter(onOpen)} />
            )}
            <div className="my-1 border-t border-slate-100 dark:border-app-border" />
            <MenuItem icon={ShieldCheckIcon} label="Health pre-flight check" onClick={closeAfter(onHealthCheck)} />
            <MenuItem icon={ActivityIcon} label="Environment diagnostics" onClick={closeAfter(onDiagnostics)} />
            <MenuItem icon={GlobeIcon} label="Fingerprint & IP inspector" onClick={closeAfter(onInspect)} />
            <MenuItem icon={GlobeIcon} label="Align environment to proxy" onClick={closeAfter(onAlignEnvironment)} />
            <MenuItem icon={PencilIcon} label="Edit profile" onClick={closeAfter(onEdit)} />
            <MenuItem icon={CopyIcon} label="Duplicate profile..." onClick={closeAfter(onDuplicate)} />
            <MenuItem icon={SparklesIcon} label="Save as template..." onClick={closeAfter(onCreateTemplate)} />
            <MenuItem icon={FolderIcon} label="Manage cookies..." onClick={closeAfter(onCookies)} />
            <MenuItem icon={ShieldCheckIcon} label="2FA / OTP vault..." onClick={closeAfter(onTotp)} />
            <MenuItem icon={SparklesIcon} label="Profile warmup..." onClick={closeAfter(onWarmup)} />
            <MenuItem icon={SparklesIcon} label="Clear session cookies" onClick={closeAfter(onClearSession)} />
            <MenuItem icon={FolderIcon} label="Move to group" onClick={closeAfter(onMove)} />
            <div className="my-1 border-t border-slate-100 dark:border-app-border" />
            <MenuItem icon={TrashIcon} label="Delete profile" danger onClick={closeAfter(onDelete)} />
          </div>
        </>, document.body)
      )}
    </div>
  )
}

export default ProfileMenu
