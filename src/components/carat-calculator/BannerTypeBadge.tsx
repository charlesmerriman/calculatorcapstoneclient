import type { BannerRowType } from "../../utils/bannerHelpers"

/**
 * The glyph on a row's type badge. Exported separately from the badge because
 * the mobile card draws its own surround and wants only the icon.
 *
 * Extracted because the desktop table row and the mobile card drew the same two
 * SVGs from two hand-copied ternaries. Adding a third banner kind meant finding
 * both, and a missed one silently rendered another kind's icon — the same
 * failure mode the FK sniffs had. One component, one place to extend.
 *
 * `className` carries the size and colour so each caller keeps its own scale
 * (w-5 in both today, but the desktop badge and the card sit in different type
 * scales and have diverged before).
 */
export const BannerTypeIcon = ({
	type,
	className,
}: {
	type: BannerRowType
	className?: string
}) => {
	if (type === "Uma") {
		// A horseshoe.
		return (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
				<path d="M5 3v9a7 7 0 0 0 14 0V3" />
				<line x1="5" y1="3" x2="5" y2="6" />
				<line x1="19" y1="3" x2="19" y2="6" />
			</svg>
		)
	}

	if (type === "Support") {
		// Two figures — a support pair.
		return (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
				<circle cx="9" cy="7" r="3" />
				<circle cx="15" cy="7" r="3" />
				<path d="M3 21v-1a6 6 0 0 1 9.5-4.9" />
				<path d="M12 21v-1a6 6 0 0 1 9-5.4" />
			</svg>
		)
	}

	// Step Up: an ascending staircase, for the five-step cost ladder. Provisional
	// alongside the rest of the step-up visual treatment — see
	// step-up-banners-plan.md.
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
			<path d="M3 20h5v-5h5v-5h5V5" />
		</svg>
	)
}


/** Modifier class per kind. The StepUp rule arrives with the step-up UI phase;
 *  until then no row can be of that kind. See step-up-banners-plan.md. */
const TAB_CLASS: Record<BannerRowType, string> = {
	Uma: "banner-type-tab--uma",
	Support: "banner-type-tab--support",
	StepUp: "banner-type-tab--step-up",
}

const LABEL: Record<BannerRowType, string> = {
	Uma: "UMA",
	Support: "SUPPORT",
	StepUp: "STEP UP",
}

/**
 * The square type badge at the left of a desktop table row.
 *
 * Shared by BannerRow and StagedBannerRow, which previously carried
 * byte-identical copies of this markup — modifier class, label and a pair of
 * inline SVGs, each behind its own `=== "Uma"` ternary. Six places to widen for
 * a third kind, any of which fails silently by rendering the wrong kind.
 *
 * Width comes from .banner-grid's first track; this is a table cell, not a
 * free-standing element.
 */
export const BannerTypeBadge = ({ type }: { type: BannerRowType }) => (
	<div className={`banner-type-tab ${TAB_CLASS[type]}`}>
		<span className="text-xs font-bold tracking-wide">{LABEL[type]}</span>
		<BannerTypeIcon type={type} className="w-5 h-5 opacity-90" />
	</div>
)
