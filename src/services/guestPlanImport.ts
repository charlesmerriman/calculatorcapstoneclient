/**
 * Signing in on a device that has a guest plan: move that plan into the account.
 *
 * Runs once per load, from CalculatorProvider, on the raw /calculator-data
 * payload and BEFORE any state is set, so auto-save cannot race it.
 *
 * WHAT GOES WHERE. "A plan holds choices, the account holds facts" decides it:
 *
 *   | The account                    | Rows                      | Stats, purchases | Step-up picks    |
 *   |--------------------------------|---------------------------|------------------|------------------|
 *   | is empty (new sign-up)         | into its one plan         | the guest's      | the guest's      |
 *   | has data                       | a NEW plan, not opened    | the account's    | merged per banner|
 *   | has data and PLAN_CAP plans    | left on the device        | the account's    | the account's    |
 *
 * The middle row is the reason this file exists. The old rule appended the
 * guest's rows to the active plan and let edited guest stats overwrite the
 * account's. That was fine for a stash at most an hour old that the person had
 * just asked to save. A plan kept on a device can be weeks old:
 *
 *   Sep 1   plans on a work PC as a guest: 5,000 carats, 4 rows
 *   Sep 30  the account, used at home all month, says 41,000 carats, 9 rows
 *   Oct 1   signs in on the work PC
 *
 * Appending would add 4 stale rows (some duplicating the 9) and set the
 * account back to 5,000 carats. Rows are choices and can sit in a plan of their
 * own without changing a number anywhere else; stats are facts, and the
 * account's are the ones the person has been keeping up to date.
 *
 * THE DEVICE COPY OUTLIVES A FAILURE. It is cleared only once the server has
 * confirmed. A 5xx or a dropped connection keeps it for the next load; a 4xx
 * (the server refused the body) keeps it too but marks it so it is not offered
 * again until the guest changes it. See GuestPlan.importBlocked.
 */

import { toast } from "sonner"
import type { CalculatorData, PlanWithRows } from "../types"
import { PLAN_CAP } from "../types/plan"
import {
	initialCalculatorDataFetch,
	toBannerPayload,
	toPurchasePayload,
	toStepUpSelectionPayload,
	userCalculatorDataPatch
} from "./calculatorFetchCalls"
import {
	clearGuestPlanStash,
	mergeStepUpSelections,
	readGuestPlanStash,
	statsAreDirty
} from "./guestMigration"
import {
	blockGuestPlanImport,
	clearGuestPlan,
	guestPlanToState,
	readGuestPlan,
	type GuestPlan
} from "./guestPlanStore"
import { planCreate, planDelete } from "./planFetchCalls"

/** The name the device's rows arrive under when the account already has a plan. */
export const IMPORTED_PLAN_NAME = "From this device"

// One notice per tab session when the account has no free plan slot. The
// import is retried on every load (the person may have deleted a plan since),
// and a toast on every one of those loads would be nagging.
const CAP_NOTICE_KEY = "guestPlanCapNotice"

function capNoticeAlreadyShown(): boolean {
	try {
		if (sessionStorage.getItem(CAP_NOTICE_KEY)) return true
		sessionStorage.setItem(CAP_NOTICE_KEY, "1")
		return false
	} catch {
		return false
	}
}

/**
 * A stash written by the bundle before this one, as a GuestPlan.
 *
 * TRANSITIONAL, one release: someone who pressed "Sign in to save" on the old
 * bundle and came back from the provider's consent screen onto this one has
 * their plan in sessionStorage and nowhere else. Delete this, and
 * guestMigration.ts's stash functions, once that release has shipped.
 */
function legacyStashAsPlan(): GuestPlan | null {
	const stash = readGuestPlanStash()
	if (!stash) return null
	return {
		version: 1,
		savedAt: stash.createdAt,
		stats: stash.stats,
		banners: stash.banners,
		purchases: stash.purchases ?? [],
		stepUpSelections: stash.stepUpSelections ?? []
	}
}

/**
 * Import the device's plan, if there is one, and return the payload the
 * provider should render: re-fetched after a successful import so the new rows
 * carry real ids, otherwise `data` as it was given.
 *
 * Never throws for a failed import; it toasts and returns `data`. It rethrows
 * only an AbortError, which is the provider's own cleanup cancelling the load.
 */
