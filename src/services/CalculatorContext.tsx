/**
 * TYPESCRIPT CONCEPT: Context with Strict Null Checking
 *
 * createContext<T | undefined>(undefined) is the standard pattern for
 * contexts that aren't available until a Provider wraps the tree.
 * The custom hook below throws if the context is undefined, which:
 *   1. Gives a clear error message at runtime
 *   2. Narrows the return type from `T | undefined` to just `T`
 *      so consumers never have to null-check the context value
 */

import { createContext, useContext } from "react"
import type { CalculatorContextType } from "../types"

export const CalculatorContext = createContext<
	CalculatorContextType | undefined
>(undefined)

export const useCalculatorData = (): CalculatorContextType => {
	const context = useContext(CalculatorContext)

	if (context === undefined) {
		throw new Error("useCalculatorData must be used within a CalculatorProvider")
	}

	return context
}