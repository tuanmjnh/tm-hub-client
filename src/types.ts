export const DEFAULT_HUB_PORT = 4000
export const DEFAULT_HUB_URL = 'http://localhost:4000'

export const PLATFORM_PORTS = {
  HUB: 4000,
  TRADING: 4001,
  TOOLS: 4002,
  TOOLS_DESKTOP: 3456
} as const

export interface HubClientOptions {
  /** Base URL of the TM Hub instance. Defaults to 'http://localhost:4000' (DEFAULT_HUB_URL). */
  baseUrl?: string
  appId: string
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>
  onUnauthorized?: () => void
  fetch?: typeof globalThis.fetch
  /** Optional: supply a refresh token for automatic 401 retry (non-breaking). */
  getRefreshToken?: () => string | null | undefined | Promise<string | null | undefined>
  /** Optional: called after a successful silent refresh so the host can persist new tokens. */
  onTokensRefreshed?: (tokens: { accessToken: string, refreshToken: string, expiresIn: number }) => void | Promise<void>
  /**
   * Optional: this app's TM-Hub secret (server only), sent as X-App-Secret.
   * Required by the AI relay, which authenticates the app itself instead of a
   * signed-in user. Never ship this to a browser.
   */
  getAppSecret?: () => string | null | undefined | Promise<string | null | undefined>
  /**
   * Optional: a per-device credential issued by TM Hub device enrollment
   * (server only). Sent as X-Device-Id + X-Device-Secret and preferred over
   * `getAppSecret`, which a public Electron build must not carry.
   */
  getDeviceCredential?: () => HubDeviceCredential | null | undefined | Promise<HubDeviceCredential | null | undefined>
}

/** Pair returned by TM Hub device enrollment (`/api/v1/auth/device/token`). */
export interface HubDeviceCredential {
  deviceId: string
  secret: string
}

/** Device identity kinds — how the device id was created (v2 Device Registry). */
export type HubDeviceIdentityKind =
  | 'electron-machine'
  | 'electron-installation'
  | 'browser-profile'
  | 'native-installation'

export type HubDeviceType =
  | 'web' | 'mobile' | 'tablet' | 'desktop'
  | 'tv' | 'wearable' | 'cli' | 'other'

export type HubDevicePlatform = 'web' | 'desktop' | 'mobile'

export type HubDeviceStatus = 'active' | 'pending' | 'blocked' | 'revoked'

/**
 * Normalized device metadata sent on login (nested `device` object, v2).
 * The SDK never generates or hashes the device id — the host supplies it from
 * Electron Main / browser profile storage.
 */
export interface HubDeviceInfo {
  deviceId: string
  identityKind: HubDeviceIdentityKind
  deviceType: HubDeviceType
  platform: HubDevicePlatform
  deviceName?: string
  osPlatform?: string
  arch?: string
  appVersion?: string
}

/** A Device Registry record as returned by the Device APIs. Never carries secrets. */
export interface HubDeviceView {
  id: string
  deviceId: string
  identityKind: HubDeviceIdentityKind
  deviceType: HubDeviceType
  platform: string
  deviceName: string | null
  osPlatform: string | null
  arch: string | null
  appVersion: string | null
  status: HubDeviceStatus
  firstSeenAt: string
  lastSeenAt: string
  lastIp: string | null
  isCurrent?: boolean
}

/**
 * Transient per-device service credential returned once by login when the host
 * requested it (`requestDeviceCredential`). Host/Electron Main must persist it
 * in OS secure storage and must NEVER forward it to a renderer.
 */
export interface HubIssuedServiceCredential {
  deviceId: string
  secret: string
  expiresAt: string
  scopes: string[]
}

/** Login input. `device` carries the v2 identity; `requestDeviceCredential` is host-only. */
export interface HubLoginInput {
  email: string
  password: string
  /** Legacy device type field; still accepted by the Hub. */
  platform?: string
  /** Legacy top-level device id; still accepted by the Hub. */
  deviceId?: string
  /** v2 nested device identity. */
  device?: HubDeviceInfo
  /** Electron Main / server broker only. Web clients must not request a credential. */
  requestDeviceCredential?: boolean
}

/** Public JWK served by `GET /api/v1/auth/jwks` (RS256 verification). Never has `d`. */
export interface HubPublicJwk {
  kty: 'RSA'
  kid: string
  alg?: string
  use?: string
  n: string
  e: string
}

export interface HubJwksResponse {
  keys: HubPublicJwk[]
}

/** Result of `auth.login()` / `auth.verifyTotp()` — optional deviceCredential is host-only. */
export interface HubDeviceAwareAuthResponse extends HubAuthResponse {
  /** Present only when the host requested it and the app policy allows it. */
  deviceCredential?: HubIssuedServiceCredential
}

