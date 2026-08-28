import { useState, useEffect } from 'react'
import {
  DownloadIcon,
  UploadIcon,
  DatabaseIcon,
  AlertIcon,
  CheckIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  ShieldCheckIcon,
  ExternalLinkIcon,
  SparklesIcon,
  ActivityIcon,
  PlusIcon,
  PencilIcon,
  CopyIcon,
  TrashIcon,
  RefreshIcon,
  ChromiumIcon,
  ChromeIcon,
  EdgeIcon,
  FirefoxIcon,
  GlobeIcon,
} from '../components/icons'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import PresetFormModal from '../components/PresetFormModal'
import PortabilitySection from '../components/PortabilitySection'

function Section({ title, description, children, icon: Icon, action }) {
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="w-9 h-9 rounded-2xl bg-brand-500/10 dark:bg-brand-500/15 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0">
              <Icon size={18} />
            </div>
          )}
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-app-text">{title}</h3>
            {description && (
              <p className="text-xs text-slate-400 dark:text-app-muted-2 mt-0.5 leading-relaxed">{description}</p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="pt-2">{children}</div>
    </div>
  )
}

function Notice({ type, children }) {
  return (
    <div
      className={`px-4 py-3 rounded-2xl border text-xs font-semibold flex items-center gap-2 animate-fade-in ${
        type === 'error'
          ? 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'
          : type === 'warning'
          ? 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
          : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
      }`}
    >
      {type === 'error' ? <AlertIcon size={15} /> : type === 'warning' ? <AlertIcon size={15} /> : <CheckIcon size={15} />}
      <span>{children}</span>
    </div>
  )
}

function ThemeCard({ value, label, subtitle, icon: Icon, isSelected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex-1 p-4 rounded-2xl border text-left flex flex-col justify-between transition-all duration-200 active:scale-98 relative group ${
        isSelected
          ? 'bg-white dark:bg-app-surface border-brand-500 ring-2 ring-brand-500/20 shadow-md'
          : 'bg-slate-50/70 dark:bg-app-bg border-slate-200/80 dark:border-app-border hover:border-slate-300 dark:hover:border-app-border-light'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-transform duration-200 group-hover:scale-105 ${
            isSelected
              ? 'bg-brand-500 text-white border-brand-600 shadow-sm shadow-brand-500/30'
              : 'bg-white dark:bg-app-surface text-slate-500 dark:text-app-muted border-slate-200 dark:border-app-border'
          }`}
        >
          <Icon size={18} />
        </div>
        <div
          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
            isSelected
              ? 'border-brand-500 bg-brand-500 text-white'
              : 'border-slate-300 dark:border-app-border-light'
          }`}
        >
          {isSelected && <CheckIcon size={10} className="stroke-[3]" />}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-slate-900 dark:text-app-text">{label}</p>
        <p className="text-[11px] text-slate-400 dark:text-app-muted-2 mt-0.5">{subtitle}</p>
      </div>
    </button>
  )
}

