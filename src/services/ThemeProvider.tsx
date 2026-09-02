import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { ThemeContext } from "./ThemeContext"
import type { ThemeConfig } from "./ThemeContext"

const STORAGE_KEY = "uma-planner-theme"
const COLORBLIND_MODE_STORAGE_KEY = "uma-planner-colorblind-mode"
const DEFAULT_THEME = "gold"

// To add a new theme: add one entry here AND add a [data-theme="x"] block in index.css
const THEMES: ThemeConfig[] = [
	{ id: "gold",     label: "Default",  swatch: "#E6D28A" },
	{ id: "gilded",   label: "Gilded",   swatch: "#f1cf75" },
	{ id: "midnight", label: "Midnight", swatch: "#F6C84F" },
	{ id: "race-day", label: "Pace",     swatch: "#7cc8ff" },
	{ id: "violet",   label: "Violet",   swatch: "#C4B5FD" },
	{ id: "teal",     label: "Teal",     swatch: "#5EEAD4" },
	{ id: "light",    label: "Light",    swatch: "#fbf2ed" },
]

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
	const [activeTheme, setActiveTheme] = useState<string>(() => {
		const stored = localStorage.getItem(STORAGE_KEY)
		const id = THEMES.some((t) => t.id === stored) ? stored! : DEFAULT_THEME
		// Set synchronously before first paint so there's no color flash on load
		document.documentElement.setAttribute("data-theme", id)
		return id
	})
	const [colorblindMode, setColorblindModeState] = useState<boolean>(() => {
		const enabled = localStorage.getItem(COLORBLIND_MODE_STORAGE_KEY) === "true"
		// Keep the status palette in place before the app first paints, just like
		// the selected theme above.
		document.documentElement.setAttribute("data-colorblind-mode", String(enabled))
		return enabled
	})

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", activeTheme)
	}, [activeTheme])

	useEffect(() => {
		document.documentElement.setAttribute("data-colorblind-mode", String(colorblindMode))
	}, [colorblindMode])

	const setTheme = (id: string) => {
		if (!THEMES.some((t) => t.id === id)) return
		localStorage.setItem(STORAGE_KEY, id)
		setActiveTheme(id)
	}

	const setColorblindMode = (enabled: boolean) => {
		localStorage.setItem(COLORBLIND_MODE_STORAGE_KEY, String(enabled))
		setColorblindModeState(enabled)
	}

	return (
		<ThemeContext.Provider value={{
			activeTheme,
			themes: THEMES,
			setTheme,
			colorblindMode,
			setColorblindMode
		}}>
			{children}
		</ThemeContext.Provider>
	)
}
