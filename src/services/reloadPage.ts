/**
 * A full page load, as a function of its own.
 *
 * Only so a test can replace it: jsdom's `window.location.reload` is neither
 * implemented nor replaceable, and CalculatorProvider reloads when the sign-in
 * state changes underneath a tab (see `loadedAsRef` there).
 */
export function reloadPage(): void {
	window.location.reload()
}
