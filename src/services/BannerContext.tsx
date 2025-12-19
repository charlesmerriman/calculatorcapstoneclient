import { createContext, useContext } from "react"
import type { BannerContextType } from "./bannerTypes"

export const BannerContext = createContext<BannerContextType | undefined>(
	undefined
)

export const useBannerData = () => {
	const context = useContext(BannerContext)

	if (context === undefined) {
		throw new Error("useBannerData must be used within a BannerProvider")
	}

	return context
}
