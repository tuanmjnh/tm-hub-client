export interface HubClientOptions {
  baseUrl: string
  appId: string
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>
  onUnauthorized?: () => void
  fetch?: typeof globalThis.fetch
  /** Optional: supply a refresh token for automatic 401 retry (non-breaking). */
  getRefreshToken?: () => string | null | undefined | Promise<string | null | undefined>
  /** Optional: called after a successful silent refresh so the host can persist new tokens. */
  onTokensRefreshed?: (tokens: { accessToken: string, refreshToken: string, expiresIn: number }) => void | Promise<void>
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

/** Result of `auth.login()` — check `totpRequired` before using tokens. */
export type HubLoginResult = HubAuthResponse

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
}

export interface HubResetPasswordRequest {
  email: string
  token: string
  password: string
  appId: string
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
}

export interface HubApp {
  id: string
  name: string
  description?: string
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
