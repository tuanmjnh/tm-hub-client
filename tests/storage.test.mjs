import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HubClient } from '../dist/index.js'

// Contract tests for client.storage against mocked Hub routes. These assert the
// wire contract (path, method, headers, body, querystring) and the typed response
// pass-through — not live provider behavior. Run after `pnpm build`.

const APP = 'tm-tools_4e2ygb'
const OTHER = 'tm-trading_8pmp33'
const SECRET = 'test-app-secret'
const BASE = 'http://localhost:4000'

function setup({ appId = APP, secret = SECRET, status = 200, payload = { success: true, data: {} } } = {}) {
  const calls = []
  const fetch = async (url, init = {}) => {
    const headers = init.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : { ...(init.headers || {}) }
    let body = init.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { /* keep raw string */ }
    }
    calls.push({ url, method: init.method || 'GET', headers, body })
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  const client = new HubClient({
    baseUrl: BASE,
    appId,
    fetch,
    getAppSecret: secret === null ? undefined : () => secret
  })
  return { client, calls }
}

const objectInfo = {
  objectId: 'obj-1',
  connectionId: 'conn-1',
  namespace: 'tm-tools/pdf',
  relativePath: 'invoices/a.pdf',
  fileName: 'a.pdf',
  contentType: 'application/pdf',
  sizeBytes: 1024,
  status: 'ready',
  createdAt: '2026-11-07T00:00:00.000Z',
  updatedAt: '2026-11-07T00:00:00.000Z'
}

test('connections: GET sanitized inventory with app-secret headers', async () => {
  const connections = [{ connectionId: 'conn-1', provider: 'aws_s3', name: 'main', label: null, environment: 'production', origin: 'own', capabilities: { directUpload: true, directDownload: true, multipartUpload: false, rangeRead: true, copyObject: true, listObjects: true } }]
  const { client, calls } = setup({ payload: { success: true, data: { connections } } })
  const res = await client.storage.connections()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[0].url, `${BASE}/api/v1/apps/${APP}/storage/connections`)
  assert.equal(calls[0].headers['x-app-id'], APP)
  assert.equal(calls[0].headers['x-app-secret'], SECRET)
  assert.deepEqual(res.data.connections, connections)
})

test('initUpload: POST body and grant pass-through', async () => {
  const grant = { uploadId: 'up-1', objectId: 'obj-1', connectionId: 'conn-1', objectKey: 'apps/x/production/ns/a.pdf', method: 'PUT', uploadUrl: 'https://signed.example/upload', headers: { 'Content-Type': 'application/pdf' }, expiresAt: '2026-11-07T00:15:00.000Z', maxBytes: 1024, transferMode: 'single' }
  const input = { connectionId: 'conn-1', namespace: 'tm-tools/pdf', relativePath: 'invoices/a.pdf', contentType: 'application/pdf', sizeBytes: 1024, overwrite: false }
  const { client, calls } = setup({ payload: { success: true, data: grant } })
  const res = await client.storage.initUpload(input)
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].url, `${BASE}/api/v1/apps/${APP}/storage/uploads/initiate`)
  assert.deepEqual(calls[0].body, input)
  assert.equal(calls[0].headers['x-app-secret'], SECRET)
  assert.equal(res.data.transferMode, 'single')
  assert.equal(res.data.uploadUrl, grant.uploadUrl)
})

test('completeUpload: POST uploadId path, ready result', async () => {
  const data = { uploadId: 'up-1', status: 'ready', object: objectInfo }
  const { client, calls } = setup({ payload: { success: true, data } })
  const res = await client.storage.completeUpload('up-1')
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].url, `${BASE}/api/v1/apps/${APP}/storage/uploads/up-1/complete`)
  assert.equal(calls[0].body, undefined)
  assert.equal(res.data.status, 'ready')
  assert.equal(res.data.object.objectId, 'obj-1')
})

test('abortUpload: POST uploadId path, aborted result', async () => {
  const { client, calls } = setup({ payload: { success: true, data: { uploadId: 'up-1', status: 'aborted' } } })
  const res = await client.storage.abortUpload('up-1')
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].url, `${BASE}/api/v1/apps/${APP}/storage/uploads/up-1/abort`)
  assert.equal(res.data.status, 'aborted')
})

test('createDownloadGrant: POST objectId path, grant pass-through', async () => {
  const grant = { objectId: 'obj-1', downloadUrl: 'https://signed.example/download', expiresAt: '2026-11-07T00:05:00.000Z', contentType: 'application/pdf', contentLength: 1024, fileName: 'a.pdf' }
  const { client, calls } = setup({ payload: { success: true, data: grant } })
  const res = await client.storage.createDownloadGrant('obj-1')
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].url, `${BASE}/api/v1/apps/${APP}/storage/objects/obj-1/download-grant`)
  assert.equal(res.data.downloadUrl, grant.downloadUrl)
})

