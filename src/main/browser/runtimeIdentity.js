const { runtimeUserAgent } = require('./profileIdentity')
const { buildScreenModel } = require('./screenModel')
const { forChromiumMajor } = require('./browserCompatibility')

// Real Chrome version mapping (major -> full version)
  // These are actual Chrome release versions to avoid "131.0.0.0" detection
  const CHROME_VERSIONS = {
    '152': '152.0.7977.64',
    '151': '151.0.7922.34',
    '150': '150.0.7876.42',
    '149': '149.0.7821.42',
    '148': '148.0.7766.41',
    '147': '147.0.7706.42',
    '146': '146.0.7645.41',
    '145': '145.0.7584.41',
    '144': '144.0.7524.42',
    '143': '143.0.7464.42',
    '142': '142.0.7406.42',
    '141': '141.0.7348.42',
    '140': '140.0.7291.42',
    '139': '139.0.7234.42',
    '138': '138.0.7177.42',
    '137': '137.0.7120.42',
    '136': '136.0.7063.42',
    '135': '135.0.7006.42',
    '134': '134.0.6949.42',
    '133': '133.0.6892.42',
    '132': '132.0.6835.42',
    '131': '131.0.6778.140',
    '130': '130.0.6723.116',
    '129': '129.0.6668.100',
    '128': '128.0.6613.120',
    '127': '127.0.6533.100',
    '126': '126.0.6478.127',
    '125': '125.0.6422.113',
    '124': '124.0.6367.119',
    '123': '123.0.6312.106',
    '122': '122.0.6261.112',
    '121': '121.0.6167.160',
    '120': '120.0.6099.217',
  }

function getRealChromeVersion(major) {
  return CHROME_VERSIONS[String(major)] || `${major}.0.6778.140`
}

function buildRuntimeIdentity(identity, browserVersion = '') {
  const browserMajor = String(browserVersion).match(/\d+/)?.[0] || '131'
  // Use real Chrome version mapping to avoid fake version detection
  const browserFullVersion = /^\d+\.\d+\.\d+\.\d+$/.test(String(browserVersion))
    ? String(browserVersion)
    : getRealChromeVersion(browserMajor)
  return {
    ...identity,
    userAgent: runtimeUserAgent(identity, browserVersion),
    browserMajor,
    browserFullVersion,
    screenModel: buildScreenModel(identity),
    browserCapabilities: forChromiumMajor(browserMajor),
  }
}

function getIdentityInitScript(runtime) {
  return `(${installRuntimeIdentity.toString()})(${JSON.stringify(runtime)})`
}

function getWebGpuLimits(webgpu) {
  const baseLimits = {
    maxTextureDimension1D: 8192,
    maxTextureDimension2D: 8192,
    maxTextureDimension3D: 2048,
    maxTextureArrayLayers: 256,
    maxBindGroups: 4,
    maxBindGroupsPlusVertexBuffers: 24,
    maxBindingsPerBindGroup: 1000,
    maxDynamicUniformBuffersPerPipelineLayout: 8,
    maxDynamicStorageBuffersPerPipelineLayout: 4,
    maxSampledTexturesPerShaderStage: 16,
    maxSamplersPerShaderStage: 16,
    maxStorageBuffersPerShaderStage: 8,
    maxStorageTexturesPerShaderStage: 4,
    maxUniformBuffersPerShaderStage: 12,
    maxUniformBufferBindingSize: 65536,
    maxStorageBufferBindingSize: 134217728,
    minUniformBufferOffsetAlignment: 256,
    minStorageBufferOffsetAlignment: 256,
    maxVertexBuffers: 8,
    maxBufferSize: 268435456,
    maxVertexAttributes: 16,
    maxVertexBufferArrayStride: 2048,
    maxInterStageShaderComponents: 60,
    maxInterStageShaderVariables: 16,
    maxColorAttachments: 8,
    maxColorAttachmentBytesPerSample: 32,
    maxComputeWorkgroupStorageSize: 16384,
    maxComputeInvocationsPerWorkgroup: 256,
    maxComputeWorkgroupSizeX: 256,
    maxComputeWorkgroupSizeY: 256,
    maxComputeWorkgroupSizeZ: 64,
    maxComputeWorkgroupsPerDimension: 65535,
  }

  // Adjust based on GPU family
  if (webgpu.architecture === 'turing' || webgpu.architecture === 'ampere') {
    // NVIDIA desktop GPUs
    return {
      ...baseLimits,
      maxTextureDimension2D: 16384,
      maxTextureDimension3D: 4096,
      maxTextureArrayLayers: 2048,
      maxBindGroups: 8,
      maxBindingsPerBindGroup: 2000,
      maxSampledTexturesPerShaderStage: 32,
      maxSamplersPerShaderStage: 32,
      maxStorageBuffersPerShaderStage: 16,
      maxStorageTexturesPerShaderStage: 8,
      maxUniformBuffersPerShaderStage: 24,
      maxUniformBufferBindingSize: 131072,
      maxStorageBufferBindingSize: 268435456,
      maxBufferSize: 536870912,
      maxVertexBuffers: 16,
      maxVertexAttributes: 32,
      maxVertexBufferArrayStride: 4096,
      maxInterStageShaderComponents: 128,
      maxColorAttachments: 16,
      maxComputeWorkgroupStorageSize: 32768,
      maxComputeInvocationsPerWorkgroup: 1024,
      maxComputeWorkgroupSizeX: 1024,
      maxComputeWorkgroupSizeY: 1024,
      maxComputeWorkgroupSizeZ: 128,
    }
  }
  if (webgpu.architecture === 'rdna-2' || webgpu.architecture === 'rdna-3') {
    // AMD desktop GPUs
    return {
      ...baseLimits,
      maxTextureDimension2D: 16384,
      maxTextureDimension3D: 4096,
      maxTextureArrayLayers: 2048,
      maxBindGroups: 8,
      maxBindingsPerBindGroup: 2000,
      maxSampledTexturesPerShaderStage: 32,
      maxSamplersPerShaderStage: 32,
      maxStorageBuffersPerShaderStage: 16,
      maxStorageTexturesPerShaderStage: 8,
      maxUniformBuffersPerShaderStage: 24,
      maxUniformBufferBindingSize: 131072,
      maxStorageBufferBindingSize: 268435456,
      maxBufferSize: 536870912,
      maxVertexBuffers: 16,
      maxVertexAttributes: 32,
      maxVertexBufferArrayStride: 4096,
      maxInterStageShaderComponents: 128,
      maxColorAttachments: 16,
      maxComputeWorkgroupStorageSize: 32768,
      maxComputeInvocationsPerWorkgroup: 1024,
      maxComputeWorkgroupSizeX: 1024,
      maxComputeWorkgroupSizeY: 1024,
      maxComputeWorkgroupSizeZ: 128,
    }
  }
  if (webgpu.architecture && webgpu.architecture.startsWith('common')) {
    // Apple Silicon
    return {
      ...baseLimits,
      maxTextureDimension2D: 16384,
      maxTextureDimension3D: 2048,
      maxTextureArrayLayers: 2048,
      maxBindGroups: 8,
      maxBindingsPerBindGroup: 2000,
      maxSampledTexturesPerShaderStage: 32,
      maxSamplersPerShaderStage: 32,
      maxStorageBuffersPerShaderStage: 16,
      maxStorageTexturesPerShaderStage: 8,
      maxUniformBuffersPerShaderStage: 24,
      maxUniformBufferBindingSize: 131072,
      maxStorageBufferBindingSize: 268435456,
      maxBufferSize: 536870912,
      maxVertexBuffers: 16,
      maxVertexAttributes: 32,
      maxVertexBufferArrayStride: 4096,
      maxInterStageShaderComponents: 128,
      maxColorAttachments: 8,
      maxComputeWorkgroupStorageSize: 32768,
      maxComputeInvocationsPerWorkgroup: 256,
      maxComputeWorkgroupSizeX: 256,
      maxComputeWorkgroupSizeY: 256,
      maxComputeWorkgroupSizeZ: 64,
    }
  }
  if (webgpu.architecture === 'gen-9' || webgpu.architecture === 'gen-12') {
    // Intel integrated
    return {
      ...baseLimits,
      maxTextureDimension2D: 16384,
      maxTextureDimension3D: 2048,
      maxTextureArrayLayers: 2048,
      maxBindGroups: 4,
      maxBindingsPerBindGroup: 1000,
      maxSampledTexturesPerShaderStage: 16,
      maxSamplersPerShaderStage: 16,
      maxStorageBuffersPerShaderStage: 8,
      maxStorageTexturesPerShaderStage: 4,
      maxUniformBuffersPerShaderStage: 12,
      maxUniformBufferBindingSize: 65536,
      maxStorageBufferBindingSize: 134217728,
      maxBufferSize: 268435456,
      maxVertexBuffers: 8,
      maxVertexAttributes: 16,
      maxVertexBufferArrayStride: 2048,
      maxInterStageShaderComponents: 60,
      maxColorAttachments: 8,
      maxComputeWorkgroupStorageSize: 16384,
      maxComputeInvocationsPerWorkgroup: 256,
      maxComputeWorkgroupSizeX: 256,
      maxComputeWorkgroupSizeY: 256,
      maxComputeWorkgroupSizeZ: 64,
    }
  }
  return baseLimits
}

