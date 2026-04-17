import { useCallback, useEffect, useRef, useState } from "react"

interface UseAutoSaveParams {
	saveFn: () => void
	delayMs?: number
}

/**
 * Manages a debounced auto-save with a visual indicator.
 * Returns `timerIsGoing` (whether a save is pending) and `saveNow` (to flush immediately).
 * The hook also registers a beforeunload warning when a save is pending.
 */
export function useAutoSave({ saveFn, delayMs = 5000 }: UseAutoSaveParams) {
	const [timerIsGoing, setTimerIsGoing] = useState(false)
	const timer = useRef<number | null>(null)
	const saveFnRef = useRef(saveFn)

	// Keep the save function ref current without triggering re-renders
	useEffect(() => {
		saveFnRef.current = saveFn
	}, [saveFn])

	// Warn on page unload if a save is pending
	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (timerIsGoing) {
				e.preventDefault()
				e.returnValue = ""
			}
		}
		window.addEventListener("beforeunload", handleBeforeUnload)
		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload)
		}
	}, [timerIsGoing])

	const startTimer = useCallback(() => {
		if (timer.current) {
			clearTimeout(timer.current)
		}
		setTimerIsGoing(true)
		timer.current = window.setTimeout(() => {
			saveFnRef.current()
			setTimerIsGoing(false)
		}, delayMs)
	}, [delayMs])

	const saveNow = useCallback(() => {
		if (timer.current) {
			clearTimeout(timer.current)
		}
		saveFnRef.current()
		setTimerIsGoing(false)
	}, [])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (timer.current) {
				clearTimeout(timer.current)
			}
		}
	}, [])

	return { timerIsGoing, startTimer, saveNow }
}