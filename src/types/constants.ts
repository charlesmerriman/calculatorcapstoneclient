/**
 * Every tunable number the projection uses, as served by `/calculator-data`.
 *
 * Mirrors `CalculationConstantsSerializer`
 * (`backend/calculatorapi/views/calculation_constants.py`), which is generated
 * from the `CalculationConstants` model — read that model for what each field
 * means and which sheet cell it corresponds to.
 *
 * Field names stay snake_case to match the wire format exactly. A camelCase
 * mapping layer would be 35 more lines whose only job is to be a place for a
 * typo to hide.
 *
 * The decimal-valued fields arrive as NUMBERS, not DRF's default decimal
 * strings — the serializer coerces them, because `"0.664" * 2` is a silent NaN
 * in JavaScript rather than an error.
 */
export interface CalculationConstants {
	// Daily income
	daily_base_carats: number
	/** TOTAL weekly login bonus, smeared across seven days rather than paid on specific ones. */
	weekly_bonus_carats: number

	// Packs & passes
	daily_carat_pack_per_day: number
	daily_carat_pack_paid_carats: number
	daily_carat_pack_cycle_days: number
	/** ISO date (YYYY-MM-DD) the Training Pass launches on Global. */
	training_pass_start_date: string
	training_pass_monthly_free_carats: number
	training_pass_monthly_paid_carats: number
	monthly_base_reward: number
	training_pass_free_uma_tickets: number
	training_pass_free_support_tickets: number
	training_pass_paid_bonus_uma_tickets: number
	training_pass_paid_bonus_support_tickets: number

	// Login campaigns & annual gifts
	misc_earnings_monthly: number
	misc_earnings_delay_days: number
	fifty_day_login_carats: number
	fifty_day_login_cycle_days: number
	valentines_carats: number
	/** 1-12, NOT the 0-indexed value Date.getUTCMonth() returns. */
	valentines_month: number
	valentines_day: number
	white_day_carats: number
	white_day_month: number
	white_day_day: number
	monthly_shop_uma_tickets: number
	monthly_shop_support_tickets: number
	monthly_shop_restock_day: number

	// Pull costs & uncap
	pull_cost_carats: number
	discounted_pull_cost_carats: number
	shards_per_crystal: number

	// Throughout-carat decay curve
	throughout_end_offset_days: number
	throughout_filter_grace_days: number
	throughout_decay_k: number
	throughout_decay_linear_slope: number

	// Global date prediction (used server-side; served for reference)
	prediction_factor: number
	game_event_end_buffer_days: number
}
