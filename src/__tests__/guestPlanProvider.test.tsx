/**
 * CalculatorProvider and the guest's plan on this device.
 *
 * Three things are pinned, and none of them throws when it breaks:
 *
 *   - a guest's edits reach the device and come back after a reload, and
 *     nothing about a guest reaches the server;
 *   - A TAB SAVES THE WAY IT LOADED. A guest tab never PATCHes because a token
 *     appeared in another tab (that would delete the account's rows), and an
 *     account tab never writes the device store because the token went away
 *     (that would leave account data on a shared computer);
 *   - signing in moves the device's plan into the account without overwriting
 *     what the account already holds, and a failure never costs the plan.
 */

import { useEffect } from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { CalculatorProvider } from '../services/CalculatorProvider'
import { useCalculatorData } from '../services/CalculatorContext'
import {
	initialCalculatorDataFetch,
	userCalculatorDataPatch,
} from '../services/calculatorFetchCalls'
import { planCreate, planDelete } from '../services/planFetchCalls'
import { clearAuthToken, setAuthToken } from '../services/authToken'
import { DEFAULT_GUEST_STATS, stashGuestPlan } from '../services/guestMigration'
import { readGuestPlan, writeGuestPlan } from '../services/guestPlanStore'
import { IMPORTED_PLAN_NAME } from '../services/guestPlanImport'
import { reloadPage } from '../services/reloadPage'
import type {
	BannerUma,
	CalculatorContextType,
	CalculatorData,
	Plan,
	UserPlannedBanner,
	UserStats,
} from '../types'

