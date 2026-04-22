const ITERATIONS = 100_000
const LOCAL_KEY = 'staff_unlocked_at'

export async function deriveHash(password: string, salt: string): Promise<string> {
  const pwBytes = new TextEncoder().encode(password)
  const saltBytes = new TextEncoder().encode(salt)
  const key = await crypto.subtle.importKey('raw', pwBytes, 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: ITERATIONS, hash: 'SHA-256' },
    key, 256,
  )
  return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPassword(password: string, salt: string, expectedHex: string): Promise<boolean> {
  const actual = await deriveHash(password, salt)
  if (actual.length !== expectedHex.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expectedHex.charCodeAt(i)
  return diff === 0
}

export function isStaffUnlocked(): boolean {
  return localStorage.getItem(LOCAL_KEY) !== null
}

export function markStaffUnlocked() {
  localStorage.setItem(LOCAL_KEY, String(Date.now()))
}

export function clearStaffUnlocked() {
  localStorage.removeItem(LOCAL_KEY)
}
