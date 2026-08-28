const { spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const testsDir = __dirname
const files = fs.readdirSync(testsDir).filter((name) => /^step\d+.*\.test\.js$/.test(name)).sort()
let failed = 0

for (const file of files) {
  console.log(`\n=== ${file} ===`)
  const env = {
    ...process.env,
    APPDATA: path.join(os.tmpdir(), `ynlogin-suite-${path.parse(file).name}-${Date.now()}`),
  }
  const result = spawnSync(process.execPath, [path.join(testsDir, file)], {
    cwd: path.join(testsDir, '..'),
    env,
    stdio: 'inherit',
  })
  if (result.status !== 0) failed++
}

if (failed > 0) {
  console.error(`\n${failed} test file(s) failed`)
  process.exit(1)
}

console.log(`\nAll ${files.length} step test files passed`)