export type Capability =
  | 'apps.read'
  | 'apps.create'
  | 'apps.update'
  | 'apps.delete'
  | 'apps.rotateSecret'
  | 'apps.logs.read'
  | 'configs.read'
  | 'configs.write'
  | 'configs.export'
  | 'media.read'
  | 'media.upload'
  | 'media.delete'
  | 'media.export'
  | 'notifications.read'
  | 'notifications.send'
  | 'notifications.manage'
  | 'notifications.export'
  | 'mail.send'
  | 'mail.manage'
  | 'mail.analytics.read'
  | 'users.read'
  | 'users.create'
  | 'users.update'
  | 'users.delete'
  | 'users.export'
  | 'users.import'
  | 'roles.read'
  | 'roles.manage'
  | 'routes.read'
  | 'routes.manage'
  | 'permissions.read'
  | 'permissions.create'
  | 'permissions.update'
  | 'permissions.delete'
  | 'permissions.manage'
  | 'tenants.read'
  | 'tenants.manage'
  | 'platform.apps.manage'
  | 'platform.crossapp.read'
  | 'platform.crossapp.write'
  | 'platform.audit.read'
  | 'connections.read'
  | 'connections.write'
  | 'imports.read'
  | 'imports.write'
  /** @deprecated use `media.upload` */
  | 'media.write'
  /** @deprecated use `users.create` / `users.update` / `users.delete` */
  | 'users.manage'
  /** @deprecated use `apps.logs.read` */
  | 'logs.read'
  | '*'

export interface HubResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
  meta?: unknown
  nextCursor?: number | string | null
}

export interface HubAuthUser {
  id: string
  email: string
  name: string
  appId: string
  roles: string[]
  permissions: string[]
  allowedRoutes: string[]
}

export interface HubMe {
  userId: string
  email: string
  name: string
  appId: string
  roles: string[]
  permissions: string[]
  allowedRoutes: string[]
  /** 2FA state (v1.26). */
  totpEnabled?: boolean
  features?: {
    passkey?: boolean
    totp?: boolean
  }
}

export interface HubAuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: HubAuthUser
  /**
   * Set when the account has two-factor authentication enabled:
   * no tokens are issued yet — call `auth.verifyTotp()` with the code.
   */
  totpRequired?: true
  pendingTotpToken?: string
}

/** Result of `auth.login()` / `auth.verifyTotp()` — optional deviceCredential is host-only. */
export type HubLoginResult = HubDeviceAwareAuthResponse

export interface HubTotpSetupResponse {
  qrDataUrl: string
}

export interface HubTotpVerifyResponse {
  recoveryCodes: string[]
}

export interface HubPasskeyInfo {
  id: string
  /** WebAuthn credential id (base64url) — pass to `auth.passkeyDelete()`. */
  credentialId: string
  deviceName?: string
  transports: string[]
  createdAt: string
  lastUsedAt?: string
}

export interface HubPasskeyRegisterStart {
  challenge: string
  user: { id: string, name: string, displayName: string }
  rp: { id: string, name: string }
  pubKeyCredParams: Array<{ type: 'public-key', alg: number }>
  timeout: number
  attestation: 'none' | 'indirect' | 'direct'
  authenticatorSelection: {
    authenticatorAttachment?: 'platform' | 'cross-platform'
    residentKey: 'required' | 'preferred' | 'discouraged'
    requireResidentKey?: boolean
    userVerification: 'required' | 'preferred' | 'discouraged'
  }
}

export interface HubPasskeyLoginStart {
  challenge: string
  allowCredentials: Array<{ id: string, type: 'public-key', transports?: string[] }>
  timeout: number
  userVerification: 'required' | 'preferred' | 'discouraged'
  rpId?: string
}

export interface HubRefreshResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface HubProfileUpdate {
  name?: string
  username?: string | null
  avatarUrl?: string | null
}

export interface HubPasswordChange {
  currentPassword: string
  newPassword: string
}

export interface HubForgotPasswordRequest {
  email: string
  appId?: string
  redirectUrl?: string
}

export interface HubResetPasswordRequest {
  email: string
  token: string
  password: string
  appId?: string
}

export interface HubSession {
  id: string
  platform: string
  userAgent: string
  lastIp: string
  createdAt: string
  expiresAt: string
  isCurrent: boolean
}

export interface HubRolePermission {
  module: string
  actions: string[]
}

