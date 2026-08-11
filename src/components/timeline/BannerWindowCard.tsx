import { CalendarDays, ChevronRight, Clock3, Sparkles, Star, Ticket } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import PredictedBadge from "../PredictedBadge"
import { bannerKey } from "../../utils/bannerHelpers"
import type { BannerKey } from "../../utils/bannerHelpers"
import { formatDate } from "../../utils/dateFormat"
import { BannerArtPlaceholder } from "./BannerArtPlaceholder"
import { AnniversaryEventStrip } from "./AnniversaryEventStrip"
import { getCountdownLabel } from "./timelineShared"
import type { BannerWindowGroup } from "./timelineShared"
import type {
	BannerSupport,
	BannerTimelineForViewing,
	BannerUma,
	UserPlannedBanner,
} from "../../types"

/**
 * One timeline card: a date header, then one section per banner opening in that
 * window.
 *
 * Split out of Timeline.tsx when windows became groups. A card that renders N
 * banners instead of exactly one is too much JSX to keep inline in a component
 * that also owns paging, infinite scroll and search.
 *
 * See BannerWindowGroup for why concurrent banners are merged here rather than
 * in the database.
 */

type BannerCardStatus = "available" | "planned" | "staged" | "expired"

/**
 * The fields a featured tile actually renders. Both Uma and SupportCard
 * satisfy this structurally, which is what lets the two panels share one
 * component instead of duplicating forty lines of near-identical JSX.
 */
type FeaturedCard = {
	id: number
	name: string
	image: string
	recommendation: string
}

function getBannerCardStatus(
	hasBanner: boolean,
	expired: boolean,
	planned: boolean,
	staged: boolean
): BannerCardStatus {
	if (!hasBanner || expired) return "expired"
	if (planned) return "planned"
	if (staged) return "staged"
	return "available"
}

function getBannerStatusLabel(status: BannerCardStatus): string {
	if (status === "planned") return "Already on sheet"
	if (status === "staged") return "Already staged"
	if (status === "expired") return "Banner ended"
	return "Add to Planner"
}

function getBannerStatusClasses(status: BannerCardStatus): string {
	if (status === "available") return "border-brand text-brand hover:bg-brand/10"
	if (status === "planned" || status === "staged") return "border-gray-600 text-gray-300"
	return "border-gray-600 text-gray-500"
}

type FeaturePanelProps = {
	icon: LucideIcon
	title: string
	/** Empty when the banner exists but has no cards linked yet. */
	items: FeaturedCard[]
	/** False when this window has no banner of this kind at all. */
	hasBanner: boolean
	emptyText: string
	/** Uma art is portrait and wider; support art is smaller. */
	tileWidthClass: string
	status: BannerCardStatus
	actionIcon: LucideIcon
	onAdd: () => void
}

