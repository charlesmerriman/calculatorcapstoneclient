import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	BookOpen,
	ChevronLeft,
	ChevronRight,
	History,
	Infinity as InfinityIcon,
	Loader2,
	Search,
} from "lucide-react"
import { toast } from "sonner"
import { useCalculatorData } from "../../services/CalculatorContext"
import { nextTempId, plannedBannerKey } from "../../utils/bannerHelpers"
import type { BannerKey } from "../../utils/bannerHelpers"
import { RaceEventCard } from "./RaceEventCard"
import { BannerWindowCard } from "./BannerWindowCard"
import {
	CATEGORY_LABELS,
	CATEGORY_ORDER,
	groupTimelineEvents,
	timelineRowKey,
} from "./timelineShared"
import { isRaceEvent } from "../../types"
import type {
	BannerCategory,
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
// Matches controlButtonClass so the filter reads as a third control in that row
// rather than a form field that wandered in.
const categorySelectClass =
	"inline-flex min-h-10 items-center rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-100 shadow-sm transition hover:border-gray-500 hover:bg-gray-700 focus:border-gray-500 focus:outline-none md:min-h-0 md:py-1.5"

/**
 * The category filter's value. `"all"` is not a category — it's the absence of
 * the filter, and the only value that keeps race events in the list.
 */
type CategoryFilter = "all" | BannerCategory

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
	// Not persisted, matching the search box and the past/future toggle: it's a
	// question you're asking right now, not a preference. Only the view mode and
	// the paged position survive leaving the route.
	const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all")
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
	//
	// Grouping runs LAST, on the already-filtered list. Doing it first would let
	// a window straddle the past/future boundary and drag an ended banner into
	// the current view, and would make a search match pull in banners that don't
	// match. Everything downstream — paging, the reveal window, the counts —
	// therefore measures ROWS (cards on screen), not raw events.
	const timelineRows = useMemo(() => {
		const rows = groupTimelineEvents(
			organizedTimelineData
				.filter((event) =>
					showPast
						? new Date(event.end_date) < today
						: new Date(event.end_date) >= today
				)
				.filter((event) => searchQuery === "" || eventMatchesSearch(event, searchQuery))
		)

		if (categoryFilter === "all") return rows

		// Applied AFTER grouping, and a group survives if ANY constituent matches.
		// Filtering the events first would drop the ordinary banner that shares a
		// revival's window, leaving a card that misrepresents the week — the
		// reader would see the revival alone and conclude nothing else was on.
		//
		// Race events drop out here on purpose: a Champions Meeting has no banner
		// category, so "show me only reruns" cannot meaningfully include one.
		return rows.filter(
			(row) =>
				row.kind === "banner_window" &&
				row.group.banners.some((banner) => banner.banner_category === categoryFilter)
		)
	}, [organizedTimelineData, showPast, searchQuery, categoryFilter, today])

	// Only offer categories the data actually contains. `race_prep_support` has
	// no rows until the support backfill lands, and an option that can only ever
	// return "No events found." is a dead end rather than a filter.
	const availableCategories = useMemo(() => {
		const present = new Set<BannerCategory>()
		for (const event of organizedTimelineData) {
			if (!isRaceEvent(event)) present.add(event.banner_category)
		}
		return CATEGORY_ORDER.filter((category) => present.has(category))
	}, [organizedTimelineData])

	const totalPages = Math.max(1, Math.ceil(timelineRows.length / PAGE_SIZE))

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
	const visibleRows =
		viewMode === "paged"
			? timelineRows.slice((effectivePage - 1) * PAGE_SIZE, effectivePage * PAGE_SIZE)
			: SUPPORTS_INTERSECTION_OBSERVER
				? timelineRows.slice(0, visibleCount)
				: timelineRows

	const hasMoreToReveal =
		viewMode === "infinite" &&
		SUPPORTS_INTERSECTION_OBSERVER &&
		visibleCount < timelineRows.length

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
					) : viewMode === "infinite" && timelineRows.length > 0 ? (
						<span className={pageIndicatorClass}>
							Showing <span className="mx-1 text-brand">{visibleRows.length}</span> of{" "}
							{timelineRows.length}
						</span>
					) : <div />}
					{/* Narrowing controls, grouped at the trailing edge: the category
					    filter and the search box both cut the list down, so they belong
					    beside each other rather than one of them sitting among the
					    view-mode toggles on the far side of the bar. */}
					<div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end md:w-auto md:justify-self-end">
						{/* Hidden only when there is nothing to choose between — a
						    single-option filter is just clutter. */}
						{availableCategories.length > 1 && (
							<>
								<label className="sr-only" htmlFor="timeline-category-filter">
									Filter by banner type
								</label>
								<select
									id="timeline-category-filter"
									className={`${categorySelectClass} w-full sm:w-auto`}
									value={categoryFilter}
									onChange={(e) => {
										setCategoryFilter(e.target.value as CategoryFilter)
										resetListWindow()
									}}
								>
									<option value="all">All events</option>
									{availableCategories.map((category) => (
										<option key={category} value={category}>
											{CATEGORY_LABELS[category]}
										</option>
									))}
								</select>
							</>
						)}
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
				{timelineRows.length === 0 && (
					<div className="text-gray-500 mt-8">No events found.</div>
				)}
				{visibleRows.map((row) =>
					// Champions Meetings and League of Heroes events share one card — they
					// carry the same data and are meant to look the same. Everything else
					// is a banner window, which may hold more than one concurrent banner.
					row.kind === "race" ? (
						<RaceEventCard key={timelineRowKey(row)} event={row.event} today={today} />
					) : (
						<BannerWindowCard
							key={timelineRowKey(row)}
							group={row.group}
							today={today}
							plannedBannerKeys={plannedBannerKeys}
							stagedBanners={stagedBanners}
							onAddBanner={handleAddBanner}
						/>
					)
				)}

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
						) : timelineRows.length > 0 ? (
							<div className="mt-4 text-sm text-gray-500">
								That's all {timelineRows.length} events.
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
