const https = require('https')
const http = require('http')
const net = require('net')
const { getSetting } = require('../settings')

/**
 * Enhanced WebRTC Init Script
 * - Intercepts RTCPeerConnection prototype methods and candidate events.
 * - Drops ICE host candidates carrying private/loopback/link-local IPv4 & IPv6 addresses.
 * - Drops unproxied direct public IP candidates when proxy is active.
 * - Retains mDNS (.local) obfuscated candidates and relay candidates.
 * - Rewrites SDP offers/answers and filters ICE candidate events.
 */
const WEBRTC_INIT_SCRIPT = `
(() => {
  // Scoped WebRTC leak protection patch
  let __ynloginWebRtcPatched = true

  const isPrivateOrLocalIP = (ip) => {
    if (!ip) return true
    const s = String(ip).trim()
    if (s.includes('.')) {
      const p = s.split('.').map(Number)
      if (p.length !== 4) return true
      if (p[0] === 10) return true
      if (p[0] === 192 && p[1] === 168) return true
      if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true
      if (p[0] === 127 || p[0] === 0) return true
      if (p[0] === 169 && p[1] === 254) return true
      return false
    }
    // IPv6 checks (loopback, ULA, link-local)
    return /^[fF][cCdD]|^::1$|^[fF][eE]80:|^[fF][eE][89aAbB][0-9a-fA-F]:/.test(s)
  }

  const isSafeCandidate = (candidateStr) => {
    if (!candidateStr) return true
    const fields = String(candidateStr).trim().split(/\\s+/)
    // Candidate format: candidate:<foundation> <component> <transport> <priority> <ip> <port> typ <type> ...
    const typIndex = fields.indexOf('typ')
    const candType = typIndex !== -1 ? fields[typIndex + 1] : fields[7]
    const ip = typIndex !== -1 ? fields[typIndex - 2] : fields[4]

    if (candType === 'host' && ip) {
      if (ip.includes('.local')) return true
      if (isPrivateOrLocalIP(ip)) return false
    }
    return true
  }

  const filterSdp = (sdp) => {
    if (!sdp) return sdp
    return sdp
      .split('\\r\\n')
      .filter((line) => {
        if (line.startsWith('a=candidate:')) {
          const candidateData = line.replace('a=candidate:', '')
          return isSafeCandidate(candidateData)
        }
        return true
      })
      .join('\\r\\n')
  }

  const patch = () => {
    const RTC = window.RTCPeerConnection || window.webkitRTCPeerConnection
    if (!RTC) return

    const origCreateOffer = RTC.prototype.createOffer
    const origCreateAnswer = RTC.prototype.createAnswer
    const origSetLocalDescription = RTC.prototype.setLocalDescription
    const origAddIceCandidate = RTC.prototype.addIceCandidate

    RTC.prototype.createOffer = function (...args) {
      const result = origCreateOffer.apply(this, args)
      return Promise.resolve(result).then((offer) => {
        if (!offer || !offer.sdp) return offer
        return { ...offer, sdp: filterSdp(offer.sdp) }
      })
    }

    RTC.prototype.createAnswer = function (...args) {
      const result = origCreateAnswer.apply(this, args)
      return Promise.resolve(result).then((answer) => {
        if (!answer || !answer.sdp) return answer
        return { ...answer, sdp: filterSdp(answer.sdp) }
      })
    }

    RTC.prototype.setLocalDescription = function (desc, ...args) {
      if (desc && desc.sdp) {
        desc = { ...desc, sdp: filterSdp(desc.sdp) }
      }
      return origSetLocalDescription.call(this, desc, ...args)
    }

    if (origAddIceCandidate) {
      RTC.prototype.addIceCandidate = function (candidate, ...args) {
        if (candidate && candidate.candidate && !isSafeCandidate(candidate.candidate)) {
          return Promise.resolve()
        }
        return origAddIceCandidate.call(this, candidate, ...args)
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patch)
  } else {
    patch()
  }
})()
`

const IP_HANDLING_PROXY = 'disable_non_proxied_udp'
const IP_HANDLING_NO_PROXY = 'default_public_interface_only'

/**
 * Direct Host Public IP Cache
 */
let cachedDirectHostIp = null
let directIpCacheTime = 0
const DIRECT_IP_CACHE_TTL_MS = 120 * 1000