export interface HubRole {
  id: string
  appId?: string
  name: string
  description?: string
  permissions: HubRolePermission[]
  allowedRoutes: string[]
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

export interface HubSystemRoute {
  id: string
  appId?: string
  path: string
  name: string
  label: string
  icon?: string
  sort: number
  isVisible: boolean
  parentId?: string | null
  isDeleted?: boolean
  children?: HubSystemRoute[]
}

export interface HubRouteListPayload {
  routes: HubSystemRoute[]
  tree: HubSystemRoute[]
}

export interface HubMediaSignature {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
  folder?: string
  preset?: string
}

export interface HubMediaResource {
  public_id: string
  secure_url?: string
  url?: string
  format?: string
  resource_type?: string
  width?: number
  height?: number
  created_at?: string
  [key: string]: unknown
}

export interface HubMediaResourcesResponse {
  resources: HubMediaResource[]
  next_cursor?: string
  [key: string]: unknown
}

export interface HubMediaFolder {
  name: string
  path: string
  [key: string]: unknown
}

export interface HubMediaFoldersResponse {
  parent: string | null
  folders: HubMediaFolder[]
}

export interface HubNotification {
  id: string
  appId?: string
  userId?: string
  title?: string
  body: string
  icon?: string
  url?: string
  isRead?: boolean
  is_read?: boolean
  createdAt?: string
  created_at?: string
}

export interface HubPushSubscription {
  endpoint: string
  keys?: { p256dh: string, auth: string }
  deviceType?: string
  fcmToken?: string
}

export type HubLogMode = 'full' | 'compact' | 'minimal' | 'none' | 'off'

export interface HubAuditLog {
  _id: string
  appId: string
  docId: string
  modelName: string
  action: string
  source: 'external_app' | 'tm-hub_internal'
  by: {
    _id: string
    name?: string
    username?: string
    email?: string
    avatar?: string
  }
  ip?: string
  userAgent?: string
  at: number
  changes?: Record<string, { old: unknown, new: unknown }>
  changedFields?: string[]
  summary?: string
  logMode?: HubLogMode
}

export interface HubApp {
  id: string
  name: string
  description?: string
  tenantId?: string | null
  type?: 'system' | 'application' | 'service'
  isSystem?: boolean
  isActive?: boolean
  isDeletable?: boolean
  isPinned?: boolean
  secretKey?: string
  allowedOrigins?: string[]
  sort?: number
  configs?: Record<string, string>
  createdAt?: string
  updatedAt?: string
}

export interface HubAppsListResponse {
  success: boolean
  isConfigured: boolean
  message: string
  data: HubApp[]
  nextCursor: string | null
}

export interface HubUser {
  id: string
  appId?: string
  email: string
  username?: string | null
  name?: string | null
  avatarUrl?: string | null
  role?: string
  roles?: string[]
  permissions?: string[]
  password?: string
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
  platform?: string
}

export interface HubIntrospectResponse {
  valid: boolean
  reason?: string
  sub?: string
  appId?: string
  email?: string
  name?: string
  roles?: string[]
  permissions?: string[]
  allowedRoutes?: string[]
}

export interface HubAdminPasswordSetResponse {
  temporaryPassword?: string
}

export interface HubListParams {
  limit?: number
  cursor?: string | number
  q?: string
}

export interface HubPermissionItem {
  id: string
  code: string
  name: string
  module: string
  description?: string | null
  isSystem?: boolean
}

export interface HubPermissionModuleDef {
  key: string
  actions: string[]
}

export interface HubPermissionCatalogResponse {
  success: boolean
  readOnly?: boolean
  data: HubPermissionItem[]
  modules?: HubPermissionModuleDef[]
}

/**
 * Reference docs content served by `GET /api/v1/apps/:appId/docs`.
 * Payload structure lives in tm-hub/shared/docs/content.ts (single source of
 * truth) — typed loosely here so the SDK never needs a release just because
 * the docs content shape grows.
 */
export interface HubDocsContent {
  version: number
  updatedAt: string
  [key: string]: unknown
}

export interface HubAuthPermissions {
  appId?: string
  roles: string[]
  permissions: string[]
  allowedRoutes: string[]
}

export interface HubResourceListParams extends HubListParams {
  folder?: string
  max_results?: number
  next_cursor?: string
}

// ==========================================
// Connections (per-app provider credentials — v1.23)
// ==========================================
export type HubConnectionMode = 'manual' | 'oauth'

export type HubConnectionStatus = 'connected' | 'error'

export interface HubConnectionField {
  key: string
  label: string
  type: 'text' | 'password'
  required: boolean
}

/** Public view of a stored connection — secrets are never included. */
export interface HubConnection {
  id: string
  provider: string
  mode: HubConnectionMode
  status: HubConnectionStatus
  label: string | null
  config: Record<string, unknown>
  hasSecrets: boolean
  expiresAt: string | null
  connectedBy: string | null
  lastTestAt: string | null
  lastTestOk: boolean | null
  connectedAt: string
  updatedAt: string
}

/** Provider definition merged with the app's connection (from GET /connections). */
export interface HubConnectionProvider {
  key: string
  name: string
  description: string
  icon: string
  mode: HubConnectionMode
  fields?: HubConnectionField[]
  scopes?: string[]
  connection: HubConnection | null
}

export interface HubConnectionTestResult {
  ok: boolean
  message?: string
}

export interface HubOAuthStartResponse {
  authUrl: string
}

// ==========================================
// OAuth (v1.25)
// ==========================================
export type HubOAuthProvider = 'google' | 'github' | 'microsoft'

export interface HubOAuthProviderInfo {
  key: HubOAuthProvider
  name: string
  enabled: boolean
  scopes: string[]
}

export interface HubOAuthProvidersResponse {
  success: boolean
  data: HubOAuthProviderInfo[]
}

export interface HubOAuthLoginResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: HubAuthUser
  isNewUser: boolean
}

