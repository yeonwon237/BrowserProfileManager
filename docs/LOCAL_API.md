# YNlogin Local API v1

The local API listens on `http://127.0.0.1:53000/api/v1` by default. It never binds to LAN interfaces. Every request, including health checks, requires the token shown by the desktop app IPC/settings integration.

## Authentication

```http
Authorization: Bearer <local-api-token>
```

The token is generated with 256 bits of randomness and encrypted at rest. Do not put it in source code or share it with remote services.

## Endpoints

- `GET /health`
- `GET /profiles`
- `GET /profiles/{id}/status`
- `POST /profiles/{id}/start`
- `POST /profiles/{id}/stop`
- `GET /profiles/{id}/connection`
- `GET /profiles/{id}/cookies?format=json|netscape`
- `POST /profiles/{id}/cookies`

Start an automation-ready profile:

```json
{
  "headless": false,
  "automation": true,
  "windowLayout": true
}
```

The response includes a loopback-only CDP connection when `automation` is enabled:

```json
{
  "success": true,
  "id": "profile-id",
  "connection": {
    "type": "cdp",
    "host": "127.0.0.1",
    "port": 53123,
    "webSocketDebuggerUrl": "ws://127.0.0.1:53123/devtools/browser/..."
  }
}
```

Connect with Playwright:

```js
const browser = await chromium.connectOverCDP(result.connection.webSocketDebuggerUrl)
```

Cookie import body:

```json
{
  "format": "json",
  "mode": "merge",
  "skipInvalid": true,
  "input": [{ "domain": ".example.com", "path": "/", "name": "sid", "value": "..." }]
}
```

Allowed modes are `merge`, `replace-domains`, and `replace-all`.
