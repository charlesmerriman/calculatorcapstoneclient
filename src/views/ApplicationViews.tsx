import { Outlet, Route, Routes } from "react-router-dom"
import { Navbar } from "../components/navbar/Navbar.tsx"
import { CaratCalculator } from "../components/carat-calculator/CaratCalculator"
import { Timeline } from "../components/timeline/Timeline"
import { Header } from "../components/header/Header.tsx"

export const ApplicationViews = () => {
	return (
		<Routes>
			<Route
				path="/"
				element={
					<>
						<Header />
						<Navbar />
						<Outlet />
					</>
				}
			>
				<Route index element={<CaratCalculator />} />
				<Route path="timeline" element={<Timeline />}/>
			</Route>
		</Routes>
	)
}
