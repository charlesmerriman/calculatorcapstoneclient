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
		height: "28px",
		fontSize: "12px"
	}),
	valueContainer: (provided: CSSObjectWithLabel) => ({
		...provided,
		height: "28px",
		padding: "0 4px"
	}),
	input: (provided: CSSObjectWithLabel) => ({
		...provided,
		margin: "0",
		padding: "0"
	}),
	indicatorsContainer: (provided: CSSObjectWithLabel) => ({
		...provided,
		height: "28px"
	}),
	dropdownIndicator: (provided: CSSObjectWithLabel) => ({
		...provided,
		padding: "2px"
	}),
	option: (provided: CSSObjectWithLabel) => ({
		...provided,
		color: "#000",
		fontSize: "12px",
		padding: "4px 8px"
	}),
	singleValue: (provided: CSSObjectWithLabel) => ({
		...provided,
		fontSize: "12px"
	})
}