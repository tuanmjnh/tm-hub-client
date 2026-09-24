# tm-hub-client

Unified, isomorphic TypeScript Client SDK for **TM-Hub** (Centralized IAM, Remote Configs, Media Gateway, Push Notifications & Dedicated MongoDB Audit Logs).

[![npm version](https://img.shields.io/npm/v/tm-hub-client.svg)](https://www.npmjs.com/package/tm-hub-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Features

- **Zero External Runtime Dependencies**: Built entirely on native `fetch` and modern Web APIs.
- **Dual ESM & CommonJS Build**: Seamlessly works in Node.js, Electron, Nuxt, Vite, and modern browsers.
- **First-Class TypeScript Support**: 100% typed request payloads, responses, models, and error structures.
- **Automatic Token & Tenant Injection**: Automatically injects `X-App-Id` and `Authorization: Bearer <token>`.
- **Silent Refresh (optional)**: Pass `getRefreshToken` + `onTokensRefreshed` to auto-retry once on 401.
- **Client-side Capability Helpers**: `hub.capabilities.has()` / `canAccessApp()` / `load()` with dual-read aliases (`media.write`↔`media.upload`, `logs.read`↔`apps.logs.read`).
- **Complete Module Coverage**:
  - `auth`: Login, Register, Me, Permissions (JWT claims), Update Profile, Change Password, Refresh token, Logout, Dynamic Route Tree, List/Revoke Sessions.
  - `apps`: List, Get, Create, Update, Delete (batch), Reorder.
  - `configs`: Get Public Configs, Get App Public Configs, Get App Configs, Update App Configs.
  - `media`: Cloudinary Upload Signatures, Folder Management, Asset Listing/Deletion & Renaming.
  - `notifications`: List In-App Notifications, Mark as Read, Mark All Read, Batch Delete, Web Push Subscribe/Unsubscribe, Trigger Notifications.
  - `users`: List (cursor pagination), Create, Update, and Delete app users.
  - `roles`: Role & Permission Matrix CRUD operations.
  - `routes`: Dynamic navigation system route management.
  - `permissions`: Read-only global capability catalog (§6.4).
  - `logs` / `auditLogs`: Query dedicated MongoDB audit history logs.

Hard delete endpoints (`apps.delete`, `users.delete`, `roles.delete`) require a **root** token on the TM-Hub server. Routes are soft-deleted server-side.

---

## Installation

```bash
# Using pnpm
pnpm add tm-hub-client

# Using npm
npm install tm-hub-client

# Using yarn
yarn add tm-hub-client
```

---

## Quick Start

```typescript
import { createHubClient } from 'tm-hub-client'

const hub = createHubClient({
  baseUrl: 'https://hub.yourdomain.com', // TM-Hub instance URL
  appId: 'tm-tools',                    // Unique Satellite App identifier
  getAccessToken: () => localStorage.getItem('accessToken'),
  onUnauthorized: () => {
    // Handler when response is 401
    window.location.href = '/login'
  }
})

// 1. Fetch Remote Application Configs
const { data: configs } = await hub.configs.getAll()

// 2. Update Configs (Triggers deep diff audit logging in TM-Hub)
await hub.configs.update({
  APP_NAME: 'TM Tools Desktop',
  CLOUDINARY_CLOUD_NAME: 'my-cloud'
})

// 3. Get Media Signature for direct Cloudinary upload
const { data: sig } = await hub.media.getSignature({ folder: 'avatars' })

// 4. Query Audit History from Dedicated MongoDB Logger
const { data: auditLogs } = await hub.logs.list({ limit: 20 })
```

---

## Nuxt 3/4 Composable Pattern

In your Nuxt project, create `app/composables/useHub.ts`:

```typescript
import { createHubClient } from 'tm-hub-client'

export const useHub = () => {
  const config = useRuntimeConfig()
  const auth = useAuth()

  const client = createHubClient({
    baseUrl: config.public.hubUrl || 'http://localhost:4000',
    appId: config.public.hubAppId || 'my-app',
    getAccessToken: () => auth.accessToken.value,
    onUnauthorized: () => {
      auth.logout()
    }
  })

  return {
    client,
    auth: client.auth,
    apps: client.apps,
    configs: client.configs,
    media: client.media,
    notifications: client.notifications,
    users: client.users,
    roles: client.roles,
    routes: client.routes,
    permissions: client.permissions,
    capabilities: client.capabilities,
    logs: client.logs
  }
}
```

---

## Building & Publishing to npm

```bash
# 1. Build dual ESM + CJS bundles and type declarations
pnpm build

# 2. Dry run publish verification
npm pack --dry-run

# 3. Publish to npm public registry
npm publish --access public
```

---

## License

MIT © tuanmjnh

