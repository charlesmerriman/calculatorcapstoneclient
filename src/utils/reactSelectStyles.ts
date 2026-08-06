import type { CSSObjectWithLabel, StylesConfig } from "react-select"

/**
 * react-select parameterises StylesConfig by option type, but none of the
 * callbacks below read the option — they only ever style. Declaring them as
 * StylesConfig<unknown, false> made them unassignable to any concretely-typed
 * <Select<Option>>, because the props are contravariant in Option (a
 * `readonly Option[]` can't flow into a `readonly unknown[]` parameter).
 *
 * `any` here is the narrow, deliberate escape hatch for that variance: these
 * objects are genuinely option-agnostic, and the alternative — a generic
 * factory — would add a call-site ceremony that buys no real safety.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyOptionStyles = StylesConfig<any, false>

/** Standard dark text override for react-select options */
export const darkTextStyles: AnyOptionStyles = {
	option: (provided: CSSObjectWithLabel) => ({
		...provided,
		color: "#000"
	})
}

/**
 * Compact react-select styles for use in the banner row.
 * Reduces height, font size, and padding to fit the narrow layout.
 *
 * Colors reference the theme's CSS variables (var(--color-gray-*)) rather than
 * hardcoded hex so the dropdown repaints with the active [data-theme] — the
 * same tokens the Tailwind utility classes use. The variables resolve from
 * :root even for the body-portaled menu. Semantic mapping:
 *   gray-700 = control/menu surface, gray-600 = border & hover/selected option,
 *   gray-500 = control hover border, gray-400 = indicator/placeholder,
 *   gray-100 = value/option text.
 */
export const compactSelectStyles: AnyOptionStyles = {
	control: (provided: CSSObjectWithLabel) => ({
		...provided,
		// Fixed height (not minHeight) so all dropdowns are identical regardless of content
		height: "32px",
		minHeight: "32px",
		fontSize: "12px",
		width: "100%",
		backgroundColor: "var(--color-gray-700)",
		borderColor: "var(--color-gray-600)",
		flexWrap: "nowrap",
		"&:hover": { borderColor: "var(--color-gray-500)" }
	}),
	valueContainer: (provided: CSSObjectWithLabel) => ({
		...provided,
		height: "32px",
		padding: "0 6px",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		flexWrap: "nowrap"
	}),
	input: (provided: CSSObjectWithLabel) => ({
		...provided,
		margin: "0",
		padding: "0",
		color: "var(--color-gray-100)"
	}),
	indicatorsContainer: (provided: CSSObjectWithLabel) => ({
		...provided,
		height: "32px",
		alignItems: "center"
	}),
	dropdownIndicator: (provided: CSSObjectWithLabel) => ({
		...provided,
		padding: "2px 4px",
		color: "var(--color-gray-400)"
	}),
	option: (provided: CSSObjectWithLabel, state: { isSelected: boolean; isFocused: boolean }) => ({
		...provided,
		color: "var(--color-gray-100)",
		fontSize: "12px",
		padding: "4px 8px",
		backgroundColor: state.isSelected || state.isFocused ? "var(--color-gray-600)" : "var(--color-gray-700)"
	}),
	singleValue: (provided: CSSObjectWithLabel) => ({
		...provided,
		fontSize: "12px",
		color: "var(--color-gray-100)",
		textAlign: "center",
		width: "100%"
	}),
	// menuPortal controls the z-index of the body-attached portal wrapper when
	// menuPortalTarget={document.body} is set. Without this, the portal renders
	// at the default stacking level and gets buried behind other elements.
	//
	// Call sites pair the portal with menuPosition="fixed". The portal attaches to
	// <body>, but the control can sit inside a scroll container (the app shell's
	// vertical scroller, or the banner table's horizontal one) — with the default
	// absolute positioning the menu is placed against the body and visibly detaches
	// from its control the moment that container scrolls.
	menuPortal: (provided: CSSObjectWithLabel) => ({
		...provided,
		zIndex: 9999,
	}),
	menu: (provided: CSSObjectWithLabel) => ({
		...provided,
		backgroundColor: "var(--color-gray-700)",
		border: "1px solid var(--color-gray-600)"
	}),
	placeholder: (provided: CSSObjectWithLabel) => ({
		...provided,
		color: "var(--color-gray-400)",
		textAlign: "center",
		width: "100%"
	})
}

/**
 * The banner selector when a row has fallen back to its card layout.  The
 * selected banner belongs in the coloured card header alongside its artwork,
 * rather than looking like a second, unrelated form field beneath it.
 *
 * Menu styles intentionally inherit from compactSelectStyles so the portaled
 * menu remains consistent with the desktop selector and every active theme.
 */
export const mobileBannerSelectStyles: AnyOptionStyles = {
	...compactSelectStyles,
	control: (provided: CSSObjectWithLabel) => ({
		...provided,
		height: "auto",
		minHeight: "40px",
		width: "100%",
		backgroundColor: "transparent",
		borderColor: "transparent",
		boxShadow: "none",
		"&:hover": { borderColor: "transparent" },
	}),
	valueContainer: (provided: CSSObjectWithLabel) => ({
		...provided,
		height: "40px",
		padding: "0",
		justifyContent: "flex-start",
	}),
	indicatorsContainer: (provided: CSSObjectWithLabel) => ({
		...provided,
		height: "40px",
	}),
	indicatorSeparator: () => ({ display: "none" }),
	dropdownIndicator: (provided: CSSObjectWithLabel) => ({
		...provided,
		padding: "4px",
		color: "var(--color-gray-300)",
	}),
	singleValue: (provided: CSSObjectWithLabel) => ({
		...provided,
		maxWidth: "100%",
		margin: 0,
		color: "var(--color-gray-100)",
		fontSize: "clamp(0.875rem, 2vw, 1rem)",
		fontWeight: 500,
		textAlign: "left",
		whiteSpace: "nowrap",
		overflow: "hidden",
		textOverflow: "ellipsis",
	}),
	placeholder: (provided: CSSObjectWithLabel) => ({
		...provided,
		margin: 0,
		color: "var(--color-gray-200)",
		fontSize: "clamp(0.875rem, 2vw, 1rem)",
		textAlign: "left",
		whiteSpace: "nowrap",
		overflow: "hidden",
		textOverflow: "ellipsis",
	}),
}
