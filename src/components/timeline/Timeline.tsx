import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { differenceInCalendarDays } from "date-fns"
import {
	BookOpen,
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	Clock3,
	History,
	ImageOff,
	Infinity as InfinityIcon,
	Loader2,
	Search,
	Sparkles,
	Star,
	Ticket,
} from "lucide-react"
import { toast } from "sonner"
import { useCalculatorData } from "../../services/CalculatorContext"
import PredictedBadge from "../PredictedBadge"
import { bannerKey, plannedBannerKey } from "../../utils/bannerHelpers"
import type { BannerKey } from "../../utils/bannerHelpers"
import { formatDate, parseApiDate } from "../../utils/dateFormat"
import type {
	ChampionsMeeting,
	LeagueOfHeroes,
	BannerTimelineForViewing,
	BannerUma,
	BannerSupport,
	UserPlannedBanner,
} from "../../types"

const PAGE_SIZE = 10

/**
 * How the list is chunked.
 *
 * `PAGE_SIZE` slices the paged view. `INFINITE_CHUNK_SIZE` is how many more
 * cards each scroll append reveals — deliberately the same number so the two
 * modes feel equivalent, and small because a banner card carries up to five
 * images. `INFINITE_ROOT_MARGIN` starts the next append while the sentinel is
 * still that far below the fold, so the list has usually grown before the user
 * reaches the bottom.
 */
const INFINITE_CHUNK_SIZE = 10
const INFINITE_ROOT_MARGIN = "800px"

/**
 * Infinite scroll needs an IntersectionObserver to advance. Where there isn't
 * one (jsdom under test, pre-2019 browsers) the list renders unwindowed instead
 * — slower on a long list, but every event stays reachable, which is the whole
 * point of the mode.
 */
const SUPPORTS_INTERSECTION_OBSERVER = typeof IntersectionObserver !== "undefined"

/** The user's chosen list style. Infinite is the default; paged is opt-in. */
type TimelineViewMode = "infinite" | "paged"

const VIEW_MODE_STORAGE_KEY = "uma-planner-timeline-view"
const DEFAULT_VIEW_MODE: TimelineViewMode = "infinite"

// Read/write are wrapped because localStorage throws outright (not returns null)
// in some privacy modes. A blocked store should cost the user their saved
// preference, not the whole Timeline route.
function readStoredViewMode(): TimelineViewMode {
	try {
		return localStorage.getItem(VIEW_MODE_STORAGE_KEY) === "paged" ? "paged" : DEFAULT_VIEW_MODE
	} catch {
		return DEFAULT_VIEW_MODE
	}
}

function storeViewMode(mode: TimelineViewMode): void {
	try {
		localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
	} catch {
		// Preference simply won't persist across reloads.
	}
}
const controlButtonClass =
	"inline-flex min-h-10 items-center justify-center gap-2 rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-100 shadow-sm transition hover:border-gray-500 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-45 md:min-h-0 md:py-1.5"
const paginationButtonClass = `${controlButtonClass} min-w-28`
const pageIndicatorClass =
	"inline-flex min-h-10 items-center justify-center rounded border border-gray-700 bg-gray-950/50 px-4 py-2 text-sm font-semibold text-gray-200 shadow-inner md:min-h-0 md:py-1.5"
const searchInputClass =
	"w-full rounded border border-gray-600 bg-gray-800 py-2 pl-9 pr-3 text-sm text-gray-100 shadow-sm placeholder:text-gray-400 transition focus:border-gray-500 focus:bg-gray-800 focus:outline-none md:py-1.5"

type BannerCardStatus = "available" | "planned" | "staged" | "expired"

type PaginationControlsProps = {
	currentPage: number
	totalPages: number
	onPrevious: () => void
	onNext: () => void
}

