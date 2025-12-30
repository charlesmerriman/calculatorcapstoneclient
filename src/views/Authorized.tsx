import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"

interface AuthorizedProps {
    children: ReactNode
}

export const Authorized = ({ children }: AuthorizedProps) => {
	const location = useLocation()

	if (localStorage.getItem("authToken")) {
		return children
	}

	else {
		return <Navigate to={`/login`} state={{ from: location }} replace />
	}
}