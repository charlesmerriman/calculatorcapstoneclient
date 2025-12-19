import React, { useEffect, useState } from "react"
import { BannerContext } from "./BannerContext"
import type { Banner } from "./bannerTypes"

type BannerProviderProps = {
	children: React.ReactNode
}

export const BannerProvider = ({ children }: BannerProviderProps) => {
	const [banners, setBanners] = useState<Banner[] | null>(null)

	useEffect(() => {
		fetch("http://localhost:8000/banners", {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Token ${localStorage.getItem("authToken")}`
			}
		})
			.then((response) => response.json())
			.then((data: Banner[]) => setBanners(data))
			.catch((error) => console.error("Error fetching banners:", error))
	}, [])

	const value = {
		banners,
		setBanners
	}

	return (
		<BannerContext.Provider value={value}>{children}</BannerContext.Provider>
	)
}
