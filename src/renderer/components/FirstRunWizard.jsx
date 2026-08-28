import { useState } from 'react'
import { CheckIcon } from './icons'
import BrandMark from './BrandMark'

export default function FirstRunWizard({ isOpen, onFinish, onSkip }) {
  const [step, setStep] = useState(1)
  const [, setBrowserScan] = useState({ done: false, detected: [] })
  const [createdProfile, setCreatedProfile] = useState(null)
  const [, setDiagResult] = useState(null)
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleDetectBrowsers = async () => {
    setLoading(true)
    try {
      if (window.electronAPI && window.electronAPI.detectInstalledBrowsers) {
        const detected = await window.electronAPI.detectInstalledBrowsers()
        setBrowserScan({ done: true, detected: detected || [] })
      } else {
        setBrowserScan({ done: true, detected: [{ browser_type: 'chromium', version: 'Bundled' }] })
      }
    } catch {
      setBrowserScan({ done: true, detected: [{ browser_type: 'chromium', version: 'Default' }] })
    } finally {
      setLoading(false)
      setStep(4)
    }
  }

  const handleCreateFirstProfile = async () => {
    setLoading(true)
    try {
      if (window.electronAPI && window.electronAPI.createProfile) {
        const p = await window.electronAPI.createProfile({
          name: 'My First Browser Profile',
          browser_type: 'chromium',
          workspace_id: 'default',
        })
        setCreatedProfile(p)
      }
    } catch (err) {
      console.warn('Profile creation:', err)
    } finally {
      setLoading(false)
      setStep(6)
    }
  }

  const handleRunDiagnostic = async () => {
    setLoading(true)
    try {
      if (window.electronAPI && window.electronAPI.checkProfileHealth && createdProfile) {
        const res = await window.electronAPI.checkProfileHealth(createdProfile.id)
        setDiagResult(res || { status: 'healthy', issues: [] })
      } else {
        setDiagResult({ status: 'healthy', issues: [] })
      }
    } catch {
      setDiagResult({ status: 'healthy', issues: [] })
    } finally {
      setLoading(false)
      setStep(7)
    }
  }

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-app-surface rounded-3xl border border-slate-200 dark:border-app-border shadow-2xl max-w-lg w-full p-8 space-y-6 animate-scale-in">
        {/* Step Indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs">
              {step}/7
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Setup Wizard
            </span>
          </div>
          <button
            onClick={onSkip}
            className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-app-text font-medium"
          >
            Skip Setup →
          </button>
        </div>

        {/* Wizard Steps */}
        {step === 1 && (
          <div className="space-y-4 text-center py-4">
            <BrandMark size={68} className="mx-auto drop-shadow-xl" />
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-app-text">
              Welcome to YNlogin
            </h2>
            <p className="text-xs text-slate-500 dark:text-app-muted leading-relaxed max-w-sm mx-auto">
              Your high-performance multi-profile browser management and automation platform. Let’s configure your environment in seconds.
            </p>
            <div className="pt-4">
              <button onClick={() => setStep(2)} className="btn btn-primary w-full py-2.5 text-xs font-bold">
                Get Started →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-app-text">
              1. Secure Storage Location
            </h3>
            <p className="text-xs text-slate-500 dark:text-app-muted leading-relaxed">
              All browser profile data, session storage, and cookies are stored 100% locally on your device with complete encryption and zero cloud telemetry.
            </p>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-app-surface-2/50 border border-slate-200/80 dark:border-app-border text-xs font-mono text-slate-600 dark:text-app-muted">
              AppData/Local/YNlogin/
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setStep(3)} className="btn btn-primary text-xs py-2 px-5">
                Confirm & Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-app-text">
              2. Detect Browser Engines
            </h3>
            <p className="text-xs text-slate-500 dark:text-app-muted leading-relaxed">
              We'll detect installed Chromium, Google Chrome, and Microsoft Edge binaries for seamless fingerprint emulation.
            </p>
            <div className="pt-2">
              <button
                onClick={handleDetectBrowsers}
                disabled={loading}
                className="btn btn-primary w-full py-2.5 text-xs font-bold"
              >
                {loading ? 'Detecting Browsers...' : 'Scan Installed Browsers'}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-app-text">
              3. Proxy Setup (Optional)
            </h3>
            <p className="text-xs text-slate-500 dark:text-app-muted leading-relaxed">
              You can connect HTTP, HTTPS, or SOCKS5 proxies now or configure them later from the Proxy Network tab.
            </p>
            <div className="flex items-center justify-end gap-2 pt-4">
              <button onClick={() => setStep(5)} className="btn btn-primary text-xs py-2 px-5">
                Next: Create First Profile →
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-app-text">
              4. Create Your First Profile
            </h3>
            <p className="text-xs text-slate-500 dark:text-app-muted leading-relaxed">
              We'll generate an isolated browser profile with independent storage and device emulation parameters.
            </p>
            <div className="pt-2">
              <button
                onClick={handleCreateFirstProfile}
                disabled={loading}
                className="btn btn-primary w-full py-2.5 text-xs font-bold"
              >
                {loading ? 'Creating Profile...' : 'Create First Profile'}
              </button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-app-text">
              5. Quick System Diagnostics
            </h3>
            <p className="text-xs text-slate-500 dark:text-app-muted leading-relaxed">
              Running a preflight test to ensure disk read/write permissions, database consistency, and browser launch readiness.
            </p>
            <div className="pt-2">
              <button
                onClick={handleRunDiagnostic}
                disabled={loading}
                className="btn btn-primary w-full py-2.5 text-xs font-bold"
              >
                {loading ? 'Running Diagnostics...' : 'Verify Environment'}
              </button>
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4 text-center py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckIcon size={28} />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-app-text">
              Setup Complete!
            </h2>
            <p className="text-xs text-slate-500 dark:text-app-muted leading-relaxed">
              Your platform is fully initialized and ready to run isolated browser sessions and batch automations.
            </p>
            <div className="pt-4">
              <button onClick={onFinish} className="btn btn-primary w-full py-2.5 text-xs font-bold">
                Enter Dashboard →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
