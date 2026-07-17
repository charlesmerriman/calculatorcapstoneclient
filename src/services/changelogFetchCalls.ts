/**
 * API fetch call for the public changelog.
 *
 * The changelog is public reference data — no auth header is sent (unlike the
 * calculator endpoints). The caller does the `.ok` check and `.json()` parse,
 * matching the convention in calculatorFetchCalls.ts.
 */

const API_URL = import.meta.env.VITE_API_URL

/** GET /changelog — returns entries newest-first with nested changes. */
export function changelogFetch(signal?: AbortSignal): Promise<Response> {
	return fetch(`${API_URL}/changelog`, {
		method: "GET",
		headers: { "Content-Type": "application/json" },
		signal,
	})
}
