import type {
	ChampionsMeetingRank,
	ClubRank,
	TeamTrialsRank,
	UserPlannedBanner,
	UserStats,
	BannerUma,
	BannerSupport,
	BannerStepUp
} from "../../types"
import React from "react"
import { startOfDay } from "date-fns"
import Select from "react-select"
import type { SingleValue } from "react-select"
import { toast } from "sonner"
import { MLBChanceDisplay } from "./MLBChanceDisplay"
import { MobileBannerCard } from "./MobileBannerCard"
import { formatDate } from "../../utils/dateFormat"
import {
	bannerKey,
	bannerTargetFields,
	bannersForRowType,
	getFreePulls,
	getPullCountStatus,
	getReservedStatus,
	getStepCountStatus,
	isSelectableBanner,
	plannedBannerKey,
	plannedBannerRowType,
	plannedBannerTarget,
	plannedBannerTimeline,
} from "../../utils/bannerHelpers"
import type {
	BannerKey,
	BannerRowType,
	PlannableBanner,
} from "../../utils/bannerHelpers"
import { STEPS_PER_ROUND, stepUpCopyDistribution } from "../../utils/stepUpLadder"
import type { CalculationConstants } from "../../types/constants"
import type { BannerResources } from "../../hooks/bannerResources"
import { PULLS_PER_PITY_COPY } from "../../utils/probabilityCalculations"
import { compactSelectStyles, mobileBannerSelectStyles } from "../../utils/reactSelectStyles"
import { ExtraCardsBadge } from "./ExtraCardsBadge"
import { BannerTypeBadge } from "./BannerTypeBadge"

interface BannerRowProps {
	plannedBanner: UserPlannedBanner
	userStatsData: UserStats
	clubRankData: ClubRank[]
	teamTrialsRankData: TeamTrialsRank[]
	championsMeetingRankData: ChampionsMeetingRank[]
	userPlannedBannerData: UserPlannedBanner[]
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	stepUpBannerData: BannerStepUp[]
	/**
	 * Live calculation constants from the API. Passed rather than imported so an
	 * admin edit to the step-up ladder reaches the odds without a rebuild.
	 */
	constants: CalculationConstants
	/**
	 * This banner's projection snapshot (carats, max pulls, pull breakdown).
	 * Passed whole rather than as individual scalars so adding a stat to the
	 * derived-stats strip doesn't churn this signature every time.
	 */
	resources: BannerResources
	setUserPlannedBannerData: React.Dispatch<
		React.SetStateAction<UserPlannedBanner[]>
	>
	initialBannerType?: BannerRowType
}

interface BannerOption {
	value: PlannableBanner
	label: string
	key: number
}

