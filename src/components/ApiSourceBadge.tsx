/**
 * Dev-only marker showing that the running app is reading a REMOTE backend.
 *
 * `npm run dev` and `npm run dev:live` look identical in the browser — same
 * localhost:5173, same source — but one is showing your local database and the
 * other is showing live production content. Mistaking the second for the first
 * is how you conclude a bug is fixed, or that data is missing, on the strength
 * of the wrong dataset. This badge makes the difference impossible to miss.
 */

// Shared with the traffic beacon, which suppresses itself on the same test —
// see config/apiSource.ts for why the two must agree.
import { API_URL, isRemoteBackend } from "../config/apiSource.js"

export const ApiSourceBadge = () => {
	// import.meta.env.DEV is false in any production build, so this guard is a
	// compile-time constant there and the whole component is dropped by dead-code
	// elimination. It cannot render on the deployed site even by accident.
	if (!import.meta.env.DEV || !isRemoteBackend) return null

	return (
		<div
			// Bottom-LEFT: Sonner's <Toaster> owns bottom-right.
			// pointer-events-none so it can never swallow a click on the UI beneath.
			className="fixed bottom-3 left-3 z-[9999] pointer-events-none select-none
			           rounded-md border border-amber-500/60 bg-amber-500/15
			           px-2.5 py-1 text-xs font-semibold tracking-wide
			           text-amber-700 dark:text-amber-300 backdrop-blur-sm"
			title={`Reading ${API_URL} — production data, read-only (sign-in and saving are unavailable)`}
		>
			LIVE DATA · read-only
		</div>
	)
}
