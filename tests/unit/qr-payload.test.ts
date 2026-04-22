import { describe, it, expect } from 'vitest'
import { encodePayload, decodeUrl, computeFingerprint, type QrPayload } from '@/lib/qr-payload'

const sample: QrPayload = {
  id: '01HYX3K5P2M4Q8W9R6T1Z7B0AE',
  k: 'v',
  n: 'Hepatitis B',
  d: '2026-04-22',
  dn: 1,
  td: 3,
  nd: 30,
}

describe('qr-payload', () => {
  it('round-trips a payload via a URL', () => {
    const url = encodePayload('https://clinic.app', sample)
    expect(url).toMatch(/^https:\/\/clinic\.app\/ingest#v1\./)
    const decoded = decodeUrl(url)
    expect(decoded).toEqual(sample)
  })

  it('decodes the hash fragment alone', () => {
    const url = encodePayload('https://clinic.app', sample)
    const hash = '#' + url.split('#')[1]
    expect(decodeUrl(hash)).toEqual(sample)
  })

  it('rejects unknown version', () => {
    expect(() => decodeUrl('#v9.abc')).toThrow(/version/i)
  })

  it('rejects malformed payload', () => {
    expect(() => decodeUrl('#v1.!!!not-base64!!!')).toThrow()
  })

  it('omits undefined optional fields from encoding', () => {
    const minimal: QrPayload = { id: sample.id, k: 'b', n: 'CBC', d: '2026-04-22' }
    const decoded = decodeUrl(encodePayload('https://x.y', minimal))
    expect(decoded).toEqual(minimal)
    expect('dn' in decoded).toBe(false)
  })

  it('fingerprints consistently', async () => {
    const a = await computeFingerprint(sample)
    const b = await computeFingerprint({ ...sample })
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('fingerprint differs when id differs', async () => {
    const a = await computeFingerprint(sample)
    const b = await computeFingerprint({ ...sample, id: 'DIFFERENT' })
    expect(a).not.toBe(b)
  })
})
