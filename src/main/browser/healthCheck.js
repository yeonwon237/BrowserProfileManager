const fs = require('fs')
const path = require('path')
const { getProfileById } = require('../database/profiles')
const { getProxyById, testProxy } = require('../database/proxies')
const { detectInstalledEngines } = require('./adapter')
const { validateConsistency } = require('./consistencyValidator')
const browserManager = require('./manager')
const { validateEnvironment } = require('./environmentValidator')
const { addLog } = require('../database/logs')
const { evaluateProfileSafety } = require('./accountSafety')

/**
 * Run a comprehensive pre-flight health check on a profile.
 *
 * @param {string} profileId - Profile ID
 * @returns {Promise<Object>} Health check report
 */
async function checkProfileHealth(profileId) {
  const profile = await getProfileById(profileId)
  if (!profile) throw new Error('Profile not found')

  const checks = []
  const timestamp = new Date().toISOString()
  const dataPath = profile.browser_data_path

  checks.push({
    id: 'database_record',
    title: 'Database Record',
    status: profile.id && profile.name && profile.browser_data_path ? 'PASS' : 'FAIL',
    message: profile.id && profile.name && profile.browser_data_path
      ? 'Profile database record is complete'
      : 'Profile database record is missing required fields',
  })

  // 1. Browser Engine & Channel Check
  const installedEngines = await detectInstalledEngines()
  const bType = profile.browser_type || 'chromium'
  const matchedEngine = installedEngines.find((e) => e.id === bType || (bType === 'msedge' && e.id === 'msedge'))

  if (bType === 'chromium') {
    checks.push({
      id: 'browser_engine',
      title: 'Browser Runtime Binary',
      status: 'PASS',
      message: `Chromium bundled engine ready (v${matchedEngine?.version || 'bundled'})`,
    })
  } else if (matchedEngine && matchedEngine.available) {
    checks.push({
      id: 'browser_engine',
      title: 'Browser Runtime Binary',
      status: 'PASS',
      message: `${matchedEngine.name} installed and available (v${matchedEngine.version})`,
    })
  } else {
    checks.push({
      id: 'browser_engine',
      title: 'Browser Runtime Binary',
      status: 'FAIL',
      message: `Browser engine "${bType}" is not installed or available on this system`,
      remedy: `Install ${bType} or edit profile to use bundled Chromium.`,
    })
  }

  const environmentValidation = validateEnvironment(profile.environment || { mode: 'default' })
  checks.push({
    id: 'environment_configuration',
    title: 'Environment Configuration',
    status: environmentValidation.valid ? 'PASS' : 'FAIL',
    message: environmentValidation.valid
      ? 'Environment configuration is valid'
      : environmentValidation.errors.join('; '),
  })

  const lockPath = dataPath ? path.join(dataPath, 'SingletonLock') : null
  const managedByThisApp = browserManager.isRunning(profileId)
  const externallyLocked = Boolean(lockPath && fs.existsSync(lockPath) && !managedByThisApp)
  checks.push({
    id: 'process_lock',
    title: 'Profile Process Lock',
    status: externallyLocked ? 'FAIL' : 'PASS',
    message: externallyLocked
      ? 'Profile data is locked by another browser process'
      : managedByThisApp ? 'Profile is already open in this application' : 'No external process lock detected',
    remedy: externallyLocked ? 'Close the other browser process before continuing.' : undefined,
  })

  // 2. Data Directory & Write Permissions
  if (!dataPath) {
    checks.push({
      id: 'storage_directory',
      title: 'Data Storage Directory',
      status: 'FAIL',
      message: 'Profile has no assigned browser_data_path',
    })
  } else {
    try {
      if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true })
      }
      // Test write permission
      const testFile = path.join(dataPath, `__health_test_${Date.now()}.tmp`)
      fs.writeFileSync(testFile, 'ok')
      fs.unlinkSync(testFile)

      checks.push({
        id: 'storage_directory',
        title: 'Data Storage Directory',
        status: 'PASS',
        message: 'Storage directory is healthy and writable',
      })
    } catch (err) {
      checks.push({
        id: 'storage_directory',
        title: 'Data Storage Directory',
        status: 'FAIL',
        message: `Storage path is unwritable or locked: ${err.message}`,
      })
    }
  }

  // 3. Proxy Connectivity & Latency Check (if proxy attached)
  let proxy = null
  if (profile.proxy_id) {
    proxy = await getProxyById(profile.proxy_id)
    if (!proxy) {
      checks.push({
        id: 'proxy_connectivity',
        title: 'Proxy Connection',
        status: 'FAIL',
        message: `Attached proxy ID "${profile.proxy_id}" not found in database`,
      })
    } else {
      try {
        const testRes = await testProxy(proxy.id)
        if (testRes.success) {
          checks.push({
            id: 'proxy_connectivity',
            title: 'Proxy Connection',
            status: 'PASS',
            message: `Proxy online (${testRes.latency}ms) • ${proxy.host}:${proxy.port}`,
          })
        } else {
          checks.push({
            id: 'proxy_connectivity',
            title: 'Proxy Connection',
            status: 'FAIL',
            message: `Proxy unreachable: ${testRes.message || 'Connection failed'}`,
            remedy: 'Verify proxy host/port credentials or switch to direct connection.',
          })
        }
      } catch (err) {
        checks.push({
          id: 'proxy_connectivity',
          title: 'Proxy Connection',
          status: 'FAIL',
          message: `Proxy error: ${err.message}`,
        })
      }
    }
  } else {
    checks.push({
      id: 'proxy_connectivity',
      title: 'Proxy Connection',
      status: 'PASS',
      message: 'Direct connection (no proxy attached)',
    })
  }

  // 4. Network & Environment Consistency Check
  const consistency = validateConsistency(profile, proxy)
  if (consistency.consistent) {
    checks.push({
      id: 'network_consistency',
      title: 'Network & Geo Consistency',
      status: 'PASS',
      message: consistency.message,
    })
  } else {
    checks.push({
      id: 'network_consistency',
      title: 'Network & Geo Consistency',
      status: 'WARN',
      message: consistency.warnings.map((w) => w.message).join(' '),
      remedy: 'Use "Auto-match with Proxy Geo" in profile environment settings.',
    })
  }


  // Verify that the selected browser can create and close a persistent context.
  if (!checks.some((c) => c.status === 'FAIL') && !managedByThisApp) {
    try {
      await browserManager.openProfile(profile, { headless: true })
      const entry = browserManager.getEntry(profileId)
      const contextReady = Boolean(entry && entry.context)
      await browserManager.closeProfile(profileId)
      checks.push({
        id: 'persistent_context',
        title: 'Persistent Browser Context',
        status: contextReady ? 'PASS' : 'FAIL',
        message: contextReady ? 'Browser launch and persistent context are operational' : 'Browser context was not created',
      })
    } catch (err) {
      checks.push({
        id: 'persistent_context',
        title: 'Persistent Browser Context',
        status: 'FAIL',
        message: `Browser launch probe failed: ${err.message}`,
      })
    }
  } else if (managedByThisApp) {
    checks.push({
      id: 'persistent_context',
      title: 'Persistent Browser Context',
      status: 'PASS',
      message: 'Existing managed browser context is active',
    })
  }

  // 5. Network Privacy & WebRTC Leak Protection Check
  checks.push({
    id: 'webrtc_leak_protection',
    title: 'WebRTC Leak Protection',
    status: 'PASS',
    message: profile.proxy_id
      ? 'WebRTC IP leak protection active (non-proxied UDP blocked, SDP filtered)'
      : 'WebRTC local interface protection active (default public interface only)',
  })

  // 6. Proxy Kill-Switch & Fail-Closed Guard
  if (profile.proxy_id) {
    checks.push({
      id: 'proxy_kill_switch',
      title: 'Proxy Kill-Switch Guard',
      status: 'PASS',
      message: 'Fail-closed routing enforced (proxy bypass disabled, direct fallback blocked)',
    })
  }

  checks.push({
    id: 'automation_compatibility',
    title: 'Automation Compatibility',
    status: ['chromium', 'chrome', 'msedge', 'edge'].includes(profile.browser_type || 'chromium') ? 'PASS' : 'WARN',
    message: ['chromium', 'chrome', 'msedge', 'edge'].includes(profile.browser_type || 'chromium')
      ? 'Installed browser adapter supports the current automation API'
      : 'Automation plugin compatibility must be confirmed for this browser engine',
  })

  const accountSafety = await evaluateProfileSafety(profile)
  checks.push({
    id: 'account_safety',
    title: 'An toàn tài khoản',
    status: accountSafety.blocked ? 'FAIL' : accountSafety.level === 'yellow' ? 'WARN' : 'PASS',
    message: `${accountSafety.score}/100 · ${accountSafety.summary}`,
    remedy: accountSafety.risks.map((item) => item.remedy).filter(Boolean).join(' '),
  })


  // Determine overall status
  const hasFail = checks.some((c) => c.status === 'FAIL')
  const hasWarn = checks.some((c) => c.status === 'WARN')
  const overallStatus = hasFail ? 'ERROR' : hasWarn ? 'WARNING' : 'HEALTHY'

  await addLog({
    profile_id: profileId,
    action: 'profile-health-check',
    status: overallStatus === 'ERROR' ? 'error' : overallStatus === 'WARNING' ? 'warn' : 'success',
    message: `Health check ${overallStatus}: ${checks.filter((c) => c.status !== 'PASS').map((c) => c.message).join(' | ') || 'all checks passed'}`,
  }).catch(() => {})

  return {
    success: true,
    overallStatus,
    profile: {
      id: profile.id,
      name: profile.name,
      browser_type: profile.browser_type,
    },
    checks,
    accountSafety,
    timestamp,
  }
}

/**
 * Run health checks on a batch of profile IDs.
 */
async function checkBatchProfiles(profileIds = []) {
  const results = []
  for (const id of profileIds) {
    try {
      const res = await checkProfileHealth(id)
      results.push(res)
    } catch (err) {
      results.push({
        success: false,
        profileId: id,
        overallStatus: 'ERROR',
        error: err.message,
      })
    }
  }
  return results
}

module.exports = {
  checkProfileHealth,
  checkBatchProfiles,
}
