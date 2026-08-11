/**
 * Build-time feature flags.
 *
 * Kept in one module rather than read from `import.meta.env` at call sites, so
 * the set of live flags is greppable and each one carries the note explaining
 * when it goes away. A flag with no removal condition is technical debt.
 */

/**
 * Use the ledger-based income engine (`useBannerResourcesV2`) instead of the
 * original windowed walk (`useBannerResources`).
 *
 * Both engines ship while the sheet-parity harness is being built, so the two
 * can be compared against the same saved plan. REMOVE THIS — along with
 * `useBannerResources`, the window-occurrence helpers in
 * `utils/incomeCalculationUtils.ts`, and this file's only entry — once the
 * harness is green and v2 is the only engine.
 *
 * Off by default: enabling it moves everyone's numbers (see the UTC migration
 * and the parity constants), so it stays opt-in until it is verified.
 */
export const USE_INCOME_ENGINE_V2 =
	import.meta.env.VITE_INCOME_ENGINE_V2 === "true"
