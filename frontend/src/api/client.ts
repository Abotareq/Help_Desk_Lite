/**
 * The one place that talks HTTP. Everything else calls a typed function.
 *
 * Requests go to a relative /api path: Vite proxies it in development and the
 * client is served from the same origin in production, so no API host is baked
 * into the bundle.
 */

export interface FieldError {
  field: string
  message: string
}

/**
 * The API's error envelope, preserved rather than flattened to a string — the
 * `details` array is what lets a form put each message against the right input.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: FieldError[] = [],
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** Message for one field, if the API blamed it. */
  fieldError(field: string): string | undefined {
    return this.details.find((d) => d.field === field)?.message
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }
}

const TOKEN_KEY = 'helpdesk.token'

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      // Private windows and blocked site data throw on access rather than
      // returning null; a missing token is the correct answer either way.
      return null
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* Session-only is a worse experience, not a broken one. */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* Nothing to do. */
    }
  },
}

/** Called when the API rejects our token, so the app can drop to sign-in. */
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | string[] | undefined>
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  if (!query) return path

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','))
    } else {
      params.set(key, String(value))
    }
  }

  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = options
  const token = tokenStore.get()

  const response = await fetch(buildUrl(`/api${path}`, query), {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (response.status === 204) return undefined as T

  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const envelope = (payload as { error?: { code?: string; message?: string; details?: FieldError[] } })
      ?.error

    const error = new ApiError(
      response.status,
      envelope?.code ?? 'UNKNOWN',
      envelope?.message ?? `Request failed with ${response.status}`,
      envelope?.details ?? [],
    )

    // An expired or revoked token should drop us to sign-in wherever it happens,
    // rather than every caller having to remember to check.
    if (error.isUnauthorized) onUnauthorized?.()

    throw error
  }

  return payload as T
}
