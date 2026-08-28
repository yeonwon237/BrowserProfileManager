const crypto = require('crypto')
const { getDb, saveDb } = require('../database')
const profilesRepo = require('../database/profiles')
const workspacesRepo = require('../database/workspaces')

const PBKDF2_ITERATIONS = 100000
const KEY_LENGTH = 32
const ALGORITHM = 'aes-256-gcm'

/**
 * Creates a password-encrypted backup package using AES-256-GCM.
 * STRICT CRITICAL RULE: Uses standard crypto, zero backdoor, metadata never contains password.
 */
async function createEncryptedBackup({ password, workspaceId = null } = {}) {
  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new Error('Backup password must be at least 6 characters long')
  }

  await getDb()
  saveDb()

  // Collect backup payload (Workspaces, Profiles, Presets, Settings)
  const workspaces = await workspacesRepo.getAllWorkspaces()
  const profiles = await profilesRepo.getAllProfiles(workspaceId ? { workspace_id: workspaceId } : {})
  
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    app: 'YNlogin',
    workspaces: workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      default_browser_settings: workspace.default_browser_settings || {},
      default_automation_settings: workspace.default_automation_settings || {},
      is_default: Boolean(workspace.is_default),
      is_archived: Boolean(workspace.is_archived),
    })),
    profiles: profiles.map((p) => ({
      id: p.id,
      name: p.name,
      group_name: p.group_name || null,
      tags: Array.isArray(p.tags) ? p.tags : [],
      notes: p.notes || null,
      workspace_id: p.workspace_id || 'default',
      proxy_id: p.proxy_id || null,
      browser_type: p.browser_type || 'chromium',
      browser_channel: p.browser_channel || null,
      browser_version: p.browser_version || null,
      environment: p.environment || { mode: 'default' },
    })),
  }

  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')

  // Generate cryptographic salt and IV
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(16)
  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256')

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()

  const packageObj = {
    format: 'ynlogin-encrypted-backup',
    version: 1,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: encrypted.toString('base64'),
    profileCount: profiles.length,
    workspaceCount: workspaces.length,
  }

  return {
    success: true,
    packageString: JSON.stringify(packageObj, null, 2),
    profileCount: profiles.length,
  }
}

/**
 * Restores an AES-256-GCM encrypted backup package.
 */
async function restoreEncryptedBackup({ password, packageString } = {}) {
  if (!password || !packageString) {
    throw new Error('Password and backup package are required for restoration')
  }

  let pkg = null
  try {
    pkg = typeof packageString === 'string' ? JSON.parse(packageString) : packageString
  } catch {
    throw new Error('Invalid backup file format')
  }

  if (pkg.format !== 'ynlogin-encrypted-backup') {
    throw new Error('Unrecognized backup package format')
  }

  const salt = Buffer.from(pkg.salt, 'hex')
  const iv = Buffer.from(pkg.iv, 'hex')
  const authTag = Buffer.from(pkg.authTag, 'hex')
  const ciphertext = Buffer.from(pkg.ciphertext, 'base64')

  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256')

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    const payload = JSON.parse(decrypted.toString('utf8'))
    return {
      success: true,
      payload,
      restoredProfileCount: payload.profiles ? payload.profiles.length : 0,
    }
  } catch (err) {
    throw new Error('Decryption failed: Incorrect password or corrupted backup package')
  }
}

module.exports = {
  createEncryptedBackup,
  restoreEncryptedBackup,
}
