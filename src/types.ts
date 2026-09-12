export interface HubClientOptions {
  baseUrl: string
  appId: string
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>
  onUnauthorized?: () => void
  fetch?: typeof globalThis.fetch
}

export interface HubResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
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

export interface HubAuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: HubAuthUser
}

export interface HubRole {
  id: string
  appId: string
  name: string
  description?: string
  permissions: { module: string, actions: string[] }[]
  allowedRoutes: string[]
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

export interface HubSystemRoute {
  id: string
  appId: string
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

export interface HubMediaSignature {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
  folder?: string
  preset?: string
}

export interface HubNotification {
  id: string
  appId: string
  userId: string
  title: string
  body: string
  icon?: string
  url?: string
  isRead: boolean
  createdAt: string
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
  changes?: Record<string, { old: any, new: any }>
}

export interface HubUser {
  id: string
  appId: string
  email: string
  name?: string
  username?: string
  avatar?: string
  roles: HubRole[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}
