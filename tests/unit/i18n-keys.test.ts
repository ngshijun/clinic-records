import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import en from '@/locales/en'
import zh from '@/locales/zh'
import ms from '@/locales/ms'

type Dict = { [k: string]: unknown }

/** Flatten a nested message object into dot-delimited leaf keys. */
function flatten(obj: Dict, prefix = ''): string[] {
  const keys: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flatten(v as Dict, key))
    } else {
      keys.push(key)
    }
  }
  return keys
}

const SRC_DIR = join(process.cwd(), 'src')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(vue|ts)$/.test(entry)) out.push(full)
  }
  return out
}

// Matches static i18n lookups: t('a.b'), $t("a.b"), i18n.global.t('a.b').
// The negative lookbehind rejects identifiers ending in `t(` (insert(, select(,
// setTimeout(...). Backtick/template keys are intentionally skipped — dynamic
// keys can't be verified statically.
const KEY_RE = /(?<![\w$])\$?t\(\s*['"]([A-Za-z0-9_.]+)['"]/g

const enKeys = new Set(flatten(en as Dict))
const zhKeys = new Set(flatten(zh as Dict))
const msKeys = new Set(flatten(ms as Dict))

describe('i18n locale key parity', () => {
  it('zh defines exactly the same keys as en', () => {
    expect({
      missingInZh: [...enKeys].filter((k) => !zhKeys.has(k)),
      extraInZh: [...zhKeys].filter((k) => !enKeys.has(k)),
    }).toEqual({ missingInZh: [], extraInZh: [] })
  })

  it('ms defines exactly the same keys as en', () => {
    expect({
      missingInMs: [...enKeys].filter((k) => !msKeys.has(k)),
      extraInMs: [...msKeys].filter((k) => !enKeys.has(k)),
    }).toEqual({ missingInMs: [], extraInMs: [] })
  })
})

describe('i18n used-key existence', () => {
  it('every static t()/$t() key referenced in src resolves in en', () => {
    const misses: string[] = []
    for (const file of walk(SRC_DIR)) {
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(KEY_RE)) {
        const key = m[1]
        if (!key.includes('.')) continue // every real key is namespaced
        if (!enKeys.has(key)) misses.push(`${key}  →  ${relative(SRC_DIR, file)}`)
      }
    }
    expect(misses).toEqual([])
  })
})
