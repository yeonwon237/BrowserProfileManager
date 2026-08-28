const settings = require('../settings')
const profilesRepo = require('../database/profiles')
const { encryptSecret, decryptSecret } = require('../security/crypto')
const { EncryptedCloudSyncProvider } = require('./index')

const PREFIX = 'teamSync.'

function validateEndpoint(endpoint) {
  const url = new URL(String(endpoint || ''))
  if (url.protocol !== 'https:') throw new Error('Team Sync endpoint must use HTTPS')
  if (url.username || url.password) throw new Error('Credentials are not allowed in the endpoint URL')
  return url.toString()
}

class TeamSyncRuntime {
  constructor({ settingsRepo = settings, profileRepository = profilesRepo, providerFactory } = {}) {
    this.settings = settingsRepo
    this.profiles = profileRepository
    this.providerFactory = providerFactory || ((options) => new EncryptedCloudSyncProvider(options))
  }

  key(workspaceId, name) { return `${PREFIX}${workspaceId}.${name}` }

  async configure({ workspaceId = 'default', endpoint, secret, bearerToken = '' } = {}) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(workspaceId)) throw new Error('Invalid workspace id')
    const normalizedEndpoint = validateEndpoint(endpoint)
    if (typeof secret !== 'string' || secret.length < 16) throw new Error('Workspace sync secret must contain at least 16 characters')
    await this.settings.setSetting(this.key(workspaceId, 'endpoint'), normalizedEndpoint)
    await this.settings.setSetting(this.key(workspaceId, 'secret'), encryptSecret(secret))
    await this.settings.setSetting(this.key(workspaceId, 'token'), bearerToken ? encryptSecret(bearerToken) : '')
    await this.settings.setSetting(this.key(workspaceId, 'configuredAt'), new Date().toISOString())
    return this.getStatus(workspaceId)
  }

  async getStatus(workspaceId = 'default') {
    const endpoint = await this.settings.getSetting(this.key(workspaceId, 'endpoint'), '')
    const configuredAt = await this.settings.getSetting(this.key(workspaceId, 'configuredAt'), '')
    const lastSyncAt = await this.settings.getSetting(this.key(workspaceId, 'lastSyncAt'), '')
    const cursor = await this.settings.getSetting(this.key(workspaceId, 'cursor'), '')
    return { configured: Boolean(endpoint), workspaceId, endpoint, configuredAt: configuredAt || null,
      lastSyncAt: lastSyncAt || null, hasCursor: Boolean(cursor) }
  }

  async syncNow(workspaceId = 'default', { conflictStrategy = 'local_newer' } = {}) {
    const endpoint = await this.settings.getSetting(this.key(workspaceId, 'endpoint'), '')
    const encryptedSecret = await this.settings.getSetting(this.key(workspaceId, 'secret'), '')
    const encryptedToken = await this.settings.getSetting(this.key(workspaceId, 'token'), '')
    if (!endpoint || !encryptedSecret) throw new Error('Team Sync is not configured for this workspace')
    const secret = decryptSecret(encryptedSecret)
    const bearerToken = encryptedToken ? decryptSecret(encryptedToken) : ''
    if (!secret) throw new Error('Team Sync secret cannot be decrypted')
    const cursor = await this.settings.getSetting(this.key(workspaceId, 'cursor'), '')
    const revisionsRaw = await this.settings.getSetting(this.key(workspaceId, 'revisions'), '{}')
    let revisions = {}
    try { revisions = JSON.parse(revisionsRaw) } catch { revisions = {} }
    const localProfiles = (await this.profiles.getAllProfiles({ workspace_id: workspaceId }))
      .map((profile) => ({ ...profile, revision: Number(revisions[profile.id] || 0) }))
    const provider = this.providerFactory({ endpoint: validateEndpoint(endpoint), workspaceId, secret, bearerToken })
    const result = await provider.syncConfigurations(localProfiles, { cursor: cursor || null, conflictStrategy })
    if (result.conflicts.length > 0) return { ...result, appliedCount: 0, requiresResolution: true }

    const localIds = new Set(localProfiles.map((profile) => profile.id))
    let appliedCount = 0
    for (const record of result.records) {
      const payload = { name: record.name, group: record.group_name, tags: record.tags, notes: record.notes,
        workspace_id: workspaceId, browser_type: record.browser_type, browser_channel: record.browser_channel,
        browser_version: record.browser_version, environment: record.environment }
      if (localIds.has(record.id)) await this.profiles.updateProfile(record.id, payload)
      else await this.profiles.createProfile({ id: record.id, ...payload })
      revisions[record.id] = Number(record.revision || revisions[record.id] || 0)
      appliedCount += 1
    }
    await this.settings.setSetting(this.key(workspaceId, 'cursor'), result.cursor || '')
    await this.settings.setSetting(this.key(workspaceId, 'revisions'), JSON.stringify(revisions))
    await this.settings.setSetting(this.key(workspaceId, 'lastSyncAt'), new Date().toISOString())
    return { ...result, appliedCount, requiresResolution: false }
  }
}

const teamSyncRuntime = new TeamSyncRuntime()
module.exports = { TeamSyncRuntime, teamSyncRuntime, validateEndpoint }
