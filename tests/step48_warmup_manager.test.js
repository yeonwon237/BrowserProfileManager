const assert = require('assert')
const warmup = require('../src/main/warmup/manager')

async function run() {
  assert.strictEqual(warmup.isPrivateIp('127.0.0.1'), true)
  assert.strictEqual(warmup.isPrivateIp('192.168.1.5'), true)
  assert.strictEqual(warmup.isPrivateIp('8.8.8.8'), false)
  await assert.rejects(() => warmup.validateUrl('http://localhost/admin', { skipDns: true }), /private|loopback/i)
  await assert.rejects(() => warmup.validateUrl('file:///etc/passwd', { skipDns: true }), /protocol/i)
  await assert.rejects(() => warmup.validateUrl('https://user:pass@example.com/', { skipDns: true }), /credentials/i)
  assert.strictEqual(await warmup.validateUrl('https://example.com/path#fragment', { skipDns: true }), 'https://example.com/path')

  const visited = []
  const fakePage = {
    goto: async (url) => {
      visited.push(url)
      if (url.includes('fail')) throw new Error('Synthetic navigation failure')
      return { status: () => 200 }
    },
    evaluate: async () => {},
  }
  const progress = []
  const report = await warmup.executeSequence(fakePage, ['https://example.com/', 'https://fail.example/'], {
    dwellMinMs: 0, dwellMaxMs: 0, onProgress: (items) => progress.push(items.length),
  })
  assert.deepStrictEqual(visited, ['https://example.com/', 'https://fail.example/'])
  assert.strictEqual(report[0].ok, true)
  assert.strictEqual(report[1].ok, false)
  assert.deepStrictEqual(progress, [1, 2])

  const controller = new AbortController()
  controller.abort()
  await assert.rejects(() => warmup.executeSequence(fakePage, ['https://example.com/'], { signal: controller.signal }), /cancelled/i)
  console.log('✓ Warmup URL safety, sequencing, progress, failure isolation and cancellation verified')
}

run().catch((err) => { console.error(err); process.exit(1) })
