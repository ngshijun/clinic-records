import { createI18n } from 'vue-i18n'
import en from '@/locales/en'
import zh from '@/locales/zh'
import ms from '@/locales/ms'

export type Locale = 'en' | 'zh' | 'ms'

export const AVAILABLE_LOCALES: { code: Locale; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'zh', label: 'Mandarin', native: '中文' },
  { code: 'ms', label: 'Bahasa Melayu', native: 'Bahasa Melayu' },
]

const STORAGE_KEY = 'locale'

function detectInitialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'zh' || stored === 'ms') return stored
  const nav = navigator.language?.toLowerCase() ?? ''
  if (nav.startsWith('zh')) return 'zh'
  if (nav.startsWith('ms') || nav.startsWith('id')) return 'ms'
  return 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: detectInitialLocale(),
  fallbackLocale: 'en',
  messages: { en, zh, ms },
})

export function setLocale(locale: Locale) {
  i18n.global.locale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.setAttribute('lang', locale)
  // Best-effort sync the locale onto the authenticated user's metadata so
  // server-side processes (push notifications, email reminders) can pick the
  // right language. Dynamic import avoids a hard dep between i18n and supabase.
  import('@/lib/supabase').then(({ supabase }) => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      if (data.user.user_metadata?.locale === locale) return
      supabase.auth.updateUser({ data: { locale } }).catch(() => {})
    }).catch(() => {})
  }).catch(() => {})
}

// Initialize <html lang>
document.documentElement.setAttribute('lang', i18n.global.locale.value as string)
