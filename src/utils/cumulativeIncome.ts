/**
 * Cumulative income from the projection anchor (today) to an arbitrary date.
 *
 * THE MODEL
 * ---------
 * Every function here answers one question: "how much of source X has accrued
 * between today and date E?" — as a closed form over the whole span, never as a
 * sum of per-banner windows.
 *
 * That is the whole point of the rewrite. The previous engine chained half-open
 * `(prevEnd, thisEnd]` windows, so every source needed an occurrence counter and
 * every counter had to *tile* — `(a,b] + (b,c] === (a,c]` — or totals drifted
 * with how many banners the user happened to plan. Tiling is a property you have
 * to prove for each counter and can silently lose; a closed form from a fixed
 * anchor has nothing to lose. It is also what the source spreadsheet does, one
 * column per source (`Carat Calculator` cols AN..AV), which is what makes the two
 * comparable at all.
 *
 * Each function names the sheet cell it reproduces. Where we knowingly differ,
 * the comment says so — those are the items the parity harness settles.
 *
 * All arithmetic is UTC (see ./utcDates). `today` is midnight UTC; `now` is the
 * live instant, and the two are NOT interchangeable — the sheet uses `$AG$3`
 * (TODAY) for span measures and `$AG$2` (NOW) for the event filters.
 */

import {
	DAILY_BASE_CARATS,
	WEEKDAY_BONUS_CARATS,
	WEEKEND_BONUS_CARATS,
	DAILY_CARAT_PACK_PER_DAY,
	DAILY_CARAT_PACK_PAID_CARATS,
	DAILY_CARAT_PACK_CYCLE_DAYS,
	MISC_EARNINGS_PER_DAY,
	MISC_EARNINGS_DELAY_DAYS,
	FIFTY_DAY_LOGIN_PER_CYCLE,
	FIFTY_DAY_LOGIN_CYCLE_DAYS,
	VALENTINES_CARATS,
	VALENTINES_MONTH,
	VALENTINES_DAY,
	WHITE_DAY_CARATS,
	WHITE_DAY_MONTH,
	WHITE_DAY_DAY,
	MONTHLY_SHOP_UMA_TICKETS,
	MONTHLY_SHOP_SUPPORT_TICKETS,
	TRAINING_PASS_START_DATE,
	TRAINING_PASS_MONTHLY_FREE_CARATS,
	TRAINING_PASS_MONTHLY_PAID_CARATS,
	TRAINING_PASS_FREE_UMA_TICKETS,
	TRAINING_PASS_FREE_SUPPORT_TICKETS,
	TRAINING_PASS_PAID_BONUS_UMA_TICKETS,
	TRAINING_PASS_PAID_BONUS_SUPPORT_TICKETS,
	MONTHLY_BASE_REWARD,
} from "../constants/gameConstants"
import {
	addUtcDays,
	ceilToTen,
	startOfUtcDay,
	startOfUtcMonth,
	startOfUtcWeek,
	utcDaysBetween,
	utcMonthsBetween,
	utcYearsBetween,
} from "./utcDates"

/**
 * Carats earned per day from daily quests plus the weekly login bonus, as a
 * single BLENDED rate — the sheet's `75 + 150/7` (cell AN42, Global branch).
 *
 * The old engine walked each day and added the bonus on the specific weekdays it
 * fell on, phased off `today`. Same long-run rate (the four bonuses total 150 a
 * week either way), but a different figure for any given banner, and it made
 * every estimate depend on which weekday the user happened to open the page.
 * The sheet smears it, so we smear it.
 */
const BLENDED_DAILY_RATE =
	DAILY_BASE_CARATS + (WEEKDAY_BONUS_CARATS * 3 + WEEKEND_BONUS_CARATS) / 7

/**
 * The shared launch constant is built as `new Date(2027, 7, 15)` — LOCAL
 * midnight. This engine is UTC throughout, so comparing it against UTC instants
 * would shift the launch by up to a day depending on the viewer's timezone.
 * Re-pin it to the same calendar day in UTC.
 *
 * This goes away once the launch date becomes an admin-editable constant; the
 * sheet reads it from a timeline row rather than hardcoding it at all.
 */
const TRAINING_PASS_LAUNCH_UTC = new Date(
	Date.UTC(
		TRAINING_PASS_START_DATE.getFullYear(),
		TRAINING_PASS_START_DATE.getMonth(),
		TRAINING_PASS_START_DATE.getDate()
	)
)