export interface HubOAuthLinkRequest {
  provider: HubOAuthProvider
  code: string
  state: string
  appId?: string
}

export interface HubOAuthLinkResponse {
  success: boolean
  data: {
    linked: boolean
    provider: HubOAuthProvider
    email: string
  }
}

// ==========================================
// Data Import (v1.24)
// ==========================================
export type HubImportTargetKey = 'configs' | 'users' | 'routes'

export interface HubImportTarget {
  key: HubImportTargetKey
  identifierField: string
  requiredFields: string[]
  optionalFields: string[]
}

export interface HubImportRowResult {
  index: number
  ok: boolean
  action: 'create' | 'update' | null
  identifier?: string
  error?: string
}

export interface HubImportRunResult {
  total: number
  created: number
  updated: number
  failed: number
  results: HubImportRowResult[]
}

export interface HubSheetValues {
  range: string
  values: string[][]
}

// ==========================================
// Data Import Extended (v1.26+)
// ==========================================
export type HubImportSource = 'google' | 'csv' | 'paste' | 'json'
export type HubImportTargetExtended =
  | 'users' | 'roles' | 'routes' | 'permissions'
  | 'products' | 'categories' | 'variants' | 'attributes'
  | 'orders' | 'customers' | 'segments'
  | 'inventory' | 'warehouses' | 'suppliers' | 'purchase_orders'
  | 'content' | 'pages' | 'content_categories'
  | 'custom'

export interface HubImportSourceConfig {
  source: HubImportSource
  google?: { spreadsheetId: string; range?: string; accessToken: string }
  csv?: File
  paste?: string
  json?: any[]
}

export interface HubImportTargetConfig {
  key: HubImportTargetExtended
  label: string
  description: string
  icon: string
  model: string
  identifierField: string
  localeFields: string[]
  referenceFields: HubImportReferenceField[]
  requiredFields: string[]
  optionalFields: string[]
  localizedFields: string[]
  validationRules: HubImportValidationRule[]
  transformers: HubImportTransformer[]
  sampleHeaders: string[]
  sampleRows: string[][]
}

export interface HubImportReferenceField {
  field: string
  targetModel: string
  targetField: string
  lookupField: string
  isArray: boolean
  required: boolean
}

export interface HubImportValidationRule {
  field: string
  required?: boolean
  type?: 'string' | 'number' | 'email' | 'url' | 'date' | 'boolean'
  pattern?: RegExp
  min?: number
  max?: number
  custom?: (value: any, row: any) => string | null
}

export type HubImportTransformer =
  | { type: 'localize'; fields: string[] }
  | { type: 'slugify'; fields: string[]; sourceField: string }
  | { type: 'reference'; field: string; targetModel: string; lookupField: string }
  | { type: 'parse'; field: string; parser: 'json' | 'csv' | 'attributes' }
  | { type: 'default'; field: string; value: any }
  | { type: 'custom'; field: string; fn: (value: any, row: any) => any }

export interface HubImportColumn {
  accessorKey: string
  header: string
  type: 'text' | 'number' | 'select' | 'badge' | 'localized' | 'reference'
  required?: boolean
  options?: { value: string; label: string }[]
  referenceConfig?: { model: string; displayField: string; valueField: string }
}

export interface HubImportPreview {
  items: HubImportRow[]
  errors: HubImportError[]
  warnings: HubImportWarning[]
  summary: {
    totalRows: number
    validRows: number
    errorCount: number
    warningCount: number
    estimatedNew: number
    estimatedUpdate: number
  }
}

export interface HubImportRow {
  [key: string]: any
  _rowIndex: number
  _hasError: boolean
  _hasWarning: boolean
  _isNew: boolean
  _matchedId?: string
}

export interface HubImportError {
  row: number
  field: string
  message: string
  severity: 'error' | 'warning'
  value?: any
}

export interface HubImportWarning {
  row: number
  field: string
  message: string
  value?: any
}

