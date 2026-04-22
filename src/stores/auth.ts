import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = computed<User | null>(() => session.value?.user ?? null)
  const loaded = ref(false)

  async function init() {
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    loaded.value = true
    supabase.auth.onAuthStateChange((_e, s) => { session.value = s })
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

  return { session, user, loaded, isAnonymous, init, signIn, signUp, signInAnonymously, upgradeToEmail, signOut }
})