function FeaturePanel({
	icon: Icon,
	title,
	items,
	hasBanner,
	emptyText,
	tileWidthClass,
	status,
	actionIcon: ActionIcon,
	onAdd,
}: FeaturePanelProps) {
	// PHASE 3 SEAM: this binary rule, and the xl:overflow-hidden clip below, are
	// what currently render only 2 of a revival's 11 umas. Category-aware
	// rendering replaces both with a count-derived density.
	const featureGridClass = items.length === 1 ? "grid-cols-1" : "grid-cols-2"

	return (
		<section className="flex min-w-0 flex-col rounded-xl border border-gray-600 bg-gray-800 px-1.5 py-1.5 shadow-sm xl:min-h-0 xl:[contain:size] xl:overflow-hidden">
			<div className="mb-1.5 flex shrink-0 items-center gap-2 text-sm font-semibold text-brand">
				<Icon className="h-4 w-4" />
				<span>{title}</span>
			</div>
			{hasBanner ? (
				<div className="flex flex-1 flex-col gap-1.5 xl:min-h-0 xl:overflow-hidden">
					<div
						className={`grid grid-rows-1 flex-1 items-center justify-items-center content-center gap-1.5 xl:min-h-0 xl:overflow-hidden ${featureGridClass}`}
					>
						{items.map((item) => (
							<div
								key={item.id}
								className={`flex w-full min-w-0 flex-col overflow-hidden rounded-lg bg-gray-700 text-left shadow-sm ${tileWidthClass}`}
							>
								<div className="relative shrink-0 overflow-hidden bg-gray-700">
									{item.recommendation && (
										<div className="absolute left-2 top-2 z-10 rounded border border-gray-600 bg-gray-700/95 px-2 py-1 text-xs font-semibold text-brand">
											{item.recommendation}
										</div>
									)}
									<img
										src={item.image}
										alt={item.name}
										loading="lazy"
										decoding="async"
										className="block h-auto w-full object-contain"
									/>
								</div>
								<div className="flex h-16 items-center justify-center p-2">
									<div className="line-clamp-2 overflow-hidden break-words text-center text-[0.9375rem] font-semibold leading-tight text-gray-100">
										{item.name}
									</div>
								</div>
							</div>
						))}
					</div>
					{/* Single shared action button — every featured card here belongs to the
					    same banner, so one full-width button drives the add for all of them. */}
					<button
						type="button"
						onClick={onAdd}
						disabled={status !== "available"}
						className={`flex shrink-0 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-xs font-medium leading-tight transition ${getBannerStatusClasses(status)} ${
							status === "available" ? "cursor-pointer" : "cursor-not-allowed"
						}`}
					>
						<ActionIcon className="h-3.5 w-3.5" />
						{getBannerStatusLabel(status)}
						{status === "available" && <ChevronRight className="h-3.5 w-3.5" />}
					</button>
				</div>
			) : (
				<div className="flex min-h-40 w-full flex-1 items-center justify-center rounded-lg border border-gray-600 bg-gray-700 px-4 text-center text-sm text-gray-400">
					{emptyText}
				</div>
			)}
		</section>
	)
}

type BannerSectionProps = {
	banner: BannerTimelineForViewing
	/** True when this card carries more than one banner. */
	isGrouped: boolean
	/** The card header's window, so a section can flag its own if it differs. */
	groupEndDate: string
	today: Date
	plannedBannerKeys: Set<BannerKey>
	stagedBanners: UserPlannedBanner[]
	onAddBanner: (banner: BannerUma | BannerSupport, type: "Uma" | "Support") => void
}

function BannerSection({
	banner,
	isGrouped,
	groupEndDate,
	today,
	plannedBannerKeys,
	stagedBanners,
	onAddBanner,
}: BannerSectionProps) {
	const umaBanner = banner.banner_umas[0]
	const supportBanner = banner.banner_supports[0]

	const umaExpired = !umaBanner || new Date(banner.end_date) <= today
	const supportExpired = !supportBanner || new Date(banner.end_date) <= today
	const umaPlanned = umaBanner ? plannedBannerKeys.has(bannerKey("Uma", umaBanner.id)) : false
	const supportPlanned = supportBanner
		? plannedBannerKeys.has(bannerKey("Support", supportBanner.id))
		: false
	const umaStaged = umaBanner
		? stagedBanners.some((b) => b.banner_uma?.id === umaBanner.id)
		: false
	const supportStaged = supportBanner
		? stagedBanners.some((b) => b.banner_support?.id === supportBanner.id)
		: false

	// A grouped section states its own end date only when it actually differs
	// from the header's — otherwise it would just repeat the header. Real case:
	// the 2025 Golden Week revival runs nine days longer than the standard
	// banner sharing its start.
	const hasOwnWindow = isGrouped && banner.end_date !== groupEndDate

	return (
		<div className="flex flex-col gap-2">
			{hasOwnWindow && (
				<div className="text-sm font-medium text-gray-400">
					This banner ends {formatDate(banner.end_date)}
				</div>
			)}
			<div className="grid gap-4 xl:grid-cols-[minmax(360px,1.28fr)_minmax(260px,0.88fr)_minmax(260px,0.78fr)] xl:items-stretch">
				<div className="min-w-0">
					{banner.image ? (
						<img
							src={banner.image}
							alt={banner.name}
							loading="lazy"
							decoding="async"
							className="h-auto w-full rounded-xl border border-gray-600 shadow-md"
						/>
					) : (
						<BannerArtPlaceholder />
					)}
				</div>

				<FeaturePanel
					icon={Sparkles}
					title="Featured Umamusume"
					items={umaBanner?.umas ?? []}
					hasBanner={!!umaBanner}
					emptyText="No Umamusume banner in this window."
					tileWidthClass="max-w-[10rem] 2xl:max-w-[13.5rem]"
					status={getBannerCardStatus(!!umaBanner, umaExpired, umaPlanned, umaStaged)}
					actionIcon={Star}
					onAdd={() => umaBanner && onAddBanner(umaBanner, "Uma")}
				/>

				<FeaturePanel
					icon={Ticket}
					title="Featured Support Cards"
					items={supportBanner?.support_cards ?? []}
					hasBanner={!!supportBanner}
					emptyText="No support banner in this window."
					tileWidthClass="max-w-[7.75rem] 2xl:max-w-[9.5rem]"
					status={getBannerCardStatus(
						!!supportBanner,
						supportExpired,
						supportPlanned,
						supportStaged
					)}
					actionIcon={Ticket}
					onAdd={() => supportBanner && onAddBanner(supportBanner, "Support")}
				/>
			</div>
		</div>
	)
}

