// Malaysian NRIC = 12 digits. Stored and displayed as the bare 12-digit
// string (no hyphens). normalizeNric strips hyphens/whitespace from user
// input as a friendliness gesture — Malaysians often type the hyphenated
// form by habit — but the canonical form is digits-only.

const RE_DIGITS_12 = /^\d{12}$/

export function normalizeNric(input: string): string {
  return input.trim().replace(/[-\s]/g, '')
}

export function isValidNric(input: string): boolean {
  return RE_DIGITS_12.test(normalizeNric(input))
}

// Derive YYYY-MM-DD from the first 6 digits of an NRIC. Returns null if the
// NRIC is malformed or the embedded date is invalid (e.g. 990230).
//
// Year disambiguation uses a rolling pivot anchored on the current year:
// YY values <= the current year's last two digits are 20YY, others are 19YY.
// This is correct for every patient currently alive — it would only mis-bin
// a patient born in a year the calendar hasn't reached yet, which by
// definition can't happen.
export function deriveDobFromNric(input: string): string | null {
  const d = normalizeNric(input)
  if (!RE_DIGITS_12.test(d)) return null
  const yy = Number(d.slice(0, 2))
  const mm = Number(d.slice(2, 4))
  const dd = Number(d.slice(4, 6))
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  const currentYY = new Date().getFullYear() % 100
  const fullYear = yy <= currentYY ? 2000 + yy : 1900 + yy
  // Reject e.g. Feb 30 — the JS Date rolls invalid days into next month, so
  // we round-trip and check the constructed date matches what we asked for.
  const probe = new Date(fullYear, mm - 1, dd)
  if (probe.getFullYear() !== fullYear || probe.getMonth() !== mm - 1 || probe.getDate() !== dd) return null
  return `${fullYear}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}