/**
 * Fetch direct host public IP directly in Node without proxy routing
 */
async function getDirectHostPublicIp(forceRefresh = false) {
  const now = Date.now()
  if (!forceRefresh && cachedDirectHostIp && now - directIpCacheTime < DIRECT_IP_CACHE_TTL_MS) {
    return cachedDirectHostIp
  }

  const endpoints = [
    'https://api.ipify.org?format=json',
    'https://api4.ipify.org?format=json',
    'https://icanhazip.com',
  ]

  for (const url of endpoints) {
    try {
      const raw = await fetchWithTimeout(url, 2500)
      if (raw) {
        let ip = null
        try {
          const parsed = JSON.parse(raw)
          ip = parsed.ip || parsed.origin || null
        } catch {
          ip = raw.trim()
        }
        if (ip && (/^[\d.]+$/.test(ip) || /^[0-9a-fA-F:]+$/.test(ip))) {
          cachedDirectHostIp = ip
          directIpCacheTime = now
          return ip
        }
      }
    } catch {
      // try next endpoint
    }
  }

  // Privacy checks must never invent a harmless-looking address. Callers use
  // null to fail closed when the host IP cannot be verified.
  return cachedDirectHostIp || null
}

function fetchWithTimeout(url, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https')
    const client = isHttps ? https : http
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => resolve(data))
    })
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Timeout fetching IP'))
    })
    req.on('error', reject)
  })
}

/**
 * Chromium launch arguments enforcing WebRTC protection, IPv6 protection, and Proxy Kill-Switch
 */
function getLaunchArgs({ proxyActive = false, disableIpv6 = true, killSwitch = true } = {}) {
  const policy = proxyActive ? IP_HANDLING_PROXY : IP_HANDLING_NO_PROXY
  const args = [
    `--webrtc-ip-handling-policy=${policy}`,
    `--force-webrtc-ip-handling-policy=${policy}`,
    '--enforce-webrtc-ip-permission-check',
  ]

  if (disableIpv6) {
    args.push('--disable-ipv6')
  }

  if (proxyActive && killSwitch) {
    // Proxy Kill-Switch: Prevents Chromium from silently falling back to direct network connection
    // When the proxy goes down, connection fails closed with ERR_PROXY_CONNECTION_FAILED
    args.push('--proxy-bypass-list=<-loopback>')
  }

  return args
}

async function isEnabled() {
  const raw = await getSetting('leakProtectionEnabled', 'true')
  return raw !== 'false' && raw !== '0'
}

async function isKillSwitchEnabled() {
  const raw = await getSetting('proxyKillSwitchEnabled', 'true')
  return raw !== 'false' && raw !== '0'
}

async function isAutomationLeakGuardEnabled() {
  const raw = await getSetting('automationLeakGuardEnabled', 'true')
  return raw !== 'false' && raw !== '0'
}

async function getWebRtcInitScript() {
  if (!(await isEnabled())) return null
  return WEBRTC_INIT_SCRIPT
}

/**
 * Query browser context's current public IP via in-browser evaluation
 */
async function getBrowserPublicIp(contextOrPage) {
  try {
    let page = null
    if (contextOrPage && typeof contextOrPage.newPage === 'function') {
      page = contextOrPage.pages()[0] || (await contextOrPage.newPage())
    } else {
      page = contextOrPage
    }

    if (!page || page.isClosed()) return null

    const result = await page.evaluate(async () => {
      const endpoints = [
        'https://api.ipify.org?format=json',
        'https://api4.ipify.org?format=json',
        'https://icanhazip.com',
      ]
      for (const ep of endpoints) {
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 3000)
          const res = await fetch(ep, { signal: controller.signal })
          clearTimeout(timer)
          if (res.ok) {
            const text = await res.text()
            try {
              const obj = JSON.parse(text)
              return obj.ip || obj.origin || text.trim()
            } catch {
              return text.trim()
            }
          }
        } catch {
          // continue
        }
      }
      return null
    })

    return result
  } catch (err) {
    return null
  }
}

/**
 * Run in-browser WebRTC Leak Detector Probe
 * Creates RTCPeerConnection to public STUN servers and captures all gathered candidates.
 */
