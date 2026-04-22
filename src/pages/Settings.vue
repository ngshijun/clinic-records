<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
const auth = useAuthStore()
const router = useRouter()
async function logout() {
  await auth.signOut()
  router.push('/')
}
</script>

<template>
  <main class="max-w-lg mx-auto p-6 space-y-4">
    <h1 class="text-2xl font-semibold">Settings</h1>
    <button class="border rounded px-4 py-2" @click="logout">Log out</button>
  </main>
</template>
