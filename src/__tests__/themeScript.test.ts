// @vitest-environment node
//
// index.html carries an inline script that sets the theme attributes before first
// paint, and it necessarily duplicates the theme ids and storage keys from
// themeStore.ts (it runs before any module does). This is the drift guard: add a
// theme, or rename a key, and this fails until the script agrees.
import { describe, expect, it } from "vitest"
import html from "../../index.html?raw"
import {
	COLORBLIND_MODE_STORAGE_KEY,
	DEFAULT_THEME,
	getThemeMode,
	THEMES,
	THEME_STORAGE_KEY,
} from "../services/themeStore"

const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? ""

describe("the inline theme script in index.html", () => {
	it("exists and runs before anything else in <head>", () => {
		expect(script).toContain("data-theme")
		expect(html.indexOf("<script>")).toBeLessThan(html.indexOf("<title>"))
	})

	it("knows every theme id and the default", () => {
		const listed = script.match(/var themes = \[([^\]]*)\]/)?.[1] ?? ""
		const ids = [...listed.matchAll(/"([^"]+)"/g)].map((match) => match[1])
		expect(ids.sort()).toEqual(THEMES.map((theme) => theme.id).sort())
		expect(script).toContain(`"${DEFAULT_THEME}"`)
	})

	it("reads the same storage keys the store writes", () => {
		expect(script).toContain(`"${THEME_STORAGE_KEY}"`)
		expect(script).toContain(`"${COLORBLIND_MODE_STORAGE_KEY}"`)
	})

	it.each(THEMES)("restores $id and its mode before first paint", (theme) => {
		const attributes: Record<string, string> = {}
		// Run the repo's inline script with only its two browser dependencies.
		const runScript = new Function("localStorage", "document", script)
		runScript(
			{
				getItem: (key: string) => key === THEME_STORAGE_KEY ? theme.id : "true",
			},
			{
				documentElement: {
					setAttribute: (name: string, value: string) => { attributes[name] = value },
				},
			},
		)
		expect(attributes).toEqual({
			"data-theme": theme.id,
			"data-theme-mode": theme.mode,
			"data-colorblind-mode": "true",
		})
		expect(getThemeMode(theme.id)).toBe(theme.mode)
	})
})
