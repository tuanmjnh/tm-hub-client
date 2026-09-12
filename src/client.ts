import type {
  HubClientOptions,
  HubResponse,
  HubAuthResponse,
  HubAuthUser,
  HubRole,
  HubUser,
  HubSystemRoute,
  HubMediaSignature,
  HubNotification,
  HubAuditLog
} from './types'

export class HubClient {
  private baseUrl: string
  public appId: string
  private getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>
  private onUnauthorized?: () => void
  private customFetch: typeof globalThis.fetch

  constructor(options: HubClientOptions) {
    this.baseUrl = (options.baseUrl || 'http://localhost:4000').replace(/\/$/, '')
    this.appId = options.appId
    this.getAccessToken = options.getAccessToken
    this.onUnauthorized = options.onUnauthorized
    this.customFetch = options.fetch || globalThis.fetch.bind(globalThis)
  }

  /**
   * Generic request executor with automatic token & appId headers
   */
  async request<T = unknown>(
    path: string,
    options: RequestInit & { params?: Record<string, any> } = {}
  ): Promise<T> {
    const { params, headers: customHeaders, ...fetchOpts } = options

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

  // ==========================================
  // MODULE: Auth
  // ==========================================
  public readonly auth = {
    login: (credentials: { email: string, password: string, platform?: string }) => {
      return this.request<HubResponse<HubAuthResponse>>('/api/v1/auth/login', {
        method: 'POST',
        body: { ...credentials, appId: this.appId } as any
      })
    },
    register: (data: { email: string, password: string, name: string }) => {
      return this.request<HubResponse<HubAuthResponse>>('/api/v1/auth/register', {
        method: 'POST',
        body: { ...data, appId: this.appId } as any
      })
    },
    me: () => {
      return this.request<HubResponse<HubAuthUser>>('/api/v1/auth/me', {
        method: 'GET'
      })
    },
    refresh: (refreshToken: string) => {
      return this.request<HubResponse<{ accessToken: string, expiresIn: number }>>('/api/v1/auth/refresh', {
        method: 'POST',
        body: { refreshToken, appId: this.appId } as any
      })
    },
    logout: (refreshToken?: string) => {
      return this.request<HubResponse<{ success: boolean }>>('/api/v1/auth/logout', {
        method: 'POST',
        body: { refreshToken, appId: this.appId } as any
      })
    },
    getRoutes: () => {
      return this.request<HubResponse<HubSystemRoute[]>>('/api/v1/auth/routes', {
        method: 'GET'
      })
    }
  }

  // ==========================================
  // MODULE: Configs (Remote dynamic configuration)
  // ==========================================
  public readonly configs = {
    getPublic: () => {
      return this.request<HubResponse<Record<string, string>>>('/api/v1/configs/public', {
        method: 'GET'
      })
    },
    getAll: () => {
      return this.request<HubResponse<Record<string, string>>>(`/api/v1/apps/${this.appId}/configs`, {
        method: 'GET'
      })
    },
    update: (configs: Record<string, any>) => {
      return this.request<HubResponse<{ success: boolean, message: string }>>(`/api/v1/apps/${this.appId}/configs`, {
        method: 'PUT',
        body: configs as any
      })
    }
  }

  // ==========================================
  // MODULE: Media (Cloudinary Gateway)
  // ==========================================
  public readonly media = {
    getSignature: (params?: { folder?: string }) => {
      return this.request<HubResponse<HubMediaSignature>>(`/api/v1/apps/${this.appId}/media/signature`, {
        method: 'POST',
        body: { params } as any
      })
    },
    getResources: (params?: { folder?: string, max_results?: number, next_cursor?: string }) => {
      return this.request<HubResponse<any>>(`/api/v1/apps/${this.appId}/media/resources`, {
        method: 'GET',
        params
      })
    },
    deleteResources: (publicIds: string[]) => {
      return this.request<HubResponse<{ deleted: Record<string, string> }>>(`/api/v1/apps/${this.appId}/media/resources`, {
        method: 'DELETE',
        body: { publicIds } as any
      })
    },
    getFolders: (folder?: string) => {
      return this.request<HubResponse<any>>(`/api/v1/apps/${this.appId}/media/folders`, {
        method: 'GET',
        params: folder ? { folder } : undefined
      })
    },
    createFolder: (name: string, parent?: string) => {
      return this.request<HubResponse<any>>(`/api/v1/apps/${this.appId}/media/folders`, {
        method: 'POST',
        body: { folder: name, parent } as any
      })
    },
    deleteFolder: (folder: string) => {
      return this.request<HubResponse<any>>(`/api/v1/apps/${this.appId}/media/folders`, {
        method: 'DELETE',
        params: { folder }
      })
    },
    renameResource: (from: string, to: string) => {
      return this.request<HubResponse<{ success: boolean, message: string }>>(`/api/v1/apps/${this.appId}/media/resources/rename`, {
        method: 'POST',
        body: { from_public_id: from, to_public_id: to } as any
      })
    }
  }

  // ==========================================
  // MODULE: Notifications (Web Push & In-app)
  // ==========================================
  public readonly notifications = {
    list: () => {
      return this.request<HubResponse<HubNotification[]>>(`/api/v1/apps/${this.appId}/notifications`, {
        method: 'GET'
      })
    },
    markRead: (notifyId: string) => {
      return this.request<HubResponse<{ success: boolean }>>(`/api/v1/apps/${this.appId}/notifications/${notifyId}/read`, {
        method: 'POST'
      })
    },
    markReadAll: () => {
      return this.request<HubResponse<{ success: boolean }>>(`/api/v1/apps/${this.appId}/notifications/read-all`, {
        method: 'POST'
      })
    },
    delete: (ids: string | string[]) => {
      const idParam = Array.isArray(ids) ? ids.join(',') : ids
      return this.request<HubResponse<{ success: boolean }>>(`/api/v1/apps/${this.appId}/notifications?id=${idParam}`, {
        method: 'DELETE'
      })
    },
    subscribePush: (subscription: { endpoint: string, keys?: { p256dh: string, auth: string }, deviceType?: string }) => {
      return this.request<HubResponse<{ success: boolean }>>(`/api/v1/apps/${this.appId}/notifications/subscribe`, {
        method: 'POST',
        body: subscription as any
      })
    },
    send: (payload: { title: string, body: string, userId?: string, url?: string, icon?: string }) => {
      return this.request<HubResponse<{ success: boolean }>>(`/api/v1/apps/${this.appId}/notifications/send`, {
        method: 'POST',
        body: payload as any
      })
    }
  }

  // ==========================================
  // MODULE: Users (Manage app users)
  // ==========================================
  public readonly users = {
    list: () => {
      return this.request<HubResponse<HubUser[]>>(`/api/v1/apps/${this.appId}/users`, {
        method: 'GET'
      })
    },
    create: (user: Partial<HubUser>) => {
      return this.request<HubResponse<HubUser>>(`/api/v1/apps/${this.appId}/users`, {
        method: 'POST',
        body: user as any
      })
    },
    update: (id: string, user: Partial<HubUser>) => {
      return this.request<HubResponse<HubUser>>(`/api/v1/apps/${this.appId}/users/${id}`, {
        method: 'PUT',
        body: user as any
      })
    },
    delete: (ids: string | string[]) => {
      const idParam = Array.isArray(ids) ? ids.join(',') : ids
      return this.request<HubResponse<{ success: boolean }>>(`/api/v1/apps/${this.appId}/users?id=${idParam}`, {
        method: 'DELETE'
      })
    }
  }

  // ==========================================
  // MODULE: RBAC & Routes (Manage app permissions)
  // ==========================================
  public readonly roles = {
    list: () => {
      return this.request<HubResponse<HubRole[]>>(`/api/v1/apps/${this.appId}/roles`, {
        method: 'GET'
      })
    },
    create: (role: Partial<HubRole>) => {
      return this.request<HubResponse<HubRole>>(`/api/v1/apps/${this.appId}/roles`, {
        method: 'POST',
        body: role as any
      })
    },
    update: (role: Partial<HubRole>) => {
      return this.request<HubResponse<HubRole>>(`/api/v1/apps/${this.appId}/roles`, {
        method: 'PUT',
        body: role as any
      })
    },
    delete: (ids: string | string[]) => {
      const idParam = Array.isArray(ids) ? ids.join(',') : ids
      return this.request<HubResponse<{ success: boolean }>>(`/api/v1/apps/${this.appId}/roles?id=${idParam}`, {
        method: 'DELETE'
      })
    }
  }

  public readonly routes = {
    list: () => {
      return this.request<HubResponse<HubSystemRoute[]>>(`/api/v1/apps/${this.appId}/routes`, {
        method: 'GET'
      })
    },
    create: (route: Partial<HubSystemRoute>) => {
      return this.request<HubResponse<HubSystemRoute>>(`/api/v1/apps/${this.appId}/routes`, {
        method: 'POST',
        body: route as any
      })
    },
    update: (route: Partial<HubSystemRoute>) => {
      return this.request<HubResponse<HubSystemRoute>>(`/api/v1/apps/${this.appId}/routes`, {
        method: 'PUT',
        body: route as any
      })
    },
    delete: (ids: string | string[]) => {
      const idParam = Array.isArray(ids) ? ids.join(',') : ids
      return this.request<HubResponse<{ success: boolean }>>(`/api/v1/apps/${this.appId}/routes?id=${idParam}`, {
        method: 'DELETE'
      })
    }
  }

  // ==========================================
  // MODULE: Logs (Dedicated MongoDB Audit Logs)
  // ==========================================
  public readonly logs = {
    list: (params?: { limit?: number, cursor?: number }) => {
      return this.request<HubResponse<HubAuditLog[]>>(`/api/v1/apps/${this.appId}/logs`, {
        method: 'GET',
        params
      })
    }
  }

  public readonly auditLogs = this.logs
}

export function createHubClient(options: HubClientOptions): HubClient {
  return new HubClient(options)
}
