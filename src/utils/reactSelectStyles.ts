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
		minHeight: "28px",
		fontSize: "12px",
		width: "100%",
		backgroundColor: "#27272f",
		borderColor: "#3c3c46",
		"&:hover": { borderColor: "#606068" }
	}),
	valueContainer: (provided: CSSObjectWithLabel) => ({
		...provided,
		minHeight: "28px",
		padding: "2px 4px",
		display: "flex",
		alignItems: "center"
	}),
	input: (provided: CSSObjectWithLabel) => ({
		...provided,
		margin: "0",
		padding: "0",
		color: "#f9fafb"
	}),
	indicatorsContainer: (provided: CSSObjectWithLabel) => ({
		...provided,
		minHeight: "28px",
		alignSelf: "flex-start"
	}),
	dropdownIndicator: (provided: CSSObjectWithLabel) => ({
		...provided,
		padding: "2px",
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
		color: "#f9fafb"
	}),
	menu: (provided: CSSObjectWithLabel) => ({
		...provided,
		zIndex: 50,
		backgroundColor: "#27272f",
		border: "1px solid #3c3c46"
	}),
	placeholder: (provided: CSSObjectWithLabel) => ({
		...provided,
		color: "#8e8e9a"
	})
}
