import { Outlet, Route, Routes } from "react-router-dom"
import { Navbar } from "../components/navbar/Navbar.tsx"
import { CaratCalculator } from "../components/carat-calculator/CaratCalculator"
import { Timeline } from "../components/timeline/Timeline"
import { Footer } from "../components/footer/Footer.tsx"

export const ApplicationViews = () => {
	return (
		<Routes>
			<Route
				path="/"
				element={
					<div className="flex min-h-dvh flex-col bg-gray-900 md:h-dvh md:overflow-hidden">
						<Navbar />
						{/* The footer sits INSIDE the scroll region, not as a sibling of it: on
						    desktop this shell is a fixed-height, no-scroll frame (md:h-dvh
						    md:overflow-hidden), so a footer outside the scroller would be
						    permanently pinned to the bottom of the screen. Inside, it scrolls
						    away with the calculator/timeline content like on every other page.

						    The scroller is itself a flex column so the page wrapper below can
						    absorb any leftover height: with the income panel collapsed and few
						    banner rows, the slack goes ABOVE the footer instead of below it.
						    Otherwise that slack renders as gray-900 directly beneath a gray-900
						    footer, and the footer's top border makes the whole band read as one
						    enormous footer. */}
						<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
							{/* Plain block wrapper (not <Outlet /> directly) so the calculator and
							    timeline keep a normal block formatting context and don't become
							    flex items themselves. flex-1 grows it into the slack; min-height:auto
							    stops it shrinking below its content, so tall content still scrolls. */}
							<div className="flex-1">
								<Outlet />
							</div>
							<Footer />
						</div>
					</div>
				}
			>
				<Route index element={<CaratCalculator />} />
				<Route path="timeline" element={<Timeline />}/>
			</Route>
		</Routes>
	)
}
