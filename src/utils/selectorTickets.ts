/**
 * Selector tickets — a bucketed pool, not a scalar.
 *
 * A selector ticket may only take cards released on JP on or before its cutoff
 * date. That makes tickets non-fungible: two "uma selectors" are different
 * resources if their cutoffs differ, so the balance has to remember which is
 * which rather than collapsing to a count.
 *
 * A LATER cutoff strictly dominates an earlier one — anything an early ticket
 * can take, a later one can too. So the buckets sort ascending (weakest first,
 * `null` = unrestricted last), and spending always takes the WEAKEST ticket that
 * still qualifies. Spending a strong ticket on a card a weak one covers throws
 * away reach for nothing.
 *
 * NOTE this constraint is usually binding, and that is correct: a campaign's
 * cutoff falls before its own banners, so a selector granted at an anniversary
 * essentially never covers that anniversary's featured unit. Selectors are for
 * older and rerun banners; SSR crystals cover the rest.
 */

export interface SelectorTicketBucket {
	/** ISO date string, or null for an unrestricted ticket. */
	jpCutoff: string | null
	count: number
}

/**
 * Sort key: weakest first. `null` (unrestricted) is the strongest, so it sorts
 * last, which is also what makes the greedy spend below correct by construction.
 */
function bucketRank(bucket: SelectorTicketBucket): number {
	if (bucket.jpCutoff === null) return Number.POSITIVE_INFINITY
	return new Date(bucket.jpCutoff).getTime()
}

function sortBuckets(buckets: SelectorTicketBucket[]): SelectorTicketBucket[] {
	return [...buckets].sort((a, b) => bucketRank(a) - bucketRank(b))
}

/**
 * Add tickets to the pool, merging into an existing bucket with the same cutoff.
 * Returns a new array — the projection treats balances as immutable snapshots.
 */
export function addSelectorTickets(
	buckets: SelectorTicketBucket[],
	jpCutoff: string | null,
	count: number
): SelectorTicketBucket[] {
	if (count <= 0) return buckets

	const existing = buckets.find((bucket) => bucket.jpCutoff === jpCutoff)
	if (existing) {
		return buckets.map((bucket) =>
			bucket === existing ? { ...bucket, count: bucket.count + count } : bucket
		)
	}
	return sortBuckets([...buckets, { jpCutoff, count }])
}

/** Total tickets across every bucket — what the UI shows as a single number. */
export function totalSelectorTickets(buckets: SelectorTicketBucket[]): number {
	return buckets.reduce((sum, bucket) => sum + bucket.count, 0)
}

/**
 * Can a ticket with `jpCutoff` take a card first seen on JP at `firstJpDate`?
 *
 * Mirrors the backend's eligibility.is_eligible exactly, including both edge
 * rules: a null cutoff is unrestricted, and an unknown release date is REFUSED
 * under a real cutoff. Claiming a selector covers a card it cannot is a worse
 * failure than hiding one it could.
 */
export function isCardEligible(
	firstJpDate: string | null | undefined,
	jpCutoff: string | null
): boolean {
	if (jpCutoff === null) return true
	if (!firstJpDate) return false
	// Inclusive: cards released ON the cutoff date are selectable. Compared as
	// calendar days — the release date carries a time of day and the cutoff
	// does not, so a raw instant compare would drop same-day releases.
	return firstJpDate.slice(0, 10) <= jpCutoff.slice(0, 10)
}

export interface SelectorSpendResult {
	buckets: SelectorTicketBucket[]
	spent: number
}

/**
 * Spend up to `wanted` tickets on a card first seen at `firstJpDate`.
 *
 * Walks buckets weakest-first (see the module note) and takes only from those
 * that qualify. Returns however many it could actually cover — the caller
 * decides what an unfunded remainder means.
 */
export function spendSelectorTickets(
	buckets: SelectorTicketBucket[],
	wanted: number,
	firstJpDate: string | null | undefined
): SelectorSpendResult {
	if (wanted <= 0) return { buckets, spent: 0 }

	let remaining = wanted
	const next: SelectorTicketBucket[] = []

	for (const bucket of sortBuckets(buckets)) {
		if (remaining > 0 && isCardEligible(firstJpDate, bucket.jpCutoff)) {
			const taken = Math.min(bucket.count, remaining)
			remaining -= taken
			if (bucket.count - taken > 0) {
				next.push({ ...bucket, count: bucket.count - taken })
			}
			continue
		}
		next.push(bucket)
	}

	return { buckets: next, spent: wanted - remaining }
}
