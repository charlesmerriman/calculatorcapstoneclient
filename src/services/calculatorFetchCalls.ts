/**
 * API fetch calls for calculator data.
 *
 * TYPESCRIPT CONCEPT: Typing API Boundaries
 *
 * API calls are where type safety matters most, because they're where
 * your app meets the outside world. The data coming back from fetch()
 * is untyped — TypeScript has no way to verify the server actually
 * returns what you say it does.
 *
 * We handle this in two ways:
 * 1. Type the PARAMETERS going out (so we don't send garbage to the server)
 * 2. Type the RESPONSE with CalculatorData (so the rest of the app has types)
 *
 * The response typing is technically a "trust me" assertion — if the server
 * changes its response shape, TypeScript won't catch it. For stronger
 * guarantees, you'd use a runtime validator like Zod. But for a project
 * where you control both ends, this is standard practice.
 */

import { plannedBannerTarget } from "../utils/bannerHelpers"
import type { UserStats, UserPlannedBanner, UserPlannedPurchase } from "../types"

const API_URL = import.meta.env.VITE_API_URL

/**
 * The shape of each planned banner when sent TO the server.
 * Note this differs from UserPlannedBanner — when sending data,
 * we only send the FK ids (number | null), not the full nested objects.
 *
 * TYPESCRIPT CONCEPT: Separate Types for Request vs Response
 * The server sends us full nested objects (BannerUma with all fields),
 * but we send back just the id. These are different shapes, so they
 * deserve different types. Don't try to make one type serve both roles.
 */
export interface PlannedBannerPayload {
	id?: number
	number_of_pulls: number
	reserved_copies: number
	banner_uma: number | null
	banner_support: number | null
	banner_step_up: number | null
}

/**
 * A planned purchase on the way out. Closer to its response shape than planned
 * banners are to theirs — the server already sends `product` as an id, because
 * the client holds the whole campaign catalogue and joins on it.
 */
export interface PlannedPurchasePayload {
	id?: number
	product: number
	quantity: number
	target_uma: number | null
	target_support: number | null
}

/**
 * Builds the Authorization header only when a token exists. Guests send
 * no header at all — sending "Token null" would make the backend 401.
 */
function authHeaders(): Record<string, string> {
	const token = localStorage.getItem("authToken")
	return token ? { Authorization: `Token ${token}` } : {}
}

/**
 * Converts planned banners from response shape (nested objects) to request
 * shape (FK ids), dropping client-only fields (tempId) and empty rows.
 *
 * A pure function rather than provider-internal logic because the guest
 * migration flow needs to run it on data that isn't in React state yet
 * (banners fresh off the GET response). Saved banners keep their `id` —
 * that's what tells the PATCH endpoint to preserve rather than delete them.
 */
export function toBannerPayload(
	banners: UserPlannedBanner[]
): PlannedBannerPayload[] {
	return banners
		// Rows with no banner chosen yet are dropped — the server requires
		// exactly one target. Asked through the shared helper rather than by
		// listing the FKs here: a row whose kind this file did not know about
		// failed the old two-FK test and was silently discarded from EVERY save
		// path (autosave, the Navbar save, guest migration), so the row worked
		// perfectly until the next reload and then vanished.
		.filter((plannedBanner) => plannedBannerTarget(plannedBanner).type !== "Empty")
		.map((plannedBanner) => {
			const { tempId: _tempId, ...rest } = plannedBanner
			const target = plannedBannerTarget(plannedBanner)
			return {
				...rest,
				banner_uma: target.type === "Uma" ? target.banner.id : null,
				banner_support: target.type === "Support" ? target.banner.id : null,
				banner_step_up: target.type === "StepUp" ? target.banner.id : null,
			}
		})
}

/**
 * Same conversion for planned purchases. Rows whose product has gone away are
 * dropped rather than sent — the server would reject the whole PATCH, taking
 * the rest of the user's plan down with it.
 */
export function toPurchasePayload(
	purchases: UserPlannedPurchase[]
): PlannedPurchasePayload[] {
	return purchases
		.filter((purchase) => purchase.product && purchase.quantity > 0)
		.map((purchase) => {
			const { tempId: _tempId, ...rest } = purchase
			return {
				...rest,
				target_uma: purchase.target_uma ?? null,
				target_support: purchase.target_support ?? null
			}
		})
}

export function userCalculatorDataPatch(
	userStatsData: UserStats | null,
	userPlannedBannerData: PlannedBannerPayload[],
	userPlannedPurchaseData: PlannedPurchasePayload[]
): Promise<Response> {
	return fetch(`${API_URL}/calculator-data`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
			...authHeaders()
		},
		body: JSON.stringify({
			user_stats_data: userStatsData,
			user_planned_banner_data: userPlannedBannerData,
			user_planned_purchase_data: userPlannedPurchaseData
		})
	})
}

/**
 * TYPESCRIPT CONCEPT: Return Type Annotations on Exported Functions
 *
 * We explicitly annotate the return type as Promise<Response> rather than
 * letting TypeScript infer it. For exported functions, explicit return types:
 *   1. Serve as documentation (you can see what it returns without reading the body)
 *   2. Catch accidental changes (if you refactor and accidentally return
 *      something different, the type annotation flags the error immediately)
 *   3. Speed up type checking (the compiler doesn't have to trace through the body)
 */
export function initialCalculatorDataFetch(signal?: AbortSignal): Promise<Response> {
	return fetch(`${API_URL}/calculator-data`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			...authHeaders()
		},
		signal
	})
}