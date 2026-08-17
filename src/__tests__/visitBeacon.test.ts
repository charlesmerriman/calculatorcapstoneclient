import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The traffic beacon's guards.
 *
 * The dev:live suppression is the one that matters most: `npm run dev` and
 * `npm run dev:live` are indistinguishable from inside the app, but the second
 * is pointed at the PRODUCTION API. If that guard regresses, every local dev
 * session silently writes real visits into production's counters — a failure
 * nobody would notice until the numbers were already wrong.
 */

// Hoisted so vi.mock (which is lifted above imports) can close over it, while
// tests stay free to flip the values per case.
const apiSource = vi.hoisted(() => ({
  API_URL: 'http://localhost:8000',
  isRemoteBackend: false,
}))

vi.mock('../config/apiSource.js', () => ({
  get API_URL() {
    return apiSource.API_URL
  },
  get isRemoteBackend() {
    return apiSource.isRemoteBackend
  },
}))

/** Fresh module each time — the sentinel lives in sessionStorage, not state. */
async function loadBeacon() {
  return (await import('../services/visitBeacon.js')).recordVisit
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  sessionStorage.clear()
  fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response))
  vi.stubGlobal('fetch', fetchMock)
  // Local backend, production-style build: the ordinary case.
  apiSource.API_URL = 'http://localhost:8000'
  apiSource.isRemoteBackend = false
  vi.stubEnv('DEV', false)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('recordVisit', () => {
  it('posts to /visit', async () => {
    const recordVisit = await loadBeacon()
    recordVisit()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8000/visit')
    expect(options).toMatchObject({ method: 'POST', keepalive: true })
  })

  it('sends no body, so the request cannot provoke a CORS preflight', async () => {
    const recordVisit = await loadBeacon()
    recordVisit()

    const [, options] = fetchMock.mock.calls[0]
    expect(options.body).toBeUndefined()
    expect(options.headers).toBeUndefined()
  })

  it('fires once per session however many times it is called', async () => {
    // StrictMode double-invokes mount effects in development; without the
    // sentinel that alone would double every dev visit.
    const recordVisit = await loadBeacon()
    recordVisit()
    recordVisit()
    recordVisit()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('fires again in a new session', async () => {
    const recordVisit = await loadBeacon()
    recordVisit()
    sessionStorage.clear()
    recordVisit()

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('sends nothing when a dev server points at a remote API', async () => {
    // This is `npm run dev:live`. Writing here would corrupt production.
    vi.stubEnv('DEV', true)
    apiSource.API_URL = 'https://umamusme-calculator-7zdcg.ondigitalocean.app/api'
    apiSource.isRemoteBackend = true

    const recordVisit = await loadBeacon()
    recordVisit()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still fires for a deployed build, which is also "remote"', async () => {
    // The guard must key on DEV *and* remote, not remote alone — production is
    // remote by definition, and gating on that would count nobody at all.
    vi.stubEnv('DEV', false)
    apiSource.isRemoteBackend = true

    const recordVisit = await loadBeacon()
    recordVisit()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('still fires for a dev server on a local backend', async () => {
    vi.stubEnv('DEV', true)
    apiSource.isRemoteBackend = false

    const recordVisit = await loadBeacon()
    recordVisit()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never lets a failed beacon reach the caller', async () => {
    // Privacy extensions block this request routinely. An analytics failure
    // must not surface as an unhandled rejection or a console error.
    fetchMock.mockReturnValue(Promise.reject(new Error('blocked by client')))

    const recordVisit = await loadBeacon()
    expect(() => recordVisit()).not.toThrow()
    await Promise.resolve()
  })

  it('still counts the visit when sessionStorage is unavailable', async () => {
    // Private browsing can make sessionStorage throw on access. Losing the
    // once-per-session guarantee is fine; losing the visitor is not.
    const failing = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('access denied')
    })

    const recordVisit = await loadBeacon()
    recordVisit()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    failing.mockRestore()
  })
})
