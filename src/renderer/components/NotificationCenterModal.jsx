import { useState, useEffect, useCallback } from 'react'
import {
  TrashIcon,
  SettingsIcon,
} from './icons'

export default function NotificationCenterModal({ isOpen, onClose, onUnreadChanged }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [settings, setSettings] = useState({
    notifyOnAutomationFailure: true,
    notifyOnBrowserCrash: true,
    notifyOnBackupFailure: true,
    notifyOnProxyFailure: true,
  })
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(true)

  const reloadData = useCallback(async () => {
    try {
      if (window.electronAPI) {
        if (window.electronAPI.getNotifications) {
          const res = await window.electronAPI.getNotifications({ limit: 40 })
          if (res) {
            setNotifications(res.notifications || [])
            setUnreadCount(res.unreadCount || 0)
            if (onUnreadChanged) onUnreadChanged(res.unreadCount || 0)
          }
        }
        if (window.electronAPI.getNotificationSettings) {
          const s = await window.electronAPI.getNotificationSettings()
          if (s) setSettings(s)
        }
      }
    } catch (err) {
      console.warn('Failed loading notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [onUnreadChanged])

  useEffect(() => {
    if (isOpen) reloadData()
  }, [isOpen, reloadData])

  // Keep the panel in sync with the app: whenever a notification is created,
  // read, or cleared in the main process, reload the visible list immediately.
  useEffect(() => {
    if (!window.electronAPI || !window.electronAPI.onNotificationsChanged) return undefined
    const unsubscribe = window.electronAPI.onNotificationsChanged(() => {
      if (isOpen) reloadData()
    })
    return unsubscribe
  }, [isOpen, reloadData])

  if (!isOpen) return null

  const handleMarkAllRead = async () => {
    if (window.electronAPI && window.electronAPI.markAllNotificationsRead) {
      await window.electronAPI.markAllNotificationsRead()
      reloadData()
    }
  }

  const handleClearAll = async () => {
    if (window.electronAPI && window.electronAPI.clearAllNotifications) {
      await window.electronAPI.clearAllNotifications()
      reloadData()
    }
  }

  const handleToggleSetting = async (key) => {
    const updated = { ...settings, [key]: !settings[key] }
    setSettings(updated)
    if (window.electronAPI && window.electronAPI.updateNotificationSettings) {
      await window.electronAPI.updateNotificationSettings(updated)
    }
  }

  const formatTimestamp = (val) => {
    if (!val) return '—'
    const d = new Date(val)
    return isNaN(d.getTime()) ? val : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end pt-16 pr-8 bg-black/30 backdrop-blur-2xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-app-surface rounded-2xl border border-slate-200 dark:border-app-border shadow-2xl w-96 overflow-hidden flex flex-col max-h-[80vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-app-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-app-text">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-brand-500 text-white text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings(!showSettings)}
              title="Notification Settings"
              className={`p-1.5 rounded-lg transition-colors ${
                showSettings
                  ? 'bg-brand-500/10 text-brand-600'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-app-text'
              }`}
            >
              <SettingsIcon size={14} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-app-text"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Settings Drawer */}
        {showSettings ? (
          <div className="p-4 bg-slate-50 dark:bg-app-surface-2/40 border-b border-slate-200 dark:border-app-border space-y-3 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Local Desktop Notification Rules
            </span>
            <div className="space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-700 dark:text-app-text">Automation Failures</span>
                <input
                  type="checkbox"
                  checked={settings.notifyOnAutomationFailure}
                  onChange={() => handleToggleSetting('notifyOnAutomationFailure')}
                  className="rounded text-brand-500 focus:ring-0 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-700 dark:text-app-text">Browser Crashes</span>
                <input
                  type="checkbox"
                  checked={settings.notifyOnBrowserCrash}
                  onChange={() => handleToggleSetting('notifyOnBrowserCrash')}
                  className="rounded text-brand-500 focus:ring-0 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-700 dark:text-app-text">Proxy Failures</span>
                <input
                  type="checkbox"
                  checked={settings.notifyOnProxyFailure}
                  onChange={() => handleToggleSetting('notifyOnProxyFailure')}
                  className="rounded text-brand-500 focus:ring-0 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-700 dark:text-app-text">Backup Failures</span>
                <input
                  type="checkbox"
                  checked={settings.notifyOnBackupFailure}
                  onChange={() => handleToggleSetting('notifyOnBackupFailure')}
                  className="rounded text-brand-500 focus:ring-0 cursor-pointer"
                />
              </label>
            </div>
          </div>
        ) : null}

        {/* Content list */}
        <div className="p-3 overflow-y-auto space-y-2 flex-1 text-xs">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-slate-200 dark:border-app-border-light border-t-brand-500 rounded-full animate-spin" />
              <span className="text-xs text-slate-400">Loading notifications...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-app-muted text-xs space-y-1">
              <p className="font-semibold text-slate-600 dark:text-app-text">No notifications</p>
              <p>Everything is running smoothly.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 rounded-xl border transition-all ${
                  n.is_read
                    ? 'bg-slate-50/50 dark:bg-app-surface-2/20 border-slate-200/60 dark:border-app-border/40 opacity-75'
                    : 'bg-white dark:bg-app-surface border-slate-200 dark:border-app-border shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        n.severity === 'error'
                          ? 'bg-rose-500'
                          : n.severity === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-sky-500'
                      }`}
                    />
                    <span className="font-bold text-slate-800 dark:text-app-text truncate">
                      {n.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {formatTimestamp(n.created_at)}
                  </span>
                </div>
                {n.message && (
                  <p className="text-[11px] text-slate-500 dark:text-app-muted mt-1 leading-relaxed">
                    {n.message}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-app-border flex items-center justify-between text-xs bg-slate-50/50 dark:bg-app-surface-2/20">
            <button
              onClick={handleMarkAllRead}
              className="text-brand-600 dark:text-brand-400 font-semibold hover:underline text-[11px]"
            >
              Mark all as read
            </button>
            <button
              onClick={handleClearAll}
              className="text-slate-400 hover:text-rose-500 transition-colors text-[11px] flex items-center gap-1"
            >
              <TrashIcon size={12} />
              <span>Clear all</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
