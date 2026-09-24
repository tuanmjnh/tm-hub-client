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
  | 'media.read'
  | 'media.upload'
  | 'media.delete'
  | 'notifications.read'
  | 'notifications.send'
  | 'notifications.manage'
  | 'users.read'
  | 'users.create'
  | 'users.update'
  | 'users.delete'
  | 'roles.read'
  | 'roles.manage'
  | 'routes.read'
  | 'routes.manage'
  | 'platform.apps.manage'
  | 'platform.crossapp.read'
  | 'platform.crossapp.write'
  | 'platform.audit.read'
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
}

export interface HubAuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: HubAuthUser
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
