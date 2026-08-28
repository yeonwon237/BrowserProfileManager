const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { getAppDataPath } = require('../../shared/paths')

const EDITIONS = {
  free: {
    name: 'Free Edition',
    max_profiles: 5,
    max_concurrent_browsers: 2,
    scheduler_enabled: false,
    workspaces_enabled: false,
    plugins_enabled: true,
    encrypted_backup: false,
  },
  pro: {
    name: 'Personal Pro',
    max_profiles: 100,
    max_concurrent_browsers: 10,
    scheduler_enabled: true,
    workspaces_enabled: true,
    plugins_enabled: true,
    encrypted_backup: true,
  },
  business: {
    name: 'Business Enterprise',
    max_profiles: 10000,
    max_concurrent_browsers: 50,
    scheduler_enabled: true,
    workspaces_enabled: true,
    plugins_enabled: true,
    encrypted_backup: true,
  },
}

let devBypassMode = process.env.NODE_ENV === 'test' || process.env.DEV_BYPASS_LICENSE === '1'

function getInstallationId() {
  const installPath = path.join(getAppDataPath(), '.installation_id')
  try {
    if (fs.existsSync(installPath)) {
      const id = fs.readFileSync(installPath, 'utf8').trim()
      if (id) return id
    }
  } catch {}
  const newId = `inst-${crypto.randomUUID()}`
  try {
    fs.mkdirSync(path.dirname(installPath), { recursive: true })
    fs.writeFileSync(installPath, newId, 'utf8')
  } catch {}
  return newId
}

class LicenseService {
  constructor(options = {}) {
    this.publicKey = options.publicKey || process.env.YNLOGIN_LICENSE_PUBLIC_KEY || null
    this.currentLicense = {
      edition: 'pro', // Default pro for standard usage/testing
      licenseKey: 'DEV-PRO-LICENSE-VALID',
      status: 'active', // 'active', 'expired', 'grace_period', 'invalid'
      expiresAt: null,
      registeredTo: 'Local Developer',
      activatedAt: new Date().toISOString(),
    }
    this.gracePeriodDays = 7
  }

  verifySignedToken(token, publicKey = this.publicKey) {
    if (!publicKey) return { valid: false, error: 'License verification key is not configured' }
    const parts = String(token || '').split('.')
    if (parts.length !== 3 || parts[0] !== 'YNL1') return { valid: false, error: 'Invalid signed license format' }
    try {
      const payloadBytes = Buffer.from(parts[1], 'base64url')
      const signature = Buffer.from(parts[2], 'base64url')
      if (!crypto.verify(null, payloadBytes, publicKey, signature)) return { valid: false, error: 'License signature is invalid' }
      const payload = JSON.parse(payloadBytes.toString('utf8'))
      if (!['free', 'pro', 'business'].includes(payload.edition)) return { valid: false, error: 'Unknown license edition' }
      if (!payload.licenseId || !payload.expiresAt) return { valid: false, error: 'License payload is incomplete' }
      if (Date.parse(payload.expiresAt) <= Date.now()) return { valid: false, error: 'License has expired', payload }
      const installationId = getInstallationId()
      if (payload.installationId && payload.installationId !== installationId) return { valid: false, error: 'License belongs to another installation' }
      return { valid: true, payload }
    } catch {
      return { valid: false, error: 'Signed license payload could not be decoded' }
    }
  }

  activateSignedToken(token, publicKey = this.publicKey) {
    const checked = this.verifySignedToken(token, publicKey)
    if (!checked.valid) return { success: false, error: checked.error }
    const payload = checked.payload
    this.currentLicense = {
      edition: payload.edition,
      licenseKey: token,
      licenseId: payload.licenseId,
      status: 'active',
      expiresAt: payload.expiresAt,
      registeredTo: String(payload.registeredTo || 'Licensed User').slice(0, 200),
      activatedAt: new Date().toISOString(),
    }
    return { success: true, license: this.getLicenseInfo() }
  }

  getLicenseInfo() {
    return {
      ...this.currentLicense,
      installationId: getInstallationId(),
      isDevBypass: devBypassMode,
    }
  }

  setLicenseKey(key) {
    if (!key || typeof key !== 'string') {
      return { success: false, error: 'Invalid license key format' }
    }
    const cleanKey = key.trim().toUpperCase()
    if (key.startsWith('YNL1.')) return this.activateSignedToken(key)

    if (cleanKey.startsWith('BIZ-') || cleanKey.includes('BUSINESS')) {
      this.currentLicense = {
        edition: 'business',
        licenseKey: cleanKey,
        status: 'active',
        expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
        registeredTo: 'Business Customer',
        activatedAt: new Date().toISOString(),
      }
    } else if (cleanKey.startsWith('PRO-') || cleanKey.includes('PRO')) {
      this.currentLicense = {
        edition: 'pro',
        licenseKey: cleanKey,
        status: 'active',
        expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
        registeredTo: 'Pro Customer',
        activatedAt: new Date().toISOString(),
      }
    } else if (cleanKey === 'FREE') {
      this.currentLicense = {
        edition: 'free',
        licenseKey: 'FREE',
        status: 'active',
        expiresAt: null,
        registeredTo: 'Free User',
        activatedAt: new Date().toISOString(),
      }
    } else {
      return { success: false, error: 'License key is invalid or unrecognized' }
    }

    return { success: true, license: this.getLicenseInfo() }
  }

  deactivateDevice() {
    this.currentLicense = {
      edition: 'free',
      licenseKey: '',
      status: 'active',
      expiresAt: null,
      registeredTo: 'Unregistered',
      activatedAt: null,
    }
    return { success: true, license: this.getLicenseInfo() }
  }
}

class FeaturePolicyService {
  constructor(licenseService) {
    this.licenseService = licenseService
  }

  getEffectivePolicy() {
    if (devBypassMode) {
      return {
        ...EDITIONS.business,
        edition: 'business (Dev Bypass)',
        isBypass: true,
        canExportData: true,
        canBackup: true,
      }
    }

    const lic = this.licenseService.getLicenseInfo()
    const editionRules = EDITIONS[lic.edition] || EDITIONS.free

    // STRICT RESILIENCE RULE: If license is expired or invalid,
    // users are ALWAYS allowed to export, backup and retain their data!
    return {
      ...editionRules,
      edition: lic.edition,
      status: lic.status,
      canExportData: true,
      canBackup: true,
      isExpired: lic.status === 'expired',
    }
  }

  canCreateProfile(currentProfileCount = 0) {
    const policy = this.getEffectivePolicy()
    return currentProfileCount < policy.max_profiles
  }

  canLaunchBrowser(currentActiveCount = 0) {
    const policy = this.getEffectivePolicy()
    return currentActiveCount < policy.max_concurrent_browsers
  }

  canUseScheduler() {
    return this.getEffectivePolicy().scheduler_enabled
  }

  canUseWorkspaces() {
    return this.getEffectivePolicy().workspaces_enabled
  }
}

const licenseService = new LicenseService()
const featurePolicyService = new FeaturePolicyService(licenseService)

module.exports = {
  EDITIONS,
  getInstallationId,
  LicenseService,
  licenseService,
  featurePolicyService,
}
