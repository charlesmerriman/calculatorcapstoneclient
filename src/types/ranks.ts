/**
 * Rank type definitions.
 *
 * These all share the same shape (id, name, income_amount).
 * You might wonder: why not just have one `Rank` type?
 *
 * TYPESCRIPT CONCEPT: Nominal vs Structural Typing
 * TypeScript uses structural typing — if two types have the same shape,
 * they're interchangeable. That means a function expecting ClubRank would
 * happily accept a TeamTrialsRank since they look identical.
 *
 * We keep them separate anyway because:
 * 1. They represent different domain concepts (a ClubRank IS NOT a TeamTrialsRank)
 * 2. As the app grows, they may diverge (e.g., TeamTrialsRank might gain new fields)
 * 3. It makes the code self-documenting — a function signature tells you
 *    exactly which rank it expects
 *
 * If you wanted true nominal typing, you could use branded types:
 *   type ClubRank = BaseRank & { readonly _brand: 'ClubRank' }
 * But that's overkill for this project.
 */

export interface ClubRank {
	id: number
	name: string
	income_amount: number
}

/**
 * NOTE: This was originally misspelled as "TeamTrailsRank" throughout the codebase.
 * Fixed to "TeamTrialsRank" to match the backend model name.
 * The old name is exported as an alias below for any code not yet updated.
 */
export interface TeamTrialsRank {
	id: number
	name: string
	income_amount: number
}

/**
 * TYPESCRIPT CONCEPT: Type Aliases for Backward Compatibility
 * When renaming a type, you can export the old name as an alias so you don't
 * have to update every file at once. Remove this once all references are migrated.
 * @deprecated Use TeamTrialsRank instead
 */
export type TeamTrailsRank = TeamTrialsRank

export interface ChampionsMeetingRank {
	id: number
	name: string
	income_amount: number
}