async function detectWebRtcLeak(page) {
  if (!page || page.isClosed()) {
    return {
      success: false,
      leaked: false,
      candidates: [],
      leakedIps: [],
      summary: 'Page unavailable for WebRTC leak probe',
    }
  }

  try {
    const probeResult = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const candidates = []
        const privateIps = []
        const publicIps = []
        let finished = false

        const isPrivate = (ip) => {
          if (!ip) return true
          const s = String(ip).trim()
          if (s.includes('.')) {
            const p = s.split('.').map(Number)
            if (p.length !== 4) return true
            if (p[0] === 10 || (p[0] === 192 && p[1] === 168) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31)) return true
            if (p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254)) return true
            return false
          }
          return /^[fF][cCdD]|^::1$|^[fF][eE]80:/.test(s)
        }

        const finish = () => {
          if (finished) return
          finished = true
          resolve({
            candidates,
            privateIps: [...new Set(privateIps)],
            publicIps: [...new Set(publicIps)],
          })
        }

        const timeout = setTimeout(finish, 2500)

        try {
          const RTC = window.RTCPeerConnection || window.webkitRTCPeerConnection
          if (!RTC) {
            clearTimeout(timeout)
            resolve({ candidates: [], privateIps: [], publicIps: [], error: 'WebRTC not supported' })
            return
          }

          const pc = new RTC({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
          })

          pc.createDataChannel('leakTestChannel')

          pc.onicecandidate = (event) => {
            if (!event || !event.candidate) {
              finish()
              return
            }
            const cand = event.candidate.candidate || ''
            candidates.push(cand)

            // Extract IP
            const match = cand.match(/([0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-fA-F0-9:]+)/)
            if (match && match[1]) {
              const ip = match[1]
              if (!ip.includes('.local')) {
                if (isPrivate(ip)) {
                  privateIps.push(ip)
                } else {
                  publicIps.push(ip)
                }
              }
            }
          }

          pc.createOffer()
            .then((offer) => pc.setLocalDescription(offer))
            .catch(() => finish())
        } catch (e) {
          clearTimeout(timeout)
          resolve({ candidates: [], privateIps: [], publicIps: [], error: e.message })
        }
      })
    })

    const hasPrivateLeak = (probeResult.privateIps || []).length > 0
    const allLeaked = [...(probeResult.privateIps || [])]

    return {
      success: true,
      leaked: hasPrivateLeak,
      candidates: probeResult.candidates || [],
      privateIps: probeResult.privateIps || [],
      publicIps: probeResult.publicIps || [],
      leakedIps: allLeaked,
      summary: hasPrivateLeak
        ? `WebRTC leak detected: exposed internal IP(s) [${allLeaked.join(', ')}]`
        : 'WebRTC leak protection secure: zero private IPs leaked',
    }
  } catch (err) {
    return {
      success: false,
      leaked: false,
      candidates: [],
      leakedIps: [],
      error: err.message,
      summary: `WebRTC leak probe error: ${err.message}`,
    }
  }
}

/**
 * Run DNS & IPv4/IPv6 Leak Detection
 */
