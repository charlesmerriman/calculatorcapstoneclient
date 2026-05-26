import { useEffect, useRef, useState } from "react"
import { Palette } from "lucide-react"
import { useTheme } from "../../services/ThemeContext"

export const ThemePicker = () => {
	const { activeTheme, themes, setTheme } = useTheme()
	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	// Close dropdown when clicking outside
	useEffect(() => {
		if (!open) return
		const handlePointerDown = (e: PointerEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setOpen(false)
			}
		}
		document.addEventListener("pointerdown", handlePointerDown)
		return () => document.removeEventListener("pointerdown", handlePointerDown)
	}, [open])

	return (
		<div ref={containerRef} className="relative">
			<button
				onClick={() => setOpen((prev) => !prev)}
				aria-label="Change color theme"
				title="Change color theme"
				className="flex h-9 w-9 items-center justify-center rounded border border-gray-700 text-gray-300 transition hover:border-gray-500 hover:bg-gray-800 hover:text-white"
			>
				<Palette className="h-4 w-4" />
			</button>

			{open && (
				<div className="absolute right-0 top-full mt-1.5 z-50 flex flex-col gap-1 rounded border border-gray-600 bg-gray-800 p-2 shadow-lg">
					{themes.map((theme) => (
						<button
							key={theme.id}
							onClick={() => { setTheme(theme.id); setOpen(false) }}
							aria-label={`Switch to ${theme.label} theme`}
							aria-pressed={activeTheme === theme.id}
							className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs transition ${
								activeTheme === theme.id
									? "bg-gray-700 text-white"
									: "text-gray-300 hover:bg-gray-700 hover:text-white"
							}`}
						>
							{/* Static hex, not var(--color-brand) — all swatches visible at once */}
							<span
								className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/20"
								style={{ backgroundColor: theme.swatch }}
							/>
							{theme.label}
						</button>
					))}
				</div>
			)}
		</div>
	)
}
