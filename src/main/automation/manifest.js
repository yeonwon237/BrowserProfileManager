const fs = require('fs')
const path = require('path')

const ALLOWED_RUN_MODES = ['browser']
const ALLOWED_INPUT_TYPES = ['text', 'textarea', 'number', 'checkbox', 'select', 'file', 'folder', 'url', 'password']
const ALLOWED_PERMISSIONS = [
  'browser-page', 'downloads', 'network', 'filesystem', 'proxy', 'profile-metadata',
  'browser.page', 'browser.navigation', 'browser.screenshot', 'downloads.write', 'filesystem.selectedFile',
]
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/

function validateManifest(toolDir, manifest) {
  const errors = []

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['manifest.json is empty or invalid'] }
  }

  if (!manifest.id || typeof manifest.id !== 'string') {
    errors.push('id is required and must be a string')
  } else if (!ID_PATTERN.test(manifest.id)) {
    errors.push('id must match pattern (letters, numbers, - _), max 64 chars')
  }

  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('name is required and must be a string')
  }

  if (!manifest.version || typeof manifest.version !== 'string' || !VERSION_PATTERN.test(manifest.version)) {
    errors.push('version is required and must be semver like 1.0.0')
  }

  if (manifest.automation_api_version !== undefined) {
    if (typeof manifest.automation_api_version !== 'number' || !Number.isInteger(manifest.automation_api_version)) {
      errors.push('automation_api_version must be an integer')
    }
  }
  if (manifest.minimum_app_version !== undefined && (typeof manifest.minimum_app_version !== 'string' || !VERSION_PATTERN.test(manifest.minimum_app_version))) {
    errors.push('minimum_app_version must be semver like 1.0.0')
  }
  if (manifest.maximum_app_version !== undefined && (typeof manifest.maximum_app_version !== 'string' || !VERSION_PATTERN.test(manifest.maximum_app_version))) {
    errors.push('maximum_app_version must be semver like 1.0.0')
  }

  if (!manifest.description || typeof manifest.description !== 'string') {
    errors.push('description is required and must be a string')
  }

  if (!manifest.entry || typeof manifest.entry !== 'string') {
    errors.push('entry is required and must be a string')
  } else {
    const entryPath = path.join(toolDir, manifest.entry)
    if (!fs.existsSync(entryPath)) {
      errors.push(`entry file "${manifest.entry}" does not exist in the tool folder`)
    }
  }

  if (!Array.isArray(manifest.runModes) || manifest.runModes.length === 0) {
    errors.push('runModes is required and must be a non-empty array')
  } else {
    const invalidModes = manifest.runModes.filter((m) => !ALLOWED_RUN_MODES.includes(m))
    if (invalidModes.length > 0) {
      errors.push(`unsupported run modes: ${invalidModes.join(', ')} (allowed: ${ALLOWED_RUN_MODES.join(', ')})`)
    }
  }

  if (manifest.permissions !== undefined) {
    if (!Array.isArray(manifest.permissions)) {
      errors.push('permissions must be an array')
    } else {
      const invalidPerms = manifest.permissions.filter((p) => !ALLOWED_PERMISSIONS.includes(p))
      if (invalidPerms.length > 0) {
        errors.push(`unsupported permissions: ${invalidPerms.join(', ')} (allowed: ${ALLOWED_PERMISSIONS.join(', ')})`)
      }
    }
  }

  if (manifest.inputSchema !== undefined) {
    if (!Array.isArray(manifest.inputSchema)) {
      errors.push('inputSchema must be an array')
    } else {
      manifest.inputSchema.forEach((field, i) => {
        if (!field.key || typeof field.key !== 'string') {
          errors.push(`inputSchema[${i}]: key is required`)
        }
        if (field.type && !ALLOWED_INPUT_TYPES.includes(field.type)) {
          errors.push(`inputSchema[${i}]: unsupported type "${field.type}"`)
        }
        if (field.type === 'select' && !Array.isArray(field.options)) {
          errors.push(`inputSchema[${i}]: select type requires an options array`)
        }
        if (!field.label || typeof field.label !== 'string') {
          errors.push(`inputSchema[${i}]: label is required`)
        }
      })
    }
  }

  return { valid: errors.length === 0, errors }
}

module.exports = { validateManifest, ALLOWED_RUN_MODES, ALLOWED_INPUT_TYPES, ALLOWED_PERMISSIONS }
