import { useState } from "react"

/**
 * A whole-number entry field: text under the hood, spin button to assistive
 * tech, and no native spinner arrows.
 *
 * It exists because `<input type="number">` failed this app in two ways that
 * users reported on the planner's "# Pulls" field.
 *
 * 1. THE LEADING ZERO WOULD NOT GO AWAY. A controlled number input whose
 *    `value` prop is a NUMBER takes React's number-input branch, which compares
 *    the DOM's text to the incoming value with LOOSE equality (react-dom's
 *    `updateInput`: `element.value != value`). Type `5` into a field showing
 *    `0` and the DOM holds `"05"`; our state correctly becomes `5`; `"05" != 5`
 *    coerces to FALSE, so React decides nothing needs writing and the stale
 *    `"05"` stays on screen. State and display silently disagree from then on.
 *    Holding the DISPLAY as a string is what fixes it — string-vs-string uses
 *    the comparison you'd expect — and `sanitise` below is what actually drops
 *    the zero.
 *
 *    The same quirk had a nastier second face: clicking the LEFT of the `0` put
 *    the caret before it, so typing `5` gave `"50"` and stored FIFTY. Selecting
 *    the field's contents on focus retires that one.
 *
 * 2. THE SPIN ARROWS WERE IN THE WAY. They were opt-in through a `.spin-arrows`
 *    class that positioned them ON TOP of the value to stop them eating the
 *    56px field's width. `type="text"` removes them at the source — along with
 *    the wheel-over-a-focused-number-input behaviour, which silently edited a
 *    plan whenever someone scrolled the sheet with a field focused.
 *
 * `role="spinbutton"` is kept rather than dropping to a plain textbox because
 * ArrowUp/ArrowDown still step the value (`handleKeyDown`) — that is what makes
 * the role honest — and it keeps screen readers announcing a number rather than
 * free text.
 */
type NumberFieldProps = {
	value: number
	onChange: (value: number) => void
	className?: string
	title?: string
	ariaLabel?: string
	ariaInvalid?: boolean
	disabled?: boolean
	/**
	 * Step for Shift+Arrow. Defaults to 10, which is what every field here used
	 * before the planner's pull field needed its own ruler.
	 */
	mediumStep?: number
	/**
	 * Step for Ctrl/Cmd+Arrow. Omitted on most fields — there is no third
	 * meaningful quantity for a reserved-copies or a resource box, and binding a
	 * modifier to "same as Shift" teaches a shortcut that does nothing.
	 */
	largeStep?: number
}

/**
 * Whatever was typed or pasted, reduced to the display string for a whole,
 * non-negative count. Returns "" for an empty box, which is a legal state
 * WHILE TYPING (see `handleBlur`).
 */
const sanitise = (raw: string): string => {
	const trimmed = raw.trim()
	if (trimmed === "") return ""

	// A negative clamps to the floor, which is what `min={0}` meant on the old
	// number input. Checked before the digit pass below, which would otherwise
	// read "-5" as 5.
	if (trimmed.startsWith("-")) return "0"

	// Whole counts only, so everything from the first decimal point onward is
	// dropped — flooring "2.7" to 2. Deliberately a truncation rather than
	// stripping the "." out of the string: strip-the-dot turns a pasted "2.7"
	// into 27, and a tenfold error in a pull count is exactly the kind that
	// reaches getExactProbability and the carat deduction unnoticed.
	// Non-digits go last, so a pasted "1,000" still arrives as 1000.
	const digits = trimmed.split(".")[0].replace(/[^0-9]/g, "")
	if (digits === "") return ""

	// Nine digits is orders of magnitude past any real plan, and it keeps the
	// value inside the range String() prints in full — Number("1e21") comes back
	// as "1e+21", which would put exponential notation in the box and a float on
	// the wire.
	// Number() then String() is what drops the leading zero: "05" -> 5 -> "5".
	return String(Number(digits.slice(0, 9)))
}

export const NumberField = ({
	value,
	onChange,
	mediumStep = 10,
	largeStep,
	className,
	title,
	ariaLabel,
	ariaInvalid,
	disabled,
}: NumberFieldProps) => {
	const [draft, setDraft] = useState(() => String(value))

	// The last `value` this field reconciled with, whether it came from us or
	// from the parent. Its job is to tell those two apart: the prop arriving
	// back as the number we just emitted is our own echo and must NOT overwrite
	// the draft — that would fight the caret mid-type and re-fill a box the user
	// deliberately cleared.
	const [syncedValue, setSyncedValue] = useState(value)

	// Compared during render, not in an effect. This is React's documented way
	// to reset state when a prop changes: it re-renders before the browser
	// paints, where an effect would paint the stale draft first and then correct
	// it. Reaching here means a genuinely EXTERNAL change — a different banner
	// selected into this row, guest data migrating in after sign-in, or a parent
	// that clamped what we sent.
	if (value !== syncedValue) {
		setSyncedValue(value)
		setDraft(String(value))
	}

	const commit = (next: string): void => {
		setDraft(next)
		// An empty box reads as zero to everything downstream; only the DISPLAY
		// is allowed to be blank.
		const parsed = next === "" ? 0 : Number(next)
		setSyncedValue(parsed)
		// Emitted on every change, including one that resolves to the number the
		// parent already holds. That matches what the old inline handlers did,
		// so auto-save and the projection see exactly the traffic they saw
		// before.
		onChange(parsed)
	}

	// What `type="number"` used to give free, and what keeps role="spinbutton"
	// accurate. Shift for a coarser step follows the browsers' own convention;
	// Ctrl/Cmd for a coarser one still is this app's own addition, and exists so
	// the planner's bulk-adjust pad (CountStepper) has a keyboard equivalent
	// rather than being the only way to move a count in bulk. The pad's footer
	// is where these are advertised.
	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
		if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
		event.preventDefault()
		// Largest modifier wins, so Ctrl+Shift is the large step rather than
		// something between the two.
		const magnitude =
			largeStep !== undefined && (event.ctrlKey || event.metaKey)
				? largeStep
				: event.shiftKey
				? mediumStep
				: 1
		const step = magnitude * (event.key === "ArrowUp" ? 1 : -1)
		const current = draft === "" ? 0 : Number(draft)
		commit(String(Math.max(0, current + step)))
	}

	// Clearing the field is allowed while typing — that is how the old `0` gets
	// replaced rather than typed around — but an empty box must not be LEFT on
	// screen, where it reads as "unanswered" when the stored value is 0.
	const handleBlur = (): void => {
		if (draft === "") setDraft("0")
	}

	return (
		<input
			type="text"
			inputMode="numeric"
			// iOS pairs this pattern with inputMode to show the plain digit pad
			// rather than the full keyboard.
			pattern="[0-9]*"
			autoComplete="off"
			role="spinbutton"
			aria-valuenow={draft === "" ? 0 : Number(draft)}
			aria-valuemin={0}
			value={draft}
			className={className}
			title={title}
			aria-label={ariaLabel}
			aria-invalid={ariaInvalid}
			disabled={disabled}
			// Select on focus, so the first keystroke REPLACES the current value
			// instead of appending to it. This is the headline fix: a field
			// showing 0 that you click and type 150 into now reads 150.
			onFocus={(event) => event.target.select()}
			onChange={(event) => commit(sanitise(event.target.value))}
			onKeyDown={handleKeyDown}
			onBlur={handleBlur}
		/>
	)
}
