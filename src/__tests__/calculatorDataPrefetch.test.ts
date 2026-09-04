import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Prefetching /calculator-data.
 *
 * The home page starts this request while the visitor is still reading, so the
 * calculator has its payload by the time they click through. Two of the guards
 * here are correctness rather than speed:
 *
 *   - the auth-token check, which stops a guest response (an EMPTY PLAN) being
 *     handed to someone who signed in after the prefetch went out
 *   - the clone, because a Response body can only be read once and the provider
 *     legitimately consumes this twice (StrictMode in dev, and the stale-token
 *     retry after a 401)
 */

import {
	initialCalculatorDataFetch,
	prefetchCalculatorData,
	resetCalculatorDataPrefetch,
} from '../services/calculatorFetchCalls'

let fetchMock: ReturnType<typeof vi.fn>

/** A distinct body per call, so tests can tell responses apart. */
function makeResponse(marker: string): Response {
	return new Response(JSON.stringify({ marker }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	})
}

beforeEach(() => {
	localStorage.clear()
	resetCalculatorDataPrefetch()
	let n = 0
	fetchMock = vi.fn(() => {
		n += 1
		return Promise.resolve(makeResponse(`call-${n}`))
	})
	vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
	vi.unstubAllGlobals()
	vi.useRealTimers()
	resetCalculatorDataPrefetch()
})

describe('prefetchCalculatorData', () => {
	it('is reused by the provider instead of fetching again', async () => {
		prefetchCalculatorData()
		expect(fetchMock).toHaveBeenCalledTimes(1)

		const res = await initialCalculatorDataFetch()
		expect(fetchMock).toHaveBeenCalledTimes(1)
		await expect(res.json()).resolves.toEqual({ marker: 'call-1' })
	})

	it('does not stack duplicate requests', async () => {
		prefetchCalculatorData()
		prefetchCalculatorData()
		prefetchCalculatorData()
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	it('can be consumed twice, each with a readable body', async () => {
		// StrictMode double-invokes the provider's mount effect in development,
		// so the same prefetch really is read more than once.
		prefetchCalculatorData()
		const first = await initialCalculatorDataFetch()
		const second = await initialCalculatorDataFetch()

		await expect(first.json()).resolves.toEqual({ marker: 'call-1' })
		await expect(second.json()).resolves.toEqual({ marker: 'call-1' })
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	it('falls through to a normal fetch when nothing was prefetched', async () => {
		const res = await initialCalculatorDataFetch()
		expect(fetchMock).toHaveBeenCalledTimes(1)
		await expect(res.json()).resolves.toEqual({ marker: 'call-1' })
	})
})

describe('the auth-token guard', () => {
	it('discards a guest prefetch once the user has signed in', async () => {
		// The real sequence: browse as a guest (prefetch says "no saved plan"),
		// sign in, land on /app. Reusing that response would show a signed-in
		// user an empty plan and look like their saved banners had vanished.
		prefetchCalculatorData()
		expect(fetchMock).toHaveBeenCalledTimes(1)

		localStorage.setItem('authToken', 'a-real-token')

		const res = await initialCalculatorDataFetch()
		expect(fetchMock).toHaveBeenCalledTimes(2)
		await expect(res.json()).resolves.toEqual({ marker: 'call-2' })
	})

	it('discards a signed-in prefetch after signing out', async () => {
		localStorage.setItem('authToken', 'a-real-token')
		prefetchCalculatorData()

		localStorage.removeItem('authToken')

		await initialCalculatorDataFetch()
		expect(fetchMock).toHaveBeenCalledTimes(2)
	})

	it('discards a prefetch made for a different account', async () => {
		localStorage.setItem('authToken', 'token-one')
		prefetchCalculatorData()

		localStorage.setItem('authToken', 'token-two')

		await initialCalculatorDataFetch()
		expect(fetchMock).toHaveBeenCalledTimes(2)
	})

	it('re-prefetches rather than reusing one from a different token', () => {
		prefetchCalculatorData()
		localStorage.setItem('authToken', 'a-real-token')
		prefetchCalculatorData()
		expect(fetchMock).toHaveBeenCalledTimes(2)
	})
})

describe('the freshness window', () => {
	it('reuses a recent prefetch', async () => {
		vi.useFakeTimers()
		prefetchCalculatorData()
		vi.advanceTimersByTime(60_000)

		await initialCalculatorDataFetch()
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	it('discards one older than five minutes', async () => {
		// Someone who leaves the home page open and comes back much later should
		// get current data, not the catalogue as it was when the tab opened.
		vi.useFakeTimers()
		prefetchCalculatorData()
		vi.advanceTimersByTime(5 * 60_000 + 1)

		await initialCalculatorDataFetch()
		expect(fetchMock).toHaveBeenCalledTimes(2)
	})
})

describe('a failed prefetch', () => {
	it('does not poison the provider, which fetches normally', async () => {
		vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
		prefetchCalculatorData()
		// Let the rejection settle so the record clears itself.
		await Promise.resolve()
		await Promise.resolve()

		const ok = vi.fn(() => Promise.resolve(makeResponse('recovered')))
		vi.stubGlobal('fetch', ok)

		const res = await initialCalculatorDataFetch()
		expect(ok).toHaveBeenCalledTimes(1)
		await expect(res.json()).resolves.toEqual({ marker: 'recovered' })
	})
})
