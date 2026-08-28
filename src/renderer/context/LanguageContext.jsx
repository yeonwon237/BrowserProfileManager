import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import viPhrases from '../i18n/vi'

const textState = new WeakMap()
const attributeState = new WeakMap()

function translatePhrase(source) {
  const trimmed = source.trim()
  if (!trimmed) return source
  let translated = viPhrases[trimmed]
  if (!translated) {
    const rules = [
      [/^(\d+) profiles?$/i, '$1 hồ sơ'],
      [/^(\d+) proxies?$/i, '$1 proxy'],
      [/^(\d+) runs?$/i, '$1 lần chạy'],
      [/^(\d+) selected$/i, 'Đã chọn $1'],
      [/^Search (.+)\.\.\.$/i, 'Tìm kiếm $1...'],
      [/^Delete (.+)\?$/i, 'Xóa $1?'],
      [/^Create (.+)$/i, 'Tạo $1'],
      [/^Edit (.+)$/i, 'Chỉnh sửa $1'],
      [/^Loading (.+)\.\.\.$/i, 'Đang tải $1...'],
    ]
    for (const [pattern, replacement] of rules) {
      if (pattern.test(trimmed)) {
        translated = trimmed.replace(pattern, replacement)
        break
      }
    }
  }
  if (!translated) return source
  const leading = source.match(/^\s*/)?.[0] || ''
  const trailing = source.match(/\s*$/)?.[0] || ''
  return `${leading}${translated}${trailing}`
}

function translateTextNode(node, language) {
  const current = node.nodeValue || ''
  let state = textState.get(node)
  if (!state || current !== state.rendered) state = { source: current, rendered: current }
  const rendered = language === 'vi' ? translatePhrase(state.source) : state.source
  textState.set(node, { source: state.source, rendered })
  if (current !== rendered) node.nodeValue = rendered
}

function translateElement(element, language) {
  if (element.matches?.('script, style, code, pre, [data-no-translate]')) return
  const attributes = ['placeholder', 'title', 'aria-label']
  let states = attributeState.get(element) || {}
  attributes.forEach((name) => {
    if (!element.hasAttribute?.(name)) return
    const current = element.getAttribute(name)
    let state = states[name]
    if (!state || current !== state.rendered) state = { source: current, rendered: current }
    const rendered = language === 'vi' ? translatePhrase(state.source) : state.source
    states[name] = { source: state.source, rendered }
    if (current !== rendered) element.setAttribute(name, rendered)
  })
  attributeState.set(element, states)
  element.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) translateTextNode(child, language)
    else if (child.nodeType === Node.ELEMENT_NODE) translateElement(child, language)
  })
}

function translateDocument(language) {
  if (document.body) translateElement(document.body, language)
}

