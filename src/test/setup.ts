import '@testing-library/jest-dom'

// jsdom doesn't implement matchMedia, which some components (e.g. IncomeForm,
// which reads the mobile breakpoint once to pick its default collapsed state)
// call on mount. Provide a minimal no-match stub so those components can render
// under test — matches: false means tests see the desktop default.
if (typeof window !== 'undefined' && !window.matchMedia) {
	window.matchMedia = (query: string): MediaQueryList =>
		({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}) as MediaQueryList
}
