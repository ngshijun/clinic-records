// Per-device history of vaccination/blood-test names that staff have actually
// entered or generated QRs for. Used to populate the name <datalist>
// suggestions on the staff console — replaces the previous static dictionary
// so each clinic's dropdown reflects what they actually use, not a generic
// catalogue.

const KEY = 'staff_name_history'
const MAX_PER_KIND = 30

export interface NameHistory {
  v: string[]
  b: string[]
}

function read(): NameHistory {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return {
      v: Array.isArray(raw.v) ? raw.v : [],
      b: Array.isArray(raw.b) ? raw.b : [],
    }
  } catch {
    return { v: [], b: [] }
  }
}

function write(h: NameHistory) {
  try { localStorage.setItem(KEY, JSON.stringify(h)) } catch {}
}

/**
 * Move `name` to the front of the kind's history list (case-insensitive
 * dedup), capped at MAX_PER_KIND. Returns the updated full history so
 * callers can refresh their reactive ref.
 */
export function recordName(kind: 'v' | 'b', name: string): NameHistory {
  const trimmed = name.trim()
  if (!trimmed) return read()
  const h = read()
  const list = h[kind]
  const filtered = list.filter(n => n.toLowerCase() !== trimmed.toLowerCase())
  filtered.unshift(trimmed)
  h[kind] = filtered.slice(0, MAX_PER_KIND)
  write(h)
  return h
}

export function readNameHistory(): NameHistory {
  return read()
}
