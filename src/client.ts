import type {
  HubClientOptions,
  HubResponse,
  HubAuthResponse,
  HubRefreshResponse,
  HubAuthUser,
  HubMe,
  HubProfileUpdate,
  HubPasswordChange,
  HubSession,
  HubRole,
  HubUser,
  HubSystemRoute,
  HubRouteListPayload,
  HubMediaSignature,
  HubMediaResourcesResponse,
  HubMediaFoldersResponse,
  HubNotification,
  HubPushSubscription,
  HubAuditLog,
  HubApp,
  HubAppsListResponse,
  HubListParams,
  HubResourceListParams,
  HubPermissionCatalogResponse,
  HubAuthPermissions,
  Capability,
  HubConnectionProvider,
  HubConnectionTestResult,
  HubOAuthStartResponse,
  HubImportTarget,
  HubImportTargetKey,
  HubImportRowResult,
  HubImportRunResult,
  HubImportRow,
  HubSheetValues,
  HubIntrospectResponse,
  HubAdminPasswordSetResponse,
  HubForgotPasswordRequest,
  HubResetPasswordRequest,
  HubOAuthProvider,
  HubOAuthProviderInfo,
  HubOAuthProvidersResponse,
  HubOAuthLoginResponse,
  HubOAuthLinkRequest,
  HubOAuthLinkResponse,
  HubImportSource,
  HubImportTargetExtended,
  HubImportSourceConfig,
  HubImportTargetConfig,
  HubImportReferenceField,
  HubImportValidationRule,
  HubImportTransformer,
  HubImportColumn,
  HubImportPreview,
  HubImportError,
  HubImportWarning,
  HubImportJob,
  HubImportOptions,
  HubImportTemplate,
  HubImportJobStats,
  HubQueueStats,
  HubImportJobListParams,
  HubImportJobListItem,
  HubPaginatedImportJobs,
  HubImportValidationResult,
  HubImportResult,
  HubExportJob,
  HubExportTemplate,
  HubExportOptions,
  HubExportJobListParams,
  HubTotpSetupResponse,
  HubTotpVerifyResponse,
  HubPasskeyInfo,
  HubPasskeyRegisterStart,
  HubPasskeyLoginStart,
  HubMailProviderInfo,
  HubMailSendOptions,
  HubMailScheduleOptions,
  HubMailSendResult,
  HubMailTemplate,
  HubMailTemplateInput,
  HubMailTemplateListParams,
  HubMailTemplatePreview,
  HubMailAnalyticsParams,
  HubMailAnalyticsSummary,
  HubMailAnalyticsEventsResult,
  HubMailTimeseriesPoint,
  HubMailEventQuery,
  HubMailTopDomainStats,
  HubMailTopTemplateStats,
  HubMailQueueQuery,
  HubMailQueueState,
  HubMailQueueAction,
  HubMailJobDetail,
  HubInboxProfile,
  HubInboxItem,
  HubInboxDetail,
  HubInboxThread,
  HubInboxMessagesQuery,
  HubInboxMessagesResult,
  HubInboxSendInput,
  HubInboxLabelsInput
} from './types'

/** Dual-read aliases (mirror tm-hub authz.LEGACY_PERMISSION_ALIASES). */
const CAPABILITY_ALIASES: Record<string, string[]> = {
  'media.write': ['media.upload'],
  'media.upload': ['media.write'],
  'users.manage': ['users.create', 'users.update', 'users.delete'],
  'users.create': ['users.manage'],
  'users.update': ['users.manage'],
  'users.delete': ['users.manage'],
  'logs.read': ['apps.logs.read'],
  'apps.logs.read': ['logs.read']
}

export class HubClient {
  private baseUrl: string
  public appId: string
  private getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>
  private onUnauthorized?: () => void
  private customFetch: typeof globalThis.fetch
  private getRefreshToken?: () => string | null | undefined | Promise<string | null | undefined>
  private onTokensRefreshed?: HubClientOptions['onTokensRefreshed']
  private cachedPermissions: string[] | null = null
  private refreshInFlight: Promise<boolean> | null = null

  constructor(options: HubClientOptions) {
    this.baseUrl = (options.baseUrl || 'http://localhost:4000').replace(/\/$/, '')
    this.appId = options.appId
    this.getAccessToken = options.getAccessToken
    this.onUnauthorized = options.onUnauthorized
    this.customFetch = options.fetch || globalThis.fetch.bind(globalThis)
    this.getRefreshToken = options.getRefreshToken
    this.onTokensRefreshed = options.onTokensRefreshed
  }

