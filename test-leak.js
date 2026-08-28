const path = require('path')
process.env.APPDATA = path.join(require('os').tmpdir(), 'ynlogin-leak-test')

const { getDb, closeDb } = require('./src/main/database')
const leakProtection = require('./src/main/browser/leakProtection')
const { getSetting, setSetting } = require('./src/main/settings')

async function run() {
  await getDb()

  console.log('=== LAUNCH ARGS WITH PROXY ===')
  const argsWithProxy = leakProtection.getLaunchArgs({ proxyActive: true })
  console.log(argsWithProxy)
  if (argsWithProxy.length !== 2) throw new Error('FAIL: expected 2 args with proxy')
  if (!argsWithProxy[0].includes('disable_non_proxied_udp')) throw new Error('FAIL: proxy policy not applied')
  if (!argsWithProxy[1].includes('force-webrtc-ip-handling-policy')) throw new Error('FAIL: force flag missing')

  console.log('\n=== LAUNCH ARGS WITHOUT PROXY ===')
  const argsNoProxy = leakProtection.getLaunchArgs({ proxyActive: false })
  console.log(argsNoProxy)
  if (!argsNoProxy[0].includes('default_public_interface_only')) throw new Error('FAIL: no-proxy policy not applied')

  console.log('\n=== INIT SCRIPT CONTENT ===')
  const script = leakProtection.WEBRTC_INIT_SCRIPT
  if (!script || script.length < 200) throw new Error('FAIL: init script too short')
  for (const needle of [
    'RTCPeerConnection',
    'createOffer',
    'createAnswer',
    'setLocalDescription',
    'isPrivateIP',
    '.local',
  ]) {
    if (!script.includes(needle)) throw new Error(`FAIL: init script missing "${needle}"`)
  }
  console.log('init script contains all expected patches')

  console.log('\n=== ENABLED BY DEFAULT ===')
  const enabledDefault = await leakProtection.isEnabled()
  console.log(`enabled=${enabledDefault}`)
  if (enabledDefault !== true) throw new Error('FAIL: leak protection should be enabled by default')

  console.log('\n=== DISABLED VIA SETTING ===')
  await setSetting('leakProtectionEnabled', 'false')
  const disabled = await leakProtection.isEnabled()
  const scriptDisabled = await leakProtection.getWebRtcInitScript()
  console.log(`enabled=${disabled}, initScript=${scriptDisabled === null ? 'null' : 'present'}`)
  if (disabled !== false) throw new Error('FAIL: setting false did not disable')
  if (scriptDisabled !== null) throw new Error('FAIL: init script should be null when disabled')
  await setSetting('leakProtectionEnabled', 'true')
  const scriptReEnabled = await leakProtection.getWebRtcInitScript()
  if (scriptReEnabled === null) throw new Error('FAIL: init script not restored after re-enable')

  console.log('\n=== SETTING PERSISTED ===')
  const stored = await getSetting('leakProtectionEnabled')
  console.log(`stored=${stored}`)
  if (stored !== 'true') throw new Error('FAIL: setting not persisted')

  console.log('\n=== ALL LEAK PROTECTION TESTS PASSED ===')
  closeDb()
}

run().catch((err) => {
  console.error('LEAK PROTECTION TEST FAILED:', err.message)
  closeDb()
  process.exit(1)
})