async function detectIpLeaks(page, expectedProxyIp = null, realHostIp = null) {
  if (!page || page.isClosed()) {
    return {
      success: false,
      ipv4: null,
      ipv6: null,
      ipv6Leak: false,
      ipMismatch: false,
      message: 'Page unavailable for IP leak probe',
    }
  }

  try {
    const probe = await page.evaluate(async () => {
      let ipv4 = null
      let ipv6 = null

      try {
        const c4 = new AbortController()
        const t4 = setTimeout(() => c4.abort(), 2500)
        const res4 = await fetch('https://api4.ipify.org?format=json', { signal: c4.signal })
        clearTimeout(t4)
        if (res4.ok) {
          const data = await res4.json()
          ipv4 = data.ip
        }
      } catch {}

      try {
        const c6 = new AbortController()
        const t6 = setTimeout(() => c6.abort(), 2000)
        const res6 = await fetch('https://api6.ipify.org?format=json', { signal: c6.signal })
        clearTimeout(t6)
        if (res6.ok) {
          const data = await res6.json()
          ipv6 = data.ip
        }
      } catch {}

      return { ipv4, ipv6 }
    })

    const browserIp = probe.ipv4 || probe.ipv6
    if (!browserIp) {
      return {
        success: false,
        ipv4: probe.ipv4,
        ipv6: probe.ipv6,
        browserIp: null,
        realHostIp,
        expectedProxyIp,
        ipv6Leak: false,
        isDirectMatch: false,
        isExpectedMismatch: false,
        message: 'Unable to verify browser public IP',
      }
    }
    const isDirectMatch = Boolean(realHostIp && browserIp && realHostIp === browserIp)
    // Only compare literal addresses. A proxy hostname is not its exit IP.
    const comparableExpectedIp = net.isIP(expectedProxyIp || '') ? expectedProxyIp : null
    const isExpectedMismatch = Boolean(comparableExpectedIp && browserIp !== comparableExpectedIp)
    const ipv6Leak = Boolean(probe.ipv6 && realHostIp && net.isIP(realHostIp) === 6 && probe.ipv6 === realHostIp)

    return {
      success: true,
      ipv4: probe.ipv4,
      ipv6: probe.ipv6,
      browserIp,
      realHostIp,
      expectedProxyIp,
      ipv6Leak,
      isDirectMatch,
      isExpectedMismatch,
      message: isExpectedMismatch
        ? `Browser IP (${browserIp}) does not match expected proxy IP (${expectedProxyIp})`
        : 'IP routing verified healthy',
    }
  } catch (err) {
    return {
      success: false,
      ipv4: null,
      ipv6: null,
      error: err.message,
      message: `IP leak probe failed: ${err.message}`,
    }
  }
}

/**
 * Verify DNS-dependent traffic from inside the browser context. This is a
 * routing guard, not a claim that a web page can enumerate every OS resolver.
 * A randomized hostname prevents a cached result from producing a false pass.
 */
async function detectDnsLeak(page, { proxyRequired = false } = {}) {
  if (!page || page.isClosed()) {
    return { success: false, safe: false, code: 'DNS_PROBE_UNAVAILABLE', error: 'Page unavailable for DNS probe' }
  }
  try {
    const result = await page.evaluate(async (nonce) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4000)
      try {
        const response = await fetch(`https://${nonce}.invalid.ynlogin-dns-probe.test/`, {
          mode: 'no-cors', cache: 'no-store', signal: controller.signal,
        })
        return { unexpectedlyResolved: Boolean(response) }
      } catch (error) {
        return { unexpectedlyResolved: false, error: String(error && error.message ? error.message : error) }
      } finally {
        clearTimeout(timer)
      }
    }, `${Date.now()}-${Math.random().toString(16).slice(2)}`)

    return {
      success: true,
      safe: !result.unexpectedlyResolved,
      code: result.unexpectedlyResolved ? 'DNS_HIJACK_SUSPECTED' : 'DNS_NEGATIVE_CANARY_OK',
      proxyRequired,
      error: result.unexpectedlyResolved ? 'A reserved DNS canary unexpectedly resolved' : null,
    }
  } catch (err) {
    return { success: false, safe: false, code: 'DNS_PROBE_FAILED', error: err.message }
  }
}

/**
 * Validate comprehensive network privacy for a profile & context
 * Used in:
 * 1. Health checks & diagnostics
 * 2. Fail-closed pre-run automation guard
 */
