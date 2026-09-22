export const GPA_CONFIGS = {
	katyWeighted: {
		labels: {
			A: "90-100",
			B: "80-89",
			C: "70-79",
			D: "60-69",
			F: "0-59"
		},
		classes: {
			KAP: {
				A: 5.0,
				B: 4.0,
				C: 3.0,
				D: 2.0,
				F: 0.0
			},
			AP: {
				A: 5.0,
				B: 4.0,
				C: 3.0,
				D: 2.0,
				F: 0.0
			},
			DC: {
				A: 4.5,
				B: 3.5,
				C: 2.5,
				D: 1.5,
				F: 0.0
			},
			ACA: {
				A: 4.0,
				B: 3.0,
				C: 2.0,
				D: 1.0,
				F: 0.0
			}
		}
	},
	unweighted: {
		labels: {
			A: "90-100",
			B: "80-89",
			C: "70-79",
			D: "60-69",
			F: "0-59"
		},
		classes: {
			"*": {
				A: 4.0,
				B: 3.0,
				C: 2.0,
				D: 1.0,
				F: 0.0
			}
		}
	},
	unweightedSpecial: {
		labels: {
			"A+": "97-100",
			"A": "93-96",
			"A-": "90-92",
			"B+": "87-89",
			"B": "83-86",
			"B-": "80-82",
			"C+": "77-79",
			"C": "73-76",
			"C-": "70-72",
			"D+": "67-69",
			"D": "63-66",
			"D-": "60-62",
			"F": "0-59"
		},
		classes: {
			"*": {
				"A+": 4.0,
				"A": 4.0,
				"A-": 3.7,
				"B+": 3.3,
				"B": 3.0,
				"B-": 2.7,
				"C+": 2.3,
				"C": 2.0,
				"C-": 1.7,
				"D+": 1.3,
				"D": 1.0,
				"D-": 0.7,
				"F": 0.0
			}
		}
	},
	cyFairWeighted: {
		labels: {
			"A": "90-100",
			"B": "80-89",
			"C+": "75-79",
			"C-": "70-74",
			"F": "0-69"
		},
		classes: {
			"K": {
				"A": 7.0,
				"B": 6.0,
				"C+": 5.0,
				"C-": 4.0,
				"F": 0.0
			},
			"AP": {
				"A": 7.0,
				"B": 6.0,
				"C+": 5.0,
				"C-": 4.0,
				"F": 0.0
			},
			"HORIZONS": {
				"A": 7.0,
				"B": 6.0,
				"C+": 5.0,
				"C-": 4.0,
				"F": 0.0
			},
			"On Level": {
				"A": 6.0,
				"B": 5.0,
				"C+": 4.0,
				"C-": 3.0,
				"F": 0.0
			},
			"Below Level": {
				"A": 5.0,
				"B": 4.0,
				"C+": 3.0,
				"C-": 2.0,
				"F": 0.0
			},
			"Life Skills": {
				"A": 4.0,
				"B": 3.0,
				"C+": 2.0,
				"C-": 1.0,
				"F": 0.0
			}
		}
	}
}

/**
 * The letter band a numeric grade falls in.
 *
 * Grades that fall outside every band — extra credit above the top bound (a 101
 * against an `A: '90-100'` band) or a negative — clamp to the nearest band
 * instead of returning null. Returning null here silently dropped the course
 * from the GPA entirely, which is far worse than rounding it into the top band.
 */
export function letterForGrade(num, labels) {
	if (!Number.isFinite(num)) return null
	let highest = null
	let lowest = null
	for (const [letter, range] of Object.entries(labels)) {
		const [min, max] = range.split('-').map(Number)
		if (!Number.isFinite(min) || !Number.isFinite(max)) continue
		if (num >= min && num <= max) return letter
		if (!highest || max > highest.max) highest = { letter, max }
		if (!lowest || min < lowest.min) lowest = { letter, min }
	}
	if (highest && num > highest.max) return highest.letter
	if (lowest && num < lowest.min) return lowest.letter
	return null
}