vi.mock('../services/calculatorFetchCalls', async (importOriginal) => ({
	...(await importOriginal<typeof import('../services/calculatorFetchCalls')>()),
	initialCalculatorDataFetch: vi.fn(),
	userCalculatorDataPatch: vi.fn(),
}))
vi.mock('../services/planFetchCalls', () => ({
	planActivate: vi.fn(),
	planCreate: vi.fn(),
	planDelete: vi.fn(),
	planFetch: vi.fn(),
	planRename: vi.fn(),
	planSetSeparateIncome: vi.fn(),
}))
vi.mock('../services/reloadPage', () => ({ reloadPage: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockedInitialFetch = vi.mocked(initialCalculatorDataFetch)
const mockedPatch = vi.mocked(userCalculatorDataPatch)
const mockedCreate = vi.mocked(planCreate)
const mockedDelete = vi.mocked(planDelete)
const mockedReload = vi.mocked(reloadPage)

const STORAGE_KEY = 'guestPlan.v1'

const json = (body: unknown, status = 200): Response =>
	({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response

const MAIN: Plan = { id: 1, name: 'Main plan', is_active: true, updated_at: '2026-10-01T00:00:00Z' }
const IMPORTED: Plan = { id: 7, name: IMPORTED_PLAN_NAME, is_active: false, updated_at: '2026-10-01T00:00:00Z' }

/** Two banners in the catalogue. `name` is what a stored OBJECT would freeze. */
const BANNERS = [
	{ id: 100, name: 'Kitasan' },
	{ id: 200, name: 'Satono' },
] as unknown as BannerUma[]

/** What the device holds: one row on banner 100, and 1,500 carats. */
const GUEST_ROW = { number_of_pulls: 40, reserved_copies: 0, banner_uma: 100, banner_support: null, banner_step_up: null }
const GUEST_STATS: UserStats = { ...DEFAULT_GUEST_STATS, current_carat: 1500 }
const storeGuestPlan = (): void => {
	writeGuestPlan(GUEST_STATS, [GUEST_ROW], [], [])
}

/** A saved account row on banner 200. */
const ACCOUNT_ROW = {
	id: 10,
	user: 1,
	plan: 1,
	number_of_pulls: 75,
	reserved_copies: 0,
	banner_uma: BANNERS[1],
	banner_support: null,
	banner_step_up: null,
} as UserPlannedBanner

const basePayload = {
	club_rank_data: [],
	team_trials_rank_data: [],
	champions_meeting_rank_data: [],
	league_of_heroes_rank_data: [],
	banner_uma_data: BANNERS,
	banner_support_data: [],
	banner_step_up_data: [],
	events_data: [],
	champions_meeting_data: [],
	league_of_heroes_event_data: [],
	banner_timeline_data: [],
	anniversary_event_data: [],
	scenario_data: [],
	user_planned_purchase_data: [],
	user_step_up_selection_data: [],
	income_ledger: [],
}

/** What the server sends someone with no token. */
const guestPayload = (): CalculatorData =>
	({
		...basePayload,
		user_stats_data: null,
		user_planned_banner_data: [],
		user_plans: [],
		active_plan_id: null,
	}) as unknown as CalculatorData

const accountPayload = (rows: UserPlannedBanner[], plans: Plan[] = [MAIN]): CalculatorData =>
	({
		...basePayload,
		user_stats_data: { ...DEFAULT_GUEST_STATS, current_carat: 41000 },
		user_planned_banner_data: rows,
		user_plans: plans,
		active_plan_id: MAIN.id,
	}) as unknown as CalculatorData

const latest: { current: CalculatorContextType | null } = { current: null }
const Probe = () => {
	const value = useCalculatorData()
	useEffect(() => {
		latest.current = value
	})
	return null
}
const ctx = (): CalculatorContextType => {
	if (!latest.current) throw new Error('Probe has not rendered yet')
	return latest.current
}

const renderLoaded = async (): Promise<void> => {
	latest.current = null
	render(
		<CalculatorProvider>
			<Probe />
		</CalculatorProvider>
	)
	await waitFor(() => expect(latest.current?.isLoading).toBe(false))
}

/** Add a row on banner 200, the way confirming a staged banner does. */
const addRow = async (): Promise<void> => {
	await act(async () => {
		ctx().setUserPlannedBannerData((prev) => [
			...prev,
			{ tempId: 50, number_of_pulls: 20, reserved_copies: 0, banner_uma: BANNERS[1] },
		])
	})
}

beforeEach(() => {
	latest.current = null
	localStorage.clear()
	sessionStorage.clear()
	vi.clearAllMocks()
	mockedInitialFetch.mockResolvedValue(json(guestPayload()))
	mockedPatch.mockResolvedValue(json({ message: 'ok' }))
	mockedCreate.mockResolvedValue(json({ plan: IMPORTED, user_planned_banner_data: [] }, 201))
	mockedDelete.mockResolvedValue(json({ active_plan_id: MAIN.id }))
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('a guest', () => {
	it('starts on the defaults when the device holds no plan', async () => {
		await renderLoaded()
		expect(ctx().userStatsData).toEqual(DEFAULT_GUEST_STATS)
		expect(ctx().userPlannedBannerData).toEqual([])
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
	})

	it('has every edit written to the device at once, and nothing sent to the server', async () => {
		await renderLoaded()
		await addRow()

		expect(readGuestPlan()?.banners).toEqual([
			{ number_of_pulls: 20, reserved_copies: 0, banner_uma: 200, banner_support: null, banner_step_up: null },
		])
		// No timer: nothing is pending, so no save icon and no unload warning.
		expect(ctx().timerIsGoing).toBe(false)
		expect(mockedPatch).not.toHaveBeenCalled()
	})

	it('gets the plan back after a reload, rebuilt from the catalogue', async () => {
		storeGuestPlan()
		await renderLoaded()

		expect(ctx().userStatsData?.current_carat).toBe(1500)
		expect(ctx().userPlannedBannerData).toHaveLength(1)
		// The banner OBJECT is the catalogue's, not something that was stored.
		expect(ctx().userPlannedBannerData[0].banner_uma).toBe(BANNERS[0])
		expect(ctx().userPlannedBannerData[0].number_of_pulls).toBe(40)
		// Loading is not an edit: the entry was not rewritten.
		expect(mockedPatch).not.toHaveBeenCalled()
	})

	it('can clear the plan, which removes it from the device', async () => {
		storeGuestPlan()
		await renderLoaded()

		await act(async () => {
			ctx().resetGuestPlan()
		})

		expect(ctx().userPlannedBannerData).toEqual([])
		expect(ctx().userStatsData).toEqual(DEFAULT_GUEST_STATS)
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
	})

	it('is told once when the browser will not keep the plan', async () => {
		await renderLoaded()
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('QuotaExceededError')
		})

		await addRow()
		await addRow()

		expect(ctx().isGuestPlanStored).toBe(false)
		expect(toast.error).toHaveBeenCalledTimes(1)
		// Still usable in memory.
		expect(ctx().userPlannedBannerData).toHaveLength(2)
	})

	it("takes another tab's version of the plan without writing it back", async () => {
		await renderLoaded()
		// The other tab's write, then the event the browser sends this one.
		storeGuestPlan()
		const setItem = vi.spyOn(Storage.prototype, 'setItem')

		await act(async () => {
			window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
		})

		expect(ctx().userPlannedBannerData).toHaveLength(1)
		expect(ctx().userPlannedBannerData[0].banner_uma).toBe(BANNERS[0])
		expect(ctx().userStatsData?.current_carat).toBe(1500)
		expect(setItem).not.toHaveBeenCalled()

		// The flag that skipped that write is spent: a real edit still saves.
		await addRow()
		expect(readGuestPlan()?.banners).toHaveLength(2)
	})
})

describe('a tab saves the way it loaded', () => {
	it('a guest tab reloads when a token appears, and never PATCHes or rewrites the store', async () => {
		storeGuestPlan()
		await renderLoaded()

		// They signed in from another tab, which imported and cleared the plan.
		localStorage.removeItem(STORAGE_KEY)
		await act(async () => {
			setAuthToken('token')
		})
		expect(mockedReload).toHaveBeenCalledTimes(1)

		// reloadPage is mocked, so the tab lives on. An edit in it must do nothing:
		// a PATCH here carries no plan id and would wipe the account's active plan.
		await addRow()
		expect(ctx().timerIsGoing).toBe(false)
		await ctx().saveNow()
		expect(mockedPatch).not.toHaveBeenCalled()
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
	})

	it('an account tab reloads when the token goes, and never writes the device store', async () => {
		setAuthToken('token')
		mockedInitialFetch.mockResolvedValue(json(accountPayload([ACCOUNT_ROW])))
		await renderLoaded()

		await act(async () => {
			clearAuthToken()
		})
		expect(mockedReload).toHaveBeenCalledTimes(1)

		await act(async () => {
			ctx().setUserPlannedBannerData((prev) => prev.map((row) => ({ ...row, number_of_pulls: 1 })))
		})
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
		expect(mockedPatch).not.toHaveBeenCalled()
	})

	it('an account tab never writes the device store while signed in either', async () => {
		setAuthToken('token')
		mockedInitialFetch.mockResolvedValue(json(accountPayload([ACCOUNT_ROW])))
		await renderLoaded()

		await act(async () => {
			ctx().setUserPlannedBannerData((prev) => prev.map((row) => ({ ...row, number_of_pulls: 1 })))
		})

		expect(ctx().timerIsGoing).toBe(true)
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
		expect(mockedReload).not.toHaveBeenCalled()
	})
})

describe('signing in with a plan on the device', () => {
	beforeEach(() => {
		setAuthToken('token')
		storeGuestPlan()
	})

	it('puts everything into a new account\'s one plan', async () => {
		mockedInitialFetch.mockResolvedValue(json(accountPayload([])))
		await renderLoaded()

		expect(mockedCreate).not.toHaveBeenCalled()
		expect(mockedPatch).toHaveBeenCalledTimes(1)
		expect(mockedPatch).toHaveBeenCalledWith(MAIN.id, GUEST_STATS, [GUEST_ROW], [], [])
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
		// Re-fetched so the rows on screen carry real ids.
		expect(mockedInitialFetch).toHaveBeenCalledTimes(2)
		expect(toast.success).toHaveBeenCalledTimes(1)
	})

	it('adds the rows as a NEW plan when the account already has one, and leaves its numbers alone', async () => {
		mockedInitialFetch.mockResolvedValue(json(accountPayload([ACCOUNT_ROW])))
		await renderLoaded()

		expect(mockedCreate).toHaveBeenCalledWith(IMPORTED_PLAN_NAME)
		// The new plan's id, no stats, and purchases and picks OMITTED (null):
		// nothing of the account's is resent, so nothing of it can be replaced.
		expect(mockedPatch).toHaveBeenCalledTimes(1)
		expect(mockedPatch).toHaveBeenCalledWith(IMPORTED.id, null, [GUEST_ROW], null, null)
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
		// Still on the account's own plan and its own carats.
		expect(ctx().activePlanId).toBe(MAIN.id)
		expect(ctx().userStatsData?.current_carat).toBe(41000)
	})

	it('leaves the plan on the device when the account has no free slot', async () => {
		const full = [1, 2, 3, 4, 5].map((id) => ({ ...MAIN, id, is_active: id === 1 }))
		mockedInitialFetch.mockResolvedValue(json(accountPayload([ACCOUNT_ROW], full)))
		await renderLoaded()

		expect(mockedCreate).not.toHaveBeenCalled()
		expect(mockedPatch).not.toHaveBeenCalled()
		expect(readGuestPlan()?.banners).toEqual([GUEST_ROW])
		expect(toast.error).toHaveBeenCalledTimes(1)

		// Retried on the next load, but the notice is once per tab session.
		cleanup()
		await renderLoaded()
		expect(toast.error).toHaveBeenCalledTimes(1)
	})

	it('keeps the plan for a retry when the server is down, and removes the empty plan it made', async () => {
		mockedInitialFetch.mockResolvedValue(json(accountPayload([ACCOUNT_ROW])))
		mockedPatch.mockResolvedValue(json({}, 503))
		await renderLoaded()

		expect(mockedDelete).toHaveBeenCalledWith(IMPORTED.id)
		expect(readGuestPlan()?.banners).toEqual([GUEST_ROW])
		expect(readGuestPlan()?.importBlocked).toBeUndefined()

		// Next visit, server back up: it goes in.
		cleanup()
		mockedPatch.mockResolvedValue(json({ message: 'ok' }))
		await renderLoaded()
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
	})

	it('keeps a refused plan on the device and stops offering it', async () => {
		mockedInitialFetch.mockResolvedValue(json(accountPayload([ACCOUNT_ROW])))
		mockedPatch.mockResolvedValue(json({ error: 'bad row' }, 400))
		await renderLoaded()

		expect(mockedDelete).toHaveBeenCalledWith(IMPORTED.id)
		expect(readGuestPlan()?.banners).toEqual([GUEST_ROW])
		expect(readGuestPlan()?.importBlocked).toBe(true)

		// The same body would fail forever, so the next load does not try.
		cleanup()
		vi.clearAllMocks()
		mockedInitialFetch.mockResolvedValue(json(accountPayload([ACCOUNT_ROW])))
		await renderLoaded()
		expect(mockedCreate).not.toHaveBeenCalled()
		expect(mockedPatch).not.toHaveBeenCalled()
	})

	it('drops a row whose banner has left the catalogue before sending', async () => {
		writeGuestPlan(null, [GUEST_ROW, { ...GUEST_ROW, banner_uma: 999 }], [], [])
		mockedInitialFetch.mockResolvedValue(json(accountPayload([ACCOUNT_ROW])))
		await renderLoaded()

		expect(mockedPatch).toHaveBeenCalledWith(IMPORTED.id, null, [GUEST_ROW], null, null)
	})
})

describe('a stash from the bundle before this one', () => {
	it('is still imported, for someone who was mid sign-in during the deploy', async () => {
		stashGuestPlan(GUEST_STATS, [GUEST_ROW])
		setAuthToken('token')
		mockedInitialFetch.mockResolvedValue(json(accountPayload([])))
		await renderLoaded()

		expect(mockedPatch).toHaveBeenCalledWith(MAIN.id, GUEST_STATS, [GUEST_ROW], [], [])
		expect(sessionStorage.getItem('guestPlanMigration.v1')).toBeNull()
	})
})
