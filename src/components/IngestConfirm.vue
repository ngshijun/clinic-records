<script setup lang="ts">
import type { QrPayload } from '@/lib/qr-payload'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDateLong } from '@/lib/dates'

const props = defineProps<{ payload: QrPayload }>()
const emit = defineEmits<{ (e: 'confirm'): void; (e: 'cancel'): void }>()
const { t, locale } = useI18n()

const isReminder = computed(() => props.payload.k === 'r')
const kindLabel = computed(() => {
  if (props.payload.k === 'v') return t('ingest.vaccination')
  if (props.payload.k === 'r') return t('ingest.reminder')
  return t('ingest.bloodTest')
})
const doseLine = computed(() => {
  if (props.payload.k !== 'v' || !props.payload.dn || !props.payload.td) return null
  return t('home.doseOf', { n: props.payload.dn, total: props.payload.td })
})
const dueDate = computed(() => {
  if (!props.payload.nd) return null
  const due = new Date(props.payload.d)
  due.setDate(due.getDate() + props.payload.nd)
  return formatDateLong(due, locale.value)
})
const givenDate = computed(() => formatDateLong(props.payload.d, locale.value))
const reminderLine = computed(() => {
  if (!dueDate.value) return null
  if (props.payload.k === 'v') return t('ingest.remindAroundDose', { date: dueDate.value })
  if (props.payload.k === 'r') return t('ingest.scheduleOn', { date: dueDate.value })
  return t('ingest.remindAroundTest', { date: dueDate.value })
})
</script>

<template>
  <section class="space-y-6 anim-rise">
    <div class="paper-card brackets p-6 md:p-8 relative overflow-hidden">
      <span class="br-tr"></span><span class="br-bl"></span>
      <div aria-hidden class="absolute -right-6 -bottom-10 font-display text-[9rem] leading-none text-ink opacity-[0.05] select-none pointer-events-none">
        {{ payload.k === 'v' ? 'Rx' : payload.k === 'r' ? 'R' : 'Lab' }}
      </div>

      <div class="eyebrow mb-5">{{ $t('ingest.entry') }} · {{ kindLabel }}</div>

      <h2 class="font-display text-4xl md:text-5xl leading-[0.95] mb-6">{{ payload.n }}</h2>

      <dl class="grid grid-cols-1 sm:grid-cols-3 gap-6 hairline-t pt-5">
        <div>
          <dt class="eyebrow">{{ isReminder ? $t('ingest.issuedOn') : $t('ingest.givenOn') }}</dt>
          <dd class="font-display text-lg mt-1">{{ givenDate }}</dd>
        </div>
        <div v-if="doseLine">
          <dt class="eyebrow">{{ $t('ingest.series') }}</dt>
          <dd class="font-display text-lg mt-1">{{ doseLine }}</dd>
        </div>
        <div v-if="dueDate">
          <dt class="eyebrow">{{ isReminder ? $t('ingest.due') : $t('ingest.nextDue') }}</dt>
          <dd class="font-display text-lg mt-1 text-accent">~ {{ dueDate }}</dd>
        </div>
      </dl>

      <div v-if="reminderLine" class="mt-6 pt-5 hairline-t text-sm text-muted-app italic font-display-wonk">
        {{ $t('ingest.reminderNote') }}
      </div>
    </div>

    <div class="flex gap-3">
      <button class="btn-primary flex-1" @click="emit('confirm')">
        {{ isReminder ? $t('ingest.scheduleReminder') : $t('ingest.addToLedger') }} <span aria-hidden>→</span>
      </button>
      <button class="btn-ghost" @click="emit('cancel')">{{ $t('common.cancel') }}</button>
    </div>
  </section>
</template>
