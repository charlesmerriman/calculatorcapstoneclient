import { Outlet, Route, Routes } from "react-router-dom"
import { Navbar } from "../components/navbar/Navbar.tsx"
import { CaratCalculator } from "../components/carat-calculator/CaratCalculator"
import { Timeline } from "../components/timeline/Timeline"

export const ApplicationViews = () => {
	return (
		<Routes>
			<Route
				path="/"
				element={
					<div className="flex flex-col h-screen overflow-hidden">
						<Navbar />
						<div className="flex-1 overflow-y-auto">
							<Outlet />
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