test('getObject: GET objectId path, object wrapper', async () => {
  const { client, calls } = setup({ payload: { success: true, data: { object: objectInfo } } })
  const res = await client.storage.getObject('obj-1')
  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[0].url, `${BASE}/api/v1/apps/${APP}/storage/objects/obj-1`)
  assert.equal(res.data.object.objectId, 'obj-1')
})

test('listObjects: GET with querystring params and cursor', async () => {
  const data = { objects: [objectInfo], nextCursor: 'invoices/b.pdf' }
  const { client, calls } = setup({ payload: { success: true, data } })
  const res = await client.storage.listObjects({ connectionId: 'conn-1', namespace: 'tm-tools/pdf', prefix: 'invoices/', cursor: 'invoices/a.pdf', limit: 25 })
  assert.equal(calls[0].method, 'GET')
  const url = new URL(calls[0].url)
  assert.equal(url.pathname, `/api/v1/apps/${APP}/storage/objects`)
  assert.equal(url.searchParams.get('connectionId'), 'conn-1')
  assert.equal(url.searchParams.get('namespace'), 'tm-tools/pdf')
  assert.equal(url.searchParams.get('prefix'), 'invoices/')
  assert.equal(url.searchParams.get('cursor'), 'invoices/a.pdf')
  assert.equal(url.searchParams.get('limit'), '25')
  assert.equal(res.data.nextCursor, 'invoices/b.pdf')
})

test('listObjects: omits undefined/null params from querystring', async () => {
  const { client, calls } = setup({ payload: { success: true, data: { objects: [], nextCursor: null } } })
  await client.storage.listObjects({ connectionId: 'conn-1', cursor: null, limit: undefined })
  const url = new URL(calls[0].url)
  assert.equal(url.searchParams.get('connectionId'), 'conn-1')
  assert.equal(url.searchParams.has('cursor'), false)
  assert.equal(url.searchParams.has('limit'), false)
  assert.equal(url.searchParams.has('namespace'), false)
})

test('listFolders: GET folders with params', async () => {
  const folder = { folderId: 'fld-1', connectionId: 'conn-1', namespace: 'tm-tools/pdf', relativePath: 'invoices', createdAt: '2026-11-07T00:00:00.000Z', updatedAt: '2026-11-07T00:00:00.000Z' }
  const { client, calls } = setup({ payload: { success: true, data: { folders: [folder], nextCursor: null } } })
  const res = await client.storage.listFolders({ connectionId: 'conn-1', namespace: 'tm-tools/pdf' })
  assert.equal(calls[0].method, 'GET')
  const url = new URL(calls[0].url)
  assert.equal(url.pathname, `/api/v1/apps/${APP}/storage/folders`)
  assert.equal(url.searchParams.get('connectionId'), 'conn-1')
  assert.equal(res.data.folders[0].folderId, 'fld-1')
})

test('deleteObject: DELETE objectId path', async () => {
  const { client, calls } = setup({ payload: { success: true, data: { objectId: 'obj-1', status: 'deleted' } } })
  const res = await client.storage.deleteObject('obj-1')
  assert.equal(calls[0].method, 'DELETE')
  assert.equal(calls[0].url, `${BASE}/api/v1/apps/${APP}/storage/objects/obj-1`)
  assert.equal(res.data.status, 'deleted')
})

test('copyObject: POST objectId path with destination body', async () => {
  const input = { relativePath: 'invoices/renamed.pdf', namespace: 'tm-tools/pdf', overwrite: false }
  const { client, calls } = setup({ payload: { success: true, data: { object: { ...objectInfo, relativePath: 'invoices/renamed.pdf' } } } })
  const res = await client.storage.copyObject('obj-1', input)
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].url, `${BASE}/api/v1/apps/${APP}/storage/objects/obj-1/copy`)
  assert.deepEqual(calls[0].body, input)
  assert.equal(res.data.object.relativePath, 'invoices/renamed.pdf')
})

test('createFolder: POST folder body, folder wrapper', async () => {
  const input = { connectionId: 'conn-1', namespace: 'tm-tools/pdf', relativePath: 'invoices' }
  const folder = { folderId: 'fld-1', ...input, createdAt: '2026-11-07T00:00:00.000Z', updatedAt: '2026-11-07T00:00:00.000Z' }
  const { client, calls } = setup({ payload: { success: true, data: { folder } } })
  const res = await client.storage.createFolder(input)
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].url, `${BASE}/api/v1/apps/${APP}/storage/folders`)
  assert.deepEqual(calls[0].body, input)
  assert.equal(res.data.folder.folderId, 'fld-1')
})

