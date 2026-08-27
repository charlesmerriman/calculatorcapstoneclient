import { useEffect, useState } from "react"
import { ArrowUpRight, Heart } from "lucide-react"
import { supportersFetch } from "../../services/supportersFetchCalls"
import type { SupportersResponse } from "../../types"

const PATREON_URL = "https://www.patreon.com/cw/UmaCaratCalculator"

/**
 * Emphasis by tier, strongest first. Indexed by a tier's POSITION in the
 * ordered tier list rather than by its name or its id, so the client can
 * rename, add or reorder tiers in the admin without touching this file — the
 * top tier is always whatever they put first.
 *
 * Tiers past the end of this array fall back to BASE_TIER_STYLE. That is the
 * common case, not an edge case: most supporters sit on the entry tier.
 */
const TIER_STYLES = [
	"font-bold text-brand",
	"font-semibold text-gray-100",
]
const BASE_TIER_STYLE = "text-gray-300"

/**
 * Public thank-you list for Patreon supporters.
 *
 * Renders nothing at all when there is nobody to thank or the fetch fails.
 * A thank-you list is not worth an error state or a skeleton — a visitor who
 * never sees it has lost nothing, whereas "Couldn't load supporters" on the
 * home page is pure noise.
 *
 * Names come from the API rather than the bundle so the client can update the
 * list from the admin panel when the monthly Patreon export changes, with no
 * frontend deploy. See backend/calculatorapi/admin_patreon_import.py.
 */
export const SupportersSection = () => {
	const [data, setData] = useState<SupportersResponse | null>(null)

	useEffect(() => {
		const controller = new AbortController()
		supportersFetch(controller.signal)
			.then((res) => (res.ok ? res.json() : null))
			.then((body: SupportersResponse | null) => {
				if (body) setData(body)
			})
			.catch(() => undefined)
		return () => controller.abort()
	}, [])

	const supporters = data?.supporters ?? []
	const anonymousCount = data?.anonymous_count ?? 0

	// Nothing to say yet — before the client has entered anyone, or if the
	// request failed. Hiding the whole section beats an empty heading.
	if (supporters.length === 0 && anonymousCount === 0) return null

	// Position of each tier in the admin's chosen order, keyed by `order` so a
	// supporter's flat `tier_order` can be looked up directly. Built from the
	// tiers actually present on supporters, so an empty tier doesn't consume
	// the top emphasis slot.
	const tierRanks = new Map<number, number>()
	Array.from(new Set(supporters.map((s) => s.tier_order).filter((o): o is number => o !== null)))
		.sort((a, b) => a - b)
		.forEach((order, index) => tierRanks.set(order, index))

	const styleFor = (tierOrder: number | null) => {
		if (tierOrder === null) return BASE_TIER_STYLE
		const rank = tierRanks.get(tierOrder)
		return rank === undefined ? BASE_TIER_STYLE : TIER_STYLES[rank] ?? BASE_TIER_STYLE
	}

	return (
		<section id="supporters" className="mt-10 scroll-mt-20 border-t border-gray-800 pt-8">
			<div className="flex flex-wrap items-baseline justify-between gap-3">
				<h2 className="flex items-center gap-2 text-xl font-bold text-gray-100">
					<Heart className="h-5 w-5 text-brand" aria-hidden="true" />
					Patreon supporters
				</h2>
				<a
					href={PATREON_URL}
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-1 text-sm font-semibold text-brand transition hover:text-brand/75"
				>
					Support the project
					<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
				</a>
			</div>

			<p className="mt-2 max-w-3xl text-gray-400">
				This calculator is free and ad-supported. Thank you to everyone keeping it running.
			</p>

			<div className="mt-5 rounded-xl border border-gray-700 bg-gray-800 p-4 shadow-md">
				{supporters.length > 0 && (
					<ul className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1.5 text-sm leading-relaxed">
						{supporters.map((supporter, index) => (
							<li key={supporter.id} className={styleFor(supporter.tier_order)}>
								{supporter.display_name}
								{/* Separator lives inside the item so it wraps with the name it
								    follows, and is hidden from screen readers — the list
								    semantics already convey the separation. */}
								{index < supporters.length - 1 && (
									<span aria-hidden="true" className="font-normal text-gray-600">,</span>
								)}
							</li>
						))}
					</ul>
				)}

				{anonymousCount > 0 && (
					<p
						className={`text-sm text-gray-500 ${supporters.length > 0 ? "mt-3" : ""}`}
					>
						{supporters.length > 0 ? "… and " : "Thank you to "}
						{anonymousCount} anonymous {anonymousCount === 1 ? "supporter" : "supporters"}.
					</p>
				)}
			</div>
		</section>
	)
}