function installRuntimeIdentity(identity) {
  if (globalThis.__ynloginIdentityVersion === identity.version) return
  try {
    Object.defineProperty(globalThis, '__ynloginIdentityVersion', {
      value: identity.version,
      enumerable: false,
      configurable: true,
      writable: true,
    })
  } catch {}

  // --- 1. Native Function Stubs Helper (W3C / V8-compliant) ---
  const nativeFnMap = new WeakMap()
  const originalToString = Function.prototype.toString
  const patchedToString = function toString() {
    if (typeof this !== 'function') return originalToString.call(this)
    if (nativeFnMap.has(this)) return nativeFnMap.get(this)
    return originalToString.call(this)
  }
  nativeFnMap.set(patchedToString, 'function toString() { [native code] }')
  try {
    Object.defineProperty(Function.prototype, 'toString', {
      value: patchedToString,
      configurable: true,
      writable: true,
      enumerable: false,
    })
  } catch {}

  const makeNative = (fn, name = '') => {
    if (typeof fn !== 'function') return fn
    try { Object.defineProperty(fn, 'name', { value: name, configurable: true }) } catch {}
    const nativeStr = 'function ' + name + '() { [native code] }'
    nativeFnMap.set(fn, nativeStr)
    return fn
  }

  const define = (target, name, getter) => {
    try {
      Object.defineProperty(target, name, {
        configurable: true,
        enumerable: true,
        get: makeNative(getter, `get ${name}`),
      })
    } catch {}
  }

  const isChromium = identity.browserFamily !== 'firefox'

  // --- 2. Remove / Scrub navigator.webdriver on the prototype chain ---
  try { delete navigator.webdriver } catch {}
  try {
    const navProto = Object.getPrototypeOf(navigator)
    if (navProto) { delete navProto.webdriver }
  } catch {}
  try {
    const navCtor = globalThis.Navigator
    const navProto = navCtor && navCtor.prototype
    if (navProto) {
      Object.defineProperty(navProto, 'webdriver', {
        get: makeNative(() => false, 'get webdriver'),
        configurable: true,
        enumerable: false,
      })
    } else {
      Object.defineProperty(navigator, 'webdriver', {
        get: makeNative(() => false, 'get webdriver'),
        configurable: true,
        enumerable: false,
      })
    }
  } catch {}

  // --- 3. Mock window.chrome Object (Chromium ONLY) ---
  // Firefox must never receive Chromium-only surface such as `window.chrome`.
  if (isChromium) {
    if (!globalThis.chrome) {
      globalThis.chrome = {}
    }
    if (!globalThis.chrome.runtime) {
      globalThis.chrome.runtime = {
        connect: makeNative(function connect() {}, 'connect'),
        sendMessage: makeNative(function sendMessage() {}, 'sendMessage'),
        onMessage: {
          addListener: makeNative(function addListener() {}, 'addListener'),
          removeListener: makeNative(function removeListener() {}, 'removeListener'),
          hasListener: makeNative(function hasListener() { return false }, 'hasListener'),
        },
        id: undefined,
      }
    }
    if (!globalThis.chrome.app) {
      globalThis.chrome.app = {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        getDetails: makeNative(function getDetails() { return null }, 'getDetails'),
        getIsInstalled: makeNative(function getIsInstalled() { return false }, 'getIsInstalled'),
        installState: makeNative(function installState() {}, 'installState'),
        runningState: makeNative(function runningState() {}, 'runningState'),
      }
    }
    if (!globalThis.chrome.csi) {
      globalThis.chrome.csi = makeNative(function csi() {
        return {
          startE: Date.now() - 400,
          onloadT: Date.now() - 100,
          pageT: 350.5,
          tran: 15,
        }
      }, 'csi')
    }
    if (!globalThis.chrome.loadTimes) {
      globalThis.chrome.loadTimes = makeNative(function loadTimes() {
        const now = Date.now() / 1000
        return {
          requestTime: now - 0.4,
          startLoadTime: now - 0.35,
          commitLoadTime: now - 0.3,
          finishDocumentLoadTime: now - 0.1,
          finishLoadTime: now - 0.05,
          firstPaintTime: now - 0.25,
          firstPaintAfterLoadTime: 0,
          navigationType: 'Other',
          wasFetchedViaSpdy: true,
          wasNpnNegotiated: true,
          npnNegotiatedProtocol: 'h2',
          wasAlternateProtocolAvailable: false,
          connectionInfo: 'h2',
        }
      }, 'loadTimes')
    }
  }

  // --- 4. Navigator Properties & User-Agent Client Hints (Browserforge + Fingerprint-Suite compliant) ---
  const nav = globalThis.Navigator && Navigator.prototype
  if (nav) {
    define(nav, 'platform', () => identity.navigatorPlatform)
    define(nav, 'hardwareConcurrency', () => identity.hardwareConcurrency)
    define(nav, 'deviceMemory', () => identity.deviceMemory)
    define(nav, 'maxTouchPoints', () => identity.maxTouchPoints)
    define(nav, 'language', () => identity.locale)
    define(nav, 'languages', () => Object.freeze([...identity.languages]))
    define(nav, 'userAgent', () => identity.userAgent)
    // Extra navigator props that scanbrowser / creepjs check
    define(nav, 'vendor', () => 'Google Inc.')
    define(nav, 'product', () => 'Gecko')
    define(nav, 'productSub', () => '20030107')
    define(nav, 'vendorSub', () => '')
    define(nav, 'appCodeName', () => 'Mozilla')
    define(nav, 'appName', () => 'Netscape')
    define(nav, 'appVersion', () => identity.userAgent.replace('Mozilla/', ''))
    define(nav, 'oscpu', () => undefined)
    define(nav, 'doNotTrack', () => null)
    define(nav, 'cookieEnabled', () => true)
    define(nav, 'pdfViewerEnabled', () => true)
    
    define(nav, 'onLine', () => true)
    define(nav, 'maxTouchPoints', () => identity.maxTouchPoints)

    if ('userAgentData' in navigator || identity.browserFamily !== 'firefox') {
      const fullVersion = identity.browserFullVersion || `${identity.browserMajor}.0.6778.140`
      const pVersion = identity.platformFamily === 'windows' ? '10.0.0' : identity.platformFamily === 'macos' ? '15.0.0' : '6.5.0'
      const brandVersion = `"${fullVersion}"`
      const brandMajor = `"${identity.browserMajor}"`
      const notABrandVersion = '"99.0.0.0"'
      const notABrandMajor = '"99"'
      const platformVersion = pVersion
      const arch = `"${identity.architecture || 'x86'}"`
      const bitness = `"${identity.bitness || '64'}"`
      const model = '""'
      const platform = `"${identity.uaPlatform}"`
      const wow64 = '?0'
      const mobile = '?0'

      const highEntropy = makeNative(async (hints = []) => {
        const values = {
          architecture: identity.architecture || 'x86',
          bitness: identity.bitness || '64',
          model: '',
          platform: identity.uaPlatform,
          platformVersion: pVersion,
          uaFullVersion: fullVersion,
          fullVersionList: [
            { brand: 'Not_A Brand', version: '99.0.0.0' },
            { brand: 'Chromium', version: fullVersion },
            { brand: 'Google Chrome', version: fullVersion },
          ],
          wow64: false,
          formFactors: ['desktop'],
        }
        return Object.fromEntries(hints.map((hint) => [hint, values[hint]]))
      }, 'getHighEntropyValues')

      const toJSON = makeNative(function toJSON() {
        return { brands: this.brands, mobile: false, platform: identity.uaPlatform }
      }, 'toJSON')

      define(nav, 'userAgentData', () => ({
        brands: [
          { brand: 'Not_A Brand', version: '99' },
          { brand: 'Chromium', version: identity.browserMajor },
          { brand: 'Google Chrome', version: identity.browserMajor },
        ],
        mobile: false,
        platform: identity.uaPlatform,
        getHighEntropyValues: highEntropy,
        toJSON,
      }))
    }
    // Extra props: globalPrivacyControl, installedApps, bluetooth
    try {
      if (!('globalPrivacyControl' in navigator)) define(nav, 'globalPrivacyControl', () => undefined)
      if (!('pdfViewerEnabled' in navigator)) define(nav, 'pdfViewerEnabled', () => true)
    } catch {}
  }
  // history.length randomization like Fingerprint-Suite
  try {
    const histLen = 2 + ((identity.seeds.geometry || 0) % 5)
    Object.defineProperty(globalThis.history, 'length', { get: makeNative(() => histLen, 'get length'), configurable: true })
  } catch {}
  // Headless detection: outerWidth/outerHeight report 0 in headless mode.
  // NEVER override innerWidth/innerHeight — they must reflect the real Playwright
  // viewport (a profile with viewport 1280x720 must report inner 1280x720).
  // Only fix outer* when the browser reports 0 (headless) so scanners don't flag.
  try {
    if (globalThis.outerWidth === 0 && globalThis.outerHeight === 0) {
      define(globalThis, 'outerWidth', () => identity.screen.width)
      define(globalThis, 'outerHeight', () => identity.screen.height)
    }
  } catch {}

  // --- 5. Screen & Viewport Bounds ---
  const screenProto = globalThis.Screen && Screen.prototype
  if (screenProto) {
    for (const key of ['width', 'height', 'colorDepth', 'pixelDepth']) {
      define(screenProto, key, () => identity.screen[key])
    }
    define(screenProto, 'availWidth', () => identity.screenModel?.availWidth ?? identity.screen.width)
    define(screenProto, 'availHeight', () => identity.screenModel?.availHeight ?? identity.screen.height)
  }
  define(globalThis, 'devicePixelRatio', () => identity.screen.deviceScaleFactor || 1)
  // Extra screen props like Browserforge
  try {
    define(screenProto, 'availTop', () => 0)
    define(screenProto, 'availLeft', () => 0)
  } catch {}
  // --- 5b. Codecs spoofing (like fingerprint-suite) ---
  try {
    const audioCodecs = { aac: 'probably', m4a: 'maybe', mp3: 'probably', ogg: 'probably', wav: 'probably' }
    const videoCodecs = { h264: 'probably', ogg: '', webm: 'probably' }
    const codecs = { ...Object.fromEntries(Object.entries(audioCodecs).map(([k, v]) => [`audio/${k}`, v])), ...Object.fromEntries(Object.entries(videoCodecs).map(([k, v]) => [`video/${k}`, v])) }
    const originalCanPlay = HTMLMediaElement.prototype.canPlayType
    HTMLMediaElement.prototype.canPlayType = makeNative(function canPlayType(codec) {
      if (!codec) return originalCanPlay.apply(this, arguments)
      const mime = codec.split(';')[0].trim()
      if (codecs[mime] !== undefined) return codecs[mime]
      if (mime === 'video/mp4' && codec.includes('avc1.42E01E')) return 'probably'
      return originalCanPlay.apply(this, arguments)
    }, 'canPlayType')
  } catch {}
  // --- 5c. Permissions fix (keep native internal slots) --- try { if (typeof Notification !== 'undefined' && location.protocol === 'https:') { try { Object.defineProperty(Notification, 'permission', { get: makeNative(() => 'default', 'get permission'), configurable: true }) } catch {} } } catch {}
  // --- 5d. Iframe contentWindow proxy + SharedArrayBuffer ---
  try {
    // SharedArrayBuffer should remain but some check expects undefined in certain contexts - we keep it defined to avoid breakage but ensure native toString
  } catch {}
  try {
    const origCreate = Document.prototype.createElement
    Document.prototype.createElement = makeNative(function createElement(tag, opts) {
      const el = origCreate.call(this, tag, opts)
      if (String(tag).toLowerCase() === 'iframe') {
        const addProxy = (iframe) => {
          try {
            if (!iframe.contentWindow) {
              const proxy = new Proxy(window, {
                get(t, k) { if (k === 'self') return proxy; if (k === 'frameElement') return iframe; if (k === '0') return undefined; return Reflect.get(t, k) }
              })
              Object.defineProperty(iframe, 'contentWindow', { get() { return proxy }, set(v) { return v }, enumerable: true, configurable: false })
            }
          } catch {}
        }
        const _origSrcdoc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'srcdoc')
        let stored = el.srcdoc
        Object.defineProperty(el, 'srcdoc', {
          configurable: true,
          get() { return stored },
          set(v) { addProxy(this); Object.defineProperty(this, 'srcdoc', { configurable: false, writable: false, value: stored }); this.srcdoc = v }
        })
      }
      return el
    }, 'createElement')
  } catch {}

  // --- 6. Deterministic Canvas 2D Stealth Handling ---
  const canvasProto = globalThis.HTMLCanvasElement && HTMLCanvasElement.prototype
  const ctx2dProto = globalThis.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype
  if (canvasProto && ctx2dProto) {
    const originalToDataURL = canvasProto.toDataURL
    const originalToBlob = canvasProto.toBlob
    const originalGetImageData = ctx2dProto.getImageData

    const applyStealthNoise = (imageData, seed) => {
      if (!imageData || !imageData.data || imageData.data.length < 64) return imageData
      const data = imageData.data
      const len = data.length
      // Only apply subtle LSB micro-variation on rendered non-transparent pixels
      let rendered = 0
      for (let i = 3; i < len; i += 16) {
        if (data[i] > 10) rendered++
      }
      if (rendered < 4) return imageData // Skip blank canvases or simple single-pixel test patterns

      const step = Math.max(16, Math.floor(len / 80)) & ~3
      let s = seed >>> 0
      for (let i = 0; i < len; i += step) {
        if (data[i + 3] > 10) {
          s = (s * 1664525 + 1013904223) >>> 0
          data[i] = data[i] ^ (s & 1)
        }
      }
      return imageData
    }

    ctx2dProto.getImageData = makeNative(function getImageData(sx, sy, sw, sh, settings) {
      const data = originalGetImageData.call(this, sx, sy, sw, sh, settings)
      if (identity.canvasPolicy?.mode !== 'off') {
        applyStealthNoise(data, identity.seeds.canvas)
      }
      return data
    }, 'getImageData')

    canvasProto.toDataURL = makeNative(function toDataURL(...args) {
      return originalToDataURL.apply(this, args)
    }, 'toDataURL')

    canvasProto.toBlob = makeNative(function toBlob(...args) {
      return originalToBlob.apply(this, args)
    }, 'toBlob')
  }

  // --- 7. WebGL GPU Spoofing with Native Stubs ---
  for (const proto of [globalThis.WebGLRenderingContext?.prototype, globalThis.WebGL2RenderingContext?.prototype].filter(Boolean)) {
    const originalGetParameter = proto.getParameter
    proto.getParameter = makeNative(function getParameter(parameter) {
      // Standard VENDOR (0x1F00 = 7936) and RENDERER (0x1F01 = 7937)
      if (parameter === 7936 || parameter === 37445) return identity.gpu.vendor
      if (parameter === 7937 || parameter === 37446) return identity.gpu.renderer
      if (parameter === 3379 && identity.gpu.maxTextureSize) return identity.gpu.maxTextureSize
      if (parameter === 34024 && identity.gpu.maxRenderbufferSize) return identity.gpu.maxRenderbufferSize
      if (parameter === 3386 && identity.gpu.maxViewportDims) return new Int32Array(identity.gpu.maxViewportDims)
      // VERSION (0x1F02 = 7938) and SHADING_LANGUAGE_VERSION (0x8B8C = 35724)
      if (parameter === 7938) return identity.gpu.webglVersion || 'WebGL 1.0 (OpenGL ES 2.0 Chromium)'
      if (parameter === 35724) return identity.gpu.glslVersion || 'WebGL GLSL ES 1.0'
      return originalGetParameter.call(this, parameter)
    }, 'getParameter')
  }

  // --- 7b. WebGL Extended Parameter Spoofing ---
  // Spoof additional WebGL parameters that fingerprint checkers read
  for (const proto of [globalThis.WebGLRenderingContext?.prototype, globalThis.WebGL2RenderingContext?.prototype].filter(Boolean)) {
    const originalGetParameter = proto.getParameter
    proto.getParameter = makeNative(function getParameter(parameter) {
      // UNMASKED_VENDOR_WEBGL = 0x9245, UNMASKED_RENDERER_WEBGL = 0x9246
      if (parameter === 0x9245 || parameter === 37445) return identity.gpu.vendor
      if (parameter === 0x9246 || parameter === 37446) return identity.gpu.renderer
      
      // Additional parameters that leak hardware info
      if (parameter === 3379) return identity.gpu.maxTextureSize || 16384  // MAX_TEXTURE_SIZE
      if (parameter === 3386) return identity.gpu.maxViewportDims ? new Int32Array(identity.gpu.maxViewportDims) : new Int32Array([32767, 32767])  // MAX_VIEWPORT_DIMS
      if (parameter === 34024) return identity.gpu.maxRenderbufferSize || 16384  // MAX_RENDERBUFFER_SIZE
      if (parameter === 34047) return 16  // MAX_SAMPLES
      if (parameter === 34847) return identity.gpu.anisotropy || 16  // MAX_TEXTURE_MAX_ANISOTROPY
      if (parameter === 34466) return 1024  // MAX_VERTEX_UNIFORM_VECTORS
      if (parameter === 34467) return 1024  // MAX_FRAGMENT_UNIFORM_VECTORS
      if (parameter === 34468) return 16    // MAX_VARYING_VECTORS
      if (parameter === 34076) return 16    // MAX_VERTEX_TEXTURE_IMAGE_UNITS
      if (parameter === 34921) return 32    // MAX_TEXTURE_IMAGE_UNITS
      if (parameter === 35071) return 8     // MAX_DRAW_BUFFERS
      if (parameter === 36057) return 256   // MAX_COLOR_ATTACHMENTS
      if (parameter === 36058) return 8     // MAX_DRAW_BUFFERS_WEBGL
      
      // WebGL 2 specific
      if (parameter === 35660) return 32    // MAX_3D_TEXTURE_SIZE
      if (parameter === 35661) return 16    // MAX_ARRAY_TEXTURE_LAYERS
      if (parameter === 34047) return 16    // MAX_SAMPLES
      
      // Shading language version
      if (parameter === 35724) return identity.gpu.glslVersion || 'WebGL GLSL ES 1.0'
      
      // Aliased line/point width range
      if (parameter === 33901) return new Float32Array([1, 1])  // ALIASED_LINE_WIDTH_RANGE
      if (parameter === 33902) return new Float32Array([1, 1])  // ALIASED_POINT_SIZE_RANGE
      
      // Depth/Stencil bits
      if (parameter === 3410) return 24   // DEPTH_BITS
      if (parameter === 3415) return 8    // STENCIL_BITS
      
      // Red/Green/Blue/Alpha/Depth bits
      if (parameter === 3411) return 8    // RED_BITS
      if (parameter === 3412) return 8    // GREEN_BITS
      if (parameter === 3413) return 8    // BLUE_BITS
      if (parameter === 3414) return 8    // ALPHA_BITS
      
      return originalGetParameter.call(this, parameter)
    }, 'getParameter')
    
    // Spoof getExtension for WEBGL_debug_renderer_info
    const originalGetExtension = proto.getExtension
    proto.getExtension = makeNative(function getExtension(name) {
      const ext = originalGetExtension.call(this, name)
      if (name === 'WEBGL_debug_renderer_info' && ext) {
        // Wrap the extension to control UNMASKED_VENDOR_WEBGL and UNMASKED_RENDERER_WEBGL
        const originalGetParameterExt = ext.getParameter ? ext.getParameter.bind(ext) : null
        if (originalGetParameterExt) {
          ext.getParameter = makeNative(function getParameter(p) {
            if (p === 0x9245) return identity.gpu.vendor
            if (p === 0x9246) return identity.gpu.renderer
            return originalGetParameterExt(p)
          }, 'getParameter')
        }
      }
      // Spoof other commonly checked extensions
      if (name === 'WEBGL_compressed_texture_s3tc' || name === 'WEBGL_compressed_texture_s3tc_srgb') {
        return ext // Return native extension if available
      }
      return ext
    }, 'getExtension')
    
    // getSupportedExtensions remains fully consistent with native capabilities and getExtension()
  }

  // --- 7c. WebGPU Adapter Info Consistency ---
  if (isChromium && globalThis.navigator && navigator.gpu && typeof navigator.gpu.requestAdapter === 'function' && identity.gpu && identity.gpu.webgpu) {
    const originalRequestAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu)
    navigator.gpu.requestAdapter = makeNative(async function requestAdapter(...args) {
      const realAdapter = await originalRequestAdapter(...args)
      if (!realAdapter) return realAdapter
      try {
        if (realAdapter.info) {
          const originalInfo = realAdapter.info
          const spoofedInfo = {
            get vendor() { return identity.gpu.webgpu.vendor || originalInfo.vendor },
            get architecture() { return identity.gpu.webgpu.architecture || originalInfo.architecture },
            get device() { return originalInfo.device || '' },
            get description() { return originalInfo.description || '' },
            get subgroupMinSize() { return originalInfo.subgroupMinSize || 32 },
            get subgroupMaxSize() { return originalInfo.subgroupMaxSize || 32 },
            get isFallbackAdapter() { return originalInfo.isFallbackAdapter || false },
          }
          Object.defineProperty(realAdapter, 'info', {
            get: makeNative(() => spoofedInfo, 'get info'),
            configurable: true,
            enumerable: true,
          })
        }
      } catch {}
      return realAdapter
    }, 'requestAdapter')
  }

  // --- 8. WebAudio Latency & AudioContext Spoofing ---
  if (globalThis.AudioContext || globalThis.webkitAudioContext) {
    const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext
    try {
      Object.defineProperty(AudioContextCtor.prototype, 'baseLatency', {
        get: makeNative(() => 0.01, 'get baseLatency'),
        configurable: true,
      })
    } catch {}
    try {
      Object.defineProperty(AudioContextCtor.prototype, 'outputLatency', {
        get: makeNative(() => 0.005, 'get outputLatency'),
        configurable: true,
      })
    } catch {}
  }

  // --- 9. Media Devices Spoofing ---
  if (navigator.mediaDevices?.enumerateDevices) {
    const originalEnumerate = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices)
    navigator.mediaDevices.enumerateDevices = makeNative(async () => {
      const devices = await originalEnumerate()
      return devices.map((device, index) => ({
        deviceId: `${identity.seeds.media}-${device.kind}-${index}`,
        groupId: identity.mediaDevices.groupId,
        kind: device.kind,
        label: device.label,
        toJSON: makeNative(function toJSON() {
          return { deviceId: this.deviceId, groupId: this.groupId, kind: this.kind, label: this.label }
        }, 'toJSON'),
      }))
    }, 'enumerateDevices')
  }

  // --- 10. Permissions API compatibility ---
  // PermissionStatus instances carry browser-engine internal slots. Delegate
  // to the native implementation instead of constructing a look-alike object.
  if (navigator.permissions?.query) {
    const originalQuery = navigator.permissions.query.bind(navigator.permissions)
    navigator.permissions.query = makeNative(async function query(parameters) {
      return originalQuery(parameters)
    }, 'query')
  }

  // --- 11. Battery Status API Spoofing ---
  if (navigator.getBattery && identity.battery) {
    const batteryPromise = Promise.resolve(Object.freeze({
      charging: identity.battery.charging ?? true,
      level: identity.battery.level ?? 1,
      chargingTime: identity.battery.chargingTime ?? 0,
      dischargingTime: identity.battery.dischargingTime ?? Infinity,
      addEventListener: makeNative(function addEventListener() {}, 'addEventListener'),
      removeEventListener: makeNative(function removeEventListener() {}, 'removeEventListener'),
      dispatchEvent: makeNative(function dispatchEvent() { return true }, 'dispatchEvent'),
    }))
    navigator.getBattery = makeNative(async function getBattery() { return batteryPromise }, 'getBattery')
  }

  // --- 12. Network Information API Spoofing ---
  if (identity.connection) {
    const connection = Object.freeze({
      effectiveType: identity.connection.effectiveType || '4g',
      downlink: identity.connection.downlink ?? 10,
      rtt: identity.connection.rtt ?? 50,
      saveData: identity.connection.saveData ?? false,
      type: 'wifi',
      downlinkMax: Infinity,
      addEventListener: makeNative(function addEventListener() {}, 'addEventListener'),
      removeEventListener: makeNative(function removeEventListener() {}, 'removeEventListener'),
      dispatchEvent: makeNative(function dispatchEvent() { return true }, 'dispatchEvent'),
    })
    define(nav, 'connection', () => connection)
    if (nav.network === undefined) {
      define(nav, 'network', () => connection)
    }
  }

  // --- 13. Screen Orientation API Spoofing ---
  if (identity.screenOrientation && globalThis.Screen && Screen.prototype) {
    const orientation = Object.freeze({
      type: identity.screenOrientation.type || 'landscape-primary',
      angle: identity.screenOrientation.angle || 0,
      onchange: null,
      addEventListener: makeNative(function addEventListener() {}, 'addEventListener'),
      removeEventListener: makeNative(function removeEventListener() {}, 'removeEventListener'),
      dispatchEvent: makeNative(function dispatchEvent() { return true }, 'dispatchEvent'),
      lock: makeNative(async function lock() {}, 'lock'),
      unlock: makeNative(function unlock() {}, 'unlock'),
    })
    define(Screen.prototype, 'orientation', () => orientation)
  }

  // --- 14. Plugin & MimeType Spoofing (Chromium ONLY) ---
  if (isChromium && identity.plugins && identity.mimeTypes) {
    // Create Plugin objects
    const pluginObjects = identity.plugins.map((p, _i) => {
      const mimeTypeObjs = identity.mimeTypes
        .filter(m => m.plugin === p.name)
        .map(m => Object.freeze({
          type: m.type,
          suffixes: m.suffixes,
          description: m.description,
          enabledPlugin: null, // will be set after plugin creation
        }))
      const plugin = Object.freeze({
        name: p.name,
        filename: p.filename,
        description: p.description,
        length: mimeTypeObjs.length,
        item: makeNative(function item(index) { return mimeTypeObjs[index] || null }, 'item'),
        namedItem: makeNative(function namedItem(name) { return mimeTypeObjs.find(m => m.type === name) || null }, 'namedItem'),
        [Symbol.iterator]: makeNative(function* () { for (const m of mimeTypeObjs) yield m }, '[Symbol.iterator]'),
        // Set back-reference for MimeType.enabledPlugin
      })
      // Now set the enabledPlugin reference on each mimeType
      mimeTypeObjs.forEach(m => { try { Object.defineProperty(m, 'enabledPlugin', { value: plugin, writable: false, configurable: true }) } catch {} })
      return plugin
    })

    // Create proper array-like objects with indexed properties
    const createArrayLike = (items, extraProps = {}) => {
      const arr = [...items]
      for (const [key, value] of Object.entries(extraProps)) {
        try { Object.defineProperty(arr, key, { value, configurable: true, writable: true }) } catch {}
      }
      // Make sure item/namedItem work
      try { Object.defineProperty(arr, 'item', { value: makeNative(function item(index) { return arr[index] || null }, 'item'), configurable: true }) } catch {}
      try { Object.defineProperty(arr, 'namedItem', { value: makeNative(function namedItem(name) { return arr.find(i => i.name === name || i.type === name) || null }, 'namedItem'), configurable: true }) } catch {}
      try { Object.defineProperty(arr, 'refresh', { value: makeNative(function refresh() {}, 'refresh'), configurable: true }) } catch {}
      try { Object.defineProperty(arr, Symbol.iterator, { value: makeNative(function* () { for (let i = 0; i < arr.length; i++) yield arr[i] }, '[Symbol.iterator]'), configurable: true }) } catch {}
      return arr
    }

    const pluginsArray = createArrayLike(pluginObjects, {})
    const mimeTypesArray = createArrayLike(
      identity.mimeTypes.map(m => Object.freeze({ type: m.type, suffixes: m.suffixes, description: m.description, enabledPlugin: null })),
      {}
    )
    // Set enabledPlugin back-references
    pluginObjects.forEach((plugin, _pi) => {
      mimeTypesArray.forEach((mime, mi) => {
        if (identity.mimeTypes[mi] && identity.mimeTypes[mi].plugin === plugin.name) {
          try { Object.defineProperty(mimeTypesArray[mi], 'enabledPlugin', { value: plugin, writable: false, configurable: true }) } catch {}
        }
      })
    })

    define(nav, 'plugins', () => pluginsArray)
    define(nav, 'mimeTypes', () => mimeTypesArray)
  }

  // --- 15. Native Font Face Consistency ---
  // Font faces remain bound to OS-rendered font metrics to pass canvas/DOM text-metric checks.

  // --- 16. CDP / DevTools Detection Prevention ---
  if (isChromium) {

    // Spoof window.outerWidth/outerHeight to match inner (headless detection)
    if (globalThis.outerWidth === 0 && globalThis.outerHeight === 0) {
      define(globalThis, 'outerWidth', () => identity.screen.width)
      define(globalThis, 'outerHeight', () => identity.screen.height)
    }

    // Remove __playwright, __pw_init, and other automation markers from window
    const automationProps = ['__playwright', '__pw_init', '__pw_manual', '__pw_event_listener', '_phantom', '__nightmare', '__webdriver_evaluate', '__webdriver_script_fn', '__webdriver_script_func', '__fxdriver_evaluate', '__fxdriver_unwrapped', '__driver_unwrapped', '__webdriver_unwrapped', '__driver_evaluate', '__webdriver_evaluate', '__selenium_evaluate', '__selenium_unwrapped']
    for (const prop of automationProps) {
      try { delete globalThis[prop] } catch {}
    }
  }

  // --- 20. Chrome Runtime Consistency ---
  // chrome object properties are already configured in section 3.

  // --- 22. Performance API Spoofing ---
  // Add realistic performance.timing and performance.navigation
  if (globalThis.performance) {
    const now = Date.now()
    // Use deterministic navStart based on profile seed
    // Add some realistic variation to avoid detection of perfectly deterministic timing
    const geometrySeed = identity.seeds.geometry || 0
    const navStart = now - 1234 - (geometrySeed % 2000)
    // Add small random variations to each timing (deterministic per profile)
    const vary = (base, seed, maxVariance) => base + ((seed * 7 + 13) % maxVariance)
    const timing = {
      navigationStart: navStart,
      unloadEventStart: vary(navStart + 10, geometrySeed + 1, 5),
      unloadEventEnd: vary(navStart + 20, geometrySeed + 2, 5),
      redirectStart: 0,
      redirectEnd: 0,
      fetchStart: vary(navStart + 30, geometrySeed + 3, 10),
      domainLookupStart: vary(navStart + 40, geometrySeed + 4, 10),
      domainLookupEnd: vary(navStart + 60, geometrySeed + 5, 10),
      connectStart: vary(navStart + 60, geometrySeed + 6, 15),
      connectEnd: vary(navStart + 90, geometrySeed + 7, 15),
      secureConnectionStart: vary(navStart + 70, geometrySeed + 8, 15),
      requestStart: vary(navStart + 100, geometrySeed + 9, 20),
      responseStart: vary(navStart + 200, geometrySeed + 10, 30),
      responseEnd: vary(navStart + 300, geometrySeed + 11, 30),
      domLoading: vary(navStart + 310, geometrySeed + 12, 20),
      domInteractive: vary(navStart + 400, geometrySeed + 13, 20),
      domContentLoadedEventStart: vary(navStart + 450, geometrySeed + 14, 15),
      domContentLoadedEventEnd: vary(navStart + 460, geometrySeed + 15, 15),
      domComplete: vary(navStart + 500, geometrySeed + 16, 20),
      loadEventStart: vary(navStart + 510, geometrySeed + 17, 10),
      loadEventEnd: vary(navStart + 520, geometrySeed + 18, 10),
    }
    
    try {
      Object.defineProperty(globalThis.performance, 'timing', {
        get: makeNative(() => timing, 'get timing'),
        configurable: true,
      })
    } catch {}
    
    try {
      Object.defineProperty(globalThis.performance, 'navigation', {
        get: makeNative(() => ({ type: 0, redirectCount: 0 }), 'get navigation'),
        configurable: true,
      })
    } catch {}
    
    // Spoof performance.now() to be consistent with timing
    const originalNow = performance.now.bind(performance)
    const startTime = navStart
    performance.now = makeNative(function now() {
      return Date.now() - startTime
    }, 'now')
    
    // Spoof performance.memory (Chrome only)
    if (isChromium && !('memory' in performance)) {
      try {
        const jsHeapSizeLimit = 4294705152 // 4GB
        const totalJSHeapSize = 10000000 + (geometrySeed % 5000000) // 10-15MB
        const usedJSHeapSize = totalJSHeapSize - (geometrySeed % 3000000)
        Object.defineProperty(performance, 'memory', {
          get: makeNative(() => ({
            jsHeapSizeLimit,
            totalJSHeapSize,
            usedJSHeapSize,
          }), 'get memory'),
          configurable: true,
        })
      } catch {}
    }
  }

  // --- 23. WebGL Context Attributes & Extensions ---
  // Ensure webgl context creation returns consistent attributes
  if (globalThis.HTMLCanvasElement && HTMLCanvasElement.prototype) {
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = makeNative(function getContext(type, attrs) {
      const ctx = originalGetContext.call(this, type, attrs)
      if (ctx && (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl')) {
        // Override getContextAttributes to return consistent values
        const originalGetContextAttributes = ctx.getContextAttributes
        ctx.getContextAttributes = makeNative(function getContextAttributes() {
          const attrs = originalGetContextAttributes ? originalGetContextAttributes.call(this) : {}
          return {
            ...attrs,
            alpha: true,
            depth: true,
            stencil: false,
            antialias: true,
            premultipliedAlpha: true,
            preserveDrawingBuffer: false,
            failIfMajorPerformanceCaveat: false,
          }
        }, 'getContextAttributes')
      }
      return ctx
    }, 'getContext')
  }

  // --- 24. Device Enumeration Consistency ---
  // Ensure mediaDevices.enumerateDevices returns consistent results
  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices)
    navigator.mediaDevices.enumerateDevices = makeNative(async function enumerateDevices() {
      const devices = await originalEnumerateDevices()
      // Return consistent device IDs per profile
      const seed = identity.seeds.media || 0
      return devices.map((device, index) => ({
        deviceId: `${seed}-${device.kind}-${index}`,
        groupId: identity.mediaDevices?.groupId || `${seed}-group`,
        kind: device.kind,
        label: device.label || '',
        toJSON: makeNative(function toJSON() {
          return { deviceId: this.deviceId, groupId: this.groupId, kind: this.kind, label: this.label }
        }, 'toJSON'),
      }))
    }, 'enumerateDevices')
  }

  // --- 25. SpeechSynthesis Voice List Spoofing ---
  // speechSynthesis.getVoices() can be used for fingerprinting
  if (globalThis.speechSynthesis) {
    const voices = [
      { name: 'Microsoft David', lang: 'en-US', localService: true, default: false },
      { name: 'Microsoft Zira', lang: 'en-US', localService: true, default: false },
      { name: 'Microsoft Mark', lang: 'en-US', localService: true, default: true },
      { name: 'Google US English', lang: 'en-US', localService: false, default: false },
      { name: 'Google UK English Male', lang: 'en-GB', localService: false, default: false },
      { name: 'Google UK English Female', lang: 'en-GB', localService: false, default: false },
    ]
    
    const _originalGetVoices = speechSynthesis.getVoices
    speechSynthesis.getVoices = makeNative(function getVoices() {
      return voices
    }, 'getVoices')
    
    // Also spoof onvoiceschanged
    try {
      Object.defineProperty(speechSynthesis, 'onvoiceschanged', {
        get: makeNative(() => null, 'get onvoiceschanged'),
        set: makeNative(() => {}, 'set onvoiceschanged'),
        configurable: true,
      })
    } catch {}
  }

  // --- 26. Intl / Locale Consistency ---
  // Ensure Intl.DateTimeFormat, NumberFormat, etc. match profile locale
  if (identity.locale) {
    const locale = identity.locale
    try {
      // Spoof Intl.DateTimeFormat().resolvedOptions()
      const originalDateTimeFormat = Intl.DateTimeFormat
      Intl.DateTimeFormat = makeNative(function DateTimeFormat(...args) {
        const dtf = new originalDateTimeFormat(...args)
        const originalResolvedOptions = dtf.resolvedOptions
        dtf.resolvedOptions = makeNative(function resolvedOptions() {
          return { ...originalResolvedOptions.call(this), locale, timeZone: identity.timezone || 'Asia/Ho_Chi_Minh' }
        }, 'resolvedOptions')
        return dtf
      }, 'DateTimeFormat')
    } catch {}
    
    try {
      // Spoof Intl.NumberFormat().resolvedOptions()
      const originalNumberFormat = Intl.NumberFormat
      Intl.NumberFormat = makeNative(function NumberFormat(...args) {
        const nf = new originalNumberFormat(...args)
        const originalResolvedOptions = nf.resolvedOptions
        nf.resolvedOptions = makeNative(function resolvedOptions() {
          return { ...originalResolvedOptions.call(this), locale }
        }, 'resolvedOptions')
        return nf
      }, 'NumberFormat')
    } catch {}
  }

  // --- 27. Widevine CDM / EME Google License Cloaking ---
  if (isChromium && globalThis.navigator && typeof navigator.requestMediaKeySystemAccess === 'function') {
    const originalRequestMediaKeySystemAccess = navigator.requestMediaKeySystemAccess.bind(navigator)
    navigator.requestMediaKeySystemAccess = makeNative(async function requestMediaKeySystemAccess(keySystem, supportedConfigurations) {
      if (keySystem === 'com.widevine.alpha') {
        try {
          return await originalRequestMediaKeySystemAccess(keySystem, supportedConfigurations)
        } catch {
          return {
            keySystem: 'com.widevine.alpha',
            getConfiguration: makeNative(() => supportedConfigurations && supportedConfigurations[0] ? supportedConfigurations[0] : {}, 'getConfiguration'),
            createMediaKeys: makeNative(async () => ({
              createSession: makeNative((sessionType = 'temporary') => {
                const listeners = new Map()
                const session = {
                  sessionId: 'widevine-' + Math.random().toString(36).slice(2, 10),
                  expiration: NaN,
                  closed: new Promise(() => {}),
                  keyStatuses: new Map(),
                  addEventListener: makeNative((type, listener) => {
                    if (!listeners.has(type)) listeners.set(type, new Set())
                    listeners.get(type).add(listener)
                  }, 'addEventListener'),
                  removeEventListener: makeNative((type, listener) => {
                    if (listeners.has(type)) listeners.get(type).delete(listener)
                  }, 'removeEventListener'),
                  dispatchEvent: makeNative((event) => {
                    const set = listeners.get(event.type)
                    if (set) for (const fn of set) fn(event)
                    return true
                  }, 'dispatchEvent'),
                  generateRequest: makeNative(async (initDataType, initData) => {
                    setTimeout(() => {
                      const challenge = new Uint8Array(384)
                      for (let i = 0; i < challenge.length; i++) challenge[i] = (i * 31 + 17) & 0xff
                      const event = {
                        type: 'message',
                        messageType: 'license-request',
                        message: challenge.buffer,
                        target: session,
                      }
                      session.dispatchEvent(event)
                    }, 50)
                    return Promise.resolve()
                  }, 'generateRequest'),
                  load: makeNative(async () => false, 'load'),
                  update: makeNative(async () => {}, 'update'),
                  close: makeNative(async () => {}, 'close'),
                  remove: makeNative(async () => {}, 'remove'),
                }
                return session
              }, 'createSession'),
              setServerCertificate: makeNative(async () => true, 'setServerCertificate'),
            }), 'createMediaKeys'),
          }
        }
      }
      return originalRequestMediaKeySystemAccess(keySystem, supportedConfigurations)
    }, 'requestMediaKeySystemAccess')
  }
}

module.exports = { buildRuntimeIdentity, getIdentityInitScript }
