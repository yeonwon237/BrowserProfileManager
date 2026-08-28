const PROTOCOLS = ['http', 'https', 'socks5']

function parseUrlFormat(raw, defaultProtocol) {
  let protocol = defaultProtocol
  let rest = raw
  const protoMatch = raw.match(/^(https?|socks5):\/\//i)
  if (protoMatch) {
    protocol = protoMatch[1].toLowerCase()
    rest = raw.slice(protoMatch[0].length)
  }

  let username = null
  let password = null
  let hostPort = rest
  const atIdx = rest.lastIndexOf('@')
  if (atIdx !== -1) {
    const cred = rest.slice(0, atIdx)
    hostPort = rest.slice(atIdx + 1)
    const colon = cred.indexOf(':')
    if (colon === -1) {
      username = cred || null
    } else {
      username = cred.slice(0, colon) || null
      password = cred.slice(colon + 1) || null
    }
  }

  let host
  let port
  if (hostPort.startsWith('[')) {
    const close = hostPort.indexOf(']')
    if (close === -1) return null
    host = hostPort.slice(1, close)
    const portPart = hostPort.slice(close + 1)
    if (!portPart.startsWith(':')) return null
    port = portPart.slice(1)
  } else {
    const lastColon = hostPort.lastIndexOf(':')
    if (lastColon === -1) return null
    host = hostPort.slice(0, lastColon)
    port = hostPort.slice(lastColon + 1)
  }

  if (!host || !/^\d+$/.test(port) || Number(port) <= 0 || Number(port) > 65535) return null

  return {
    protocol,
    host,
    port: Number(port),
    username: username || null,
    password: password || null,
  }
}

function parseColonFormat(raw, defaultProtocol) {
  const parts = raw.split(':')
  if (parts.length < 2) return null
  const host = parts[0]
  const port = parts[1]
  if (!host || !/^\d+$/.test(port) || Number(port) <= 0 || Number(port) > 65535) return null

  const username = parts.length >= 3 ? parts[2] : null
  const password = parts.length >= 4 ? parts.slice(3).join(':') : null

  return {
    protocol: defaultProtocol,
    host,
    port: Number(port),
    username: username || null,
    password: password || null,
  }
}

function parseProxyLine(line, defaultProtocol = 'http') {
  const raw = String(line || '').trim()
  if (!raw) return null

  const hasScheme = /^(https?|socks5):\/\//i.test(raw)
  const hasAt = raw.includes('@')

  if (hasScheme || hasAt || raw.startsWith('[')) {
    return parseUrlFormat(raw, defaultProtocol)
  }

  return parseColonFormat(raw, defaultProtocol)
}

export function parseProxyList(text, defaultProtocol = 'http') {
  const lines = String(text || '')
    .split(/[\n,;]+/)
    .map((l) => l.trim())
    .filter(Boolean)

  const parsed = []
  const invalid = []

  lines.forEach((line) => {
    const result = parseProxyLine(line, defaultProtocol)
    if (result) parsed.push(result)
    else invalid.push(line)
  })

  return { parsed, invalid }
}

export function proxyUrl(proxy) {
  const proto = PROTOCOLS.includes(proxy.protocol) ? proxy.protocol : 'http'
  let url = `${proto}://`
  if (proxy.username) {
    url += proxy.username
    if (proxy.password) url += `:${proxy.password}`
    url += '@'
  }
  const host = proxy.host.includes(':') ? `[${proxy.host}]` : proxy.host
  return url + `${host}:${proxy.port}`
}

export { PROTOCOLS }