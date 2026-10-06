import { useEffect } from "react"
import { toast } from "sonner"
import { startUpdateWatch } from "../services/updateWatch.js"

/**
 * Tells a long-lived tab that a newer build of the site is live.
 *
 * Mounted once, in App.tsx, so every page is covered. Everything happens inside
 * the effect: nothing here runs during prerendering, which never has a window.
 * The toast is persistent and carries the only action that resolves it, a
 * refresh, which is the person's call to make (see services/updateWatch.ts for
 * why it is never automatic).
 */
export function useUpdateNotifier(): void {
	useEffect(
		() =>
			startUpdateWatch({
				onUpdate: () => {
					toast.info("A new version of the site is live", {
						// Fixed id: if two watchers overlap (StrictMode in development),
						// Sonner shows one toast rather than a stack.
						id: "site-update",
						description: "Refresh to pick it up. Anything you have changed is already saved.",
						duration: Infinity,
						action: {
							label: "Refresh",
							onClick: () => window.location.reload(),
						},
					})
				},
			}),
		[],
	)
}