type BannerWindowCardProps = {
	group: BannerWindowGroup
	today: Date
	plannedBannerKeys: Set<BannerKey>
	stagedBanners: UserPlannedBanner[]
	onAddBanner: (banner: BannerUma | BannerSupport, type: "Uma" | "Support") => void
}

export function BannerWindowCard({
	group,
	today,
	plannedBannerKeys,
	stagedBanners,
	onAddBanner,
}: BannerWindowCardProps) {
	const countdownLabel = getCountdownLabel(group.start_date, group.end_date, today)
	// A campaign strip sits flush above the card, so the card's own top corners
	// have to square off or the two render as separate boxes with a seam between.
	const attachedEvent = group.anniversary_event
	const isGrouped = group.banners.length > 1

	return (
		<div className="my-3 w-full px-2">
			{attachedEvent && <AnniversaryEventStrip event={attachedEvent} />}
			<div
				className={`card-panel w-full overflow-hidden p-2 sm:p-3 ${
					attachedEvent ? "rounded-b-xl rounded-t-none" : "rounded-xl"
				}`}
			>
				<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex min-w-0 items-center gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-600 bg-gray-700 text-brand">
							<CalendarDays className="h-5 w-5" />
						</div>
						<div className="min-w-0 text-xl font-semibold text-gray-100 sm:text-2xl">
							<div className="flex flex-wrap items-center gap-2">
								<span>
									{formatDate(group.start_date)} through {formatDate(group.end_date)}
								</span>
								{group.is_predicted && <PredictedBadge />}
							</div>
						</div>
					</div>
					<div className="flex w-fit items-center gap-2 rounded-full border border-gray-600 bg-gray-700 px-3 py-1 text-sm font-semibold text-gray-100">
						<span>{countdownLabel}</span>
						<Clock3 className="h-4 w-4 text-brand" />
					</div>
				</div>

				{/* Sections are separated by a rule rather than nested panels: two
				    banners in one window are peers, and boxing each would add a
				    frame inside a frame. */}
				<div className="flex flex-col gap-4">
					{group.banners.map((banner, index) => (
						<div
							key={banner.id}
							className={index > 0 ? "border-t border-gray-700/70 pt-4" : undefined}
						>
							<BannerSection
								banner={banner}
								isGrouped={isGrouped}
								groupEndDate={group.end_date}
								today={today}
								plannedBannerKeys={plannedBannerKeys}
								stagedBanners={stagedBanners}
								onAddBanner={onAddBanner}
							/>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

export default BannerWindowCard
