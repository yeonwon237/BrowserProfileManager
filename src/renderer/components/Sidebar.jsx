import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  UsersIcon,
  ZapIcon,
  GlobeIcon,
  ScrollIcon,
  SettingsIcon,
  LayersIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  ActivityIcon,
  LayoutDashboardIcon,
} from './icons'
import BrandMark from './BrandMark'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'

const navItems = [
  { path: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboardIcon },
  { path: '/profiles', labelKey: 'profiles', icon: UsersIcon },
  { path: '/automation', labelKey: 'automation', icon: ZapIcon },
  { path: '/synchronizer', labelKey: 'synchronizer', icon: MonitorIcon },
  { path: '/team-sync', labelKey: 'teamSync', icon: ActivityIcon },
  { path: '/proxies', labelKey: 'proxies', icon: GlobeIcon },
  { path: '/extensions', labelKey: 'extensions', icon: LayersIcon },
  { path: '/data-tools', labelKey: 'dataTools', icon: LayersIcon },
  { path: '/logs', labelKey: 'logs', icon: ScrollIcon },
  { path: '/settings', labelKey: 'settings', icon: SettingsIcon },
]

function Logo() {
  const { t } = useLanguage()
  return (
    <div className="flex items-center gap-3.5 px-6 py-5 border-b border-slate-200/60 dark:border-app-border/70">
      <div className="relative group cursor-default">
        <BrandMark size={38} className="drop-shadow-lg transition-transform duration-300 group-hover:scale-105" />
        <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-400 opacity-25 blur-sm -z-10 group-hover:opacity-50 transition-opacity" />
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <h1 data-no-translate className="text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-app-text">
            YN<span className="text-brand-500">login</span>
          </h1>
          <span className="px-1.5 py-0.2 rounded-md bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 font-mono text-[9px] font-bold tracking-wider">
            PRO
          </span>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-app-muted-2 font-medium tracking-wider uppercase">
          {t('browserHub')}
        </p>
      </div>
    </div>
  )
}

function RunningWidget() {
  const { t } = useLanguage()
  const [runningCount, setRunningCount] = useState(0)

  useEffect(() => {
    let disposed = false
    function checkRunning() {
      if (window.electronAPI && window.electronAPI.getRunningProfiles) {
        window.electronAPI.getRunningProfiles().then((list) => {
          if (!disposed) setRunningCount((list || []).length)
        }).catch(() => {})
      }
    }
    checkRunning()
    const interval = setInterval(checkRunning, 3000)

    let unsubscribe = null
    if (window.electronAPI && window.electronAPI.onProfileStatusChanged) {
      unsubscribe = window.electronAPI.onProfileStatusChanged(() => {
        checkRunning()
      })
    }

    return () => {
      disposed = true
      clearInterval(interval)
      if (unsubscribe) unsubscribe()
    }
  }, [])

  if (runningCount === 0) return null

  return (
    <div className="mx-3 my-2 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between animate-fade-in">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          {t('activeSessions', { count: runningCount, suffix: runningCount > 1 ? 's' : '' })}
        </span>
      </div>
      <ActivityIcon size={14} className="text-emerald-500 animate-pulse" />
    </div>
  )
}

function ThemeToggleMini() {
  const { theme, setTheme } = useTheme()
  const { t } = useLanguage()

  const modes = [
    { key: 'light', icon: SunIcon, title: t('lightMode') },
    { key: 'system', icon: MonitorIcon, title: t('systemDefault') },
    { key: 'dark', icon: MoonIcon, title: t('darkMode') },
  ]

  return (
    <div className="flex items-center bg-slate-100 dark:bg-app-surface-2 p-0.5 rounded-lg border border-slate-200/80 dark:border-app-border">
      {modes.map((m) => {
        const Icon = m.icon
        const isActive = theme === m.key
        return (
          <button
            key={m.key}
            onClick={() => setTheme(m.key)}
            title={m.title}
            className={`p-1.5 rounded-md transition-all ${
              isActive
                ? 'bg-white dark:bg-app-surface text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-400 dark:text-app-muted-2 hover:text-slate-700 dark:hover:text-app-text'
            }`}
          >
            <Icon size={13} />
          </button>
        )
      })}
    </div>
  )
}

function Sidebar() {
  const { t } = useLanguage()
  return (
    <aside className="relative z-20 w-64 h-full bg-white/95 dark:bg-[#0d1526]/95 backdrop-blur-xl border-r border-slate-200/80 dark:border-app-border flex flex-col shrink-0 transition-colors duration-250 select-none shadow-[8px_0_32px_-28px_rgba(15,23,42,0.5)] dark:shadow-[10px_0_36px_-28px_rgba(0,0,0,0.9)]">
      <Logo />

      <RunningWidget />

      <div className="px-5 mt-4 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-app-muted-2">
          {t('navigation')}
        </p>
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-3 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group relative flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-500/10 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/20 shadow-sm shadow-brand-500/5 font-bold'
                    : 'text-slate-500 dark:text-app-muted border border-transparent hover:bg-slate-100 dark:hover:bg-app-surface-2 hover:text-slate-900 dark:hover:text-app-text'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={17}
                    className={`transition-colors duration-200 ${
                      isActive
                        ? 'text-brand-600 dark:text-brand-400'
                        : 'text-slate-400 dark:text-app-muted-2 group-hover:text-slate-700 dark:group-hover:text-app-text'
                    }`}
                  />
                  <span>{t(item.labelKey)}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500 shadow-glow-brand" />
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="p-3 border-t border-slate-200/80 dark:border-app-border/80 bg-slate-50/50 dark:bg-app-surface-2/30">
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white dark:bg-app-surface border border-slate-200/80 dark:border-app-border shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-[11px] font-extrabold text-white shadow-sm shrink-0">
              YN
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-800 dark:text-app-text truncate">
                {t('localUser')}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <p className="text-[10px] text-slate-400 dark:text-app-muted-2 font-medium">{t('ready')}</p>
              </div>
            </div>
          </div>
          <ThemeToggleMini />
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
