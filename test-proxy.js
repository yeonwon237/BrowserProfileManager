const path = require('path')
process.env.APPDATA = path.join(require('os').tmpdir(), 'ynlogin-proxy-test')

const { getDb, closeDb } = require('./src/main/database')
const proxiesRepo = require('./src/main/database/proxies')
const profilesRepo = require('./src/main/database/profiles')

async function run() {
  await getDb()

  console.log('=== CREATE PROXY ===')
  const p1 = await proxiesRepo.createProxy({
    name: 'HTTP Proxy',
    protocol: 'http',
    host: 'proxy.example.com',
    port: 8080,
    username: 'user1',
    password: 'supersecret',
    notes: 'main proxy',
  })
  const p2 = await proxiesRepo.createProxy({
    name: 'SOCKS5 Proxy',
    protocol: 'socks5',
    host: '10.0.0.1',
    port: 1080,
    username: null,
    password: null,
  })
  console.log(`Created: ${p1.name} [${p1.protocol}] ${p1.host}:${p1.port} has_password=${p1.has_password}`)
  console.log(`Created: ${p2.name} [${p2.protocol}]`)
  if (!p1.id) throw new Error('FAIL: no id')

  console.log('\n=== PASSWORD NOT STORED PLAINTEXT ===')
  const db = await getDb()
  const raw = db.exec('SELECT encrypted_password FROM proxies WHERE id = ?', [p1.id])
  const stored = raw[0].values[0][0]
  console.log(`stored value: ${stored}`)
  if (!stored) throw new Error('FAIL: nothing stored')
  if (stored.includes('supersecret')) throw new Error('FAIL: password stored as plaintext!')

  console.log('\n=== GET CONFIG DECRYPTS PASSWORD ===')
  const config = await proxiesRepo.getProxyConfig(p1.id)
  console.log(`config: ${JSON.stringify(config)}`)
  if (config.server !== 'http://proxy.example.com:8080') throw new Error('FAIL: bad server string')
  if (config.password !== 'supersecret') throw new Error('FAIL: password not decrypted correctly')

  console.log('\n=== SOCKS5 SERVER STRING ===')
  const config2 = await proxiesRepo.getProxyConfig(p2.id)
  if (config2.server !== 'socks5://10.0.0.1:1080') throw new Error('FAIL: socks5 server string')

  console.log('\n=== UPDATE PROXY ===')
  const updated = await proxiesRepo.updateProxy(p1.id, { port: 9090 })
  console.log(`Updated port → ${updated.port}`)
  if (updated.port !== 9090) throw new Error('FAIL: update port')

  console.log('\n=== PROFILE LINKS PROXY ===')
  const prof = await profilesRepo.createProfile({ name: 'Proxy Profile', proxy_id: p1.id })
  const fetched = await profilesRepo.getProfileById(prof.id)
  console.log(`profile.proxy = ${fetched.proxy ? fetched.proxy.name : 'none'}`)
  if (!fetched.proxy || fetched.proxy.id !== p1.id) throw new Error('FAIL: profile did not resolve proxy')

  console.log('\n=== DELETE PROXY UNLINKS PROFILES ===')
  const del = await proxiesRepo.deleteProxy(p1.id)
  console.log(`deleted=${del.success}`)
  const refetched = await profilesRepo.getProfileById(prof.id)
  if (refetched.proxy_id !== null) throw new Error('FAIL: profile proxy_id not cleared on proxy delete')

  console.log('\n=== ALL PROXY TESTS PASSED ===')
  closeDb()
}

run().catch((err) => {
  console.error('PROXY TEST FAILED:', err.message)
  closeDb()
  process.exit(1)
})