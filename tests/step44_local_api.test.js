const assert = require('assert')
const path = require('path')
const os = require('os')

process.env.APPDATA = path.join(os.tmpdir(), `ynlogin-api-test-${Date.now()}`)
process.env.NODE_ENV = 'test'

const localApi = require('../src/main/api/server')
const { closeDb } = require('../src/main/database')

async function request(port, pathname, token) {
  return fetch(`http://127.0.0.1:${port}${pathname}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

async function run() {
  const status = await localApi.start({ port: 53144 })
  assert.strictEqual(status.running, true)
  assert.strictEqual(status.host, '127.0.0.1')

  const denied = await request(status.port, '/api/v1/health')
  assert.strictEqual(denied.status, 401)

  const token = await localApi.revealToken()
  assert(token.length >= 32)
  const health = await request(status.port, '/api/v1/health', token)
  assert.strictEqual(health.status, 200)
  assert.strictEqual((await health.json()).ok, true)

  const profiles = await request(status.port, '/api/v1/profiles', token)
  assert.strictEqual(profiles.status, 200)
  assert(Array.isArray((await profiles.json()).profiles))

  await localApi.stop()
  closeDb()
  console.log('✓ Loopback-only Local API, bearer authentication and core routes verified')
}

run().catch(async (err) => { await localApi.stop(); console.error(err); process.exit(1) })
