/**
 * The desktop table's delete glyph, shared by BannerRow and StagedBannerRow so
 * removing a row looks the same whether or not it is on the sheet yet. The
 * staged row used to show an X here, which read as "close" rather than "delete".
 * (The phone card has its own, lucide's Trash2, in MobileBannerCard.)
 */
export const TrashIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
		<polyline points="3 6 5 6 21 6" />
		<path d="M19 6l-1 14H6L5 6" />
		<path d="M10 11v6" />
		<path d="M14 11v6" />
		<path d="M9 6V4h6v2" />
	</svg>
)
