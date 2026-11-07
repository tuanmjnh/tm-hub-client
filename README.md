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
  - `docs`: Reference docs content for the admin docs page (single source of truth lives in TM-Hub).
  - `connections`: Per-app provider credentials (list, save manual, quick connect, test, disconnect, OAuth start).
  - `imports`: Data import targets, preview, run and Google Sheets fetch (server-side proxy).
  - `ai`: AI provider catalogue, credentials, model catalogue, discovery and grants (R147).
  - `ai.relay`: server-to-server chat through a connection (images/PDF attachments allowed) so satellite backends never hold provider keys.
  - `storage`: server-to-server object storage (R2 / S3 / Supabase) — app-scoped upload/download grants, object manifest, folders and copy; provider credentials never leave the hub.
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
    logs: client.logs,
    ai: client.ai
  }
}
```

---

## AI Relay (server-to-server)

The relay is how a satellite backend uses AI without storing any provider key:
TM-Hub decrypts its own credential, calls the provider and returns the answer.
Authentication is the **app itself** (`X-App-Id` + `X-App-Secret`), so build
this client on the server only and pass `getAppSecret`.

```typescript
const hub = createHubClient({
  baseUrl: 'https://hub.yourdomain.com',
  appId: process.env.HUB_APP_ID!,
  getAppSecret: () => process.env.HUB_APP_SECRET   // never expose this to the browser
})

// Which connections/models this app may use (own rows + enabled grants)
const { data } = await hub.ai.relay.catalog()

// Text turn — systemPrompt is prepended as a system message
const { data: answer } = await hub.ai.relay.chat({
  connectionId: data.connections[0].connectionId,
  model: 'gemini-3.5-flash',
  systemPrompt: 'Answer in one sentence.',
  messages: [{ role: 'user', content: 'What is a pdf?' }],
  maxTokens: 512,
  temperature: 0.1
})

// Vision turn — attachments are base64 strings (no `data:` prefix).
// Hub limits: 4 attachments per message, 8 MB base64 each, 12 MB per turn,
// mime types png / jpeg / webp / pdf.
const { data: read } = await hub.ai.relay.chat({
  connectionId: data.connections[0].connectionId,
  messages: [{
    role: 'user',
    content: 'Return the table as JSON.',
    attachments: [{ mimeType: 'image/png', data: pngBase64 }]
  }]
})

console.log(read.content, read.provider, read.model, read.usage)
```

`ai.relay.*` throws before hitting the network when `getAppSecret` is missing,
and the hub answers 404 when a connection is not usable by this app.

---

## Storage Gateway (server-to-server)

Generic object storage over Cloudflare R2, AWS S3 or Supabase Storage. Like the
relay, authentication is the **app itself** (`X-App-Id` + `X-App-Secret`): build
this client on the server only and pass `getAppSecret`. Provider credentials are
decrypted inside the hub and never returned; callers receive only short-lived,
object-scoped upload/download grants.

> **Signed URLs are bearer secrets.** Never log them, put them in `runtimeConfig.public`,
> or persist them in localStorage / a database. Objects are addressed by `objectId`;
> the internal provider `objectKey` is not part of the public manifest view.

```typescript
const hub = createHubClient({
  baseUrl: 'https://hub.yourdomain.com',
  appId: process.env.HUB_APP_ID!,
  getAppSecret: () => process.env.HUB_APP_SECRET   // server-side only
})

// 1. Which storage connections this app may use (own rows + enabled grants)
const { data: inv } = await hub.storage.connections()
const connectionId = inv.connections[0].connectionId

// 2. Initiate an upload — returns a short-lived grant (transferMode: 'single')
const { data: grant } = await hub.storage.initUpload({
  connectionId,
  namespace: 'tm-tools/pdf',
  relativePath: 'invoices/2026-001.pdf',
  contentType: 'application/pdf',
  sizeBytes: pdfBuffer.byteLength
})

// 3. PUT the bytes directly to the provider using the grant (server or browser)
await fetch(grant.uploadUrl, {
  method: grant.method,
  headers: grant.headers,
  body: pdfBuffer
})

// 4. Complete — the hub verifies via independent HEAD (size/type/checksum), marks ready
const { data: done } = await hub.storage.completeUpload(grant.uploadId)
// done.object is the ready manifest row (or null if verification failed)

// 5. Later: a short-lived download grant
const { data: dl } = await hub.storage.createDownloadGrant(done.object!.objectId)
// fetch(dl.downloadUrl) before dl.expiresAt

// Listing / stat / folders / copy / delete
const { data: page } = await hub.storage.listObjects({ connectionId, namespace: 'tm-tools/pdf', limit: 50 })
// page.nextCursor feeds back as `cursor` for the next page
await hub.storage.getObject(objectId)
await hub.storage.createFolder({ connectionId, namespace: 'tm-tools/pdf', relativePath: 'invoices' })
await hub.storage.listFolders({ connectionId, namespace: 'tm-tools/pdf' })
await hub.storage.copyObject(objectId, { relativePath: 'invoices/renamed.pdf' })
await hub.storage.deleteObject(objectId)
await hub.storage.abortUpload(grant.uploadId)   // clean up an unfinished upload
```

Every method accepts a trailing `appId?` override (defaults to the client's `appId`).
`storage.*` throws before hitting the network when `getAppSecret` is missing. Errors
use stable `storage.*` codes (e.g. `storage.object_not_found`, `storage.upload_expired`,
`storage.namespace_not_allowed`) surfaced via `error.statusCode` / `error.data`.
Multipart upload is not exposed yet (`capabilities.multipartUpload` is `false`).

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

