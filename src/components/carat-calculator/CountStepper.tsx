import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import { ChevronDown } from "lucide-react"
import type { CountChip, CountChipSet } from "../../utils/countChips"

/** Panel width, in px. Fixed so the horizontal placement can be computed before
 *  the panel is measured — only its HEIGHT needs a real measurement. */
const PANEL_WIDTH = 236
/** Gap between the field and the panel, and the panel and the viewport edge. */
const GAP = 6
const EDGE = 8

interface CountStepperProps {
	value: number
	onChange: (next: number) => void
	chips: CountChipSet
	/** "Pulls" / "Steps" — the pad's heading, and the trigger's aria-label. */
	label: string
	/** The NumberField this pad drives. Rendered above the trigger. */
	children: ReactNode
}

/**
 * A bulk-adjust pad for the planner's pull/step field.
 *
 * WHY A PORTAL, and not the `relative` + `absolute` idiom SettingsMenu uses:
 * this pad opens from inside the banner sheet, and the sheet is wrapped in an
 * `overflow-hidden` panel (CaratCalculator) whose rows are `motion.div`s
 * carrying `layout` transforms. In-flow, the pad would be clipped at the panel's
 * bottom edge on the last row, and a `position: fixed` fallback would resolve
 * against the transformed row rather than the viewport. A portal to <body>
 * plus a rect measured from the anchor sidesteps both, at the cost of having to
 * re-place on scroll.
 *
 * WHY IT OPENS ON FOCUS: the pad is meant to save a click, not add one. Focusing
 * the field is something you were already doing to type in it, so that is the
 * trigger; the chevron below exists for touch, and for discovery. Chips suppress
 * their own mousedown so focus never leaves the input, which is what lets you
 * click four of them in a row and keep arrow-keying afterwards.
 */
