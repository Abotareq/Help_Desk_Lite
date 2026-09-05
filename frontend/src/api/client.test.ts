import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiFetch, setUnauthorizedHandler, tokenStore } from './client'

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  })
  fetchMock.mockReset()
  setUnauthorizedHandler(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiFetch', () => {
  it('prefixes /api and returns the parsed body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }))

    await expect(apiFetch('/requests')).resolves.toEqual({ ok: true })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/requests')
  })

  it('sends no Authorization header when there is no token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}))

    await apiFetch('/requests')

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('sends the bearer token once stored', async () => {
    tokenStore.set('abc123')
    fetchMock.mockResolvedValue(jsonResponse(200, {}))

    await apiFetch('/requests')

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer abc123')
  })

  describe('query building', () => {
    it('omits undefined values rather than sending "undefined"', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, {}))

      await apiFetch('/requests', { query: { page: 1, assignee: undefined } })

      expect(fetchMock.mock.calls[0][0]).toBe('/api/requests?page=1')
    })

    it('joins array filters with commas, which the API accepts', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, {}))

      await apiFetch('/requests', { query: { status: ['NEW', 'WAITING'] } })

      expect(fetchMock.mock.calls[0][0]).toBe('/api/requests?status=NEW%2CWAITING')
    })

    it('drops an empty array instead of sending a blank filter', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, {}))

      await apiFetch('/requests', { query: { status: [] } })

      expect(fetchMock.mock.calls[0][0]).toBe('/api/requests')
    })

    it('leaves the path alone when there is no query at all', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, {}))

      await apiFetch('/requests')

      expect(fetchMock.mock.calls[0][0]).toBe('/api/requests')
    })
  })

  describe('errors', () => {
    it('throws an ApiError carrying the code and message', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(403, { error: { code: 'FORBIDDEN', message: 'Only a manager can assign' } }),
      )

      const error = await apiFetch('/requests/1/assign').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' })
      expect((error as ApiError).message).toBe('Only a manager can assign')
    })

    // The details array is what lets a form put each message against the right
    // input instead of dumping one banner at the top.
    it('preserves the field-level validation details', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(400, {
          error: {
            code: 'BAD_REQUEST',
            message: 'Validation failed',
            details: [
              { field: 'title', message: 'Title must be at least 5 characters' },
              { field: 'category', message: 'Category must be one of: IT, HR, FACILITIES, OTHER' },
            ],
          },
        }),
      )

      const error = (await apiFetch('/requests').catch((e: unknown) => e)) as ApiError

      expect(error.fieldError('title')).toBe('Title must be at least 5 characters')
      expect(error.fieldError('category')).toContain('FACILITIES')
      expect(error.fieldError('description')).toBeUndefined()
    })

    it('survives an error body that is not the expected envelope', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('not json')
        },
      } as unknown as Response)

      const error = (await apiFetch('/requests').catch((e: unknown) => e)) as ApiError

      expect(error).toBeInstanceOf(ApiError)
      expect(error.status).toBe(502)
      expect(error.details).toEqual([])
    })

    it('notifies the unauthorized handler on a 401, so any call can drop to sign-in', async () => {
      const onUnauthorized = vi.fn()
      setUnauthorizedHandler(onUnauthorized)
      fetchMock.mockResolvedValue(
        jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } }),
      )

      await apiFetch('/users/me').catch(() => undefined)

      expect(onUnauthorized).toHaveBeenCalledTimes(1)
    })

    it('does not notify it for other failures', async () => {
      const onUnauthorized = vi.fn()
      setUnauthorizedHandler(onUnauthorized)
      fetchMock.mockResolvedValue(jsonResponse(403, { error: { code: 'FORBIDDEN', message: 'No' } }))

      await apiFetch('/users').catch(() => undefined)

      expect(onUnauthorized).not.toHaveBeenCalled()
    })
  })
})

describe('tokenStore', () => {
  it('round-trips a token', () => {
    tokenStore.set('t1')
    expect(tokenStore.get()).toBe('t1')

    tokenStore.clear()
    expect(tokenStore.get()).toBeNull()
  })

  // Private windows and blocked site data throw on access rather than returning
  // null; a missing token is the right answer either way.
  it('treats a throwing localStorage as simply having no token', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('access denied')
      },
      setItem() {
        throw new Error('access denied')
      },
      removeItem() {
        throw new Error('access denied')
      },
    })

    expect(tokenStore.get()).toBeNull()
    expect(() => tokenStore.set('x')).not.toThrow()
    expect(() => tokenStore.clear()).not.toThrow()
  })
})
