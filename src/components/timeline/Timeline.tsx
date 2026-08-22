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
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { useCalculatorData } from "../../services/CalculatorContext"
import { nextTempId, plannedBannerKey } from "../../utils/bannerHelpers"
import type { BannerKey } from "../../utils/bannerHelpers"
import { RaceEventCard } from "./RaceEventCard"
import { BannerWindowCard } from "./BannerWindowCard"
import { EventMarkerCard } from "./EventMarkerCard"
import {
	CATEGORY_LABELS,
	CATEGORY_ORDER,
	MARKER_LABELS,
	MARKER_ORDER,
	buildTimelineMarkers,
	groupTimelineEvents,
	mergeTimelineMarkers,
	rowMatchesFocus,
	timelineRowKey,
} from "./timelineShared"
import type { TimelineFocusProps, TimelineMarker } from "./timelineShared"
import { FOCUS_TAILROOM, useFocusScroll } from "../../hooks/useFocusScroll"
import { TIMELINE_FOCUS_PARAM, parseTimelineFocus } from "../../utils/timelineFocus"
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
 * Extra rows revealed BELOW a deep link's target, past the chunk it sits in.
 *
 * Without this the target lands in the LAST revealed chunk, so between 0 and 9
 * rows follow it — and at 0 the scroller has nothing left to scroll, so
 * `block: "start"` cannot lift the card to the top and it strands mid-screen.
 * It looked like an intermittent bug because it depended entirely on where the
 * target fell inside its chunk: measured against live data, Project L'Arc (row
 * 44, five rows below it) landed correctly while Grand Masters (row 19, the
 * last of its chunk) did not.
 *
 * A whole chunk of tailroom is ~6000px against a ~900px viewport, so this is
 * not a close-run margin. Targets within one chunk of the END of the list have
 * no rows left to reveal and are covered by FOCUS_TAILROOM instead.
 */
const FOCUS_TRAILING_ROWS = INFINITE_CHUNK_SIZE

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
 * The filter's value: the absence of a filter, a banner category, or a marker
 * kind.
 *
 * Three sources in one string, which is what a `<select>` gives you, so the two
 * real axes have to stay tellable apart. Marker kinds are namespaced with a
 * `marker:` prefix rather than sitting bare alongside the categories — a
 * scenario has no `banner_category` and never will, and an unprefixed
 * `"scenario"` would be one added BannerCategory away from quietly meaning both
 * things at once. The prefix also makes narrowing a string test instead of a
 * membership check against a list that has to be kept in sync.
 *
 * `"all"` is neither axis: it's the only value that keeps race events, and the
 * only one that shows banners and markers together.
 */
const MARKER_FILTER_PREFIX = "marker:"

type MarkerFilter = `${typeof MARKER_FILTER_PREFIX}${TimelineMarker["kind"]}`
type EventFilter = "all" | BannerCategory | MarkerFilter

