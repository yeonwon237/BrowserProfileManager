import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({
  theme: 'dark',
  resolvedTheme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
})

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('yn_theme') || 'dark'
  })

  const [resolvedTheme, setResolvedTheme] = useState('dark')

  useEffect(() => {
    // Try to load persisted theme from SQLite settings if available
    if (window.electronAPI && window.electronAPI.getSetting) {
      window.electronAPI.getSetting('theme', 'dark').then((saved) => {
        if (saved && (saved === 'dark' || saved === 'light' || saved === 'system')) {
          setThemeState(saved)
        }
      }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    function applyTheme() {
      let isDark = true
      if (theme === 'system') {
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      } else {
        isDark = theme === 'dark'
      }

      const root = document.documentElement
      if (isDark) {
        root.classList.add('dark')
        root.style.colorScheme = 'dark'
      } else {
        root.classList.remove('dark')
        root.style.colorScheme = 'light'
      }
      setResolvedTheme(isDark ? 'dark' : 'light')
    }

    applyTheme()
    localStorage.setItem('yn_theme', theme)

    if (window.electronAPI && window.electronAPI.setSetting) {
      window.electronAPI.setSetting('theme', theme).catch(() => {})
    }

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme()
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
  }, [theme])

  const setTheme = (newTheme) => {
    if (['dark', 'light', 'system'].includes(newTheme)) {
      setThemeState(newTheme)
    }
  }

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
