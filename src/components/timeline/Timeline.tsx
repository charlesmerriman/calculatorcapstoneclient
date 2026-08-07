import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	BookOpen,
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	Clock3,
	History,
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
import { bannerKey, nextTempId, plannedBannerKey } from "../../utils/bannerHelpers"
import type { BannerKey } from "../../utils/bannerHelpers"
import { formatDate } from "../../utils/dateFormat"
import { RaceEventCard } from "./RaceEventCard"
import { BannerArtPlaceholder } from "./BannerArtPlaceholder"
import { AnniversaryEventStrip } from "./AnniversaryEventStrip"
import { getCountdownLabel } from "./timelineShared"
import { isRaceEvent } from "../../types"
import type {
	BannerUma,
	BannerSupport,
	UserPlannedBanner,
	TimelineEvent,
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

/**
 * The paged view's current page, persisted so it survives an unmount.
 *
 * This route unmounts whenever the user switches to the calculator, which
 * throws away every piece of local state — so without this, coming back always
 * landed on page 1 no matter how far they'd paged in.
 *
 * `sessionStorage`, not `localStorage`: a page index is "where I am right now",
 * not a preference like the view mode. It's meaningful for the length of a
 * visit, but restoring page 12 in a browser opened a week later would point at
 * completely different events, since the timeline is date-filtered.
 */
const PAGE_STORAGE_KEY = "uma-planner-timeline-page"

function readStoredPage(): number {
	try {
		const stored = Number(sessionStorage.getItem(PAGE_STORAGE_KEY))
		// Anything absent, non-numeric, or out of range falls back to page 1.
		// The upper bound can't be checked here — the event list hasn't loaded
		// yet at mount — so the render clamps against totalPages instead.
		return Number.isInteger(stored) && stored > 0 ? stored : 1
	} catch {
		return 1
	}
}

function storePage(page: number): void {
	try {
		sessionStorage.setItem(PAGE_STORAGE_KEY, String(page))
	} catch {
		// Position simply won't survive leaving the route.
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
const EVENT_KEY_PREFIX = {
	champions_meeting: "cm",
	league_of_heroes: "loh",
	banner_timeline: "bt",
} as const

function timelineEventKey(event: TimelineEvent): string {
	return `${EVENT_KEY_PREFIX[event.event_type]}-${event.id}`
}

function eventMatchesSearch(event: TimelineEvent, query: string): boolean {
	const q = query.toLowerCase()
	if (isRaceEvent(event)) {
		return event.name.toLowerCase().includes(q) || event.track.toLowerCase().includes(q)
	}
	const bannerEvent = event
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
	const [currentPage, setCurrentPage] = useState(readStoredPage)
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

		setStagedBanners((prev) => {
			// From `prev`, never from the render-scoped stagedBanners — staging two
			// banners in quick succession is the normal way to use this page, and a
			// stale list would mint the same tempId twice. See nextTempId.
			const tempId = nextTempId(userPlannedBannerData, prev)

			const newStaged: UserPlannedBanner = type === "Uma"
				? { tempId, number_of_pulls: 0, reserved_copies: 0, banner_uma: fullBanner as BannerUma, initialBannerType: "Uma" }
				: { tempId, number_of_pulls: 0, reserved_copies: 0, banner_support: fullBanner as BannerSupport, initialBannerType: "Support" }

			return [...prev, newStaged]
		})
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

	// The only writer of the page, so every path that moves it — the buttons, the
	// filter resets — also persists it. Nothing sets `currentPage` directly.
	const goToPage = useCallback((page: number): void => {
		setCurrentPage(page)
		storePage(page)
	}, [])

	// A restored page can outrun the list it's indexing: the events are fetched
	// after mount (so totalPages is 1 for the first render or two), and the user
	// may return with fewer matches than they left with. Clamping here — rather
	// than correcting the state from an effect — means the list and the "Page X
	// of Y" label are never briefly inconsistent, and the stored page is left
	// intact so a slow fetch doesn't permanently knock the reader back to 1.
	const effectivePage = Math.min(currentPage, totalPages)

	// Paged mode windows by page; infinite mode reveals a prefix that only grows.
	// Without an IntersectionObserver there is nothing to drive the growth, so
	// that case skips windowing entirely rather than stranding the reader ten
	// cards in with no way to reach the rest.
	const visibleEvents =
		viewMode === "paged"
			? filteredEvents.slice((effectivePage - 1) * PAGE_SIZE, effectivePage * PAGE_SIZE)
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
		goToPage(1)
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
				<div className="mx-auto grid w-full max-w-[96rem] grid-cols-1 items-stretch gap-3 px-3 py-3 md:grid-cols-[1fr_auto_1fr] md:items-center md:px-2">
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
							currentPage={effectivePage}
							totalPages={totalPages}
							onPrevious={() => goToPage(Math.max(1, effectivePage - 1))}
							onNext={() => goToPage(Math.min(totalPages, effectivePage + 1))}
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
					// Champions Meetings and League of Heroes events share one card —
					// they carry the same data and are meant to look the same.
					if (isRaceEvent(event)) {
						return <RaceEventCard key={timelineEventKey(event)} event={event} today={today} />
					}

					// Everything left is a banner window: the union has three members and
					// the tag has ruled out the other two, so `event` narrows on its own.
					const bannerEvent = event
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

					// A campaign strip sits flush above the card, so the card's own top
					// corners have to square off or the two render as separate boxes
					// with a seam between them.
					const attachedEvent = bannerEvent.anniversary_event

					return (
						<div key={timelineEventKey(event)} className="my-3 w-full px-2">
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

									<section className="flex min-w-0 flex-col rounded-xl border border-gray-600 bg-gray-800 px-1.5 py-1.5 shadow-sm xl:min-h-0 xl:[contain:size] xl:overflow-hidden">
										<div className="mb-1.5 flex shrink-0 items-center gap-2 text-sm font-semibold text-brand">
											<Sparkles className="h-4 w-4" />
											<span>Featured Umamusume</span>
										</div>
										{umaBanner ? (
											<div className="flex flex-1 flex-col gap-1.5 xl:min-h-0 xl:overflow-hidden">
												<div className={`grid grid-rows-1 flex-1 items-center justify-items-center content-center gap-1.5 xl:min-h-0 xl:overflow-hidden ${umaFeatureGridClass}`}>
													{umaBanner.umas.map((uma, umaIndex) => (
														<div
															key={umaIndex}
															className="flex w-full min-w-0 max-w-[10rem] flex-col overflow-hidden rounded-lg bg-gray-700 text-left shadow-sm 2xl:max-w-[13.5rem]"
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
															<div className="flex h-16 items-center justify-center p-2">
																<div className="line-clamp-2 overflow-hidden break-words text-center text-[0.9375rem] font-semibold leading-tight text-gray-100">
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

									<section className="flex min-w-0 flex-col rounded-xl border border-gray-600 bg-gray-800 px-1.5 py-1.5 shadow-sm xl:min-h-0 xl:[contain:size] xl:overflow-hidden">
										<div className="mb-1.5 flex shrink-0 items-center gap-2 text-sm font-semibold text-brand">
											<Ticket className="h-4 w-4" />
											<span>Featured Support Cards</span>
										</div>
										{supportBanner ? (
											<div className="flex flex-1 flex-col gap-1.5 xl:min-h-0 xl:overflow-hidden">
												<div className={`grid grid-rows-1 flex-1 items-center justify-items-center content-center gap-1.5 xl:min-h-0 xl:overflow-hidden ${supportFeatureGridClass}`}>
													{supportBanner.support_cards.map((card, cardIndex) => (
														<div
															key={cardIndex}
															className="flex w-full min-w-0 max-w-[7.75rem] flex-col overflow-hidden rounded-lg bg-gray-700 text-left shadow-sm 2xl:max-w-[9.5rem]"
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
															<div className="flex h-16 items-center justify-center p-2">
																<div className="line-clamp-2 overflow-hidden break-words text-center text-[0.9375rem] font-semibold leading-tight text-gray-100">
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
						currentPage={effectivePage}
						totalPages={totalPages}
						onPrevious={() => goToPage(Math.max(1, effectivePage - 1))}
						onNext={() => goToPage(Math.min(totalPages, effectivePage + 1))}
					/>
				</div>
			)}
		</div>
	)
}