/** The marker kind a filter selects, or null when it selects banners. */
function markerFilterKind(filter: EventFilter): TimelineMarker["kind"] | null {
	return filter.startsWith(MARKER_FILTER_PREFIX)
		? (filter.slice(MARKER_FILTER_PREFIX.length) as TimelineMarker["kind"])
		: null
}

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
		scenarioData,
		anniversaryEventData,
	} = useCalculatorData()
	const [searchParams, setSearchParams] = useSearchParams()
	/**
	 * Which half of the calendar to show, as an OVERRIDE rather than the value.
	 *
	 * A deep link routinely points at something that has already happened — the
	 * scenario band above your third planned banner launched two years ago — and
	 * the past/future split would otherwise hide the very card the link exists to
	 * reach. Storing the user's choice as `null` until they make one lets the
	 * focus target decide the default (see `showPast` below) without an effect
	 * writing state after the first paint, which would flash the wrong half of
	 * the timeline and is what `react-hooks/set-state-in-effect` warns about.
	 */
	const [showPastOverride, setShowPastOverride] = useState<boolean | null>(null)
	const [searchQuery, setSearchQuery] = useState("")
	// Not persisted, matching the search box and the past/future toggle: it's a
	// question you're asking right now, not a preference. Only the view mode and
	// the paged position survive leaving the route.
	const [eventFilter, setEventFilter] = useState<EventFilter>("all")
	const [currentPage, setCurrentPage] = useState(readStoredPage)
	const [viewMode, setViewMode] = useState<TimelineViewMode>(readStoredViewMode)
	const [visibleCount, setVisibleCount] = useState(INFINITE_CHUNK_SIZE)
	const sentinelRef = useRef<HTMLDivElement | null>(null)
	// One ref for whichever card is the focus target — see TimelineFocusProps.
	const focusCardRef = useRef<HTMLDivElement | null>(null)

	// Built once per mount rather than per render. Every event is compared
	// against it, and a fresh Date each render would invalidate the memo below
	// on every single pass — defeating the point of memoizing at all.
	const today = useMemo(() => new Date(), [])

	// The card this visit is aimed at, if the calculator sent us here. Memoized
	// on the raw string so the parsed object is referentially stable — it feeds
	// the dependency lists below, and a fresh object each render would defeat
	// every one of them.
	const focusParam = searchParams.get(TIMELINE_FOCUS_PARAM)
	const focus = useMemo(() => parseTimelineFocus(focusParam), [focusParam])

	/**
	 * Whether the focus target is behind us — null when there is no focus, or
	 * when the data naming it hasn't loaded yet.
	 *
	 * Answered from the RAW data rather than from `timelineRows`, because the
	 * rows are already filtered by the very value this decides. The rules match
	 * the ones the row list applies: a banner is past once it has ENDED, while a
	 * marker is past once it has STARTED (a scenario has no end — it stays
	 * playable — so its launch instant is the only thing to classify it on).
	 */
	const focusIsPast = useMemo(() => {
		if (!focus) return null
		if (focus.kind === "banner") {
			// Guarded on isRaceEvent so a Champions Meeting sharing the id can't
			// answer for a banner: ids are unique per model, not across them.
			const event = organizedTimelineData.find(
				(candidate) => !isRaceEvent(candidate) && candidate.id === focus.id
			)
			return event ? new Date(event.end_date) < today : null
		}
		if (focus.kind === "scenario") {
			const scenario = scenarioData.find((candidate) => candidate.id === focus.id)
			return scenario?.start_date ? new Date(scenario.start_date) < today : null
		}
		const event = anniversaryEventData.find((candidate) => candidate.id === focus.id)
		// main_start_date ?? start_date — where the campaign actually lands, the
		// same instant buildTimelineMarkers sorts its card on.
		const startDate = event ? event.main_start_date ?? event.start_date : null
		return startDate ? new Date(startDate) < today : null
	}, [focus, organizedTimelineData, scenarioData, anniversaryEventData, today])

	// The user's choice wins; failing that a deep link picks the half its target
	// lives in; failing that, the future.
	const showPast = showPastOverride ?? focusIsPast ?? false

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
		// Both filter values that show markers — "all" and a marker filter — want
		// the same past/future and search passes first, so they live here rather
		// than being written out at each branch.
		//
		// A scenario has no end date, so it can never be "over" the way a banner
		// is. The past/future split classifies it on its start instant instead:
		// once it has launched it belongs behind you in the calendar, even though
		// it is still playable. That is a deliberate reading of an endless event,
		// not an oversight.
		const matchingMarkers = (): TimelineMarker[] =>
			buildTimelineMarkers(scenarioData, anniversaryEventData)
				.filter((marker) =>
					showPast
						? new Date(marker.startDate) < today
						: new Date(marker.startDate) >= today
				)
				.filter(
					(marker) =>
						searchQuery === "" ||
						marker.name.toLowerCase().includes(searchQuery.toLowerCase())
				)

		// A marker filter drops the banner stream entirely, so it returns before
		// any of the event work below: asking for scenarios means asking for
		// scenarios, not for the banners that happen to open alongside them.
		// Merging into an empty row list is just the chronological sort — there
		// is nothing left to splice between.
		const markerKind = markerFilterKind(eventFilter)
		if (markerKind !== null) {
			return mergeTimelineMarkers(
				[],
				matchingMarkers().filter((marker) => marker.kind === markerKind)
			)
		}

		const rows = groupTimelineEvents(
			organizedTimelineData
				.filter((event) =>
					showPast
						? new Date(event.end_date) < today
						: new Date(event.end_date) >= today
				)
				.filter((event) => searchQuery === "" || eventMatchesSearch(event, searchQuery))
		)

		if (eventFilter === "all") {
			// Markers merge in AFTER grouping, on the final row order — running
			// earlier would let one land inside a window that later folds together.
			return mergeTimelineMarkers(rows, matchingMarkers())
		}

		// Markers are deliberately absent under a BANNER CATEGORY filter: they are
		// cross-cutting context rather than banners, so a scenario card stranded
		// in a list of reruns would answer a question nobody asked. The marker
		// filters above are how you ask for them. Race events drop out below for
		// the same reason.
		//
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
				row.group.banners.some((banner) => banner.banner_category === eventFilter)
		)
	}, [
		organizedTimelineData,
		scenarioData,
		anniversaryEventData,
		showPast,
		searchQuery,
		eventFilter,
		today,
	])

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

	// Same rule, one axis over: only offer a marker kind the data can actually
	// produce a card for. Asked of buildTimelineMarkers rather than counted off
	// scenarioData/anniversaryEventData directly, because it is the authority on
	// what earns a card — it drops the undated, and drops `event_type:
	// "campaign"` rows outright (the Trainer Support Pack marks no moment on the
	// calendar). Re-deriving those exclusions here is how the option list and the
	// list it filters drift apart.
	const availableMarkerKinds = useMemo(() => {
		const present = new Set<TimelineMarker["kind"]>()
		for (const marker of buildTimelineMarkers(scenarioData, anniversaryEventData)) {
			present.add(marker.kind)
		}
		return MARKER_ORDER.filter((kind) => present.has(kind))
	}, [scenarioData, anniversaryEventData])

	// Where the focus target ended up once filtering, grouping and marker merging
	// are all done — -1 while the data is still loading, and for a target this
	// timeline genuinely doesn't hold.
	const focusRowIndex = useMemo(
		() => (focus ? timelineRows.findIndex((row) => rowMatchesFocus(row, focus)) : -1),
		[focus, timelineRows]
	)

	const totalPages = Math.max(1, Math.ceil(timelineRows.length / PAGE_SIZE))

	/**
	 * Drop the `focus` parameter from the URL.
	 *
	 * Called from every control that moves or narrows the list. Once the reader
	 * pages, filters or searches, the deep link has been answered and holding on
	 * to it would fight them — the focus target overrides the current page below,
	 * so "Next" would appear to do nothing. Dropping it also retires the arrival
	 * ring at the moment the reader moves on.
	 *
	 * `replace` so the back button returns to the calculator rather than stepping
	 * through the reader's own filtering.
	 */
	const clearFocus = useCallback((): void => {
		if (!searchParams.has(TIMELINE_FOCUS_PARAM)) return
		const next = new URLSearchParams(searchParams)
		next.delete(TIMELINE_FOCUS_PARAM)
		setSearchParams(next, { replace: true })
	}, [searchParams, setSearchParams])

	// The only writer of the page, so every path that moves it — the buttons, the
	// filter resets — also persists it. Nothing sets `currentPage` directly.
	const goToPage = useCallback((page: number): void => {
		setCurrentPage(page)
		storePage(page)
		clearFocus()
	}, [clearFocus])

	// A restored page can outrun the list it's indexing: the events are fetched
	// after mount (so totalPages is 1 for the first render or two), and the user
	// may return with fewer matches than they left with. Clamping here — rather
	// than correcting the state from an effect — means the list and the "Page X
	// of Y" label are never briefly inconsistent, and the stored page is left
	// intact so a slow fetch doesn't permanently knock the reader back to 1.
	// A resolved focus target takes the page over until the reader moves — every
	// control that moves or narrows the list clears the parameter first (see
	// clearFocus), so this can't strand them on one page.
	const focusPage =
		focusRowIndex >= 0 ? Math.floor(focusRowIndex / PAGE_SIZE) + 1 : null
	const effectivePage = Math.min(focusPage ?? currentPage, totalPages)

	/**
	 * How much of the infinite list is on screen: the revealed prefix, widened to
	 * cover the focus target.
	 *
	 * Derived rather than pushed into `visibleCount` from an effect, for the same
	 * reason `showPast` is: setting state in response to the data arriving
	 * commits the un-widened list first and then re-renders over it. Rounded up
	 * to a whole chunk so a jump lands on the same boundaries scrolling would,
	 * then extended by FOCUS_TRAILING_ROWS so the target has something below it
	 * to scroll against — see that constant for why the landing was erratic
	 * without it.
	 */
	const revealCount =
		focusRowIndex >= 0
			? Math.max(
					visibleCount,
					Math.ceil((focusRowIndex + 1) / INFINITE_CHUNK_SIZE) * INFINITE_CHUNK_SIZE +
						FOCUS_TRAILING_ROWS
				)
			: visibleCount

	/**
	 * Whether the LIST ITSELF runs out below the target, leaving it nothing to
	 * scroll against however much is revealed.
	 *
	 * Measured against every row rather than the revealed window, so it is true
	 * only at the genuine end of the timeline — the one case revealing more
	 * cannot fix.
	 */
	const focusNeedsTailroom =
		focusRowIndex >= 0 &&
		timelineRows.length - (focusRowIndex + 1) < FOCUS_TRAILING_ROWS

	// Paged mode windows by page; infinite mode reveals a prefix that only grows.
	// Without an IntersectionObserver there is nothing to drive the growth, so
	// that case skips windowing entirely rather than stranding the reader ten
	// cards in with no way to reach the rest.
	const visibleRows =
		viewMode === "paged"
			? timelineRows.slice((effectivePage - 1) * PAGE_SIZE, effectivePage * PAGE_SIZE)
			: SUPPORTS_INTERSECTION_OBSERVER
				? timelineRows.slice(0, revealCount)
				: timelineRows

	const hasMoreToReveal =
		viewMode === "infinite" &&
		SUPPORTS_INTERSECTION_OBSERVER &&
		revealCount < timelineRows.length

	// Restarting both windows is the right response to any change in what the
	// list contains: page 7 of a now-two-page result renders empty, and a search
	// matching three events must not still claim to be showing sixty.
	//
	// Done in the handlers rather than an effect keyed on the filters. Resetting
	// from an effect means React commits the stale window first and immediately
	// re-renders over it — a visible flash of the wrong list, and what
	// `react-hooks/set-state-in-effect` warns about.
	// goToPage clears the focus parameter, so every caller of this drops the deep
	// link too — which is the intent: the reader has taken over.
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

	// Measured from `revealCount`, not from the raw state: after a focus jump the
	// state still says 10 while 90 rows are on screen, and `count + 10` would
	// append nothing visible for eight scrolls running.
	const revealMore = useCallback(() => {
		setVisibleCount((count) => Math.max(count, revealCount) + INFINITE_CHUNK_SIZE)
	}, [revealCount])

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
	}, [hasMoreToReveal, revealCount, revealMore])

	// Bring the focus target into view once it is rendered, and hold it there
	// while the page settles — see hooks/useFocusScroll, shared with the
	// Selectors page's campaign deep link.
	//
	// Composite key: `focusParam` alone would not re-run when the row index
	// moves from -1 to a real position as the data arrives, and that is the
	// commit which first puts the card in the DOM.
	useFocusScroll(focusCardRef, focusRowIndex >= 0 ? `${focusParam}#${focusRowIndex}` : null)

	return (
		<div className="w-full bg-gray-900 pb-6">
			<div className="border-y border-gray-700/60 bg-gray-950/40 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
				<div className="mx-auto grid w-full max-w-[96rem] grid-cols-1 items-stretch gap-3 px-3 py-3 md:grid-cols-[1fr_auto_1fr] md:items-center md:px-2">
					<div className="flex w-full flex-col gap-2 justify-self-start sm:flex-row sm:flex-wrap md:w-auto">
						<button
							type="button"
							className={`${controlButtonClass} w-full sm:w-auto`}
							onClick={() => { setShowPastOverride(!showPast); resetListWindow() }}
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
						    single-option filter is just clutter. Counted across both
						    axes: one banner category plus one marker kind is still a
						    real choice. */}
						{availableCategories.length + availableMarkerKinds.length > 1 && (
							<>
								<label className="sr-only" htmlFor="timeline-event-filter">
									Filter events
								</label>
								<select
									id="timeline-event-filter"
									className={`${categorySelectClass} w-full sm:w-auto`}
									value={eventFilter}
									onChange={(e) => {
										setEventFilter(e.target.value as EventFilter)
										resetListWindow()
									}}
								>
									<option value="all">All events</option>
									{/* Grouped, because the two lists answer different
									    questions and a flat run of options would read as one
									    list of banner categories with two odd entries at the
									    end. The headings are the axis names. */}
									{availableCategories.length > 0 && (
										<optgroup label="Banner type">
											{availableCategories.map((category) => (
												<option key={category} value={category}>
													{CATEGORY_LABELS[category]}
												</option>
											))}
										</optgroup>
									)}
									{availableMarkerKinds.length > 0 && (
										<optgroup label="Other events">
											{availableMarkerKinds.map((kind) => (
												<option key={kind} value={`${MARKER_FILTER_PREFIX}${kind}`}>
													{MARKER_LABELS[kind]}
												</option>
											))}
										</optgroup>
									)}
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
				{visibleRows.map((row) => {
					// Spread rather than passed as two props so the un-focused case —
					// every card but at most one — stays literally empty, and the ref
					// can only ever be claimed by the card the link named.
					const focusProps: TimelineFocusProps =
						focus && rowMatchesFocus(row, focus)
							? { focusRef: focusCardRef, isFocused: true }
							: {}

					// Champions Meetings and League of Heroes events share one card — they
					// carry the same data and are meant to look the same. Everything else
					// is a banner window, which may hold more than one concurrent banner.
					return row.kind === "race" ? (
						<RaceEventCard key={timelineRowKey(row)} event={row.event} today={today} />
					) : row.kind === "marker" ? (
						<EventMarkerCard key={timelineRowKey(row)} marker={row.marker} {...focusProps} />
					) : (
						<BannerWindowCard
							key={timelineRowKey(row)}
							group={row.group}
							today={today}
							plannedBannerKeys={plannedBannerKeys}
							stagedBanners={stagedBanners}
							onAddBanner={handleAddBanner}
							{...focusProps}
						/>
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
						) : timelineRows.length > 0 ? (
							<div className="mt-4 text-sm text-gray-500">
								That's all {timelineRows.length} events.
							</div>
						) : null}
					</>
				)}

				{/* Room to scroll a target that the list runs out beneath. Last, so
				    the reader sees the end-of-list line before the empty space, and
				    aria-hidden because there is nothing here to read. */}
				{focusNeedsTailroom && (
					<div aria-hidden="true" className={FOCUS_TAILROOM} />
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
