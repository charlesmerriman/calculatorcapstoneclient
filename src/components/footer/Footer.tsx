import { Link } from "react-router-dom"

/**
 * Compact, reusable site footer shown on every page.
 *
 * Kept slim (shrink-0 + small padding/text) so it works as a thin bottom bar even
 * on the fixed-height, no-scroll app layout (`md:h-dvh md:overflow-hidden`) without
 * eating meaningful space from the calculator.
 *
 * Added per-layout rather than via a global wrapper: each route group sets its own
 * full height, so a single wrapper would double those heights and break the app's
 * no-scroll design. See the plan/CLAUDE.md for the rationale.
 */
export const Footer = () => {
	// Computed at render so the copyright year never goes stale.
	const year = new Date().getFullYear()

	return (
		<footer className="shrink-0 border-t border-gray-700 bg-gray-900 px-4 py-2 text-center text-xs text-gray-500">
			<div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
				<span>© {year} Uma Musume Carat Calculator</span>
				<span aria-hidden="true">·</span>
				<Link to="/privacy-policy" className="text-gray-400 transition hover:text-brand">
					Privacy Policy
				</Link>
				<span aria-hidden="true">·</span>
				<a
					href="mailto:Henryhandsomederby@gmail.com"
					className="text-gray-400 transition hover:text-brand"
				>
					Contact
				</a>
			</div>
			<p className="mt-1 text-gray-600">
				Not affiliated with Cygames or Uma Musume Pretty Derby.
			</p>
		</footer>
	)
}