function Settings() {
  const { theme, setTheme, effectiveTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const [includeBrowserData, setIncludeBrowserData] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [presets, setPresets] = useState([])
  const [presetModal, setPresetModal] = useState(null)

  const [browsers, setBrowsers] = useState([])
  const [browserBusy, setBrowserBusy] = useState(false)
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [customForm, setCustomForm] = useState({ name: '', browser_type: 'chromium', executable_path: '' })
  const [safeStartup, setSafeStartup] = useState(false)
  const [resource, setResource] = useState(null)
  const [maxBrowsers, setMaxBrowsers] = useState(5)
  const [maxAutomations, setMaxAutomations] = useState(3)
  const [memThreshold, setMemThreshold] = useState(85)
  const [lowResource, setLowResource] = useState(false)
  const [versions, setVersions] = useState(null)
  const [windowLayout, setWindowLayout] = useState({
    enabled: true,
    width: 900,
    height: 700,
    gapX: 12,
    gapY: 12,
    columns: 0,
    offsetX: 0,
    offsetY: 0,
  })
  const [homepageEnabled, setHomepageEnabled] = useState(true)
  const [homepageUrl, setHomepageUrl] = useState('https://iphey.com/')

  const [leakProtection, setLeakProtection] = useState(true)
  const [proxyKillSwitch, setProxyKillSwitch] = useState(true)
  const [automationGuard, setAutomationGuard] = useState(true)
  const [directHostIp, setDirectHostIp] = useState(null)

  function showNotice(type, text) {
    setNotice({ type, text })
    setTimeout(() => setNotice(null), 4000)
  }

  async function loadSettings() {
    if (!window.electronAPI) return
    try {
      const lp = await window.electronAPI.getSetting('leakProtectionEnabled', 'true')
      const ks = await window.electronAPI.getSetting('proxyKillSwitchEnabled', 'true')
      const ag = await window.electronAPI.getSetting('automationLeakGuardEnabled', 'true')
      const layoutRaw = await window.electronAPI.getSetting('browser.windowLayout', '')
      setLeakProtection(lp !== 'false' && lp !== '0')
      setProxyKillSwitch(ks !== 'false' && ks !== '0')
      setAutomationGuard(ag !== 'false' && ag !== '0')
      const homepageEnabledRaw = await window.electronAPI.getSetting('browser.homepageEnabled', 'true')
      const homepageUrlRaw = await window.electronAPI.getSetting('browser.homepageUrl', 'https://iphey.com/')
      setHomepageEnabled(homepageEnabledRaw !== 'false' && homepageEnabledRaw !== '0')
      if (homepageUrlRaw) setHomepageUrl(homepageUrlRaw)
      if (layoutRaw) {
        try {
          setWindowLayout((current) => ({ ...current, ...JSON.parse(layoutRaw) }))
        } catch {
          // Keep safe defaults if an older setting is malformed.
        }
      }

      if (window.electronAPI.getDirectHostIp) {
        const ip = await window.electronAPI.getDirectHostIp()
        setDirectHostIp(ip)
      }
    } catch {}
  }

  async function updateLeakProtection(val) {
    setLeakProtection(val)
    await window.electronAPI.setSetting('leakProtectionEnabled', String(val))
    showNotice('success', `WebRTC Leak Protection ${val ? 'enabled' : 'disabled'}`)
  }

  async function updateProxyKillSwitch(val) {
    setProxyKillSwitch(val)
    await window.electronAPI.setSetting('proxyKillSwitchEnabled', String(val))
    showNotice('success', `Proxy Kill-Switch ${val ? 'armed (Fail-Closed)' : 'disabled'}`)
  }

  async function updateAutomationGuard(val) {
    setAutomationGuard(val)
    await window.electronAPI.setSetting('automationLeakGuardEnabled', String(val))
    showNotice('success', `Fail-Closed Automation Leak Guard ${val ? 'active' : 'disabled'}`)
  }

  async function saveWindowLayout(next = windowLayout) {
    const sanitized = {
      enabled: next.enabled !== false,
      width: Math.min(3840, Math.max(480, Number(next.width) || 900)),
      height: Math.min(2160, Math.max(360, Number(next.height) || 700)),
      gapX: Math.min(500, Math.max(0, Number(next.gapX) || 0)),
      gapY: Math.min(500, Math.max(0, Number(next.gapY) || 0)),
      columns: Math.min(20, Math.max(0, Number(next.columns) || 0)),
      offsetX: Math.min(3000, Math.max(0, Number(next.offsetX) || 0)),
      offsetY: Math.min(2000, Math.max(0, Number(next.offsetY) || 0)),
    }
    setWindowLayout(sanitized)
    await window.electronAPI.setSetting('browser.windowLayout', JSON.stringify(sanitized))
    showNotice('success', 'Browser window arrangement saved')
  }

  function setLayoutField(key, value) {
    setWindowLayout((current) => ({ ...current, [key]: value }))
  }

  async function saveHomepage() {
    await window.electronAPI.setSetting('browser.homepageEnabled', String(homepageEnabled))
    await window.electronAPI.setSetting('browser.homepageUrl', homepageUrl.trim() || 'https://iphey.com/')
    showNotice('success', homepageEnabled ? `Profiles will open ${homepageUrl.trim() || 'https://iphey.com/'}` : 'Profiles will open a blank tab')
  }

  async function loadPresets() {
    if (window.electronAPI && window.electronAPI.getPresets) {
      try {
        const list = await window.electronAPI.getPresets()
        setPresets(list || [])
      } catch (err) {
        // ignore
      }
    }
  }

  useEffect(() => {
    loadPresets()
    loadSettings()
    loadBrowsers()
    loadSafeStartup()
    loadResource()
    loadVersions()
  }, [])

  async function loadVersions() {
    if (window.electronAPI && window.electronAPI.getAppVersions) {
      try {
        const v = await window.electronAPI.getAppVersions()
        setVersions(v)
      } catch {
        // ignore
      }
    }
  }

  async function loadResource() {
    if (window.electronAPI && window.electronAPI.getResourceStatus) {
      try {
        const status = await window.electronAPI.getResourceStatus()
        setResource(status)
        setMaxBrowsers(status.maxBrowsers)
        setMaxAutomations(status.maxAutomations)
        setMemThreshold(status.memoryWarningThresholdPercent)
        setLowResource(status.lowResourceMode)
      } catch {
        // ignore
      }
    }
  }

  async function saveMaxBrowsers(n) {
    const v = Number(n)
    if (!v || v < 1) return
    await window.electronAPI.setMaxBrowsers(v)
    showNotice('success', `Maximum concurrent browsers set to ${v}`)
    loadResource()
  }

  async function saveMaxAutomations(n) {
    const v = Number(n)
    if (!v || v < 1) return
    await window.electronAPI.setMaxAutomations(v)
    showNotice('success', `Maximum concurrent automations set to ${v}`)
    loadResource()
  }

  async function saveMemThreshold(n) {
    const v = Number(n)
    if (!v || v < 10 || v > 100) return
    await window.electronAPI.setMemoryThreshold(v)
    showNotice('success', `Memory warning threshold set to ${v}%`)
    loadResource()
  }

  async function toggleLowResource(val) {
    setLowResource(val)
    await window.electronAPI.setLowResourceMode(val)
    showNotice('success', `Low Resource Mode ${val ? 'enabled' : 'disabled'}`)
    loadResource()
  }

  async function loadSafeStartup() {
    if (window.electronAPI && window.electronAPI.getSafeStartupMode) {
      try {
        const val = await window.electronAPI.getSafeStartupMode()
        setSafeStartup(Boolean(val))
      } catch {
        // ignore
      }
    }
  }

  async function toggleSafeStartup(val) {
    setSafeStartup(val)
    if (window.electronAPI && window.electronAPI.setSafeStartupMode) {
      await window.electronAPI.setSafeStartupMode(val)
    }
    showNotice('success', `Safe Startup Mode ${val ? 'enabled' : 'disabled'}`)
  }

  async function loadBrowsers() {
    if (window.electronAPI && window.electronAPI.getBrowsers) {
      try {
        const list = await window.electronAPI.getBrowsers()
        setBrowsers(list || [])
      } catch (err) {
        // ignore
      }
    }
  }

  async function handleScanBrowsers() {
    setBrowserBusy(true)
    try {
      await window.electronAPI.scanBrowsers({ probeVersions: true })
      await window.electronAPI.refreshBrowserStatuses()
      showNotice('success', 'Browser scan complete — binaries detected and statuses updated')
    } catch (err) {
      showNotice('error', err.message || 'Browser scan failed')
    } finally {
      setBrowserBusy(false)
      loadBrowsers()
    }
  }

  async function handleRefreshBrowsers() {
    setBrowserBusy(true)
    try {
      const list = await window.electronAPI.getBrowsers()
      for (const b of list) {
        await window.electronAPI.checkBrowser(b.id).catch(() => {})
      }
      await window.electronAPI.refreshBrowserStatuses()
      showNotice('success', 'Browser records refreshed')
    } catch (err) {
      showNotice('error', err.message || 'Refresh failed')
    } finally {
      setBrowserBusy(false)
      loadBrowsers()
    }
  }

  async function handlePickCustomPath() {
    if (!window.electronAPI.pickFile) return
    const filters = [{ name: 'Browser executable', extensions: ['exe', 'app'] }]
    const p = await window.electronAPI.pickFile('Select browser executable', filters)
    if (p) setCustomForm((f) => ({ ...f, executable_path: p }))
  }

  async function handleAddCustomBrowser(e) {
    e.preventDefault()
    if (!customForm.executable_path.trim()) {
      showNotice('error', 'Please choose a browser executable path')
      return
    }
    setBrowserBusy(true)
    try {
      await window.electronAPI.addCustomBrowser(customForm)
      await window.electronAPI.refreshBrowserStatuses()
      showNotice('success', 'Custom browser added')
      setShowAddCustom(false)
      setCustomForm({ name: '', browser_type: 'chromium', executable_path: '' })
    } catch (err) {
      showNotice('error', err.message || 'Failed to add custom browser')
    } finally {
      setBrowserBusy(false)
      loadBrowsers()
    }
  }

  async function handleRemoveCustomBrowser(binary) {
    if (!window.confirm(`Remove custom browser record "${binary.name}" from the app? The executable itself will not be deleted.`)) return
    try {
      const res = await window.electronAPI.removeCustomBrowser(binary.id)
      if (!res.success) throw new Error(res.error || 'Remove failed')
      showNotice('success', `Removed custom browser "${binary.name}"`)
    } catch (err) {
      showNotice('error', err.message || 'Remove failed')
    }
    loadBrowsers()
  }


  async function handleCreateOrUpdatePreset(payload) {
    if (presetModal.mode === 'edit') {
      await window.electronAPI.updatePreset(presetModal.preset.id, payload)
      showNotice('success', `Preset "${payload.name}" updated successfully`)
    } else {
      await window.electronAPI.createPreset(payload)
      showNotice('success', `Preset "${payload.name}" created successfully`)
    }
    loadPresets()
  }

  async function handleDuplicatePreset(preset) {
    try {
      await window.electronAPI.duplicatePreset(preset.id, {})
      showNotice('success', `Duplicated preset "${preset.name}"`)
      loadPresets()
    } catch (err) {
      showNotice('error', err.message || 'Failed to duplicate preset')
    }
  }

  async function handleDeletePreset(preset) {
    if (!window.confirm(`Delete preset "${preset.name}"?`)) return
    try {
      await window.electronAPI.deletePreset(preset.id)
      showNotice('success', `Deleted preset "${preset.name}"`)
      loadPresets()
    } catch (err) {
      showNotice('error', err.message || 'Failed to delete preset')
    }
  }

  async function handleExport() {
    setBusy(true)
    try {
      const result = await window.electronAPI.exportBackup({ includeBrowserData })
      if (result.canceled) return
      showNotice(
        'success',
        `Backup archive saved successfully (${Math.round((result.fileSize || 0) / 1024)} KB, ${result.counts.profiles} profiles, ${result.counts.automations} tools)`
      )
    } catch (err) {
      showNotice('error', err.message || 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    setBusy(true)
    try {
      const picked = await window.electronAPI.pickImportBackup()
      if (picked.canceled) return
      const report = await window.electronAPI.importBackup(picked.path)
      if (!report.success) {
        showNotice('error', report.error || 'Import failed')
        return
      }
      const renamedCount = (report.profilesRenamed || 0) + (report.proxiesRenamed || 0)
      let text = `Imported: ${report.profilesImported} profiles, ${report.proxiesImported} proxies, ${report.toolsImported} tools`
      if (renamedCount > 0) text += ` (${renamedCount} name collisions resolved)`
      showNotice('success', text)
    } catch (err) {
      showNotice('error', err.message || 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleBackupDb() {
    setBusy(true)
    try {
      const result = await window.electronAPI.backupDatabase()
      showNotice('success', `Database snapshot saved (${Math.round((result.size || 0) / 1024)} KB)`)
    } catch (err) {
      showNotice('error', err.message || 'Database snapshot failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-8 py-7 max-w-4xl mx-auto space-y-6">
      {notice && <Notice type={notice.type}>{notice.text}</Notice>}

      <Section title={t('language')} description={t('languageDescription')} icon={GlobeIcon}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {[
            ['vi', '🇻🇳', t('vietnamese'), 'Giao diện tiếng Việt'],
            ['en', '🇬🇧', t('english'), 'English interface'],
          ].map(([code, flag, label, subtitle]) => (
            <button
              key={code}
              type="button"
              onClick={() => setLanguage(code)}
              className={`p-4 rounded-2xl border flex items-center gap-3 text-left transition-all ${
                language === code
                  ? 'bg-brand-500/10 border-brand-500 ring-2 ring-brand-500/15'
                  : 'bg-slate-50 dark:bg-app-bg border-slate-200/80 dark:border-app-border hover:border-slate-300'
              }`}
            >
              <span className="text-2xl" aria-hidden="true">{flag}</span>
              <span className="flex-1">
                <span className="block text-xs font-bold text-slate-900 dark:text-app-text">{label}</span>
                <span className="block text-[11px] text-slate-400 dark:text-app-muted-2 mt-0.5">{subtitle}</span>
              </span>
              {language === code && <CheckIcon size={16} className="text-brand-500" />}
            </button>
          ))}
        </div>
      </Section>

      {/* Theme Customization Section */}
      <Section
        title="Interface Theme & Appearance"
        description="Choose your preferred visual style or sync automatically with your operating system preference."
        icon={SparklesIcon}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <ThemeCard
            value="dark"
            label="Dark Theme"
            subtitle="Deep luxury blacks & glow accents"
            icon={MoonIcon}
            isSelected={theme === 'dark'}
            onSelect={setTheme}
          />
          <ThemeCard
            value="light"
            label="Light Theme"
            subtitle="Clean crisp white & subtle slate"
            icon={SunIcon}
            isSelected={theme === 'light'}
            onSelect={setTheme}
          />
          <ThemeCard
            value="system"
            label="System Sync"
            subtitle={`Auto-detect (${effectiveTheme === 'dark' ? 'Dark' : 'Light'})`}
            icon={MonitorIcon}
            isSelected={theme === 'system'}
            onSelect={setTheme}
          />
        </div>
      </Section>

      {/* Network Privacy & Leak Shield Section */}
      <Section

        title="Network Privacy & Leak Shield"
        description="Configure anti-leak protections: WebRTC candidate filtering, proxy kill-switch (fail-closed routing), and automation real-IP leak guards."
        icon={ShieldCheckIcon}
      >
        <div className="space-y-3">
          <label className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border cursor-pointer select-none">
            <button
              type="button"
              onClick={() => updateLeakProtection(!leakProtection)}
              className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                leakProtection
                  ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                  : 'border-slate-300 dark:border-app-border-light bg-white dark:bg-app-surface'
              }`}
            >
              {leakProtection && <CheckIcon size={12} className="stroke-[2.5]" />}
            </button>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-app-text">
                WebRTC IP Leak Protection
              </p>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
                Drops private LAN host candidates and rewrites SDP to prevent revealing local interface IPs via WebRTC STUN/TURN.
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border cursor-pointer select-none">
            <button
              type="button"
              onClick={() => updateProxyKillSwitch(!proxyKillSwitch)}
              className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                proxyKillSwitch
                  ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                  : 'border-slate-300 dark:border-app-border-light bg-white dark:bg-app-surface'
              }`}
            >
              {proxyKillSwitch && <CheckIcon size={12} className="stroke-[2.5]" />}
            </button>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-app-text">
                Proxy Kill-Switch (Fail-Closed Mode)
              </p>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
                Hard-locks browser traffic to the assigned proxy. If the proxy fails or disconnects, network requests are blocked instead of falling back to direct connection.
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border cursor-pointer select-none">
            <button
              type="button"
              onClick={() => updateAutomationGuard(!automationGuard)}
              className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                automationGuard
                  ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                  : 'border-slate-300 dark:border-app-border-light bg-white dark:bg-app-surface'
              }`}
            >
              {automationGuard && <CheckIcon size={12} className="stroke-[2.5]" />}
            </button>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-app-text">
                Fail-Closed Automation Leak Guard
              </p>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
                Automatically verifies network privacy before executing automation scripts. If real-IP leakage is detected, aborts execution immediately.
              </p>
            </div>
          </label>

          {directHostIp && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/60 dark:border-app-border flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-app-muted font-medium">Direct Host Machine IP:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{directHostIp}</span>
            </div>
          )}
        </div>
      </Section>

      {/* Environment Presets Template Library */}

      <Section
        title="Environment Presets Template Library"
        description="Manage reusable configuration templates for browser profiles (locales, timezones, resolutions, color themes)."
        icon={MonitorIcon}
        action={
          <button
            type="button"
            onClick={() => setPresetModal({ mode: 'create' })}
            className="btn-secondary text-xs"
          >
            <PlusIcon size={13} />
            New Preset
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border flex flex-col justify-between gap-3 group hover:border-slate-300 dark:hover:border-app-border-light transition-all"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-app-text">
                      {preset.name}
                    </span>
                    {preset.is_default && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setPresetModal({ mode: 'edit', preset })}
                      className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-app-surface-2 text-slate-500 hover:text-slate-900 dark:hover:text-app-text"
                      title="Edit preset"
                    >
                      <PencilIcon size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicatePreset(preset)}
                      className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-app-surface-2 text-slate-500 hover:text-slate-900 dark:hover:text-app-text"
                      title="Duplicate preset"
                    >
                      <CopyIcon size={12} />
                    </button>
                    {!preset.is_default && (
                      <button
                        type="button"
                        onClick={() => handleDeletePreset(preset)}
                        className="p-1 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-500"
                        title="Delete preset"
                      >
                        <TrashIcon size={12} />
                      </button>
                    )}
                  </div>
                </div>
                {preset.description && (
                  <p className="text-[11px] text-slate-400 dark:text-app-muted-2 mt-1 line-clamp-2">
                    {preset.description}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200/60 dark:border-app-border text-[10px] font-semibold text-slate-500 dark:text-app-muted">
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-app-surface border border-slate-200/60 dark:border-app-border">
                  {preset.locale}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-app-surface border border-slate-200/60 dark:border-app-border">
                  {preset.viewport_width}x{preset.viewport_height}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-app-surface border border-slate-200/60 dark:border-app-border">
                  {preset.timezone.split('/').pop()}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-app-surface border border-slate-200/60 dark:border-app-border capitalize">
                  {preset.platform}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Browser Binary Manager Section */}
      <Section
        title="Browser Binaries"
        description="Detected browser executables and versions. Browser paths are resolved through the binary manager on Windows and macOS — no OS paths are hard-coded."
        icon={ChromeIcon}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleScanBrowsers}
              disabled={browserBusy}
              className="btn-secondary text-xs"
            >
              <RefreshIcon size={13} />
              Scan Browsers
            </button>
            <button
              type="button"
              onClick={handleRefreshBrowsers}
              disabled={browserBusy}
              className="btn-secondary text-xs"
            >
              <RefreshIcon size={13} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowAddCustom((v) => !v)}
              className="btn-secondary text-xs"
            >
              <PlusIcon size={13} />
              Add Custom
            </button>
          </div>
        }
      >
        {showAddCustom && (
          <form
            onSubmit={handleAddCustomBrowser}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border space-y-3 animate-fade-in"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-app-muted-2 mb-1">Name</label>
                <input
                  value={customForm.name}
                  onChange={(e) => setCustomForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Brave Nightly"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-app-muted-2 mb-1">Engine Type</label>
                <select
                  value={customForm.browser_type}
                  onChange={(e) => setCustomForm((f) => ({ ...f, browser_type: e.target.value }))}
                  className="input cursor-pointer"
                >
                  <option value="chromium">Chromium-based</option>
                  <option value="chrome">Google Chrome</option>
                  <option value="msedge">Microsoft Edge</option>
                  <option value="firefox">Firefox</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-app-muted-2 mb-1">Executable Path</label>
                <div className="flex gap-2">
                  <input
                    value={customForm.executable_path}
                    onChange={(e) => setCustomForm((f) => ({ ...f, executable_path: e.target.value }))}
                    placeholder="C:\path\to\browser.exe"
                    className="input flex-1"
                  />
                  <button type="button" onClick={handlePickCustomPath} className="btn-secondary shrink-0 text-xs">
                    Browse
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowAddCustom(false)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button type="submit" disabled={browserBusy} className="btn-primary text-xs">
                <PlusIcon size={13} />
                Add Browser
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-app-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-app-bg text-slate-400 dark:text-app-muted-2 text-left uppercase text-[10px] font-bold">
                <th className="px-4 py-2.5">Browser</th>
                <th className="px-4 py-2.5">Version</th>
                <th className="px-4 py-2.5">Path</th>
                <th className="px-4 py-2.5">Source</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {browsers.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-slate-400 dark:text-app-muted-2">
                    No browser records yet. Click "Scan Browsers" to detect installed browsers.
                  </td>
                </tr>
              )}
              {browsers.map((b) => {
                const StatusIcon =
                  b.browser_type === 'chrome' ? ChromeIcon : b.browser_type === 'msedge' ? EdgeIcon : b.browser_type === 'firefox' ? FirefoxIcon : ChromiumIcon
                const statusColor =
                  b.status === 'available'
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                    : b.status === 'missing'
                    ? 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'
                    : b.status === 'needs-update'
                    ? 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
                    : 'bg-slate-500/10 border-slate-500/25 text-slate-500 dark:text-slate-400'
                return (
                  <tr key={b.id} className="border-t border-slate-100 dark:border-app-border">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusIcon size={15} />
                        <span className="font-bold text-slate-800 dark:text-app-text">{b.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600 dark:text-app-muted">{b.version || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-app-muted truncate max-w-[260px]" title={b.executable_path || ''}>
                      {b.executable_path || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold capitalize bg-white dark:bg-app-surface border border-slate-200/70 dark:border-app-border">
                        {b.source_label || b.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusColor}`}>
                        {b.status_label || b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {b.source === 'custom' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomBrowser(b)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-500"
                          title="Remove custom browser record"
                        >
                          <TrashIcon size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Profile Portability Section */}
      <Section
        title="Profile Portability"
        description="Export one or multiple profiles into a portable package and import them later. Proxy passwords, application secrets and encryption keys are never exported."
        icon={UploadIcon}
      >
        <PortabilitySection />
      </Section>

      {/* Backup & Disaster Recovery Section */}
      <Section
        title="Backup & Data Migration"
        description="Export all profiles, tags, proxy configurations, and automation scripts into a portable encrypted ZIP archive."
        icon={DownloadIcon}
      >
        <div className="space-y-4">
          <label className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border cursor-pointer select-none">
            <button
              type="button"
              onClick={() => setIncludeBrowserData((v) => !v)}
              className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                includeBrowserData
                  ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                  : 'border-slate-300 dark:border-app-border-light bg-white dark:bg-app-surface'
              }`}
            >
              {includeBrowserData && <CheckIcon size={12} className="stroke-[2.5]" />}
            </button>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-app-text">
                Include Persistent Browser Storage
              </p>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
                Archives live cookies, active login sessions, localStorage, and IndexedDB for every profile
              </p>
            </div>
          </label>

          {includeBrowserData && (
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25">
              <AlertIcon size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed font-medium">
                Security note: Persistent storage backups contain active session credentials and authentication cookies. Store backup archives securely and never distribute them publicly.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button onClick={handleExport} disabled={busy} className="btn-primary">
              <DownloadIcon size={14} />
              Export Full Backup (.zip)
            </button>
            <button onClick={handleImport} disabled={busy} className="btn-secondary">
              <UploadIcon size={14} />
              Restore from Backup
            </button>
          </div>
        </div>
      </Section>

      {/* Database Maintenance Section */}
      <Section
        title="SQLite Engine & Database Snapshot"
        description="Create an instant atomic point-in-time snapshot of your local SQLite database for cold offline backups."
        icon={DatabaseIcon}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border">
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-app-text">
              Local SQLite Database (WAL Mode)
            </p>
            <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
              High-performance local relational storage for all metadata and execution history
            </p>
          </div>
          <button onClick={handleBackupDb} disabled={busy} className="btn-secondary shrink-0">
            <DatabaseIcon size={13} />
            Create Snapshot
          </button>
        </div>
      </Section>

      {/* Resource Manager Section */}
      <Section
        title="Browser Window Arrangement"
        description="Automatically tile profile windows on the active monitor. Choose window size, spacing, columns, and screen offsets. New settings apply to profiles opened after saving."
        icon={MonitorIcon}
      >
        <label className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border cursor-pointer select-none mb-3">
          <button
            type="button"
            onClick={() => {
              const next = { ...windowLayout, enabled: !windowLayout.enabled }
              setWindowLayout(next)
              saveWindowLayout(next)
            }}
            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
              windowLayout.enabled
                ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                : 'border-slate-300 dark:border-app-border-light bg-white dark:bg-app-surface'
            }`}
          >
            {windowLayout.enabled && <CheckIcon size={12} className="stroke-[2.5]" />}
          </button>
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-app-text">Auto-arrange opened profiles</p>
            <p className="text-[11px] text-slate-400 dark:text-app-muted-2">Uses the monitor containing your mouse cursor and fills positions from left to right, then top to bottom.</p>
          </div>
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['width', 'Window Width', 480, 3840],
            ['height', 'Window Height', 360, 2160],
            ['gapX', 'Horizontal Gap', 0, 500],
            ['gapY', 'Vertical Gap', 0, 500],
            ['columns', 'Columns (0 = Auto)', 0, 20],
            ['offsetX', 'Left Offset', 0, 3000],
            ['offsetY', 'Top Offset', 0, 2000],
          ].map(([key, label, min, max]) => (
            <div key={key} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border">
              <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-app-muted-2 mb-1.5">{label}</label>
              <input
                type="number"
                min={min}
                max={max}
                value={windowLayout[key]}
                onChange={(e) => setLayoutField(key, e.target.value)}
                className="input"
              />
            </div>
          ))}
          <div className="p-3.5 rounded-2xl bg-brand-500/5 border border-brand-500/20 flex items-end">
            <button type="button" onClick={() => saveWindowLayout()} className="btn-primary w-full justify-center text-xs">
              Save Layout
            </button>
          </div>
        </div>
      </Section>

      <Section
        title="Default Homepage"
        description="Open a first tab whenever a profile browser starts — instead of a blank page. Default is IPhey, which checks Fingerprint, IP, VPN, Bot, DNS Leak & IP Blacklist in one place."
        icon={GlobeIcon}
      >
        <label className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border cursor-pointer select-none mb-3">
          <button
            type="button"
            onClick={() => {
              const next = !homepageEnabled
              setHomepageEnabled(next)
              saveHomepage()
            }}
            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
              homepageEnabled
                ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                : 'border-slate-300 dark:border-app-border-light bg-white dark:bg-app-surface'
            }`}
          >
            {homepageEnabled && <CheckIcon size={12} className="stroke-[2.5]" />}
          </button>
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-app-text">Open homepage on profile start</p>
            <p className="text-[11px] text-slate-400 dark:text-app-muted-2">Default is IPhey (https://iphey.com/) — fingerprint, IP, VPN, bot, DNS leak & blacklist check. Disable to keep a blank tab.</p>
          </div>
        </label>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border">
          <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-app-muted-2 mb-1.5">
            Homepage URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={homepageUrl}
              onChange={(e) => setHomepageUrl(e.target.value)}
              placeholder="https://iphey.com/"
              className="input font-mono"
            />
            <button type="button" onClick={saveHomepage} className="btn-primary text-xs shrink-0">
              Save Homepage
            </button>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-app-muted-2 mt-1.5">
            Một số trang kiểm tra anti-detect phổ biến:
            <span className="font-mono text-brand-600 dark:text-brand-400"> https://iphey.com/ • https://browserleaks.com/ • https://bot.sannysoft.com/ • https://abrahamjuliot.github.io/creepjs/ • https://pixelscan.dev/</span>
          </p>
          <p className="text-[10px] text-slate-400 dark:text-app-muted-2 mt-1">
            Applies to profiles opened after saving.
          </p>
        </div>
      </Section>

      <Section
        title="Resource Management"
        description="Control how many browsers and automations run at once, and get warned when memory usage is high. Profiles never get killed automatically."
        icon={ActivityIcon}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border">
            <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-app-muted-2 mb-1.5">
              Max Concurrent Browsers
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="50"
                value={maxBrowsers}
                onChange={(e) => setMaxBrowsers(e.target.value)}
                onBlur={(e) => saveMaxBrowsers(e.target.value)}
                className="input"
              />
            </div>
            <p className="text-[10px] text-slate-400 dark:text-app-muted-2 mt-1.5">
              Extra launches wait for a free slot instead of failing.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border">
            <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-app-muted-2 mb-1.5">
              Max Concurrent Automations
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={maxAutomations}
              onChange={(e) => setMaxAutomations(e.target.value)}
              onBlur={(e) => saveMaxAutomations(e.target.value)}
              className="input"
            />
            <p className="text-[10px] text-slate-400 dark:text-app-muted-2 mt-1.5">
              The automation queue shares this limit.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border">
            <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-app-muted-2 mb-1.5">
              Memory Warning Threshold (%)
            </label>
            <input
              type="number"
              min="10"
              max="100"
              value={memThreshold}
              onChange={(e) => setMemThreshold(e.target.value)}
              onBlur={(e) => saveMemThreshold(e.target.value)}
              className="input"
            />
            <p className="text-[10px] text-slate-400 dark:text-app-muted-2 mt-1.5">
              Shows a warning when system memory crosses this level.
            </p>
          </div>
        </div>

        <label className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border cursor-pointer select-none mt-3">
          <button
            type="button"
            onClick={() => toggleLowResource(!lowResource)}
            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
              lowResource
                ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                : 'border-slate-300 dark:border-app-border-light bg-white dark:bg-app-surface'
            }`}
          >
            {lowResource && <CheckIcon size={12} className="stroke-[2.5]" />}
          </button>
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-900 dark:text-app-text">Low Resource Mode</p>
            <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
              Reduces concurrency and limits background work. Profile data is never modified.
            </p>
          </div>
        </label>

        {resource && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <div className="p-3 rounded-2xl bg-white dark:bg-app-surface border border-slate-200/70 dark:border-app-border">
              <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-app-muted-2">Active Browsers</p>
              <p className="text-lg font-bold text-slate-900 dark:text-app-text mt-0.5">
                {resource.activeBrowsers}
                <span className="text-xs text-slate-400 font-semibold"> / {resource.effectiveBrowserLimit}</span>
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-white dark:bg-app-surface border border-slate-200/70 dark:border-app-border">
              <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-app-muted-2">Pending Launches</p>
              <p className="text-lg font-bold text-slate-900 dark:text-app-text mt-0.5">{resource.pendingBrowsers}</p>
            </div>
            <div className="p-3 rounded-2xl bg-white dark:bg-app-surface border border-slate-200/70 dark:border-app-border">
              <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-app-muted-2">Running Automations</p>
              <p className="text-lg font-bold text-slate-900 dark:text-app-text mt-0.5">
                {resource.activeAutomations}
                <span className="text-xs text-slate-400 font-semibold"> / {resource.effectiveAutomationLimit}</span>
              </p>
            </div>
            <div className={`p-3 rounded-2xl border ${resource.memory.warning ? 'bg-amber-500/10 border-amber-500/25' : 'bg-white dark:bg-app-surface border-slate-200/70 dark:border-app-border'}`}>
              <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-app-muted-2">Memory Usage</p>
              <p className={`text-lg font-bold mt-0.5 ${resource.memory.warning ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-app-text'}`}>
                {resource.memory.percent}%
              </p>
              <p className="text-[10px] text-slate-400 dark:text-app-muted-2">{resource.memory.rssMB} MB app RSS</p>
            </div>
          </div>
        )}
      </Section>

      {/* Crash Recovery & Safe Startup Section */}
      <Section
        title="Crash Recovery & Safe Startup"
        description="Orphaned browsers and stale statuses are reconciled automatically at startup. Safe Startup Mode prevents automation auto-resume after repeated crashes."
        icon={ActivityIcon}
      >
        <label className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border cursor-pointer select-none">
          <button
            type="button"
            onClick={() => toggleSafeStartup(!safeStartup)}
            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
              safeStartup
                ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                : 'border-slate-300 dark:border-app-border-light bg-white dark:bg-app-surface'
            }`}
          >
            {safeStartup && <CheckIcon size={12} className="stroke-[2.5]" />}
          </button>
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-900 dark:text-app-text">Safe Startup Mode</p>
            <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
              Start the app without auto-resuming automation. Also enabled automatically after repeated crashes.
            </p>
          </div>
        </label>
      </Section>

      {/* System Diagnostics & Platform Info */}
      <Section
        title="About & System Diagnostics"
        description="Core framework, engine runtimes, and local environment build versions."
        icon={ShieldCheckIcon}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Application', value: versions ? versions.appName : 'YNlogin' },
            { label: 'App Version', value: versions ? `v${versions.app}` : '—' },
            { label: 'Database Version', value: versions ? `v${versions.database}` : '—' },
            { label: 'Browser Engine', value: 'Playwright Chromium' },
            { label: 'Automation API', value: versions ? `v${versions.automationApi}` : '—' },
            { label: 'Electron', value: versions && versions.electron ? versions.electron : '—' },
            { label: 'Node.js', value: versions && versions.node ? versions.node : '—' },
            { label: 'Runtime Engine', value: 'Electron + Node.js' },
          ].map((item) => (
            <div
              key={item.label}
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-app-bg border border-slate-200/80 dark:border-app-border"
            >
              <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-app-muted-2">{item.label}</p>
              <p className="text-xs font-bold text-slate-900 dark:text-app-text mt-1">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {[
            { kind: 'data', label: 'Open Data Folder' },
            { kind: 'logs', label: 'Open Logs Folder' },
            { kind: 'profiles', label: 'Open Profiles Folder' },
          ].map((btn) => (
            <button
              key={btn.kind}
              type="button"
              onClick={async () => {
                if (!window.electronAPI || !window.electronAPI.openAppPath) return
                const res = await window.electronAPI.openAppPath(btn.kind)
                if (!res.success) showNotice('error', 'Could not open folder')
              }}
              className="btn-secondary text-xs"
            >
              <ExternalLinkIcon size={13} />
              {btn.label}
            </button>
          ))}
          <button
            type="button"
            onClick={async () => {
              if (!window.electronAPI || !window.electronAPI.checkEnvironment) return
              setBusy(true)
              try {
                const env = await window.electronAPI.checkEnvironment()
                const browsers = (env.browsers || []).map((b) => `${b.name} (${b.status})`).join(', ') || 'none detected'
                showNotice('success', `Environment OK • ${browsers} • Memory ${env.memory.percent}%`)
              } catch (err) {
                showNotice('error', err.message || 'Environment check failed')
              } finally {
                setBusy(false)
              }
            }}
            disabled={busy}
            className="btn-secondary text-xs"
          >
            <CheckIcon size={13} />
            Check Environment
          </button>
        </div>
      </Section>

      {presetModal && (
        <PresetFormModal
          mode={presetModal.mode}
          initial={presetModal.preset}
          onClose={() => setPresetModal(null)}
          onSubmit={handleCreateOrUpdatePreset}
        />
      )}
    </div>
  )
}

export default Settings