export const BannerRow = ({
	plannedBanner,
	userPlannedBannerData,
	umaBannerData,
	supportBannerData,
	stepUpBannerData,
	constants,
	resources,
	setUserPlannedBannerData,
	initialBannerType
}: BannerRowProps) => {
	// The row's kind: from its FK when it has one, else the kind it was staged
	// as. Never sniffed inline — see plannedBannerRowType for why the old
	// `?? "Uma"` on the FK check was a latent bug.
	const target = plannedBannerTarget(plannedBanner)
	const bannerType: BannerRowType = plannedBannerRowType({
		...plannedBanner,
		initialBannerType: plannedBanner.initialBannerType ?? initialBannerType,
	})

	const isStepUp = bannerType === "StepUp"

	const targetBannerData = bannersForRowType(bannerType, {
		umaBannerData,
		supportBannerData,
		stepUpBannerData,
	})

	// Match within the type namespace only. targetBannerData is already scoped to
	// bannerType, and uma/support ids are independent — comparing against the
	// other type's id could resolve to an unrelated banner of the same number.
	const selectedBannerId = target.type === "Empty" ? undefined : target.banner.id
	const currentBanner = targetBannerData.find((banner) => banner.id === selectedBannerId)

	const currentDate = new Date()

	// The pull economics (free/paid carats, tickets, discounts) are computed
	// centrally in useBannerResources → applyPullStrategy; here we only apply the
	// "Passed" gate for banners that have already ended. The cutoff is the START
	// of today (local midnight), matching the projection's stable anchor — a
	// banner ending *today* is still active, so it shows an estimate.
	const bannerEndDateStr = plannedBannerTimeline(plannedBanner)?.end_date
	const bannerHasEnded =
		!!bannerEndDateStr &&
		new Date(bannerEndDateStr).getTime() < startOfDay(new Date()).getTime()

	const maxPossiblePulls: number | "Passed" = bannerHasEnded
		? "Passed"
		: resources.maxPossiblePulls

	// Round a *displayed* carat estimate DOWN to the nearest ten (ones place is
	// always 0, never a decimal). Flooring rather than rounding to nearest
	// avoids overstating: rounding 145 up to 150 would imply a pull is
	// affordable while "Max Pulls" (which floors 145/150 to 0) says it isn't.
	// Presentation-only — the raw balances still drive the max-pulls math, so
	// this never affects how many pulls are allowed. A passed banner shows 0:
	// its resources were spent or expired, so an estimate would be misleading.
	const toDisplayCarats = (carats: number): number =>
		maxPossiblePulls === "Passed" ? 0 : Math.floor(carats / 10) * 10

	const displayFreeCarats = toDisplayCarats(resources.freeCarats)
	const displayPaidCarats = toDisplayCarats(resources.paidCarats)

	// Ticket and paid-pull counts come straight from the strategy's breakdown
	// rather than being re-derived here: it already resolved which ticket type
	// matches this banner, and picking uma-vs-support again in the component
	// would be a second place to get the no-cross-substitution rule wrong.
	// Zeroed for a passed banner, mirroring the carat boxes above.
	const { tickets: ticketPulls, paidPulls } =
		maxPossiblePulls === "Passed"
			? { tickets: 0, paidPulls: 0 }
			: resources.maxPullBreakdown

	// Copies actually paid for, which is what the odds may credit. A passed
	// banner funds nothing, mirroring the zeroed carat boxes above.
	const reservedFunding =
		maxPossiblePulls === "Passed"
			? { selectors: 0, crystals: 0, unfunded: 0 }
			: resources.reservedFunding
	const fundedReservedCopies = reservedFunding.selectors + reservedFunding.crystals
	const reservedStatus = getReservedStatus(reservedFunding)

	const updateBannerInList = (
		updater: (banner: UserPlannedBanner) => UserPlannedBanner
	): UserPlannedBanner[] => {
		return userPlannedBannerData.map((mappedBannerData) => {
			const isMatch =
				(mappedBannerData.id !== undefined &&
					mappedBannerData.id === plannedBanner.id) ||
				(mappedBannerData.tempId !== undefined &&
					mappedBannerData.tempId === plannedBanner.tempId)
			return isMatch ? updater(mappedBannerData) : mappedBannerData
		})
	}

	/** Sort key: the row's start date, or last when it has no timeline yet. */
	const startTime = (b: UserPlannedBanner): number => {
		const start = plannedBannerTimeline(b)?.start_date
		return start ? new Date(start).getTime() : Infinity
	}

	const handleDeleteBannerClick = (): void => {
		const confirmed = window.confirm("Are you sure you want to delete this banner?")
		if (!confirmed) return
		const updated = userPlannedBannerData.filter(
			(b) =>
				b.tempId ? b.tempId !== plannedBanner.tempId : b.id !== plannedBanner.id
		)
		setUserPlannedBannerData(updated)
	}

	// Keys of banners already on the sheet, excluding this row's own current selection.
	// Keyed by type+id, never by bare id — uma and support banners have independent
	// primary keys, so a bare id would make an uma banner block its same-date
	// support counterpart (see plannedBannerKey).
	const alreadyPlannedBannerKeys = new Set(
		userPlannedBannerData
			.filter((b) => {
				const isCurrentRow =
					(b.id !== undefined && b.id === plannedBanner.id) ||
					(b.tempId !== undefined && b.tempId === plannedBanner.tempId)
				return !isCurrentRow
			})
			.map(plannedBannerKey)
			.filter((key): key is BannerKey => key !== null)
	)

	/** This row's select only ever offers banners of its own type. */
	const optionKey = (option: BannerOption): BannerKey =>
		bannerKey(bannerType, option.value.id)

	const handleBannerSelect = (option: SingleValue<BannerOption>): void => {
		if (!option) return
		if (alreadyPlannedBannerKeys.has(optionKey(option))) {
			toast.error("This banner is already on your sheet.")
			return
		}
		const updated = updateBannerInList((banner) => ({
			...banner,
			...bannerTargetFields(bannerType, option.value),
		}))
		// Rows with no resolvable timeline sort last instead of throwing; the
		// old non-null assertion crashed on any row that was neither uma nor
		// support.
		const sorted = updated.sort((a, b) => startTime(a) - startTime(b))
		setUserPlannedBannerData(sorted)
	}

	const handlePullCountChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
		// Sanitise to a whole, non-negative number of pulls. The floor matters:
		// a typed decimal like "2.5" would flow into getExactProbability (which
		// assumes integer trials) and into the carat deduction, corrupting both.
		//
		// Deliberately NOT capped at maxPossiblePulls. Planning past what you can
		// afford is a legitimate thing to want to see — applyPullStrategy turns
		// the shortfall into a negative carat balance that carries to later
		// banners, and pullStatus below surfaces it as a red field rather than
		// silently rewriting what the user typed.
		const parsed = Math.floor(Number(e.target.value))
		const nonNegative = Number.isFinite(parsed) ? Math.max(0, parsed) : 0

		const updated = updateBannerInList((banner) => ({
			...banner,
			number_of_pulls: nonNegative
		}))
		setUserPlannedBannerData(updated)
	}

	// A banner that has already ended can fund nothing, so its bound is 0 — any
	// leftover pulls on it correctly read as unachievable.
	const pullUpperBound = typeof maxPossiblePulls === "number" ? maxPossiblePulls : 0

	// The same "Passed" gate the pull column gets. A step-up row's engine fields
	// are optional (absent on every other kind), so the fallback is 0 rather
	// than a non-null assertion.
	const maxPossibleSteps: number | "Passed" = bannerHasEnded
		? "Passed"
		: resources.maxPossibleSteps ?? 0
	const stepUpperBound =
		typeof maxPossibleSteps === "number" ? maxPossibleSteps : 0

	// number_of_pulls carries STEPS on a step-up row — one column, two meanings,
	// deliberately (see the plan's decision record). Everything downstream reads
	// it through this pair rather than reaching for the field.
	const plannedCount = plannedBanner.number_of_pulls
	const countStatus = isStepUp
		? getStepCountStatus(plannedCount, stepUpperBound)
		: getPullCountStatus(plannedCount, pullUpperBound)

	const hasBanner = target.type !== "Empty"

	const freePulls = getFreePulls(plannedBanner)

	// A step-up has no featured cards — the player picks their own from the back
	// catalogue — so it contributes none here.
	const images =
		target.type === "Uma"
			? target.banner.umas
			: target.type === "Support"
			? target.banner.support_cards
			: []

	// The campaign's cutoff, folded onto the banner by the backend exactly as it
	// is onto a selector product. Read from there rather than joining
	// anniversary_event_data: one place resolves the cutoff, and it is the server.
	const stepUpCutoff =
		target.type === "StepUp" ? target.banner.jp_cutoff_date : null

	// Which pool the step-up draws from, in the game's own shorthand. Doubles as
	// the placeholder art until a campaign image is uploaded, so the row reads
	// correctly before Phase 6's content lands.
	const stepUpChip =
		target.type === "StepUp"
			? target.banner.card_type === "support"
				? "SSR"
				: "★3"
			: null

	// Why the row shows a cutoff at all: a step-up's candidates are back-catalogue
	// cards, so a user could otherwise plan one for a unit it could never offer.
	const stepUpCutoffHint = stepUpCutoff
		? `Choose from ${stepUpChip} cards released on JP by ${formatDate(stepUpCutoff)}`
		: "This campaign has no JP release cutoff on its candidates"

	/** The images cell, shared by the desktop grid and (via props) the card. */
	const imagesCell =
		target.type === "StepUp" ? (
			target.banner.image ? (
				<img
					src={target.banner.image}
					alt={target.banner.name}
					className="thumb-banner"
					title={stepUpCutoffHint}
				/>
			) : (
				// Typographic fallback so the cell is never blank before the art is
				// uploaded. The cutoff rides with it because this chip is exactly
				// the statement it qualifies: "★3 cards, released by this date".
				<div
					title={stepUpCutoffHint}
					className="flex flex-col items-center justify-center leading-none"
				>
					<span className="text-sm font-bold text-purple-300">{stepUpChip}</span>
					{stepUpCutoff && (
						<span className="mt-0.5 text-[9px] text-gray-400">
							≤ {formatDate(stepUpCutoff)}
						</span>
					)}
				</div>
			)
		) : (
			<>
				{images.slice(0, 2).map((img) => (
					<img
						key={img.name}
						src={img.image}
						alt={img.name}
						className={`thumb-banner ${bannerType === "Uma" ? "thumb-banner--uma" : ""}`}
					/>
				))}
				<ExtraCardsBadge hidden={images.length - 2} />
			</>
		)

	// A step-up's odds run on steps x 10 pulls at the pool rate, with a
	// guarantee per completed round — none of which the standard binomial over
	// `pulls` would get right. Built from chargeableSteps rather than the raw
	// input so the odds and the carat deduction agree about how many steps
	// happened. See stepUpCopyDistribution.
	const stepUpOdds = isStepUp
		? stepUpCopyDistribution(resources.chargeableSteps ?? 0, constants)
		: undefined

	const bannerTimeline = plannedBannerTimeline(plannedBanner)

	const renderBannerSelect = (styles: import("react-select").StylesConfig<BannerOption, false>) => (
		<Select<BannerOption>
			className="w-full"
			styles={{
				...styles,
				menuPortal: (base) => ({ ...base, zIndex: 9999 })
			}}
			menuPortalTarget={document.body}
			menuPosition="fixed"
			placeholder={isStepUp ? "Target Step-Up Campaign" : `Target ${bannerType} Banner`}
			value={
				currentBanner
					? { value: currentBanner, label: currentBanner.name, key: currentBanner.id }
					: null
			}
			onChange={handleBannerSelect}
			formatOptionLabel={(option) => (
				<span className={alreadyPlannedBannerKeys.has(optionKey(option)) ? "text-gray-500" : ""}>
					{option.label}
					{alreadyPlannedBannerKeys.has(optionKey(option)) && (
						<span className="ml-1 text-xs">(on sheet)</span>
					)}
				</span>
			)}
			options={targetBannerData
				.filter((banner) => isSelectableBanner(banner, currentDate))
				.map((banner) => ({
					value: banner,
					label: banner.name,
					key: banner.id
				}))}
		/>
	)

	const bannerSelect = renderBannerSelect(
		compactSelectStyles as import("react-select").StylesConfig<BannerOption, false>
	)
	const mobileBannerSelect = renderBannerSelect(
		mobileBannerSelectStyles as import("react-select").StylesConfig<BannerOption, false>
	)

	const dateDisplay = bannerTimeline ? (
		<div className="flex flex-col gap-0.5">
			<div className="grid grid-cols-[max-content_max-content] gap-x-3 text-xs text-gray-400 sm:gap-x-10 sm:text-sm">
				<div>Start: <span className="text-gray-100">{formatDate(bannerTimeline.start_date)}</span></div>
				<div>End: <span className="text-gray-100">{formatDate(bannerTimeline.end_date)}</span></div>
			</div>
			{isStepUp && stepUpCutoff && (
				// Phone cards have vertical room the h-16 desktop track does not, so
				// the cutoff is spelled out here and rides the images chip there.
				<div className="text-xs text-gray-400" title={stepUpCutoffHint}>
					JP cutoff: <span className="text-gray-100">{formatDate(stepUpCutoff)}</span>
				</div>
			)}
		</div>
	) : (
		<span className="text-xs text-gray-600">—</span>
	)

	// Single source of truth for the derived-stats strip. Both the mobile card
	// and the desktop grid render from this list, so a stat is added or reworded
	// in ONE place — two hand-synced copies of the same boxes is exactly the
	// drift that leaves one layout a stat behind the other.
	// Labels follow the source spreadsheet this calculator is modelled on
	// ("Carat Est.", "Paid Carat Est.", "Free/Tickets/Paid"), so users coming
	// from the sheet read the same vocabulary. `title` carries the long form.
	//
	// Two of the four boxes say something different on a step-up row. That is how
	// the source sheet's header swaps (Max Pulls→Max Steps, Misc Pulls→Step #)
	// are honoured without touching the shared header: our headers are global to
	// the table, but this strip is per row, so the relabel lands exactly where
	// the meaning changes. Same four boxes, same widths —
	// --container-banner-table does not move. See frontend/docs/ui-conventions.md.
	const derivedStats: {
		label: string
		value: string
		title: string
		valueClass?: string
	}[] = [
		isStepUp
			? {
					label: "Step #",
					// Where this plan reaches on the ladder. "5x2-3" is two completed
					// banners plus three steps into a third.
					value: resources.stepLabel ?? "0",
					title: "How far up the ladder this plan reaches. 5xN means N completed banners; a trailing -r is r steps into the next one",
			  }
			: {
					// Unspaced slashes, matching formatDate's a/b/c. No thousands separators
					// here — these are small counts and commas would collide with the slashes.
					label: "Free/Tickets/Paid",
					value: `${freePulls || 0}/${ticketPulls}/${paidPulls}`,
					title: "Pulls you don't pay free carats for: the banner's free pulls, matching tickets, and pulls funded by paid carats",
			  },
		{
			label: "Carat Est.",
			value: displayFreeCarats.toLocaleString(),
			title: "Estimated free (earned) carats available for this banner",
			valueClass: "text-brand",
		},
		{
			label: "Paid Carat Est.",
			value: displayPaidCarats.toLocaleString(),
			title: "Estimated paid (purchased) carats available for this banner",
			valueClass: "text-brand",
		},
		isStepUp
			? {
					label: "Max Steps",
					value: String(maxPossibleSteps),
					title: "The most steps you could climb here — whichever runs out first, your paid carats or the campaign's banners",
			  }
			: {
					label: "Max Pulls",
					value: String(maxPossiblePulls),
					title: "The most pulls this banner could support if every available resource went into it",
			  },
	]

	const mobileStatCell = (stat: typeof derivedStats[number], index: number) => (
		<div
			key={stat.label}
			title={stat.title}
			className={`flex flex-col items-center justify-center px-2 py-2${index % 2 === 0 ? " border-r border-gray-600" : ""}${index < 2 ? " border-b border-gray-600" : ""}`}
		>
			<span className="banner-stat-box-label">{stat.label}</span>
			<span className={`banner-stat-box-value ${stat.valueClass ?? ""}`}>{stat.value}</span>
		</div>
	)

	// Phone cards use a true 2x2 estimate grid, so "Paid Carat Est." and
	// "Max Pulls" share the second row. Once the card is wide enough, the
	// reference-style three-across strip returns and shares its lower row with
	// the odds display.
	const statsDisplay = (
		<div className="overflow-hidden rounded-lg border border-gray-600 bg-gray-700">
			<div className="sm:hidden">
				<div className="grid grid-cols-2">
					{derivedStats.map(mobileStatCell)}
				</div>
				<div className="border-t border-gray-600 p-2">
					{hasBanner ? (
						<MLBChanceDisplay pulls={plannedCount} plannedBanner={plannedBanner} reservedCopies={fundedReservedCopies} distribution={stepUpOdds} />
					) : (
						<div className="py-3 text-center text-xs text-gray-500">Select a banner</div>
					)}
				</div>
			</div>
			<div className="hidden sm:block">
				<div className="grid grid-cols-3 divide-x divide-gray-600">
					{derivedStats.slice(0, 3).map((stat) => (
						<div key={stat.label} title={stat.title} className="flex flex-col items-center justify-center px-2 py-2">
						<span className="banner-stat-box-label">{stat.label}</span>
						<span className={`banner-stat-box-value ${stat.valueClass ?? ""}`}>{stat.value}</span>
					</div>
				))}
				</div>
				<div className="grid grid-cols-3 border-t border-gray-600">
					<div title={derivedStats[3].title} className="flex flex-col items-center justify-center border-r border-gray-600 px-2 py-2">
						<span className="banner-stat-box-label">{derivedStats[3].label}</span>
						<span className={`banner-stat-box-value ${derivedStats[3].valueClass ?? ""}`}>{derivedStats[3].value}</span>
					</div>
					<div className="col-span-2 p-2">
						{hasBanner ? (
							<MLBChanceDisplay pulls={plannedCount} plannedBanner={plannedBanner} reservedCopies={fundedReservedCopies} distribution={stepUpOdds} />
						) : (
							<div className="py-3 text-center text-xs text-gray-500">Select a banner</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)

	// WCAG 1.4.1 — color can't be the only carrier of this state. The same
	// information goes out as a tooltip and, for the failure case, as
	// aria-invalid, so it survives colorblindness and screen readers.
	//
	// Both kinds say the same three things — unaffordable, cleanly completed,
	// or stranded part-way — about different units, so the wording is per kind
	// while the states are shared.
	const countStatusHint = isStepUp
		? countStatus === "over"
			? `More steps than you can afford here (max ${stepUpperBound})`
			: countStatus === "ok"
			? "A completed ladder — every carat bought a full banner, guarantee included"
			: `Stops part-way up a ladder (${STEPS_PER_ROUND} steps complete one)`
		: countStatus === "over"
		? `More pulls than you can afford here (max ${pullUpperBound})`
		: countStatus === "ok"
		? "On a pity threshold — no carats stranded in a partial counter"
		: `Not on a pity threshold (a multiple of ${PULLS_PER_PITY_COPY} pulls)`

	const countLabel = isStepUp ? "Number of steps" : "Number of pulls"

	const handleReservedChange = (
		event: React.ChangeEvent<HTMLInputElement>
	): void => {
		// Floored and non-negative like the pull input, and deliberately NOT
		// capped at what's affordable — an over-reserve is shown, not prevented.
		const parsed = Math.max(0, Math.floor(Number(event.target.value) || 0))
		setUserPlannedBannerData(
			updateBannerInList((banner) => ({ ...banner, reserved_copies: parsed }))
		)
	}

	// WCAG 1.4.1 again — the red state also travels as a tooltip and aria-invalid.
	const reservedHint =
		reservedStatus === "over"
			? `${reservedFunding.unfunded} more ${
					reservedFunding.unfunded === 1 ? "copy" : "copies"
				} than you have selectors or crystals for`
			: fundedReservedCopies > 0
			? `${reservedFunding.selectors} from selectors, ${reservedFunding.crystals} from SSR crystals`
			: bannerType === "Uma"
			? "Copies taken with an uma selector instead of pulling"
			: "Copies taken with a support selector or SSR crystal instead of pulling"

	const pullsInput = (
		<input
			type="number"
			value={plannedCount}
			className={`spin-arrows pull-input pull-input--${countStatus} w-20`}
			min={0}
			title={countStatusHint}
			aria-label={countLabel}
			aria-invalid={countStatus === "over"}
			onChange={handlePullCountChange}
		/>
	)
	// Parameterised by width rather than written out twice: the mobile card and
	// the desktop cell differ only in how wide they are, and the five attributes
	// that carry this field's state (status class, title, aria-label,
	// aria-invalid, disabled) must never drift between the two copies. Same
	// factory shape as renderBannerSelect above.
	const renderReservedInput = (widthClass: string) => (
		<div className={`flex ${widthClass} flex-col items-center gap-0.5`}>
			<input
				type="number"
				value={plannedBanner.reserved_copies}
				className={`spin-arrows pull-input pull-input--${reservedStatus} ${widthClass}`}
				min={0}
				title={reservedHint}
				aria-label="Copies obtained without pulling"
				aria-invalid={reservedStatus === "over"}
				disabled={!hasBanner}
				onChange={handleReservedChange}
			/>
			{plannedBanner.reserved_copies > 0 && (
				// Abbreviated to fit the 5rem track. Widening it would push
				// --container-banner-table past the ceiling documented in
				// frontend/docs/ui-conventions.md, moving the card/table switch
				// point later for everyone. The full wording is in the title,
				// which this shares with the input.
				<span
					title={reservedHint}
					className={`text-[10px] leading-tight ${
						reservedStatus === "over" ? "text-red-400" : "text-gray-400"
					}`}
				>
					{reservedStatus === "over"
						? `${fundedReservedCopies}/${plannedBanner.reserved_copies}`
						: `${reservedFunding.selectors}s ${reservedFunding.crystals}c`}
				</span>
			)}
		</div>
	)

	return (
		<>
		<MobileBannerCard
			bannerType={bannerType}
			images={images}
			imagesSlot={isStepUp ? imagesCell : undefined}
			bannerSelect={mobileBannerSelect}
			dates={dateDisplay}
			summary={statsDisplay}
			pullsInput={pullsInput}
			reservedInput={renderReservedInput("w-20")}
			chanceDisplay={null}
			onRemove={handleDeleteBannerClick}
			removeLabel="Delete banner"
		/>

		{/* Column widths come from .banner-grid (App.css), shared with the header
		    row and StagedBannerRow — never re-declare a width on a cell here. */}
		<div className="banner-grid hidden w-full items-stretch bg-gray-800 h-16 @banner-table:grid">
			{/* === Type badge (square block on left) === */}
			<BannerTypeBadge type={bannerType} />

			{/* === Images section === */}
			<div className="relative flex items-center justify-center gap-1.5 py-1 px-1">
				{imagesCell}
			</div>

			{/* === Banner select === */}
			<div className="flex items-center justify-center py-2 px-2">
				{bannerSelect}
			</div>

			{/* === Start / End Date === */}
			<div className="flex min-w-0 flex-col items-start justify-center gap-0.5 py-2 px-1 text-xs text-gray-400 relative">
				<div className="absolute right-0 top-3 bottom-3 w-px bg-gray-700" />
				{bannerTimeline ? (
					<>
						<span>Start: <span className="text-gray-100">{formatDate(bannerTimeline.start_date)}</span></span>
						<span>End: <span className="text-gray-100">{formatDate(bannerTimeline.end_date)}</span></span>
					</>
				) : (
					<span className="text-gray-600">—</span>
				)}
			</div>

			{/* === Derived Stats section === */}
			{/* px-1 and compact stat padding keep the four boxes within this tighter
			    track without clipping their labels. */}
			<div className="flex min-w-0 items-center justify-center px-1 py-2">
				{/* Same `derivedStats` list as the mobile card above — one strip
				    instead of 2x2, with rule dividers between the boxes. */}
				<div className="flex items-stretch rounded-lg bg-gray-700 border border-gray-600 overflow-hidden w-full">
					{derivedStats.map((stat, statIndex) => (
						<React.Fragment key={stat.label}>
							{statIndex > 0 && <div className="w-px bg-gray-600 self-stretch" />}
							<div title={stat.title} className="flex flex-col items-center justify-center px-1 py-1.5 flex-1">
								<span className="banner-stat-box-label">{stat.label}</span>
								<span className={`banner-stat-box-value ${stat.valueClass ?? ""}`}>{stat.value}</span>
							</div>
						</React.Fragment>
					))}
				</div>
			</div>

			{/* === # Pulls section === */}
			<div className="flex items-center justify-center py-2 px-1 relative">
				<div className="absolute left-0 top-3 bottom-3 w-px bg-gray-700" />
				<div className="absolute right-0 top-3 bottom-3 w-px bg-gray-700" />
				<input
					type="number"
					value={plannedCount}
					className={`spin-arrows pull-input pull-input--${countStatus} w-14`}
					min={0}
					title={countStatusHint}
					aria-label={countLabel}
					aria-invalid={countStatus === "over"}
					onChange={handlePullCountChange}
				/>
			</div>

			{/* === Reserved copies === */}
			{/* py-1, not the py-2 its neighbours use. The input (h-9) plus the
			    funding hint below it need 50.5px, and py-2 leaves only 48px
			    inside this h-16 row — the hint would clip. Widening the track
			    instead is not an option; see the ceiling on
			    --container-banner-table in frontend/docs/ui-conventions.md. */}
			<div className="flex items-center justify-center py-1 px-1 relative">
				<div className="absolute right-0 top-3 bottom-3 w-px bg-gray-700" />
				{renderReservedInput("w-14")}
			</div>

			{/* === MLB chance grid === */}
			<div className="flex items-center justify-center py-2 px-2 min-w-0">
				{hasBanner ? (
					<MLBChanceDisplay
						pulls={plannedCount}
						plannedBanner={plannedBanner}
						reservedCopies={fundedReservedCopies}
						distribution={stepUpOdds}
					/>
				) : (
					<div className="w-full text-center text-xs text-gray-500">Select a banner</div>
				)}
			</div>

			{/* === Delete button === */}
			<button onClick={handleDeleteBannerClick} className="banner-delete-btn">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
					<polyline points="3 6 5 6 21 6" />
					<path d="M19 6l-1 14H6L5 6" />
					<path d="M10 11v6" />
					<path d="M14 11v6" />
					<path d="M9 6V4h6v2" />
				</svg>
			</button>
		</div>
		</>
	)
}
