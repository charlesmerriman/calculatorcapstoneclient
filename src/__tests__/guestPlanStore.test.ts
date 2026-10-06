/**
 * The guest's plan on this device: what is written, what survives a damaged
 * entry, and how stored ids become rows again.
 *
 * The failures pinned here are quiet ones. A stored banner OBJECT would show
 * yesterday's predicted dates; a dangling id would 400 the whole sign-in
 * import; one bad row would take the plan with it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	blockGuestPlanImport,
	clearGuestPlan,
	guestPlanToState,
	readGuestPlan,
	subscribeToGuestPlan,
	writeGuestPlan,
	type GuestPlanCatalogue,
} from '../services/guestPlanStore'
import { DEFAULT_GUEST_STATS } from '../services/guestMigration'
import { toBannerPayload } from '../services/calculatorFetchCalls'
import type { AnniversaryEvent, BannerStepUp, BannerSupport, BannerUma, UserStats } from '../types'

const STORAGE_KEY = 'guestPlan.v1'

const dirtyStats: UserStats = { ...DEFAULT_GUEST_STATS, current_carat: 1500, club_rank: 3 }

const umaRow = { number_of_pulls: 10, reserved_copies: 1, banner_uma: 7, banner_support: null, banner_step_up: null }
const supportRow = { number_of_pulls: 20, reserved_copies: 0, note: 'for MLB', primary_card: 31, second_card: 32, banner_uma: null, banner_support: 9, banner_step_up: null }
const stepUpRow = { number_of_pulls: 5, reserved_copies: 0, banner_uma: null, banner_support: null, banner_step_up: 4 }
const purchase = { product: 5, quantity: 2, target_uma: null, target_support: null }
const selection = { banner_step_up: 4, uma: 11, support: null, slot: 1, is_target: true }

/** `end` stands in for every catalogue field that can change after a save. */
const catalogue = (end = 'Dec 10'): GuestPlanCatalogue => ({
	banner_uma_data: [{ id: 7, end }] as unknown as BannerUma[],
	banner_support_data: [{ id: 9, end }] as unknown as BannerSupport[],
	banner_step_up_data: [{ id: 4, end }] as unknown as BannerStepUp[],
	anniversary_event_data: [{ id: 1, products: [{ id: 5 }] }] as unknown as AnniversaryEvent[],
	club_rank_data: [{ id: 3 }],
	team_trials_rank_data: [],
	champions_meeting_rank_data: [],
	league_of_heroes_rank_data: [],
})

beforeEach(() => {
	localStorage.clear()
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('writeGuestPlan / readGuestPlan', () => {
	it('round-trips stats, rows, purchases and picks', () => {
		expect(writeGuestPlan(dirtyStats, [umaRow, supportRow], [purchase], [selection])).toBe(true)

		const plan = readGuestPlan()
		expect(plan?.stats).toEqual(dirtyStats)
		expect(plan?.banners).toEqual([umaRow, supportRow])
		expect(plan?.purchases).toEqual([purchase])
		expect(plan?.stepUpSelections).toEqual([selection])
	})

	it('stores untouched stats as null, so defaults never overwrite an account', () => {
		writeGuestPlan({ ...DEFAULT_GUEST_STATS }, [umaRow], [], [])
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).stats).toBeNull()
	})

	it('removes the entry when there is nothing left to keep', () => {
		writeGuestPlan(dirtyStats, [umaRow], [], [])
		expect(writeGuestPlan({ ...DEFAULT_GUEST_STATS }, [], [], [])).toBe(true)
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
		expect(readGuestPlan()).toBeNull()
	})

	it('never stores a row id: an imported guest row must be a create', () => {
		writeGuestPlan(null, [{ ...umaRow, id: 99 }], [{ ...purchase, id: 98 }], [])
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
		expect(stored.banners[0]).not.toHaveProperty('id')
		expect(stored.purchases[0]).not.toHaveProperty('id')
	})

	it('reports a write the browser refused instead of throwing', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('QuotaExceededError')
		})
		expect(writeGuestPlan(dirtyStats, [umaRow], [], [])).toBe(false)
	})

	it('reads blocked storage as no plan', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new DOMException('SecurityError')
		})
		expect(readGuestPlan()).toBeNull()
	})

	it('reads unparseable JSON and an unknown version as no plan', () => {
		localStorage.setItem(STORAGE_KEY, '{not json')
		expect(readGuestPlan()).toBeNull()

		localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, banners: [umaRow] }))
		expect(readGuestPlan()).toBeNull()
		// Left in place: it may be a newer bundle's, open in another tab.
		expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
	})

	it('drops a damaged row and keeps the rest of the plan', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 1,
				savedAt: 1,
				stats: null,
				banners: [umaRow, { number_of_pulls: 'ten' }, null, supportRow],
				purchases: [{ product: 'x' }, purchase],
				stepUpSelections: 'nope',
			})
		)
		const plan = readGuestPlan()
		expect(plan?.banners).toEqual([umaRow, supportRow])
		expect(plan?.purchases).toEqual([purchase])
		expect(plan?.stepUpSelections).toEqual([])
	})

	it('gives a stat that was not stored its default, and a damaged one too', () => {
		// A plan saved before `webstore_bonus` existed, with one corrupted value.
		const { webstore_bonus: _missing, ...older } = dirtyStats
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 1,
				savedAt: 1,
				stats: { ...older, uma_ticket: 'lots', unknown_key: 1 },
				banners: [],
				purchases: [],
				stepUpSelections: [],
			})
		)
		const stats = readGuestPlan()!.stats!
		expect(stats.webstore_bonus).toBe(DEFAULT_GUEST_STATS.webstore_bonus)
		expect(stats.uma_ticket).toBe(DEFAULT_GUEST_STATS.uma_ticket)
		expect(stats.current_carat).toBe(1500)
		expect(stats).not.toHaveProperty('unknown_key')
	})

	it('clearGuestPlan removes it', () => {
		writeGuestPlan(dirtyStats, [umaRow], [], [])
		clearGuestPlan()
		expect(readGuestPlan()).toBeNull()
	})

	it('a blocked import stays blocked until the guest changes the plan', () => {
		writeGuestPlan(dirtyStats, [umaRow], [], [])
		blockGuestPlanImport()
		expect(readGuestPlan()?.importBlocked).toBe(true)
		expect(readGuestPlan()?.banners).toEqual([umaRow])

		writeGuestPlan(dirtyStats, [umaRow, supportRow], [], [])
		expect(readGuestPlan()?.importBlocked).toBeUndefined()
	})
})

