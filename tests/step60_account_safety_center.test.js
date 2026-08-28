const assert = require('assert')
const profiles = require('../src/main/database/profiles')
const proxies = require('../src/main/database/proxies')
const database = require('../src/main/database')
const { evaluateProfileSafety, evaluateBatch } = require('../src/main/browser/accountSafety')

async function run() {
  const direct = await profiles.createProfile({ name: 'An toàn trực tiếp', environment: { mode: 'custom', locale: 'vi-VN', timezone: 'Asia/Ho_Chi_Minh' } })
  const directReport = await evaluateProfileSafety(direct)
  assert.strictEqual(directReport.blocked, false)
  assert(directReport.score >= 85)
  assert(directReport.risks.some((item) => item.code === 'DIRECT_CONNECTION'))

  const proxy = await proxies.createProxy({ name: 'Proxy Hoa Kỳ', protocol: 'http', host: '127.0.0.1', port: 9000, country_code: 'US', timezone: 'America/New_York', max_profiles: 1 })
  const first = await profiles.createProfile({ name: 'Một', proxy_id: proxy.id, environment: { mode: 'custom', locale: 'en-US', timezone: 'America/New_York' } })
  await profiles.createProfile({ name: 'Hai', proxy_id: proxy.id, environment: { mode: 'custom', locale: 'en-US', timezone: 'America/New_York' } })
  const sharedReport = await evaluateProfileSafety(first.id)
  assert.strictEqual(sharedReport.level, 'yellow')
  assert(sharedReport.risks.some((item) => item.code === 'PROXY_OVERUSED'))

  const missing = { ...first, id: 'missing-proxy-profile', proxy_id: 'does-not-exist' }
  const blocked = await evaluateProfileSafety(missing)
  assert.strictEqual(blocked.blocked, true)
  assert.strictEqual(blocked.level, 'red')
  assert(blocked.risks.some((item) => item.code === 'PROXY_MISSING'))

  const batch = await evaluateBatch([direct.id, first.id])
  assert.strictEqual(batch.length, 2)
  database.closeDb()
  console.log('✓ Trung tâm An toàn Tài khoản chấm điểm, cảnh báo proxy dùng chung và chặn cấu hình nghiêm trọng')
}

run().catch((error) => { console.error(error); process.exit(1) })
