import type { BannerUma, BannerSupport } from "./banner"

/**
 * Represents the user's current resources and income settings.
 * The rank fields store FK ids that reference rank objects. They are
 * nullable because the backend FKs are nullable — new accounts and
 * guests start with no ranks selected.
 */
export interface UserStats {
	current_carat: number
	current_paid_carat: number
	uma_ticket: number
	support_ticket: number
	daily_carat: boolean
	training_pass: boolean
	club_rank: number | null
	team_trials_rank: number | null
	champions_meeting_rank: number | null
	league_of_heroes_rank: number | null
	ssr_crystals: number
	sr_crystals: number
	ssr_shards: number
	sr_shards: number
}

/**
 * TYPESCRIPT CONCEPT: Discriminated Unions (done right)
 *
 * A UserPlannedBanner is either:
 *   - "saved" (has an `id` from the database, came from the server)
 *   - "local" (has a `tempId`, exists only in the browser until saved)
 *
 * The original code used a 4-way union with `never` types trying to also enforce
 * that only one of banner_uma/banner_support could be set. That made the type
 * nearly impossible to work with — every access required complex narrowing.
 *
 * The fix: separate the two concerns.
 *   - Saved vs local → enforced by the TYPE SYSTEM (discriminated union below)
 *   - Uma vs support exclusivity → enforced by RUNTIME VALIDATION (the backend
 *     already has a DB constraint for this, and the UI only lets you pick one)
 *
 * Not everything needs to be enforced at the type level. Types should make your
 * code easier to write, not harder.
 *
 * TYPESCRIPT CONCEPT: Why `tempId?: undefined` instead of omitting `tempId`?
 * If we just omitted tempId from SavedPlannedBanner, accessing `banner.tempId`
 * would be a type error — even though we know at runtime it's just undefined.
 * By explicitly including it as `undefined`, we can safely access it on any
 * UserPlannedBanner without narrowing first. Same idea for `id` on local banners.
 * This is a common pattern for "tagged unions" where you want easy property access.
 */

interface BasePlannedBanner {
	number_of_pulls: number
	banner_uma?: BannerUma | null
	banner_support?: BannerSupport | null
	initialBannerType?: "Uma" | "Support"
}

export interface SavedPlannedBanner extends BasePlannedBanner {
	id: number
	tempId?: undefined
	user: number
}

export interface LocalPlannedBanner extends BasePlannedBanner {
	id?: undefined
	tempId: number
	user?: undefined
}

export type UserPlannedBanner = SavedPlannedBanner | LocalPlannedBanner

/**
 * TYPESCRIPT CONCEPT: Type Guards
 *
 * A type guard is a function that narrows a union type. The return type
 * `banner is SavedPlannedBanner` tells TypeScript: "if this function
 * returns true, treat the argument as SavedPlannedBanner from here on."
 *
 * Usage:
 *   if (isSavedBanner(banner)) {
 *     console.log(banner.id)    // TypeScript knows `id` is `number` here
 *     console.log(banner.user)  // TypeScript knows `user` is `number` here
 *   }
 */
export function isSavedBanner(
	banner: UserPlannedBanner
): banner is SavedPlannedBanner {
	return banner.id !== undefined
}

export function isLocalBanner(
	banner: UserPlannedBanner
): banner is LocalPlannedBanner {
	return banner.tempId !== undefined
}