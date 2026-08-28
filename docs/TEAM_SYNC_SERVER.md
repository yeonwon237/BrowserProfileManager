# Team Sync server

`src/main/sync/server.js` provides the reference synchronization service. It stores only AES-256-GCM envelopes and cannot read profile names, metadata, secrets, cookies, or browser session data.

Production requirements:

- supply a bearer token of at least 24 characters;
- expose `/v1/exchange` only over HTTPS;
- provide a persistence path on encrypted, backed-up storage;
- rotate bearer tokens through a secret manager;
- place normal infrastructure rate limiting and monitoring in front of the service.

Without a TLS certificate the server deliberately binds only to loopback, which is suitable for development and integration tests.

Start it with `npm run team-sync:server`. Configuration is supplied through `YNLOGIN_SYNC_TOKEN`, `YNLOGIN_SYNC_HOST`, `YNLOGIN_SYNC_PORT`, `YNLOGIN_SYNC_DATA`, `YNLOGIN_SYNC_TLS_CERT`, and `YNLOGIN_SYNC_TLS_KEY`.
