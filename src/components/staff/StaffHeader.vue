<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import AppDropdown from '@/components/AppDropdown.vue'
import { AVAILABLE_LOCALES, setLocale, type Locale } from '@/lib/i18n'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const { locale } = useI18n()

const version = __APP_VERSION__

// `match` lists every route name that should light up a nav item — the patient
// detail page lives "under" Patients, so it keeps that tab active.
const items = [
  { name: 'staff-calendar', to: '/staff/calendar', key: 'admin.navCalendar', match: ['staff-calendar'] },
  { name: 'staff-patients', to: '/staff/patients', key: 'admin.navPatients', match: ['staff-patients', 'staff-patient-detail'] },
  { name: 'staff-generate', to: '/staff/generate', key: 'admin.navGenerate', match: ['staff-generate'] },
] as const

const localeOptions = computed(() => AVAILABLE_LOCALES.map((l) => ({ value: l.code, label: l.native })))

function isActive(match: readonly string[]): boolean {
  return match.includes(route.name as string)
}

async function lock() {
  await auth.signOut()
  router.replace('/staff')
}
</script>

<template>
  <!-- Shared staff console header. Self-contained: spans full width and centers
       its own max-w container, so every staff page renders an identical bar by
       dropping <StaffHeader/> at the top of its <main>. The #actions slot holds
       page-specific controls (e.g. Generate's "App QR"). -->
  <header class="hairline-b print:hidden">
    <div class="max-w-[1100px] mx-auto px-6 lg:px-10 py-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div class="flex items-center gap-4 min-w-0">
        <div class="flex items-center gap-2 shrink-0">
          <span class="dot-pulse"></span>
          <span class="eyebrow whitespace-nowrap">{{ $t('staff.consoleLabel') }}</span>
          <span class="folio text-xs opacity-40 select-all hidden sm:inline">{{ version }}</span>
        </div>
        <nav class="flex items-center gap-1 text-xs">
          <router-link
            v-for="it in items"
            :key="it.name"
            :to="it.to"
            class="px-2.5 py-1 eyebrow hover:text-ink whitespace-nowrap"
            :style="isActive(it.match) ? 'color: var(--color-staff-accent)' : ''"
          >{{ $t(it.key) }}</router-link>
        </nav>
      </div>

      <div class="flex items-center gap-4 shrink-0">
        <slot name="actions" />
        <AppDropdown
          :model-value="locale"
          :options="localeOptions"
          :aria-label="$t('settings.language')"
          trigger-class="pl-0 pr-5 py-1 text-xs whitespace-nowrap"
          style="color: var(--color-staff-ink); border-bottom: 1px solid var(--color-staff-rule);"
          @update:model-value="(v) => setLocale(v as Locale)"
        />
        <button class="btn-ghost !py-1.5 !px-3 text-xs whitespace-nowrap" @click="lock">{{ $t('admin.lock') }}</button>
      </div>
    </div>
  </header>
</template>
