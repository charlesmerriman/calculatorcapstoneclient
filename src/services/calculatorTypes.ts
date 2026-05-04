/**
 * TYPESCRIPT CONCEPT: Re-export Barrel for Backward Compatibility
 *
 * This file used to contain all type definitions. Now the types live
 * in src/types/ split into logical modules. This file re-exports
 * everything so that existing imports like:
 *   import type { Uma } from "../../services/calculatorTypes"
 * continue working without changes.
 *
 * New code should import from "../types" directly.
 * This file can be removed once all imports are migrated.
 */
 
export * from "../types"