const messages = {
  en: {
    navigation: 'Navigation', dashboard: 'Dashboard', profiles: 'Profiles', automation: 'Automation',
    proxies: 'Proxies', extensions: 'Extensions', synchronizer: 'Synchronizer', teamSync: 'Team Sync', dataTools: 'Data Tools', logs: 'Logs', settings: 'Settings', browserHub: 'Browser Hub',
    localUser: 'Local User', ready: 'Ready', activeSessions: '{count} Active Session{suffix}',
    lightMode: 'Light mode', darkMode: 'Dark mode', systemDefault: 'System default',
    dashboardTitle: 'Dashboard', dashboardSubtitle: 'High-level multi-profile overview & operational metrics',
    profilesTitle: 'Profiles', profilesSubtitle: 'Manage isolated browser environments & persistent data',
    automationTitle: 'Automation Studio', automationSubtitle: 'Execute custom workflows & batch queue operations',
    proxiesTitle: 'Proxy Network', proxiesSubtitle: 'Route profiles through HTTP, HTTPS & SOCKS5 proxies',
    dataToolsTitle: 'Data Tools', dataToolsSubtitle: 'Bulk CSV / JSON profile import and safe configuration export',
    extensionsTitle: 'Extension Manager', extensionsSubtitle: 'Centrally register, verify and assign browser extensions',
    synchronizerTitle: 'Action Synchronizer', synchronizerSubtitle: 'Coordinate safe semantic actions across active profiles',
    teamSyncTitle: 'Team Sync', teamSyncSubtitle: 'End-to-end encrypted workspace configuration synchronization',
    logsTitle: 'Execution Logs', logsSubtitle: 'Debug history, error reports & captured screenshots',
    settingsTitle: 'System Settings', settingsSubtitle: 'App preferences, database snapshots & backups',
    search: 'Search {page}...', globalSearch: 'Open Global Search (Ctrl+K)', notificationCenter: 'Notification Center',
    switchTheme: 'Switch to {theme} mode', light: 'Light', dark: 'Dark', english: 'English', vietnamese: 'Tiếng Việt',
    language: 'Language', languageDescription: 'Choose the display language. Changes apply immediately and are remembered.',
  },
  vi: {
    navigation: 'Điều hướng', dashboard: 'Tổng quan', profiles: 'Hồ sơ', automation: 'Tự động hóa',
    proxies: 'Proxy', extensions: 'Tiện ích', synchronizer: 'Đồng bộ', teamSync: 'Đồng bộ nhóm', dataTools: 'Công cụ dữ liệu', logs: 'Nhật ký', settings: 'Cài đặt', browserHub: 'Trung tâm trình duyệt',
    localUser: 'Người dùng cục bộ', ready: 'Sẵn sàng', activeSessions: '{count} phiên đang chạy',
    lightMode: 'Giao diện sáng', darkMode: 'Giao diện tối', systemDefault: 'Theo hệ thống',
    dashboardTitle: 'Tổng quan', dashboardSubtitle: 'Tổng quan nhiều hồ sơ và các chỉ số vận hành',
    profilesTitle: 'Hồ sơ', profilesSubtitle: 'Quản lý môi trường trình duyệt tách biệt và dữ liệu lâu dài',
    automationTitle: 'Trung tâm tự động hóa', automationSubtitle: 'Chạy quy trình tùy chỉnh và hàng đợi hàng loạt',
    proxiesTitle: 'Mạng Proxy', proxiesSubtitle: 'Định tuyến hồ sơ qua proxy HTTP, HTTPS và SOCKS5',
    dataToolsTitle: 'Công cụ dữ liệu', dataToolsSubtitle: 'Nhập hàng loạt CSV/JSON và xuất cấu hình an toàn',
    extensionsTitle: 'Quản lý tiện ích', extensionsSubtitle: 'Đăng ký, xác minh và phân phối tiện ích trình duyệt tập trung',
    synchronizerTitle: 'Đồng bộ thao tác', synchronizerSubtitle: 'Điều phối thao tác ngữ nghĩa an toàn giữa các hồ sơ đang chạy',
    teamSyncTitle: 'Đồng bộ nhóm', teamSyncSubtitle: 'Đồng bộ cấu hình workspace với mã hóa đầu cuối',
    logsTitle: 'Nhật ký thực thi', logsSubtitle: 'Lịch sử gỡ lỗi, báo cáo lỗi và ảnh chụp màn hình',
    settingsTitle: 'Cài đặt hệ thống', settingsSubtitle: 'Tùy chọn ứng dụng, sao lưu và ảnh chụp cơ sở dữ liệu',
    search: 'Tìm trong {page}...', globalSearch: 'Mở tìm kiếm toàn cục (Ctrl+K)', notificationCenter: 'Trung tâm thông báo',
    switchTheme: 'Chuyển sang giao diện {theme}', light: 'sáng', dark: 'tối', english: 'English', vietnamese: 'Tiếng Việt',
    language: 'Ngôn ngữ', languageDescription: 'Chọn ngôn ngữ hiển thị. Thay đổi có hiệu lực ngay và được ghi nhớ.',
  },
}

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => localStorage.getItem('ynlogin.language') || 'vi')

  function setLanguage(next) {
    const safe = next === 'en' ? 'en' : 'vi'
    setLanguageState(safe)
    localStorage.setItem('ynlogin.language', safe)
    window.electronAPI?.setSetting?.('interface.language', safe).catch(() => {})
  }

  useEffect(() => {
    document.documentElement.lang = language
    translateDocument(language)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') translateTextNode(mutation.target, language)
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, language)
          else if (node.nodeType === Node.ELEMENT_NODE) translateElement(node, language)
        })
      })
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [language])

  const value = useMemo(() => ({
    language,
    setLanguage,
    t(key, values = {}) {
      let text = messages[language]?.[key] || messages.en[key] || key
      Object.entries(values).forEach(([name, value]) => {
        text = text.replaceAll(`{${name}}`, String(value))
      })
      return text
    },
  }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