export interface HubImportJob {
  id: string
  appId: string
  userId: string
  target: HubImportTargetExtended
  source: HubImportSource
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  options: HubImportOptions
  preview: HubImportPreview
  stats: {
    total: number
    created: number
    updated: number
    failed: number
    skipped: number
  }
  fileUrl?: string
  errorLog?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

export interface HubImportOptions {
  target: HubImportTargetExtended
  source: HubImportSource
  locale: string
  autoFixSlug: boolean
  skipErrors: boolean
  dryRun: boolean
  batchSize: number
  notifyOnComplete: boolean
}

export interface HubImportTemplate {
  id: string
  appId: string
  target: HubImportTargetExtended
  name: string
  description?: string
  columns: HubImportColumn[]
  mappings: Record<string, string>
  defaultValues: Record<string, any>
  validationRules: HubImportValidationRule[]
  isSystem: boolean
  version: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface HubImportJobStats {
  total: number
  created: number
  updated: number
  failed: number
  skipped: number
  rowsProcessed: number
  durationMs: number
}

export interface HubQueueStats {
  high: { waiting: number; active: number; completed: number; failed: number; delayed: number }
  normal: { waiting: number; active: number; completed: number; failed: number; delayed: number }
  low: { waiting: number; active: number; completed: number; failed: number; delayed: number }
  scheduled: { waiting: number; active: number; completed: number; failed: number; delayed: number }
  dead: { waiting: number; active: number; completed: number; failed: number; delayed: number }
  total: { waiting: number; active: number; completed: number; failed: number; delayed: number }
}

export interface HubImportJobListParams {
  status?: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused'
  priority?: 'high' | 'normal' | 'low'
  target?: HubImportTargetExtended
  page?: number
  limit?: number
  from?: Date | string
  to?: Date | string
}

export interface HubImportJobListItem {
  id: string
  appId: string
  userId: string
  target: HubImportTargetExtended
  source: HubImportSource
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused'
  priority: 'high' | 'normal' | 'low'
  attemptsMade: number
  maxAttempts: number
  scheduledAt?: Date
  createdAt: Date
  processedAt?: Date
  completedAt?: Date
  failedReason?: string
  stats?: HubImportJobStats
}

export interface HubPaginatedImportJobs {
  data: HubImportJobListItem[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface HubImportValidationResult {
  valid: boolean
  errors: HubImportError[]
  warnings: HubImportWarning[]
}

export interface HubImportResult {
  total: number
  created: number
  updated: number
  failed: number
  skipped: number
  errors: HubImportError[]
  results: Array<{
    index: number
    ok: boolean
    action: 'create' | 'update' | null
    identifier?: string
    error?: string
  }>
}

// ==========================================
// Export Data (Phase E — tm-hub export jobs/templates)
// ==========================================
export type HubExportFormat = 'csv' | 'json' | 'xlsx'

export type HubExportScope = 'page' | 'selected' | 'filtered' | 'all'

export type HubExportJobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface HubExportOptions {
  format: HubExportFormat
  scope: HubExportScope
  fields?: string[]
  filters?: Record<string, string | number | boolean>
  sort?: Array<{ field: string; order: 'asc' | 'desc' }>
  dateRange?: { from?: string; to?: string }
  filename?: string
  includeHeaders?: boolean
  encoding?: 'utf-8' | 'utf-16le'
  sheetName?: string
  ids?: string[]
  limit?: number
  offset?: number
}

export interface HubExportJob {
  id: string
  appId: string
  userId: string
  module: string
  status: HubExportJobStatus
  format: HubExportFormat
  scope: HubExportScope
  options: HubExportOptions
  totalRecords: number
  processedRecords: number
  fileUrl?: string
  fileSize?: number
  error?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  expiresAt: string
}

export interface HubExportTemplate {
  id: string
  appId: string
  module: string
  name: string
  description?: string
  options: HubExportOptions
  isDefault: boolean
  createdBy?: string
  createdAt: string
  updatedAt?: string
}

export interface HubExportJobListParams {
  module?: string
  mine?: boolean
  limit?: number
  offset?: number
}

// ==========================================
// Mail (v1.0.2)
// ==========================================
export type HubMailAddress = string
export type HubMailPriority = 'high' | 'normal' | 'low'
export type HubMailTemplateStatus = 'draft' | 'published' | 'archived'

export interface HubMailAttachmentInput {
  filename: string
  content?: string
  path?: string
  contentType?: string
}

export interface HubMailSendOptions {
  from?: HubMailAddress
  to: HubMailAddress | HubMailAddress[]
  cc?: HubMailAddress[]
  bcc?: HubMailAddress[]
  replyTo?: HubMailAddress
  subject: string
  html?: string
  text?: string
  attachments?: HubMailAttachmentInput[]
  headers?: Record<string, string>
  tags?: string[]
  metadata?: Record<string, string>
  templateId?: string
  templateData?: Record<string, unknown>
}

export interface HubMailScheduleOptions extends HubMailSendOptions {
  scheduledAt: string
  priority?: HubMailPriority
}

export interface HubMailSendResult {
  success?: boolean
  messageId?: string
  error?: string
  provider?: string
  jobId?: string
}

export interface HubMailProviderInfo {
  type: string
  name: string
  enabled?: boolean
  configured?: boolean
  [key: string]: unknown
}

export interface HubMailTemplateVariable {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'currency' | 'url'
  required: boolean
  description?: string
  default?: unknown
}

export interface HubMailTemplate {
  id: string
  appId: string
  key: string
  name: string
  subject: string
  preheader?: string
  html: string
  text?: string
  layoutId?: string
  variables: Record<string, HubMailTemplateVariable>
  locale: string
  status: HubMailTemplateStatus
  version: number
  createdBy: string
  createdAt: string
  updatedAt: string
  publishedAt?: string
}

export interface HubMailTemplateListParams {
  status?: HubMailTemplateStatus
  locale?: string
  key?: string
  page?: number
  limit?: number
}

export interface HubMailTemplateListResult {
  templates: HubMailTemplate[]
  total: number
}

export interface HubMailTemplateInput {
  key: string
  name: string
  subject: string
  preheader?: string
  html: string
  text?: string
  layoutId?: string
  variables?: Record<string, HubMailTemplateVariable>
  locale?: string
  status?: HubMailTemplateStatus
}

export interface HubMailTemplatePreview {
  html: string
  text: string
  variables: Record<string, unknown>
}

export interface HubMailAnalyticsParams {
  from?: string
  to?: string
}

export interface HubMailAnalyticsSummary {
  totalSent: number
  totalDelivered: number
  totalBounced: number
  totalOpened: number
  totalClicked: number
  totalUnsubscribed: number
  totalComplained: number
  deliveryRate: number
  openRate: number
  clickRate: number
  bounceRate: number
  unsubscribeRate: number
  complaintRate: number
  period?: { from: string, to: string }
}

export interface HubMailTimeseriesPoint {
  date: string
  sent: number
  delivered: number
  bounced: number
  opened: number
  clicked: number
  unsubscribed: number
  complained: number
}

export interface HubMailTopTemplateStats {
  templateId: string
  templateKey: string
  sent: number
  openRate: number
  clickRate: number
}

export interface HubMailTopDomainStats {
  domain: string
  sent: number
  bounced: number
  openRate: number
}

export interface HubMailEventQuery extends HubMailAnalyticsParams {
  event?: string
  templateId?: string
  campaignId?: string
  recipient?: string
  tags?: string
  page?: number
  limit?: number
}

export interface HubMailAnalyticsEventsResult {
  events?: unknown[]
  pagination?: { page: number, limit: number, total?: number }
  [key: string]: unknown
}

export interface HubMailQueueCounters {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

export interface HubMailQueueStats {
  high: HubMailQueueCounters
  normal: HubMailQueueCounters
  low: HubMailQueueCounters
  scheduled: HubMailQueueCounters
  dead: HubMailQueueCounters
  total: HubMailQueueCounters
}

export interface HubMailQueueJob {
  id: string
  queue: string
  state: string
  attempts: number
  maxAttempts: number
  timestamp: number | null
  processedOn: number | null
  finishedOn: number | null
  failedReason: string | null
  summary: string
}

export interface HubMailQueueState {
  enabled: boolean
  stats: HubMailQueueStats | null
  jobs: HubMailQueueJob[]
}

export type HubMailQueueAction = 'pause' | 'resume' | 'clean' | 'cancel'

export interface HubMailQueueQuery {
  start?: number
  limit?: number
  status?: string
}

export interface HubMailJobDetail {
  id: string
  status?: string
  result?: unknown
  attemptsMade?: number
  createdAt?: string
  processedAt?: string
  failedReason?: string
}

export interface HubInboxAttachment {
  id: string | null
  filename: string
  mimeType: string
  size: number
}

export interface HubInboxItem {
  id: string
  threadId: string
  snippet: string
  labels: string[]
  subject: string
  from: string
  date: string | null
  unread: boolean
  starred: boolean
}

export interface HubInboxDetail extends HubInboxItem {
  to: string
  bodyHtml: string
  bodyText: string
  attachments: HubInboxAttachment[]
}

export interface HubInboxThread {
  id: string
  snippet: string
  messages: HubInboxDetail[]
}

export interface HubInboxProfile {
  connected: boolean
  email: string | null
  messagesTotal: number
  threadsTotal: number
}

export interface HubInboxMessagesResult {
  items: HubInboxItem[]
  nextPageToken: string | null
}

export interface HubInboxMessagesQuery {
  q?: string
  pageToken?: string
  maxResults?: number
}

export interface HubInboxSendInput {
  to: string
  subject: string
  body: string
  threadId?: string
}

export interface HubInboxLabelsInput {
  addLabelIds?: string[]
  removeLabelIds?: string[]
}

// ==========================================
// AI providers & model catalogue (R147)
// ==========================================
export interface HubAiProviderDefinition {
  id: string
  key: string
  name: string
  category: string
  adapter_type: string
  base_url_default: string | null
  capabilities_supported: string[]
  model_discovery_strategy: string | null
  docs_url: string | null
  is_builtin: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

/** Public AI credential view — secrets never leave the hub. */
export interface HubAiConnection {
  id: string
  provider: string
  name: string
  mode: HubConnectionMode
  status: HubConnectionStatus
  label: string | null
  config: Record<string, unknown>
  hasSecrets: boolean
  isEnabled: boolean
  isShared: boolean
  environment: string | null
  baseUrlOverride: string | null
  category: string | null
  providerDefinitionId: string | null
  expiresAt: string | null
  connectedBy: string | null
  lastTestAt: string | null
  lastTestOk: boolean | null
  connectedAt: string
  updatedAt: string
}

export interface HubAiProviderItem {
  definition: HubAiProviderDefinition
  connections: HubAiConnection[]
}

export interface HubAiModel {
  id: string
  provider: string
  connectionId: string | null
  modelId: string
  displayName: string | null
  capabilities: string[]
  isEnabled: boolean
  source: 'discovered' | 'manual'
  syncedAt: string | null
}

export interface HubAiModelListParams {
  provider?: string
  connectionId?: string
  includeDisabled?: boolean
}

export interface HubAiConnectionInput {
  provider: string
  name?: string
  values: Record<string, string>
  environment?: string
  baseUrlOverride?: string
  isShared?: boolean
}

export interface HubAiConnectionPatch {
  isEnabled?: boolean
  isShared?: boolean
}

export interface HubAiDiscoverInput {
  connectionId?: string
  provider?: string
  baseUrl?: string
  apiKey?: string
  persist?: boolean
}

export interface HubAiDiscoveredModel {
  id: string
  displayName: string
}

export interface HubAiDiscoverResult {
  baseUrl?: string
  discovered: number
  persisted: number
  models: HubAiDiscoveredModel[]
}

export interface HubAiManualModelInput {
  provider: string
  connectionId?: string | null
  modelId: string
  displayName?: string
  capabilities?: string[]
}

export interface HubAiGrant {
  id: string
  connection_id: string
  app_id: string
  is_enabled: boolean
  granted_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Binary payload for a relay turn. `data` is base64 without the `data:` prefix
 * (hub caps one attachment at 8 MB of base64 and 12 MB per turn).
 */
export interface HubAiRelayAttachment {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf'
  data: string
}

export interface HubAiRelayMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  /** A vision turn may carry images with an empty caption. */
  attachments?: HubAiRelayAttachment[]
}

export interface HubAiRelayChatInput {
  connectionId: string
  messages: HubAiRelayMessage[]
  /** Omit to use the connection's configured default model. */
  model?: string
  /** Convenience: prepended as a system message before `messages`. */
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
}

export interface HubAiRelayUsage {
  inputTokens?: number
  outputTokens?: number
}

export interface HubAiRelayChatResult {
  ok: boolean
  content: string
  provider: string
  model: string
  usage: HubAiRelayUsage | null
}

export interface HubAiRelayCatalogModel {
  modelId: string
  displayName: string
}

/** A connection this app may chat through (own row or an enabled grant). */
export interface HubAiRelayCatalogConnection {
  connectionId: string
  provider: string
  name: string
  adapterType: string
  hasKey: boolean
  model: string | null
  models: HubAiRelayCatalogModel[]
}

// ==========================================
// Tenants & Sites (v1.31)
// ==========================================
export type HubTenantStatus = 'active' | 'suspended' | 'archived'

export interface HubTenantDatabaseBinding {
  provider: 'mongodb' | 'external'
  databaseName?: string
  clusterRef?: string
  status: 'configured' | 'missing' | 'disabled'
}

export interface HubTenant {
  id: string
  tenantId: string
  name: string
  slug: string
  status: HubTenantStatus
  planCode?: string
  metadata?: Record<string, unknown>
  databaseBinding?: HubTenantDatabaseBinding
  appCount?: number
  createdAt: string
  updatedAt: string
}

export interface HubCreateTenantInput {
  tenantId: string
  name: string
  slug?: string
  planCode?: string
  metadata?: Record<string, unknown>
  databaseBinding?: HubTenantDatabaseBinding
}

export interface HubUpdateTenantInput {
  name?: string
  slug?: string
  status?: HubTenantStatus
  planCode?: string
  metadata?: Record<string, unknown>
  databaseBinding?: HubTenantDatabaseBinding
}

export type HubSiteStatus = 'active' | 'disabled'

export interface HubSite {
  id: string
  tenantId: string
  siteId: string
  name: string
  primaryDomain: string
  allowedDomains: string[]
  defaultLocale: string
  locales: string[]
  status: HubSiteStatus
  publicConfigRevision?: string
  createdAt: string
  updatedAt: string
}

export interface HubCreateSiteInput {
  siteId: string
  name: string
  primaryDomain: string
  allowedDomains?: string[]
  defaultLocale?: string
  locales?: string[]
}

export interface HubUpdateSiteInput {
  name?: string
  primaryDomain?: string
  allowedDomains?: string[]
  defaultLocale?: string
  locales?: string[]
  status?: HubSiteStatus
}

// ==========================================
// Storage Gateway (v1.32)
// ==========================================
// Server-to-server object storage. The app authenticates with X-App-Secret;
// provider credentials never leave the hub. Signed URLs are short-lived bearer
// grants — never log or persist them. Objects are addressed by objectId; the
// internal provider objectKey is not part of the public manifest view.
export type HubStorageProviderKey = 'cloudflare_r2' | 'aws_s3' | 'supabase_storage'

export interface HubStorageCapabilities {
  directUpload: boolean
  directDownload: boolean
  multipartUpload: boolean
  rangeRead: boolean
  copyObject: boolean
  listObjects: boolean
  maxSingleUploadBytes?: number
  maxObjectBytes?: number
}

/** Public manifest view — assembled by the Gateway from provider truth + Hub metadata. */
export interface HubStorageObjectInfo {
  objectId: string
  connectionId: string
  namespace: string
  relativePath: string
  fileName: string
  contentType: string
  sizeBytes: number
  checksumSha256?: string | null
  etag?: string | null
  status: 'pending' | 'ready' | 'deleted' | 'failed'
  createdAt: string
  updatedAt: string
}

export interface HubStorageUploadGrant {
  uploadId: string
  objectId: string
  connectionId: string
  objectKey: string
  method: 'PUT' | 'POST'
  uploadUrl: string
  headers: Record<string, string>
  expiresAt: string
  maxBytes: number
  transferMode: 'single' | 'multipart'
  multipart?: {
    providerUploadId: string
    partSizeBytes: number
    parts: Array<{ partNumber: number, uploadUrl: string, headers?: Record<string, string> }>
  }
}

/** Sanitized connection inventory item — never carries config or secrets. */
export interface HubStorageConnectionInfo {
  connectionId: string
  provider: HubStorageProviderKey
  name: string
  label: string | null
  environment: string
  origin: 'own' | 'granted'
  capabilities: HubStorageCapabilities
}

/** Logical folder marker. Object stores have no true directories. */
export interface HubStorageFolderInfo {
  folderId: string
  connectionId: string
  namespace: string
  relativePath: string
  createdAt: string
  updatedAt: string
}

export interface HubStorageDownloadGrant {
  objectId: string
  downloadUrl: string
  expiresAt: string
  contentType: string
  contentLength: number
  fileName: string
}

export interface HubStorageInitUploadInput {
  connectionId: string
  namespace: string
  relativePath: string
  fileName?: string
  contentType?: string
  sizeBytes: number
  checksumSha256?: string | null
  overwrite?: boolean
  metadata?: Record<string, unknown>
}

export interface HubStorageListObjectsParams {
  connectionId: string
  namespace?: string
  prefix?: string
  cursor?: string | null
  limit?: number
}

export interface HubStorageListFoldersParams {
  connectionId: string
  namespace?: string
  prefix?: string
  cursor?: string | null
  limit?: number
}

export interface HubStorageCopyObjectInput {
  relativePath: string
  namespace?: string
  fileName?: string
  overwrite?: boolean
  metadata?: Record<string, unknown>
}

export interface HubStorageCreateFolderInput {
  connectionId: string
  namespace: string
  relativePath: string
}

export interface HubStorageDeleteFolderInput {
  connectionId: string
  namespace: string
  relativePath: string
}

export interface HubStorageCompleteUploadResult {
  uploadId: string
  status: 'ready'
  object: HubStorageObjectInfo | null
}

export interface HubStorageAbortUploadResult {
  uploadId: string
  status: 'aborted'
}

export interface HubStorageDeleteObjectResult {
  objectId: string
  status: 'deleted'
}

export interface HubStorageDeleteFolderResult {
  status: 'deleted'
}

export interface HubStorageListObjectsResult {
  objects: HubStorageObjectInfo[]
  nextCursor: string | null
}

export interface HubStorageListFoldersResult {
  folders: HubStorageFolderInfo[]
  nextCursor: string | null
}

