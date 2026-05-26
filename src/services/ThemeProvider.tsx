import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { ThemeContext } from "./ThemeContext"
import type { ThemeConfig } from "./ThemeContext"

const STORAGE_KEY = "uma-planner-theme"
const DEFAULT_THEME = "gold"

// To add a new theme: add one entry here AND add a [data-theme="x"] block in index.css
const THEMES: ThemeConfig[] = [
	{ id: "gold",     label: "Default",  swatch: "#E6D28A" },
	{ id: "midnight", label: "Midnight", swatch: "#F6C84F" },
	{ id: "violet",   label: "Violet",   swatch: "#C4B5FD" },
	{ id: "teal",     label: "Teal",     swatch: "#5EEAD4" },
]

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
	const [activeTheme, setActiveTheme] = useState<string>(() => {
		const stored = localStorage.getItem(STORAGE_KEY)
		const id = THEMES.some((t) => t.id === stored) ? stored! : DEFAULT_THEME
		// Set synchronously before first paint so there's no color flash on load
		document.documentElement.setAttribute("data-theme", id)
		return id
	})

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", activeTheme)
	}, [activeTheme])

	const setTheme = (id: string) => {
		if (!THEMES.some((t) => t.id === id)) return
		localStorage.setItem(STORAGE_KEY, id)
		setActiveTheme(id)
	}

	return (
		<ThemeContext.Provider value={{ activeTheme, themes: THEMES, setTheme }}>
			{children}
		</ThemeContext.Provider>
	)
}
