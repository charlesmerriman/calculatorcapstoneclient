import { Outlet, Route, Routes } from "react-router-dom"
import { Navbar } from "../components/navbar/Navbar.tsx"
import { CaratCalculator } from "../components/carat-calculator/CaratCalculator"

export const ApplicationViews = () => {
	return (
		<Routes>
			<Route
				path="/"
				element={
					<>
						<Navbar />
						<Outlet />
					</>
				}
			>
				<Route index element={<CaratCalculator />} />
			</Route>
		</Routes>
	)
}
