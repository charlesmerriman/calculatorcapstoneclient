import type React from "react"
import { Link } from "react-router-dom"
import { Construction, ArrowLeft } from "lucide-react"
import { Navbar } from "../navbar/Navbar"
import { Footer } from "../footer/Footer"

interface UnderConstructionProps {
	/** Page title, e.g. "Changelog". */
	title: string
	/** Optional custom line under the title; falls back to a generic message. */
	blurb?: string
}

/**
 * Reusable placeholder page for features that are planned but not built yet
 * (Changelog / FAQ / Feedback). Kept intentionally minimal so each real page can
 * later replace its thin wrapper with actual content.
 */
export const UnderConstruction: React.FC<UnderConstructionProps> = ({ title, blurb }) => {
	return (
		<div className="flex min-h-dvh flex-col bg-gray-900">
			<Navbar />
			<main className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
				<Construction className="h-12 w-12 text-brand" aria-hidden="true" />
				<h1 className="text-3xl font-bold text-gray-100">{title}</h1>
				<p className="max-w-md text-gray-400">
					{blurb ?? "🚧 This page is under construction — check back soon."}
				</p>
				<Link
					to="/"
					className="mt-2 flex items-center gap-1.5 rounded border border-gray-600 px-3 py-1.5 text-sm text-gray-300 transition hover:border-gray-400 hover:bg-gray-700 hover:text-white"
				>
					<ArrowLeft className="h-4 w-4" aria-hidden="true" />
					Back to home
				</Link>
			</main>
			<Footer />
		</div>
	)
}
