import "./App.css"
import { Route, Routes } from "react-router-dom"
import { ApplicationViews } from "./views/ApplicationViews.js"
import { Login } from "./components/auth/Login.js"
import { Register } from "./components/auth/Register.js"
import { Authorized } from "./views/Authorized.js"
import { CalculatorProvider } from "./services/CalculatorProvider.js"

function App() {
	return (
		<Routes>
			<Route path="/login" element={<Login />} />
			<Route path="/register" element={<Register />} />
			<Route
				path="*"
				element={
					<Authorized>
						<CalculatorProvider>
							<ApplicationViews />
						</CalculatorProvider>
					</Authorized>
				}
			/>
		</Routes>
	)
}

export default App
