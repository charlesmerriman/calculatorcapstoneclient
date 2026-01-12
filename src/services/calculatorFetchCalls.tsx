export const userCalculatorDataPatch = (userStatsData, userPlannedBannerData) => {
    return fetch("http://localhost:8000/calculator-data", {
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
    return fetch("http://localhost:8000/calculator-data", {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Token ${localStorage.getItem("authToken")}`
			}
		})
}