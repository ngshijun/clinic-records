import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { normalizeNric } from '@/lib/nric'

export interface Profile {
  id: string
  user_id: string
  name: string
  date_of_birth: string | null
  nric: string | null
  nationality: string  // ISO 3166-1 alpha-2 (e.g. 'MY')
  notes: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export const useProfilesStore = defineStore('profiles', () => {
  const profiles = ref<Profile[]>([])
  const activeId = ref<string | null>(null)
  const loaded = ref(false)

  const active = computed(() => profiles.value.find((p) => p.id === activeId.value) ?? null)
  const defaultProfile = computed(() => profiles.value.find((p) => p.is_default) ?? profiles.value[0] ?? null)

  // Cached profiles belong to whichever user was signed in when they
  // were fetched. Resetting on user-id change keeps the next consumer
  // (router guard or page) from acting on the previous user's data.
  const auth = useAuthStore()
  watch(() => auth.user?.id ?? null, (next, prev) => {
    if (next === prev) return
    profiles.value = []
    activeId.value = null
    loaded.value = false
  })

  async function fetchAll() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw error
    profiles.value = data ?? []
    if (!activeId.value) activeId.value = defaultProfile.value?.id ?? null
    loaded.value = true
  }

  async function create(input: {
    name: string
    nric: string
    nationality: string
    date_of_birth: string
  }) {
    const { data: userData } = await supabase.auth.getUser()
    const user_id = userData.user?.id
    if (!user_id) throw new Error('not authenticated')
    const is_default = profiles.value.length === 0
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        user_id,
        name: input.name,
        nric: normalizeNric(input.nric),
        nationality: input.nationality,
        date_of_birth: input.date_of_birth,
        is_default,
      })
      .select()
      .single()
    if (error) throw error
    profiles.value.push(data)
    if (is_default) activeId.value = data.id
    return data
  }

  async function update(id: string, patch: Partial<Profile>) {
    const clean = patch.nric != null ? { ...patch, nric: normalizeNric(patch.nric) } : patch
    const { data, error } = await supabase.from('profiles').update(clean).eq('id', id).select().single()
    if (error) throw error
    const i = profiles.value.findIndex((p) => p.id === id)
    if (i >= 0) profiles.value[i] = data
    return data
  }

  async function setDefault(id: string) {
    await supabase.from('profiles').update({ is_default: false }).neq('id', id)
    await update(id, { is_default: true })
    await fetchAll()
  }

  async function remove(id: string) {
    const target = profiles.value.find((p) => p.id === id)
    if (target?.is_default) throw new Error('Cannot delete the default profile')
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) throw new Error(error.message)
    profiles.value = profiles.value.filter((p) => p.id !== id)
    if (activeId.value === id) activeId.value = defaultProfile.value?.id ?? null
  }

  function setActive(id: string) { activeId.value = id }

  return { profiles, activeId, loaded, active, defaultProfile, fetchAll, create, update, setDefault, remove, setActive }
})