/**
 * Daily quests + weekly login — sheet `AN42`:
 *   `CEILING(DATEDIF(today, E, "D") * (75 + 150/7), 10)`
 *
 * The CEILING is applied to the CUMULATIVE total, not per day, so it can only
 * ever add up to 9 carats to the whole projection rather than compounding.
 */
export function cumulativeDailyCarats(today: Date, end: Date): number {
	const days = utcDaysBetween(today, end)
	if (days <= 0) return 0
	return ceilToTen(days * BLENDED_DAILY_RATE)
}

/**
 * Team Trials — sheet `AO42`:
 *   `INT((E - (today - WEEKDAY(today, 2) + 1)) / 7) * rate`
 *
 * Complete weeks since the Monday of the CURRENT week, so a payout is credited
 * once the week containing it has fully elapsed. Measured from that Monday
 * rather than from today, which is why a banner a few days out can already
 * carry a payout.
 */
export function cumulativeTeamTrialsCarats(
	today: Date,
	end: Date,
	incomePerWeek: number
): number {
	const weeks = Math.floor(utcDaysBetween(startOfUtcWeek(today), end) / 7)
	return weeks > 0 ? weeks * incomePerWeek : 0
}

/**
 * Club Rank — sheet `AP42`:
 *   `DATEDIF(EOMONTH(today, -1) + 1, E, "M") * rate`
 *
 * Complete months since the 1st of the current month. Note this is NOT the old
 * "1st-of-month boundaries crossed" count: DATEDIF only completes a month when
 * the day-of-month comes round again, so measuring from the 1st is what makes
 * the two agree.
 */
export function cumulativeClubRankCarats(
	today: Date,
	end: Date,
	incomePerMonth: number
): number {
	const months = utcMonthsBetween(startOfUtcMonth(today), end)
	return months > 0 ? months * incomePerMonth : 0
}

/**
 * Misc earnings — sheet `AV42`:
 *   `DATEDIF(today + 30, E, "D") * INT(Timeline!$AW$1 / 30)`
 *
 * A flat daily approximation of gifts / career rewards, gated behind the user's
 * toggle, and only after a ramp-in counted from today. The ramp-in start is an
 * ABSOLUTE instant, which is what stops a densely-planned timeline from
 * restarting it at every banner.
 */
export function cumulativeMiscEarningsCarats(today: Date, end: Date): number {
	const days = utcDaysBetween(addUtcDays(today, MISC_EARNINGS_DELAY_DAYS), end)
	return days > 0 ? days * MISC_EARNINGS_PER_DAY : 0
}

/**
 * 50-day login campaign plus the two annual gifts — sheet `AU42`:
 *   `INT(DATEDIF(today, E, "D") / 50) * 150
 *    + (DATEDIF(date_v, E, "Y") + 1) * 500
 *    + (DATEDIF(date_w, E, "Y") + 1) * 500`
 *
 * where `date_v` / `date_w` are this year's February 14 and March 14, rolled
 * forward a year if already past. The `+ 1` is what credits the upcoming
 * occurrence: DATEDIF gives 0 complete years until the *following* one, so a
 * banner ending after the next Valentine's still counts it once.
 *
 * The gifts are universal (no toggle), as is the login campaign.
 */
export function cumulativeLoginAndGiftCarats(today: Date, end: Date): number {
	const days = utcDaysBetween(today, end)
	if (days <= 0) return 0

	const cycles = Math.floor(days / FIFTY_DAY_LOGIN_CYCLE_DAYS)
	let total = cycles * FIFTY_DAY_LOGIN_PER_CYCLE

	for (const [month, day, amount] of [
		[VALENTINES_MONTH, VALENTINES_DAY, VALENTINES_CARATS],
		[WHITE_DAY_MONTH, WHITE_DAY_DAY, WHITE_DAY_CARATS],
	] as const) {
		let occurrence = new Date(Date.UTC(today.getUTCFullYear(), month, day))
		if (occurrence < startOfUtcDay(today)) {
			occurrence = new Date(Date.UTC(today.getUTCFullYear() + 1, month, day))
		}
		if (end < occurrence) continue
		total += (utcYearsBetween(occurrence, end) + 1) * amount
	}

	return total
}

export interface DailyCaratPackIncome {
	/** The 50/day drip — ordinary earned currency. */
	freeCarats: number
	/** The 500 repurchase bonus — bought, so it can fund discounted pulls. */
	paidCarats: number
}

