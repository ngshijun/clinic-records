<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProfilesStore } from '@/stores/profiles'

const store = useProfilesStore()
const route = useRoute()
const router = useRouter()
const name = ref('')
const dob = ref('')
const error = ref<string | null>(null)

onMounted(async () => {
  await store.fetchAll()
  if (route.query.first === '1' && store.profiles.length === 0) {
    name.value = 'Me'
  }
})

async function add() {
  error.value = null
  try {
    await store.create({ name: name.value.trim(), date_of_birth: dob.value || null })
    name.value = ''
    dob.value = ''
    if (route.query.first === '1') router.push('/home')
  } catch (e: any) { error.value = e.message }
}

async function del(id: string) {
  if (!confirm('Delete this profile and all its records?')) return
  try { await store.remove(id) } catch (e: any) { alert(e.message) }
}

async function setDefault(id: string) { await store.setDefault(id) }
</script>

<template>
  <main class="max-w-lg mx-auto p-6 space-y-6">
    <h1 class="text-2xl font-semibold">Profiles</h1>

    <form class="space-y-2" @submit.prevent="add">
      <input v-model="name" placeholder="Name (e.g. Ahmad)" required class="w-full border rounded px-3 py-2" />
      <input v-model="dob" type="date" class="w-full border rounded px-3 py-2" />
      <button class="bg-black text-white rounded px-4 py-2">Add profile</button>
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
    </form>

    <ul class="divide-y border rounded">
      <li v-for="p in store.profiles" :key="p.id" class="p-3 flex items-center justify-between">
        <div>
          <div class="font-medium">{{ p.name }}<span v-if="p.is_default" class="ml-2 text-xs text-green-700">(default)</span></div>
          <div class="text-sm text-gray-500">{{ p.date_of_birth ?? '' }}</div>
        </div>
        <div class="flex gap-2 text-sm">
          <button v-if="!p.is_default" class="underline" @click="setDefault(p.id)">Make default</button>
          <button class="text-red-600 underline" @click="del(p.id)">Delete</button>
        </div>
      </li>
    </ul>
  </main>
</template>
