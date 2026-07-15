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

import type { UserStats, UserPlannedBanner } from "../types"

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
	banner_uma: number | null
	banner_support: number | null
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
		.filter(
			(plannedBanner) =>
				plannedBanner.banner_uma || plannedBanner.banner_support
		)
		.map((plannedBanner) => {
			const { tempId: _tempId, ...rest } = plannedBanner
			return {
				...rest,
				banner_uma: plannedBanner.banner_uma?.id ?? null,
				banner_support: plannedBanner.banner_support?.id ?? null
			}
		})
}

export function userCalculatorDataPatch(
	userStatsData: UserStats | null,
	userPlannedBannerData: PlannedBannerPayload[]
): Promise<Response> {
	return fetch(`${API_URL}/calculator-data`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
			...authHeaders()
		},
		body: JSON.stringify({
			user_stats_data: userStatsData,
			user_planned_banner_data: userPlannedBannerData
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