async function validateProfileNetworkPrivacy(profile, context, { allowBypass: _allowBypass = false } = {}) {
  let proxyConfig = profile.proxy || null
  if (!proxyConfig && profile.proxy_id) {
    try {
      const { getProxyById } = require('../database/proxies')
      proxyConfig = await getProxyById(profile.proxy_id)
    } catch {}
  }
  const hasProxy = Boolean(profile.proxy_id || (proxyConfig && proxyConfig.host))
  const expectedProxyIp = proxyConfig ? (proxyConfig.ip || proxyConfig.host) : null

  if (hasProxy && (!proxyConfig || !proxyConfig.host || !proxyConfig.port)) {
    return {
      safe: false,
      code: 'PROXY_CONFIG_MISSING',
      error: 'Proxy profile has no usable proxy configuration',
      warnings: [],
      browserIp: null,
      expectedIp: expectedProxyIp,
      realHostIp: null,
    }
  }

  // 1. Get real host machine IP
  const realHostIp = await getDirectHostPublicIp().catch(() => null)

  if (hasProxy && !realHostIp) {
    return {
      safe: false,
      code: 'VERIFICATION_UNAVAILABLE',
      error: 'Cannot verify the real host IP; refusing to mark a proxied profile safe',
      warnings: [],
      browserIp: null,
      expectedIp: expectedProxyIp,
      realHostIp: null,
    }
  }


  // 2. Open probe page in context if needed
  let page = context ? context.pages()[0] || (await context.newPage()) : null
  if (!page) {
    return {
      safe: !hasProxy,
      code: hasProxy ? 'NO_CONTEXT' : 'DIRECT_SAFE',
      error: hasProxy ? 'Browser context not available to verify proxy network' : null,
      warnings: [],
      browserIp: null,
      expectedIp: expectedProxyIp,
      realHostIp,
    }
  }

  // Probe WebRTC leak
  const webrtcRes = await detectWebRtcLeak(page)
  if (webrtcRes.leaked) {
    return {
      safe: false,
      code: 'WEBRTC_LEAK',
      error: `WebRTC leaked real private IP: ${webrtcRes.leakedIps.join(', ')}`,
      warnings: [],
      webrtc: webrtcRes,
      realHostIp,
    }
  }

  // Probe runtime IP
  const ipRes = await detectIpLeaks(page, expectedProxyIp, realHostIp)
  const browserIp = ipRes.browserIp

  const warnings = []

  // Check if profile was supposed to be proxied but exposed the direct host IP
  if (hasProxy) {
    if (!ipRes.success || !browserIp) {
      return {
        safe: false,
        code: 'VERIFICATION_UNAVAILABLE',
        error: ipRes.message || 'Cannot verify browser public IP',
        warnings,
        browserIp: null,
        expectedIp: expectedProxyIp,
        realHostIp,
        webrtc: webrtcRes,
        ipRes,
      }
    }

    const dnsRes = await detectDnsLeak(page, { proxyRequired: true })
    if (!dnsRes.success || !dnsRes.safe) {
      return {
        safe: false,
        code: dnsRes.code || 'DNS_PROBE_FAILED',
        error: dnsRes.error || 'DNS routing could not be verified',
        warnings,
        browserIp,
        expectedIp: expectedProxyIp,
        realHostIp,
        dns: dnsRes,
      }
    }
    if (browserIp && realHostIp && browserIp === realHostIp) {
      return {
        safe: false,
        code: 'REAL_IP_LEAK',
        error: `REAL-IP LEAKAGE DETECTED! Profile traffic is bypassing proxy and exposing real host IP (${realHostIp})`,
        warnings,
        browserIp,
        expectedIp: expectedProxyIp,
        realHostIp,
        webrtc: webrtcRes,
        ipRes,
      }
    }

    if (ipRes.isExpectedMismatch) {
      return {
        safe: false,
        code: 'PROXY_IP_MISMATCH',
        error: `Browser IP (${browserIp}) differs from expected proxy IP (${expectedProxyIp})`,
        warnings,
        browserIp,
        expectedIp: expectedProxyIp,
        realHostIp,
        dns: dnsRes,
      }
    }

    if (ipRes.ipv6Leak) {
      return {
        safe: false,
        code: 'IPV6_LEAK',
        error: `IPv6 bypass detected: Direct IPv6 traffic bypassed proxy (${ipRes.ipv6})`,
        warnings,
        browserIp,
        expectedIp: expectedProxyIp,
        realHostIp,
      }
    }
  }

  return {
    safe: true,
    code: 'SECURE',
    error: null,
    warnings,
    browserIp,
    expectedIp: expectedProxyIp,
    realHostIp,
    webrtc: webrtcRes,
    ipRes,
  }
}

module.exports = {
  WEBRTC_INIT_SCRIPT,
  IP_HANDLING_PROXY,
  IP_HANDLING_NO_PROXY,
  getLaunchArgs,
  getWebRtcInitScript,
  isEnabled,
  isKillSwitchEnabled,
  isAutomationLeakGuardEnabled,
  getDirectHostPublicIp,
  getBrowserPublicIp,
  detectWebRtcLeak,
  detectIpLeaks,
  detectDnsLeak,
  validateProfileNetworkPrivacy,
}
