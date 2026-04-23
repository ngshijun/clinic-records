<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useProfilesStore } from '@/stores/profiles'
import type { Reminder, Record } from '@/stores/records'
import { supabase } from '@/lib/supabase'
import { useDialog } from '@/lib/dialog'
import { MY_TIMEZONE, dateFmtLocale, formatDateLong } from '@/lib/dates'

const route = useRoute()
const router = useRouter()
const profiles = useProfilesStore()
const { t, locale } = useI18n()
const dialog = useDialog()

const rem = ref<Reminder | null>(null)
const sourceRecord = ref<Record | null>(null)

onMounted(async () => {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('id', route.params.id)
    .single()
  if (error) { await dialog.alert({ title: error.message }); router.push('/home'); return }
  rem.value = data
  if (data.record_id) {
    const { data: rec } = await supabase
      .from('records')
      .select('*')
      .eq('id', data.record_id)
      .single()
    sourceRecord.value = rec
  }
  await profiles.fetchAll()
})

const dueDate = computed(() => rem.value ? formatDateLong(rem.value.due_at, locale.value) : '')
const profileName = computed(() =>
  profiles.profiles.find(p => p.id === rem.value?.profile_id)?.name ?? '',
)
const reminderName = computed(() => sourceRecord.value?.name ?? rem.value?.name ?? rem.value?.title ?? '')
const kindLabel = computed(() => {
  if (!rem.value) return ''
  return rem.value.kind === 'next_dose'
    ? t('reminderDetail.vaccinationLabel')
    : t('reminderDetail.bloodTestLabel')
})
const seriesText = computed(() => {
  const r = sourceRecord.value
  if (!r || r.kind !== 'vaccination' || r.dose_number == null) return null
  const next = r.dose_number + 1
  return { n: next, total: r.total_doses }
})
const filedDate = computed(() => rem.value
  ? new Date(rem.value.created_at).toLocaleDateString(dateFmtLocale(locale.value), { timeZone: MY_TIMEZONE })
  : '',
)
</script>

<template>
  <main v-if="rem" class="min-h-dvh pb-20">
    <header class="max-w-[720px] w-full mx-auto px-6 pt-8">
      <router-link to="/home" class="folio underline underline-offset-4 decoration-[var(--color-rule)]">{{ $t('common.backToLedger') }}</router-link>
    </header>

    <section class="max-w-[720px] w-full mx-auto px-6 pt-10">
      <article class="paper-card relative overflow-hidden p-8 md:p-12 anim-rise">
        <div class="space-y-8">
          <div class="space-y-2">
            <div class="eyebrow">{{ kindLabel }}</div>
            <h1 class="font-display text-5xl md:text-6xl leading-[0.9]">{{ reminderName }}</h1>
            <p v-if="profileName" class="font-display-wonk text-muted-app text-lg">{{ $t('recordDetail.forPerson', { name: profileName }) }}</p>
          </div>

          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-6 hairline-t hairline-b py-6">
            <div>
              <dt class="eyebrow">{{ $t('reminderDetail.due') }}</dt>
              <dd class="font-display text-2xl mt-1">{{ dueDate }}</dd>
            </div>
            <div v-if="seriesText">
              <dt class="eyebrow">{{ $t('recordDetail.seriesPosition') }}</dt>
              <dd class="font-display text-2xl mt-1 tabular-nums">
                {{ seriesText.n }}<span v-if="seriesText.total" class="text-muted-app"> / {{ seriesText.total }}</span>
              </dd>
            </div>
          </dl>

          <div>
            <div class="eyebrow mb-2" style="color: var(--color-accent)">{{ $t('reminderDetail.pleaseNote') }}</div>
            <p class="font-display-wonk text-xl leading-snug text-ink-2">{{ $t('reminderDetail.clinicClosedSat') }}</p>
          </div>
        </div>
      </article>

      <footer class="flex items-center justify-between pt-6 text-xs">
        <div class="folio">{{ $t('reminderDetail.scheduled', { date: filedDate }) }}</div>
      </footer>
    </section>
  </main>

  <main v-else class="min-h-dvh grid place-items-center">
    <div class="font-display-wonk text-muted-app text-xl">{{ $t('recordDetail.retrieving') }}</div>
  </main>
</template>
