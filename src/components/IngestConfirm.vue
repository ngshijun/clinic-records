<script setup lang="ts">
import type { QrPayload } from '@/lib/qr-payload'
import { computed } from 'vue'

const props = defineProps<{ payload: QrPayload }>()
const emit = defineEmits<{ (e: 'confirm'): void; (e: 'cancel'): void }>()

const kindLabel = computed(() => props.payload.k === 'v' ? 'Vaccination' : 'Blood test')
const doseLine = computed(() => {
  if (props.payload.k !== 'v' || !props.payload.dn || !props.payload.td) return null
  return `Dose ${props.payload.dn} of ${props.payload.td}`
})
const dueDate = computed(() => {
  if (!props.payload.nd) return null
  const due = new Date(props.payload.d)
  due.setDate(due.getDate() + props.payload.nd)
  return due.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
})
const givenDate = computed(() => new Date(props.payload.d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }))
</script>

<template>
  <section class="space-y-6 anim-rise">
    <div class="paper-card brackets p-6 md:p-8 relative overflow-hidden">
      <span class="br-tr"></span><span class="br-bl"></span>
      <!-- Watermark -->
      <div aria-hidden class="absolute -right-6 -bottom-10 font-display text-[9rem] leading-none text-ink opacity-[0.05] select-none pointer-events-none">
        {{ payload.k === 'v' ? 'Rx' : 'Lab' }}
      </div>

      <div class="flex items-start justify-between mb-5">
        <div class="eyebrow">Entry · {{ kindLabel }}</div>
        <div class="folio">{{ payload.id.slice(0, 8) }}…</div>
      </div>

      <h2 class="font-display text-4xl md:text-5xl leading-[0.95] mb-6">{{ payload.n }}</h2>

      <dl class="grid grid-cols-1 sm:grid-cols-3 gap-6 hairline-t pt-5">
        <div>
          <dt class="eyebrow">Given on</dt>
          <dd class="font-display text-lg mt-1">{{ givenDate }}</dd>
        </div>
        <div v-if="doseLine">
          <dt class="eyebrow">Series</dt>
          <dd class="font-display text-lg mt-1">{{ doseLine }}</dd>
        </div>
        <div v-if="dueDate">
          <dt class="eyebrow">Next due</dt>
          <dd class="font-display text-lg mt-1 text-accent">~ {{ dueDate }}</dd>
        </div>
      </dl>

      <div v-if="dueDate" class="mt-6 pt-5 hairline-t text-sm text-muted-app italic font-display-wonk">
        A reminder will surface as the date approaches.
      </div>
    </div>

    <div class="flex gap-3">
      <button class="btn-primary flex-1" @click="emit('confirm')">
        Add to ledger <span aria-hidden>→</span>
      </button>
      <button class="btn-ghost" @click="emit('cancel')">Cancel</button>
    </div>
  </section>
</template>
