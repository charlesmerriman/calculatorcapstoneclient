import type { CSSObjectWithLabel, StylesConfig } from "react-select"

/** Standard dark text override for react-select options */
export const darkTextStyles: StylesConfig<unknown, false> = {
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
export const compactSelectStyles: StylesConfig<unknown, false> = {
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
