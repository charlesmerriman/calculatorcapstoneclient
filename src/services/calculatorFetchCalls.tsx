const API_URL = import.meta.env.VITE_API_URL

export const userCalculatorDataPatch = (userStatsData, userPlannedBannerData) => {
    return fetch(`${API_URL}/calculator-data`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Token ${localStorage.getItem("authToken")}`
				},
				body: JSON.stringify({
					user_stats_data: userStatsData,
					user_planned_banner_data: userPlannedBannerData
				})
			})
}

export const initialCalculatorDataFetch = () => {
    return fetch(`${API_URL}/calculator-data`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Token ${localStorage.getItem("authToken")}`
			}
		})
}