export type QrKind = 'v' | 'b'

export interface QrPayload {
  id: string
  k: QrKind
  n: string
  d: string
  dn?: number
  td?: number
  nd?: number
}

const PREFIX = 'v1.'

function base64urlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function encodePayload(appOrigin: string, payload: QrPayload): string {
  const compact: Record<string, unknown> = {
    id: payload.id, k: payload.k, n: payload.n, d: payload.d,
  }
  if (payload.dn !== undefined) compact.dn = payload.dn
  if (payload.td !== undefined) compact.td = payload.td
  if (payload.nd !== undefined) compact.nd = payload.nd
  const json = JSON.stringify(compact)
  const b64 = base64urlEncode(new TextEncoder().encode(json))
  const origin = appOrigin.replace(/\/$/, '')
  return `${origin}/ingest#${PREFIX}${b64}`
}

export function decodeUrl(urlOrHash: string): QrPayload {
  const hashIdx = urlOrHash.indexOf('#')
  const fragment = hashIdx >= 0 ? urlOrHash.slice(hashIdx + 1) : urlOrHash
  if (!fragment.startsWith(PREFIX)) throw new Error(`Unsupported QR version: ${fragment.split('.')[0]}`)
  const body = fragment.slice(PREFIX.length)
  let json: string
  try {
    json = new TextDecoder().decode(base64urlDecode(body))
  } catch {
    throw new Error('Malformed QR payload (base64)')
  }
  let parsed: QrPayload
  try { parsed = JSON.parse(json) } catch { throw new Error('Malformed QR payload (json)') }
  if (!parsed.id || !parsed.k || !parsed.n || !parsed.d) throw new Error('Incomplete QR payload')
  return parsed
}

export async function computeFingerprint(payload: QrPayload): Promise<string> {
  const key = JSON.stringify({ id: payload.id, k: payload.k, n: payload.n, d: payload.d, dn: payload.dn, td: payload.td, nd: payload.nd })
  const bytes = new TextEncoder().encode(key)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
