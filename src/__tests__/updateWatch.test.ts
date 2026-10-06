import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchLiveBuildId, startUpdateWatch, VERSION_PATH } from "../services/updateWatch.js"

const jsonResponse = (body: unknown, ok = true) =>
	({
		ok,
		json: async () => body,
	}) as unknown as Response

/** A fetch that answers with the given build id, or whatever response is handed in. */
const fetchReturning = (buildOrResponse: string | Response) =>
	vi.fn(async () =>
		typeof buildOrResponse === "string" ? jsonResponse({ build: buildOrResponse }) : buildOrResponse,
	) as unknown as typeof fetch

const setVisibility = (state: DocumentVisibilityState) => {
	Object.defineProperty(document, "visibilityState", { value: state, configurable: true })
	document.dispatchEvent(new Event("visibilitychange"))
}

/** Let the awaited fetch inside a check settle without advancing the clock. */
const flush = () => vi.advanceTimersByTimeAsync(0)

describe("fetchLiveBuildId", () => {
	it("reads the build id and cache-busts the request", async () => {
		const fetchImpl = fetchReturning("abc123")
		await expect(fetchLiveBuildId(fetchImpl)).resolves.toBe("abc123")
		const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
			string,
			RequestInit,
		]
		expect(url.startsWith(`${VERSION_PATH}?t=`)).toBe(true)
		expect(init.cache).toBe("no-store")
	})

	it("returns null for anything that is not a version file", async () => {
		// The SPA catch-all answers a missing file with HTML and a 200.
		const html = { ok: true, json: async () => { throw new SyntaxError("not json") } } as unknown as Response
		await expect(fetchLiveBuildId(fetchReturning(html))).resolves.toBeNull()
		await expect(fetchLiveBuildId(fetchReturning(jsonResponse({ build: "" })))).resolves.toBeNull()
		await expect(fetchLiveBuildId(fetchReturning(jsonResponse({ build: 42 })))).resolves.toBeNull()
		await expect(fetchLiveBuildId(fetchReturning(jsonResponse(null)))).resolves.toBeNull()
		await expect(fetchLiveBuildId(fetchReturning(jsonResponse({}, false)))).resolves.toBeNull()
		const failing = vi.fn(async () => { throw new TypeError("offline") }) as unknown as typeof fetch
		await expect(fetchLiveBuildId(failing)).resolves.toBeNull()
	})
})

describe("startUpdateWatch", () => {
	let stop: (() => void) | undefined

	beforeEach(() => {
		vi.useFakeTimers()
		setVisibility("visible")
	})
	afterEach(() => {
		stop?.()
		stop = undefined
		vi.useRealTimers()
	})

	it("does nothing on mount and stays quiet while the live build matches", async () => {
		const fetchImpl = fetchReturning("same")
		const onUpdate = vi.fn()
		stop = startUpdateWatch({ currentBuild: "same", onUpdate, intervalMs: 1000, fetchImpl })

		expect(fetchImpl).not.toHaveBeenCalled()
		await vi.advanceTimersByTimeAsync(3000)
		expect(fetchImpl).toHaveBeenCalledTimes(3)
		expect(onUpdate).not.toHaveBeenCalled()
	})

	it("notifies once when a newer build is live, then stops polling", async () => {
		const fetchImpl = fetchReturning("newer")
		const onUpdate = vi.fn()
		stop = startUpdateWatch({ currentBuild: "older", onUpdate, intervalMs: 1000, fetchImpl })

		await vi.advanceTimersByTimeAsync(1000)
		expect(onUpdate).toHaveBeenCalledTimes(1)
		expect(onUpdate).toHaveBeenCalledWith("newer")

		await vi.advanceTimersByTimeAsync(5000)
		setVisibility("hidden")
		setVisibility("visible")
		await flush()
		expect(fetchImpl).toHaveBeenCalledTimes(1)
		expect(onUpdate).toHaveBeenCalledTimes(1)
	})

	it("checks when a hidden tab comes back, and skips ticks while hidden", async () => {
		const fetchImpl = fetchReturning("newer")
		const onUpdate = vi.fn()
		stop = startUpdateWatch({ currentBuild: "older", onUpdate, intervalMs: 1000, fetchImpl })

		setVisibility("hidden")
		await vi.advanceTimersByTimeAsync(3000)
		expect(fetchImpl).not.toHaveBeenCalled()

		setVisibility("visible")
		await flush()
		expect(fetchImpl).toHaveBeenCalledTimes(1)
		expect(onUpdate).toHaveBeenCalledWith("newer")
	})

	it("ignores a bad answer rather than reporting an update", async () => {
		const html = { ok: true, json: async () => { throw new SyntaxError("not json") } } as unknown as Response
		const onUpdate = vi.fn()
		stop = startUpdateWatch({ currentBuild: "older", onUpdate, intervalMs: 1000, fetchImpl: fetchReturning(html) })

		await vi.advanceTimersByTimeAsync(2000)
		expect(onUpdate).not.toHaveBeenCalled()
	})

	it("never reports after stop, even if a request was in flight", async () => {
		let resolveFetch: (r: Response) => void = () => {}
		const fetchImpl = vi.fn(
			() => new Promise<Response>((resolve) => { resolveFetch = resolve }),
		) as unknown as typeof fetch
		const onUpdate = vi.fn()
		const stopNow = startUpdateWatch({ currentBuild: "older", onUpdate, intervalMs: 1000, fetchImpl })

		await vi.advanceTimersByTimeAsync(1000)
		expect(fetchImpl).toHaveBeenCalledTimes(1)
		stopNow()
		resolveFetch(jsonResponse({ build: "newer" }))
		await flush()
		expect(onUpdate).not.toHaveBeenCalled()

		await vi.advanceTimersByTimeAsync(3000)
		expect(fetchImpl).toHaveBeenCalledTimes(1)
	})

	it("defaults the current build to the compiled-in id", async () => {
		const fetchImpl = fetchReturning(__BUILD_ID__)
		const onUpdate = vi.fn()
		stop = startUpdateWatch({ onUpdate, intervalMs: 1000, fetchImpl })
		await vi.advanceTimersByTimeAsync(1000)
		expect(onUpdate).not.toHaveBeenCalled()
	})
})
