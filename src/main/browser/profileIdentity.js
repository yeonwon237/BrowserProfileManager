const crypto = require('crypto')
const { getPlatformTemplate, getDeviceTemplate } = require('./deviceTemplates')

const IDENTITY_VERSION = 2
const CORE_OPTIONS = [4, 6, 8, 12, 16]
const MEMORY_OPTIONS = [4, 8, 16, 32, 64]
const SCREEN_OPTIONS = [
  { width: 1366, height: 768, deviceScaleFactor: 1 },
  { width: 1440, height: 900, deviceScaleFactor: 1 },
  { width: 1536, height: 864, deviceScaleFactor: 1.25 },
  { width: 1920, height: 1080, deviceScaleFactor: 1 },
  { width: 2560, height: 1440, deviceScaleFactor: 1 },
]
const PLATFORM_CATALOG = {
  windows: {
    navigatorPlatform: 'Win32', uaPlatform: 'Windows', uaOs: 'Windows NT 10.0; Win64; x64',
    gpu: [
      ['Google Inc. (NVIDIA)', 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)'],
      ['Google Inc. (Intel)', 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)'],
      ['Google Inc. (AMD)', 'ANGLE (AMD, AMD Radeon RX 6600 XT Direct3D11 vs_5_0 ps_5_0, D3D11)'],
    ],
    fonts: [
      'Arial', 'Calibri', 'Cambria', 'Consolas', 'Segoe UI', 'Times New Roman',
      'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia', 'Impact', 'Lucida Console',
      'Lucida Sans Unicode', 'Microsoft Sans Serif', 'MS Gothic', 'MS PGothic', 'MS Sans Serif',
      'MS Serif', 'Palatino Linotype', 'Symbol', 'Tahoma', 'Trebuchet MS', 'Verdana', 'Webdings',
      'Wingdings', 'Wingdings 2', 'Wingdings 3', 'Segoe UI Symbol', 'Segoe MDL2 Assets',
      'Malgun Gothic', 'Microsoft JhengHei', 'Microsoft YaHei', 'Meiryo', 'SimSun', 'SimHei',
      'Noto Sans', 'Noto Sans CJK SC', 'Noto Sans CJK TC', 'Noto Sans CJK JP', 'Noto Sans CJK KR'
    ],
    plugins: [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', mimeType: 'application/pdf' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: 'Portable Document Format', mimeType: 'application/pdf' },
      { name: 'Native Client', filename: 'internal-nacl-plugin', description: 'Native Client Executable', mimeType: 'application/x-nacl' },
    ],
    mimeTypes: [
      { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format', plugin: 'Chrome PDF Plugin' },
      { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable', plugin: 'Native Client' },
      { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable', plugin: 'Native Client' },
    ],
    battery: { charging: true, level: 1, chargingTime: 0, dischargingTime: Infinity },
    connection: { effectiveType: '4g', downlink: 10, rtt: 50, saveData: false },
    screenOrientation: { type: 'landscape-primary', angle: 0 },
  },
  macos: {
    navigatorPlatform: 'MacIntel', uaPlatform: 'macOS', uaOs: 'Macintosh; Intel Mac OS X 10_15_7',
    gpu: [
      ['Google Inc. (Apple)', 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)'],
      ['Google Inc. (Apple)', 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)'],
    ],
    fonts: [
      'Arial', 'Helvetica', 'Menlo', 'Monaco', 'Times', 'Verdana',
      'Arial Black', 'Arial Narrow', 'Arial Rounded MT Bold', 'Arial Unicode MS',
      'Courier New', 'Georgia', 'Helvetica Neue', 'Impact', 'Lucida Grande',
      'Lucida Sans Unicode', 'Microsoft Sans Serif', 'Palatino', 'Symbol', 'Tahoma',
      'Times New Roman', 'Trebuchet MS', 'Verdana', 'Zapf Dingbats',
      'Apple Color Emoji', 'Apple SD Gothic Neo', 'Apple Symbols',
      'Noto Sans', 'Noto Sans CJK SC', 'Noto Sans CJK TC', 'Noto Sans CJK JP', 'Noto Sans CJK KR',
      'PingFang SC', 'Hiragino Sans', 'Nanum Gothic'
    ],
    plugins: [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', mimeType: 'application/pdf' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: 'Portable Document Format', mimeType: 'application/pdf' },
      { name: 'Native Client', filename: 'internal-nacl-plugin', description: 'Native Client Executable', mimeType: 'application/x-nacl' },
    ],
    mimeTypes: [
      { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format', plugin: 'Chrome PDF Plugin' },
      { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable', plugin: 'Native Client' },
      { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable', plugin: 'Native Client' },
    ],
    battery: { charging: true, level: 1, chargingTime: 0, dischargingTime: Infinity },
    connection: { effectiveType: '4g', downlink: 10, rtt: 50, saveData: false },
    screenOrientation: { type: 'landscape-primary', angle: 0 },
  },
  linux: {
    navigatorPlatform: 'Linux x86_64', uaPlatform: 'Linux', uaOs: 'X11; Linux x86_64',
    gpu: [
      ['Google Inc. (NVIDIA)', 'ANGLE (NVIDIA Corporation, NVIDIA GeForce GTX 1660 SUPER/PCIe/SSE2, OpenGL 4.5)'],
      ['Google Inc. (Intel)', 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 630, OpenGL 4.6)'],
    ],
    fonts: [
      'Arial', 'DejaVu Sans', 'DejaVu Serif', 'Liberation Sans', 'Noto Sans', 'Ubuntu',
      'Cantarell', 'Courier New', 'Georgia', 'Liberation Mono', 'Liberation Serif',
      'Noto Serif', 'Noto Mono', 'Open Sans', 'Roboto', 'Source Sans Pro',
      'Source Code Pro', 'Source Serif Pro', 'Symbol', 'Times New Roman',
      'Noto Sans CJK SC', 'Noto Sans CJK TC', 'Noto Sans CJK JP', 'Noto Sans CJK KR',
      'Noto Serif CJK SC', 'Noto Serif CJK TC', 'Noto Serif CJK JP', 'Noto Serif CJK KR'
    ],
    plugins: [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', mimeType: 'application/pdf' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: 'Portable Document Format', mimeType: 'application/pdf' },
      { name: 'Native Client', filename: 'internal-nacl-plugin', description: 'Native Client Executable', mimeType: 'application/x-nacl' },
    ],
    mimeTypes: [
      { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format', plugin: 'Chrome PDF Plugin' },
      { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable', plugin: 'Native Client' },
      { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable', plugin: 'Native Client' },
    ],
    battery: { charging: true, level: 1, chargingTime: 0, dischargingTime: Infinity },
    connection: { effectiveType: '4g', downlink: 10, rtt: 50, saveData: false },
    screenOrientation: { type: 'landscape-primary', angle: 0 },
  },
}

// `webgpu` must describe the SAME physical GPU as `vendor`/`renderer` above.
// navigator.gpu.requestAdapter()'s GPUAdapterInfo is a second, independent
// surface for the real GPU — if it is left un-spoofed while WebGL is spoofed,
// a checker that reads both (WebGL says "Intel UHD 630", WebGPU says
// "nvidia"/"ampere") gets a direct hardware fingerprint contradiction.
const GPU_CAPABILITIES = {
  'intel-uhd-630': { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)', family: 'intel-integrated', webglVersion: 'WebGL 1.0', glslVersion: 'WebGL GLSL ES 1.0', maxTextureSize: 16384, maxRenderbufferSize: 16384, maxViewportDims: [32767, 32767], anisotropy: 16, webgpu: { vendor: 'intel', architecture: 'gen-9' } },
  'nvidia-gtx-1660': { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)', family: 'nvidia-desktop', webglVersion: 'WebGL 1.0', glslVersion: 'WebGL GLSL ES 1.0', maxTextureSize: 32768, maxRenderbufferSize: 32768, maxViewportDims: [32767, 32767], anisotropy: 16, webgpu: { vendor: 'nvidia', architecture: 'turing' } },
  'amd-rx-6600': { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6600 XT Direct3D11 vs_5_0 ps_5_0, D3D11)', family: 'amd-desktop', webglVersion: 'WebGL 1.0', glslVersion: 'WebGL GLSL ES 1.0', maxTextureSize: 16384, maxRenderbufferSize: 16384, maxViewportDims: [32767, 32767], anisotropy: 16, webgpu: { vendor: 'amd', architecture: 'rdna-2' } },
  'apple-m1': { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)', family: 'apple-silicon', webglVersion: 'WebGL 1.0', glslVersion: 'WebGL GLSL ES 1.0', maxTextureSize: 16384, maxRenderbufferSize: 16384, maxViewportDims: [16384, 16384], anisotropy: 16, webgpu: { vendor: 'apple', architecture: 'common-3' } },
  'apple-m2': { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)', family: 'apple-silicon', webglVersion: 'WebGL 1.0', glslVersion: 'WebGL GLSL ES 1.0', maxTextureSize: 16384, maxRenderbufferSize: 16384, maxViewportDims: [16384, 16384], anisotropy: 16, webgpu: { vendor: 'apple', architecture: 'common-4' } },
  'intel-mesa-uhd-630': { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 630, OpenGL 4.6)', family: 'intel-integrated', webglVersion: 'WebGL 1.0', glslVersion: 'WebGL GLSL ES 1.0', maxTextureSize: 16384, maxRenderbufferSize: 16384, maxViewportDims: [32767, 32767], anisotropy: 16, webgpu: { vendor: 'intel', architecture: 'gen-9' } },
  'nvidia-linux-1660': { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA Corporation, NVIDIA GeForce GTX 1660 SUPER/PCIe/SSE2, OpenGL 4.5)', family: 'nvidia-desktop', webglVersion: 'WebGL 1.0', glslVersion: 'WebGL GLSL ES 1.0', maxTextureSize: 32768, maxRenderbufferSize: 32768, maxViewportDims: [32767, 32767], anisotropy: 16, webgpu: { vendor: 'nvidia', architecture: 'turing' } }
}

// Best-effort vendor inference for the `fallbackGpu` path in createIdentity()
// (reached only if a device template ever supplies a `gpu` key that is not in
// GPU_CAPABILITIES above) so WebGPU spoofing never silently falls back to
// leaking the real adapter.
function inferWebGpuVendor(vendorString) {
  const s = String(vendorString || '').toLowerCase()
  if (s.includes('nvidia')) return { vendor: 'nvidia', architecture: 'turing' }
  if (s.includes('amd')) return { vendor: 'amd', architecture: 'rdna-2' }
  if (s.includes('apple')) return { vendor: 'apple', architecture: 'common-3' }
  if (s.includes('intel')) return { vendor: 'intel', architecture: 'gen-9' }
  return { vendor: 'intel', architecture: 'gen-9' }
}

function digest(profileId, namespace = 'identity') {
  return crypto.createHash('sha256').update(`ynlogin:${IDENTITY_VERSION}:${namespace}:${profileId}`).digest()
}
function select(profileId, namespace, values) { return values[digest(profileId, namespace).readUInt32BE(0) % values.length] }
function inferPlatform(environment = {}) {
  const configured = String(environment.platform || '').toLowerCase()
  if (configured.includes('mac')) return 'macos'
  if (configured.includes('linux')) return 'linux'
  if (configured.includes('win')) return 'windows'
  if (process.platform === 'darwin') return 'macos'
  if (process.platform === 'linux') return 'linux'
  return 'windows'
}

function createIdentity(profileId, environment = {}, browserType = 'chromium') {
  if (!profileId) throw new Error('profileId is required to create a stable identity')
  const platformFamily = inferPlatform(environment)
  const platform = PLATFORM_CATALOG[platformFamily]
  const platformTemplate = getPlatformTemplate(platformFamily)
  const templateIndex = digest(profileId, 'device-template').readUInt32BE(0)
  const deviceTemplate = getDeviceTemplate(platformFamily, templateIndex)
  const viewport = environment.viewport && Number(environment.viewport.width) && Number(environment.viewport.height)
    ? { width: Number(environment.viewport.width), height: Number(environment.viewport.height) } : null
  const chosenScreen = deviceTemplate?.screen || select(profileId, 'screen', SCREEN_OPTIONS)
  const screen = viewport ? { ...chosenScreen, width: Math.max(viewport.width, chosenScreen.width), height: Math.max(viewport.height, chosenScreen.height) } : chosenScreen
  const fallbackGpu = select(profileId, 'gpu', platform.gpu)
  const gpuCapability = GPU_CAPABILITIES[deviceTemplate?.gpu] || { vendor: fallbackGpu[0], renderer: fallbackGpu[1], family: 'native-compatible', webgpu: inferWebGpuVendor(fallbackGpu[0]) }
  const locale = environment.locale || 'en-US'
  const languages = Array.isArray(environment.languages) && environment.languages.length ? environment.languages : [locale, locale.split('-')[0]]
  return {
    version: IDENTITY_VERSION,
    profileKey: digest(profileId, 'profile-key').toString('hex').slice(0, 24),
    seeds: {
      canvas: digest(profileId, 'canvas').readUInt32BE(0), audio: digest(profileId, 'audio').readUInt32BE(0),
      geometry: digest(profileId, 'geometry').readUInt32BE(0), media: digest(profileId, 'media').toString('hex').slice(0, 16),
      battery: digest(profileId, 'battery').readUInt32BE(0), plugins: digest(profileId, 'plugins').readUInt32BE(0),
    },
    browserFamily: ['chrome', 'msedge', 'edge'].includes(browserType) ? browserType : browserType === 'firefox' ? 'firefox' : 'chromium',
    templateId: deviceTemplate?.id || `${platformFamily}-legacy`,
    osVersion: platformTemplate.osVersion,
    architecture: platformTemplate.architecture,
    bitness: platformTemplate.bitness,
    browserVersionPolicy: 'runtime-major', platformFamily, navigatorPlatform: platform.navigatorPlatform,
    uaPlatform: platform.uaPlatform, uaOs: platform.uaOs,
    hardwareConcurrency: deviceTemplate?.cores || select(profileId, 'cores', CORE_OPTIONS), deviceMemory: deviceTemplate?.memory || select(profileId, 'memory', MEMORY_OPTIONS),
    screen: { ...screen, colorDepth: 24, pixelDepth: 24 }, maxTouchPoints: 0,
    gpu: gpuCapability, fonts: [...platform.fonts], locale, languages,
    canvasPolicy: environment.canvasPolicy || { mode: 'persistentPrivacy' },
    audioPolicy: environment.audioPolicy || { mode: 'persistentPrivacy' },
    webGpuPolicy: { mode: 'native', expectedFamily: gpuCapability.family },
    timezone: environment.timezone || null,
    mediaDevices: { groupId: digest(profileId, 'media-group').toString('hex').slice(0, 32) },
    permissions: { notifications: 'prompt', geolocation: environment.geolocation ? 'granted' : 'prompt' },
    webRtcPolicy: 'proxy-only-or-public-interface', createdFrom: 'profile-uuid-v2',
    battery: platform.battery, connection: platform.connection, screenOrientation: platform.screenOrientation,
    plugins: platform.plugins, mimeTypes: platform.mimeTypes,
  }
}

// Profiles created before `webgpu` was added to GPU_CAPABILITIES have a cached
// identity whose `gpu` object lacks it. Patch just that field in place so the
// profile's canvas/audio/screen/etc seeds — and therefore its fingerprint
// history with any site — stay exactly as they were; only the previously
// missing WebGPU consistency data is added.
function backfillGpuWebgpu(identity) {
  if (!identity || !identity.gpu || identity.gpu.webgpu) return identity
  const match = Object.values(GPU_CAPABILITIES).find(
    (g) => g.renderer === identity.gpu.renderer && g.vendor === identity.gpu.vendor
  )
  const webgpu = match ? match.webgpu : inferWebGpuVendor(identity.gpu.vendor)
  return { ...identity, gpu: { ...identity.gpu, webgpu } }
}

function ensureIdentity(profileId, environment = {}, browserType = 'chromium') {
  const safeEnvironment = environment && typeof environment === 'object' && !Array.isArray(environment) ? { ...environment } : { mode: 'default' }
  const expectedKey = digest(profileId, 'profile-key').toString('hex').slice(0, 24)
  const existing = safeEnvironment.identity
  // Reuse cached identity only when locale/timezone/languages still match the
  // environment — otherwise a proxy-align update would keep stale values.
  const envLocale = safeEnvironment.locale || null
  const envTimezone = safeEnvironment.timezone || null
  const envLanguages = Array.isArray(safeEnvironment.languages) ? safeEnvironment.languages.join(',') : ''
  const idLanguages = existing && Array.isArray(existing.languages) ? existing.languages.join(',') : ''
  const stillValid = existing
    && existing.version === IDENTITY_VERSION
    && existing.profileKey === expectedKey
    && (!envLocale || existing.locale === envLocale)
    && (!envTimezone || existing.timezone === envTimezone)
    && (!envLanguages || idLanguages === envLanguages)
  if (stillValid) return { ...safeEnvironment, identity: backfillGpuWebgpu(existing) }
  return { ...safeEnvironment, identity: createIdentity(profileId, safeEnvironment, browserType) }
}

function validateIdentity(identity) {
  const issues = []
  if (!identity || typeof identity !== 'object') return { valid: false, issues: ['IDENTITY_MISSING'] }
  if (identity.version !== IDENTITY_VERSION) issues.push('IDENTITY_VERSION_UNSUPPORTED')
  if (!/^[a-f0-9]{24}$/.test(String(identity.profileKey || ''))) issues.push('PROFILE_KEY_INVALID')
  if (!CORE_OPTIONS.includes(identity.hardwareConcurrency)) issues.push('HARDWARE_CONCURRENCY_INVALID')
  if (!MEMORY_OPTIONS.includes(identity.deviceMemory)) issues.push('DEVICE_MEMORY_INVALID')
  if (!identity.screen || identity.screen.width < 320 || identity.screen.height < 240) issues.push('SCREEN_INVALID')
  const platform = PLATFORM_CATALOG[identity.platformFamily]
  if (!platform || identity.navigatorPlatform !== platform.navigatorPlatform) issues.push('PLATFORM_MISMATCH')
  if (!identity.gpu || !platform?.gpu.some(([vendor, renderer]) => vendor === identity.gpu.vendor && renderer === identity.gpu.renderer)) issues.push('GPU_PLATFORM_MISMATCH')
  if (!identity.seeds || !Number.isInteger(identity.seeds.canvas) || !Number.isInteger(identity.seeds.audio)) issues.push('SEEDS_INVALID')
  return { valid: issues.length === 0, issues }
}

// Real Chrome version mapping (major -> full version)
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

function runtimeUserAgent(identity, browserVersion = '') {
  const major = String(browserVersion).match(/\d+/)?.[0] || '131'
  const fullVersion = getRealChromeVersion(major)
  if (identity.browserFamily === 'firefox') return `Mozilla/5.0 (${identity.uaOs}; rv:${major}.0) Gecko/20100101 Firefox/${major}.0`
  return `Mozilla/5.0 (${identity.uaOs}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${fullVersion} Safari/537.36`
}

module.exports = { IDENTITY_VERSION, GPU_CAPABILITIES, createIdentity, ensureIdentity, validateIdentity, runtimeUserAgent }