export async function importGuestPlan(
	data: CalculatorData,
	signal: AbortSignal
): Promise<CalculatorData> {
	const devicePlan = readGuestPlan()
	const source = devicePlan ?? legacyStashAsPlan()
	if (!source || source.importBlocked) return data

	const forget = (): void => {
		clearGuestPlan()
		clearGuestPlanStash()
	}

	// Through guestPlanToState and back out: that is what drops a row whose
	// banner or product has left the catalogue since it was stored. One id the
	// server does not know would 400 the whole body.
	const state = guestPlanToState(source, data)
	const stats = statsAreDirty(state.stats) ? state.stats : null
	const banners = toBannerPayload(state.banners)
	const purchases = toPurchasePayload(state.purchases)
	const selections = toStepUpSelectionPayload(state.stepUpSelections)
	if (!stats && banners.length === 0 && purchases.length === 0 && selections.length === 0) {
		forget()
		return data
	}

	const accountSelections = toStepUpSelectionPayload(data.user_step_up_selection_data ?? [])
	const accountPurchases = data.user_planned_purchase_data ?? []
	const accountPlans = data.user_plans ?? []
	const activePlanId = data.active_plan_id ?? null
	// "Empty" is judged on what a person would miss: rows and purchases. Stats
	// are left out on purpose. Comparing them against the guest defaults would
	// send a brand-new account down the "has data" path the day a server
	// default and DEFAULT_GUEST_STATS drift apart.
	const accountIsEmpty =
		accountPlans.length <= 1 &&
		data.user_planned_banner_data.length === 0 &&
		accountPurchases.length === 0

	let createdPlanId: number | null = null
	let successMessage = "Your plan from this device is now saved to your account."
	try {
		let response: Response
		if (accountIsEmpty || activePlanId === null) {
			// Everything the guest built, into the account's one plan. The
			// account's own rows are resent WITH their ids because the server
			// deletes whatever a body omits. (`activePlanId === null` is an API
			// from before plans existed: one plan, nothing else to choose.)
			response = await userCalculatorDataPatch(
				activePlanId,
				stats,
				[...toBannerPayload(data.user_planned_banner_data), ...banners],
				[...toPurchasePayload(accountPurchases), ...purchases],
				// Per step-up, not concatenated: two partial selections for one
				// banner collide on the unique slot index and 400 the lot.
				mergeStepUpSelections(accountSelections, selections)
			)
		} else if (banners.length === 0) {
			// Only facts on the device, and the account's facts win. The picks
			// are the one thing still worth carrying: they change no number and
			// only fill banners the account has none for.
			if (selections.length === 0) {
				forget()
				return data
			}
			response = await userCalculatorDataPatch(
				activePlanId,
				null,
				null,
				null,
				mergeStepUpSelections(accountSelections, selections)
			)
			successMessage = ""
		} else if (accountPlans.length >= PLAN_CAP) {
			if (!capNoticeAlreadyShown()) {
				toast.error(
					`There is a plan on this device, but your account already has ${PLAN_CAP} plans. Delete one and reload to bring it in.`
				)
			}
			return data
		} else {
			const created = await planCreate(IMPORTED_PLAN_NAME)
			if (created.ok) {
				createdPlanId = ((await created.json()) as PlanWithRows).plan.id
				// Stats and purchases are OMITTED, not sent empty: the purchases
				// in `data` are the ACTIVE plan's (which may read its own stats
				// block), not this new plan's, so resending them here could
				// write one block's purchases over another's.
				response = await userCalculatorDataPatch(
					createdPlanId,
					null,
					banners,
					null,
					selections.length > 0
						? mergeStepUpSelections(accountSelections, selections)
						: null
				)
				successMessage = `We added the plan from this device to your account. It is in your plans as "${IMPORTED_PLAN_NAME}".`
			} else {
				response = created
			}
		}

		if (response.ok) {
			forget()
			if (successMessage) toast.success(successMessage)
			// Re-fetch so the imported rows come back with real database ids
			// and the new plan is in the plan list.
			const refreshed = await initialCalculatorDataFetch(signal)
			return refreshed.ok ? ((await refreshed.json()) as CalculatorData) : data
		}

		// The plan was created but its rows were refused. Left alone it would
		// be an empty "From this device" tab, and one more on every retry.
		if (createdPlanId !== null) await planDelete(createdPlanId).catch(() => undefined)

		if (response.status < 500) {
			// 4xx: the same body would fail on every load. Keep the plan on the
			// device, stop offering it. A legacy stash has no such flag and an
			// hour to live, so it is dropped as it always was.
			if (devicePlan) blockGuestPlanImport()
			else clearGuestPlanStash()
			toast.error(
				"Couldn't add the plan from this device to your account. It is still here when you sign out."
			)
		} else {
			toast.error("Couldn't add the plan from this device right now. We'll try again on your next visit.")
		}
	} catch (error: unknown) {
		if (error instanceof Error && error.name === "AbortError") throw error
		if (createdPlanId !== null) await planDelete(createdPlanId).catch(() => undefined)
		toast.error("Couldn't add the plan from this device right now. We'll try again on your next visit.")
	}
	return data
}
