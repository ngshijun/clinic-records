<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const items = [
  { name: 'staff-calendar', to: '/staff/calendar', key: 'admin.navCalendar' },
  { name: 'staff-patients', to: '/staff/patients', key: 'admin.navPatients' },
  { name: 'staff-generate', to: '/staff/generate', key: 'admin.navGenerate' },
] as const

async function lock() {
  await auth.signOut()
  router.replace('/staff')
}
</script>

<template>
  <nav class="flex items-center gap-1 hairline-b pb-3 mb-6 text-xs">
    <router-link
      v-for="it in items"
      :key="it.name"
      :to="it.to"
      class="px-3 py-1.5 eyebrow hover:text-ink"
      :style="route.name === it.name ? 'color: var(--color-staff-accent)' : ''"
    >{{ $t(it.key) }}</router-link>
    <button class="ml-auto px-3 py-1.5 eyebrow hover:text-ink" @click="lock">{{ $t('admin.lock') }}</button>
  </nav>
</template>
