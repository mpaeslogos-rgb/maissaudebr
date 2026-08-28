// Generates a CPF with valid check digits (same algorithm as lib/cpf.ts
// validateCpf) from a numeric seed, so specs can get a fresh, unique CPF
// per run without failing the frontend's client-side checksum validation.
function genValidCpf(seed) {
	const base = String(seed).slice(-9).padStart(9, '0').split('').map(Number)

	function checkDigit(nums) {
		let sum = 0
		const len = nums.length
		for (let i = 0; i < len; i++) sum += nums[i] * (len + 1 - i)
		let d = 11 - (sum % 11)
		if (d >= 10) d = 0
		return d
	}

	const d1 = checkDigit(base)
	const d2 = checkDigit([...base, d1])
	return [...base, d1, d2].join('')
}

module.exports = { genValidCpf }
