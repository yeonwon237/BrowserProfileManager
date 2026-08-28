const fs = require('fs')
const path = require('path')
const { OpaqueSyncStore, createTeamSyncServer } = require('../src/main/sync/server')

const token = process.env.YNLOGIN_SYNC_TOKEN || ''
const host = process.env.YNLOGIN_SYNC_HOST || '127.0.0.1'
const port = Number(process.env.YNLOGIN_SYNC_PORT || 8443)
const persistencePath = path.resolve(process.env.YNLOGIN_SYNC_DATA || path.join(process.cwd(), 'team-sync-data.json'))
const certPath = process.env.YNLOGIN_SYNC_TLS_CERT
const keyPath = process.env.YNLOGIN_SYNC_TLS_KEY
const tls = certPath && keyPath ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) } : null

const service = createTeamSyncServer({ token, host, port, tls, store: new OpaqueSyncStore({ persistencePath }) })
service.start().then((address) => {
  const protocol = tls ? 'https' : 'http'
  console.log(`YNlogin Team Sync listening at ${protocol}://${address.address}:${address.port}/v1/exchange`)
}).catch((error) => { console.error(error.message); process.exit(1) })

async function shutdown() { await service.stop(); process.exit(0) }
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
