import {
	DEFAULT_GUEST_STATS,
	statsAreDirty,
	stashGuestPlan,
	readGuestPlanStash,
	clearGuestPlanStash,
} from '../services/guestMigration'
import { toBannerPayload } from '../services/calculatorFetchCalls'
import type { UserPlannedBanner, UserStats } from '../types'
import type { BannerUma, BannerSupport } from '../types'

const STASH_KEY = 'guestPlanMigration.v1'

// Minimal nested banner objects — toBannerPayload only reads `.id`.
const umaBanner = { id: 7 } as BannerUma
const supportBanner = { id: 9 } as BannerSupport

const dirtyStats: UserStats = { ...DEFAULT_GUEST_STATS, current_carat: 1500 }

beforeEach(() => {
	sessionStorage.clear()
})

// ── statsAreDirty ─────────────────────────────────────────────────────────────

describe('statsAreDirty', () => {
	it('is false for null (guest state never even loaded)', () => {
		expect(statsAreDirty(null)).toBe(false)
	})

	it('is false for untouched defaults', () => {
		expect(statsAreDirty({ ...DEFAULT_GUEST_STATS })).toBe(false)
	})

	it('is true when any scalar field differs', () => {
		expect(statsAreDirty({ ...DEFAULT_GUEST_STATS, uma_ticket: 3 })).toBe(true)
		expect(statsAreDirty({ ...DEFAULT_GUEST_STATS, daily_carat: true })).toBe(true)
	})

	it('is true when a rank is selected (null → id)', () => {
		expect(statsAreDirty({ ...DEFAULT_GUEST_STATS, club_rank: 2 })).toBe(true)
	})
})

// ── stash write / read roundtrip ──────────────────────────────────────────────

describe('stashGuestPlan / readGuestPlanStash', () => {
	it('roundtrips dirty stats and banners', () => {
		stashGuestPlan(dirtyStats, [
			{ number_of_pulls: 10, banner_uma: 7, banner_support: null },
		])

		const stash = readGuestPlanStash()
		expect(stash).not.toBeNull()
		expect(stash!.stats).toEqual(dirtyStats)
		expect(stash!.banners).toEqual([
			{ number_of_pulls: 10, banner_uma: 7, banner_support: null },
		])
	})

	it('omits stats that still equal the defaults (must not clobber account stats)', () => {
		stashGuestPlan({ ...DEFAULT_GUEST_STATS }, [
			{ number_of_pulls: 5, banner_uma: null, banner_support: 9 },
		])

		expect(readGuestPlanStash()!.stats).toBeNull()
	})

	it('writes nothing when there is nothing worth migrating', () => {
		stashGuestPlan({ ...DEFAULT_GUEST_STATS }, [])
		expect(sessionStorage.getItem(STASH_KEY)).toBeNull()
	})

	it('clears a previous stash when called with nothing worth migrating', () => {
		stashGuestPlan(dirtyStats, [])
		expect(readGuestPlanStash()).not.toBeNull()

		stashGuestPlan({ ...DEFAULT_GUEST_STATS }, [])
		expect(readGuestPlanStash()).toBeNull()
	})
})

// ── read validation ───────────────────────────────────────────────────────────

describe('readGuestPlanStash validation', () => {
	it('returns null when no stash exists', () => {
		expect(readGuestPlanStash()).toBeNull()
	})

	it('discards malformed JSON', () => {
		sessionStorage.setItem(STASH_KEY, '{not json')
		expect(readGuestPlanStash()).toBeNull()
	})

	it('discards and removes entries with an unknown version', () => {
		sessionStorage.setItem(
			STASH_KEY,
			JSON.stringify({ version: 2, createdAt: Date.now(), stats: null, banners: [] })
		)
		expect(readGuestPlanStash()).toBeNull()
		expect(sessionStorage.getItem(STASH_KEY)).toBeNull()
	})

	it('discards and removes entries older than the max age', () => {
		const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
		sessionStorage.setItem(
			STASH_KEY,
			JSON.stringify({ version: 1, createdAt: twoHoursAgo, stats: null, banners: [] })
		)
		expect(readGuestPlanStash()).toBeNull()
		expect(sessionStorage.getItem(STASH_KEY)).toBeNull()
	})

	it('clearGuestPlanStash removes an existing stash', () => {
		stashGuestPlan(dirtyStats, [])
		clearGuestPlanStash()
		expect(readGuestPlanStash()).toBeNull()
	})
})

// ── toBannerPayload ───────────────────────────────────────────────────────────

describe('toBannerPayload', () => {
	it('reduces nested banner objects to FK ids and strips tempId', () => {
		const local: UserPlannedBanner = {
			tempId: 123,
			number_of_pulls: 20,
			banner_uma: umaBanner,
			banner_support: null,
		}

		expect(toBannerPayload([local])).toEqual([
			{ number_of_pulls: 20, banner_uma: 7, banner_support: null },
		])
	})

	it('keeps id (and user) on saved banners so the PATCH preserves them', () => {
		const saved: UserPlannedBanner = {
			id: 42,
			user: 1,
			number_of_pulls: 30,
			banner_support: supportBanner,
		}

		const [payload] = toBannerPayload([saved])
		expect(payload.id).toBe(42)
		expect(payload.banner_support).toBe(9)
		expect(payload.banner_uma).toBeNull()
	})

	it('drops rows with neither an uma nor a support banner selected', () => {
		const empty: UserPlannedBanner = {
			tempId: 1,
			number_of_pulls: 10,
			banner_uma: null,
			banner_support: null,
		}

		expect(toBannerPayload([empty])).toEqual([])
	})
})