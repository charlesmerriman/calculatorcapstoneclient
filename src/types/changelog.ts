/**
 * Changelog (patch notes) types.
 *
 * These mirror the /changelog API shape. Each entry is one dated patch note
 * with a list of individual changes, each tagged with a category.
 */

/** The kind of change a single patch-note line describes. */
export type ChangeCategory = "added" | "fixed" | "changed"

export interface ChangelogChange {
	id: number
	category: ChangeCategory
	text: string
	/** Author-set display order within an entry (lower shows first). */
	order: number
}

export interface ChangelogEntry {
	id: number
	title: string
	/** Optional short version label (e.g. "v1.2"); empty string when unset. */
	version: string
	/** ISO date string, e.g. "2026-07-16". */
	date: string
	changes: ChangelogChange[]
}
