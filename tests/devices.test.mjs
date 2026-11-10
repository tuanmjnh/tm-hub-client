import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HubClient } from '../dist/index.js'

// Contract tests for Device Registry v2 SDK surface against a mocked fetch.
// These assert the wire contract (path, method, headers, body) — not live Hub
// behavior. Run after `pnpm build`.

const APP = 'tm-tools_4e2ygb'
const BASE = 'http://localhost:4000'

function setup({ appId = APP, payload = { success: true, data: {} }, status = 200, opts = {} } = {}) {
  const calls = []
  const fetch = async (url, init = {}) => {
    const headers = init.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : { ...(init.headers || {}) }
    let body = init.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { /* keep raw */ }
    }
    calls.push({ url, method: init.method || 'GET', headers, body })
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  const client = new HubClient({ baseUrl: BASE, appId, fetch, ...opts })
  return { client, calls }
}

test('login carries the nested device object and requestDeviceCredential', async () => {
  const { client, calls } = setup({ payload: { success: true, data: { accessToken: 'a', refreshToken: 'r', expiresIn: 900, user: { id: 'u', permissions: [] } } } })
  await client.auth.login({
    email: 'user@example.test',
    password: 'secret',
    device: {
      deviceId: 'dev-1',
      identityKind: 'electron-machine',
      deviceType: 'desktop',
      platform: 'desktop',
      osPlatform: 'win32'
    },
    requestDeviceCredential: true
  })
  const call = calls[0]
  assert.equal(call.url, `${BASE}/api/v1/auth/login`)
  assert.equal(call.method, 'POST')
  assert.equal(call.body.appId, APP)
  assert.equal(call.body.device.deviceId, 'dev-1')
  assert.equal(call.body.device.identityKind, 'electron-machine')
  assert.equal(call.body.requestDeviceCredential, true)
})

test('login still accepts the legacy platform/deviceId shape', async () => {
  const { client, calls } = setup({ payload: { success: true, data: { accessToken: 'a', refreshToken: 'r', expiresIn: 900, user: { id: 'u', permissions: [] } } } })
  await client.auth.login({ email: 'u@e.test', password: 'x', platform: 'desktop', deviceId: 'legacy-1' })
  assert.equal(calls[0].body.platform, 'desktop')
  assert.equal(calls[0].body.deviceId, 'legacy-1')
  assert.equal(calls[0].body.device, undefined)
})

test('devices.list hits /auth/user-devices and forwards currentDeviceId', async () => {
  const { client, calls } = setup({ payload: { success: true, data: [] } })
  await client.auth.devices.list({ currentDeviceId: 'dev-1' })
  assert.equal(calls[0].method, 'GET')
  assert.match(calls[0].url, /\/api\/v1\/auth\/user-devices\?currentDeviceId=dev-1$/)
})

test('devices.get/update/revoke use the user-devices path with encoded deviceId', async () => {
  const { client, calls } = setup({ payload: { success: true, data: {} } })
  await client.auth.devices.get('dev/1')
  await client.auth.devices.update('dev/1', { deviceName: 'Renamed' })
  await client.auth.devices.revoke('dev/1')

  assert.equal(calls[0].method, 'GET')
  assert.match(calls[0].url, /\/api\/v1\/auth\/user-devices\/dev%2F1$/)
  assert.equal(calls[1].method, 'PATCH')
  assert.deepEqual(calls[1].body, { deviceName: 'Renamed' })
  assert.equal(calls[2].method, 'DELETE')
})

test('adminDevices.list/update/revoke use the app-scoped path', async () => {
  const { client, calls } = setup({ payload: { success: true, data: [] } })
  await client.auth.adminDevices.list('app-1', 'user-1')
  await client.auth.adminDevices.update('app-1', 'user-1', 'dev-1', { action: 'block' })
  await client.auth.adminDevices.revoke('app-1', 'user-1', 'dev-1')

  assert.match(calls[0].url, /\/api\/v1\/apps\/app-1\/users\/user-1\/user-devices$/)
  assert.equal(calls[1].method, 'PATCH')
  assert.deepEqual(calls[1].body, { action: 'block' })
  assert.equal(calls[2].method, 'DELETE')
})

test('jwks fetches public keys without an app secret', async () => {
  const { client, calls } = setup({ payload: { keys: [{ kty: 'RSA', kid: 'hub-1', n: 'x', e: 'AQAB' }] } })
  const res = await client.auth.jwks()
  assert.equal(calls[0].url, `${BASE}/api/v1/auth/jwks`)
  assert.equal(calls[0].headers['x-app-secret'], undefined)
  assert.equal(res.keys[0].kid, 'hub-1')
})

test('service calls prefer a device credential over the app secret', async () => {
  const { client, calls } = setup({
    payload: { success: true, data: { ok: true } },
    opts: {
      getAppSecret: () => 'should-not-be-used',
      getDeviceCredential: () => ({ deviceId: 'dev-1', secret: 'dev-secret' })
    }
  })
  await client.ai.relay.catalog()
  const call = calls[0]
  assert.equal(call.headers['x-device-id'], 'dev-1')
  assert.equal(call.headers['x-device-secret'], 'dev-secret')
  assert.equal(call.headers['x-app-secret'], undefined)
})
