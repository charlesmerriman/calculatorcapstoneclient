import type {
	BannerStepUp,
	BannerSupport,
	BannerUma,
	UserStepUpSelection
} from "../types"

/**
 * The ten cards a player picks before climbing a Select Step-Up's ladder.
 *
 * Pure slot bookkeeping, deliberately free of React so the rules can be tested
 * directly. NOTHING HERE FEEDS THE PROJECTION — the step-up target rate is
 * 3% / 10 and holds whichever ten are chosen, so none of these functions can
 * move a carat total. See utils/stepUpLadder.ts for the part that does.
 */

/**
 * Fixed by the game, and NOT a tunable.
 *
 * `step_up_target_rate` IS 3% / 10 — the pool rate split across the ten cards
 * you named. Changing this number without changing that one would silently make
 * the odds wrong, which is why the projection reads the rate from the API and
 * never derives it from how many slots are actually filled. A partial selection
 * is an unfinished plan, not a narrower pool.
 */
export const SELECTION_SLOTS = 10

/** Which catalogue a step-up draws from, in the catalogue hook's vocabulary. */
export function poolFor(stepUp: BannerStepUp): "uma" | "support" {
	return stepUp.card_type === "uma" ? "uma" : "support"
}

/** This user's selections for one step-up, in slot order. */
export function selectionsForStepUp(
	all: UserStepUpSelection[],
	stepUpId: number
): UserStepUpSelection[] {
	return all
		.filter((selection) => selection.banner_step_up === stepUpId)
		.sort((a, b) => a.slot - b.slot)
}

/**
 * The ten slots as a dense array, `null` where nothing is chosen.
 *
 * An empty slot is an ABSENT row on the server, never a row with no card — the
 * exactly_one_selection_card constraint refuses the latter. This is where that
 * sparse storage becomes the dense grid the UI draws.
 */
export function slotView(
	selections: UserStepUpSelection[]
): (UserStepUpSelection | null)[] {
	const slots: (UserStepUpSelection | null)[] = Array(SELECTION_SLOTS).fill(null)
	for (const selection of selections) {
		const index = selection.slot - 1
		if (index >= 0 && index < SELECTION_SLOTS) slots[index] = selection
	}
	return slots
}

/** The card id in each filled slot — what the candidate grid checks against. */
export function selectedCardIds(selections: UserStepUpSelection[]): Set<number> {
	const ids = new Set<number>()
	for (const selection of selections) {
		const cardId = selection.uma ?? selection.support
		if (cardId !== null && cardId !== undefined) ids.add(cardId)
	}
	return ids
}

/** The step 5 pick, or null if the user hasn't named one. */
export function targetOf(
	selections: UserStepUpSelection[]
): UserStepUpSelection | null {
	return selections.find((selection) => selection.is_target) ?? null
}

/** The card id a selection holds, whichever pool it came from. */
export function cardIdOf(selection: UserStepUpSelection): number | null {
	return selection.uma ?? selection.support ?? null
}

/** The lowest unoccupied slot number, or null when all ten are taken. */
function lowestFreeSlot(selections: UserStepUpSelection[]): number | null {
	const taken = new Set(selections.map((selection) => selection.slot))
	for (let slot = 1; slot <= SELECTION_SLOTS; slot += 1) {
		if (!taken.has(slot)) return slot
	}
	return null
}

/**
 * Add a card if it isn't chosen, remove it if it is.
 *
 * Adding fills the LOWEST free slot rather than appending, so clearing slot 3
 * and picking again reuses 3 instead of drifting the grid rightwards. A full
 * selection returns unchanged — the caller shows the n/10 counter, and silently
 * evicting someone's earlier pick to make room would be worse than doing nothing.
 *
 * Removing the step 5 pick simply leaves the plan without one rather than
 * promoting a neighbour: which card you'd guarantee is a real decision, and
 * guessing it on the user's behalf is how a plan quietly stops meaning what
 * they think it means.
 */
export function toggleCard(
	selections: UserStepUpSelection[],
	stepUp: BannerStepUp,
	cardId: number
): UserStepUpSelection[] {
	const existing = selections.find((selection) => cardIdOf(selection) === cardId)
	if (existing) {
		return selections.filter((selection) => selection !== existing)
	}

	const slot = lowestFreeSlot(selections)
	if (slot === null) return selections

	const isUma = poolFor(stepUp) === "uma"
	return [
		...selections,
		{
			banner_step_up: stepUp.id,
			uma: isUma ? cardId : null,
			support: isUma ? null : cardId,
			slot,
			is_target: false,
		},
	].sort((a, b) => a.slot - b.slot)
}

/** Empty one slot, leaving the others where they are. */
export function clearSlot(
	selections: UserStepUpSelection[],
	slot: number
): UserStepUpSelection[] {
	return selections.filter((selection) => selection.slot !== slot)
}

/**
 * Move the step 5 marker onto one slot.
 *
 * Naming the same slot again clears it, so the marker is a toggle — there is no
 * other way to say "I haven't decided" once one has been set. At most one row
 * may carry it, which the server enforces with a partial unique index.
 */
export function setTarget(
	selections: UserStepUpSelection[],
	slot: number
): UserStepUpSelection[] {
	const alreadyTarget = selections.some(
		(selection) => selection.slot === slot && selection.is_target
	)
	return selections.map((selection) => ({
		...selection,
		is_target: !alreadyTarget && selection.slot === slot,
	}))
}

/**
 * Replace one step-up's selections inside the whole-account collection.
 *
 * The provider holds every step-up's selections in one flat array (it maps 1:1
 * onto the PATCH collection), while each picker only ever edits its own.
 */
export function replaceSelectionsFor(
	all: UserStepUpSelection[],
	stepUpId: number,
	next: UserStepUpSelection[]
): UserStepUpSelection[] {
	return [
		...all.filter((selection) => selection.banner_step_up !== stepUpId),
		...next,
	]
}

/** Just enough of a card to render it. */
export interface SelectedCardArt {
	name: string
	image: string
}

/**
 * The art for the step 5 pick, or null when the user hasn't named one.
 *
 * What the planner row's image cell shows: once you've said which copy you'd
 * guarantee, that card IS what the row is about. Only the guaranteed one, not
 * all ten — the other nine are candidates for random guarantees, and ten faces
 * in a 64px cell would say nothing.
 *
 * DELIBERATELY NOT FILTERED BY THE CUTOFF, unlike useEligibleCardCatalogue. A
 * pick that a later cutoff correction put out of reach should keep rendering
 * rather than blink out of the planner; the picker is where staleness is
 * flagged, and this is only a thumbnail.
 */
export function findGuaranteedCardArt(
	selections: UserStepUpSelection[],
	umaBannerData: BannerUma[],
	supportBannerData: BannerSupport[]
): SelectedCardArt | null {
	const target = targetOf(selections)
	if (!target) return null

	if (target.uma !== null && target.uma !== undefined) {
		for (const banner of umaBannerData) {
			const uma = banner.umas.find((candidate) => candidate.id === target.uma)
			if (uma) return { name: uma.name, image: uma.image }
		}
		return null
	}
	for (const banner of supportBannerData) {
		const card = banner.support_cards.find(
			(candidate) => candidate.id === target.support
		)
		if (card) return { name: card.name, image: card.image }
	}
	return null
}
