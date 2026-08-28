const fs = require('fs')
const path = require('path')
const vm = require('vm')

/**
 * Sandbox for automation plugins. Plugins execute in a VM context that only
 * exposes the defined automation API — never Node's require of Electron, the
 * renderer, or arbitrary local files.
 */
const ALLOWED_REQUIRES = new Set([
  'fs',
  'path',
  'crypto',
  'url',
  'http',
  'https',
  'util',
  'assert',
  'events',
])

function isWithin(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function createScopedFs(getRoots) {
  const checked = (value) => {
    if (typeof value !== 'string' && !Buffer.isBuffer(value) && !(value instanceof URL)) {
      throw new Error('Plugin filesystem path must be a string, Buffer, or file URL')
    }
    const resolved = path.resolve(value instanceof URL ? require('url').fileURLToPath(value) : String(value))
    if (!getRoots().some((root) => isWithin(root, resolved))) {
      throw new Error('Plugin filesystem access denied outside its isolated directories')
    }
    return resolved
  }
  const wrap = (name, indexes = [0]) => (...args) => {
    for (const index of indexes) if (args[index] != null) args[index] = checked(args[index])
    return fs[name](...args)
  }
  const facade = {}
  for (const name of ['readFileSync', 'writeFileSync', 'appendFileSync', 'existsSync', 'mkdirSync', 'readdirSync', 'statSync', 'lstatSync', 'unlinkSync', 'rmSync', 'rmdirSync', 'createReadStream', 'createWriteStream', 'realpathSync']) {
    facade[name] = wrap(name)
  }
  facade.renameSync = wrap('renameSync', [0, 1])
  facade.copyFileSync = wrap('copyFileSync', [0, 1])
  facade.constants = fs.constants
  return Object.freeze(facade)
}

function loadPlugin(entryPath, permissions = []) {
  const code = fs.readFileSync(entryPath, 'utf8')
  const dirname = path.dirname(entryPath)
  const module = { exports: {} }
  const exports = module.exports
  let runtimeRoots = [dirname]
  const scopedFs = createScopedFs(() => runtimeRoots)
  const permissionSet = new Set(Array.isArray(permissions) ? permissions : [])
  const allowsFilesystem = permissionSet.has('filesystem') || permissionSet.has('filesystem.selectedFile') || permissionSet.has('downloads') || permissionSet.has('downloads.write')
  const allowsNetwork = permissionSet.has('network')

  const requireFn = (request) => {
    if (typeof request !== 'string' || request.length === 0) {
      throw new Error('Automation plugins may only require whitelisted modules')
    }
    if (request === 'electron' || request.startsWith('electron/')) {
      throw new Error('Automation plugins cannot access Electron internals')
    }
    if (request.startsWith('.') || request.startsWith('/') || request.includes(':\\') || request.startsWith('..')) {
      throw new Error('Automation plugins cannot require local files or arbitrary paths')
    }
    const base = request.split('/')[0]
    if (!ALLOWED_REQUIRES.has(base)) {
      throw new Error(`Automation plugins may only require whitelisted modules (got "${request}")`)
    }
    if (base === 'fs') {
      if (!allowsFilesystem) throw new Error('PermissionDenied: plugin did not request filesystem access')
      return scopedFs
    }
    if ((base === 'http' || base === 'https') && !allowsNetwork) {
      throw new Error('PermissionDenied: plugin did not request network access')
    }
    // eslint-disable-next-line global-require
    return require(request)
  }

  const sandbox = {
    module,
    exports,
    __filename: entryPath,
    __dirname: dirname,
    require: requireFn,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    Buffer,
    URL,
    URLSearchParams,
    JSON,
    Math,
    Date,
    RegExp,
    Error,
    TypeError,
    RangeError,
    String,
    Number,
    Boolean,
    Array,
    Object,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    process: undefined,
  }

  vm.createContext(sandbox)

  const wrapper = new vm.Script(`(function(module, exports, require, __filename, __dirname) {\n${code}\n})`, {
    filename: entryPath,
  })
  const factory = wrapper.runInContext(sandbox)
  factory(module, exports, requireFn, entryPath, dirname)

  const runFn = typeof module.exports === 'function' ? module.exports : module.exports && module.exports.default
  if (typeof runFn !== 'function') {
    throw new Error('Tool entry must export a function')
  }
  return async (api = {}) => {
    const extraRoots = [api.downloadsDir, api.tempDir, ...(Array.isArray(api.selectedPaths) ? api.selectedPaths : [])]
      .filter((item) => typeof item === 'string')
    runtimeRoots = [dirname, ...extraRoots]
    try {
      return await runFn(api)
    } finally {
      runtimeRoots = [dirname]
    }
  }
}

module.exports = { loadPlugin, ALLOWED_REQUIRES }
