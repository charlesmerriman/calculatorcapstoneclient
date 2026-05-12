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
 */
export const compactSelectStyles: StylesConfig<unknown, false> = {
	control: (provided: CSSObjectWithLabel) => ({
		...provided,
		// Fixed height (not minHeight) so all dropdowns are identical regardless of content
		height: "32px",
		minHeight: "32px",
		fontSize: "12px",
		width: "100%",
		backgroundColor: "#27272f",
		borderColor: "#3c3c46",
		flexWrap: "nowrap",
		"&:hover": { borderColor: "#606068" }
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
		color: "#f9fafb"
	}),
	indicatorsContainer: (provided: CSSObjectWithLabel) => ({
		...provided,
		height: "32px",
		alignItems: "center"
	}),
	dropdownIndicator: (provided: CSSObjectWithLabel) => ({
		...provided,
		padding: "2px 4px",
		color: "#8e8e9a"
	}),
	option: (provided: CSSObjectWithLabel, state: { isSelected: boolean; isFocused: boolean }) => ({
		...provided,
		color: "#f9fafb",
		fontSize: "12px",
		padding: "4px 8px",
		backgroundColor: state.isSelected ? "#3c3c46" : state.isFocused ? "#3c3c46" : "#27272f"
	}),
	singleValue: (provided: CSSObjectWithLabel) => ({
		...provided,
		fontSize: "12px",
		color: "#f9fafb",
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
		backgroundColor: "#27272f",
		border: "1px solid #3c3c46"
	}),
	placeholder: (provided: CSSObjectWithLabel) => ({
		...provided,
		color: "#8e8e9a",
		textAlign: "center",
		width: "100%"
	})
}
