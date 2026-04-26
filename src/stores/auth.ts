import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { i18n, adoptServerLocale, type Locale } from '@/lib/i18n'

function syncLocaleFromServer(u: User | null) {
  if (!u) return
  const raw = u.user_metadata?.locale as string | undefined
  if (raw === 'en' || raw === 'zh' || raw === 'ms') {
    // Server has the user's stored preference — adopt it locally.
    adoptServerLocale(raw as Locale)
  } else {
    // No server-stored locale yet — seed with the device's current value.
    const current = i18n.global.locale.value as string
    supabase.auth.updateUser({ data: { locale: current } }).catch(() => {})
  }
}

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = computed<User | null>(() => session.value?.user ?? null)
  const loaded = ref(false)

  async function init() {
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    loaded.value = true
    syncLocaleFromServer(session.value?.user ?? null)
    supabase.auth.onAuthStateChange((_e, s) => {
      session.value = s
      syncLocaleFromServer(s?.user ?? null)
    })
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    session.value = data.session
  }

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    session.value = data.session
  }

  async function signOut() {
    await supabase.auth.signOut()
    session.value = null
  }

  // Anonymous users have no recovery mechanism, so signing out silently
  // strands their data on the server. This deletes the auth user (and
  // cascades all clinic rows) before clearing the local session.
  async function discardGuestSession() {
    const { error } = await supabase.functions.invoke('discard-guest-user', { method: 'POST' })
    if (error) throw error
    await supabase.auth.signOut().catch(() => {})
    session.value = null
  }

  const isAnonymous = computed<boolean>(() => user.value?.is_anonymous === true)

  async function signInAnonymously() {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    session.value = data.session
  }

  async function upgradeToEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.updateUser({ email, password })
    if (error) throw error
    // Session user updates via onAuthStateChange; force-refresh just in case
    const { data: s } = await supabase.auth.getSession()
    session.value = s.session
    return data.user
  }

  async function requestPasswordReset(email: string) {
    const redirectTo = `${window.location.origin}/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw error
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }

  return { session, user, loaded, isAnonymous, init, signIn, signUp, signInAnonymously, upgradeToEmail, requestPasswordReset, updatePassword, signOut, discardGuestSession }
})
