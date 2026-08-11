/**
 * Build-time feature flags.
 *
 * Kept in one module rather than read from `import.meta.env` at call sites, so
 * the set of live flags is greppable and each one carries the note explaining
 * when it goes away. A flag with no removal condition is technical debt.
 */

/**
 * Use the ledger-based income engine instead of the original windowed walk.
 *
 * Selects between `useBannerResources` / `useAverageMonthlyIncome` (legacy) and
 * `useBannerResourcesV2` / `useAverageMonthlyIncomeV2` (ledger). Both are picked
 * by the SAME flag on purpose: the per-banner rows and the "Income & Resources"
 * tiles above them must never disagree, and a user comparing the two would spot
 * it instantly.
 *
 * ON by default. Set `VITE_INCOME_ENGINE_V2=false` to fall back to the legacy
 * engine — that escape hatch is the only reason the old code still ships.
 *
 * REMOVE THIS, along with the legacy hooks and the window-occurrence helpers in
 * `utils/incomeCalculationUtils.ts`, once the ledger engine has run in
 * production long enough to trust. Note the legacy engine's ~110 tests in
 * `useBannerResources.test.ts` go with it — until then they still guard shipping
 * code and should not be deleted.
 */
export const USE_INCOME_ENGINE_V2 =
	import.meta.env.VITE_INCOME_ENGINE_V2 !== "false"