test('deleteFolder: DELETE with folder identity body', async () => {
  const input = { connectionId: 'conn-1', namespace: 'tm-tools/pdf', relativePath: 'invoices' }
  const { client, calls } = setup({ payload: { success: true, data: { status: 'deleted' } } })
  const res = await client.storage.deleteFolder(input)
  assert.equal(calls[0].method, 'DELETE')
  assert.equal(calls[0].url, `${BASE}/api/v1/apps/${APP}/storage/folders`)
  assert.deepEqual(calls[0].body, input)
  assert.equal(res.data.status, 'deleted')
})

test('appId override targets another app path', async () => {
  const { client, calls } = setup({ payload: { success: true, data: { connections: [] } } })
  await client.storage.connections(OTHER)
  assert.equal(calls[0].url, `${BASE}/api/v1/apps/${OTHER}/storage/connections`)
})

test('path params are URL-encoded', async () => {
  const { client, calls } = setup({ payload: { success: true, data: { object: objectInfo } } })
  await client.storage.getObject('obj/with space')
  assert.equal(calls[0].url, `${BASE}/api/v1/apps/${APP}/storage/objects/obj%2Fwith%20space`)
})

test('missing app secret fails with a useful error before any request', async () => {
  const { client, calls } = setup({ secret: null })
  await assert.rejects(() => client.storage.connections(), /getAppSecret \(X-App-Secret\)/)
  assert.equal(calls.length, 0)
})

test('Hub error responses propagate statusCode and data', async () => {
  const { client } = setup({ status: 403, payload: { success: false, message: 'error.forbidden' } })
  await assert.rejects(
    () => client.storage.getObject('obj-1'),
    (err) => {
      assert.equal(err.statusCode, 403)
      assert.equal(err.message, 'error.forbidden')
      assert.equal(err.data.success, false)
      return true
    }
  )
})

test('async getAppSecret is awaited', async () => {
  const calls = []
  const fetch = async (url, init = {}) => {
    const headers = Object.fromEntries(init.headers.entries())
    calls.push({ url, headers })
    return new Response(JSON.stringify({ success: true, data: { connections: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const client = new HubClient({ baseUrl: BASE, appId: APP, fetch, getAppSecret: async () => SECRET })
  await client.storage.connections()
  assert.equal(calls[0].headers['x-app-secret'], SECRET)
})

test('device credential is sent instead of the app secret when both exist', async () => {
  const calls = []
  const fetch = async (url, init = {}) => {
    calls.push({ url, headers: Object.fromEntries(init.headers.entries()) })
    return new Response(JSON.stringify({ success: true, data: { connections: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const client = new HubClient({
    baseUrl: BASE,
    appId: APP,
    fetch,
    getAppSecret: () => SECRET,
    getDeviceCredential: async () => ({ deviceId: 'dev-1', secret: 'device-secret' })
  })
  await client.storage.connections()
  assert.equal(calls[0].headers['x-device-id'], 'dev-1')
  assert.equal(calls[0].headers['x-device-secret'], 'device-secret')
  assert.equal(calls[0].headers['x-app-secret'], undefined)
})

test('relay uses the device credential too, and falls back without one', async () => {
  const calls = []
  const fetch = async (url, init = {}) => {
    calls.push({ url, headers: Object.fromEntries(init.headers.entries()) })
    return new Response(JSON.stringify({ success: true, data: { connections: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const withDevice = new HubClient({ baseUrl: BASE, appId: APP, fetch, getDeviceCredential: () => ({ deviceId: 'dev-1', secret: 'device-secret' }) })
  await withDevice.ai.relay.catalog()
  assert.equal(calls[0].headers['x-device-id'], 'dev-1')
  assert.equal(calls[0].headers['x-app-secret'], undefined)

  const withSecret = new HubClient({ baseUrl: BASE, appId: APP, fetch, getAppSecret: () => SECRET })
  await withSecret.ai.relay.catalog()
  assert.equal(calls[1].headers['x-app-secret'], SECRET)
  assert.equal(calls[1].headers['x-device-id'], undefined)
})

test('an incomplete device credential falls back to the app secret', async () => {
  const calls = []
  const fetch = async (url, init = {}) => {
    calls.push({ url, headers: Object.fromEntries(init.headers.entries()) })
    return new Response(JSON.stringify({ success: true, data: { connections: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const client = new HubClient({
    baseUrl: BASE,
    appId: APP,
    fetch,
    getAppSecret: () => SECRET,
    getDeviceCredential: () => ({ deviceId: 'dev-1', secret: '' })
  })
  await client.storage.connections()
  assert.equal(calls[0].headers['x-app-secret'], SECRET)
  assert.equal(calls[0].headers['x-device-id'], undefined)
})