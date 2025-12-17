import { Outlet, Route, Routes } from "react-router-dom"
import { Navbar } from "../components/navbar/Navbar.tsx"

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
				<Route index element={<>Home</>} />
			</Route>
		</Routes>
	)
}