export const CountStepper = ({
	value,
	onChange,
	chips,
	label,
	children,
}: CountStepperProps) => {
	const panelId = useId()
	const [open, setOpen] = useState(false)
	const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
	const anchorRef = useRef<HTMLDivElement>(null)
	const panelRef = useRef<HTMLDivElement>(null)

	const place = useCallback((): void => {
		const anchor = anchorRef.current
		if (!anchor) return
		const rect = anchor.getBoundingClientRect()

		// visualViewport, not innerHeight: on a phone the OS keyboard is up the
		// moment this opens (focusing the field is what opened it), and only the
		// visual viewport shrinks to account for it. Measuring the layout
		// viewport would decide there is room below and place the pad under the
		// keyboard.
		const viewportHeight = window.visualViewport?.height ?? window.innerHeight
		const panelHeight = panelRef.current?.offsetHeight ?? 0

		// Centred on the field, then pulled inside both edges. The outer max()
		// is not redundant with the inner one: on a viewport narrower than the
		// panel itself the min() would otherwise return a negative left.
		const left = Math.max(
			EDGE,
			Math.min(
				Math.max(rect.left + rect.width / 2 - PANEL_WIDTH / 2, EDGE),
				window.innerWidth - PANEL_WIDTH - EDGE
			)
		)
		// Below by preference, flipped above when the room isn't there. Flipping
		// rather than scrolling the pad into view: the field it is adjusting has
		// to stay on screen, and scrolling to fit the pad is what moves it off.
		const fitsBelow = rect.bottom + GAP + panelHeight <= viewportHeight - EDGE
		const top = fitsBelow ? rect.bottom + GAP : Math.max(EDGE, rect.top - GAP - panelHeight)
		setPosition({ left, top })
	}, [])

	/**
	 * The only way this pad closes. Placement is cleared with it rather than in
	 * an effect: a stale rect left over from the last time it opened would be
	 * used for the next open's first paint, putting the pad briefly under a
	 * different row.
	 */
	const close = useCallback((): void => {
		setOpen(false)
		setPosition(null)
	}, [])

	// Layout effect, so the measured placement lands in the same frame the panel
	// first paints. Until `position` is set the panel renders invisible (below),
	// which is what keeps the unplaced first paint off screen.
	useLayoutEffect(() => {
		if (open) place()
	}, [open, place])

	useEffect(() => {
		if (!open) return

		// Capture phase: the scroll that matters may be on an ancestor, not the
		// window, and scroll events don't bubble.
		const reposition = (): void => place()
		window.addEventListener("scroll", reposition, true)
		window.addEventListener("resize", reposition)

		const handlePointerDown = (event: PointerEvent): void => {
			const target = event.target as Node
			if (anchorRef.current?.contains(target)) return
			if (panelRef.current?.contains(target)) return
			close()
		}
		const handleKeyDown = (event: KeyboardEvent): void => {
			if (event.key === "Escape") close()
		}
		document.addEventListener("pointerdown", handlePointerDown)
		document.addEventListener("keydown", handleKeyDown)

		return () => {
			window.removeEventListener("scroll", reposition, true)
			window.removeEventListener("resize", reposition)
			document.removeEventListener("pointerdown", handlePointerDown)
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [open, place, close])

	/**
	 * Close when focus leaves the field/trigger group for something that isn't
	 * the pad. This is what makes tabbing down a column of rows behave: each
	 * field opens its own pad and the one above it closes. Chips never trigger
	 * it, because they suppress the mousedown that would move focus.
	 */
	const handleBlur = (event: React.FocusEvent<HTMLDivElement>): void => {
		const next = event.relatedTarget as Node | null
		if (next && (anchorRef.current?.contains(next) || panelRef.current?.contains(next))) return
		close()
	}

	const apply = (chip: CountChip): void => {
		const next = chip.next(value)
		if (next !== value) onChange(next)
	}

	const chipClass =
		"flex h-7 min-w-0 flex-1 items-center justify-center rounded border border-gray-600 bg-gray-700 px-1 text-xs font-medium text-gray-100 transition hover:border-gray-500 hover:bg-gray-600 disabled:cursor-default disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-600"

	const renderChip = (chip: CountChip) => {
		// One rule for both rows: a button that cannot change the value is spent.
		// "Max" disables on a row already at its ceiling, "Clear" and the negative
		// deltas on a row at zero, and "Next pity" never — it always advances.
		const disabled = chip.next(value) === value
		return (
			<button
				key={chip.label}
				type="button"
				title={chip.title}
				disabled={disabled}
				className={chipClass}
				onClick={() => apply(chip)}
			>
				<span className="truncate">{chip.label}</span>
			</button>
		)
	}

	return (
		<div
			ref={anchorRef}
			className="flex flex-col items-center gap-0.5"
			onFocus={() => setOpen(true)}
			onBlur={handleBlur}
		>
			{children}

			{/* The affordance. Without it the pad is undiscoverable for anyone who
			    doesn't happen to click into the field, and unreachable on touch,
			    where there is no hover to reveal anything. Sized to fit the
			    vertical slack the reserved-copies column already proved is there
			    (h-9 input + gap + a short strip inside an h-16 row at py-1). */}
			<button
				type="button"
				aria-expanded={open}
				aria-controls={open ? panelId : undefined}
				aria-label={`Adjust ${label.toLowerCase()} in bulk`}
				title={`Adjust ${label.toLowerCase()} in bulk`}
				className={`flex h-3.5 w-full items-center justify-center rounded-sm transition ${
					open ? "text-brand" : "text-gray-500 hover:text-gray-300"
				}`}
				onMouseDown={(event) => {
					// A second press on an open pad closes it. Without this the
					// pointerdown-outside handler never sees the click (it is
					// inside the anchor) and focus re-opens it immediately.
					if (open) {
						event.preventDefault()
						close()
					}
				}}
			>
				<ChevronDown className="h-3.5 w-3.5" />
			</button>

			{open &&
				createPortal(
					<div
						ref={panelRef}
						id={panelId}
						role="group"
						aria-label={`Adjust ${label.toLowerCase()}`}
						style={{
							left: position?.left ?? 0,
							top: position?.top ?? 0,
							width: PANEL_WIDTH,
							// Invisible rather than unmounted until placed: the
							// placement needs the panel's real height, so it has to
							// be in the DOM to be measured.
							visibility: position ? "visible" : "hidden",
						}}
						className="fixed z-50 rounded-lg border border-gray-600 bg-gray-800 p-2 shadow-lg"
						// Focus never leaves the field, so the pad stays open for the
						// next click and the arrow keys keep working. On the whole
						// panel rather than each chip: a press on the pad's own dead
						// space blurs the field too, and closed it mid-use.
						onMouseDown={(event) => event.preventDefault()}
					>
						<div className="mb-1.5 flex items-baseline justify-between px-0.5">
							<span className="text-[10px] font-semibold uppercase tracking-wider text-brand">
								{label}
							</span>
							<span className="text-xs font-medium text-gray-300">{value}</span>
						</div>

						<div className="flex gap-1">{chips.deltas.map(renderChip)}</div>
						<div className="mt-1 flex gap-1">{chips.presets.map(renderChip)}</div>

						{/* The keyboard equivalents are the cheapest version of this
						    feature and the least discoverable; naming them here is
						    what makes them learnable. */}
						<div className="mt-1.5 px-0.5 text-center text-[10px] leading-tight text-gray-500">
							{chips.hint}
						</div>
					</div>,
					document.body
				)}
		</div>
	)
}