  async request<T = unknown>(
    path: string,
    options: RequestInit & { params?: Record<string, any>, _retry?: boolean } = {}
  ): Promise<T> {
    const { params, headers: customHeaders, _retry, ...fetchOpts } = options

    let url = path.startsWith('http') ? path : `${this.baseUrl}${path}`
    if (params) {
      const searchParams = new URLSearchParams()
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) {
          searchParams.append(k, String(v))
        }
      }
      const qs = searchParams.toString()
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs
      }
    }

    const headers = new Headers(customHeaders || {})
    if (!headers.has('X-App-Id')) {
      headers.set('X-App-Id', this.appId)
    }

    if (!headers.has('Authorization') && this.getAccessToken) {
      const token = await Promise.resolve(this.getAccessToken())
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }
    }

    if (fetchOpts.body && typeof fetchOpts.body === 'object' && !(fetchOpts.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json')
      fetchOpts.body = JSON.stringify(fetchOpts.body)
    }

    const response = await this.customFetch(url, {
      ...fetchOpts,
      headers
    })

    if (response.status === 401 && !_retry && this.getRefreshToken && !path.includes('/auth/login') && !path.includes('/auth/refresh') && !path.includes('/auth/register')) {
      const refreshed = await this.tryRefreshTokens()
      if (refreshed) {
        return this.request<T>(path, { ...options, params, headers: customHeaders, _retry: true } as any)
      }
    }

    if (response.status === 401 && this.onUnauthorized) {
      this.onUnauthorized()
    }

    if (!response.ok) {
      let errorBody: any
      try {
        errorBody = await response.json()
      } catch {
        errorBody = { message: response.statusText }
      }
      const error = new Error(errorBody.message || errorBody.statusMessage || `Request failed with status ${response.status}`)
      ;(error as any).statusCode = response.status
      ;(error as any).data = errorBody
      throw error
    }

    return (await response.json()) as T
  }

  private async tryRefreshTokens(): Promise<boolean> {
    if (this.refreshInFlight) return this.refreshInFlight
    this.refreshInFlight = (async () => {
      try {
        const rToken = await Promise.resolve(this.getRefreshToken?.())
        if (!rToken) return false
        const res = await this.request<HubResponse<HubRefreshResponse>>('/api/v1/auth/refresh', {
          method: 'POST',
          body: { refreshToken: rToken, appId: this.appId } as any
        })
        if (!res?.data?.accessToken) return false
        await this.onTokensRefreshed?.(res.data)
        return true
      } catch {
        return false
      } finally {
        this.refreshInFlight = null
      }
    })()
    return this.refreshInFlight
  }

  private rememberPermissions(permissions?: string[] | null) {
    if (Array.isArray(permissions)) {
      this.cachedPermissions = permissions
    }
  }

  /** Manually seed/cache current user's permission codes (dot format). */
  public setPermissions(permissions: string[]) {
    this.cachedPermissions = Array.isArray(permissions) ? [...permissions] : []
  }

  /** Current cached permission codes (null = not loaded yet). */
  public getPermissions(): string[] | null {
    return this.cachedPermissions ? [...this.cachedPermissions] : null
  }

  // ==========================================
  // MODULE: Auth
  // ==========================================
  public readonly auth = {
    login: async (credentials: { email: string, password: string, platform?: string }) => {
      const res = await this.request<HubResponse<HubAuthResponse>>('/api/v1/auth/login', {
        method: 'POST',
        body: { ...credentials, appId: this.appId } as any
      })
      this.rememberPermissions(res.data?.user?.permissions)
      return res
    },
    register: async (data: { email: string, password: string, name?: string, platform?: string }) => {
      const res = await this.request<HubResponse<HubAuthResponse>>('/api/v1/auth/register', {
        method: 'POST',
        body: { ...data, appId: this.appId } as any
      })
      this.rememberPermissions(res.data?.user?.permissions)
      return res
    },
    me: async () => {
      const res = await this.request<HubResponse<HubMe>>('/api/v1/auth/me', {
        method: 'GET'
      })
      this.rememberPermissions(res.data?.permissions)
      if (!res.data) return res as unknown as HubResponse<HubAuthUser>
      const { userId, ...rest } = res.data
      return {
        ...res,
        data: { ...rest, id: userId }
      }
    },
    permissions: async () => {
      const res = await this.request<HubResponse<HubAuthPermissions>>('/api/v1/auth/permissions', {
        method: 'GET'
      })
      this.rememberPermissions(res.data?.permissions)
      return res
    },
    updateProfile: (updates: HubProfileUpdate) => {
      return this.request<HubResponse<{ name?: string, username?: string | null, avatarUrl?: string | null }>>('/api/v1/auth/me', {
        method: 'PUT',
        body: updates as any
      })
    },
    changePassword: (data: HubPasswordChange) => {
      return this.request<HubResponse<void>>('/api/v1/auth/me/password', {
        method: 'PUT',
        body: data as any
      })
    },
    forgotPassword: (data: HubForgotPasswordRequest) => {
      return this.request<HubResponse<void>>('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: { ...data, appId: this.appId } as any
      })
    },
    resetPassword: (data: HubResetPasswordRequest) => {
      return this.request<HubResponse<void>>('/api/v1/auth/reset-password', {
        method: 'POST',
        body: { ...data, appId: this.appId } as any
      })
    },
    refresh: async (refreshToken: string) => {
      const res = await this.request<HubResponse<HubRefreshResponse>>('/api/v1/auth/refresh', {
        method: 'POST',
        body: { refreshToken, appId: this.appId } as any
      })
      if (res.data) await this.onTokensRefreshed?.(res.data)
      return res
    },
    logout: (refreshToken?: string) => {
      return this.request<HubResponse<void>>('/api/v1/auth/logout', {
        method: 'POST',
        body: { refreshToken, appId: this.appId } as any
      })
    },
    getRoutes: (params?: { appId?: string }) => {
      return this.request<HubResponse<HubSystemRoute[]>>('/api/v1/auth/routes', {
        method: 'GET',
        params: params as any
      })
    },
    listSessions: () => {
      return this.request<HubResponse<HubSession[]>>('/api/v1/auth/sessions', {
        method: 'GET'
      })
    },
    revokeSessions: (options?: { ids?: string | string[], all?: boolean }) => {
      const ids = options?.ids
      const idParam = Array.isArray(ids) ? ids.join(',') : ids
      return this.request<HubResponse<void>>('/api/v1/auth/sessions', {
        method: 'DELETE',
        params: {
          id: idParam,
          all: options?.all ? 'true' : undefined
        }
      })
    },
    /** Validate a token without being the token holder (for external services). */
    introspect: (token: string) => {
      return this.request<HubResponse<HubIntrospectResponse>>('/api/v1/auth/introspect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
    },

    // ==========================================
    // Two-factor authentication (v1.26)
    // ==========================================
    /**
     * Complete login after `auth.login()` returned `totpRequired`.
     * Pass the 6-digit TOTP code (or an unused recovery code).
     */
    verifyTotp: async (pendingTotpToken: string, code: string) => {
      const res = await this.request<HubResponse<HubAuthResponse>>('/api/v1/auth/totp/login', {
        method: 'POST',
        body: { pendingTotpToken, code, appId: this.appId } as any
      })
      this.rememberPermissions(res.data?.user?.permissions)
      return res
    },

    /** Start 2FA setup — returns an otpauth QR code data URL (scan in an authenticator app). */
    totpSetup: () => {
      return this.request<HubResponse<HubTotpSetupResponse>>('/api/v1/auth/totp/setup', {
        method: 'POST',
        body: { appId: this.appId } as any
      })
    },

    /** Confirm setup with a code — returns one-time recovery codes. */
    totpVerify: (code: string) => {
      return this.request<HubResponse<HubTotpVerifyResponse>>('/api/v1/auth/totp/verify', {
        method: 'POST',
        body: { code } as any
      })
    },

    /** Disable 2FA — requires a valid code or an unused recovery code. */
    totpDisable: (code: string) => {
      return this.request<HubResponse<void>>('/api/v1/auth/totp/disable', {
        method: 'POST',
        body: { code } as any
      })
    },

    // ==========================================
    // Passkeys (v1.26)
    // ==========================================
    /** List the current user's registered passkeys. */
    passkeyList: () => {
      return this.request<HubResponse<HubPasskeyInfo[]>>('/api/v1/auth/passkey/list', {
        method: 'GET',
        params: { appId: this.appId }
      })
    },

    /** WebAuthn registration step 1 — creation options for `navigator.credentials.create()`. */
    passkeyRegisterStart: (username: string, displayName?: string) => {
      return this.request<HubResponse<HubPasskeyRegisterStart>>('/api/v1/auth/passkey/register/start', {
        method: 'POST',
        body: { appId: this.appId, username, displayName: displayName || username } as any
      })
    },

    /** WebAuthn registration step 2 — submit the PublicKeyCredential (JSON form). */
    passkeyRegisterFinish: (credential: unknown) => {
      return this.request<HubResponse<HubPasskeyInfo>>('/api/v1/auth/passkey/register/finish', {
        method: 'POST',
        body: { appId: this.appId, credential } as any
      })
    },

    /** Remove a passkey by its credential id. */
    passkeyDelete: (credentialId: string) => {
      return this.request<HubResponse<void>>('/api/v1/auth/passkey/delete', {
        method: 'DELETE',
        params: { appId: this.appId, credentialId }
      })
    },

    /** WebAuthn login step 1 — assertion options for `navigator.credentials.get()` (no auth required). */
    passkeyLoginStart: () => {
      return this.request<HubResponse<HubPasskeyLoginStart>>('/api/v1/auth/passkey/login/start', {
        method: 'POST',
        body: { appId: this.appId } as any
      })
    },

    /** WebAuthn login step 2 — submit the assertion (JSON form); issues tokens on success. */
    passkeyLoginFinish: async (credential: unknown) => {
      const res = await this.request<HubResponse<HubAuthResponse>>('/api/v1/auth/passkey/login/finish', {
        method: 'POST',
        body: { appId: this.appId, credential } as any
      })
      this.rememberPermissions(res.data?.user?.permissions)
      return res
    },

    // ==========================================
    // OAuth (v1.25)
    // ==========================================
    /** List enabled OAuth providers for an app. */
    oauthProviders: (appId?: string) => {
      const target = appId || this.appId
      return this.request<HubOAuthProvidersResponse>(`/api/v1/auth/oauth/providers`, {
        method: 'GET',
        params: { appId: target }
      })
    },

    /** Start OAuth flow — returns authUrl to open in popup. */
    oauthStart: (provider: HubOAuthProvider, appId?: string) => {
      const target = appId || this.appId
      return this.request<HubResponse<HubOAuthStartResponse>>(`/api/v1/auth/oauth/${provider}/start`, {
        method: 'POST',
        body: { appId: target } as any
      })
    },

    /** Link OAuth account to current user (requires auth). */
    oauthLink: (provider: HubOAuthProvider, code: string, state: string, appId?: string) => {
      const target = appId || this.appId
      return this.request<HubResponse<HubOAuthLinkResponse>>(`/api/v1/auth/oauth/link`, {
        method: 'POST',
        body: { provider, code, state, appId: target } as any
      })
    }
  }

  // ==========================================
  // MODULE: Apps (Application Registry)
  // ==========================================
  public readonly apps = {
    list: (params?: HubListParams & { sortBy?: string, sortOrder?: 'asc' | 'desc', active?: 'true' | 'false' }) => {
      return this.request<HubAppsListResponse>('/api/v1/apps', {
        method: 'GET',
        params: params as any
      })
    },
    get: (appId: string) => {
      return this.request<HubResponse<HubApp>>(`/api/v1/apps/${appId}`, {
        method: 'GET'
      })
    },
    create: (app: Partial<HubApp> & { id: string, name: string }) => {
      return this.request<HubResponse<HubApp>>('/api/v1/apps', {
        method: 'POST',
        body: app as any
      })
    },
    update: (appId: string, app: Partial<HubApp>) => {
      return this.request<HubResponse<HubApp>>(`/api/v1/apps/${appId}`, {
        method: 'PATCH',
        body: app as any
      })
    },
    delete: (ids: string | string[]) => {
      const idParam = Array.isArray(ids) ? ids.join(',') : ids
      return this.request<HubResponse<{ success: boolean, deletedCount: number }>>('/api/v1/apps', {
        method: 'DELETE',
        params: { id: idParam }
      })
    },
    reorder: (orderedIds: string[]) => {
      return this.request<HubResponse<void>>('/api/v1/apps/reorder', {
        method: 'POST',
        body: { ids: orderedIds } as any
      })
    },
    rotateSecret: (appId: string) => {
      return this.request<HubResponse<{ id: string, secretKey: string }>>(`/api/v1/apps/${appId}/rotate-secret`, {
        method: 'POST'
      })
    }
  }

  // ==========================================
  // MODULE: Configs (Remote dynamic configuration)
  // ==========================================
  public readonly configs = {
    getPublic: (appId?: string) => {
      return this.request<HubResponse<Record<string, string>>>('/api/v1/configs/public', {
        method: 'GET',
        params: appId ? { appId } : undefined
      })
    },
    getPublicForApp: (appId: string) => {
      return this.request<HubResponse<Record<string, string>>>(`/api/v1/apps/${appId}/configs/public`, {
        method: 'GET'
      })
    },
    getAll: (params?: HubListParams) => {
      return this.request<HubResponse<Record<string, string>>>(`/api/v1/apps/${this.appId}/configs`, {
        method: 'GET',
        params: params as any
      })
    },
    update: (configs: Record<string, any>) => {
      return this.request<HubResponse<void>>(`/api/v1/apps/${this.appId}/configs`, {
        method: 'PUT',
        body: configs as any
      })
    }
  }

  // ==========================================
  // MODULE: Media (Cloudinary Gateway)
  // ==========================================
  public readonly media = {
    getSignature: (params?: Record<string, unknown>) => {
      return this.request<HubResponse<HubMediaSignature>>(`/api/v1/apps/${this.appId}/media/signature`, {
        method: 'POST',
        body: { params } as any
      })
    },
    getResources: (params?: HubResourceListParams) => {
      const { max_results, next_cursor, ...rest } = params || {}
      return this.request<HubResponse<HubMediaResourcesResponse> & { resources?: HubMediaResourcesResponse['resources'], nextCursor?: string | null }>(`/api/v1/apps/${this.appId}/media/resources`, {
        method: 'GET',
        params: {
          ...rest,
          limit: rest.limit ?? max_results,
          cursor: rest.cursor ?? next_cursor
        }
      })
    },
    deleteResources: (publicIds: string[]) => {
      return this.request<HubResponse<{ deleted?: Record<string, string> }>>(`/api/v1/apps/${this.appId}/media/resources`, {
        method: 'DELETE',
        body: { publicIds } as any
      })
    },
    getFolders: (folder?: string) => {
      return this.request<HubResponse<HubMediaFoldersResponse>>(`/api/v1/apps/${this.appId}/media/folders`, {
        method: 'GET',
        params: folder ? { folder } : undefined
      })
    },
    createFolder: (name: string, parent?: string) => {
      const folder = parent ? `${parent}/${name}` : name
      return this.request<HubResponse<unknown>>(`/api/v1/apps/${this.appId}/media/folders`, {
        method: 'POST',
        body: { folder, parent } as any
      })
    },
    deleteFolder: (folder: string) => {
      return this.request<HubResponse<unknown>>(`/api/v1/apps/${this.appId}/media/folders`, {
        method: 'DELETE',
        params: { folder }
      })
    },
    renameResource: (from: string, to: string) => {
      return this.request<HubResponse<unknown> & { message?: string }>(`/api/v1/apps/${this.appId}/media/resources/rename`, {
        method: 'POST',
        body: { from_public_id: from, to_public_id: to } as any
      })
    }
  }

  // ==========================================
  // MODULE: Notifications (Web Push & In-app)
  // ==========================================
  public readonly notifications = {
    list: (params?: HubListParams) => {
      return this.request<HubResponse<HubNotification[]>>(`/api/v1/apps/${this.appId}/notifications`, {
        method: 'GET',
        params: params as any
      })
    },
    markRead: (notifyId: string) => {
      return this.request<HubResponse<void>>(`/api/v1/apps/${this.appId}/notifications/${notifyId}/read`, {
        method: 'POST'
      })
    },
    markReadAll: () => {
      return this.request<HubResponse<void>>(`/api/v1/apps/${this.appId}/notifications/read-all`, {
        method: 'POST'
      })
    },
    delete: (ids: string | string[]) => {
      const idParam = Array.isArray(ids) ? ids.join(',') : ids
      return this.request<HubResponse<void>>(`/api/v1/apps/${this.appId}/notifications`, {
        method: 'DELETE',
        params: { id: idParam }
      })
    },
    subscribePush: (subscription: HubPushSubscription) => {
      return this.request<HubResponse<unknown>>(`/api/v1/apps/${this.appId}/notifications/subscribe`, {
        method: 'POST',
        body: subscription as any
      })
    },
    unsubscribePush: (endpoint: string) => {
      return this.request<HubResponse<void>>(`/api/v1/apps/${this.appId}/notifications/unsubscribe`, {
        method: 'POST',
        body: { endpoint } as any
      })
    },
    send: (payload: { title: string, body: string, userId?: string, url?: string, icon?: string }) => {
      return this.request<HubResponse<void> & { sentCount?: number }>(`/api/v1/apps/${this.appId}/notifications/send`, {
        method: 'POST',
        body: payload as any
      })
    }
  }

  // ==========================================
  // MODULE: Users (Manage app users)
  // ==========================================
  public readonly users = {
    list: (params?: HubListParams) => {
      return this.request<HubResponse<HubUser[]>>(`/api/v1/apps/${this.appId}/users`, {
        method: 'GET',
        params: params as any
      })
    },
    create: (user: Partial<HubUser> & { email?: string, password?: string }) => {
      return this.request<HubResponse<HubUser>>(`/api/v1/apps/${this.appId}/users`, {
        method: 'POST',
        body: user as any
      })
    },
    update: (id: string, user: Partial<HubUser> & { role?: string, isActive?: boolean }) => {
      return this.request<HubResponse<void>>(`/api/v1/apps/${this.appId}/users`, {
        method: 'PUT',
        params: { id },
        body: user as any
      })
    },
    delete: (ids: string | string[]) => {
      const idParam = Array.isArray(ids) ? ids.join(',') : ids
      return this.request<HubResponse<void>>(`/api/v1/apps/${this.appId}/users`, {
        method: 'DELETE',
        params: { id: idParam }
      })
    },
    /** Admin: set/reset a user's password (no current password required). */
    adminSetPassword: (userId: string, password: string, appId?: string) => {
      const target = appId || this.appId
      return this.request<HubResponse<HubAdminPasswordSetResponse>>(`/api/v1/apps/${target}/users/${userId}/password`, {
        method: 'POST',
        body: { password } as any
      })
    },
    /** Admin: generate a temporary password for a user. */
    adminResetPassword: (userId: string, appId?: string) => {
      const target = appId || this.appId
      return this.request<HubResponse<HubAdminPasswordSetResponse>>(`/api/v1/apps/${target}/users/${userId}/password`, {
        method: 'POST',
        body: { generateTemp: true } as any
      })
    },
    /** Admin: list all sessions for a specific user. */
    getSessions: (userId: string, params?: HubListParams, appId?: string) => {
      const target = appId || this.appId
      return this.request<HubResponse<HubSession[]>>(`/api/v1/apps/${target}/users/${userId}/sessions`, {
        method: 'GET',
        params: params as any
      })
    },
    /** Admin: revoke a specific session of a user. */
    revokeSession: (userId: string, sessionId: string, appId?: string) => {
      const target = appId || this.appId
      return this.request<HubResponse<void>>(`/api/v1/apps/${target}/users/${userId}/sessions/${sessionId}`, {
        method: 'DELETE'
      })
    }
  }

  // ==========================================
  // MODULE: RBAC & Routes (Manage app permissions)
  // ==========================================
  public readonly roles = {
    list: (params?: HubListParams) => {
      return this.request<HubResponse<HubRole[]>>(`/api/v1/apps/${this.appId}/roles`, {
        method: 'GET',
        params: params as any
      })
    },
    create: (role: Partial<HubRole> & { name: string }) => {
      return this.request<HubResponse<HubRole>>(`/api/v1/apps/${this.appId}/roles`, {
        method: 'POST',
        body: role as any
      })
    },
    update: (role: Partial<HubRole> & { id: string }) => {
      return this.request<HubResponse<HubRole>>(`/api/v1/apps/${this.appId}/roles`, {
        method: 'PUT',
        params: { id: role.id },
        body: role as any
      })
    },
    delete: (ids: string | string[]) => {
      const idParam = Array.isArray(ids) ? ids.join(',') : ids
      return this.request<HubResponse<void>>(`/api/v1/apps/${this.appId}/roles`, {
        method: 'DELETE',
        params: { id: idParam }
      })
    }
  }

  public readonly routes = {
    list: async (params?: HubListParams) => {
      const res = await this.request<HubResponse<HubRouteListPayload>>(`/api/v1/apps/${this.appId}/routes`, {
        method: 'GET',
        params: params as any
      })
      const payload = res.data
      return {
        ...res,
        data: payload?.tree ?? payload?.routes ?? [],
        routes: payload?.routes,
        tree: payload?.tree
      }
    },
    create: (route: Partial<HubSystemRoute> & { id: string, path: string, name: string }) => {
      return this.request<HubResponse<HubSystemRoute>>(`/api/v1/apps/${this.appId}/routes`, {
        method: 'POST',
        body: route as any
      })
    },
    update: (route: Partial<HubSystemRoute> & { id: string }) => {
      return this.request<HubResponse<HubSystemRoute>>(`/api/v1/apps/${this.appId}/routes`, {
        method: 'PUT',
        params: { id: route.id },
        body: route as any
      })
    },
    delete: async (ids: string | string[]) => {
      const idList = (Array.isArray(ids) ? ids : [ids]).filter(Boolean)
      const results: HubResponse<void>[] = []
      for (const id of idList) {
        results.push(await this.request<HubResponse<void>>(`/api/v1/apps/${this.appId}/routes`, {
          method: 'DELETE',
          params: { id }
        }))
      }
      return results.length === 1 ? results[0] : { success: results.every(r => r.success !== false), data: undefined }
    }
  }

  // ==========================================
  // MODULE: Logs (Dedicated MongoDB Audit Logs)
  // ==========================================
  public readonly logs = {
    list: (params?: { limit?: number, cursor?: number }) => {
      return this.request<HubResponse<HubAuditLog[]>>(`/api/v1/apps/${this.appId}/logs`, {
        method: 'GET',
        params: params as any
      })
    }
  }

  public readonly auditLogs = this.logs

  // ==========================================
  // MODULE: Permissions (read-only capability catalog §6.4)
  // ==========================================
  public readonly permissions = {
    catalog: (appId?: string) => {
      const target = appId || this.appId
      return this.request<HubPermissionCatalogResponse>(`/api/v1/apps/${target}/permissions`, {
        method: 'GET'
      })
    },
    list: (appId?: string) => {
      const target = appId || this.appId
      return this.request<HubPermissionCatalogResponse>(`/api/v1/apps/${target}/permissions`, {
        method: 'GET'
      })
    }
  }

  // ==========================================
  // MODULE: Connections (per-app provider credentials)
  // ==========================================
  public readonly connections = {
    /** Provider definitions merged with this app's connection status (secrets never returned). */
    list: (appId?: string) => {
      const target = appId || this.appId
      return this.request<HubResponse<HubConnectionProvider[]>>(`/api/v1/apps/${target}/connections`, {
        method: 'GET'
      })
    },
    /** Manual credentials connect (e.g. Cloudinary) — secrets are encrypted server-side. */
    saveManual: (provider: string, values: Record<string, string>, appId?: string) => {
      const target = appId || this.appId
      return this.request<HubResponse<{ connection: HubConnectionProvider['connection'], test: HubConnectionTestResult }>>(
        `/api/v1/apps/${target}/connections/manual`,
        { method: 'POST', body: { provider, values } as any }
      )
    },
    /**
     * Quick connect: no credentials sent — the server reads this app's configs
     * (app_configs, managed on the Configs page), verifies them live and stores
     * the connection row. Currently supported by providers flagged `quick` (cloudinary).
     */
    quick: (provider: string, appId?: string) => {
      const target = appId || this.appId
      return this.request<HubResponse<{ connection: HubConnectionProvider['connection'], test: HubConnectionTestResult }>>(
        `/api/v1/apps/${target}/connections/quick`,
        { method: 'POST', body: { provider } as any }
      )
    },
    /** Test a stored connection (updates last_test_* server-side). */
    test: (provider: string, appId?: string) => {
      const target = appId || this.appId
      return this.request<HubResponse<HubConnectionTestResult>>(`/api/v1/apps/${target}/connections/test`, {
        method: 'POST',
        body: { provider } as any
      })
    },
    /** Disconnect + delete stored credentials. */
    disconnect: (provider: string, appId?: string) => {
      const target = appId || this.appId
      return this.request<HubResponse<void>>(`/api/v1/apps/${target}/connections/${provider}`, {
        method: 'DELETE'
      })
    },
    /**
     * OAuth start: returns the provider consent URL (state carries app_id).
     * Open it in a popup/window; the fixed callback posts
     * `{ type: 'tm-hub-oauth', status }` back to the opener.
     */
    oauthStart: (provider: string, appId?: string) => {
      const target = appId || this.appId
      return this.request<HubResponse<HubOAuthStartResponse>>(`/api/v1/oauth/${provider}/auth`, {
        method: 'POST',
        body: { app_id: target } as any
      })
    }
  }

  // ==========================================
  // MODULE: Data Import (CSV/JSON/paste/Sheets → configs/users/routes)
  // ==========================================
  public readonly imports = {
    /** Target definitions (identifier + required/optional fields). */
    targets: (appId?: string) => {
      const target = appId || this.appId
      return this.request<HubResponse<HubImportTarget[]>>(`/api/v1/apps/${target}/import`, {
        method: 'GET'
      })
    },
    /** Get target config with full schema (fields, validation, transformers, samples). */
    target: (target: HubImportTargetExtended, appId?: string) => {
      const app = appId || this.appId
      return this.request<HubResponse<HubImportTargetConfig>>(`/api/v1/apps/${app}/import/targets/${target}`, {
        method: 'GET'
      })
    },
    /** Dry-run: validate rows and detect create/update per row. */
    preview: (target: HubImportTargetExtended, rows: HubImportRow[], appId?: string) => {
      const app = appId || this.appId
      return this.request<HubResponse<HubImportRowResult[]>>(`/api/v1/apps/${app}/import/preview`, {
        method: 'POST',
        body: { target, rows } as any
      })
    },
    /** Preview with full source config and options (supports google, csv, paste, json). */
    previewWithConfig: (target: HubImportTargetExtended, source: HubImportSource, rows: HubImportRow[], sourceConfig?: HubImportSourceConfig, options?: Partial<HubImportOptions>, appId?: string) => {
      const app = appId || this.appId
      return this.request<HubResponse<{ validation: HubImportValidationResult, preview: HubImportPreview }>>(`/api/v1/apps/${app}/import/preview`, {
        method: 'POST',
        body: { target, source, rows, sourceConfig, options } as any
      })
    },
    /** Apply rows (upsert, per-row error isolation). */
    run: (target: HubImportTargetExtended, rows: HubImportRow[], appId?: string) => {
      const app = appId || this.appId
      return this.request<HubResponse<HubImportRunResult>>(`/api/v1/apps/${app}/import/run`, {
        method: 'POST',
        body: { target, rows } as any
      })
    },
    /** Execute import with full options, preview, and source config (sync). */
    execute: (target: HubImportTargetExtended, source: HubImportSource, rows: HubImportRow[], sourceConfig?: HubImportSourceConfig, options?: Partial<HubImportOptions>, preview?: HubImportPreview, appId?: string) => {
      const app = appId || this.appId
      return this.request<HubResponse<HubImportResult>>(`/api/v1/apps/${app}/import/execute`, {
        method: 'POST',
        body: { target, source, rows, sourceConfig, options, preview } as any
      })
    },
    /** Schedule an import job (async, queued). */
    schedule: (target: HubImportTargetExtended, source: HubImportSource, sourceConfig: HubImportSourceConfig, options?: Partial<HubImportOptions>, priority?: 'high' | 'normal' | 'low', scheduledAt?: Date, maxAttempts?: number, appId?: string) => {
      const app = appId || this.appId
      return this.request<HubResponse<{ jobId: string, status: string }>>(`/api/v1/apps/${app}/import/schedule`, {
        method: 'POST',
        body: { target, source, sourceConfig, options, priority, scheduledAt: scheduledAt?.toISOString(), maxAttempts } as any
      })
    },
    /** List import jobs with pagination and filters. */
    listJobs: (params?: HubImportJobListParams, appId?: string) => {
      const app = appId || this.appId
      return this.request<HubResponse<HubImportJobListItem[]> & { meta?: HubPaginatedImportJobs['meta'] }>(`/api/v1/apps/${app}/import/jobs`, {
        method: 'GET',
        params: params as any
      })
    },
    /** Get import job detail. */
    getJob: (jobId: string, appId?: string) => {
      const app = appId || this.appId
      return this.request<HubResponse<HubImportJob>>(`/api/v1/apps/${app}/import/jobs/${jobId}`, {
        method: 'GET'
      })
    },
    /** Cancel a pending/running import job. */
    cancel: (jobId: string, appId?: string) => {
      const app = appId || this.appId
      return this.request<HubResponse<{ removed: boolean }>>(`/api/v1/apps/${app}/import/jobs/${jobId}`, {
        method: 'DELETE'
      })
    },
    /** Get queue statistics. */
    getStats: (appId?: string) => {
      const app = appId || this.appId
      return this.request<HubResponse<HubQueueStats>>(`/api/v1/apps/${app}/import/stats`, {
        method: 'GET'
      })
    },
    /** Download error log for a job. */
    getJobLog: (jobId: string, appId?: string) => {
      const app = appId || this.appId
      return this.request<HubResponse<string>>(`/api/v1/apps/${app}/import/jobs/${jobId}/download`, {
        method: 'GET'
      })
    },
    /** Read a Google Sheet server-side — the access token never leaves tm-hub. */
    fetchSheet: (spreadsheetId: string, range: string, appId?: string) => {
      const app = appId || this.appId
      return this.request<HubResponse<HubSheetValues>>(`/api/v1/apps/${app}/import/sheets`, {
        method: 'GET',
        params: { spreadsheet_id: spreadsheetId, range }
      })
    },
    /** Import Templates */
    templates: {
      /** List import templates. */
      list: (target?: HubImportTargetExtended, isSystem?: boolean, page?: number, limit?: number, appId?: string) => {
        const app = appId || this.appId
        return this.request<HubResponse<HubImportTemplate[]> & { meta?: HubPaginatedImportJobs['meta'] }>(`/api/v1/apps/${app}/import/templates`, {
          method: 'GET',
          params: { target, is_system: isSystem, page, limit } as any
        })
      },
      /** Create a new import template. */
      create: (target: HubImportTargetExtended, name: string, columns: HubImportColumn[], description?: string, mappings?: Record<string, string>, defaultValues?: Record<string, any>, validationRules?: HubImportValidationRule[], isSystem?: boolean, appId?: string) => {
        const app = appId || this.appId
        return this.request<HubResponse<HubImportTemplate>>(`/api/v1/apps/${app}/import/templates`, {
          method: 'POST',
          body: { target, name, columns, description, mappings, defaultValues, validationRules, isSystem } as any
        })
      },
      /** Get a template by ID. */
      get: (templateId: string, appId?: string) => {
        const app = appId || this.appId
        return this.request<HubResponse<HubImportTemplate>>(`/api/v1/apps/${app}/import/templates/${templateId}`, {
          method: 'GET'
        })
      },
      /** Update a template. */
      update: (templateId: string, data: Partial<Pick<HubImportTemplate, 'name' | 'description' | 'columns' | 'mappings' | 'defaultValues' | 'validationRules'>>, appId?: string) => {
        const app = appId || this.appId
        return this.request<HubResponse<HubImportTemplate>>(`/api/v1/apps/${app}/import/templates/${templateId}`, {
          method: 'PUT',
          body: data as any
        })
      },
      /** Delete a template. */
      delete: (templateId: string, appId?: string) => {
        const app = appId || this.appId
        return this.request<HubResponse<{ message: string }>>(`/api/v1/apps/${app}/import/templates/${templateId}`, {
          method: 'DELETE'
        })
      },
      /** Download a template as CSV. */
      download: (templateId: string, format: 'csv' | 'json' = 'csv', appId?: string) => {
        const app = appId || this.appId
        return this.request<HubResponse<string>>(`/api/v1/apps/${app}/import/templates/${templateId}/download`, {
          method: 'GET',
          params: { format }
        })
      }
    }
  }

  // ==========================================
  // MODULE: Export Data (Phase E — export jobs & templates)
  // ==========================================
  public readonly export = {
    /** Start an export job — job runs inline and is returned completed/failed. */
    start: (module: string, options: HubExportOptions) => {
      return this.request<HubResponse<HubExportJob>>(`/api/v1/apps/${this.appId}/modules/${encodeURIComponent(module)}/export`, {
        method: 'POST',
        body: { options } as any
      })
    },
    /** List export jobs (modules filtered server-side by capability; `mine` scopes to current user). */
    jobs: (params?: HubExportJobListParams) => {
      return this.request<HubResponse<HubExportJob[]>>(`/api/v1/apps/${this.appId}/export/jobs`, {
        method: 'GET',
        params: {
          module: params?.module,
          mine: params?.mine ? 'true' : undefined,
          limit: params?.limit,
          offset: params?.offset
        } as any
      })
    },
    job: (jobId: string) => {
      return this.request<HubResponse<HubExportJob>>(`/api/v1/apps/${this.appId}/export/jobs/${encodeURIComponent(jobId)}`, {
        method: 'GET'
      })
    },
    deleteJob: (jobId: string) => {
      return this.request<HubResponse<{ id: string, deleted: boolean }>>(`/api/v1/apps/${this.appId}/export/jobs/${encodeURIComponent(jobId)}`, {
        method: 'DELETE'
      })
    },
    /** Direct download URL — caller must attach Authorization header. */
    downloadUrl: (jobId: string) =>
      `${this.baseUrl}/api/v1/apps/${this.appId}/export/jobs/${encodeURIComponent(jobId)}/download`,
    /** Download exported file as Blob (auto refresh token on 401). */
    download: async (jobId: string): Promise<Blob> => {
      const url = this.export.downloadUrl(jobId)
      const doFetch = (): Promise<Response> => {
        const headers = new Headers({ 'X-App-Id': this.appId })
        return Promise.resolve(this.getAccessToken?.()).then((token) => {
          if (token) headers.set('Authorization', `Bearer ${token}`)
          return this.customFetch(url, { headers })
        })
      }
      let response = await doFetch()
      if (response.status === 401 && this.getRefreshToken) {
        const refreshed = await this.tryRefreshTokens()
        if (refreshed) response = await doFetch()
      }
      if (!response.ok) {
        let errorBody: any
        try { errorBody = await response.json() } catch { errorBody = { message: response.statusText } }
        const error = new Error(errorBody.message || errorBody.statusMessage || `Download failed with status ${response.status}`)
        ;(error as any).statusCode = response.status
        ;(error as any).data = errorBody
        throw error
      }
      return response.blob()
    },
    templates: (module?: string) => {
      return this.request<HubResponse<HubExportTemplate[]>>(`/api/v1/apps/${this.appId}/export/templates`, {
        method: 'GET',
        params: { module } as any
      })
    },
    createTemplate: (data: { module: string, name: string, description?: string, options: HubExportOptions, isDefault?: boolean }) => {
      return this.request<HubResponse<HubExportTemplate>>(`/api/v1/apps/${this.appId}/export/templates`, {
        method: 'POST',
        body: data as any
      })
    },
    updateTemplate: (templateId: string, data: { name?: string, description?: string, options?: HubExportOptions, isDefault?: boolean }) => {
      return this.request<HubResponse<HubExportTemplate>>(`/api/v1/apps/${this.appId}/export/templates/${encodeURIComponent(templateId)}`, {
        method: 'PUT',
        body: data as any
      })
    },
    deleteTemplate: (templateId: string) => {
      return this.request<HubResponse<{ id: string, deleted: boolean }>>(`/api/v1/apps/${this.appId}/export/templates/${encodeURIComponent(templateId)}`, {
        method: 'DELETE'
      })
    }
  }

  // ==========================================
  // MODULE: Mail (send/schedule, templates, inbox, analytics, queue, jobs)
  // ==========================================
  public readonly mail = {
    providers: () => {
      return this.request<HubResponse<HubMailProviderInfo[]>>(`/api/v1/apps/${this.appId}/mail/providers`, {
        method: 'GET'
      })
    },
    send: (data: HubMailSendOptions) => {
      return this.request<HubResponse<HubMailSendResult>>(`/api/v1/apps/${this.appId}/mail/send`, {
        method: 'POST',
        body: data as any
      })
    },
    schedule: (data: HubMailScheduleOptions) => {
      return this.request<HubResponse<HubMailSendResult & { jobId?: string }>>(`/api/v1/apps/${this.appId}/mail/schedule`, {
        method: 'POST',
        body: data as any
      })
    },
    test: (to: string) => {
      return this.request<HubResponse<{ messageId?: string, provider?: string }>>(`/api/v1/apps/${this.appId}/mail/test`, {
        method: 'POST',
        body: { to } as any
      })
    },
    stats: () => {
      return this.request<HubResponse<unknown>>(`/api/v1/apps/${this.appId}/mail/stats`, {
        method: 'GET'
      })
    },

    templates: {
      list: (params?: HubMailTemplateListParams) => {
        return this.request<HubResponse<HubMailTemplate[]> & { pagination?: { page: number, limit: number, total: number } }>(
          `/api/v1/apps/${this.appId}/mail/templates`,
          { method: 'GET', params: params as any }
        )
      },
      get: (templateId: string) => {
        return this.request<HubResponse<HubMailTemplate>>(`/api/v1/apps/${this.appId}/mail/templates/${encodeURIComponent(templateId)}`, {
          method: 'GET'
        })
      },
      byKey: (key: string, locale?: string) => {
        return this.request<HubResponse<HubMailTemplate>>(`/api/v1/apps/${this.appId}/mail/templates/by-key/${encodeURIComponent(key)}`, {
          method: 'GET',
          params: locale ? { locale } : undefined
        })
      },
      create: (data: HubMailTemplateInput) => {
        return this.request<HubResponse<HubMailTemplate>>(`/api/v1/apps/${this.appId}/mail/templates`, {
          method: 'POST',
          body: data as any
        })
      },
      update: (templateId: string, data: Partial<HubMailTemplateInput>) => {
        return this.request<HubResponse<HubMailTemplate>>(`/api/v1/apps/${this.appId}/mail/templates/${encodeURIComponent(templateId)}`, {
          method: 'PUT',
          body: data as any
        })
      },
      delete: (templateId: string) => {
        return this.request<HubResponse<unknown>>(`/api/v1/apps/${this.appId}/mail/templates/${encodeURIComponent(templateId)}`, {
          method: 'DELETE'
        })
      },
      archive: (templateId: string) => {
        return this.request<HubResponse<HubMailTemplate>>(`/api/v1/apps/${this.appId}/mail/templates/${encodeURIComponent(templateId)}/archive`, {
          method: 'POST'
        })
      },
      clone: (templateId: string) => {
        return this.request<HubResponse<HubMailTemplate>>(`/api/v1/apps/${this.appId}/mail/templates/${encodeURIComponent(templateId)}/clone`, {
          method: 'POST'
        })
      },
      publish: (templateId: string) => {
        return this.request<HubResponse<HubMailTemplate>>(`/api/v1/apps/${this.appId}/mail/templates/${encodeURIComponent(templateId)}/publish`, {
          method: 'POST'
        })
      },
      preview: (templateId: string, variables?: Record<string, unknown>) => {
        return this.request<HubResponse<HubMailTemplatePreview>>(`/api/v1/apps/${this.appId}/mail/templates/${encodeURIComponent(templateId)}/preview`, {
          method: 'POST',
          body: { variables } as any
        })
      }
    },

    analytics: {
      summary: (params?: HubMailAnalyticsParams) => {
        return this.request<HubResponse<HubMailAnalyticsSummary>>(`/api/v1/apps/${this.appId}/mail/analytics/summary`, {
          method: 'GET',
          params: params as any
        })
      },
      timeseries: (params?: HubMailAnalyticsParams & { granularity?: 'hour' | 'day' | 'week' | 'month' }) => {
        return this.request<HubResponse<HubMailTimeseriesPoint[]>>(`/api/v1/apps/${this.appId}/mail/analytics/timeseries`, {
          method: 'GET',
          params: params as any
        })
      },
      campaigns: (params?: HubMailAnalyticsParams) => {
        return this.request<HubResponse<unknown>>(`/api/v1/apps/${this.appId}/mail/analytics/campaigns`, {
          method: 'GET',
          params: params as any
        })
      },
      events: (params?: HubMailEventQuery) => {
        return this.request<HubResponse<HubMailAnalyticsEventsResult>>(`/api/v1/apps/${this.appId}/mail/analytics/events`, {
          method: 'GET',
          params: params as any
        })
      },
      topDomains: (params?: HubMailAnalyticsParams & { limit?: number }) => {
        return this.request<HubResponse<HubMailTopDomainStats[]>>(`/api/v1/apps/${this.appId}/mail/analytics/top-domains`, {
          method: 'GET',
          params: params as any
        })
      },
      topTemplates: (params?: HubMailAnalyticsParams & { limit?: number }) => {
        return this.request<HubResponse<HubMailTopTemplateStats[]>>(`/api/v1/apps/${this.appId}/mail/analytics/top-templates`, {
          method: 'GET',
          params: params as any
        })
      },
      exportCsvUrl: (params?: HubMailAnalyticsParams) => {
        const query = new URLSearchParams()
        if (params?.from) query.set('from', params.from)
        if (params?.to) query.set('to', params.to)
        const suffix = query.toString() ? `?${query.toString()}` : ''
        return `${this.baseUrl}/api/v1/apps/${this.appId}/mail/analytics/export${suffix}`
      }
    },

    inbox: {
      profile: () => {
        return this.request<HubResponse<HubInboxProfile>>(`/api/v1/apps/${this.appId}/mail/inbox/profile`, {
          method: 'GET'
        })
      },
      messages: (params?: HubInboxMessagesQuery) => {
        return this.request<HubResponse<HubInboxMessagesResult>>(`/api/v1/apps/${this.appId}/mail/inbox/messages`, {
          method: 'GET',
          params: params as any
        })
      },
      message: (messageId: string) => {
        return this.request<HubResponse<HubInboxDetail>>(`/api/v1/apps/${this.appId}/mail/inbox/messages/${encodeURIComponent(messageId)}`, {
          method: 'GET'
        })
      },
      thread: (threadId: string) => {
        return this.request<HubResponse<HubInboxThread>>(`/api/v1/apps/${this.appId}/mail/inbox/threads/${encodeURIComponent(threadId)}`, {
          method: 'GET'
        })
      },
      send: (data: HubInboxSendInput) => {
        return this.request<HubResponse<HubInboxItem>>(`/api/v1/apps/${this.appId}/mail/inbox/messages`, {
          method: 'POST',
          body: data as any
        })
      },
      setLabels: (messageId: string, data: HubInboxLabelsInput) => {
        return this.request<HubResponse<HubInboxItem>>(`/api/v1/apps/${this.appId}/mail/inbox/messages/${encodeURIComponent(messageId)}/labels`, {
          method: 'POST',
          body: data as any
        })
      },
      attachmentUrl: (messageId: string, attachmentId: string) =>
        `${this.baseUrl}/api/v1/apps/${this.appId}/mail/inbox/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`
    },

    queue: {
      get: (params?: HubMailQueueQuery) => {
        return this.request<HubResponse<HubMailQueueState>>(`/api/v1/apps/${this.appId}/mail/queue`, {
          method: 'GET',
          params: params as any
        })
      },
      action: (action: HubMailQueueAction, jobId?: string) => {
        return this.request<HubResponse<{ action: string }>>(`/api/v1/apps/${this.appId}/mail/queue`, {
          method: 'POST',
          body: { action, jobId } as any
        })
      }
    },

    jobs: {
      get: (jobId: string) => {
        return this.request<HubResponse<HubMailJobDetail>>(`/api/v1/apps/${this.appId}/mail/jobs/${encodeURIComponent(jobId)}`, {
          method: 'GET'
        })
      },
      delete: (jobId: string) => {
        return this.request<HubResponse<{ success: boolean }>>(`/api/v1/apps/${this.appId}/mail/jobs/${encodeURIComponent(jobId)}`, {
          method: 'DELETE'
        })
      }
    }
  }

  // ==========================================
  // MODULE: Capabilities (client-side helpers)
  // ==========================================
  public readonly capabilities = {
    has: (capability: Capability): boolean => {
      const perms = this.cachedPermissions
      if (!perms) return false
      if (perms.includes('*')) return true
      if (perms.includes(capability)) return true
      const aliases = CAPABILITY_ALIASES[capability] || []
      return aliases.some(a => perms.includes(a))
    },
    canAccessApp: (targetAppId: string): boolean => {
      if (!targetAppId || targetAppId === this.appId) return true
      const perms = this.cachedPermissions
      if (!perms) return false
      if (perms.includes('*')) return true
      return perms.includes('platform.crossapp.read') || perms.includes('platform.crossapp.write')
    },
    /** Load permissions from /auth/permissions and cache them. */
    load: async (): Promise<boolean> => {
      try {
        await this.auth.permissions()
        return this.cachedPermissions !== null
      } catch {
        return false
      }
    }
  }
}

export function createHubClient(options: HubClientOptions): HubClient {
  return new HubClient(options)
}
