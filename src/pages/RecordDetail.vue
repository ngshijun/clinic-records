<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRecordsStore, type Record } from '@/stores/records'
import { useProfilesStore } from '@/stores/profiles'
import { supabase } from '@/lib/supabase'

const route = useRoute()
const router = useRouter()
const records = useRecordsStore()
const profiles = useProfilesStore()

const rec = ref<Record | null>(null)
const editing = ref(false)
const form = ref<Partial<Record>>({})

onMounted(async () => {
  const { data, error } = await supabase.from('records').select('*').eq('id', route.params.id).single()
  if (error) { alert(error.message); router.push('/home'); return }
  rec.value = data
  form.value = { ...data }
  await profiles.fetchAll()
})

async function save() {
  if (!rec.value) return
  const { name, performed_on, dose_number, total_doses, notes } = form.value
  const patch: Partial<Record> = { name: name!, performed_on: performed_on!, notes: notes ?? null }
  if (rec.value.kind === 'vaccination') {
    patch.dose_number = dose_number ?? null
    patch.total_doses = total_doses ?? null
  }
  rec.value = await records.updateRecord(rec.value.id, patch)
  editing.value = false
}

async function moveToProfile(e: Event) {
  if (!rec.value) return
  const profile_id = (e.target as HTMLSelectElement).value
  rec.value = await records.updateRecord(rec.value.id, { profile_id })
  router.push('/home')
}

async function del() {
  if (!rec.value) return
  if (!confirm('Delete this record?')) return
  await records.deleteRecord(rec.value.id)
  router.push('/home')
}
</script>

<template>
  <main class="max-w-lg mx-auto p-4 space-y-4" v-if="rec">
    <router-link to="/home" class="text-sm underline">← Back</router-link>

    <div v-if="!editing" class="space-y-2">
      <h1 class="text-xl font-semibold">{{ rec.name }}</h1>
      <div class="text-sm text-gray-600">{{ rec.kind === 'vaccination' ? 'Vaccination' : 'Blood test' }}</div>
      <div>Given: {{ rec.performed_on }}</div>
      <div v-if="rec.kind === 'vaccination'">Dose {{ rec.dose_number }} of {{ rec.total_doses }}</div>
      <p v-if="rec.notes" class="text-sm">{{ rec.notes }}</p>

      <div class="flex gap-3 pt-4">
        <button class="border rounded px-3 py-1" @click="editing = true">Edit</button>
        <label class="border rounded px-3 py-1">
          Move to profile
          <select class="ml-2" @change="moveToProfile">
            <option disabled selected value="">…</option>
            <option v-for="p in profiles.profiles.filter(p => p.id !== rec!.profile_id)" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <button class="text-red-600 underline" @click="del">Delete</button>
      </div>
    </div>

    <form v-else class="space-y-2" @submit.prevent="save">
      <input v-model="form.name" class="w-full border rounded px-3 py-2" />
      <input v-model="form.performed_on" type="date" class="w-full border rounded px-3 py-2" />
      <template v-if="rec.kind === 'vaccination'">
        <input v-model.number="form.dose_number" type="number" min="1" class="w-full border rounded px-3 py-2" placeholder="Dose number" />
        <input v-model.number="form.total_doses" type="number" min="1" class="w-full border rounded px-3 py-2" placeholder="Total doses" />
      </template>
      <textarea v-model="form.notes" rows="3" class="w-full border rounded px-3 py-2" placeholder="Notes"></textarea>
      <div class="flex gap-3">
        <button class="bg-black text-white rounded px-4 py-2">Save</button>
        <button type="button" class="border rounded px-4 py-2" @click="editing = false">Cancel</button>
      </div>
    </form>
  </main>
</template>
