<script setup lang="ts">
import { onMounted } from 'vue'
import { useProfilesStore } from '@/stores/profiles'
import ProfileSwitcher from '@/components/ProfileSwitcher.vue'

const store = useProfilesStore()

onMounted(async () => { await store.fetchAll() })
</script>

<template>
  <main class="max-w-lg mx-auto p-4 space-y-4">
    <header class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Health records</h1>
      <ProfileSwitcher />
    </header>

    <section class="space-y-2">
      <h2 class="text-sm font-medium text-gray-600">Upcoming</h2>
      <p class="text-sm text-gray-400">No reminders yet.</p>
    </section>

    <section class="space-y-2">
      <h2 class="text-sm font-medium text-gray-600">History</h2>
      <p class="text-sm text-gray-400">No records yet. Scan a QR from your clinic to begin.</p>
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
