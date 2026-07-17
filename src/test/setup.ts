import '@testing-library/jest-dom'

// jsdom doesn't implement matchMedia, which some components (e.g. Navbar's
// responsive state) call on mount. Provide a minimal no-match stub so those
// components can render under test.
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
