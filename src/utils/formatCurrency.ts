/**
 * The single place USD amounts get formatted.
 *
 * Same discipline as formatDate in ./dateFormat: one helper rather than
 * hand-rolled `toLocaleString` at call sites, so every price on the Selectors
 * page reads identically and a future change (a currency selector, say) has one
 * place to land.
 *
 * Deliberately pinned to en-US/USD rather than the viewer's locale — the source
 * sheet's prices are US store prices, and re-formatting them as €70 would
 * present a converted figure we never computed.
 */
const USD = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	// Whole dollars stay clean ("$70", not "$70.00") while a .99 tier still
	// renders in full.
	minimumFractionDigits: 0,
	maximumFractionDigits: 2,
})

export function formatUsd(amount: number): string {
	if (!Number.isFinite(amount)) return "$0"
	return USD.format(amount)
}