function PaginationControls({
	currentPage,
	totalPages,
	onPrevious,
	onNext,
}: PaginationControlsProps) {
	return (
		<div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
			<button
				type="button"
				className={paginationButtonClass}
				disabled={currentPage === 1}
				onClick={onPrevious}
			>
				<ChevronLeft className="h-4 w-4" />
				Previous
			</button>
			<span className={pageIndicatorClass}>
				Page <span className="mx-1 text-brand">{currentPage}</span> of {totalPages}
			</span>
			<button
				type="button"
				className={paginationButtonClass}
				disabled={currentPage === totalPages}
				onClick={onNext}
			>
				Next
				<ChevronRight className="h-4 w-4" />
			</button>
		</div>
	)
}

function isChampionsMeeting(
	event: ChampionsMeeting | LeagueOfHeroes | BannerTimelineForViewing
): event is ChampionsMeeting {
	return "track" in event
}

function isLeagueOfHeroes(
	event: ChampionsMeeting | LeagueOfHeroes | BannerTimelineForViewing
): event is LeagueOfHeroes {
	return !("track" in event) && !("banner_umas" in event)
}


/**
 * A React key that survives re-filtering and can't collide across the three
 * event types.
 *
 * Ids are only unique *within* a model, so a bare id would let ChampionsMeeting
 * 4 and BannerTimeline 4 share a key. The old `key={index}` was worse still:
 * under infinite scroll the list grows and re-filters in place, and positional
 * keys make React reuse one card's DOM — including its already-decoded images —
 * for a completely different event.
 */
function timelineEventKey(
	event: ChampionsMeeting | LeagueOfHeroes | BannerTimelineForViewing
): string {
	if (isChampionsMeeting(event)) return `cm-${event.id}`
	if (isLeagueOfHeroes(event)) return `loh-${event.id}`
	return `bt-${(event as unknown as BannerTimelineForViewing).id}`
}

