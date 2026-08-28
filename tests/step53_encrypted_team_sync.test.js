const assert = require('assert')
const initSqlJs = require('sql.js')
const { EncryptedCloudSyncProvider, ProfileLeaseService, sealPayload, openPayload } = require('../src/main/sync')

async function run() {
  const secret = 'workspace-secret-at-least-16-chars'
  const envelope = sealPayload({ records: [{ id: 'p1', name: 'A' }] }, secret, 'ws-1')
  assert(!JSON.stringify(envelope).includes('"name":"A"'))
  assert.strictEqual(openPayload(envelope, secret).records[0].name, 'A')
  assert.throws(() => openPayload({ ...envelope, tag: Buffer.alloc(16).toString('base64') }, secret))
  const transport = { async exchange(outbound) {
    const request = openPayload(outbound, secret)
    assert.strictEqual(request.records[0].browser_data_path, undefined)
    assert.strictEqual(request.records[0].proxy, undefined)
    return sealPayload({ cursor: 'next-2', records: [{ id: 'p1', name: 'Remote newer', revision: 2 }, { id: 'p2', name: 'Remote only', revision: 1 }] }, secret, 'ws-1')
  } }
  const provider = new EncryptedCloudSyncProvider({ workspaceId: 'ws-1', secret, transport })
  const result = await provider.syncConfigurations([{ id: 'p1', name: 'Local', revision: 1, browser_data_path: 'C:/secret', proxy: { password: 'secret' } }])
  assert.strictEqual(result.records.find((record) => record.id === 'p1').name, 'Remote newer')
  assert.strictEqual(result.cursor, 'next-2')

  const SQL = await initSqlJs(); const db = new SQL.Database()
  db.run(`CREATE TABLE profile_leases (profile_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, lease_token TEXT NOT NULL UNIQUE, acquired_at DATETIME NOT NULL, expires_at DATETIME NOT NULL, metadata TEXT DEFAULT '{}')`)
  let now = Date.parse('2026-08-24T00:00:00Z')
  const leases = new ProfileLeaseService({ getDb: async () => db, saveDb: () => {}, now: () => now })
  const first = await leases.acquire('p1', 'device-a', { ttlMs: 10_000 })
  assert(first.acquired && first.token)
  assert.strictEqual((await leases.acquire('p1', 'device-b')).conflict, true)
  assert.strictEqual((await leases.renew('p1', 'wrong-token')).renewed, false)
  assert.strictEqual((await leases.renew('p1', first.token, 20_000)).renewed, true)
  assert.strictEqual((await leases.release('p1', 'wrong-token')).released, false)
  assert.strictEqual((await leases.release('p1', first.token)).released, true)
  const expiring = await leases.acquire('p1', 'device-a', { ttlMs: 5_000 }); now += 6_000
  assert.strictEqual((await leases.renew('p1', expiring.token)).renewed, false)
  assert.strictEqual((await leases.acquire('p1', 'device-b')).acquired, true)
  db.close()
  console.log('✓ E2E encrypted revision sync, tamper detection, metadata minimization and profile leases verified')
}
run().catch((error) => { console.error(error); process.exit(1) })
