import { useRef, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  SearchIcon,
  CloseIcon,
  UsersIcon,
  ZapIcon,
  GlobeIcon,
  ScrollIcon,
  SettingsIcon,
  SunIcon,
  MoonIcon,
  BellIcon,
  LayoutDashboardIcon,
  LayersIcon,
  MonitorIcon,
  ActivityIcon,
} from './icons'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import WorkspaceSelector from './WorkspaceSelector'
import GlobalSearchModal from './GlobalSearchModal'
import NotificationCenterModal from './NotificationCenterModal'

const pageMeta = {
  '/dashboard': {
    titleKey: 'dashboardTitle', subtitleKey: 'dashboardSubtitle',
    icon: LayoutDashboardIcon,
  },
  '/profiles': {
    titleKey: 'profilesTitle', subtitleKey: 'profilesSubtitle',
    icon: UsersIcon,
  },
  '/automation': {
    titleKey: 'automationTitle', subtitleKey: 'automationSubtitle',
    icon: ZapIcon,
  },
  '/proxies': {
    titleKey: 'proxiesTitle', subtitleKey: 'proxiesSubtitle',
    icon: GlobeIcon,
  },
  '/data-tools': {
    titleKey: 'dataToolsTitle', subtitleKey: 'dataToolsSubtitle',
    icon: LayersIcon,
  },
  '/extensions': {
    titleKey: 'extensionsTitle', subtitleKey: 'extensionsSubtitle',
    icon: LayersIcon,
  },
  '/synchronizer': {
    titleKey: 'synchronizerTitle', subtitleKey: 'synchronizerSubtitle',
    icon: MonitorIcon,
  },
  '/team-sync': {
    titleKey: 'teamSyncTitle', subtitleKey: 'teamSyncSubtitle',
    icon: ActivityIcon,
  },
  '/logs': {
    titleKey: 'logsTitle', subtitleKey: 'logsSubtitle',
    icon: ScrollIcon,
  },
  '/settings': {
    titleKey: 'settingsTitle', subtitleKey: 'settingsSubtitle',
    icon: SettingsIcon,
  },
}

function TopBar({ onSearch, search = '' }) {
  const { pathname } = useLocation()
  const meta = pageMeta[pathname] || pageMeta['/profiles']
  const Icon = meta.icon
  const inputRef = useRef(null)
  const { resolvedTheme, toggleTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const [showNotifCenter, setShowNotifCenter] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowGlobalSearch((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    let interval = null
    let unsubscribe = null
    const checkUnread = async () => {
      try {
        if (window.electronAPI && window.electronAPI.getNotifications) {
          const res = await window.electronAPI.getNotifications({ limit: 1 })
          if (res) setUnreadCount(res.unreadCount || 0)
        }
      } catch {}
    }
    checkUnread()
    interval = setInterval(checkUnread, 10000)
    if (window.electronAPI && window.electronAPI.onNotificationsChanged) {
      unsubscribe = window.electronAPI.onNotificationsChanged(checkUnread)
    }
    return () => {
      clearInterval(interval)
      if (unsubscribe) unsubscribe()
    }
  }, [])

  return (
    <header className="h-16 px-8 flex items-center justify-between border-b border-slate-200/80 dark:border-app-border bg-white/78 dark:bg-[#0d1526]/82 backdrop-blur-xl shrink-0 transition-colors duration-250 z-10 shadow-[0_8px_28px_-28px_rgba(15,23,42,0.6)]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-500/10 dark:bg-brand-500/15 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
          <Icon size={16} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-app-text tracking-tight flex items-center gap-2">
            {t(meta.titleKey)}
          </h2>
          <p className="text-[11px] text-slate-400 dark:text-app-muted-2 leading-none mt-0.5">
            {t(meta.subtitleKey)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <WorkspaceSelector />
        {pathname !== '/settings' && (
          <div className="relative group">
            <SearchIcon
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-app-muted-2 group-focus-within:text-brand-500 transition-colors pointer-events-none"
            />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => onSearch?.(e.target.value)}
              placeholder={t('search', { page: t(meta.titleKey).toLowerCase() })}
              className="w-64 pl-9 pr-14 py-2 rounded-xl bg-slate-100/80 dark:bg-app-bg border border-slate-200/80 dark:border-app-border text-xs text-slate-900 dark:text-app-text placeholder:text-slate-400 dark:placeholder:text-app-muted-2 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all shadow-inner"
            />
            {search ? (
              <button
                onClick={() => onSearch?.('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700 dark:text-app-muted-2 dark:hover:text-app-text"
              >
                <CloseIcon size={12} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowGlobalSearch(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 cursor-pointer hover:opacity-80"
                title={t('globalSearch')}
              >
                <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-app-surface border border-slate-200 dark:border-app-border text-[9px] font-mono font-semibold text-slate-400 dark:text-app-muted-2 shadow-xs">
                  Ctrl
                </kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-app-surface border border-slate-200 dark:border-app-border text-[9px] font-mono font-semibold text-slate-400 dark:text-app-muted-2 shadow-xs">
                  K
                </kbd>
              </button>
            )}
          </div>
        )}

        <button
          onClick={() => setShowNotifCenter(!showNotifCenter)}
          title={t('notificationCenter')}
          className="relative p-2 rounded-xl bg-slate-100/80 dark:bg-app-bg border border-slate-200/80 dark:border-app-border text-slate-500 dark:text-app-muted hover:text-slate-900 dark:hover:text-app-text hover:bg-slate-200/80 dark:hover:bg-app-surface-2 transition-all active:scale-95"
        >
          <BellIcon size={15} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-xs animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={toggleTheme}
          title={t('switchTheme', { theme: t(resolvedTheme === 'dark' ? 'light' : 'dark') })}
          className="p-2 rounded-xl bg-slate-100/80 dark:bg-app-bg border border-slate-200/80 dark:border-app-border text-slate-500 dark:text-app-muted hover:text-slate-900 dark:hover:text-app-text hover:bg-slate-200/80 dark:hover:bg-app-surface-2 transition-all active:scale-95"
        >
          {resolvedTheme === 'dark' ? (
            <SunIcon size={15} className="text-amber-400" />
          ) : (
            <MoonIcon size={15} className="text-slate-600" />
          )}
        </button>

        <div className="flex items-center p-0.5 rounded-xl bg-slate-100/80 dark:bg-app-bg border border-slate-200/80 dark:border-app-border">
          {[
            ['vi', 'VI', t('vietnamese')],
            ['en', 'EN', t('english')],
          ].map(([code, label, title]) => (
            <button
              key={code}
              type="button"
              onClick={() => setLanguage(code)}
              title={title}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-extrabold transition-all ${
                language === code
                  ? 'bg-white dark:bg-app-surface text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-400 dark:text-app-muted-2 hover:text-slate-700 dark:hover:text-app-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <GlobalSearchModal
        isOpen={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
      />

      <NotificationCenterModal
        isOpen={showNotifCenter}
        onClose={() => setShowNotifCenter(false)}
        onUnreadChanged={setUnreadCount}
      />
    </header>
  )
}

export default TopBar