function eventMatchesSearch(
	event: ChampionsMeeting | LeagueOfHeroes | BannerTimelineForViewing,
	query: string
): boolean {
	const q = query.toLowerCase()
	if (isChampionsMeeting(event)) {
		return event.name.toLowerCase().includes(q) || event.track.toLowerCase().includes(q)
	}
	if (isLeagueOfHeroes(event)) {
		return event.name.toLowerCase().includes(q)
	}
	// TypeScript collapses the remaining type to `never` here because
	// BannerTimelineForViewing is structurally assignable to LeagueOfHeroes
	// (same base fields), so the negative guards' Exclude produces never.
	// The cast is logically safe: we've already ruled out both other branches.
	const bannerEvent = event as unknown as BannerTimelineForViewing
	if (bannerEvent.name.toLowerCase().includes(q)) return true
	for (const banner of bannerEvent.banner_umas) {
		for (const uma of banner.umas) {
			if (uma.name.toLowerCase().includes(q)) return true
		}
	}
	for (const banner of bannerEvent.banner_supports) {
		for (const card of banner.support_cards) {
			if (card.name.toLowerCase().includes(q)) return true
		}
	}
	return false
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

// Countdown label for the badge in a banner card's header. Both dates are
// parsed through parseApiDate so date-only strings land on *local* midnight —
// `new Date("2026-08-10")` would parse as UTC and shift the day count by one
// for anyone west of GMT. Comparing calendar days (not elapsed hours) means a
// banner starting later today reads "Starts today" rather than "in 0 days".
function getCountdownLabel(startDate: string, endDate: string, today: Date): string {
	const start = parseApiDate(startDate)
	const end = parseApiDate(endDate)
	if (!start || !end) return ""

	const daysUntilStart = differenceInCalendarDays(start, today)
	if (daysUntilStart > 1) return `In ${daysUntilStart} Days`
	if (daysUntilStart === 1) return "Starts Tomorrow"
	if (daysUntilStart === 0) return "Starts Today"

	// Already started — the countdown flips to how much of it is left.
	const daysUntilEnd = differenceInCalendarDays(end, today)
	if (daysUntilEnd > 1) return `Ends in ${daysUntilEnd} Days`
	if (daysUntilEnd === 1) return "Ends Tomorrow"
	if (daysUntilEnd === 0) return "Ends Today"
	return "Ended"
}

// Champions Meeting details are entered by hand in the admin and are unknown
// until the meeting is announced. The model's columns are non-null, so "unknown"
// is encoded as a sentinel rather than an absent value: text fields are seeded
// with "TBD" and the stat recommendations with 0. Both predicates below map
// those sentinels back to "not announced yet" so the rows can be hidden.
function isTrackDetailAvailable(value: string | null | undefined): boolean {
	if (value == null) return false
	const trimmed = value.trim()
	return trimmed !== "" && trimmed.toUpperCase() !== "TBD"
}

// Recommendations come off an IntegerField, so DRF sends real numbers even
// though the TS type says `string` — coerce before comparing. A meeting never
// legitimately recommends 0 of a stat, so 0 (and anything non-numeric) is unset.
function isRecommendationAvailable(value: string | number | null | undefined): boolean {
	if (value == null || value === "") return false
	const numeric = Number(value)
	return Number.isFinite(numeric) && numeric > 0
}

// Banner art is uploaded per banner and is often missing for far-future,
// still-predicted banners. Render a labelled placeholder instead of letting the
// browser show a broken-image glyph for an empty `image`.
function BannerArtPlaceholder({ className = "" }: { className?: string }) {
	return (
		<div
			className={`flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border border-gray-600 bg-gray-800 p-4 text-center text-sm text-gray-400 ${className}`}
		>
			<ImageOff className="h-6 w-6" />
			<span>Banner art coming soon</span>
		</div>
	)
}

export const Timeline = () => {
	const {
		organizedTimelineData,
		userPlannedBannerData,
		umaBannerData,
		supportBannerData,
		stagedBanners,
		setStagedBanners,
	} = useCalculatorData()
	const [showPast, setShowPast] = useState(false)
	const [searchQuery, setSearchQuery] = useState("")
	const [currentPage, setCurrentPage] = useState(1)
	const [viewMode, setViewMode] = useState<TimelineViewMode>(readStoredViewMode)
	const [visibleCount, setVisibleCount] = useState(INFINITE_CHUNK_SIZE)
	const sentinelRef = useRef<HTMLDivElement | null>(null)

	// Built once per mount rather than per render. Every event is compared
	// against it, and a fresh Date each render would invalidate the memo below
	// on every single pass — defeating the point of memoizing at all.
	const today = useMemo(() => new Date(), [])

	// Keys of banners already on the planner sheet — used for duplicate checks and button state.
	// Keyed by type+id, never by bare id: uma and support banners have independent
	// primary keys, so a bare id would make an uma banner block its same-date
	// support counterpart (see plannedBannerKey).
	const plannedBannerKeys = new Set(
		userPlannedBannerData
			.map(plannedBannerKey)
			.filter((key): key is BannerKey => key !== null)
	)

	// Banners nested inside BannerTimelineForViewing have banner_timeline omitted by the API serializer.
	// We look up the full object from umaBannerData/supportBannerData (which always include it)
	// so the staged banner in CaratCalculator is structurally complete.
	const handleAddBanner = (banner: BannerUma | BannerSupport, type: "Uma" | "Support"): void => {
		const fullBanner = type === "Uma"
			? umaBannerData.find((b) => b.id === banner.id)
			: supportBannerData.find((b) => b.id === banner.id)

		if (!fullBanner) {
			toast.error("Could not find banner data. Try refreshing the page.")
			return
		}

		const allIds = [
			...userPlannedBannerData.map((b) => b.tempId ?? b.id ?? 0),
			...stagedBanners.map((b) => b.tempId ?? 0),
		]
		const highestId = allIds.length > 0 ? Math.max(...allIds) : 0

		const newStaged: UserPlannedBanner = type === "Uma"
			? { tempId: highestId + 1, number_of_pulls: 0, banner_uma: fullBanner as BannerUma, initialBannerType: "Uma" }
			: { tempId: highestId + 1, number_of_pulls: 0, banner_support: fullBanner as BannerSupport, initialBannerType: "Support" }

		setStagedBanners((prev) => [...prev, newStaged])
		toast.success(`${fullBanner.name} staged! Head to the Calculator to confirm.`)
	}

	// Memoized because infinite scroll re-renders this component on every append,
	// and re-scanning ~250 events (each search walking every featured uma and
	// support card) on each one is real work for no benefit.
	const filteredEvents = useMemo(
		() =>
			organizedTimelineData
				.filter((event) =>
					showPast
						? new Date(event.end_date) < today
						: new Date(event.end_date) >= today
				)
				.filter((event) => searchQuery === "" || eventMatchesSearch(event, searchQuery)),
		[organizedTimelineData, showPast, searchQuery, today]
	)

	const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE))

	// Paged mode windows by page; infinite mode reveals a prefix that only grows.
	// Without an IntersectionObserver there is nothing to drive the growth, so
	// that case skips windowing entirely rather than stranding the reader ten
	// cards in with no way to reach the rest.
	const visibleEvents =
		viewMode === "paged"
			? filteredEvents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
			: SUPPORTS_INTERSECTION_OBSERVER
				? filteredEvents.slice(0, visibleCount)
				: filteredEvents

	const hasMoreToReveal =
		viewMode === "infinite" &&
		SUPPORTS_INTERSECTION_OBSERVER &&
		visibleCount < filteredEvents.length

	// Restarting both windows is the right response to any change in what the
	// list contains: page 7 of a now-two-page result renders empty, and a search
	// matching three events must not still claim to be showing sixty.
	//
	// Done in the handlers rather than an effect keyed on the filters. Resetting
	// from an effect means React commits the stale window first and immediately
	// re-renders over it — a visible flash of the wrong list, and what
	// `react-hooks/set-state-in-effect` warns about.
	const resetListWindow = (): void => {
		setCurrentPage(1)
		setVisibleCount(INFINITE_CHUNK_SIZE)
	}

	const changeViewMode = (mode: TimelineViewMode): void => {
		setViewMode(mode)
		storeViewMode(mode)
		// Land at the top rather than mid-window, whose beginning the reader
		// would have no way to scroll back to.
		resetListWindow()
	}

	const revealMore = useCallback(() => {
		setVisibleCount((count) => count + INFINITE_CHUNK_SIZE)
	}, [])

	// Reveal the next chunk as the sentinel approaches the viewport.
	//
	// `visibleCount` is in the dependency list on purpose. An IntersectionObserver
	// fires only when intersection *changes*, so an observer left attached across
	// an append would go quiet while the sentinel was still on screen and the list
	// would stall one chunk in — the usual failure on tall viewports, where one
	// chunk doesn't fill the fold. Tearing the observer down and rebuilding it
	// each append forces a fresh evaluation, so appends keep coming until the
	// sentinel is genuinely pushed out of range.
	useEffect(() => {
		if (!hasMoreToReveal) return

		const sentinel = sentinelRef.current
		if (!sentinel) return

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) revealMore()
			},
			{ rootMargin: INFINITE_ROOT_MARGIN }
		)
		observer.observe(sentinel)
		return () => observer.disconnect()
	}, [hasMoreToReveal, visibleCount, revealMore])

	return (
		<div className="w-full bg-gray-900 pb-6">
			<div className="border-y border-gray-700/60 bg-gray-950/40 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
				<div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-stretch gap-3 px-3 py-3 md:grid-cols-[1fr_auto_1fr] md:items-center md:px-2">
					<div className="flex w-full flex-col gap-2 justify-self-start sm:flex-row sm:flex-wrap md:w-auto">
						<button
							type="button"
							className={`${controlButtonClass} w-full sm:w-auto`}
							onClick={() => { setShowPast((prev) => !prev); resetListWindow() }}
						>
							<History className="h-4 w-4 text-brand" />
							{showPast ? "Show current/future events" : "Show past events"}
						</button>
						{/* Labelled with the mode it switches *to*, matching the past/future
						    button beside it rather than reading as a state indicator. */}
						<button
							type="button"
							className={`${controlButtonClass} w-full sm:w-auto`}
							title={
								viewMode === "infinite"
									? "Show a fixed number of events per page"
									: "Load every event continuously as you scroll"
							}
							onClick={() => changeViewMode(viewMode === "infinite" ? "paged" : "infinite")}
						>
							{viewMode === "infinite" ? (
								<BookOpen className="h-4 w-4 text-brand" />
							) : (
								<InfinityIcon className="h-4 w-4 text-brand" />
							)}
							{viewMode === "infinite" ? "Use pages" : "Use infinite scroll"}
						</button>
					</div>
					{viewMode === "paged" && totalPages > 1 ? (
						<PaginationControls
							currentPage={currentPage}
							totalPages={totalPages}
							onPrevious={() => setCurrentPage((p) => Math.max(1, p - 1))}
							onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
						/>
					) : viewMode === "infinite" && filteredEvents.length > 0 ? (
						<span className={pageIndicatorClass}>
							Showing <span className="mx-1 text-brand">{visibleEvents.length}</span> of{" "}
							{filteredEvents.length}
						</span>
					) : <div />}
					<div className="flex justify-end">
						<div className="relative w-full md:w-64">
							<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
							<input
								type="text"
								className={searchInputClass}
								placeholder="Search characters or events..."
								value={searchQuery}
								onChange={(e) => { setSearchQuery(e.target.value); resetListWindow() }}
							/>
						</div>
					</div>
				</div>
			</div>

			<div className="page-container flex flex-col items-center">
				{filteredEvents.length === 0 && (
					<div className="text-gray-500 mt-8">No events found.</div>
				)}
				{visibleEvents.map((event) => {
					if (isChampionsMeeting(event)) {
						const trackDetails = [
							event.track,
							event.surface_type,
							event.distance,
							event.length,
							event.direction,
							event.track_condition,
							event.season,
							event.weather,
						]
						const statRecommendations = [
							{ icon: "/00_CMSPEED1.png", label: "Speed", value: event.speed_recommendation },
							{ icon: "/01_CMStamina1.png", label: "Stamina", value: event.stamina_recommendation },
							{ icon: "/02_CMPOWER1.png", label: "Power", value: event.power_recommendation },
							{ icon: "/03_CMGUTS1.png", label: "Guts", value: event.guts_recommendation },
							{ icon: "/04_CMWits1.png", label: "Wits", value: event.wit_recommendation },
						]
						// A partially-filled meeting would read as misleading rather than
						// merely incomplete, so each row is all-or-nothing: show it only
						// once every value in it is available. When neither row qualifies,
						// the card falls back to just the dates and the art.
						const showTrackDetails = trackDetails.every(isTrackDetailAvailable)
						const showStatRecommendations = statRecommendations.every((stat) =>
							isRecommendationAvailable(stat.value)
						)

						return (
							<div key={timelineEventKey(event)} className="my-2 w-full px-2 flex flex-wrap lg:flex-nowrap font-medium text-base sm:text-lg">
								<div className="w-full flex flex-col card-panel rounded-xl p-2 justify-center items-center gap-2">
									<div className="w-full flex flex-wrap items-center justify-center gap-2 text-center text-sm sm:text-lg card-section rounded-xl font-medium">
										<span>
											{formatDate(event.start_date)} through{" "}
											{formatDate(event.end_date)}
										</span>
										{event.is_predicted && <PredictedBadge />}
									</div>
									{event.image ? (
										<img src={event.image} alt={event.name} loading="lazy" decoding="async" className="max-w-full h-auto" />
									) : (
										<BannerArtPlaceholder className="max-w-md" />
									)}
									{showTrackDetails && (
										<div className="flex flex-col items-center card-section shadow-sm rounded-xl w-full">
											<div className="flex flex-wrap gap-4 md:gap-16 justify-center">
												{trackDetails.map((detail, detailIndex) => (
													<div key={detailIndex}>{detail}</div>
												))}
											</div>
										</div>
									)}
									{showStatRecommendations && (
										<div className="grid w-full grid-cols-2 gap-3 p-1 text-center text-gray-100 sm:grid-cols-3 lg:grid-cols-5">
											{statRecommendations.map((stat) => (
												<div key={stat.label} className="flex flex-col items-center">
													<img src={stat.icon} alt={stat.label} className="max-w-16" />
													{stat.value}
												</div>
											))}
										</div>
									)}
								</div>
							</div>
						)
					}

					if (isLeagueOfHeroes(event)) {
						return (
							<div key={timelineEventKey(event)} className="my-2 w-full px-2 flex flex-wrap lg:flex-nowrap font-medium text-base sm:text-lg">
								<div className="w-full flex flex-col card-panel rounded-xl p-2 justify-center items-center gap-2">
									<div className="w-full flex flex-wrap items-center justify-center gap-2 text-center text-sm sm:text-lg card-section rounded-xl font-medium">
										<span>
											{formatDate(event.start_date)} through{" "}
											{formatDate(event.end_date)}
										</span>
										{event.is_predicted && <PredictedBadge />}
									</div>
									<div>{event.name}</div>
									{event.image && <img src={event.image} alt={event.name} loading="lazy" decoding="async" className="max-w-full h-auto" />}
								</div>
							</div>
						)
					}

					// BannerTimelineForViewing.
					// TypeScript collapses the remaining type to `never` here because
					// BannerTimelineForViewing is structurally assignable to LeagueOfHeroes
					// (same base fields), so the negative guard's Exclude produces never.
					// The cast is logically safe: we've already ruled out both other branches.
					const bannerEvent = event as unknown as BannerTimelineForViewing
					const umaBanner = bannerEvent.banner_umas[0]
					const supportBanner = bannerEvent.banner_supports[0]

					const umaExpired     = !umaBanner     || new Date(bannerEvent.end_date) <= today
					const supportExpired = !supportBanner || new Date(bannerEvent.end_date) <= today
					const umaPlanned     = umaBanner     ? plannedBannerKeys.has(bannerKey("Uma", umaBanner.id))         : false
					const supportPlanned = supportBanner ? plannedBannerKeys.has(bannerKey("Support", supportBanner.id)) : false
					const umaStaged      = umaBanner     ? stagedBanners.some((b) => b.banner_uma?.id === umaBanner.id)         : false
					const supportStaged  = supportBanner ? stagedBanners.some((b) => b.banner_support?.id === supportBanner.id) : false
					const umaStatus = getBannerCardStatus(!!umaBanner, umaExpired, umaPlanned, umaStaged)
					const supportStatus = getBannerCardStatus(!!supportBanner, supportExpired, supportPlanned, supportStaged)
					const countdownLabel = getCountdownLabel(bannerEvent.start_date, bannerEvent.end_date, today)
					const umaFeatureGridClass = umaBanner && umaBanner.umas.length === 1
						? "grid-cols-1"
						: "grid-cols-2"
					const supportFeatureGridClass = supportBanner && supportBanner.support_cards.length === 1
						? "grid-cols-1"
						: "grid-cols-2"

					return (
						<div key={timelineEventKey(event)} className="my-3 w-full px-2">
							<div className="card-panel w-full overflow-hidden rounded-xl p-2 sm:p-3">
								<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
									<div className="flex min-w-0 items-center gap-3">
										<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-600 bg-gray-700 text-brand">
											<CalendarDays className="h-5 w-5" />
										</div>
										<div className="min-w-0 text-xl font-semibold text-gray-100 sm:text-2xl">
											<div className="flex flex-wrap items-center gap-2">
												<span>
													{formatDate(bannerEvent.start_date)} through{" "}
													{formatDate(bannerEvent.end_date)}
												</span>
												{bannerEvent.is_predicted && <PredictedBadge />}
											</div>
										</div>
									</div>
									<div className="flex w-fit items-center gap-2 rounded-full border border-gray-600 bg-gray-700 px-3 py-1 text-sm font-semibold text-gray-100">
										<span>{countdownLabel}</span>
										<Clock3 className="h-4 w-4 text-brand" />
									</div>
								</div>

								<div className="grid gap-4 xl:grid-cols-[minmax(360px,1.28fr)_minmax(260px,0.88fr)_minmax(260px,0.78fr)] xl:items-stretch">
									<div className="min-w-0">
										{bannerEvent.image ? (
											<img
												src={bannerEvent.image}
												alt={bannerEvent.name}
												loading="lazy"
												decoding="async"
												className="h-auto w-full rounded-xl border border-gray-600 shadow-md"
											/>
										) : (
											<BannerArtPlaceholder />
										)}
									</div>

									<section className="flex min-w-0 flex-col rounded-xl border border-gray-600 bg-gray-800 px-1.5 py-1.5 shadow-sm xl:overflow-hidden">
										<div className="mb-1.5 flex shrink-0 items-center gap-2 text-sm font-semibold text-brand">
											<Sparkles className="h-4 w-4" />
											<span>Featured Umamusume</span>
										</div>
										{umaBanner ? (
											<div className="flex flex-1 flex-col gap-1.5 xl:min-h-0 xl:overflow-hidden">
												<div className={`grid grid-rows-1 flex-1 items-stretch justify-items-center content-stretch gap-1.5 xl:min-h-0 xl:overflow-hidden ${umaFeatureGridClass}`}>
													{umaBanner.umas.map((uma, umaIndex) => (
														<div
															key={umaIndex}
															className="flex h-full min-w-0 max-w-[10rem] flex-col overflow-hidden rounded-lg bg-gray-700 text-left shadow-sm"
														>
															<div className="relative shrink-0 overflow-hidden bg-gray-700">
																{uma.recommendation && (
																	<div className="absolute left-2 top-2 z-10 rounded border border-gray-600 bg-gray-700/95 px-2 py-1 text-xs font-semibold text-brand">
																		{uma.recommendation}
																	</div>
																)}
																<img
																	src={uma.image}
																	alt={uma.name}
																	loading="lazy"
																	decoding="async"
																	className="block h-auto w-full object-contain"
																/>
															</div>
															<div className="flex flex-1 flex-col justify-center p-1.5">
																<div className="line-clamp-2 min-h-[2rem] overflow-hidden break-words text-center text-sm font-semibold leading-tight text-gray-100">
																	{uma.name}
																</div>
															</div>
														</div>
													))}
												</div>
												{/* Single shared action button — both featured umas belong to the same
												    banner, so one full-width button drives the add for all of them. */}
												<button
													type="button"
													onClick={() => handleAddBanner(umaBanner, "Uma")}
													disabled={umaStatus !== "available"}
													className={`flex shrink-0 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-xs font-medium leading-tight transition ${getBannerStatusClasses(umaStatus)} ${
														umaStatus === "available" ? "cursor-pointer" : "cursor-not-allowed"
													}`}
												>
													<Star className="h-3.5 w-3.5" />
													{getBannerStatusLabel(umaStatus)}
													{umaStatus === "available" && <ChevronRight className="h-3.5 w-3.5" />}
												</button>
											</div>
										) : (
											<div className="flex min-h-40 w-full flex-1 items-center justify-center rounded-lg border border-gray-600 bg-gray-700 px-4 text-center text-sm text-gray-400">
												No Umamusume banner in this window.
											</div>
										)}
									</section>

									<section className="flex min-w-0 flex-col rounded-xl border border-gray-600 bg-gray-800 px-1.5 py-1.5 shadow-sm xl:overflow-hidden">
										<div className="mb-1.5 flex shrink-0 items-center gap-2 text-sm font-semibold text-brand">
											<Ticket className="h-4 w-4" />
											<span>Featured Support Cards</span>
										</div>
										{supportBanner ? (
											<div className="flex flex-1 flex-col gap-1.5 xl:min-h-0 xl:overflow-hidden">
												<div className={`grid grid-rows-1 flex-1 items-stretch justify-items-center content-stretch gap-1.5 xl:min-h-0 xl:overflow-hidden ${supportFeatureGridClass}`}>
													{supportBanner.support_cards.map((card, cardIndex) => (
														<div
															key={cardIndex}
															className="flex h-full min-w-0 max-w-[7.75rem] flex-col overflow-hidden rounded-lg bg-gray-700 text-left shadow-sm"
														>
															<div className="relative shrink-0 overflow-hidden bg-gray-700">
																{card.recommendation && (
																	<div className="absolute left-2 top-2 z-10 rounded border border-gray-600 bg-gray-700/95 px-2 py-1 text-xs font-semibold text-brand">
																		{card.recommendation}
																	</div>
																)}
																<img
																	src={card.image}
																	alt={card.name}
																	loading="lazy"
																	decoding="async"
																	className="block h-auto w-full object-contain"
																/>
															</div>
															<div className="flex flex-1 flex-col justify-center p-1.5">
																<div className="line-clamp-2 min-h-[2rem] overflow-hidden break-words text-center text-sm font-semibold leading-tight text-gray-100">
																	{card.name}
																</div>
															</div>
														</div>
													))}
												</div>
												{/* Single shared action button — all featured support cards belong to the
												    same banner, so one full-width button drives the add for all of them. */}
												<button
													type="button"
													onClick={() => handleAddBanner(supportBanner, "Support")}
													disabled={supportStatus !== "available"}
													className={`flex shrink-0 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-xs font-medium leading-tight transition ${getBannerStatusClasses(supportStatus)} ${
														supportStatus === "available" ? "cursor-pointer" : "cursor-not-allowed"
													}`}
												>
													<Ticket className="h-3.5 w-3.5" />
													{getBannerStatusLabel(supportStatus)}
													{supportStatus === "available" && <ChevronRight className="h-3.5 w-3.5" />}
												</button>
											</div>
										) : (
											<div className="flex min-h-40 w-full flex-1 items-center justify-center rounded-lg border border-gray-600 bg-gray-700 px-4 text-center text-sm text-gray-400">
												No support banner in this window.
											</div>
										)}
									</section>
								</div>
							</div>
						</div>
					)
				})}

				{viewMode === "infinite" && (
					<>
						{/* Scroll tripwire. Kept mounted whenever the mode is active (not just
						    when there's more to load) so the observer effect always has a node
						    to attach to on the render where `hasMoreToReveal` flips true. */}
						<div ref={sentinelRef} aria-hidden="true" className="h-px w-full shrink-0" />
						{hasMoreToReveal ? (
							<div
								role="status"
								className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-400"
							>
								<Loader2 className="h-4 w-4 animate-spin text-brand" />
								Loading more events...
							</div>
						) : filteredEvents.length > 0 ? (
							<div className="mt-4 text-sm text-gray-500">
								That's all {filteredEvents.length} events.
							</div>
						) : null}
					</>
				)}
			</div>

			{viewMode === "paged" && totalPages > 1 && (
				<div className="mx-auto mt-2 w-fit max-w-[calc(100%-1.5rem)] rounded-lg border border-gray-700/60 bg-gray-950/40 px-3 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
					<PaginationControls
						currentPage={currentPage}
						totalPages={totalPages}
						onPrevious={() => setCurrentPage((p) => Math.max(1, p - 1))}
						onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
					/>
				</div>
			)}
		</div>
	)
}
