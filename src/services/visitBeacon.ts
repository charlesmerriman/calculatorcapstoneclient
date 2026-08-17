/**
 * Traffic beacon — tells the backend that someone loaded the site.
 *
 * The frontend is a separate static site on DigitalOcean's CDN, so Django never
 * sees a page load and cannot count one from its own request log. This is the
 * only way the admin analytics dashboard learns that a visit happened at all,
 * and the only signal there that includes guests — who never otherwise send
 * anything to the server.
 *
 * Unlike every other call in services/, this one is fire-and-forget: nothing in
 * the UI depends on it, so it neither returns data nor surfaces failures.
 */

import { API_URL, isRemoteBackend } from "../config/apiSource.js"

// sessionStorage, not localStorage: the counter is meant to measure sessions, so
// the sentinel must expire when the tab closes. localStorage would mean a
// returning visitor is never counted again, and the numbers would flatline.
const SESSION_KEY = "visit-beacon-sent"

/**
 * Record this session's visit, at most once.
 *
 * Safe to call from anywhere and as often as you like — React's StrictMode
 * double-invokes mount effects in development, and this is what stops that
 * registering as two visits.
 */
export function recordVisit(): void {
	// `npm run dev` and `npm run dev:live` are indistinguishable from inside the
	// app, but the second is pointed at the PRODUCTION API — without this guard
	// every local dev session would write a real visit into prod's counters and
	// quietly corrupt the traffic numbers. import.meta.env.DEV is false in any
	// production build, so this costs the deployed site nothing.
	if (import.meta.env.DEV && isRemoteBackend) return

	try {
		if (sessionStorage.getItem(SESSION_KEY)) return
		// Set BEFORE the request, not in a .then(): two effects firing in the same
		// tick would both see an empty sentinel and both send. A dropped beacon is
		// a better failure than a double count.
		sessionStorage.setItem(SESSION_KEY, "1")
	} catch {
		// Private browsing and hardened privacy settings can make sessionStorage
		// throw on access. Counting the visit still works — we just lose the
		// once-per-session guarantee for that visitor, which the backend's own
		// per-day deduplication absorbs.
	}

	void fetch(`${API_URL}/visit`, {
		method: "POST",
		// Lets the request outlive the page if the visitor navigates away
		// immediately, which is exactly the visit we would otherwise miss.
		keepalive: true,
		// Deliberately no Content-Type and no body: the endpoint reads neither,
		// and a bare POST avoids provoking a CORS preflight.
	}).catch(() => {
		// Swallowed on purpose. The beacon is blocked by plenty of privacy
		// extensions, and an analytics failure must never reach the visitor as a
		// console error or a toast.
	})
}
