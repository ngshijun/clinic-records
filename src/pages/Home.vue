<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useProfilesStore } from '@/stores/profiles'
import { useRecordsStore } from '@/stores/records'
import { useAuthStore } from '@/stores/auth'
import ProfileSwitcher from '@/components/ProfileSwitcher.vue'

const profiles = useProfilesStore()
const records = useRecordsStore()
const auth = useAuthStore()
const dismissed = ref(localStorage.getItem('guest_nudge_dismissed') === '1')
function dismiss() {
  localStorage.setItem('guest_nudge_dismissed', '1')
  dismissed.value = true
}

async function refresh() {
  if (profiles.activeId) await records.fetchForProfile(profiles.activeId)
}

onMounted(async () => {
  await profiles.fetchAll()
  await refresh()
})
watch(() => profiles.activeId, refresh)
</script>

<template>
  <main class="max-w-lg mx-auto p-4 space-y-4">
    <header class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Health records</h1>
      <ProfileSwitcher />
    </header>

    <div v-if="auth.isAnonymous && !dismissed"
      class="bg-amber-50 border border-amber-200 rounded p-3 text-sm flex items-start justify-between gap-3">
      <div>
        <div class="font-medium">Guest mode</div>
        <div class="text-gray-700">Add an email + password in Settings so you can sign in on another device.</div>
      </div>
      <div class="flex flex-col gap-1 shrink-0">
        <router-link to="/settings" class="underline text-xs">Set up</router-link>
        <button @click="dismiss" class="text-xs text-gray-500">Not now</button>
      </div>
    </div>

    <section class="space-y-2">
      <h2 class="text-sm font-medium text-gray-600">Upcoming</h2>
      <p v-if="records.reminders.length === 0" class="text-sm text-gray-400">No upcoming reminders.</p>
      <ul v-else class="space-y-2">
        <li v-for="r in records.reminders" :key="r.id" class="border rounded p-3">
          <div class="font-medium">{{ r.title }}</div>
          <div class="text-sm text-gray-500">Due {{ new Date(r.due_at).toLocaleDateString() }}</div>
        </li>
      </ul>
    </section>

    <section class="space-y-2">
      <h2 class="text-sm font-medium text-gray-600">History</h2>
      <p v-if="records.records.length === 0" class="text-sm text-gray-400">No records yet. Scan a QR from your clinic to begin.</p>
      <ul v-else class="space-y-2">
        <li v-for="r in records.records" :key="r.id">
          <router-link :to="`/records/${r.id}`" class="block border rounded p-3">
            <div class="font-medium">{{ r.name }}</div>
            <div class="text-sm text-gray-500">
              {{ r.kind === 'vaccination' ? `Dose ${r.dose_number} of ${r.total_doses}` : 'Blood test' }}
              · {{ r.performed_on }}
            </div>
          </router-link>
        </li>
      </ul>
    </section>

    <router-link to="/scan"
      class="fixed bottom-6 right-6 bg-black text-white rounded-full px-5 py-3 shadow-lg">
      Scan
    </router-link>

    <footer class="flex gap-4 pt-8 text-sm">
      <router-link to="/profiles" class="underline">Profiles</router-link>
      <router-link to="/settings" class="underline">Settings</router-link>
    </footer>
  </main>
</template>
