/**
 * API fetch call for the public Patreon supporters list.
 *
 * Public reference data like the changelog — no auth header. Same convention
 * as changelogFetchCalls.ts: the caller does the `.ok` check and `.json()`.
 */

const API_URL = import.meta.env.VITE_API_URL

/** GET /supporters — tiers, publishable supporters, and the anonymous count. */
export function supportersFetch(signal?: AbortSignal): Promise<Response> {
	return fetch(`${API_URL}/supporters`, {
		method: "GET",
		headers: { "Content-Type": "application/json" },
		signal,
	})
}
