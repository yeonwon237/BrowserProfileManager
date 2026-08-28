# YNlogin Architecture Overview

## Layered System Architecture

```
Desktop UI (React, Tailwind CSS, Vite)
       ↓ (IPC ContextBridge via preload.js)
Application Services (Search, DataTools, Licensing, Updates, Notifications)
       ↓
Workspace / Profile Services (Workspaces, Templates, Presets, Profiles, Proxies)
       ↓
Browser Core
 ├─ Browser Adapters (Chromium, Chrome, Edge, Firefox)
 ├─ Binary Manager (Installed binary detection & resolution)
 ├─ Environment Manager (Canvas, Audio, WebGL, Geolocation, Locale, Timezone)
 ├─ Proxy Manager (HTTP, HTTPS, SOCKS5 & ProxyRuleManager load balancer)
 └─ Resource Manager & Recovery (Concurrency limiter, Crash recovery)
       ↓
Automation Platform
 ├─ Plugin SDK (Formal versioned API v1)
 ├─ Permission Manager (browser.page, browser.navigation, downloads.write)
 ├─ Sandbox Runtime (Guarded execution context, timeouts, memory boundaries)
 ├─ Queue & Concurrency Scheduler
 └─ History & Local Analytics
       ↓
Data Layer
 ├─ SQLite (sql.js with WASM export)
 ├─ Migration Manager (Versioned migrations, rollback snapshots)
 ├─ Encrypted Backup Manager (AES-256-GCM encrypted ZIP archives)
 └─ Secure Credential Manager (OS-level encryption)
```

## Directory Structure
- `src/main/`: Electron main process backend modules.
  - `browser/`: Browser process lifecycle, binaries, environment fingerprints, crash recovery.
  - `database/`: SQLite repositories, versioned migrations.
  - `automation/`: Automation manager, queue, scheduler, sandboxing, marketplace.
  - `licensing/`: Licensing tiers, feature policies, device activation.
  - `notifications/`: Local notification center.
  - `search/`: Global search indexing.
  - `dataTools/`: Bulk CSV/JSON import/export engine.
- `src/sdk/`: Formal Automation Plugin SDK.
- `src/renderer/`: React front-end application.
- `docs/`: Comprehensive developer and security specifications.
- `tests/`: Automated step-by-step test matrix.
