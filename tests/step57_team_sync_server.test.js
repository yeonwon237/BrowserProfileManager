const assert = require('assert')
const http = require('http')
const { EncryptedCloudSyncProvider } = require('../src/main/sync')
const { createTeamSyncServer } = require('../src/main/sync/server')

function post(port, envelope, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(envelope)
    const req = http.request({ host: '127.0.0.1', port, path: '/v1/exchange', method: 'POST', headers: {
      'content-type': 'application/json', 'content-length': Buffer.byteLength(body), authorization: `Bearer ${token}`,
    } }, (res) => { const chunks = []; res.on('data', (chunk) => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks)) })) })
    req.on('error', reject); req.end(body)
  })
}

async function run() {
  const token = 'server-token-with-at-least-24-characters'
  const observed = []
  const service = createTeamSyncServer({ token, onEncryptedBody: (raw) => observed.push(raw) })
  const address = await service.start()
  try {
    const transport = { exchange: async (envelope) => {
      const response = await post(address.port, envelope, token)
      assert.strictEqual(response.status, 200)
      return response.body
    } }
    const secret = 'shared-workspace-secret-123456'
    const deviceA = new EncryptedCloudSyncProvider({ workspaceId: 'workspace-1', secret, transport })
    const deviceB = new EncryptedCloudSyncProvider({ workspaceId: 'workspace-1', secret, transport })
    await deviceA.syncConfigurations([{ id: 'a', name: 'Device A', revision: 1 }])
    const onB = await deviceB.syncConfigurations([{ id: 'b', name: 'Device B', revision: 1 }])
    assert.deepStrictEqual(new Set(onB.records.map((record) => record.id)), new Set(['a', 'b']))
    const onA = await deviceA.syncConfigurations([{ id: 'a', name: 'Device A', revision: 1 }])
    assert.deepStrictEqual(new Set(onA.records.map((record) => record.id)), new Set(['a', 'b']))
    assert(observed.every((raw) => !raw.includes('Device A') && !raw.includes('Device B')), 'server must only receive opaque ciphertext')
    assert.strictEqual(service.store.getStats()[0].revision, 3)
    const unauthorized = await post(address.port, JSON.parse(observed[0]), 'wrong-token')
    assert.strictEqual(unauthorized.status, 401)
  } finally { await service.stop() }
  console.log('✓ Two devices exchange opaque E2E-encrypted state through authenticated Team Sync server')
}

run().catch((error) => { console.error(error); process.exit(1) })
