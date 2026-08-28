const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const installer = path.join(root, 'release', `YNlogin-Setup-${pkg.version}-x64.exe`)
const blockmap = `${installer}.blockmap`
const requireSigned = process.argv.includes('--require-signed')

function fail(message) { console.error(`Release audit failed: ${message}`); process.exit(1) }
if (!fs.existsSync(installer)) fail(`installer not found: ${installer}`)
if (!fs.existsSync(blockmap)) fail(`blockmap not found: ${blockmap}`)
const bytes = fs.readFileSync(installer)
if (bytes.length < 10 * 1024 * 1024) fail('installer is unexpectedly small')
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase()

let signature = 'Unavailable'
if (process.platform === 'win32') {
  const escaped = installer.replace(/'/g, "''")
  for (const shell of ['pwsh.exe', 'powershell.exe']) {
    try {
      signature = execFileSync(shell, ['-NoProfile', '-Command', `(Get-AuthenticodeSignature -LiteralPath '${escaped}').Status.ToString()`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      break
    } catch { signature = 'Error' }
  }
}
if (requireSigned && signature !== 'Valid') fail(`Authenticode status is ${signature}; expected Valid`)

console.log(JSON.stringify({ artifact: path.basename(installer), bytes: bytes.length, sha256,
  blockmapBytes: fs.statSync(blockmap).size, authenticode: signature,
  releaseClass: signature === 'Valid' ? 'public-signed' : 'internal-qa-unsigned' }, null, 2))
