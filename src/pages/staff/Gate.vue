<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { verifyPassword, markStaffUnlocked, isStaffUnlocked } from '@/lib/staff-auth'

const router = useRouter()
const pw = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

if (isStaffUnlocked()) router.replace('/staff/generate')

async function submit() {
  busy.value = true
  error.value = null
  const ok = await verifyPassword(
    pw.value,
    import.meta.env.VITE_STAFF_PASSWORD_SALT as string,
    import.meta.env.VITE_STAFF_PASSWORD_HASH as string,
  )
  busy.value = false
  if (!ok) { error.value = 'Incorrect password'; return }
  markStaffUnlocked()
  router.replace('/staff/generate')
}
</script>

<template>
  <main class="max-w-sm mx-auto p-6 space-y-4">
    <h1 class="text-2xl font-semibold">Staff access</h1>
    <form @submit.prevent="submit" class="space-y-3">
      <input v-model="pw" type="password" placeholder="Clinic password" class="w-full border rounded px-3 py-2" required />
      <button :disabled="busy" class="w-full bg-black text-white rounded py-2">{{ busy ? 'Checking…' : 'Unlock' }}</button>
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
    </form>
  </main>
</template>
