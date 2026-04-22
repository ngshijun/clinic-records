<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { requestAndSubscribe, unsubscribeCurrent, isSubscribed } from '@/lib/push'

const auth = useAuthStore()
const router = useRouter()
const subbed = ref(false)
const busy = ref(false)
const isIosSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window.navigator as any).standalone

onMounted(async () => { subbed.value = await isSubscribed() })

async function toggle() {
  busy.value = true
  if (subbed.value) { await unsubscribeCurrent(); subbed.value = false }
  else { subbed.value = await requestAndSubscribe() }
  busy.value = false
}

async function logout() { await auth.signOut(); router.push('/') }
</script>

<template>
  <main class="max-w-lg mx-auto p-6 space-y-6">
    <h1 class="text-2xl font-semibold">Settings</h1>

    <section class="space-y-2">
      <h2 class="text-sm font-medium text-gray-600">Notifications</h2>
      <p v-if="isIosSafari" class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
        On iPhone, install this app to your Home Screen (Share → Add to Home Screen) before enabling notifications.
      </p>
      <button :disabled="busy" class="border rounded px-4 py-2" @click="toggle">
        {{ subbed ? 'Disable' : 'Enable' }} reminders
      </button>
    </section>

    <section>
      <button class="border rounded px-4 py-2" @click="logout">Log out</button>
    </section>
  </main>
</template>
