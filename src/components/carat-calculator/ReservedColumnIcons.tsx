/**
 * The Reserved column's label, as icons instead of text: a selector ticket and
 * an SSR crystal — exactly the two resources allocateReservedCopies can spend.
 *
 * Shared by the desktop table headers in CaratCalculator and the mobile card's
 * cell label in MobileBannerCard, so the two can't drift and the asset paths
 * live in one place. Returns a fragment: each call site owns its own wrapper,
 * because a grid header cell and a stacked card label want different boxes.
 *
 * Images are served from public/ by root-absolute path with no import, the same
 * convention IncomeForm uses for every other game resource.
 */
export const ReservedColumnIcons = ({ size = "w-5 h-5" }: { size?: string }) => (
	<>
		{/* Not optional. With the text label gone, this span and the two alts are
		    the column's only accessible name — a title on the wrapper is not
		    reliably announced by screen readers. */}
		<span className="sr-only">Reserved</span>
		<img
			src="/item_icon_00131.png"
			alt="Selector ticket"
			className={`${size} object-contain`}
		/>
		<img
			src="/item_icon_00144.png"
			alt="SSR crystal"
			className={`${size} object-contain`}
		/>
	</>
)

/** Shared by every call site so the wording of the column's tooltip stays one string. */
export const RESERVED_COLUMN_TITLE =
	"Copies you'll take with a selector ticket or an SSR crystal instead of pulling"