describe('subscribeToGuestPlan', () => {
	it("fires for another tab's write to the plan, and for nothing else", () => {
		const listener = vi.fn()
		const unsubscribe = subscribeToGuestPlan(listener)

		window.dispatchEvent(new StorageEvent('storage', { key: 'theme' }))
		expect(listener).not.toHaveBeenCalled()

		window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
		// key null is localStorage.clear()
		window.dispatchEvent(new StorageEvent('storage', { key: null }))
		expect(listener).toHaveBeenCalledTimes(2)

		unsubscribe()
		window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
		expect(listener).toHaveBeenCalledTimes(2)
	})
})

describe('guestPlanToState', () => {
	const store = (): void => {
		writeGuestPlan(dirtyStats, [umaRow, supportRow, stepUpRow], [purchase], [selection])
	}

	it('gives a guest with no plan the defaults and empty collections', () => {
		expect(guestPlanToState(null, catalogue())).toEqual({
			stats: DEFAULT_GUEST_STATS,
			banners: [],
			purchases: [],
			stepUpSelections: [],
		})
	})

	it('rebuilds each row around the banner in TODAY\'s catalogue', () => {
		store()
		// Saved when the banner ended Dec 10; an editor has since moved it.
		const state = guestPlanToState(readGuestPlan(), catalogue('Dec 24'))

		expect(state.banners).toHaveLength(3)
		expect(state.banners[0].banner_uma).toEqual({ id: 7, end: 'Dec 24' })
		expect(state.banners[1].banner_support).toEqual({ id: 9, end: 'Dec 24' })
		expect(state.banners[1].note).toBe('for MLB')
		// The odds-card choices come back too; a row stored before two-card
		// odds existed (umaRow) still loads, with neither.
		expect(state.banners[1]).toMatchObject({ primary_card: 31, second_card: 32 })
		expect(state.banners[0]).not.toHaveProperty('second_card')
		expect(state.banners[2].banner_step_up).toEqual({ id: 4, end: 'Dec 24' })
		expect(state.banners.map((row) => row.tempId)).toEqual([1, 2, 3])
		expect(state.purchases).toEqual([{ ...purchase, tempId: 1 }])
		expect(state.stepUpSelections).toEqual([selection])
		expect(state.stats).toEqual(dirtyStats)
	})

	it('is the inverse of toBannerPayload', () => {
		store()
		const state = guestPlanToState(readGuestPlan(), catalogue())
		expect(toBannerPayload(state.banners)).toEqual([umaRow, supportRow, stepUpRow])
	})

	it('drops what has left the catalogue and keeps everything else', () => {
		store()
		const gone: GuestPlanCatalogue = {
			...catalogue(),
			banner_support_data: [],
			banner_step_up_data: [],
			anniversary_event_data: [],
			club_rank_data: [],
		}
		const state = guestPlanToState(readGuestPlan(), gone)

		expect(state.banners).toHaveLength(1)
		expect(state.banners[0].banner_uma).toEqual({ id: 7, end: 'Dec 10' })
		expect(state.purchases).toEqual([])
		expect(state.stepUpSelections).toEqual([])
		// A rank that no longer exists is "no rank", not a dangling id.
		expect(state.stats.club_rank).toBeNull()
		expect(state.stats.current_carat).toBe(1500)
	})

	it('tolerates a catalogue from an API older than step-ups and campaigns', () => {
		store()
		const { banner_step_up_data: _a, anniversary_event_data: _b, ...older } = catalogue()
		const state = guestPlanToState(readGuestPlan(), older)
		expect(state.banners).toHaveLength(2)
		expect(state.purchases).toEqual([])
	})
})
