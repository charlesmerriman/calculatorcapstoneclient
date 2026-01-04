export const MLBChanceDisplay = ({ pulls }) => {
	const gachaChance = 0.03
	const spark = 200

	return (
		<div className="border h-full grid grid-cols-2">
			<div className="border flex items-center justify-center">Zero: I</div>
			<div className="border flex items-center justify-center">
				LB 0: Haven't
			</div>
			<div className="border flex items-center justify-center">
				LB 1: Figured
			</div>
			<div className="border flex items-center justify-center">LB 2: This</div>
			<div className="border flex items-center justify-center">LB 3: Out</div>
			<div className="border flex items-center justify-center">MLB: Yet</div>
		</div>
	)
}