/**
 * Daily Carat Pack — sheet `AR42` (drip) and `AZ42` (repurchase bonus):
 *   `DATEDIF(MAX(today, packStart), E, "D") * 50`
 *   `INT(DATEDIF(packStart, E, "D") / 30) * 500`
 *
 * The sheet takes `packStart` from a user-entered cell (`$AL$356`). We anchor to
 * today instead, which is what that cell reduces to when left blank — its
 * default. Day 0 never pays the bonus: the pack the user holds right now is
 * assumed already counted in the paid balance they entered.
 */
export function cumulativeDailyCaratPack(
	today: Date,
	end: Date
): DailyCaratPackIncome {
	const days = utcDaysBetween(today, end)
	if (days <= 0) return { freeCarats: 0, paidCarats: 0 }
	return {
		freeCarats: days * DAILY_CARAT_PACK_PER_DAY,
		paidCarats:
			Math.floor(days / DAILY_CARAT_PACK_CYCLE_DAYS) *
			DAILY_CARAT_PACK_PAID_CARATS,
	}
}

export interface MonthlyShopTickets {
	umaTickets: number
	supportTickets: number
}

/**
 * Monthly shop bundle — sheet `BG42`:
 *   `DATEDIF(EOMONTH(today, -1) + 2, E, "M") * quantity`
 *
 * Bought with an untracked currency, so it costs no carats. Measured from the
 * 2nd of the current month because that is when the shop restocks — a banner
 * ending on the 1st would otherwise be credited a bundle the player can't buy
 * yet. Off by default.
 */
export function cumulativeMonthlyShopTickets(
	today: Date,
	end: Date
): MonthlyShopTickets {
	const restockDay = addUtcDays(startOfUtcMonth(today), 1)
	const months = utcMonthsBetween(restockDay, end)
	if (months <= 0) return { umaTickets: 0, supportTickets: 0 }
	return {
		umaTickets: months * MONTHLY_SHOP_UMA_TICKETS,
		supportTickets: months * MONTHLY_SHOP_SUPPORT_TICKETS,
	}
}

export interface TrainingPassIncome {
	freeCarats: number
	paidCarats: number
	umaTickets: number
	supportTickets: number
}

/**
 * Training Pass — sheet `AQ42` (free carats), `BA42` (paid carats), `BH42`
 * (tickets):
 *   `INT(DATEDIF(MAX(today, launch), E, "M")) * IF(paid, 1350 + 500, 500)`
 *   `INT(DATEDIF(MAX(today, launch), E, "M")) * IF(paid, 350, 0)`
 *   `INT(DATEDIF(MAX(today, launch), E, "M") * IF(paid, 4, 2))`
 *
 * The feature does not exist before its launch date, so the span is clamped
 * there and a banner ending sooner earns nothing.
 *
 * All three use ONE month count. The old engine used two different clocks — the
 * 24th for the paid tier's carats and tickets, the 1st for the free tier's
 * carats — so a free-tier account drew carats and tickets on different days.
 * The sheet does not make that distinction, and full parity follows the sheet.
 *
 * Carats are either/or (the paid reward replaces the free tier's) while tickets
 * are base + bonus (the paid pass stacks). The paid tier's 2,200 is split across
 * both balances, 1,850 free + 350 paid, because part of it is purchased currency.
 */
export function cumulativeTrainingPassIncome(
	today: Date,
	end: Date,
	hasPaidPass: boolean
): TrainingPassIncome {
	const empty = { freeCarats: 0, paidCarats: 0, umaTickets: 0, supportTickets: 0 }
	if (end <= TRAINING_PASS_LAUNCH_UTC) return empty

	const start = today > TRAINING_PASS_LAUNCH_UTC ? today : TRAINING_PASS_LAUNCH_UTC
	const months = utcMonthsBetween(start, end)
	if (months <= 0) return empty

	return {
		freeCarats:
			months *
			(hasPaidPass ? TRAINING_PASS_MONTHLY_FREE_CARATS : MONTHLY_BASE_REWARD),
		paidCarats: hasPaidPass ? months * TRAINING_PASS_MONTHLY_PAID_CARATS : 0,
		umaTickets:
			months *
			(TRAINING_PASS_FREE_UMA_TICKETS +
				(hasPaidPass ? TRAINING_PASS_PAID_BONUS_UMA_TICKETS : 0)),
		supportTickets:
			months *
			(TRAINING_PASS_FREE_SUPPORT_TICKETS +
				(hasPaidPass ? TRAINING_PASS_PAID_BONUS_SUPPORT_TICKETS : 0)),
	}
}
