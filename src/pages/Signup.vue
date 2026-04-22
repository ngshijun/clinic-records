<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

async function submit() {
  error.value = null
  busy.value = true
  try {
    await auth.signUp(email.value.trim(), password.value)
    router.push('/profiles?first=1')
  } catch (e: any) {
    error.value = e.message ?? 'Sign-up failed'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="max-w-sm mx-auto p-6 space-y-4">
    <h1 class="text-2xl font-semibold">Create account</h1>
    <form class="space-y-3" @submit.prevent="submit">
      <input v-model="email" type="email" placeholder="Email" class="w-full border rounded px-3 py-2" required />
      <input v-model="password" type="password" placeholder="Password (8+ chars)" minlength="8" class="w-full border rounded px-3 py-2" required />
      <button :disabled="busy" class="w-full bg-black text-white rounded py-2">
        {{ busy ? 'Creating…' : 'Create account' }}
      </button>
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
    </form>
    <p class="text-sm">Already have an account? <router-link to="/" class="underline">Sign in</router-link></p>
  </main>
</template>
