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

const upgradeEmail = ref('')
const upgradePassword = ref('')
const upgradeError = ref<string | null>(null)
const upgradeBusy = ref(false)
const upgraded = ref(false)

async function upgrade() {
  upgradeError.value = null
  upgradeBusy.value = true
  try {
    await auth.upgradeToEmail(upgradeEmail.value.trim(), upgradePassword.value)
    upgraded.value = true
    upgradeEmail.value = ''
    upgradePassword.value = ''
  } catch (e: any) {
    upgradeError.value = e.message ?? 'Could not create account'
  } finally {
    upgradeBusy.value = false
  }
}
</script>

<template>
  <main class="max-w-lg mx-auto p-6 space-y-6">
    <h1 class="text-2xl font-semibold">Settings</h1>

    <section v-if="auth.isAnonymous" class="border rounded p-4 space-y-3 bg-amber-50 border-amber-200">
      <div>
        <h2 class="font-semibold">Save your account</h2>
        <p class="text-sm text-gray-700">You're signed in as a guest. Add an email + password so your records survive if you clear your browser or switch devices.</p>
      </div>
      <p v-if="upgraded" class="text-sm text-green-700">Account saved. You can now sign in with your email.</p>
      <form v-else @submit.prevent="upgrade" class="space-y-2">
        <input v-model="upgradeEmail" type="email" placeholder="Email" required class="w-full border rounded px-3 py-2" />
        <input v-model="upgradePassword" type="password" placeholder="Password (8+ chars)" minlength="8" required class="w-full border rounded px-3 py-2" />
        <button :disabled="upgradeBusy" class="bg-black text-white rounded px-4 py-2">
          {{ upgradeBusy ? 'Saving…' : 'Save account' }}
        </button>
        <p v-if="upgradeError" class="text-red-600 text-sm">{{ upgradeError }}</p>
      </form>
    </section>

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
