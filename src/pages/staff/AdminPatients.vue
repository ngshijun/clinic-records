<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import StaffHeader from '@/components/staff/StaffHeader.vue'
import { searchPatients, type AdminPatient } from '@/lib/admin'
import { formatDateShort } from '@/lib/dates'
import { useDialog } from '@/lib/dialog'

const { t, locale } = useI18n()
const dialog = useDialog()

const query = ref('')
const results = ref<AdminPatient[]>([])
const searched = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

watch(query, (q) => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(async () => {
    if (q.trim().length < 2) {
      results.value = []
      searched.value = false
      return
    }
    try {
      results.value = await searchPatients(q)
      searched.value = true
    } catch (e) {
      await dialog.alertError(e, t('common.error'))
    }
  }, 250)
})

function dob(p: AdminPatient): string {
  return p.date_of_birth ? formatDateShort(p.date_of_birth, locale.value) : '—'
}
</script>

<template>
  <main class="min-h-dvh pb-20">
    <StaffHeader />
    <div class="max-w-[1100px] mx-auto px-6 lg:px-10 pt-6">
      <header class="mb-6 anim-rise">
        <div class="eyebrow"><span class="tick" style="background: var(--color-staff-accent)"></span>{{ $t('admin.patientsTitle') }}</div>
        <h1 class="font-display text-4xl leading-tight">{{ $t('admin.patientsTitle') }}</h1>
      </header>

      <input
        v-model="query"
        type="search"
        class="field text-lg anim-rise-2"
        :placeholder="$t('admin.searchPlaceholder')"
        autocomplete="off"
      />

      <p v-if="query.trim().length < 2" class="text-sm text-[var(--color-staff-muted)] mt-4">{{ $t('admin.searchHint') }}</p>
      <p v-else-if="searched && results.length === 0" class="text-sm text-[var(--color-staff-muted)] mt-4">{{ $t('admin.noResults') }}</p>

      <ul v-else class="mt-4 divide-y divide-[var(--color-staff-rule)] hairline-t hairline-b">
        <li v-for="p in results" :key="p.id">
          <router-link
            :to="`/staff/patients/${p.id}`"
            class="grid grid-cols-[1fr_auto] items-baseline gap-4 py-4 px-1 hover:bg-[var(--color-staff-panel)] transition-colors"
          >
            <div>
              <div class="font-display text-xl leading-tight">{{ p.name }}</div>
              <div class="text-xs text-[var(--color-staff-muted)] mt-0.5">
                <span>{{ $t('admin.nricLabel') }}: {{ p.nric ?? '—' }}</span>
                <span class="mx-2">·</span>
                <span>{{ $t('admin.dobLabel') }}: {{ dob(p) }}</span>
              </div>
            </div>
            <span class="text-[var(--color-staff-accent)]">→</span>
          </router-link>
        </li>
      </ul>
    </div>
  </main>
</template>
