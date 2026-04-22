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
    await auth.signIn(email.value.trim(), password.value)
    router.push('/home')
  } catch (e: any) {
    error.value = e.message ?? 'Sign-in failed'
  } finally {
    busy.value = false
  }
}

async function guest() {
  error.value = null
  busy.value = true
  try {
    await auth.signInAnonymously()
    router.push('/profiles?first=1')
  } catch (e: any) {
    error.value = e.message ?? 'Could not start as guest'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="max-w-sm mx-auto p-6 space-y-4">
    <h1 class="text-2xl font-semibold">Sign in</h1>
    <form class="space-y-3" @submit.prevent="submit">
      <input v-model="email" type="email" placeholder="Email" class="w-full border rounded px-3 py-2" required />
      <input v-model="password" type="password" placeholder="Password" class="w-full border rounded px-3 py-2" required />
      <button :disabled="busy" class="w-full bg-black text-white rounded py-2">
        {{ busy ? 'Signing in…' : 'Sign in' }}
      </button>
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
    </form>

    <div class="flex items-center gap-3 text-gray-400 text-xs">
      <div class="h-px flex-1 bg-gray-200"></div><span>OR</span><div class="h-px flex-1 bg-gray-200"></div>
    </div>

    <button :disabled="busy" class="w-full border rounded py-2" @click="guest">
      Continue as guest
    </button>

    <p class="text-sm">No account? <router-link to="/signup" class="underline">Sign up</router-link></p>
  </main>
</template>
