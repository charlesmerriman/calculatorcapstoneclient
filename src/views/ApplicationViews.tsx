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
						<div className="min-h-0 flex-1 overflow-y-auto">
							<Outlet />
						</div>
						<Footer />
					</div>
				}
			>
				<Route index element={<CaratCalculator />} />
				<Route path="timeline" element={<Timeline />}/>
			</Route>
		</Routes>
	)
}
