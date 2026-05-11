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

import type { UserStats } from "../types"

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
interface PlannedBannerPayload {
	id?: number
	number_of_pulls: number
	banner_uma: number | null
	banner_support: number | null
}

export function userCalculatorDataPatch(
	userStatsData: UserStats | null,
	userPlannedBannerData: PlannedBannerPayload[]
): Promise<Response> {
	return fetch(`${API_URL}/calculator-data`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Token ${localStorage.getItem("authToken")}`
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
			Authorization: `Token ${localStorage.getItem("authToken")}`
		},
		signal
	})
}